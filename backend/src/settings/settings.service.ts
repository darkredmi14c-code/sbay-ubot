import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  private async set(key: string, value: string | null): Promise<void> {
    if (!value?.trim()) {
      await this.repo.delete({ key });
      return;
    }
    await this.repo.save(this.repo.create({ key, value }));
  }
}
