import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { UserRecord, UsersPageResponse, UserType, USER_TYPE_LABELS } from '../../models';

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
  total = 0;
  page = 1;
  pageSize = 25;
  readonly pageSizeOptions = [25, 50, 100];
  error = '';
  message = '';
  sendingId: number | null = null;
  changingTypeId: number | null = null;
  loading = false;

  blockUserId = '';
  labels = USER_TYPE_LABELS;
  readonly typeOptions: UserType[] = ['employer', 'seeker', 'scammer'];
  messageModalUser: UserRecord | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadStats();
    this.load();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get rangeStart(): number {
    if (this.total === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.total);
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
    params.set('page', String(this.page));
    params.set('pageSize', String(this.pageSize));

    this.loading = true;
    this.api.get<UsersPageResponse>(`/users?${params}`).subscribe({
      next: (data) => {
        this.users = data.items;
        this.total = data.total;
        this.page = data.page;
        this.pageSize = data.pageSize;
        this.error = '';
        this.loading = false;
      },
      error: () => {
        this.error = 'Yuklash xatosi';
        this.loading = false;
      },
    });
    this.loadStats();
  }

  setTypeFilter(type: UserType | 'all'): void {
    this.typeFilter = type;
    this.page = 1;
    this.load();
  }

  setSeenFilter(seen: SeenFilter): void {
    this.seenFilter = seen;
    this.page = 1;
    this.load();
  }

  setPageSize(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.load();
  }

  goToPage(page: number): void {
    const next = Math.min(this.totalPages, Math.max(1, page));
    if (next === this.page) return;
    this.page = next;
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

  changeType(user: UserRecord, type: UserType): void {
    if (user.type === type) return;

    const from = this.labels[user.type];
    const to = this.labels[type];
    if (!confirm(`${user.telegramUserId}: "${from}" → "${to}" ga o'zgartirilsinmi?`)) {
      return;
    }

    this.changingTypeId = user.id;
    this.api.patch<UserRecord>(`/users/${user.id}/type`, { type }).subscribe({
      next: () => {
        this.message = `Tip o'zgartirildi: ${to}`;
        this.changingTypeId = null;
        if (this.messageModalUser?.id === user.id) {
          this.messageModalUser = { ...this.messageModalUser, type };
        }
        this.load();
      },
      error: () => {
        this.error = 'Tip o\'zgartirish xatosi';
        this.changingTypeId = null;
      },
    });
  }

  onTypeSelect(user: UserRecord, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const type = select.value as UserType;
    if (type === user.type) return;
    select.value = user.type;
    this.changeType(user, type);
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

  previewText(text: string, max = 32): string {
    const trimmed = text.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max)}…`;
  }

  shortText(text: string | null | undefined, max = 14): string {
    if (!text?.trim()) return '—';
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

  shortName(user: UserRecord): string {
    return this.shortText(this.userDisplayName(user), 14);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMessage();
  }
}
