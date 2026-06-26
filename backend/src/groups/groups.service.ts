import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonitoredGroup } from '../entities/monitored-group.entity';

@Injectable()
export class GroupsService implements OnModuleInit {
  private readonly logger = new Logger(GroupsService.name);
  private cache = new Set<string>();
  private unresolvedCount = 0;

  constructor(
    @InjectRepository(MonitoredGroup)
    private readonly repo: Repository<MonitoredGroup>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshCache();
  }

  async refreshCache(): Promise<void> {
    const rows = await this.repo.find({ where: { active: true } });
    this.cache = new Set(
      rows.map((r) => r.telegramId).filter((id) => /^-?\d+$/.test(id)),
    );
    const pending = rows.filter((r) => !/^-?\d+$/.test(r.telegramId)).length;
    this.unresolvedCount = pending;
    this.logger.log(
      `Guruhlar keshi: ${this.cache.size} ta faol` +
        (pending ? `, ${pending} ta hali ID ga aylanmagan` : ''),
    );
  }

  isMonitored(chatId: string): boolean {
    return this.cache.has(chatId);
  }

  getCachedGroupIds(): string[] {
    return [...this.cache];
  }

  /** Hali @username yoki link ko'rinishida qolgan guruhlar */
  async getUnresolvedGroups(): Promise<MonitoredGroup[]> {
    const rows = await this.repo.find({ where: { active: true } });
    return rows.filter((r) => !/^-?\d+$/.test(r.telegramId));
  }

  getUnresolvedCount(): number {
    return this.unresolvedCount;
  }

  isResolved(telegramId: string): boolean {
    return /^-?\d+$/.test(telegramId);
  }

  findAll(): Promise<MonitoredGroup[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  /** GramJS getEntity uchun: username yoki link */
  toEntityInput(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith('https://t.me/')) {
      return trimmed.replace('https://t.me/', '');
    }
    if (trimmed.startsWith('http://t.me/')) {
      return trimmed.replace('http://t.me/', '');
    }
    if (trimmed.startsWith('t.me/')) {
      return trimmed.replace('t.me/', '');
    }
    if (trimmed.startsWith('@')) {
      return trimmed.slice(1);
    }
    return trimmed;
  }

  normalizeIdentifier(raw: string): {
    telegramId: string;
    link: string | null;
  } {
    const trimmed = raw.trim();
    if (/^-?\d+$/.test(trimmed)) {
      return { telegramId: trimmed, link: null };
    }
    if (trimmed.startsWith('http')) {
      return { telegramId: trimmed, link: trimmed };
    }
    if (trimmed.startsWith('@')) {
      return { telegramId: trimmed, link: `https://t.me/${trimmed.slice(1)}` };
    }
    if (trimmed.startsWith('t.me/')) {
      return {
        telegramId: trimmed,
        link: `https://${trimmed}`,
      };
    }
    return { telegramId: `@${trimmed}`, link: `https://t.me/${trimmed}` };
  }

  async create(identifier: string, title?: string): Promise<MonitoredGroup> {
    const results = await this.bulkCreate([identifier], false);
    return results[0];
  }

  async bulkCreate(
    identifiers: string[],
    replace = false,
  ): Promise<MonitoredGroup[]> {
    if (replace) {
      await this.repo.clear();
    }

    const results: MonitoredGroup[] = [];
    for (const raw of identifiers) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      const { telegramId, link } = this.normalizeIdentifier(trimmed);
      const existing = await this.repo.findOne({ where: { telegramId } });

      if (existing) {
        existing.active = true;
        if (link) existing.link = link;
        results.push(await this.repo.save(existing));
        continue;
      }

      const byLink = link ? await this.repo.findOne({ where: { link } }) : null;
      if (byLink) {
        byLink.active = true;
        results.push(await this.repo.save(byLink));
        continue;
      }

      results.push(
        await this.repo.save(
          this.repo.create({
            telegramId,
            title: null,
            link,
            active: true,
          }),
        ),
      );
    }

    await this.refreshCache();
    this.logger.log(`Guruhlar qo'shildi: ${results.length} ta`);
    return results;
  }

  async updateTelegramId(
    oldId: string,
    newId: string,
    title?: string,
  ): Promise<void> {
    const row = await this.repo.findOne({ where: { telegramId: oldId } });
    if (!row) return;
    row.telegramId = newId;
    if (title) row.title = title;
    await this.repo.save(row);
    await this.refreshCache();
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
    await this.refreshCache();
  }
}
