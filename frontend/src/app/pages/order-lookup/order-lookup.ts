import { Component, ViewEncapsulation, effect, inject, input, signal } from '@angular/core';
import { apiMessage } from '../../core/auth.service';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrderService, OrderView } from '../../core/order.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';
import { OrderCard } from '../../shared/order-card';

/** Khách đặt hàng không cần tài khoản vẫn theo dõi được đơn bằng mã đơn + số điện thoại */
@Component({
  selector: 'fm-order-lookup',
  imports: [FormsModule, RouterLink, OrderCard],
  encapsulation: ViewEncapsulation.None,
  styles: `
    .lk { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: 56px; align-items: start; }
    .lk form { display: flex; flex-direction: column; gap: 16px; }
    .lk .err { color: var(--sale); min-height: 20px; }
    @media (max-width: 860px) { .lk { grid-template-columns: 1fr; gap: 32px; } }
  `,
  template: `
    <section class="page-head band">
      <h1 class="h2">Tra cứu đơn hàng</h1>
      <p>Nhập mã đơn (dạng FM-20261105-AB12CD34) để xem nhanh một đơn trong tài khoản. Xem tất cả đơn ở <a class="link" routerLink="/tai-khoan">Tài khoản</a>.</p>
    </section>
    <section class="band lk">
      <form (ngSubmit)="find()">
        <div class="field"><label for="lk-code">Mã đơn hàng</label><input id="lk-code" name="code" autocomplete="off" [(ngModel)]="code" placeholder="FM-20261105-AB12CD34"></div>
        <div class="field"><label for="lk-phone">Số điện thoại</label><input id="lk-phone" name="phone" type="tel" inputmode="tel" [(ngModel)]="phone"></div>
        <p class="err small" aria-live="polite">{{ err() }}</p>
        <button class="btn btn-forest" type="submit">Tra cứu</button>
      </form>
      <div>
        @if (found(); as o) {
          <fm-order-card [order]="o" (again)="again($event)" (cancel)="cancel($event)" />
        }
      </div>
    </section>
  `
})
export class OrderLookup {
  readonly ma = input<string>();
  readonly sdt = input<string>();
  private orders = inject(OrderService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private cf = inject(ConfirmService);
  protected code = '';
  protected phone = '';
  protected err = signal('');
  private foundCode = signal('');
  protected found = () => (this.foundCode() ? this.orders.byCode(this.foundCode()) : undefined);

  constructor() {
    effect(() => { if (this.ma() && this.sdt()) { this.code = this.ma()!; this.phone = this.sdt()!; this.find(); } });
  }
  protected find(): void {
    const o = this.orders.lookup(this.code);
    this.err.set(o ? '' : 'Không tìm thấy đơn này trong tài khoản của bạn. Kiểm tra lại mã đơn giúp mình nhé.');
    this.foundCode.set(o?.orderCode ?? '');
  }
  protected async again(o: OrderView): Promise<void> {
    try { const skipped = await this.orders.reorder(o); this.toast.show(skipped.length ? `Đã thêm ${o.lines.length - skipped.length}/${o.lines.length} sản phẩm` : `Đã thêm sản phẩm của đơn ${o.orderCode} vào giỏ`); }
    catch (error) { this.toast.show(apiMessage(error)); }
  }
  protected async cancel(o: OrderView): Promise<void> {
    if (!(await this.cf.ask('Hủy đơn hàng?', `Đơn ${o.orderCode} sẽ bị hủy và hàng được trả lại kho.`, 'Hủy đơn'))) return;
    try { await this.orders.cancel(o); this.toast.show(`Đã hủy đơn ${o.orderCode}`); }
    catch (error) { this.toast.show(apiMessage(error)); }
  }
}
