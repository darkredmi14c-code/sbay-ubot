export type UserType = 'employer' | 'seeker' | 'scammer';

export interface Keyword {
  id: number;
  word: string;
  active: boolean;
  createdAt: string;
}

export interface MonitoredGroup {
  id: number;
  telegramId: string;
  title: string | null;
  link: string | null;
  active: boolean;
  createdAt: string;
}

export interface AppSettings {
  employerChannelId: string | null;
  seekerChannelId: string | null;
  employerMessageTemplate: string;
  seekerMessageTemplate: string;
}

export interface TelegramStatus {
  connected: boolean;
  username: string | null;
  userId: string | null;
  monitoredGroupsCount: number;
  unresolvedGroupsCount: number;
  keywordsCount: number;
  queuePending: number;
  queueSize: number;
  processedTotal: number;
  skippedTotal: number;
  publishedTotal: number;
  messagesReceived: number;
  lastError: string | null;
}

export interface Stats {
  employers: number;
  seekers: number;
  scammers: number;
  unseen: number;
  keywords: number;
  groups: number;
  telegram: TelegramStatus;
}

export interface UserRecord {
  id: number;
  telegramUserId: string;
  type: UserType;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  sourceGroupId: string | null;
  sourceGroupTitle: string | null;
  sourceMessageId: string | null;
  messageLink: string | null;
  originalText: string | null;
  seen: boolean;
  seenAt: string | null;
  messageSentAt: string | null;
  registeredAt: string;
}

export const USER_TYPE_LABELS: Record<UserType, string> = {
  employer: 'E\'lon beruvchi',
  seeker: 'Ishchi',
  scammer: 'Spamchi',
};
