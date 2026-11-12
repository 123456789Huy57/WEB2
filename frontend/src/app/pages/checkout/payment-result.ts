import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../core/order.service';
import { ToastService } from '../../core/toast.service';
import { apiMessage } from '../../core/auth.service';
import { VndPipe } from '../../shared/vnd.pipe';

/** Cổng thanh toán trả khách về đây: /thanh-toan/ket-qua?ok=1&ma=FM-... */
@Component({
  selector: 'fm-payment-result',
  imports: [RouterLink, VndPipe],
  template: `
    <section class="band done">
      <div class="done-in">
        @if (paid()) {
          <h1 class="h2">Thanh toán thành công</h1>
          <p class="lead">FreshMart đã nhận tiền cho đơn {{ ma() }}. Cửa hàng sẽ gọi xác nhận và giao trong khung giờ bạn chọn.</p>
        } @else {
          <h1 class="h2">Chưa thanh toán được</h1>
          <p class="lead">Giao dịch bị hủy hoặc không thành công. Đơn {{ ma() }} vẫn được giữ, bạn thanh toán lại hoặc hủy đơn trong Tài khoản.</p>
        }
        @if (order(); as o) {
          <dl class="done-facts">
            <div><dt>Mã đơn</dt><dd class="num">{{ o.orderCode }}</dd></div>
            <div><dt>Tổng tiền</dt><dd class="num">{{ o.total | vnd }}</dd></div>
            <div><dt>Thanh toán</dt><dd>{{ o.paymentStatus === 'paid' ? 'Đã thanh toán qua VNPay' : 'Chưa thanh toán' }}</dd></div>
          </dl>
        }
        <div class="done-cta">
          @if (!paid() && order(); as o) { <button class="btn btn-forest" type="button" [disabled]="busy()" (click)="retry()">Thanh toán lại</button> }
          <a class="btn" [class.btn-forest]="paid()" [class.btn-stone]="!paid()" routerLink="/tai-khoan">Xem đơn hàng</a>
          <a class="btn btn-stone" routerLink="/san-pham">Tiếp tục mua sắm</a>
        </div>
      </div>
    </section>
  `
})
export class PaymentResult {
  readonly ok = input<string>();
  readonly ma = input<string>();
  private orders = inject(OrderService);
  private toast = inject(ToastService);
  protected busy = signal(false);
  // Tin trạng thái đơn từ server hơn là tham số trên đường dẫn.
  protected order = computed(() => (this.ma() ? this.orders.lookup(this.ma()!) : undefined));
  protected paid = computed(() => this.order() ? this.order()!.paymentStatus === 'paid' : this.ok() === '1');
  constructor() { void this.orders.reload(); }
  protected async retry(): Promise<void> {
    const o = this.order(); if (!o) return;
    this.busy.set(true);
    try { await this.orders.pay(o); } catch (error) { this.toast.show(apiMessage(error)); this.busy.set(false); }
  }
}
