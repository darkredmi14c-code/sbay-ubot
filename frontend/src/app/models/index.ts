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
  sessionConfigured: boolean;
  connectionError: string | null;
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

export type BroadcastPhase =
  | 'idle'
  | 'running'
  | 'paused'
  | 'waiting_limit'
  | 'cooldown'
  | 'completed'
  | 'cancelled';

export interface BroadcastSettings {
  maxPerHour: number;
  delayMs: number;
  jitterMs: number;
  pauseEvery: number;
  pauseMs: number;
}

export interface BroadcastProgress {
  runId: number;
  phase: BroadcastPhase;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  pendingQueue: number;
  lastError: string | null;
  currentUserId: number | null;
  currentUserLabel: string | null;
  waitUntil: string | null;
  startedAt: string | null;
  updatedAt: string;
}

export interface BroadcastStatus {
  telegramConnected: boolean;
  senderAccount: {
    mode: 'broadcast' | 'monitor';
    username: string | null;
    userId: string | null;
  };
  broadcastAccountConfigured: boolean;
  pendingRecipients: number;
  settings: BroadcastSettings;
  sentThisHour: number;
  remainingThisHour: number;
  active: boolean;
  progress: BroadcastProgress | null;
}

export interface BroadcastStartResponse {
  started: boolean;
  pending: number;
  restarted: boolean;
  message: string;
}

export interface BroadcastActionResponse {
  ok: boolean;
  message: string;
}
