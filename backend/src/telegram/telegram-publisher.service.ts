import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { IncomingMessagePayload } from '../common/types';
import { TelegramClientService } from './telegram-client.service';

@Injectable()
export class TelegramPublisherService {
  private readonly logger = new Logger(TelegramPublisherService.name);

  constructor(
    @Inject(forwardRef(() => TelegramClientService))
    private readonly clientService: TelegramClientService,
  ) {}

  async publish(
    payload: IncomingMessagePayload,
    channelId: string,
    type: 'employer' | 'seeker',
  ): Promise<void> {
    const client = this.clientService.getClient();
    if (!client) {
      throw new Error('Telegram ulanmagan');
    }

    const profileText = this.buildProfileText(payload, type);
    let channelMessageId: number | null = null;

    if (payload.canForward) {
      try {
        const forwarded = await client.forwardMessages(channelId, {
          messages: [payload.messageId],
          fromPeer: payload.chatId,
        });
        const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        channelMessageId = first?.id ?? null;
      } catch (error) {
        this.logger.warn(
          `Forward amalga oshmadi, matn rejimiga o'tilmoqda: ${(error as Error).message}`,
        );
      }
    }

    const extraInfo = this.buildExtraInfo(payload);
    const fullText = `${profileText}\n\n${extraInfo}`;

    if (channelMessageId) {
      await client.sendMessage(channelId, {
        message: fullText,
        replyTo: channelMessageId,
      });
    } else {
      await client.sendMessage(channelId, { message: fullText });
    }
  }

  private buildProfileText(
    payload: IncomingMessagePayload,
    type: 'employer' | 'seeker',
  ): string {
    const typeLabel =
      type === 'employer' ? "📢 E'lon beruvchi" : '👷 Ishchi qidiruvchi';
    const fullName = [payload.senderFirstName, payload.senderLastName]
      .filter(Boolean)
      .join(' ');

    const lines = [
      typeLabel,
      '━━━━━━━━━━━━━━━━',
      `👤 Ism: ${fullName || '—'}`,
      `🆔 ID: ${payload.senderId}`,
      `📱 Username: ${payload.senderUsername ? '@' + payload.senderUsername : '—'}`,
      `☎️ Telefon: ${payload.senderPhone ?? '—'}`,
      `💬 Guruh: ${payload.chatTitle}`,
    ];

    return lines.join('\n');
  }

  private buildExtraInfo(payload: IncomingMessagePayload): string {
    if (payload.messageLink) {
      return `🔗 Xabar havolasi:\n${payload.messageLink}`;
    }
    return `📝 Asl xabar:\n${payload.text.slice(0, 3500)}`;
  }
}
