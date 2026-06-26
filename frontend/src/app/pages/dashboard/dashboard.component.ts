import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { Stats } from '../../models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  stats: Stats | null = null;
  error = '';
  private timer?: ReturnType<typeof setInterval>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => this.load(), 5000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  load(): void {
    this.api.get<Stats>('/stats').subscribe({
      next: (data) => {
        this.stats = data;
        this.error = '';
      },
      error: () => {
        this.error = 'Backend bilan aloqa yo\'q. Server ishlayaptimi?';
      },
    });
  }
}
