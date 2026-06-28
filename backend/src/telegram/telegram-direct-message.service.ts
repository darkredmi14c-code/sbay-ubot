import {
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { TelegramClient } from 'telegram';
import { DirectMessageRecipient } from '../common/types';
import { GroupsService } from '../groups/groups.service';
import { TelegramBroadcastClientService } from './telegram-broadcast-client.service';
import { TelegramClientService } from './telegram-client.service';
import { resolveDirectMessageEntity } from './telegram-entity.util';

@Injectable()
export class TelegramDirectMessageService {
  private readonly logger = new Logger(TelegramDirectMessageService.name);

  constructor(
    @Inject(forwardRef(() => TelegramClientService))
    private readonly monitorService: TelegramClientService,
    private readonly broadcastService: TelegramBroadcastClientService,
    private readonly groupsService: GroupsService,
  ) {}

  isSendReady(): boolean {
    if (this.broadcastService.isReady()) return true;
    return this.monitorService.getStatus().connected;
  }

  getSenderAccount(): {
    mode: 'broadcast' | 'monitor';
    username: string | null;
    userId: string | null;
  } {
    if (this.broadcastService.isReady()) {
      const s = this.broadcastService.getStatus();
      return { mode: 'broadcast', username: s.username, userId: s.userId };
    }
    const s = this.monitorService.getStatus();
    return { mode: 'monitor', username: s.username, userId: s.userId };
  }

  async sendDirectMessage(
    recipient: string | DirectMessageRecipient,
    text: string,
  ): Promise<void> {
    const target: DirectMessageRecipient =
      typeof recipient === 'string'
        ? { telegramUserId: recipient }
        : recipient;

    const sendClient = this.getSendClient();
    if (!sendClient) {
      throw new Error('Telegram ulanmagan');
    }

    const monitorClient = this.monitorService.getClient();
    const broadcastClient = this.broadcastService.getClient();

    if (monitorClient) {
      await this.warmEntityCache(monitorClient, target);
    }

    const entity = await this.resolveEntity(
      monitorClient,
      broadcastClient,
      target,
    );

    await sendClient.sendMessage(entity, { message: text });

    const sender = this.getSenderAccount();
    this.logger.log(
      `Xabar yuborildi (${sender.mode} @${sender.username ?? sender.userId}): ${target.telegramUserId}`,
    );
  }

  private getSendClient(): TelegramClient | null {
    if (this.broadcastService.isReady()) {
      return this.broadcastService.getClient();
    }
    return this.monitorService.getClient();
  }

  private async resolveEntity(
    monitorClient: TelegramClient | null,
    broadcastClient: TelegramClient | null,
    target: DirectMessageRecipient,
  ): Promise<Parameters<TelegramClient['sendMessage']>[0]> {
    const clients = [broadcastClient, monitorClient].filter(
      (c): c is TelegramClient => c !== null,
    );

    let lastError: Error | null = null;
    for (const client of clients) {
      try {
        return await resolveDirectMessageEntity(client, target);
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw (
      lastError ??
      new Error(`Foydalanuvchi topilmadi (ID: ${target.telegramUserId})`)
    );
  }

  private async warmEntityCache(
    client: TelegramClient,
    target: DirectMessageRecipient,
  ): Promise<void> {
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
          await client.getEntity(id);
        } catch {
          // kuzatuvchi akkaunt guruhda bo'lmasa keyingi usul sinanadi
        }
      }),
    );
  }
}
