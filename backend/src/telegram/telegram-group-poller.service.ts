import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Api, TelegramClient } from 'telegram';
import { GroupsService } from '../groups/groups.service';

export type PolledMessageHandler = (message: Api.Message) => Promise<void>;

@Injectable()
export class TelegramGroupPollerService {
  private readonly logger = new Logger(TelegramGroupPollerService.name);
  private readonly lastMessageIdByChat = new Map<string, number>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private handler: PolledMessageHandler | null = null;
  private client: TelegramClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly groupsService: GroupsService,
  ) {}

  start(client: TelegramClient, handler: PolledMessageHandler): void {
    this.stop();
    this.client = client;
    this.handler = handler;

    const intervalMs = Number(this.config.get('GROUP_POLL_INTERVAL_MS', 3000));

    void this.poll();
    this.pollTimer = setInterval(() => void this.poll(), intervalMs);
    this.logger.log(
      `Guruh polling yoqildi: har ${intervalMs / 1000}s da tekshiriladi`,
    );
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.client = null;
    this.handler = null;
  }

  async initCursors(client: TelegramClient): Promise<void> {
    await this.groupsService.refreshCache();

    for (const chatId of this.groupsService.getCachedGroupIds()) {
      try {
        const msgs = await client.getMessages(chatId, { limit: 1 });
        const lastId = msgs[0]?.id ?? 0;
        this.lastMessageIdByChat.set(chatId, lastId);
        this.logger.log(`Guruh cursor: ${chatId} — oxirgi msg #${lastId}`);
      } catch (error) {
        this.logger.warn(
          `Guruh cursor xatosi (${chatId}): ${(error as Error).message}`,
        );
      }
    }
  }

  resetCursor(chatId: string, messageId?: number): void {
    if (messageId !== undefined) {
      this.lastMessageIdByChat.set(chatId, messageId);
    } else {
      this.lastMessageIdByChat.delete(chatId);
    }
  }

  private async poll(): Promise<void> {
    const client = this.client;
    const handler = this.handler;
    if (!client || !handler || !client.connected || this.polling) return;

    this.polling = true;
    try {
      for (const chatId of this.groupsService.getCachedGroupIds()) {
        if (!this.lastMessageIdByChat.has(chatId)) {
          const msgs = await client.getMessages(chatId, { limit: 1 });
          this.lastMessageIdByChat.set(chatId, msgs[0]?.id ?? 0);
          continue;
        }

        const lastId = this.lastMessageIdByChat.get(chatId) ?? 0;
        const msgs = await client.getMessages(chatId, {
          minId: lastId,
          limit: 50,
        });
        if (!msgs.length) continue;

        const sorted = [...msgs].sort((a, b) => a.id - b.id);
        let maxId = lastId;

        for (const msg of sorted) {
          if (!(msg instanceof Api.Message) || msg.id <= lastId) continue;
          await handler(msg);
          if (msg.id > maxId) maxId = msg.id;
        }

        if (maxId > lastId) {
          this.lastMessageIdByChat.set(chatId, maxId);
        }
      }
    } catch (error) {
      this.logger.error(`Guruh polling xatosi: ${(error as Error).message}`);
    } finally {
      this.polling = false;
    }
  }
}
