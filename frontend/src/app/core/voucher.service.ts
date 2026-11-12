import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DataService } from './data.service';
import { AuthService } from './auth.service';
import { Voucher } from './models';
import { vnd } from './storage';

/**
 * Voucher lấy từ API. Kiểm tra ở đây chỉ để gợi ý trên giao diện;
 * server mới là nơi quyết định (báo giá và đặt đơn đều kiểm tra lại).
 */
@Injectable({ providedIn: 'root' })
export class VoucherService {
  private http = inject(HttpClient);
  private data = inject(DataService);
  private auth = inject(AuthService);
  /** Voucher đang chạy (admin: tất cả voucher) */
  readonly all = computed(() => this.data.vouchers().filter(v => v.isActive));
  /** "Ưu đãi của tôi": mã đã lưu + mã khách mới */
  readonly mine = signal<Voucher[]>([]);
  /** Mã người dùng đã bấm "Lưu mã" */
  readonly saved = computed(() => this.mine().filter(v => v.saved).map(v => v.code));

  constructor() {
    effect(() => { const u = this.auth.user(); untracked(() => void this.loadMine(!!u)); });
  }

  async loadMine(loggedIn = !!this.auth.user()): Promise<void> {
    if (!loggedIn) { this.mine.set([]); return; }
    try { this.mine.set(await firstValueFrom(this.http.get<Voucher[]>('/api/users/me/vouchers'))); } catch { this.mine.set([]); }
  }

  find(code: string | null | undefined): Voucher | undefined {
    const c = String(code ?? '').trim().toUpperCase();
    return this.data.vouchers().find(v => v.code === c) ?? this.mine().find(v => v.code === c);
  }
  /** Mã chỉ dành cho khách chưa có đơn */
  isFirstOrderOnly(v: Voucher): boolean { return v.audience === 'new_customer'; }
  check(v: Voucher | undefined, subtotal: number, hasOrdered = false): { ok: boolean; msg: string } {
    if (!v || !v.isActive) return { ok: false, msg: 'Mã không tồn tại hoặc đã hết hạn' };
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    if ((v.startDate && today < v.startDate) || (v.endDate && today > v.endDate)) return { ok: false, msg: `Mã ${v.code} đã hết hạn` };
    if (v.remaining === 0) return { ok: false, msg: `Mã ${v.code} đã hết lượt` };
    if (v.usedByMe && v.usedByMe >= (v.perUserLimit ?? 1)) return { ok: false, msg: `Bạn đã dùng mã ${v.code}` };
    if (hasOrdered && this.isFirstOrderOnly(v)) return { ok: false, msg: `Mã ${v.code} chỉ dùng cho đơn đầu tiên` };
    if (subtotal < v.minOrderValue) return { ok: false, msg: `Cần thêm ${vnd(v.minOrderValue - subtotal)} để dùng mã ${v.code}` };
    return { ok: true, msg: '' };
  }
  /** Ước tính để hiển thị; số tiền thật do server tính */
  discount(v: Voucher, subtotal: number, shipping: number): number {
    const base = v.category === 'shipping' ? shipping : subtotal;
    const d = v.discountType === 'percent' ? Math.round((base * v.discountValue) / 100) : v.discountValue;
    return Math.max(0, Math.min(d, v.maxDiscountValue || d, base));
  }
  label(v: Voucher): string { return v.discountType === 'percent' ? `${v.discountValue}%` : `${v.discountValue / 1000}K`; }
  isSaved(code: string): boolean { return this.saved().includes(code); }
  /** Lưu / bỏ lưu mã. Trả về true nếu vừa lưu; null nếu chưa đăng nhập hoặc lỗi. */
  async toggleSave(code: string): Promise<boolean | null> {
    if (!this.auth.user()) return null;
    const saving = !this.isSaved(code);
    try {
      this.mine.set(await firstValueFrom(saving
        ? this.http.post<Voucher[]>('/api/users/me/vouchers', { code })
        : this.http.delete<Voucher[]>(`/api/users/me/vouchers/${code}`)));
      return saving;
    } catch { return null; }
  }
}
