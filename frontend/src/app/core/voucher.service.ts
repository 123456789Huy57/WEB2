import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DataService } from './data.service';
import { AuthService } from './auth.service';
import { Voucher } from './models';
import { ToastService } from './toast.service';
import { vnd } from './storage';

@Injectable({ providedIn: 'root' })
export class VoucherService {
  private data = inject(DataService);
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  readonly all = computed(() => this.data.vouchers().filter(v => v.isActive));
  readonly saved = signal<string[]>([]);

  async loadSaved(): Promise<void> {
    if (!this.auth.user()) { this.saved.set([]); return; }
    try {
      const list = await firstValueFrom(this.http.get<Voucher[]>('/api/users/me/vouchers'));
      this.saved.set(list.map(v => v.code));
    } catch { this.saved.set([]); }
  }
  find(code: string | null | undefined): Voucher | undefined {
    const c = String(code ?? '').trim().toUpperCase();
    return this.data.vouchers().find(v => v.code === c);
  }
  isFirstOrderOnly(v: Voucher): boolean { return v.audience === 'new_customer' || ['WELCOME10', 'NEWUSER20'].includes(v.code); }
  check(v: Voucher | undefined, subtotal: number, hasOrdered = false): { ok: boolean; msg: string } {
    if (!v || !v.isActive) return { ok: false, msg: 'Mã không tồn tại hoặc đã hết hạn' };
    const today = new Date().toISOString().slice(0, 10);
    if ((v.startDate && today < v.startDate) || (v.endDate && today > v.endDate)) return { ok: false, msg: 'Mã ' + v.code + ' đã hết hạn' };
    if (hasOrdered && this.isFirstOrderOnly(v)) return { ok: false, msg: 'Mã ' + v.code + ' chỉ dùng cho đơn đầu tiên' };
    if (subtotal < v.minOrderValue) return { ok: false, msg: 'Cần thêm ' + vnd(v.minOrderValue - subtotal) + ' để dùng mã ' + v.code };
    return { ok: true, msg: '' };
  }
  /** Chỉ dùng để xem trước; quote và checkout mới là kết quả có thẩm quyền từ server. */
  discount(v: Voucher, subtotal: number, shipping: number): number {
    if (v.category === 'shipping') return Math.min(shipping, v.discountValue);
    const d = v.discountType === 'percent' ? (subtotal * v.discountValue) / 100 : v.discountValue;
    return Math.round(Math.min(d, v.maxDiscountValue || d, subtotal));
  }
  label(v: Voucher): string { return v.discountType === 'percent' ? v.discountValue + '%' : v.discountValue / 1000 + 'K'; }
  isSaved(code: string): boolean { return this.saved().includes(code); }
  toggleSave(code: string): boolean {
    if (!this.auth.user()) { this.toast.show('Đăng nhập để lưu voucher vào tài khoản.'); return false; }
    const wasSaved = this.isSaved(code);
    const before = this.saved();
    this.saved.set(wasSaved ? before.filter(x => x !== code) : [...before, code]);
    const request = wasSaved
      ? this.http.delete('/api/users/me/vouchers/' + encodeURIComponent(code))
      : this.http.post('/api/users/me/vouchers/' + encodeURIComponent(code), {});
    firstValueFrom(request).catch(error => {
      this.saved.set(before);
      this.toast.show(error?.error?.error?.message || 'Không lưu được voucher.');
    });
    return !wasSaved;
  }
}
