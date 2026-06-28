import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../services/api.service';
import {
  BroadcastActionResponse,
  BroadcastPhase,
  BroadcastSettings,
  BroadcastStartResponse,
  BroadcastStatus,
} from '../../models';

const PHASE_LABELS: Record<BroadcastPhase, string> = {
  idle: 'Tayyor',
  running: 'Yuborilmoqda',
  paused: 'Pauza',
  waiting_limit: 'Soatlik limit — kutish',
  cooldown: 'Tanaffus (spam himoyasi)',
  completed: 'Tugadi',
  cancelled: 'Bekor qilindi',
};

@Component({
  selector: 'app-broadcast',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './broadcast.component.html',
  styleUrl: './broadcast.component.scss',
})
export class BroadcastComponent implements OnInit, OnDestroy {
  status: BroadcastStatus | null = null;
  settingsForm: BroadcastSettings = {
    maxPerHour: 30,
    delayMs: 4000,
    jitterMs: 3000,
    pauseEvery: 10,
    pauseMs: 120_000,
  };
  message = '';
  error = '';
  savingSettings = false;
  actionLoading = false;
  settingsDirty = false;
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.refresh();
    this.pollTimer = setInterval(() => this.refresh(), 1500);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  onSettingsChange(): void {
    this.settingsDirty = true;
  }

  phaseLabel(phase: BroadcastPhase): string {
    return PHASE_LABELS[phase] ?? phase;
  }

  senderAccountLabel(): string {
    const account = this.status?.senderAccount;
    if (!account) return '—';
    const name = account.username ?? account.userId ?? '—';
    return account.username ? `@${name}` : name;
  }

  progressPercent(): number {
    const p = this.status?.progress;
    if (!p || p.total === 0) return 0;
    return Math.min(100, Math.round((p.processed / p.total) * 100));
  }

  waitRemaining(): string | null {
    const until = this.status?.progress?.waitUntil;
    if (!until) return null;
    const sec = Math.max(
      0,
      Math.ceil((new Date(until).getTime() - Date.now()) / 1000),
    );
    if (sec <= 0) return null;
    if (sec >= 60) return `${Math.ceil(sec / 60)} daqiqa`;
    return `${sec} soniya`;
  }

  canStart(): boolean {
    return (
      !this.actionLoading &&
      !!this.status?.telegramConnected &&
      (this.status.pendingRecipients ?? 0) > 0
    );
  }

  canPause(): boolean {
    const phase = this.status?.progress?.phase;
    return (
      !this.actionLoading &&
      !!phase &&
      (phase === 'running' || phase === 'waiting_limit' || phase === 'cooldown')
    );
  }

  canResume(): boolean {
    return !this.actionLoading && this.status?.progress?.phase === 'paused';
  }

  canCancel(): boolean {
    return !this.actionLoading && !!this.status?.active;
  }

  refresh(): void {
    this.api.get<BroadcastStatus>('/broadcast/status').subscribe({
      next: (data: BroadcastStatus) => {
        this.status = data;
        if (!this.settingsDirty && !this.savingSettings) {
          this.settingsForm = { ...data.settings };
        }
      },
    });
  }

  saveSettings(): void {
    this.savingSettings = true;
    this.api
      .put<BroadcastSettings>('/broadcast/settings', this.settingsForm)
      .subscribe({
        next: (data: BroadcastSettings) => {
          this.settingsForm = { ...data };
          this.settingsDirty = false;
          this.message = 'Spam himoyasi sozlamalari saqlandi';
          this.error = '';
          this.savingSettings = false;
          this.refresh();
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.apiErrorMessage(err, 'Saqlash xatosi');
          this.savingSettings = false;
        },
      });
  }

  start(): void {
    if (!this.canStart()) return;
    const pending = this.status?.pendingRecipients ?? 0;
    const restart = this.status?.active;
    const note = restart
      ? '\n\nAvvalgi jarayon to\'xtatiladi va qaytadan boshlanadi.'
      : '';

    if (
      !confirm(
        `${pending} ta foydalanuvchiga xabar yuborilsinmi?${note}\n\n` +
          `Soatlik limit: ${this.settingsForm.maxPerHour}/soat\n` +
          `Jarayonni istalgan vaqtda pauza yoki bekor qilishingiz mumkin.`,
      )
    ) {
      return;
    }

    this.actionLoading = true;
    this.api
      .post<BroadcastStartResponse>('/broadcast/start', {})
      .subscribe({
        next: (res: BroadcastStartResponse) => {
          this.message = res.message;
          this.error = '';
          this.actionLoading = false;
          this.refresh();
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.apiErrorMessage(err, 'Boshlash xatosi');
          this.actionLoading = false;
          this.refresh();
        },
      });
  }

  pause(): void {
    if (!this.canPause()) return;
    this.actionLoading = true;
    this.api
      .post<BroadcastActionResponse>('/broadcast/pause', {})
      .subscribe({
        next: (res: BroadcastActionResponse) => {
          this.message = res.message;
          this.actionLoading = false;
          this.refresh();
        },
        error: () => {
          this.actionLoading = false;
          this.refresh();
        },
      });
  }

  resume(): void {
    if (!this.canResume()) return;
    this.actionLoading = true;
    this.api
      .post<BroadcastActionResponse>('/broadcast/resume', {})
      .subscribe({
        next: (res: BroadcastActionResponse) => {
          this.message = res.message;
          this.actionLoading = false;
          this.refresh();
        },
        error: () => {
          this.actionLoading = false;
          this.refresh();
        },
      });
  }

  cancel(): void {
    if (!this.canCancel()) return;
    if (!confirm('Yuborish jarayonini bekor qilasizmi?')) return;

    this.actionLoading = true;
    this.api
      .post<BroadcastActionResponse>('/broadcast/cancel', {})
      .subscribe({
        next: (res: BroadcastActionResponse) => {
          this.message = res.message;
          this.actionLoading = false;
          this.refresh();
        },
        error: () => {
          this.actionLoading = false;
          this.refresh();
        },
      });
  }

  private apiErrorMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string } | null;
    return body?.message ?? fallback;
  }
}
