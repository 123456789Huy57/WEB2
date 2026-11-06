import { Injectable, computed, inject, signal } from '@angular/core';
import { DataService } from './data.service';
import { ProductService } from './product.service';
import { CheckoutInfo, Order, OrderStatus, Product, User } from './models';
import { store } from './storage';

export const ORDER_STATUS: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang soạn hàng', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy'
};
/** Thứ tự trạng thái để admin chuyển bước tiếp theo */
export const STATUS_FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered'];
export const PAYMENT_LABEL = { cod: 'Tiền mặt khi nhận', bank: 'Chuyển khoản', momo: 'Ví MoMo' } as const;

export interface OrderView extends Order { lines: { p: Product; qty: number; price: number }[]; subtotal: number; total: number; }

@Injectable({ providedIn: 'root' })
export class OrderService {
  private data = inject(DataService);
  private products = inject(ProductService);
  private orders = signal<Order[]>(store.get<Order[] | null>('orders', null) ?? seed());

  /** Tất cả đơn, mới nhất trước (admin) */
  readonly all = computed(() => this.orders().map(o => this.view(o)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

  /** Đơn của một tài khoản */
  forUser(u: User | null): OrderView[] { return u ? this.all().filter(o => o.userId === u.id) : []; }
  /** Đã có đơn (không tính đơn hủy) chưa — dùng cho mã "đơn đầu tiên" */
  hasOrdered(u: User | null): boolean { return this.forUser(u).some(o => o.status !== 'cancelled'); }
  /** Khách vãng lai tra cứu: phải khớp cả mã đơn và số điện thoại */
  lookup(code: string, phone: string): OrderView | undefined {
    const c = code.trim().toUpperCase(), ph = phone.replace(/\s/g, '');
    return this.all().find(o => o.orderCode === c && o.customer?.phone.replace(/\s/g, '') === ph);
  }
  byCode(code: string): OrderView | undefined { return this.all().find(o => o.orderCode === code); }

  place(info: CheckoutInfo, items: { id: string; qty: number }[], totals: { ship: number; disc: number; voucherCode?: string }, user: User | null): Order {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    let code: string;
    do { code = `FM-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${100 + Math.floor(Math.random() * 900)}`; } while (this.byCode(code));
    const order: Order = {
      orderCode: code, createdAt: d.toISOString(), status: 'pending', userId: user?.id,
      items: items.map(i => ({ id: i.id, qty: i.qty, price: this.products.price(this.products.get(i.id)!) })),
      shippingFee: totals.ship, discount: totals.disc, voucherCode: totals.voucherCode, paymentMethod: info.payment, customer: info
    };
    // Trừ tồn kho ngay khi đặt (backend: làm trong cùng transaction với tạo đơn)
    order.items.forEach(i => this.data.adjustStock(i.id, -i.qty));
    this.save([order, ...this.orders()]);
    return order;
  }

  setStatus(code: string, status: OrderStatus): void {
    const o = this.orders().find(x => x.orderCode === code);
    if (!o || o.status === status) return;
    // Hủy đơn thì trả hàng về kho; mở lại đơn đã hủy thì trừ lại
    if (status === 'cancelled') o.items.forEach(i => this.data.adjustStock(i.id, i.qty));
    if (o.status === 'cancelled') o.items.forEach(i => this.data.adjustStock(i.id, -i.qty));
    this.save(this.orders().map(x => (x.orderCode === code ? { ...x, status, updatedAt: new Date().toISOString() } : x)));
  }
  /** Khách chỉ hủy được khi cửa hàng chưa bắt đầu soạn hàng */
  canCancel(o: Order): boolean { return o.status === 'pending' || o.status === 'confirmed'; }

  private view(o: Order): OrderView {
    const lines = o.items.map(i => ({ p: this.products.get(i.id)!, qty: i.qty, price: i.price })).filter(l => !!l.p);
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    return { ...o, lines, subtotal, total: Math.max(0, subtotal + o.shippingFee - o.discount) };
  }
  private save(list: Order[]): void { this.orders.set(list); store.set('orders', list); }
}

/** Đơn mẫu trong 12 ngày gần nhất để trang Tài khoản và Admin có số liệu khi chạy thử */
function seed(): Order[] {
  const people = [
    { userId: 'u-001', name: 'Nguyễn Văn A', phone: '0900000001', address: '63 Đường Số 1, P. Tân Hưng, Quận 7' },
    { userId: 'u-002', name: 'Lê Thị B', phone: '0900000002', address: '456 Võ Văn Tần, Quận 3' },
    { userId: 'u-003', name: 'Phạm Văn C', phone: '0900000003', address: '75 Phan Xích Long, Phú Nhuận' },
    { userId: undefined, name: 'Trần Minh Khoa', phone: '0912345678', address: '210 Trần Hưng Đạo, Quận 5' }
  ];
  const baskets: [string, number, number][][] = [
    [['p-0053', 1, 37500], ['p-0004', 2, 7000], ['p-0023', 2, 9000]],
    [['p-0042', 1, 63600], ['p-0071', 2, 28000], ['p-0160', 1, 56000]],
    [['p-0025', 2, 35000], ['p-0021', 1, 55000]],
    [['p-0132', 1, 473000], ['p-0071', 1, 28000], ['p-0015', 1.5, 15000]],
    [['p-0020', 1, 21000], ['p-0013', 3, 9000], ['p-0026', 1, 14500], ['p-0004', 1, 7000]],
    [['p-0200', 1, 133000], ['p-0155', 4, 11000]]
  ];
  const status: Order['status'][] = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'delivered', 'delivered', 'cancelled', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered'];
  const pay: Order['paymentMethod'][] = ['cod', 'momo', 'bank', 'cod'];
  const now = Date.now();
  return status.map((st, i) => {
    const who = people[i % people.length], b = baskets[(i * 5) % baskets.length];
    const t = new Date(now - (i * 0.85 + 0.05) * 86400000 - (i % 3) * 3600000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const sub = b.reduce((s, [, q, p]) => s + q * p, 0);
    const ship = sub >= 300000 ? 0 : 20000;
    return {
      orderCode: `FM-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${String(101 + i * 37).slice(-3)}`,
      createdAt: t.toISOString(), status: st, userId: who.userId,
      items: b.map(([id, qty, price]) => ({ id, qty, price })),
      shippingFee: ship, discount: i === 1 ? 30000 : 0, voucherCode: i === 1 ? 'SAVE30K' : undefined, paymentMethod: pay[i % pay.length],
      customer: { name: who.name, phone: who.phone, email: '', address: who.address, note: '', slot: 'Hôm nay 16:00–18:00', payment: pay[i % pay.length] }
    };
  });
}
