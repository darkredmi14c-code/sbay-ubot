import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { MonitoredGroup } from '../../models';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './groups.component.html',
})
export class GroupsComponent implements OnInit {
  groups: MonitoredGroup[] = [];
  newIdentifier = '';
  bulkText = '';
  replaceAll = false;
  message = '';
  error = '';
  resolving = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  isResolved(telegramId: string): boolean {
    return /^-?\d+$/.test(telegramId);
  }

  load(): void {
    this.api.get<MonitoredGroup[]>('/groups').subscribe({
      next: (data) => (this.groups = data),
      error: () => (this.error = 'Yuklash xatosi'),
    });
  }

  addOne(): void {
    const id = this.newIdentifier.trim();
    if (!id) return;
    this.api.post<MonitoredGroup>('/groups', { identifier: id }).subscribe({
      next: () => {
        this.newIdentifier = '';
        this.message = 'Guruh qo\'shildi';
        this.resolveAll();
      },
      error: () => (this.error = 'Qo\'shish xatosi'),
    });
  }

  addBulk(): void {
    const identifiers = this.bulkText
      .split(/[\n,;]+/)
      .map((g) => g.trim())
      .filter(Boolean);
    if (!identifiers.length) return;

    this.api
      .post<MonitoredGroup[]>('/groups/bulk', {
        identifiers,
        replace: this.replaceAll,
      })
      .subscribe({
        next: () => {
          this.bulkText = '';
          this.resolveAll();
        },
        error: () => (this.error = 'Bulk qo\'shish xatosi'),
      });
  }

  resolveAll(): void {
    this.resolving = true;
    this.error = '';
    this.api
      .post<{ resolved: number; failed: string[] }>('/telegram/resolve-groups', {})
      .subscribe({
        next: (res) => {
          this.resolving = false;
          this.message =
            `Guruhlar hal qilindi: ${res.resolved}` +
            (res.failed.length ? `. Xato: ${res.failed.join('; ')}` : '');
          this.load();
        },
        error: () => {
          this.resolving = false;
          this.error = 'Guruhlarni hal qilish xatosi';
        },
      });
  }

  remove(id: number): void {
    this.api.delete(`/groups/${id}`).subscribe({
      next: () => this.load(),
      error: () => (this.error = 'O\'chirish xatosi'),
    });
  }
}
