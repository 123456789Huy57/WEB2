import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProductService } from './product.service';
import { VoucherService } from './voucher.service';
import { AuthService, apiMessage } from './auth.service';
import { ToastService } from './toast.service';
import { Product, ServerCart } from './models';
import { store } from './storage';

export const FREE_SHIP_FROM = 300000;
export const SHIP_FEE = 20000;

/**
 * Giỏ hàng lưu ở server (session), mọi con số do server tính (backend-contract mục 4).
 * Các lệnh gửi lên được xếp hàng tuần tự: hai thao tác liền nhau không ghi đè giỏ của nhau.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private products = inject(ProductService);
  private vouchers = inject(VoucherService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private server = signal<ServerCart | null>(null);
  private voucher = signal<string>(store.get('voucher', ''));
  private quoted = signal<{ cart: ServerCart | null; msg: string }>({ cart: null, msg: '' });
  private queue: Promise<unknown> = Promise.resolve();

  /** Tăng mỗi lần giỏ thay đổi để header chạy hiệu ứng nảy số */
  readonly bumps = signal(0);
  /** Sản phẩm trong giỏ vừa hết hàng / ngừng bán / sai số lượng: khách cần sửa trước khi đặt */
  readonly issues = computed(() => this.server()?.issues ?? []);
  readonly lines = computed(() => (this.server()?.items ?? []).map(i => ({ p: this.products.get(i.productId) ?? fallback(i), qty: i.quantity })));
  readonly count = computed(() => this.lines().length);
  readonly voucherCode = this.voucher.asReadonly();
  readonly subtotal = computed(() => this.server()?.subtotal ?? 0);
  readonly totals = computed(() => {
    const q = this.quoted();
    const base = this.voucher() && q.cart ? q.cart : this.server();
    const code = q.cart?.voucherCode;
    return {
      sub: base?.subtotal ?? 0, ship: base?.shippingFee ?? 0, disc: base?.discount ?? 0, total: base?.total ?? 0,
      voucher: code ? (this.vouchers.find(code) ?? { code, title: code }) : undefined,
      voucherMsg: this.voucher() ? q.msg : ''
    };
  });

  constructor() {
    // Đăng nhập/đăng xuất đổi session nên tải lại giỏ từ server.
    effect(() => { this.auth.user(); untracked(() => void this.load()); });
  }

  qty(id: string): number { return this.server()?.items.find(i => i.productId === id)?.quantity ?? 0; }

  load(): Promise<void> { return this.run(() => this.http.get<ServerCart>('/api/cart'), false); }

  /** Đặt số lượng tuyệt đối; 0 là bỏ khỏi giỏ. Tự giới hạn theo tồn kho và bước mua. */
  set(id: string, qty: number): Promise<void> {
    const p = this.products.get(id);
    const q = this.fit(p, qty);
    const current = this.qty(id);
    if (p && qty > current && q <= current) { this.toast.show(`Chỉ còn ${this.products.qtyLabel(p, p.stock)} ${this.products.shortName(p)}`); return Promise.resolve(); }
    if (q === current) return Promise.resolve();
    if (!q) return this.run(() => this.http.delete<ServerCart>(`/api/cart/items/${id}`));
    if (!current) return this.run(() => this.http.post<ServerCart>('/api/cart/items', { productId: id, quantity: q }));
    return this.run(() => this.http.patch<ServerCart>(`/api/cart/items/${id}`, { quantity: q }));
  }

  /** Cộng thêm vào giỏ (server cộng dồn). Mặc định một nấc: 0,5 kg hoặc 1 đơn vị. */
  add(id: string, qty?: number): Promise<void> {
    const p = this.products.get(id);
    const step = p ? this.products.step(p) : 1;
    const room = p ? this.fit(p, p.stock) - this.qty(id) : Infinity;
    const amount = Math.min(this.fit(p, qty ?? step), room);
    if (amount <= 0) { if (p) this.toast.show(`Đã đủ số lượng còn trong kho cho ${this.products.shortName(p)}`); return Promise.resolve(); }
    return this.run(() => this.http.post<ServerCart>('/api/cart/items', { productId: id, quantity: amount }));
  }

  /** Thêm nhiều món một lượt (Meal Planner, mua lại): gửi tuần tự, món nào lỗi thì bỏ qua và báo lại. */
  async addMany(items: { id: string; qty: number }[]): Promise<number> {
    let added = 0;
    for (const i of items) { const before = this.qty(i.id); await this.add(i.id, i.qty); if (this.qty(i.id) > before) added++; }
    return added;
  }

  /** Tăng / giảm một nấc */
  nudge(id: string, dir: 1 | -1): Promise<void> {
    const p = this.products.get(id);
    const step = p ? this.products.step(p) : 1;
    return dir > 0 ? this.add(id, step) : this.set(id, this.qty(id) - step);
  }

  setVoucher(code: string): void {
    const c = code.trim().toUpperCase();
    this.voucher.set(c); store.set('voucher', c);
    void this.requote();
  }

  clear(): Promise<void> { return this.run(() => this.http.delete<ServerCart>('/api/cart')); }

  /** Gọi sau khi đặt đơn: server đã bỏ phần vừa mua khỏi giỏ */
  afterOrder(): Promise<void> { this.setVoucher(''); return this.load(); }

  private fit(p: Product | undefined, qty: number): number {
    if (!p) return Math.max(0, qty);
    const step = this.products.step(p);
    return Math.max(0, Math.floor(Math.min(qty, p.stock) / step + 1e-9) * step);
  }

  private run(call: () => import('rxjs').Observable<ServerCart>, bump = true): Promise<void> {
    const job = this.queue.then(async () => {
      try {
        this.server.set(await firstValueFrom(call()));
        if (bump) this.bumps.update(n => n + 1);
      } catch (error) {
        this.toast.show(apiMessage(error));
        if (bump) this.server.set(await firstValueFrom(this.http.get<ServerCart>('/api/cart')).catch(() => this.server()));
      }
      await this.requote();
    });
    this.queue = job;
    return job;
  }

  private async requote(): Promise<void> {
    if (!this.voucher() || !this.server()?.items.length) { this.quoted.set({ cart: null, msg: '' }); return; }
    try {
      const cart = await firstValueFrom(this.http.post<ServerCart>('/api/checkout/quote', { voucherCode: this.voucher() }));
      this.quoted.set({ cart, msg: '' });
    } catch (error) { this.quoted.set({ cart: null, msg: apiMessage(error) }); }
  }
}

/** Sản phẩm chưa có trong danh sách đã tải (ví dụ vừa bị ẩn): dựng tạm từ dữ liệu giỏ server trả về */
function fallback(i: ServerCart['items'][number]): Product {
  return {
    id: i.productId, slug: i.product.slug ?? '', name: i.product.name, unit: i.product.unit, image_url: i.product.image_url ?? '',
    stock: i.product.stock ?? 0, price: i.unitPrice, sale_price: 0, category: '', categoryName: '', description: '', sold_count: 0, gallery: []
  };
}
