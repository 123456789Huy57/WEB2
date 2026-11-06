import { Injectable, computed, inject, signal } from '@angular/core';
import { ProductService } from './product.service';
import { VoucherService } from './voucher.service';
import { AuthService } from './auth.service';
import { OrderService } from './order.service';
import { CartLine, Product } from './models';
import { store } from './storage';

export const FREE_SHIP_FROM = 300000;
export const SHIP_FEE = 20000;

@Injectable({ providedIn: 'root' })
export class CartService {
  private products = inject(ProductService);
  private vouchers = inject(VoucherService);
  private auth = inject(AuthService);
  private orders = inject(OrderService);
  /** Tài khoản đang đăng nhập đã từng đặt đơn chưa (mã "đơn đầu tiên") */
  readonly hasOrdered = computed(() => this.orders.hasOrdered(this.auth.user()));
  private state = signal<{ items: CartLine[]; voucher: string }>(store.get('cart', { items: [], voucher: '' }));

  readonly lines = computed(() =>
    this.state().items
      .map(i => ({ p: this.products.get(i.id), qty: i.qty }))
      .filter((l): l is { p: Product; qty: number } => !!l.p && l.p.active !== false)
  );
  readonly count = computed(() => this.lines().length);
  readonly voucherCode = computed(() => this.state().voucher);
  readonly subtotal = computed(() => this.lines().reduce((s, l) => s + this.products.price(l.p) * l.qty, 0));
  readonly totals = computed(() => {
    const sub = this.subtotal();
    const ship = sub === 0 || sub >= FREE_SHIP_FROM ? 0 : SHIP_FEE;
    const v = this.vouchers.find(this.state().voucher);
    const r = this.vouchers.check(v, sub, this.hasOrdered());
    const disc = v && r.ok ? this.vouchers.discount(v, sub, ship) : 0;
    return { sub, ship, disc, total: Math.max(0, sub + ship - disc), voucher: r.ok ? v : undefined, voucherMsg: v && !r.ok ? r.msg : '' };
  });
  /** Tăng mỗi lần giỏ thay đổi để header chạy hiệu ứng nảy số */
  readonly bumps = signal(0);

  qty(id: string): number { return this.state().items.find(i => i.id === id)?.qty ?? 0; }

  set(id: string, qty: number): void {
    const p = this.products.get(id);
    if (!p && qty > 0) return;
    const step = p ? this.products.step(p) : 1;
    const stock = p ? Math.max(0, Math.floor((p.stock + Number.EPSILON) / step) * step) : 0;
    const q = Math.max(0, Math.min(Math.round(qty / step) * step, stock));
    const items = this.state().items.filter(i => i.id !== id);
    const old = this.state().items.findIndex(i => i.id === id);
    if (q) {
      const normalized = +q.toFixed(2);
      if (old > -1) items.splice(old, 0, { id, qty: normalized }); else items.push({ id, qty: normalized });
    }
    this.save({ ...this.state(), items });
  }
  add(id: string, qty?: number): void { const p = this.products.get(id); this.set(id, this.qty(id) + (qty ?? (p ? this.products.step(p) : 1))); }
  /** Tăng / giảm một nấc (0,5 kg hoặc 1 đơn vị) */
  nudge(id: string, dir: 1 | -1): void { const p = this.products.get(id); this.set(id, this.qty(id) + dir * (p ? this.products.step(p) : 1)); }
  setVoucher(code: string): void { this.save({ ...this.state(), voucher: code.trim().toUpperCase() }); }
  clear(): void { this.save({ items: [], voucher: '' }); }

  private save(s: { items: CartLine[]; voucher: string }): void {
    this.state.set(s);
    store.set('cart', s);
    this.bumps.update(n => n + 1);
  }
}
