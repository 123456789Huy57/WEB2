import { Injectable, computed, inject, signal } from '@angular/core';
import { DataService } from './data.service';
import { User, UserRecord } from './models';
import { store } from './storage';

/**
 * Đăng nhập tạm phía trình duyệt để chạy được frontend (đối chiếu users.json + tài khoản đăng ký mới).
 * Nhóm Backend thay bằng POST /api/auth/login trả JWT, mật khẩu băm bằng bcrypt; giao diện không phải sửa.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private data = inject(DataService);
  readonly user = signal<User | null>(store.get<User | null>('user', null));
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  login(email: string, password: string): { ok: boolean; msg: string; user?: User } {
    const e = email.trim().toLowerCase();
    const u = this.data.users().find(x => x.email === e);
    if (!u || u.password !== password) return { ok: false, msg: 'Email hoặc mật khẩu chưa đúng' };
    const safe = strip(u);
    this.setUser(safe);
    return { ok: true, msg: '', user: safe };
  }
  register(d: { fullName: string; phone: string; email: string; password: string }): { ok: boolean; msg: string } {
    const email = d.email.trim().toLowerCase();
    if (this.data.users().some(u => u.email === email)) return { ok: false, msg: 'Email này đã có tài khoản. Bạn đăng nhập nhé.' };
    this.data.addUser({ id: 'u-' + Date.now(), fullName: d.fullName, phone: d.phone, email, password: d.password, address: '', role: 'customer', createdAt: new Date().toISOString() });
    return this.login(email, d.password);
  }
  update(patch: Partial<User>): void {
    const u = this.user();
    if (!u) return;
    this.data.updateUser(u.id, patch);
    this.setUser({ ...u, ...patch });
  }
  logout(): void { this.setUser(null); }
  private setUser(u: User | null): void { this.user.set(u); store.set('user', u); }
}

function strip(u: UserRecord): User {
  const { password: _pw, ...safe } = u;
  return safe;
}
