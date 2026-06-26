import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  apiKeyInput = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.loadApiKey();
    this.apiKeyInput = localStorage.getItem('admin_api_key') ?? '';
  }

  saveApiKey(): void {
    this.api.setApiKey(this.apiKeyInput.trim());
  }
}
