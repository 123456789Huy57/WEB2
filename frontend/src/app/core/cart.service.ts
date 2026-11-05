import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProductService } from './product.service';
import { VoucherService } from './voucher.service';
import { AuthService } from './auth.service';
import { OrderService } from './order.service';
import { CartLine, Product } from './models';
import { ToastService } from './toast.service';

export const FREE_SHIP_FROM = 300000;
export const SHIP_FEE = 20000;

@Injectable({ providedIn: 'root' })
export class CartService {
  private products = inject(ProductService);
  private http = inject(HttpClient);
  private vouchers = inject(VoucherService);
  private auth = inject(AuthService);
  private orders = inject(OrderService);
  private toast = inject(ToastService);
  /** Tài khoản đang đăng nhập đã từng đặt đơn chưa (mã "đơn đầu tiên") */
  readonly hasOrdered = computed(() => this.orders.hasOrdered(this.auth.user()));
  private state = signal<{ items: CartLine[]; voucher: string }>({ items: [], voucher: '' });
  private quoteState = signal<{ subtotal: number; shippingFee: number; discount: number; total: number; voucherCode: string | null } | null>(null);
  readonly issues = signal<{ productId: string; code: string; available?: number; requested?: number }[]>([]);
  readonly error = signal('');
  private queue: Promise<void> = Promise.resolve();
  private sequence = 0;

  readonly lines = computed(() =>
    this.state().items
      .map(i => ({ p: this.products.get(i.id), qty: i.qty }))
      .filter((l): l is { p: Product; qty: number } => !!l.p && l.p.active !== false)
  );
  readonly count = computed(() => this.lines().length);
  readonly voucherCode = computed(() => this.state().voucher);
  readonly subtotal = computed(() => this.quoteState()?.subtotal ?? this.lines().reduce((s, l) => s + this.products.price(l.p) * l.qty, 0));
  readonly totals = computed(() => {
    const quote = this.quoteState();
    const sub = quote?.subtotal ?? this.lines().reduce((s, l) => s + this.products.price(l.p) * l.qty, 0);
    const ship = sub === 0 || sub >= FREE_SHIP_FROM ? 0 : SHIP_FEE;
    const v = this.vouchers.find(this.state().voucher);
    const r = this.vouchers.check(v, sub, this.hasOrdered());
    const disc = quote?.discount ?? 0;
    return { sub, ship: quote?.shippingFee ?? ship, disc, total: quote?.total ?? Math.max(0, sub + ship), voucher: quote?.voucherCode ? v : undefined, voucherMsg: v && !r.ok ? r.msg : this.error() };
  });
  /** Tăng mỗi lần giỏ thay đổi để header chạy hiệu ứng nảy số */
  readonly bumps = signal(0);

  qty(id: string): number { return this.state().items.find(i => i.id === id)?.qty ?? 0; }

  async load(): Promise<void> {
    try { await this.refresh(); } catch (error) { this.error.set(this.message(error)); }
  }

  set(id: string, qty: number): void {
    const p = this.products.get(id);
    const step = p ? this.products.step(p) : 1;
    const q = Math.max(0, Math.min(Math.round(qty / step) * step, p?.stock || 99));
    const oldQty = this.qty(id);
    const items = this.state().items.filter(i => i.id !== id);
    const old = this.state().items.findIndex(i => i.id === id);
    if (q) { if (old > -1) items.splice(old, 0, { id, qty: q }); else items.push({ id, qty: q }); }
    this.update({ ...this.state(), items });
    this.enqueue(async () => {
      if (!q) await firstValueFrom(this.http.delete('/api/cart/items/' + encodeURIComponent(id)));
      else if (oldQty) await firstValueFrom(this.http.patch('/api/cart/items/' + encodeURIComponent(id), { quantity: q }));
      else await firstValueFrom(this.http.post('/api/cart/items', { productId: id, quantity: q }));
      await this.refresh();
    });
  }
  add(id: string, qty?: number): Promise<void> {
    const p = this.products.get(id), amount = qty ?? (p ? this.products.step(p) : 1);
    const q = this.qty(id) + amount;
    this.optimistic(id, q);
    return this.enqueue(async () => { await firstValueFrom(this.http.post('/api/cart/items', { productId: id, quantity: amount })); await this.refresh(); });
  }
  /** Tăng / giảm một nấc (0,5 kg hoặc 1 đơn vị) */
  nudge(id: string, dir: 1 | -1): void { const p = this.products.get(id); this.set(id, this.qty(id) + dir * (p ? this.products.step(p) : 1)); }
  setVoucher(code: string): void {
    this.update({ ...this.state(), voucher: code.trim().toUpperCase() });
    this.enqueue(() => this.refreshQuote());
  }
  clear(): void {
    this.update({ items: [], voucher: '' });
    this.enqueue(async () => { await firstValueFrom(this.http.delete('/api/cart')); await this.refresh(); });
  }

  private optimistic(id: string, qty: number): void {
    const items = this.state().items.filter(i => i.id !== id);
    if (qty > 0) items.push({ id, qty });
    this.update({ ...this.state(), items });
  }
  private update(s: { items: CartLine[]; voucher: string }): void {
    this.state.set(s);
    this.bumps.update(n => n + 1);
  }
  private enqueue(work: () => Promise<void>): Promise<void> {
    const seq = ++this.sequence;
    this.queue = this.queue.then(work).catch(async error => {
      this.error.set(this.message(error));
      this.toast.show(this.message(error));
      await this.refresh().catch(() => {});
    }).then(() => { if (seq === this.sequence && !this.error()) this.error.set(''); });
    return this.queue;
  }
  private async refresh(): Promise<void> {
    const response = await firstValueFrom(this.http.get<any>('/api/cart'));
    this.issues.set(response.issues || []);
    const items: CartLine[] = (response.items || []).map((item: any) => ({ id: item.productId, qty: item.quantity }));
    this.update({ ...this.state(), items });
    await this.refreshQuote();
  }
  private async refreshQuote(): Promise<void> {
    const code = this.state().voucher;
    try {
      const quote = await firstValueFrom(this.http.post<any>('/api/checkout/quote', code ? { voucherCode: code } : {}));
      this.quoteState.set(quote);
      this.error.set('');
    } catch (error) {
      this.quoteState.set(null);
      this.error.set(this.message(error));
    }
  }
  private message(error: any): string { return error?.error?.error?.message || 'Không kết nối được máy chủ. Vui lòng thử lại.'; }
}
