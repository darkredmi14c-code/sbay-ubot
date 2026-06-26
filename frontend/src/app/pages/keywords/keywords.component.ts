import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Keyword } from '../../models';

@Component({
  selector: 'app-keywords',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './keywords.component.html',
})
export class KeywordsComponent implements OnInit {
  keywords: Keyword[] = [];
  newWord = '';
  bulkText = '';
  replaceAll = false;
  message = '';
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.get<Keyword[]>('/keywords').subscribe({
      next: (data) => (this.keywords = data),
      error: () => (this.error = 'Yuklash xatosi'),
    });
  }

  addOne(): void {
    const word = this.newWord.trim();
    if (!word) return;
    this.api.post<Keyword>('/keywords', { word }).subscribe({
      next: () => {
        this.newWord = '';
        this.message = 'Qo\'shildi';
        this.load();
      },
      error: () => (this.error = 'Qo\'shish xatosi'),
    });
  }

  addBulk(): void {
    const words = this.bulkText
      .split(/[\n,;]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (!words.length) return;

    this.api
      .post<Keyword[]>('/keywords/bulk', { words, replace: this.replaceAll })
      .subscribe({
        next: () => {
          this.bulkText = '';
          this.message = `${words.length} ta kalit so'z saqlandi`;
          this.load();
        },
        error: () => (this.error = 'Bulk qo\'shish xatosi'),
      });
  }

  remove(id: number): void {
    this.api.delete(`/keywords/${id}`).subscribe({
      next: () => this.load(),
      error: () => (this.error = 'O\'chirish xatosi'),
    });
  }
}
