import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Not, Repository } from 'typeorm';
import {
  parseFloodWaitSeconds,
  sleep,
  sleepWithJitter,
} from '../common/telegram-flood.util';
import { renderMessageTemplate } from '../common/message-template.util';
import { IncomingMessagePayload } from '../common/types';
import { User, UserType } from '../entities/user.entity';
import { SettingsService } from '../settings/settings.service';
import { TelegramClientService } from '../telegram/telegram-client.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private broadcastRunning = false;
  private broadcastRunId = 0;
  private hourlySent = { hour: 0, count: 0 };

  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly settingsService: SettingsService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => TelegramClientService))
    private readonly telegramService: TelegramClientService,
  ) {}

  async existsInDatabase(telegramUserId: string): Promise<boolean> {
    return this.repo.exists({ where: { telegramUserId } });
  }

  async isScammer(telegramUserId: string): Promise<boolean> {
    return this.repo.exists({
      where: { telegramUserId, type: 'scammer' },
    });
  }

  async findByTelegramId(telegramUserId: string): Promise<User | null> {
    return this.repo.findOne({ where: { telegramUserId } });
  }

  findAll(type?: UserType, seen?: boolean): Promise<User[]> {
    const where: FindOptionsWhere<User> = {};
    if (type) where.type = type;
    if (seen !== undefined) where.seen = seen;

    return this.repo.find({
      where,
      order: { seen: 'ASC', registeredAt: 'DESC' },
      take: 500,
    });
  }

  countByType(type: UserType): Promise<number> {
    return this.repo.count({ where: { type } });
  }

  countUnseen(type?: UserType): Promise<number> {
    const where: FindOptionsWhere<User> = { seen: false };
    if (type) where.type = type;
    else where.type = Not('scammer' as UserType);
    return this.repo.count({ where });
  }

  countPendingMessages(): Promise<number> {
    return this.repo.count({
      where: [
        { type: 'employer', messageSentAt: IsNull() },
        { type: 'seeker', messageSentAt: IsNull() },
      ],
    });
  }

  isBroadcastRunning(): boolean {
    return this.broadcastRunning;
  }

  getBroadcastStatus() {
    return {
      running: this.broadcastRunning,
      pendingMessages: 0 as number,
    };
  }

  async getBroadcastStatusFull() {
    const pendingMessages = await this.countPendingMessages();
    return {
      running: this.broadcastRunning,
      pendingMessages,
      ...this.getBroadcastLimits(pendingMessages),
    };
  }

  private getBroadcastLimits(pendingCount = 0) {
    const delayMs = Number(this.config.get('BROADCAST_DELAY_MS', 4000));
    const jitterMs = Number(this.config.get('BROADCAST_DELAY_JITTER_MS', 3000));
    const pauseEvery = Number(this.config.get('BROADCAST_PAUSE_EVERY', 10));
    const pauseMs = Number(this.config.get('BROADCAST_PAUSE_MS', 120_000));
    const maxPerHour = Number(this.config.get('BROADCAST_MAX_PER_HOUR', 30));
    const sentThisHour = this.getSentThisHour();
    const remainingHour = Math.max(0, maxPerHour - sentThisHour);
    const perMessageSec = (delayMs + jitterMs / 2) / 1000;
    const pausesCount =
      pendingCount > 0 ? Math.floor((pendingCount - 1) / pauseEvery) : 0;
    const hoursNeeded =
      pendingCount > 0 ? Math.ceil(pendingCount / maxPerHour) : 0;

    return {
      delayMs,
      jitterMs,
      pauseEvery,
      pauseMs,
      maxPerHour,
      sentThisHour,
      remainingHour,
      estimatedTotalSeconds: Math.ceil(
        pendingCount * perMessageSec +
          pausesCount * (pauseMs / 1000) +
          Math.max(0, hoursNeeded - 1) * 3600,
      ),
    };
  }

  private msUntilNextHour(): number {
    const now = Date.now();
    const nextHour = (Math.floor(now / 3_600_000) + 1) * 3_600_000;
    return nextHour - now + 1000;
  }

  private isRunCancelled(runId: number): boolean {
    return runId !== this.broadcastRunId;
  }

  private getSentThisHour(): number {
    const hour = Math.floor(Date.now() / 3_600_000);
    if (this.hourlySent.hour !== hour) {
      this.hourlySent = { hour, count: 0 };
    }
    return this.hourlySent.count;
  }

  private recordHourlySend(): void {
    const hour = Math.floor(Date.now() / 3_600_000);
    if (this.hourlySent.hour !== hour) {
      this.hourlySent = { hour, count: 1 };
    } else {
      this.hourlySent.count++;
    }
  }

  async broadcastPendingMessages(): Promise<{
    started: boolean;
    pending: number;
    message: string;
    restarted: boolean;
  }> {
    const users = await this.repo.find({
      where: [
        { type: 'employer', messageSentAt: IsNull() },
        { type: 'seeker', messageSentAt: IsNull() },
      ],
      order: { registeredAt: 'ASC' },
    });

    if (!users.length) {
      return {
        started: false,
        pending: 0,
        restarted: false,
        message: 'Barchaga allaqachon xabar yuborilgan',
      };
    }

    const restarted = this.broadcastRunning;
    const runId = ++this.broadcastRunId;
    this.broadcastRunning = true;

    void this.runFullBroadcast(runId).finally(() => {
      if (this.broadcastRunId === runId) {
        this.broadcastRunning = false;
      }
    });

    const limits = this.getBroadcastLimits(users.length);
    const mins = Math.max(1, Math.ceil(limits.estimatedTotalSeconds / 60));

    return {
      started: true,
      pending: users.length,
      restarted,
      message: restarted
        ? `Qayta boshlandi: ${users.length} ta yuboriladi (~${mins} daqiqa, dastur o'zi davom ettiradi).`
        : `${users.length} ta yuborilmoqda (~${mins} daqiqa, tugatguncha avtomatik davom etadi).`,
    };
  }

  private async runFullBroadcast(runId: number): Promise<void> {
    let sent = 0;
    let failed = 0;
    let sentInSession = 0;

    while (!this.isRunCancelled(runId)) {
      const limits = this.getBroadcastLimits();

      if (limits.remainingHour <= 0) {
        const waitMs = this.msUntilNextHour();
        this.logger.warn(
          `Soatlik limit (${limits.maxPerHour}) — ${Math.ceil(waitMs / 60000)} daqiqa kutiladi`,
        );
        await sleep(waitMs);
        if (this.isRunCancelled(runId)) return;
        continue;
      }

      const user = await this.repo.findOne({
        where: [
          { type: 'employer', messageSentAt: IsNull() },
          { type: 'seeker', messageSentAt: IsNull() },
        ],
        order: { registeredAt: 'ASC' },
      });

      if (!user) break;
      if (user.type !== 'employer' && user.type !== 'seeker') continue;

      if (sentInSession > 0 && sentInSession % limits.pauseEvery === 0) {
        this.logger.log(
          `Broadcast pauza: ${limits.pauseMs / 1000}s (Telegram spam himoyasi)`,
        );
        await sleep(limits.pauseMs);
        if (this.isRunCancelled(runId)) return;
      }

      try {
        const template = await this.settingsService.getMessageTemplate(
          user.type,
        );
        const text = renderMessageTemplate(template, user);
        await this.sendWithFloodRetry(user.telegramUserId, text);

        user.messageSentAt = new Date();
        user.seen = true;
        if (!user.seenAt) user.seenAt = new Date();
        await this.repo.save(user);
        this.recordHourlySend();
        sent++;
        sentInSession++;
      } catch (error) {
        failed++;
        const floodSec = parseFloodWaitSeconds(error);
        if (floodSec) {
          this.logger.warn(`Telegram flood — ${floodSec}s kutiladi`);
          await sleep((floodSec + 5) * 1000);
        } else {
          this.logger.warn(
            `Broadcast xatosi (${user.telegramUserId}): ${(error as Error).message}`,
          );
        }
        if (this.isRunCancelled(runId)) return;
      }

      await sleepWithJitter(limits.delayMs, limits.jitterMs);
    }

    if (!this.isRunCancelled(runId)) {
      this.logger.log(`Broadcast tugadi: ${sent} yuborildi, ${failed} xato`);
    } else {
      this.logger.log(`Broadcast to'xtatildi (qayta boshlandi)`);
    }
  }

  private async sendWithFloodRetry(
    telegramUserId: string,
    text: string,
  ): Promise<void> {
    try {
      await this.telegramService.sendDirectMessage(telegramUserId, text);
    } catch (error) {
      const floodSec = parseFloodWaitSeconds(error);
      if (!floodSec) throw error;
      this.logger.warn(
        `Flood wait ${floodSec}s — qayta urinilmoqda (${telegramUserId})`,
      );
      await sleep((floodSec + 3) * 1000);
      await this.telegramService.sendDirectMessage(telegramUserId, text);
    }
  }

  async saveFromMessage(
    payload: IncomingMessagePayload,
    type: 'employer' | 'seeker',
  ): Promise<User> {
    const existing = await this.findByTelegramId(payload.senderId);
    if (existing) return existing;

    return this.repo.save(
      this.repo.create({
        telegramUserId: payload.senderId,
        type,
        username: payload.senderUsername,
        firstName: payload.senderFirstName,
        lastName: payload.senderLastName,
        phone: payload.senderPhone,
        sourceGroupId: payload.chatId,
        sourceGroupTitle: payload.chatTitle,
        sourceMessageId: String(payload.messageId),
        messageLink: payload.messageLink,
        originalText: payload.text,
        seen: false,
      }),
    );
  }

  async blockAsScammer(
    telegramUserId: string,
    meta?: Partial<Pick<User, 'username' | 'firstName' | 'lastName' | 'phone'>>,
  ): Promise<User> {
    const existing = await this.findByTelegramId(telegramUserId);
    if (existing) {
      existing.type = 'scammer';
      if (meta?.username !== undefined) existing.username = meta.username;
      if (meta?.firstName !== undefined) existing.firstName = meta.firstName;
      if (meta?.lastName !== undefined) existing.lastName = meta.lastName;
      if (meta?.phone !== undefined) existing.phone = meta.phone;
      return this.repo.save(existing);
    }

    return this.repo.save(
      this.repo.create({
        telegramUserId,
        type: 'scammer',
        username: meta?.username ?? null,
        firstName: meta?.firstName ?? null,
        lastName: meta?.lastName ?? null,
        phone: meta?.phone ?? null,
        seen: true,
        seenAt: new Date(),
      }),
    );
  }

  async updateType(id: number, type: UserType): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    user.type = type;
    return this.repo.save(user);
  }

  async markSeen(id: number): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    user.seen = true;
    user.seenAt = new Date();
    return this.repo.save(user);
  }

  async markAllSeen(type?: UserType): Promise<{ updated: number }> {
    const qb = this.repo
      .createQueryBuilder()
      .update(User)
      .set({ seen: true, seenAt: new Date() })
      .where('seen = :seen', { seen: false });

    if (type) {
      qb.andWhere('type = :type', { type });
    } else {
      qb.andWhere('type != :scammer', { scammer: 'scammer' });
    }

    const result = await qb.execute();
    return { updated: result.affected ?? 0 };
  }

  async sendMessage(id: number): Promise<{ sent: string; user: User }> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    if (user.type === 'scammer') {
      throw new BadRequestException("Spamchiga xabar yuborib bo'lmaydi");
    }

    const template = await this.settingsService.getMessageTemplate(user.type);
    const text = renderMessageTemplate(template, user);

    await this.sendWithFloodRetry(user.telegramUserId, text);

    user.messageSentAt = new Date();
    user.seen = true;
    if (!user.seenAt) user.seenAt = new Date();
    const saved = await this.repo.save(user);

    return { sent: text, user: saved };
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
