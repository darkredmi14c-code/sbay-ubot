import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Api, TelegramClient } from 'telegram';
import { NewMessage, NewMessageEvent, Raw } from 'telegram/events';
import { StringSession } from 'telegram/sessions';
import input from 'input';
import bigInt from 'big-integer';
import { TelegramStatus, DirectMessageRecipient } from '../common/types';
import { GroupsService } from '../groups/groups.service';
import { KeywordsService } from '../keywords/keywords.service';
import { MessageProcessorService } from '../messages/message-processor.service';
import { MessageQueueService } from '../queue/message-queue.service';
import { TelegramGroupPollerService } from './telegram-group-poller.service';
import {
  buildIncomingPayload,
  getChatIdFromMessage,
} from './telegram-message.util';
import { resolveDirectMessageEntity } from './telegram-entity.util';

@Injectable()
export class TelegramClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramClientService.name);
  private client: TelegramClient | null = null;
  private connected = false;
  private username: string | null = null;
  private userId: string | null = null;
  private messagesReceived = 0;
  private readonly recentMessageKeys = new Set<string>();
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly groupsService: GroupsService,
    private readonly keywordsService: KeywordsService,
    @Inject(forwardRef(() => MessageProcessorService))
    private readonly processor: MessageProcessorService,
    private readonly queueService: MessageQueueService,
    private readonly poller: TelegramGroupPollerService,
  ) {}

  getClient(): TelegramClient | null {
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    const apiId = Number(this.config.get<string>('TELEGRAM_API_ID'));
    const apiHash = this.config.get<string>('TELEGRAM_API_HASH');

    if (!apiId || !apiHash) {
      this.logger.warn(
        "TELEGRAM_API_ID yoki TELEGRAM_API_HASH yo'q — userbot o'chirilgan",
      );
      return;
    }

    const sessionString = this.config.get<string>('TELEGRAM_SESSION') ?? '';
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production' ||
      Boolean(this.config.get<string>('RENDER'));

    if (!sessionString && isProduction) {
      this.logger.error(
        "TELEGRAM_SESSION bo'sh! Render da interaktiv kirish mumkin emas. " +
          "Avval mahalliy kompyuterdan session oling va Environment ga qo'ying.",
      );
      return;
    }

    await this.connect(sessionString);

    if (this.connected && this.client) {
      this.reconnectTimer = setInterval(
        () => void this.ensureConnected(),
        60_000,
      );
      this.poller.start(this.client, (msg) => this.processMessage(msg));
    }
  }

  private async connect(sessionString: string): Promise<void> {
    const apiId = Number(this.config.get<string>('TELEGRAM_API_ID'));
    const apiHash = this.config.get<string>('TELEGRAM_API_HASH')!;
    const session = new StringSession(sessionString);

    this.client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 15,
      retryDelay: 2000,
      autoReconnect: true,
      useWSS: false,
    });

    try {
      const isProduction =
        this.config.get<string>('NODE_ENV') === 'production' ||
        Boolean(this.config.get<string>('RENDER'));

      if (sessionString) {
        await this.client.connect();
        if (!(await this.client.isUserAuthorized())) {
          throw new Error('TELEGRAM_SESSION yaroqsiz yoki muddati tugagan');
        }
      } else if (!isProduction) {
        await this.client.start({
          phoneNumber: async () =>
            await input.text('Telefon raqamingiz (+998...): '),
          password: async () =>
            await input.text("Ikki bosqichli parol (bo'sh qoldiring): "),
          phoneCode: async () => await input.text('Telegram kodini kiriting: '),
          onError: (err) => this.logger.error(err),
        });

        const newSession = this.client.session.save() as unknown as string;
        if (newSession && newSession !== sessionString) {
          this.logger.warn(
            'Yangi TELEGRAM_SESSION yaratildi — .env fayliga saqlang!',
          );
          this.logger.warn(`TELEGRAM_SESSION=${newSession}`);
        }
      }

      const me = await this.client.getMe();
      this.username = me.username ?? null;
      this.userId = me.id?.toString() ?? null;
      this.connected = true;

      this.registerMessageHandlers();
      await this.client.invoke(new Api.updates.GetState());

      await this.resolveAllGroups();
      await this.poller.initCursors(this.client);
      try {
        await this.client.getDialogs({ limit: 50 });
      } catch {
        // push update sinxronlash ixtiyoriy
      }
      this.logger.log(`Telegram ulandi: @${this.username ?? this.userId}`);
    } catch (error) {
      this.connected = false;
      this.logger.error(`Telegram ulanish xatosi: ${(error as Error).message}`);
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client) return;
    try {
      if (!this.client.connected) {
        this.logger.warn('Telegram uzildi — qayta ulanmoqda...');
        await this.client.connect();
        await this.client.getMe();
        await this.client.invoke(new Api.updates.GetState());
        this.connected = true;
        this.logger.log('Telegram qayta ulandi');
      }
    } catch (error) {
      this.connected = false;
      this.logger.error(`Qayta ulanish xatosi: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.poller.stop();
    if (this.client) {
      await this.client.disconnect();
    }
  }

  /** Username/link bilan qo'shilgan guruhlarni haqiqiy ID ga aylantirish */
  async resolveAllGroups(): Promise<{ resolved: number; failed: string[] }> {
    if (!this.client || !this.connected) {
      return { resolved: 0, failed: ['Telegram ulanmagan'] };
    }

    const pending = await this.groupsService.getUnresolvedGroups();
    let resolved = 0;
    const failed: string[] = [];

    for (const group of pending) {
      const entityInput = this.groupsService.toEntityInput(group.telegramId);
      try {
        const entity = await this.client.getEntity(entityInput);
        const chatId = this.extractChatId(entity);
        if (!chatId) {
          failed.push(`${group.telegramId}: ID topilmadi`);
          continue;
        }
        const title = 'title' in entity ? String(entity.title) : group.title;
        await this.groupsService.updateTelegramId(
          group.telegramId,
          chatId,
          title ?? undefined,
        );
        resolved++;
        this.logger.log(`Guruh hal qilindi: ${group.telegramId} → ${chatId}`);
      } catch (error) {
        const msg = (error as Error).message;
        failed.push(`${group.telegramId}: ${msg}`);
        this.logger.warn(
          `Guruh hal qilinmadi (${group.telegramId}): ${msg}. ` +
            "Userbot hisobini guruhga qo'shing.",
        );
      }
    }

    if (pending.length > 0) {
      this.logger.log(
        `Guruhlar hal qilindi: ${resolved}/${pending.length}` +
          (failed.length ? `, xato: ${failed.length}` : ''),
      );
    }

    return { resolved, failed };
  }

  private extractChatId(entity: unknown): string | null {
    if (entity && typeof entity === 'object' && 'id' in entity) {
      const id = (entity as { id: bigInt.BigInteger }).id;
      if (entity instanceof Api.Channel || entity instanceof Api.Chat) {
        const raw = id.toString();
        if (entity instanceof Api.Channel) {
          return `-100${raw}`;
        }
        return `-${raw}`;
      }
      return id.toString();
    }
    return null;
  }

  private registerMessageHandlers(): void {
    if (!this.client) return;

    this.client.addEventHandler(
      (event) => void this.onNewMessage(event),
      new NewMessage({ incoming: true }),
    );

    this.client.addEventHandler(
      (update) => {
        if (
          update instanceof Api.UpdateNewChannelMessage ||
          update instanceof Api.UpdateNewMessage
        ) {
          if (update.message instanceof Api.Message) {
            void this.processMessage(update.message);
          }
        }
      },
      new Raw({
        types: [Api.UpdateNewChannelMessage, Api.UpdateNewMessage],
      }),
    );
  }

  private isDuplicateMessage(chatId: string, messageId: number): boolean {
    const key = `${chatId}:${messageId}`;
    if (this.recentMessageKeys.has(key)) return true;
    this.recentMessageKeys.add(key);
    if (this.recentMessageKeys.size > 5000) {
      this.recentMessageKeys.clear();
    }
    return false;
  }

  private async onNewMessage(event: NewMessageEvent): Promise<void> {
    await this.processMessage(event.message);
  }

  private async processMessage(message: Api.Message): Promise<void> {
    try {
      if (!message) return;

      const chatId = getChatIdFromMessage(message);
      if (!chatId) return;

      if (this.isDuplicateMessage(chatId, message.id)) return;

      if (message.out) return;

      if (!this.groupsService.isMonitored(chatId)) return;

      this.messagesReceived++;

      const chat = await message.getChat();
      const chatTitle = chat && 'title' in chat ? String(chat.title) : chatId;

      const payload = await buildIncomingPayload(message, chatId, chatTitle);
      if (!payload) return;

      this.logger.log(
        `Xabar: "${payload.text.slice(0, 80)}${payload.text.length > 80 ? '…' : ''}" — ${chatTitle}`,
      );

      this.processor.handleIncoming(payload);
    } catch (error) {
      this.logger.error(
        `Xabar qayta ishlash xatosi: ${(error as Error).message}`,
      );
    }
  }

  async sendDirectMessage(
    recipient: string | DirectMessageRecipient,
    text: string,
  ): Promise<void> {
    if (!this.client || !this.connected) {
      throw new Error('Telegram ulanmagan');
    }

    const target: DirectMessageRecipient =
      typeof recipient === 'string'
        ? { telegramUserId: recipient }
        : recipient;

    await this.warmEntityCache(target);
    const entity = await resolveDirectMessageEntity(this.client, target);
    await this.client.sendMessage(entity, { message: text });
    this.logger.log(`Xabar yuborildi: user ${target.telegramUserId}`);
  }

  /** Guruh va foydalanuvchi entity keshini yangilash */
  private async warmEntityCache(target: DirectMessageRecipient): Promise<void> {
    if (!this.client) return;

    const warmIds = new Set<string>();
    if (target.sourceGroupId?.trim()) {
      warmIds.add(target.sourceGroupId.trim());
    }
    for (const groupId of this.groupsService.getCachedGroupIds().slice(0, 15)) {
      warmIds.add(groupId);
    }

    await Promise.all(
      [...warmIds].map(async (id) => {
        try {
          await this.client!.getEntity(id);
        } catch {
          // Guruh keshda bo'lmasa keyingi urinishda hal qilinadi
        }
      }),
    );
  }

  getStatus(): TelegramStatus {
    const queue = this.queueService.getStats();
    return {
      connected: this.connected,
      username: this.username,
      userId: this.userId,
      monitoredGroupsCount: this.groupsService.getCachedGroupIds().length,
      unresolvedGroupsCount: this.groupsService.getUnresolvedCount(),
      keywordsCount: this.keywordsService.getCachedKeywords().length,
      queuePending: queue.filterPending + queue.aiPending,
      queueSize: queue.filterSize + queue.aiSize,
      processedTotal: queue.processedTotal,
      skippedTotal: queue.skippedTotal,
      publishedTotal: queue.publishedTotal,
      messagesReceived: this.messagesReceived,
      lastError: this.processor.getLastError(),
    };
  }
}
