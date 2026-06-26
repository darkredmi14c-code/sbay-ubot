import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { UserRecord, UserType, USER_TYPE_LABELS } from '../../models';

type SeenFilter = 'all' | 'new' | 'seen';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  users: UserRecord[] = [];
  typeFilter: UserType | 'all' = 'all';
  seenFilter: SeenFilter = 'new';
  unseenCount = 0;
  error = '';
  message = '';
  sendingId: number | null = null;

  blockUserId = '';
  labels = USER_TYPE_LABELS;
  messageModalUser: UserRecord | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadStats();
    this.load();
  }

  loadStats(): void {
    this.api.get<{ unseen: number }>('/users/stats').subscribe({
      next: (data) => (this.unseenCount = data.unseen),
    });
  }

  load(): void {
    const params = new URLSearchParams();
    if (this.typeFilter !== 'all') params.set('type', this.typeFilter);
    if (this.seenFilter === 'new') params.set('seen', 'false');
    if (this.seenFilter === 'seen') params.set('seen', 'true');

    const qs = params.toString();
    const path = qs ? `/users?${qs}` : '/users';

    this.api.get<UserRecord[]>(path).subscribe({
      next: (data) => {
        this.users = data;
        this.error = '';
      },
      error: () => (this.error = 'Yuklash xatosi'),
    });
    this.loadStats();
  }

  setTypeFilter(type: UserType | 'all'): void {
    this.typeFilter = type;
    this.load();
  }

  setSeenFilter(seen: SeenFilter): void {
    this.seenFilter = seen;
    this.load();
  }

  sendMessage(user: UserRecord): void {
    if (user.type === 'scammer') return;
    const label = this.labels[user.type];
    if (!confirm(`${label} ga xabar yuborilsinmi?`)) return;

    this.sendingId = user.id;
    this.api.post<{ sent: string }>(`/users/${user.id}/send-message`, {}).subscribe({
      next: () => {
        this.message = 'Xabar yuborildi';
        this.sendingId = null;
        this.load();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Xabar yuborish xatosi';
        this.sendingId = null;
      },
    });
  }

  markSeen(user: UserRecord): void {
    this.api.patch(`/users/${user.id}/seen`, {}).subscribe({
      next: () => this.load(),
      error: () => (this.error = 'Saqlash xatosi'),
    });
  }

  markAllSeen(): void {
    if (!confirm('Barcha yangi foydalanuvchilar ko\'rilgan deb belgilansinmi?')) return;
    this.api.post<{ updated: number }>('/users/mark-all-seen', {}).subscribe({
      next: (res) => {
        this.message = `${res.updated} ta ko'rilgan deb belgilandi`;
        this.load();
      },
      error: () => (this.error = 'Xato'),
    });
  }

  markScammer(user: UserRecord): void {
    if (!confirm(`${user.telegramUserId} ni spamchi deb belgilaysizmi?`)) return;
    this.api.patch(`/users/${user.id}/type`, { type: 'scammer' }).subscribe({
      next: () => {
        this.message = 'Spamchi deb belgilandi';
        this.load();
      },
      error: () => (this.error = 'Saqlash xatosi'),
    });
  }

  removeUser(id: number): void {
    if (!confirm('Ro\'yxatdan o\'chirasizmi?')) return;
    this.api.delete(`/users/${id}`).subscribe({
      next: () => this.load(),
      error: () => (this.error = 'O\'chirish xatosi'),
    });
  }

  blockById(): void {
    const id = this.blockUserId.trim();
    if (!id) return;
    this.api.post('/users/block', { telegramUserId: id }).subscribe({
      next: () => {
        this.blockUserId = '';
        this.message = 'Spamchi qo\'shildi';
        this.load();
      },
      error: () => (this.error = 'Bloklash xatosi'),
    });
  }

  typeBadgeClass(type: UserType): string {
    if (type === 'scammer') return 'scammer';
    if (type === 'employer') return 'employer';
    return 'seeker';
  }

  openMessage(user: UserRecord): void {
    if (!user.originalText) return;
    this.messageModalUser = user;
  }

  closeMessage(): void {
    this.messageModalUser = null;
  }

  previewText(text: string, max = 48): string {
    const trimmed = text.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max)}…`;
  }

  userDisplayName(user: UserRecord): string {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (name) return name;
    if (user.username) return `@${user.username}`;
    return user.telegramUserId;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMessage();
  }
}
