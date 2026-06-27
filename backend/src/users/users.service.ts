import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, Repository } from 'typeorm';
import {
  parseFloodWaitSeconds,
  sleep,
} from '../common/telegram-flood.util';
import { renderMessageTemplate } from '../common/message-template.util';
import { IncomingMessagePayload } from '../common/types';
import { User, UserType } from '../entities/user.entity';
import { SettingsService } from '../settings/settings.service';
import { TelegramClientService } from '../telegram/telegram-client.service';
import { toDirectMessageRecipient } from '../telegram/telegram-entity.util';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly settingsService: SettingsService,
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
    return this.repo
      .createQueryBuilder('u')
      .where('u.messageSentAt IS NULL')
      .andWhere('u.type IN (:...types)', { types: ['employer', 'seeker'] })
      .getCount();
  }

  async syncExistingSender(payload: IncomingMessagePayload): Promise<boolean> {
    const user = await this.findByTelegramId(payload.senderId);
    if (!user) return false;

    const hadHash = Boolean(user.telegramAccessHash);
    const updated = await this.mergeSenderMeta(user, payload);
    if (updated.telegramAccessHash && !hadHash) {
      this.logger.log(
        `Access hash saqlandi: ${payload.senderId} (@${payload.senderUsername ?? '—'})`,
      );
    }

    return true;
  }

  async saveFromMessage(
    payload: IncomingMessagePayload,
    type: 'employer' | 'seeker',
  ): Promise<User> {
    const existing = await this.findByTelegramId(payload.senderId);
    if (existing) {
      return this.mergeSenderMeta(existing, payload);
    }

    return this.repo.save(
      this.repo.create({
        telegramUserId: payload.senderId,
        type,
        username: payload.senderUsername,
        firstName: payload.senderFirstName,
        lastName: payload.senderLastName,
        phone: payload.senderPhone,
        telegramAccessHash: payload.senderAccessHash,
        sourceGroupId: payload.chatId,
        sourceGroupTitle: payload.chatTitle,
        sourceMessageId: String(payload.messageId),
        messageLink: payload.messageLink,
        originalText: payload.text,
        seen: false,
      }),
    );
  }

  private async mergeSenderMeta(
    user: User,
    payload: IncomingMessagePayload,
  ): Promise<User> {
    let changed = false;

    if (payload.senderUsername && user.username !== payload.senderUsername) {
      user.username = payload.senderUsername;
      changed = true;
    }
    if (payload.senderFirstName && user.firstName !== payload.senderFirstName) {
      user.firstName = payload.senderFirstName;
      changed = true;
    }
    if (payload.senderLastName && user.lastName !== payload.senderLastName) {
      user.lastName = payload.senderLastName;
      changed = true;
    }
    if (payload.senderPhone && user.phone !== payload.senderPhone) {
      user.phone = payload.senderPhone;
      changed = true;
    }
    if (payload.senderAccessHash && !user.telegramAccessHash) {
      user.telegramAccessHash = payload.senderAccessHash;
      changed = true;
    }

    // Hash hali yo'q — har yangi xabarda manba guruh/xabarni yangilab turamiz
    if (!user.telegramAccessHash) {
      if (payload.chatId) {
        user.sourceGroupId = payload.chatId;
        changed = true;
      }
      if (payload.chatTitle) {
        user.sourceGroupTitle = payload.chatTitle;
        changed = true;
      }
      if (payload.messageId) {
        user.sourceMessageId = String(payload.messageId);
        changed = true;
      }
    } else if (!user.sourceGroupId && payload.chatId) {
      user.sourceGroupId = payload.chatId;
      user.sourceGroupTitle = payload.chatTitle;
      user.sourceMessageId = String(payload.messageId);
      changed = true;
    }

    if (changed) return this.repo.save(user);
    return user;
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

    const template = await this.settingsService.getMessageTemplate(
      user.type as 'employer' | 'seeker',
    );
    if (!template?.trim()) {
      throw new BadRequestException(
        `${user.type === 'employer' ? 'Employer' : 'Seeker'} xabar shabloni bo'sh`,
      );
    }

    const text = renderMessageTemplate(template, user);

    try {
      await this.sendWithFloodRetry(user, text);
    } catch (error) {
      throw new BadRequestException(this.formatSendError(error));
    }

    user.messageSentAt = new Date();
    user.seen = true;
    if (!user.seenAt) user.seenAt = new Date();
    const saved = await this.repo.save(user);

    return { sent: text, user: saved };
  }

  private formatSendError(error: unknown): string {
    const msg = (error as Error)?.message ?? String(error);
    if (msg.includes('Telegram ulanmagan')) {
      return 'Telegram ulanmagan — userbot holatini tekshiring';
    }
    return msg;
  }

  private async sendWithFloodRetry(user: User, text: string): Promise<void> {
    const recipient = toDirectMessageRecipient(user);
    try {
      await this.telegramService.sendDirectMessage(recipient, text);
    } catch (error) {
      const floodSec = parseFloodWaitSeconds(error);
      if (!floodSec) throw error;
      await sleep((floodSec + 3) * 1000);
      await this.telegramService.sendDirectMessage(recipient, text);
    }
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
