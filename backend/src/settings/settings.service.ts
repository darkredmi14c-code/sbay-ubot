import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BroadcastSettings } from '../common/broadcast.types';
import {
  AppSetting,
  DEFAULT_EMPLOYER_MESSAGE,
  DEFAULT_SEEKER_MESSAGE,
  SettingKeys,
} from '../entities/app-setting.entity';

export interface AppSettings {
  employerChannelId: string | null;
  seekerChannelId: string | null;
  employerMessageTemplate: string;
  seekerMessageTemplate: string;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
    private readonly config: ConfigService,
  ) {}

  async getSettings(): Promise<AppSettings> {
    const rows = await this.repo.find();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      employerChannelId: map.get(SettingKeys.EMPLOYER_CHANNEL_ID) ?? null,
      seekerChannelId: map.get(SettingKeys.SEEKER_CHANNEL_ID) ?? null,
      employerMessageTemplate:
        map.get(SettingKeys.EMPLOYER_MESSAGE_TEMPLATE) ??
        DEFAULT_EMPLOYER_MESSAGE,
      seekerMessageTemplate:
        map.get(SettingKeys.SEEKER_MESSAGE_TEMPLATE) ?? DEFAULT_SEEKER_MESSAGE,
    };
  }

  async getMessageTemplate(type: 'employer' | 'seeker'): Promise<string> {
    const settings = await this.getSettings();
    return type === 'employer'
      ? settings.employerMessageTemplate
      : settings.seekerMessageTemplate;
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    if (partial.employerChannelId !== undefined) {
      await this.set(
        SettingKeys.EMPLOYER_CHANNEL_ID,
        partial.employerChannelId,
      );
    }
    if (partial.seekerChannelId !== undefined) {
      await this.set(SettingKeys.SEEKER_CHANNEL_ID, partial.seekerChannelId);
    }
    if (partial.employerMessageTemplate !== undefined) {
      await this.set(
        SettingKeys.EMPLOYER_MESSAGE_TEMPLATE,
        partial.employerMessageTemplate,
      );
    }
    if (partial.seekerMessageTemplate !== undefined) {
      await this.set(
        SettingKeys.SEEKER_MESSAGE_TEMPLATE,
        partial.seekerMessageTemplate,
      );
    }
    return this.getSettings();
  }

  async getBroadcastSettings(): Promise<BroadcastSettings> {
    const rows = await this.repo.find();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      maxPerHour: this.parseStoredInt(
        map,
        SettingKeys.BROADCAST_MAX_PER_HOUR,
        'BROADCAST_MAX_PER_HOUR',
        30,
      ),
      delayMs: this.parseStoredInt(
        map,
        SettingKeys.BROADCAST_DELAY_MS,
        'BROADCAST_DELAY_MS',
        4000,
      ),
      jitterMs: this.parseStoredInt(
        map,
        SettingKeys.BROADCAST_JITTER_MS,
        'BROADCAST_DELAY_JITTER_MS',
        3000,
      ),
      pauseEvery: this.parseStoredInt(
        map,
        SettingKeys.BROADCAST_PAUSE_EVERY,
        'BROADCAST_PAUSE_EVERY',
        10,
      ),
      pauseMs: this.parseStoredInt(
        map,
        SettingKeys.BROADCAST_PAUSE_MS,
        'BROADCAST_PAUSE_MS',
        120_000,
      ),
    };
  }

  async updateBroadcastSettings(
    partial: Partial<BroadcastSettings>,
  ): Promise<BroadcastSettings> {
    if (partial.maxPerHour !== undefined) {
      await this.set(
        SettingKeys.BROADCAST_MAX_PER_HOUR,
        String(partial.maxPerHour),
      );
    }
    if (partial.delayMs !== undefined) {
      await this.set(SettingKeys.BROADCAST_DELAY_MS, String(partial.delayMs));
    }
    if (partial.jitterMs !== undefined) {
      await this.set(
        SettingKeys.BROADCAST_JITTER_MS,
        String(partial.jitterMs),
      );
    }
    if (partial.pauseEvery !== undefined) {
      await this.set(
        SettingKeys.BROADCAST_PAUSE_EVERY,
        String(partial.pauseEvery),
      );
    }
    if (partial.pauseMs !== undefined) {
      await this.set(SettingKeys.BROADCAST_PAUSE_MS, String(partial.pauseMs));
    }
    return this.getBroadcastSettings();
  }

  private configInt(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const n = Number(raw);
    if (!raw?.trim() || !Number.isFinite(n) || n < 1) return fallback;
    return Math.floor(n);
  }

  private parseStoredInt(
    map: Map<string, string>,
    settingKey: string,
    envKey: string,
    fallback: number,
  ): number {
    const stored = map.get(settingKey);
    if (stored?.trim()) {
      const n = Number(stored);
      if (Number.isFinite(n) && n >= 1) return Math.floor(n);
    }
    return this.configInt(envKey, fallback);
  }

  private async set(key: string, value: string | null): Promise<void> {
    if (!value?.trim()) {
      await this.repo.delete({ key });
      return;
    }
    await this.repo.save(this.repo.create({ key, value }));
  }
}
