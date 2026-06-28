import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

export interface TelegramAccountStatus {
  configured: boolean;
  connected: boolean;
  username: string | null;
  userId: string | null;
}

@Injectable()
export class TelegramBroadcastClientService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TelegramBroadcastClientService.name);
  private client: TelegramClient | null = null;
  private connected = false;
  private username: string | null = null;
  private userId: string | null = null;
  private reconnectTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('TELEGRAM_BROADCAST_SESSION')?.trim(),
    );
  }

  isReady(): boolean {
    return this.connected && this.client !== null;
  }

  getClient(): TelegramClient | null {
    return this.client;
  }

  getStatus(): TelegramAccountStatus {
    return {
      configured: this.isConfigured(),
      connected: this.connected,
      username: this.username,
      userId: this.userId,
    };
  }

  async onModuleInit(): Promise<void> {
    const apiId = Number(this.config.get<string>('TELEGRAM_API_ID'));
    const apiHash = this.config.get<string>('TELEGRAM_API_HASH');
    const sessionString =
      this.config.get<string>('TELEGRAM_BROADCAST_SESSION')?.trim() ?? '';

    if (!sessionString) {
      this.logger.log(
        "TELEGRAM_BROADCAST_SESSION yo'q — DM lar asosiy akkaunt orqali yuboriladi",
      );
      return;
    }

    if (!apiId || !apiHash) {
      this.logger.warn('Broadcast akkaunt uchun TELEGRAM_API_ID/HASH kerak');
      return;
    }

    await this.connect(sessionString);

    if (this.connected && this.client) {
      this.reconnectTimer = setInterval(
        () => void this.ensureConnected(),
        60_000,
      );
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
      await this.client.connect();
      if (!(await this.client.isUserAuthorized())) {
        throw new Error(
          'TELEGRAM_BROADCAST_SESSION yaroqsiz yoki muddati tugagan',
        );
      }

      const me = await this.client.getMe();
      this.username = me.username ?? null;
      this.userId = me.id?.toString() ?? null;
      this.connected = true;

      await this.client.invoke(new Api.updates.GetState());
      this.logger.log(
        `Broadcast akkaunt ulandi: @${this.username ?? this.userId}`,
      );
    } catch (error) {
      this.connected = false;
      this.logger.error(
        `Broadcast akkaunt ulanish xatosi: ${(error as Error).message}`,
      );
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client) return;
    try {
      if (!this.client.connected) {
        this.logger.warn('Broadcast akkaunt uzildi — qayta ulanmoqda...');
        await this.client.connect();
        await this.client.getMe();
        this.connected = true;
        this.logger.log('Broadcast akkaunt qayta ulandi');
      }
    } catch (error) {
      this.connected = false;
      this.logger.error(
        `Broadcast qayta ulanish xatosi: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      await this.client.disconnect();
    }
  }
}
