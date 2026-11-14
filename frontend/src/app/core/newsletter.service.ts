import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

/** Đăng ký / hủy nhận thư ưu đãi. Cần CSRF token của phiên nên lấy phiên trước nếu chưa có. */
@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  async subscribe(email: string): Promise<{ message: string; delivery: string }> {
    if (!this.auth.csrfToken()) await this.auth.restore();
    return firstValueFrom(this.http.post<{ message: string; delivery: string }>('/api/newsletter/subscribe', { email }));
  }
  async unsubscribe(token: string): Promise<{ message: string }> {
    if (!this.auth.csrfToken()) await this.auth.restore();
    return firstValueFrom(this.http.post<{ message: string }>('/api/newsletter/unsubscribe', { token }));
  }
}
