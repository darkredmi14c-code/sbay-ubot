import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiKey = '';

  constructor(private http: HttpClient) {}

  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem('admin_api_key', key);
  }

  loadApiKey(): void {
    this.apiKey = localStorage.getItem('admin_api_key') ?? '';
  }

  private headers(): HttpHeaders {
    let h = new HttpHeaders();
    if (this.apiKey) {
      h = h.set('x-api-key', this.apiKey);
    }
    return h;
  }

  get<T>(path: string) {
    return this.http.get<T>(`${environment.apiUrl}${path}`, {
      headers: this.headers(),
    });
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${environment.apiUrl}${path}`, body, {
      headers: this.headers(),
    });
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(`${environment.apiUrl}${path}`, body, {
      headers: this.headers(),
    });
  }

  patch<T>(path: string, body: unknown) {
    return this.http.patch<T>(`${environment.apiUrl}${path}`, body, {
      headers: this.headers(),
    });
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${environment.apiUrl}${path}`, {
      headers: this.headers(),
    });
  }
}
