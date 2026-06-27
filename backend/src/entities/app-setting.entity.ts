import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn()
  key!: string;

  @Column({ type: 'text' })
  value!: string;
}

/** Sozlamalar kalitlari */
export const SettingKeys = {
  EMPLOYER_CHANNEL_ID: 'employer_channel_id',
  SEEKER_CHANNEL_ID: 'seeker_channel_id',
  EMPLOYER_MESSAGE_TEMPLATE: 'employer_message_template',
  SEEKER_MESSAGE_TEMPLATE: 'seeker_message_template',
  BROADCAST_MAX_PER_HOUR: 'broadcast_max_per_hour',
  BROADCAST_DELAY_MS: 'broadcast_delay_ms',
  BROADCAST_JITTER_MS: 'broadcast_delay_jitter_ms',
  BROADCAST_PAUSE_EVERY: 'broadcast_pause_every',
  BROADCAST_PAUSE_MS: 'broadcast_pause_ms',
} as const;

export const DEFAULT_EMPLOYER_MESSAGE = `Assalomu alaykum, {ism}!

Kunlik ish e'loningiz uchun rahmat. Siz bilan bog'lanishimiz mumkin.

Hurmat bilan,
Soatbay jamoasi`;

export const DEFAULT_SEEKER_MESSAGE = `Assalomu alaykum, {ism}!

Kunlik ish qidirayotganingizni ko'rdik. Tez orada siz bilan bog'lanamiz.

Hurmat bilan,
Soatbay jamoasi`;
