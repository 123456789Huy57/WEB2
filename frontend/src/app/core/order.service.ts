import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProductService } from './product.service';
import { AuthService } from './auth.service';
import { CartService } from './cart.service';
import { CheckoutInfo, Order, OrderStatus, Product, User } from './models';

export const ORDER_STATUS: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang soạn hàng', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy'
};
/** Thứ tự trạng thái để admin chuyển bước tiếp theo */
export const STATUS_FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered'];
export const PAYMENT_LABEL = { cod: 'Tiền mặt khi nhận', vnpay: 'VNPay', bank: 'Chuyển khoản QR' } as const;
/** Trả trước: giữ hàng có hạn, chưa trả thì cửa hàng chưa xử lý đơn */
export const isPrepaid = (m: string) => m === 'vnpay' || m === 'bank';
/** Thông tin chuyển khoản cho một đơn (mã QR đã điền sẵn số tiền và nội dung) */
export interface BankInstructions { qrUrl: string; bankCode: string; account: string; holder: string; amount: number; content: string; dueAt?: string; }

/** Đơn kèm các dòng dựng từ bản chụp lúc đặt (giá/tên không đổi theo catalog hiện tại) */
export interface OrderView extends Order { lines: { p: Product; qty: number; price: number }[]; }
type Page<T> = { items: T[]; page: number; pageSize: number; total: number };

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private products = inject(ProductService);
  private auth = inject(AuthService);
  private cart = inject(CartService);
  private router = inject(Router);
  /** Cửa hàng có bật chuyển khoản QR không (backend chỉ bật khi đã cấu hình SePay) */
  readonly bankEnabled = signal(false);
  private mineRaw = signal<Order[]>([]);
  private adminRaw = signal<Order[]>([]);
  readonly loading = signal(false);
  /** Khóa đặt đơn của lần bấm hiện tại: bấm lại / mạng chập chờn gửi lại vẫn chỉ tạo một đơn */
  private pendingKey: string | null = null;

  /** Admin: tất cả đơn gần nhất; khách: đơn của mình. Mới nhất trước. */
  readonly all = computed(() => (this.auth.isAdmin() ? this.adminRaw() : this.mineRaw()).map(o => this.view(o)));
  readonly mine = computed(() => this.mineRaw().map(o => this.view(o)));

  constructor() {
    effect(() => { const u = this.auth.user(); untracked(() => void this.reload(u)); });
    this.http.get<{ bank: boolean }>('/api/payments/methods').subscribe({ next: m => this.bankEnabled.set(m.bank), error: () => {} });
  }

  async reload(u: User | null = this.auth.user()): Promise<void> {
    if (!u) { this.mineRaw.set([]); this.adminRaw.set([]); return; }
    this.loading.set(true);
    try {
      const [mine, admin] = await Promise.all([
        firstValueFrom(this.http.get<Page<Order>>('/api/users/me/orders?pageSize=100')),
        u.role === 'admin' ? firstValueFrom(this.http.get<Page<Order>>('/api/admin/orders?pageSize=100')) : Promise.resolve(null)
      ]);
      this.mineRaw.set(mine.items);
      if (admin) this.adminRaw.set(admin.items);
    } finally { this.loading.set(false); }
  }

  /** Đơn của một tài khoản */
  forUser(u: User | null): OrderView[] { return u ? this.mine() : []; }
  /** Đã có đơn (không tính đơn hủy) chưa — dùng cho mã "đơn đầu tiên" */
  hasOrdered(u: User | null): boolean { return this.forUser(u).some(o => o.status !== 'cancelled'); }
  /** Tìm trong đơn của tài khoản đang đăng nhập */
  lookup(code: string): OrderView | undefined { const c = code.trim().toUpperCase(); return this.mine().find(o => o.orderCode === c); }
  byCode(code: string): OrderView | undefined { return this.all().find(o => o.orderCode === code) ?? this.mine().find(o => o.orderCode === code); }

  /** Đặt đơn COD. Server đọc giỏ trong session, tính tiền, trừ kho; trả về đơn đã tạo. */
  async place(info: CheckoutInfo, voucherCode: string): Promise<Order> {
    this.pendingKey ??= crypto.randomUUID();
    const body = {
      customer: { name: info.name, phone: info.phone, email: info.email, address: info.address, note: info.note, slot: info.slot },
      paymentMethod: info.payment, voucherCode: voucherCode || null
    };
    const order = await firstValueFrom(this.http.post<Order>('/api/orders', body, { headers: { 'Idempotency-Key': this.pendingKey } }));
    this.pendingKey = null;
    this.mineRaw.update(list => [order, ...list.filter(o => o.id !== order.id)]);
    await this.cart.afterOrder();
    return order;
  }
  /** Bỏ khóa khi khách sửa thông tin đơn (lần bấm sau là một yêu cầu mới) */
  resetAttempt(): void { this.pendingKey = null; }

  /** Admin chuyển trạng thái. Gửi kèm trạng thái đang thấy để không ghi đè thay đổi của người khác. */
  async setStatus(code: string, status: OrderStatus): Promise<void> {
    const o = this.byCode(code);
    if (!o || o.status === status) return;
    const updated = await firstValueFrom(this.http.patch<Order>(`/api/admin/orders/${o.id}/status`, { status, expectedStatus: o.status }));
    this.replace(updated);
  }
  /** Khách chỉ hủy được khi cửa hàng chưa bắt đầu soạn hàng, và đơn chưa thanh toán online */
  canCancel(o: Order): boolean { return (o.status === 'pending' || o.status === 'confirmed') && o.paymentStatus === 'unpaid'; }
  /** Đơn VNPay chưa thanh toán và còn trong thời gian giữ hàng: còn thanh toán tiếp được */
  canPay(o: Order): boolean {
    return isPrepaid(o.paymentMethod) && o.paymentStatus === 'unpaid' && o.status === 'pending' && (!o.paymentDueAt || Date.parse(o.paymentDueAt) > Date.now());
  }
  /** Nhãn trạng thái thanh toán dùng chung cho khách và admin */
  payStatusLabel(o: Pick<Order, 'paymentMethod' | 'paymentStatus' | 'status'>): string {
    if (o.paymentStatus === 'refunded') return 'Đã hoàn tiền';
    if (o.paymentStatus === 'paid') return o.status === 'cancelled' ? 'Đã thanh toán, chờ hoàn tiền' : 'Đã thanh toán';
    return isPrepaid(o.paymentMethod) && o.status === 'pending' ? 'Chờ thanh toán' : 'Chưa thanh toán';
  }
  /** Tạo giao dịch rồi chuyển trình duyệt sang cổng thanh toán */
  async pay(o: Pick<Order, 'id' | 'orderCode' | 'paymentMethod'>): Promise<void> {
    if (o.paymentMethod === 'bank') { await this.router.navigate(['/thanh-toan/chuyen-khoan'], { queryParams: { ma: o.orderCode } }); return; }
    const r = await firstValueFrom(this.http.post<{ payUrl: string }>(`/api/users/me/orders/${o.id}/payments`, {}));
    window.location.href = r.payUrl;
  }
  /** Mã QR và thông tin chuyển khoản của đơn */
  bankInstructions(o: Pick<Order, 'id'>): Promise<BankInstructions> {
    return firstValueFrom(this.http.post<BankInstructions>(`/api/users/me/orders/${o.id}/payments`, {}));
  }
  /** Admin xác nhận tay đã nhận tiền chuyển khoản */
  async confirmPayment(o: Pick<Order, 'id'>): Promise<void> {
    await firstValueFrom(this.http.post(`/api/admin/orders/${o.id}/confirm-payment`, {}));
    await this.reload();
  }
  async cancel(o: Order): Promise<void> {
    this.replace(await firstValueFrom(this.http.post<Order>(`/api/users/me/orders/${o.id}/cancel`, {})));
  }
  /** Mua lại: server thêm món còn bán vào giỏ theo giá mới; trả về các món không thêm được */
  async reorder(o: Order): Promise<{ productId: string; name: string; code: string }[]> {
    const r = await firstValueFrom(this.http.post<{ skipped: { productId: string; name: string; code: string }[] }>(`/api/users/me/orders/${o.id}/reorder`, {}));
    await this.cart.load();
    return r.skipped;
  }

  private replace(o: Order): void {
    const swap = (list: Order[]) => list.map(x => x.id === o.id ? o : x);
    this.mineRaw.update(swap); this.adminRaw.update(swap);
  }
  private view(o: Order): OrderView {
    return {
      ...o,
      lines: o.items.map(i => ({
        p: this.products.get(i.productId) ?? {
          id: i.productId, slug: '', name: i.productNameSnapshot, unit: i.unitSnapshot, image_url: i.image_url ?? '', stock: 0,
          price: i.unitPriceSnapshot, sale_price: 0, category: '', categoryName: '', description: '', sold_count: 0, gallery: []
        },
        qty: i.quantity, price: i.unitPriceSnapshot
      }))
    };
  }
}
