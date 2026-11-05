import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ProductService } from './product.service';
import { DataService } from './data.service';
import { CheckoutInfo, Order, OrderStatus, Product, User } from './models';

export const ORDER_STATUS: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang soạn hàng', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy'
};
export const STATUS_FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered'];
export const PAYMENT_LABEL = { cod: 'Tiền mặt khi nhận' } as const;
export interface OrderView extends Order { lines: { p: Product; qty: number; price: number }[]; }
type ApiOrder = any;

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private products = inject(ProductService);
  private data = inject(DataService);
  private orders = signal<Order[]>([]);
  readonly all = computed(() => this.orders().map(o => this.view(o)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  readonly error = signal('');

  async load(admin = false): Promise<void> {
    try {
      const endpoint = admin ? '/api/admin/orders' : '/api/users/me/orders';
      const first = await firstValueFrom(this.http.get<{ items: ApiOrder[]; total: number; pageSize: number }>(endpoint + '?page=1&pageSize=100'));
      const items = [...first.items];
      for (let page = 2; items.length < first.total; page++) {
        const next = await firstValueFrom(this.http.get<{ items: ApiOrder[] }>(endpoint + '?page=' + page + '&pageSize=100'));
        if (!next.items.length) break;
        items.push(...next.items);
      }
      this.orders.set(items.map(x => this.fromApi(x)));
      this.error.set('');
    } catch (error: any) {
      this.orders.set([]);
      this.error.set(error?.error?.error?.message || 'Không tải được danh sách đơn hàng.');
    }
  }
  forUser(user: User | null): OrderView[] { return user ? this.all().filter(o => o.userId === user.id) : []; }
  hasOrdered(user: User | null): boolean { return this.forUser(user).some(o => o.status !== 'cancelled'); }
  byCode(code: string): OrderView | undefined { return this.all().find(o => o.orderCode === code); }
  lookup(_code: string, _phone: string): OrderView | undefined { return undefined; }

  async place(info: CheckoutInfo, voucherCode?: string): Promise<Order> {
    const body = { customer: { name: info.name, phone: info.phone, email: info.email, address: info.address, note: info.note, slot: info.slot }, paymentMethod: info.payment as 'cod', ...(voucherCode ? { voucherCode } : {}) };
    const canonical = JSON.stringify(body);
    if (!this.pending || this.pending.body !== canonical) this.pending = { body: canonical, key: crypto.randomUUID() };
    try {
      const order = await firstValueFrom(this.http.post<ApiOrder>('/api/orders', body, { headers: { 'Idempotency-Key': this.pending.key } }));
      this.pending = null;
      await this.load(false);
      await this.data.load(false);
      return this.fromApi(order);
    } catch (error) { throw error; }
  }
  private pending: { body: string; key: string } | null = null;
  async cancelOrder(order: Order): Promise<void> {
    const updated = await firstValueFrom(this.http.post<ApiOrder>('/api/users/me/orders/' + encodeURIComponent(order.id) + '/cancel', {}));
    this.replace(updated);
    await this.data.load(false);
  }
  async setStatus(order: Order, status: OrderStatus): Promise<void> {
    const updated = await firstValueFrom(this.http.patch<ApiOrder>('/api/admin/orders/' + encodeURIComponent(order.id) + '/status', { status, expectedStatus: order.status }));
    this.replace(updated);
    await this.data.load(true);
  }
  canCancel(order: Order): boolean { return order.status === 'pending' || order.status === 'confirmed'; }

  private replace(api: ApiOrder): void {
    const value = this.fromApi(api);
    this.orders.update(items => [value, ...items.filter(x => x.id !== value.id)]);
  }
  private fromApi(o: ApiOrder): Order {
    return {
      id: o.id, orderCode: o.orderCode, createdAt: o.createdAt, updatedAt: o.updatedAt, status: o.status,
      userId: o.userId, items: (o.items || []).map((i: any) => ({ id: i.productId, qty: i.quantity, price: i.unitPriceSnapshot, productNameSnapshot: i.productNameSnapshot, unitSnapshot: i.unitSnapshot, lineTotal: i.lineTotal })),
      subtotal: o.subtotal, total: o.total, shippingFee: o.shippingFee, discount: o.discount,
      voucherCode: o.voucherCode || undefined, paymentMethod: o.paymentMethod,
      customer: { ...o.customer, payment: o.paymentMethod, slot: o.customer?.slot || '' }
    };
  }
  private view(o: Order): OrderView {
    const lines = o.items.map(i => {
      const found = this.products.get(i.id);
      const p = found || ({ id: i.id, slug: i.id, name: i.productNameSnapshot || 'Sản phẩm đã ẩn', brand: '', category: '', categoryName: '', description: '', price: i.price, sale_price: 0, unit: i.unitSnapshot || 'cái', stock: 0, sold_count: 0, image_url: '', gallery: [], active: false } as Product);
      return { p, qty: i.qty, price: i.price };
    });
    return { ...o, lines };
  }
}
