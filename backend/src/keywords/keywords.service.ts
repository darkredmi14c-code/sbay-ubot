import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Keyword } from '../entities/keyword.entity';

@Injectable()
export class KeywordsService implements OnModuleInit {
  private readonly logger = new Logger(KeywordsService.name);
  private cache: string[] = [];

  constructor(
    @InjectRepository(Keyword)
    private readonly repo: Repository<Keyword>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshCache();
  }

  async refreshCache(): Promise<void> {
    const rows = await this.repo.find({ where: { active: true } });
    this.cache = rows.map((r) => r.word.toLowerCase());
    this.logger.log(`Kalit so'zlar keshi yangilandi: ${this.cache.length} ta`);
  }

  getCachedKeywords(): string[] {
    return this.cache;
  }

  matches(text: string): boolean {
    if (!text || this.cache.length === 0) {
      return false;
    }
    const lower = text.toLowerCase();
    return this.cache.some((word) => lower.includes(word));
  }

  findAll(): Promise<Keyword[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async create(word: string): Promise<Keyword> {
    const result = await this.createMany([word]);
    return result[0];
  }

  async bulkCreate(words: string[], replace = false): Promise<Keyword[]> {
    if (replace) {
      await this.repo.clear();
    }
    const normalized = [
      ...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean)),
    ];
    return this.createMany(normalized);
  }

  private async createMany(words: string[]): Promise<Keyword[]> {
    if (words.length === 0) {
      await this.refreshCache();
      return [];
    }

    const existing = await this.repo.find({
      where: { word: In(words) },
    });
    const existingMap = new Map(existing.map((k) => [k.word, k]));

    const toSave: Keyword[] = [];
    for (const word of words) {
      const row = existingMap.get(word);
      if (row) {
        row.active = true;
        toSave.push(row);
      } else {
        toSave.push(this.repo.create({ word, active: true }));
      }
    }

    const saved = await this.repo.save(toSave);
    await this.refreshCache();
    this.logger.log(`Kalit so'zlar qo'shildi: ${saved.length} ta`);
    return saved;
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
    await this.refreshCache();
  }

  async removeByWord(word: string): Promise<void> {
    await this.repo.delete({ word: word.trim().toLowerCase() });
    await this.refreshCache();
  }
}
