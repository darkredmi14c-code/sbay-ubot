import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AppSettings } from '../../models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  settings: AppSettings = {
    employerChannelId: '',
    seekerChannelId: '',
    employerMessageTemplate: '',
    seekerMessageTemplate: '',
  };
  message = '';
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
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
}
