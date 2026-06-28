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

export interface BroadcastStatusResponse {
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
