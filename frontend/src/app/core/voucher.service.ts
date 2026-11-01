import { Injectable, computed, inject, signal } from '@angular/core';
import { DataService } from './data.service';
import { Voucher } from './models';
import { store, vnd } from './storage';

const FIRST_ORDER_CODES = ['WELCOME10', 'NEWUSER20'];

@Injectable({ providedIn: 'root' })
export class VoucherService {
  private data = inject(DataService);
  readonly all = computed(() => this.data.vouchers().filter(v => v.isActive));
  /** Mã người dùng đã bấm "Lưu mã" */
  readonly saved = signal<string[]>(store.get('savedVouchers', []));

  find(code: string | null | undefined): Voucher | undefined {
    const c = String(code ?? '').trim().toUpperCase();
    return this.data.vouchers().find(v => v.code === c);
  }
  /** Mã chỉ dành cho đơn đầu tiên của tài khoản */
  isFirstOrderOnly(v: Voucher): boolean { return FIRST_ORDER_CODES.includes(v.code); }
  check(v: Voucher | undefined, subtotal: number, hasOrdered = false): { ok: boolean; msg: string } {
    if (!v || !v.isActive) return { ok: false, msg: 'Mã không tồn tại hoặc đã hết hạn' };
    const today = new Date().toISOString().slice(0, 10);
    if ((v.startDate && today < v.startDate) || (v.endDate && today > v.endDate)) return { ok: false, msg: `Mã ${v.code} đã hết hạn` };
    if (hasOrdered && this.isFirstOrderOnly(v)) return { ok: false, msg: `Mã ${v.code} chỉ dùng cho đơn đầu tiên` };
    if (subtotal < v.minOrderValue) return { ok: false, msg: `Cần thêm ${vnd(v.minOrderValue - subtotal)} để dùng mã ${v.code}` };
    return { ok: true, msg: '' };
  }
  /** Cách tính giữ nguyên như Web1 (js/checkout.js) */
  discount(v: Voucher, subtotal: number, shipping: number): number {
    if (v.category === 'shipping') return Math.min(shipping, v.discountValue);
    const d = v.discountType === 'percent' ? (subtotal * v.discountValue) / 100 : v.discountValue;
    return Math.round(Math.min(d, v.maxDiscountValue || d, subtotal));
  }
  label(v: Voucher): string { return v.discountType === 'percent' ? `${v.discountValue}%` : `${v.discountValue / 1000}K`; }
  isSaved(code: string): boolean { return this.saved().includes(code); }
  toggleSave(code: string): boolean {
    const list = [...this.saved()];
    const i = list.indexOf(code);
    if (i > -1) list.splice(i, 1); else list.push(code);
    this.saved.set(list); store.set('savedVouchers', list);
    return i < 0;
  }
}
