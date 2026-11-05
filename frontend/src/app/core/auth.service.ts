import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { User } from './models';
import { DataService } from './data.service';
import { store } from './storage';

type AuthResponse = { user: User | null; csrfToken: string };
export function apiMessage(error: unknown): string {
  return error instanceof HttpErrorResponse ? error.error?.error?.message || 'Không kết nối được máy chủ. Vui lòng thử lại.' : 'Thao tác chưa hoàn thành. Vui lòng thử lại.';
}
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private data = inject(DataService);
  readonly user = signal<User | null>(null);
  readonly csrfToken = signal('');
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  async restore(): Promise<void> {
    // Remove the old Web1 identity/password cache. The server session is authoritative.
    store.remove('user'); store.remove('users');
    const response = await firstValueFrom(this.http.get<AuthResponse>('/api/auth/session'));
    this.accept(response);
  }
  private accept(response: AuthResponse): void {
    this.user.set(response.user); this.csrfToken.set(response.csrfToken);
  }
  async login(email: string, password: string, rememberMe = false): Promise<{ ok: boolean; msg: string; user?: User }> {
    return this.authenticate('/api/auth/login', { identifier: email, password, rememberMe });
  }
  async register(data: { fullName: string; phone: string; email: string; password: string }): Promise<{ ok: boolean; msg: string; user?: User }> {
    return this.authenticate('/api/auth/register', data);
  }
  private async authenticate(url: string, body: object): Promise<{ ok: boolean; msg: string; user?: User }> {
    try {
      if (!this.csrfToken()) await this.restore();
      const response = await firstValueFrom(this.http.post<AuthResponse>(url, body));
      this.accept(response);
      await this.data.load(this.isAdmin());
      return { ok: true, msg: '', user: response.user ?? undefined };
    } catch (error) { return { ok: false, msg: apiMessage(error) }; }
  }
  async update(patch: Pick<User, 'fullName' | 'phone' | 'address'>): Promise<void> {
    const user = await firstValueFrom(this.http.patch<User>('/api/users/me', patch));
    this.user.set(user);
  }
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.patch('/api/users/me/password', { currentPassword, newPassword }));
    this.user.set(null); this.csrfToken.set('');
    await this.data.load(false);
  }
  async requestRecovery(email: string): Promise<{ message: string; delivery: string }> {
    if (!this.csrfToken()) await this.restore();
    return firstValueFrom(this.http.post<{ message: string; delivery: string }>('/api/auth/forgot-password', { email }));
  }
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!this.csrfToken()) await this.restore();
    await firstValueFrom(this.http.post('/api/auth/reset-password', { token, newPassword }));
    this.user.set(null); this.csrfToken.set('');
    await this.data.load(false);
  }
  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}));
    this.user.set(null); this.csrfToken.set('');
    await this.restore();
    await this.data.load(false);
  }
}
