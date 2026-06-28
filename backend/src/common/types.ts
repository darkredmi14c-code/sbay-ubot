export interface AiAnalysisResult {
  isDailyWork: boolean;
  type: 'employer' | 'seeker';
  reason?: string;
}

export interface IncomingMessagePayload {
  messageId: number;
  chatId: string;
  chatTitle: string;
  text: string;
  senderId: string;
  senderUsername: string | null;
  senderFirstName: string | null;
  senderLastName: string | null;
  senderPhone: string | null;
  senderAccessHash: string | null;
  isBot: boolean;
  messageLink: string | null;
  canForward: boolean;
}

/** Telegram DM yuborish uchun foydalanuvchini hal qilish ma'lumotlari */
export interface DirectMessageRecipient {
  telegramUserId: string;
  username?: string | null;
  accessHash?: string | null;
  sourceGroupId?: string | null;
  sourceMessageId?: string | null;
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

export interface StatsResponse {
  employers: number;
  seekers: number;
  scammers: number;
  unseen: number;
  keywords: number;
  groups: number;
  telegram: TelegramStatus;
}
