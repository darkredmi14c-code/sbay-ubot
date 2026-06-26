import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AppSettings } from '../../models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit, OnDestroy {
  settings: AppSettings = {
    employerChannelId: '',
    seekerChannelId: '',
    employerMessageTemplate: '',
    seekerMessageTemplate: '',
  };
  message = '';
  error = '';
  pendingMessages = 0;
  broadcasting = false;
  broadcastLimits: {
    maxPerHour: number;
    sentThisHour: number;
    remainingHour: number;
    estimatedTotalSeconds: number;
  } | null = null;
  private statusTimer?: ReturnType<typeof setInterval>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
    this.loadPending();
    this.statusTimer = setInterval(() => this.loadPending(), 5000);
  }

  ngOnDestroy(): void {
    if (this.statusTimer) clearInterval(this.statusTimer);
  }

  load(): void {
    this.api.get<AppSettings>('/settings').subscribe({
      next: (data) => {
        this.settings = {
          employerChannelId: data.employerChannelId ?? '',
          seekerChannelId: data.seekerChannelId ?? '',
          employerMessageTemplate: data.employerMessageTemplate ?? '',
          seekerMessageTemplate: data.seekerMessageTemplate ?? '',
        };
      },
      error: () => (this.error = 'Yuklash xatosi'),
    });
  }

  save(): void {
    this.api
      .put<AppSettings>('/settings', {
        employerChannelId: this.settings.employerChannelId || null,
        seekerChannelId: this.settings.seekerChannelId || null,
        employerMessageTemplate: this.settings.employerMessageTemplate,
        seekerMessageTemplate: this.settings.seekerMessageTemplate,
      })
      .subscribe({
        next: (data) => {
          this.settings = {
            employerChannelId: data.employerChannelId ?? '',
            seekerChannelId: data.seekerChannelId ?? '',
            employerMessageTemplate: data.employerMessageTemplate ?? '',
            seekerMessageTemplate: data.seekerMessageTemplate ?? '',
          };
          this.message = 'Sozlamalar saqlandi';
          this.error = '';
        },
        error: () => (this.error = 'Saqlash xatosi'),
      });
  }

  loadPending(): void {
    this.api
      .get<{
        running: boolean;
        pendingMessages: number;
        maxPerHour: number;
        sentThisHour: number;
        remainingHour: number;
        estimatedTotalSeconds: number;
      }>('/users/broadcast-messages/status')
      .subscribe({
        next: (data) => {
          this.pendingMessages = data.pendingMessages;
          this.broadcasting = data.running;
          this.broadcastLimits = {
            maxPerHour: data.maxPerHour,
            sentThisHour: data.sentThisHour,
            remainingHour: data.remainingHour,
            estimatedTotalSeconds: data.estimatedTotalSeconds,
          };
        },
      });
  }

  broadcastAll(): void {
    if (this.pendingMessages === 0) return;

    const mins = Math.max(
      1,
      Math.ceil((this.broadcastLimits?.estimatedTotalSeconds ?? 60) / 60),
    );
    const restartNote = this.broadcasting
      ? '\n\n⚠️ Avvalgi yuborish to\'xtatiladi va qaytadan boshlanadi.'
      : '';

    if (
      !confirm(
        `${this.pendingMessages} ta foydalanuvchiga xabar yuborilsinmi?${restartNote}\n\n` +
          `• Bir marta bosish — dastur o'zi hammasini yuboradi\n` +
          `• Har 4–7 soniyada bitta, har 10 tadan keyin pauza\n` +
          `• Soatlik limit: ${this.broadcastLimits?.maxPerHour ?? 30}/soat (limit tugasa kutadi)\n` +
          `• Taxminiy vaqt: ~${mins} daqiqa\n` +
          `• Avval olganlar o'tkazib yuboriladi`,
      )
    ) {
      return;
    }

    this.broadcasting = true;
    this.api
      .post<{
        started: boolean;
        pending: number;
        restarted: boolean;
        message: string;
      }>('/users/broadcast-messages', {})
      .subscribe({
        next: (res) => {
          this.message = res.message;
          this.error = '';
          this.loadPending();
        },
        error: (err) => {
          this.error = err?.error?.message ?? 'Yuborish xatosi';
          this.loadPending();
        },
      });
  }
}
