import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../core/auth.service';
import { DatePipe } from '@angular/common';
import { OrderService, OrderView, ORDER_STATUS, PAYMENT_LABEL, STATUS_FLOW, isPrepaid } from '../core/order.service';
import { ProductService } from '../core/product.service';
import { ToastService } from '../core/toast.service';
import { ConfirmService } from '../core/confirm.service';
import { OrderStatus } from '../core/models';
import { norm } from '../core/storage';
import { VndPipe } from '../shared/vnd.pipe';

interface RefundPayment { id: string; orderCode: string; txnRef: string; transactionNo?: string; amount: number; paidAt?: string; }

@Component({
  selector: 'fm-admin-orders',
  imports: [DatePipe, VndPipe],
  template: `
    <div class="adm-head"><div><h1 class="h2">Đơn hàng</h1><p>Chuyển trạng thái theo từng bước. Đơn hủy tự trả hàng về kho; khách thấy trạng thái mới ngay trong Tài khoản.</p></div></div>
    @if (refunds().length) {
      <div class="card" style="margin-bottom:16px;padding:16px">
        <h2 class="h4" style="margin:0 0 4px">Cần hoàn tiền <span class="num">({{ refunds().length }})</span></h2>
        <p class="small muted" style="margin:0 0 12px">Khách đã trả tiền online cho đơn đã hủy. Hoàn tiền trên cổng VNPay rồi bấm xác nhận.</p>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Mã đơn</th><th>Mã giao dịch</th><th class="r">Số tiền</th><th>Thời điểm trả</th><th></th></tr></thead>
          <tbody>
            @for (p of refunds(); track p.id) {
              <tr>
                <td class="num"><b>{{ p.orderCode }}</b></td>
                <td class="num">{{ p.transactionNo || p.txnRef }}</td>
                <td class="r num">{{ p.amount | vnd }}</td>
                <td class="num">{{ p.paidAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td class="r"><button class="btn btn-forest btn-sm" type="button" [disabled]="refunding() === p.id" (click)="refund(p)">Đã hoàn tiền</button></td>
              </tr>
            }
          </tbody>
        </table></div>
      </div>
    }
    <div class="toolbar">
      <input class="adm-input" type="search" placeholder="Tìm mã đơn, tên khách, số điện thoại" [value]="query()" (input)="query.set($any($event.target).value)" aria-label="Tìm đơn hàng">
    </div>
    <div class="tabs" style="margin-bottom:16px" role="group" aria-label="Lọc trạng thái">
      @for (t of tabs(); track t.key) {
        <button class="tab" type="button" [attr.aria-pressed]="filter() === t.key" (click)="filter.set(t.key)">{{ t.label }} <span class="num">({{ t.n }})</span></button>
      }
    </div>
    <div class="card"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Mã đơn</th><th>Thời gian</th><th>Khách hàng</th><th class="r">Tổng</th><th>Thanh toán</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>
        @for (o of list(); track o.orderCode) {
          <tr [class.dim]="o.status === 'cancelled'">
            <td class="num"><b>{{ o.orderCode }}</b></td>
            <td class="num">{{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
            <td>{{ o.customer.name }}<br><span class="small muted num">{{ o.customer.phone }}</span></td>
            <td class="r num">{{ o.total | vnd }}</td>
            <td>{{ pay[o.paymentMethod] }}<br><span class="small" [class.muted]="o.paymentStatus !== 'paid'">{{ orders.payStatusLabel(o) }}</span></td>
            <td>
              <select [value]="o.status" (change)="set(o, $any($event.target).value, $any($event.target))" [attr.aria-label]="'Trạng thái đơn ' + o.orderCode">
                @for (s of statusKeys; track s) { <option [value]="s" [selected]="s === o.status">{{ st[s] }}</option> }
              </select>
            </td>
            <td class="r">
              @if (waitingPayment(o) && o.paymentMethod === 'bank') { <button class="btn btn-stone btn-sm" type="button" [disabled]="refunding() === o.id" (click)="confirmPaid(o)">Đã nhận tiền</button> }
              @else if (waitingPayment(o)) { <span class="small muted">Chờ khách thanh toán</span> }
              @else if (next(o); as n) { <button class="btn btn-forest btn-sm" type="button" (click)="set(o, n)">{{ st[n] }}</button> }
              <button class="link-btn" type="button" style="margin-left:10px" (click)="toggle(o.orderCode)">{{ open() === o.orderCode ? 'Ẩn' : 'Chi tiết' }}</button>
            </td>
          </tr>
          @if (open() === o.orderCode) {
            <tr><td colspan="7" style="background:var(--stone)">
              <ul class="o-lines" style="max-width:560px">
                @for (l of o.lines; track l.p.id) { <li><span>{{ ps.shortName(l.p) }} <span class="muted num">× {{ ps.qtyLabel(l.p, l.qty) }}</span></span><span class="num">{{ l.price * l.qty | vnd }}</span></li> }
                <li class="muted"><span>Phí giao</span><span class="num">{{ o.shippingFee | vnd }}</span></li>
                @if (o.discount) { <li class="muted"><span>Mã {{ o.voucherCode }}</span><span class="num">−{{ o.discount | vnd }}</span></li> }
              </ul>
              <p class="small muted">{{ o.customer.address }}@if (o.customer.slot) { · Giờ nhận: {{ o.customer.slot }} }@if (o.customer.note) { · Ghi chú: {{ o.customer.note }} }</p>
            </td></tr>
          }
        } @empty {
          <tr><td colspan="7" class="empty-row">Không có đơn nào khớp bộ lọc.</td></tr>
        }
      </tbody>
    </table></div></div>
  `
})
export class AdminOrders implements OnInit {
  /** /admin/don-hang?q=FM-... (link từ Tổng quan) */
  readonly q = input<string>();
  protected orders = inject(OrderService);
  protected ps = inject(ProductService);
  private toast = inject(ToastService);
  private cf = inject(ConfirmService);
  protected st = ORDER_STATUS;
  protected pay = PAYMENT_LABEL;
  protected statusKeys = [...STATUS_FLOW, 'cancelled'] as OrderStatus[];
  protected filter = signal<'all' | OrderStatus>('all');
  protected query = signal('');
  protected open = signal('');
  protected tabs = computed(() => [{ key: 'all' as const, label: 'Tất cả', n: this.orders.all().length }, ...this.statusKeys.map(k => ({ key: k, label: ORDER_STATUS[k], n: this.orders.all().filter(o => o.status === k).length }))]);
  protected list = computed(() => {
    const k = norm(this.query() || this.q() || '');
    return this.orders.all().filter(o => (this.filter() === 'all' || o.status === this.filter()) && (!k || norm(`${o.orderCode} ${o.customer.name} ${o.customer.phone}`).includes(k)));
  });
  private http = inject(HttpClient);
  protected refunds = signal<RefundPayment[]>([]);
  protected refunding = signal('');
  ngOnInit(): void { void this.loadRefunds(); }
  private async loadRefunds(): Promise<void> {
    try { this.refunds.set((await firstValueFrom(this.http.get<{ items: RefundPayment[] }>('/api/admin/payments/refunds'))).items); }
    catch { /* bảng hoàn tiền không bắt buộc để xem đơn */ }
  }
  protected async refund(p: RefundPayment): Promise<void> {
    if (!(await this.cf.ask('Xác nhận đã hoàn tiền?', `Chỉ xác nhận sau khi đã hoàn ${p.amount.toLocaleString('vi-VN')} đ cho đơn ${p.orderCode} trên cổng thanh toán.`, 'Đã hoàn tiền'))) return;
    this.refunding.set(p.id);
    try {
      await firstValueFrom(this.http.post(`/api/admin/payments/${p.id}/refund`, {}));
      this.toast.show(`Đơn ${p.orderCode}: đã ghi nhận hoàn tiền`);
      await Promise.all([this.loadRefunds(), this.orders.reload()]);
    } catch (error) { this.toast.show(apiMessage(error)); }
    finally { this.refunding.set(''); }
  }
  /** Đơn VNPay chưa trả tiền: không xác nhận/giao được, chỉ chờ khách trả hoặc hủy */
  protected waitingPayment(o: OrderView): boolean { return isPrepaid(o.paymentMethod) && o.paymentStatus === 'unpaid' && o.status === 'pending'; }
  /** Chuyển khoản: SePay tự xác nhận; nút này cho trường hợp SePay báo trễ hoặc khách ghi sai nội dung */
  protected async confirmPaid(o: OrderView): Promise<void> {
    if (!(await this.cf.ask('Đã nhận tiền?', `Chỉ xác nhận sau khi thấy ${o.total.toLocaleString('vi-VN')} đ cho đơn ${o.orderCode} trong app ngân hàng.`, 'Đã nhận tiền'))) return;
    this.refunding.set(o.id);
    try { await this.orders.confirmPayment(o); this.toast.show(`Đơn ${o.orderCode}: đã thanh toán`); }
    catch (error) { this.toast.show(apiMessage(error)); }
    finally { this.refunding.set(''); }
  }
  protected next(o: OrderView): OrderStatus | null { const i = STATUS_FLOW.indexOf(o.status); return i > -1 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null; }
  protected toggle(code: string): void { this.open.set(this.open() === code ? '' : code); }
  protected async set(o: OrderView, s: OrderStatus, el?: HTMLSelectElement): Promise<void> {
    if (el) el.value = o.status; // chỉ đổi khi server xác nhận
    if (s === 'cancelled' && !(await this.cf.ask('Hủy đơn?', `Đơn ${o.orderCode} sẽ bị hủy và hàng được trả lại kho.`, 'Hủy đơn'))) return;
    try { await this.orders.setStatus(o.orderCode, s); this.toast.show(`Đơn ${o.orderCode}: ${ORDER_STATUS[s]}`); }
    catch (error) { this.toast.show(apiMessage(error)); await this.orders.reload(); }
  }
}
