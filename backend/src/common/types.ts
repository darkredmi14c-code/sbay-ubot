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
  isBot: boolean;
  messageLink: string | null;
  canForward: boolean;
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

export interface StatsResponse {
  employers: number;
  seekers: number;
  scammers: number;
  unseen: number;
  keywords: number;
  groups: number;
  telegram: TelegramStatus;
}
