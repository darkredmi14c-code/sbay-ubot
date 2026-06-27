import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { IncomingMessagePayload } from '../common/types';
import { MessageQueueService } from '../queue/message-queue.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramPublisherService } from '../telegram/telegram-publisher.service';
import { UsersService } from '../users/users.service';
import { KeywordsService } from '../keywords/keywords.service';

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);
  private lastError: string | null = null;

  constructor(
    private readonly keywordsService: KeywordsService,
    private readonly usersService: UsersService,
    private readonly aiService: AiService,
    private readonly queueService: MessageQueueService,
    @Inject(forwardRef(() => TelegramPublisherService))
    private readonly publisher: TelegramPublisherService,
    private readonly settingsService: SettingsService,
  ) {}

  getLastError(): string | null {
    return this.lastError;
  }

  /** Telegram dan kelgan xabarni qabul qiladi — bloklamaydi */
  handleIncoming(payload: IncomingMessagePayload): void {
    this.queueService.enqueueFilter(async () => {
      await this.runFilterStage(payload);
    });
  }

  private async runFilterStage(payload: IncomingMessagePayload): Promise<void> {
    if (payload.isBot) {
      this.queueService.incrementSkipped();
      return;
    }

    if (!payload.text || !this.keywordsService.matches(payload.text)) {
      this.queueService.incrementSkipped();
      return;
    }

    this.logger.log(
      `Kalit so'z topildi — AI navbatiga qo'shildi (${payload.chatTitle})`,
    );

    const alreadyKnown = await this.usersService.syncExistingSender(payload);
    if (alreadyKnown) {
      this.queueService.incrementSkipped();
      return;
    }

    this.queueService.enqueueAi(async () => {
      await this.runAiStage(payload);
    });
  }

  private async runAiStage(payload: IncomingMessagePayload): Promise<void> {
    try {
      const analysis = await this.aiService.analyzeMessage(payload.text);

      if (!analysis.isDailyWork) {
        this.queueService.incrementSkipped();
        return;
      }

      const settings = await this.settingsService.getSettings();
      const channelId =
        analysis.type === 'employer'
          ? settings.employerChannelId
          : settings.seekerChannelId;

      if (!channelId) {
        this.lastError = `${analysis.type} kanali sozlanmagan`;
        this.logger.warn(this.lastError);
        return;
      }

      if (analysis.type === 'employer') {
        await this.usersService.saveFromMessage(payload, 'employer');
      } else {
        await this.usersService.saveFromMessage(payload, 'seeker');
      }

      await this.publisher.publish(payload, channelId, analysis.type);
      this.queueService.incrementPublished();
      this.lastError = null;

      this.logger.log(
        `Nashr qilindi: ${analysis.type} — user ${payload.senderId}`,
      );
    } catch (error) {
      this.lastError = (error as Error).message;
      this.logger.error(`AI bosqichi xatosi: ${this.lastError}`);
    }
  }
}
