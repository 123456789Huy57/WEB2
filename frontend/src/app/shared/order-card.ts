import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService, OrderView, ORDER_STATUS, PAYMENT_LABEL, isPrepaid, STATUS_FLOW } from '../core/order.service';
import { ProductService } from '../core/product.service';
import { VndPipe } from './vnd.pipe';
import { ImgFallbackDirective } from './img-fallback.directive';

/** Một đơn hàng: tóm tắt, mở ra xem chi tiết, tiến trình giao, mua lại / hủy */
@Component({
  selector: 'fm-order-card',
  imports: [DatePipe, RouterLink, VndPipe, ImgFallbackDirective],
  host: { class: 'order' },
  template: `
    <div class="o-top">
      <div><b class="num">{{ o().orderCode }}</b> <span class="muted small num">· {{ o().createdAt | date: 'dd/MM/yyyy HH:mm' }}</span></div>
      <span class="o-st" [class.pending]="o().status === 'pending'" [class.cancel]="o().status === 'cancelled'">{{ status[o().status] }}</span>
    </div>
    @if (o().status !== 'cancelled') {
      <ol class="o-steps" aria-label="Tiến trình đơn hàng">
        @for (s of flow; track s; let i = $index) {
          <li [class.done]="i <= stepIndex()" [attr.aria-current]="i === stepIndex() ? 'step' : null">{{ status[s] }}</li>
        }
      </ol>
    }
    <div class="o-items">
      @for (l of o().lines; track l.p.id) {
        <a class="ph" [routerLink]="['/san-pham', l.p.slug || l.p.id]" [fragment]="o().status === 'delivered' ? 'h-rv' : undefined" [title]="ps.shortName(l.p)"><img [fmImg]="l.p.name" [src]="ps.img(l.p)" [alt]="ps.shortName(l.p)"></a>
      }
    </div>
    @if (open()) {
      <div class="o-detail">
        <ul class="o-lines">
          @for (l of o().lines; track l.p.id) {
            <li><span>{{ ps.shortName(l.p) }} <span class="muted num">× {{ ps.qtyLabel(l.p, l.qty) }}</span></span><span class="num">{{ l.price * l.qty | vnd }}</span></li>
          }
          <li class="muted"><span>Phí giao hàng</span><span class="num">{{ o().shippingFee ? (o().shippingFee | vnd) : 'Miễn phí' }}</span></li>
          @if (o().discount) { <li class="muted"><span>Mã {{ o().voucherCode }}</span><span class="num">−{{ o().discount | vnd }}</span></li> }
        </ul>
        @if (o().status === 'delivered') { <p class="small" style="margin:0 0 8px">Đơn đã giao: bấm vào ảnh sản phẩm để viết đánh giá.</p> }
        @if (o().customer; as c) {
          <p class="small muted">Giao cho {{ c.name }} · {{ c.phone }} · {{ c.address }}@if (c.slot) { · {{ c.slot }} }@if (c.note) { · Ghi chú: {{ c.note }} }</p>
        }
      </div>
    }
    <div class="o-bot">
      <span class="small muted">{{ o().lines.length }} sản phẩm · {{ payLabel[o().paymentMethod] }}{{ prepaid(o().paymentMethod) ? ' · ' + orders.payStatusLabel(o()).toLowerCase() : '' }}@if (prepaid(o().paymentMethod) && o().paymentStatus === 'unpaid' && o().status === 'pending' && o().paymentDueAt) { · giữ hàng đến {{ o().paymentDueAt | date: 'HH:mm' }} }</span>
      <div class="o-act">
        <span class="price num">{{ o().total | vnd }}</span>
        <button class="btn btn-paper btn-sm" type="button" (click)="open.set(!open())" [attr.aria-expanded]="open()">{{ open() ? 'Thu gọn' : 'Chi tiết' }}</button>
        @if (orders.canPay(o())) {
          <button class="btn btn-forest btn-sm" type="button" (click)="pay()">Thanh toán</button>
        }
        @if (orders.canCancel(o())) {
          <button class="btn btn-paper btn-sm" type="button" (click)="cancel.emit(o())">Hủy đơn</button>
        }
        <button class="btn btn-forest btn-sm" type="button" (click)="again.emit(o())">Mua lại</button>
      </div>
    </div>
  `
})
export class OrderCard {
  readonly o = input.required<OrderView>({ alias: 'order' });
  readonly again = output<OrderView>();
  readonly cancel = output<OrderView>();
  protected ps = inject(ProductService);
  protected orders = inject(OrderService);
  protected status = ORDER_STATUS;
  protected payLabel = PAYMENT_LABEL;
  protected prepaid = isPrepaid;
  protected flow = STATUS_FLOW;
  protected open = signal(false);
  protected stepIndex = computed(() => STATUS_FLOW.indexOf(this.o().status));
  protected async pay(): Promise<void> { try { await this.orders.pay(this.o()); } catch { /* lỗi đã hiện ở trang */ } }
}
