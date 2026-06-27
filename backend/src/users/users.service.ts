import {
  BadRequestException,
  Inject,
  Injectable,
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

@Injectable()
export class UsersService {
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

    const template = await this.settingsService.getMessageTemplate(
      user.type as 'employer' | 'seeker',
    );
    const text = renderMessageTemplate(template, user);

    await this.sendWithFloodRetry(user.telegramUserId, text);

    user.messageSentAt = new Date();
    user.seen = true;
    if (!user.seenAt) user.seenAt = new Date();
    const saved = await this.repo.save(user);

    return { sent: text, user: saved };
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
      await sleep((floodSec + 3) * 1000);
      await this.telegramService.sendDirectMessage(telegramUserId, text);
    }
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
