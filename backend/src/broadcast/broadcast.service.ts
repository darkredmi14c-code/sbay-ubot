import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BroadcastPhase,
  BroadcastProgress,
  BroadcastSettings,
  BroadcastStatusResponse,
} from '../common/broadcast.types';
import { renderMessageTemplate } from '../common/message-template.util';
import {
  isPermanentSendError,
  parseFloodWaitSeconds,
  sleep,
} from '../common/telegram-flood.util';
import { User } from '../entities/user.entity';
import { SettingsService } from '../settings/settings.service';
import { TelegramDirectMessageService } from '../telegram/telegram-direct-message.service';
import { TelegramBroadcastClientService } from '../telegram/telegram-broadcast-client.service';
import { toDirectMessageRecipient } from '../telegram/telegram-entity.util';

interface BroadcastSession {
  runId: number;
  userIds: number[];
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  lastError: string | null;
  phase: BroadcastPhase;
  currentUserId: number | null;
  currentUserLabel: string | null;
  waitUntil: number | null;
  startedAt: Date;
  sentInSession: number;
}

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);
  private runId = 0;
  private session: BroadcastSession | null = null;
  private hourlySent = { hour: 0, count: 0 };

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly settingsService: SettingsService,
    @Inject(forwardRef(() => TelegramDirectMessageService))
    private readonly directMessageService: TelegramDirectMessageService,
    private readonly broadcastClientService: TelegramBroadcastClientService,
  ) {}

  async getStatus(): Promise<BroadcastStatusResponse> {
    const [settings, pendingRecipients] = await Promise.all([
      this.settingsService.getBroadcastSettings(),
      this.countPendingRecipients(),
    ]);
    const sentThisHour = this.getSentThisHour();
    const remainingThisHour = Math.max(0, settings.maxPerHour - sentThisHour);
    const progress = this.buildProgress();

    const senderAccount = this.directMessageService.getSenderAccount();

    return {
      telegramConnected: this.directMessageService.isSendReady(),
      senderAccount,
      broadcastAccountConfigured: this.broadcastClientService.isConfigured(),
      pendingRecipients,
      settings,
      sentThisHour,
      remainingThisHour,
      active: this.isActivePhase(progress?.phase ?? 'idle'),
      progress,
    };
  }

  async updateSettings(
    partial: Partial<BroadcastSettings>,
  ): Promise<BroadcastSettings> {
    return this.settingsService.updateBroadcastSettings(partial);
  }

  async start(): Promise<{
    started: boolean;
    pending: number;
    restarted: boolean;
    message: string;
  }> {
    if (!this.directMessageService.isSendReady()) {
      throw new BadRequestException(
        'Xabar yuborish uchun Telegram ulanmagan — broadcast yoki asosiy akkauntni tekshiring',
      );
    }

    const userIds = await this.findPendingUserIds();
    if (!userIds.length) {
      return {
        started: false,
        pending: 0,
        restarted: false,
        message: 'Barchaga allaqachon xabar yuborilgan',
      };
    }

    const restarted = this.session !== null && this.isActivePhase(this.session.phase);
    const runId = ++this.runId;
    this.session = {
      runId,
      userIds,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      lastError: null,
      phase: 'running',
      currentUserId: null,
      currentUserLabel: null,
      waitUntil: null,
      startedAt: new Date(),
      sentInSession: 0,
    };

    void this.runLoop(runId).finally(() => {
      if (this.session?.runId === runId && this.isActivePhase(this.session.phase)) {
        this.session.phase = 'completed';
      }
    });

    const settings = await this.settingsService.getBroadcastSettings();
    const mins = Math.max(
      1,
      Math.ceil(this.estimateSeconds(userIds.length, settings) / 60),
    );
    return {
      started: true,
      pending: userIds.length,
      restarted,
      message: restarted
        ? `Qayta boshlandi: ${userIds.length} ta yuboriladi (~${mins} daqiqa).`
        : `${userIds.length} ta yuborilmoqda (~${mins} daqiqa). Pauza yoki bekor qilish mumkin.`,
    };
  }

  pause(): { ok: boolean; message: string } {
    if (!this.session || !this.isPausablePhase(this.session.phase)) {
      return { ok: false, message: 'Pauza qilish uchun faol jarayon yo\'q' };
    }
    this.session.phase = 'paused';
    this.session.waitUntil = null;
    return { ok: true, message: 'Pauza qilindi' };
  }

  resume(): { ok: boolean; message: string } {
    if (!this.session || this.session.phase !== 'paused') {
      return { ok: false, message: 'Davom ettirish uchun pauza yo\'q' };
    }
    this.session.phase = 'running';
    return { ok: true, message: 'Davom etilmoqda' };
  }

  cancel(): { ok: boolean; message: string } {
    if (!this.session || !this.isActivePhase(this.session.phase)) {
      return { ok: false, message: 'Bekor qilish uchun faol jarayon yo\'q' };
    }
    this.runId++;
    this.session.phase = 'cancelled';
    this.session.waitUntil = null;
    this.session.currentUserId = null;
    this.session.currentUserLabel = null;
    return { ok: true, message: 'Bekor qilindi' };
  }

  private async runLoop(runId: number): Promise<void> {
    const session = this.session;
    if (!session || session.runId !== runId) return;

    for (const userId of session.userIds) {
      if (this.isRunCancelled(runId)) return;

      const settings = await this.settingsService.getBroadcastSettings();
      await this.waitForHourlyQuota(runId, settings.maxPerHour);
      if (this.isRunCancelled(runId)) return;

      if (!this.directMessageService.isSendReady()) {
        session.lastError = 'Telegram uzildi';
        session.phase = 'cancelled';
        this.logger.error('Broadcast to\'xtatildi: Telegram ulanmagan');
        return;
      }

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user || user.messageSentAt) {
        session.processed++;
        continue;
      }
      if (user.type !== 'employer' && user.type !== 'seeker') {
        session.skipped++;
        session.processed++;
        continue;
      }

      if (
        session.sentInSession > 0 &&
        session.sentInSession % settings.pauseEvery === 0
      ) {
        session.phase = 'cooldown';
        this.logger.log(
          `Broadcast tanaffus: ${settings.pauseMs / 1000}s (spam himoyasi)`,
        );
        const ok = await this.interruptibleWait(runId, settings.pauseMs);
        if (!ok) return;
      }

      if (this.isRunCancelled(runId)) return;
      session.phase = 'running';
      session.currentUserId = user.id;
      session.currentUserLabel = this.userLabel(user);

      try {
        const template = await this.settingsService.getMessageTemplate(user.type);
        if (!template?.trim()) {
          throw new Error(`${user.type} xabar shabloni bo'sh`);
        }

        const text = renderMessageTemplate(template, user);
        await this.sendWithFloodRetry(runId, user, text);

        user.messageSentAt = new Date();
        user.seen = true;
        if (!user.seenAt) user.seenAt = new Date();
        await this.userRepo.save(user);

        this.recordHourlySend();
        session.sent++;
        session.sentInSession++;
        session.lastError = null;

        this.logger.log(
          `Broadcast yuborildi (${session.sent}/${session.userIds.length}): ${user.telegramUserId}`,
        );
      } catch (error) {
        const errMsg = (error as Error).message;
        session.failed++;
        session.lastError = errMsg;

        if (isPermanentSendError(error)) {
          session.skipped++;
          this.logger.warn(
            `Broadcast o'tkazildi (${user.telegramUserId}): ${errMsg}`,
          );
        } else if (parseFloodWaitSeconds(error)) {
          const floodSec = parseFloodWaitSeconds(error)!;
          session.phase = 'cooldown';
          this.logger.warn(`Telegram flood — ${floodSec}s kutiladi`);
          const ok = await this.interruptibleWait(runId, (floodSec + 5) * 1000);
          if (!ok) return;
          session.phase = 'running';
        } else {
          this.logger.warn(
            `Broadcast xatosi (${user.telegramUserId}): ${errMsg}`,
          );
        }

        if (this.isRunCancelled(runId)) return;
      } finally {
        session.processed++;
        session.currentUserId = null;
        session.currentUserLabel = null;
      }

      if (this.isRunCancelled(runId)) return;
      await this.interruptibleDelay(runId, settings.delayMs, settings.jitterMs);
    }

    if (!this.isRunCancelled(runId)) {
      session.phase = 'completed';
      this.logger.log(
        `Broadcast tugadi: ${session.sent} yuborildi, ${session.failed} xato, ${session.skipped} o'tkazildi`,
      );
    }
  }

  private async waitForHourlyQuota(
    runId: number,
    maxPerHour: number,
  ): Promise<void> {
    const session = this.session;
    if (!session) return;

    while (this.getRemainingThisHour(maxPerHour) <= 0) {
      if (this.isRunCancelled(runId)) return;

      session.phase = 'waiting_limit';
      session.waitUntil = Date.now() + this.msUntilNextHour();
      this.logger.warn(
        `Soatlik limit (${maxPerHour}) — keyingi soatgacha kutish`,
      );

      await this.waitWhilePaused(runId);
      if (this.isRunCancelled(runId)) return;

      await sleep(500);

      if (this.getRemainingThisHour(maxPerHour) > 0) {
        session.phase = 'running';
        session.waitUntil = null;
        return;
      }
    }

    if (session.phase === 'waiting_limit') {
      session.phase = 'running';
      session.waitUntil = null;
    }
  }

  private async interruptibleWait(runId: number, ms: number): Promise<boolean> {
    const session = this.session;
    if (!session) return false;

    let remaining = ms;
    session.waitUntil = Date.now() + remaining;

    while (remaining > 0) {
      if (this.isRunCancelled(runId)) {
        session.waitUntil = null;
        return false;
      }

      await this.waitWhilePaused(runId);
      if (this.isRunCancelled(runId)) {
        session.waitUntil = null;
        return false;
      }

      const step = Math.min(500, remaining);
      await sleep(step);
      remaining -= step;
      session.waitUntil = Date.now() + remaining;
    }

    session.waitUntil = null;
    return true;
  }

  private async interruptibleDelay(
    runId: number,
    baseMs: number,
    jitterMs: number,
  ): Promise<void> {
    const extra = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
    await this.interruptibleWait(runId, baseMs + extra);
  }

  private async waitWhilePaused(runId: number): Promise<void> {
    while (this.session?.phase === 'paused') {
      if (this.isRunCancelled(runId)) return;
      this.session.waitUntil = null;
      await sleep(500);
    }
  }

  private async sendWithFloodRetry(
    runId: number,
    user: User,
    text: string,
  ): Promise<void> {
    const recipient = toDirectMessageRecipient(user);
    try {
      await this.directMessageService.sendDirectMessage(recipient, text);
    } catch (error) {
      const floodSec = parseFloodWaitSeconds(error);
      if (!floodSec) throw error;
      this.logger.warn(
        `Flood wait ${floodSec}s — qayta urinilmoqda (${user.telegramUserId})`,
      );
      const ok = await this.interruptibleWait(runId, (floodSec + 3) * 1000);
      if (!ok) throw new Error('Bekor qilindi');
      await this.directMessageService.sendDirectMessage(recipient, text);
    }
  }

  private buildProgress(): BroadcastProgress | null {
    const session = this.session;
    if (!session) return null;

    const pendingQueue = Math.max(0, session.userIds.length - session.processed);

    return {
      runId: session.runId,
      phase: session.phase,
      total: session.userIds.length,
      processed: session.processed,
      sent: session.sent,
      failed: session.failed,
      skipped: session.skipped,
      pendingQueue,
      lastError: session.lastError,
      currentUserId: session.currentUserId,
      currentUserLabel: session.currentUserLabel,
      waitUntil: session.waitUntil
        ? new Date(session.waitUntil).toISOString()
        : null,
      startedAt: session.startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private countPendingRecipients(): Promise<number> {
    return this.userRepo
      .createQueryBuilder('u')
      .where('u.messageSentAt IS NULL')
      .andWhere('u.type IN (:...types)', { types: ['employer', 'seeker'] })
      .getCount();
  }

  private async findPendingUserIds(): Promise<number[]> {
    const users = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id'])
      .where('u.messageSentAt IS NULL')
      .andWhere('u.type IN (:...types)', { types: ['employer', 'seeker'] })
      .orderBy('u.registeredAt', 'ASC')
      .getMany();
    return users.map((u) => u.id);
  }

  private estimateSeconds(
    pendingCount: number,
    settings: BroadcastSettings,
  ): number {
    const perMessageSec = (settings.delayMs + settings.jitterMs / 2) / 1000;
    const pausesCount =
      pendingCount > 0 ? Math.floor((pendingCount - 1) / settings.pauseEvery) : 0;
    const hoursNeeded =
      pendingCount > 0 ? Math.ceil(pendingCount / settings.maxPerHour) : 0;

    return Math.ceil(
      pendingCount * perMessageSec +
        pausesCount * (settings.pauseMs / 1000) +
        Math.max(0, hoursNeeded - 1) * 3600,
    );
  }

  private userLabel(user: User): string {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.username || user.telegramUserId;
  }

  private isRunCancelled(runId: number): boolean {
    return runId !== this.runId;
  }

  private isActivePhase(phase: BroadcastPhase): boolean {
    return (
      phase === 'running' ||
      phase === 'paused' ||
      phase === 'waiting_limit' ||
      phase === 'cooldown'
    );
  }

  private isPausablePhase(phase: BroadcastPhase): boolean {
    return (
      phase === 'running' ||
      phase === 'waiting_limit' ||
      phase === 'cooldown'
    );
  }

  private msUntilNextHour(): number {
    const now = Date.now();
    const nextHour = (Math.floor(now / 3_600_000) + 1) * 3_600_000;
    return nextHour - now + 1000;
  }

  private getSentThisHour(): number {
    const hour = Math.floor(Date.now() / 3_600_000);
    if (this.hourlySent.hour !== hour) {
      this.hourlySent = { hour, count: 0 };
    }
    return this.hourlySent.count;
  }

  private getRemainingThisHour(maxPerHour: number): number {
    return Math.max(0, maxPerHour - this.getSentThisHour());
  }

  private recordHourlySend(): void {
    const hour = Math.floor(Date.now() / 3_600_000);
    if (this.hourlySent.hour !== hour) {
      this.hourlySent = { hour, count: 1 };
    } else {
      this.hourlySent.count++;
    }
  }
}
