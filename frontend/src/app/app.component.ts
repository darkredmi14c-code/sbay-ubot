import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from './services/api.service';

const SIDEBAR_KEY = 'sidebar_collapsed';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  apiKeyInput = '';
  sidebarCollapsed = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.loadApiKey();
    this.apiKeyInput = localStorage.getItem('admin_api_key') ?? '';
    this.sidebarCollapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
  }

  saveApiKey(): void {
    this.api.setApiKey(this.apiKeyInput.trim());
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    localStorage.setItem(SIDEBAR_KEY, this.sidebarCollapsed ? '1' : '0');
  }
}
