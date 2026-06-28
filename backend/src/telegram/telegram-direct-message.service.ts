import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Api, TelegramClient } from 'telegram';
import bigInt from 'big-integer';
import { DirectMessageRecipient } from '../common/types';
import { withTimeout } from '../common/telegram-flood.util';
import { TelegramBroadcastClientService } from './telegram-broadcast-client.service';
import { TelegramClientService } from './telegram-client.service';
import { resolveDirectMessageEntity } from './telegram-entity.util';

const SEND_TIMEOUT_MS = 60_000;
const ENTITY_TIMEOUT_MS = 30_000;

@Injectable()
export class TelegramDirectMessageService {
  private readonly logger = new Logger(TelegramDirectMessageService.name);

  constructor(
    @Inject(forwardRef(() => TelegramClientService))
    private readonly monitorService: TelegramClientService,
    private readonly broadcastService: TelegramBroadcastClientService,
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
      typeof recipient === 'string' ? { telegramUserId: recipient } : recipient;

    const sendClient = this.getSendClient();
    if (!sendClient) {
      throw new Error('Telegram ulanmagan');
    }

    const monitorClient = this.monitorService.getClient();
    const broadcastClient = this.broadcastService.getClient();
    const viaBroadcast = sendClient === broadcastClient;

    await this.warmSourceGroup(sendClient, target);

    const entity = await this.resolveEntityForSend(
      sendClient,
      monitorClient,
      target,
      viaBroadcast,
    );

    await withTimeout(
      sendClient.sendMessage(entity, { message: text }),
      SEND_TIMEOUT_MS,
      `Xabar yuborish vaqti tugadi (ID: ${target.telegramUserId})`,
    );

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

  private async resolveEntityForSend(
    sendClient: TelegramClient,
    monitorClient: TelegramClient | null,
    target: DirectMessageRecipient,
    viaBroadcast: boolean,
  ): Promise<Parameters<TelegramClient['sendMessage']>[0]> {
    if (!viaBroadcast) {
      return withTimeout(
        resolveDirectMessageEntity(sendClient, target),
        ENTITY_TIMEOUT_MS,
        `Foydalanuvchi hal qilish vaqti tugadi (ID: ${target.telegramUserId})`,
      );
    }

    const broadcastTarget: DirectMessageRecipient = {
      ...target,
      accessHash: null,
    };

    let lastError: Error | null = null;

    try {
      return await withTimeout(
        resolveDirectMessageEntity(sendClient, broadcastTarget, {
          allowAccessHash: false,
        }),
        ENTITY_TIMEOUT_MS,
        `Foydalanuvchi hal qilish vaqti tugadi (ID: ${target.telegramUserId})`,
      );
    } catch (error) {
      lastError = error as Error;
    }

    if (!monitorClient || monitorClient === sendClient) {
      throw (
        lastError ??
        new Error(`Foydalanuvchi topilmadi (ID: ${target.telegramUserId})`)
      );
    }

    try {
      await this.warmSourceGroup(monitorClient, target);

      await resolveDirectMessageEntity(monitorClient, target).catch(() => null);

      const monitorUser = await withTimeout(
        this.fetchUserOnClient(monitorClient, target.telegramUserId),
        ENTITY_TIMEOUT_MS,
        `Monitor foydalanuvchi vaqti tugadi (ID: ${target.telegramUserId})`,
      );

      if (monitorUser?.username) {
        return withTimeout(
          resolveDirectMessageEntity(
            sendClient,
            { ...broadcastTarget, username: monitorUser.username },
            { allowAccessHash: false },
          ),
          ENTITY_TIMEOUT_MS,
          `Foydalanuvchi hal qilish vaqti tugadi (ID: ${target.telegramUserId})`,
        );
      }

      if (monitorUser?.phone) {
        const byPhone = await this.resolveByPhone(
          sendClient,
          monitorUser.phone,
        );
        if (byPhone) return byPhone;
      }
    } catch (error) {
      lastError = error as Error;
    }

    throw (
      lastError ??
      new Error(
        `Broadcast akkaunt foydalanuvchini topa olmadi (ID: ${target.telegramUserId}). ` +
          `Yuborish akkauntini kuzatiladigan guruhlarga qo'shing yoki foydalanuvchida @username bo'lsin.`,
      )
    );
  }

  private async fetchUserOnClient(
    client: TelegramClient,
    telegramUserId: string,
  ): Promise<Api.User | null> {
    try {
      const entity = await client.getEntity(bigInt(telegramUserId));
      return entity instanceof Api.User ? entity : null;
    } catch {
      return null;
    }
  }

  private async resolveByPhone(
    client: TelegramClient,
    phone: string,
  ): Promise<Parameters<TelegramClient['sendMessage']>[0] | null> {
    const normalized = phone.startsWith('+') ? phone : `+${phone}`;
    try {
      const result = await withTimeout(
        client.invoke(
          new Api.contacts.ImportContacts({
            contacts: [
              new Api.InputPhoneContact({
                clientId: bigInt(Date.now()),
                phone: normalized,
                firstName: 'User',
                lastName: '',
              }),
            ],
          }),
        ),
        ENTITY_TIMEOUT_MS,
        'Telefon orqali qidirish vaqti tugadi',
      );
      const user = result.users?.[0];
      if (user instanceof Api.User) {
        return user;
      }
    } catch {
      return null;
    }
    return null;
  }

  private async warmSourceGroup(
    client: TelegramClient,
    target: DirectMessageRecipient,
  ): Promise<void> {
    const groupId = target.sourceGroupId?.trim();
    if (!groupId) return;

    try {
      await withTimeout(
        client.getEntity(groupId),
        10_000,
        `Guruh entity vaqti tugadi (${groupId})`,
      );
    } catch {
      // broadcast akkaunt guruhda bo'lmasa keyingi usul sinanadi
    }
  }
}
