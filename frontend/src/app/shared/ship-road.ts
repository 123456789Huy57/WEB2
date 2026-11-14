import { Component, computed, input } from '@angular/core';
import { FREE_SHIP_FROM } from '../core/cart.service';
import { VndPipe } from './vnd.pipe';

/** Tiến độ miễn phí giao hàng, vẽ như khu "Giao trước bữa tối" ở trang chủ:
 *  xe FreshMart chạy trên đoạn đường nhựa, càng gần cột "Miễn phí" khi tiền hàng càng gần 300.000 đ.
 *  Dùng ở trang Giỏ hàng (cỡ lớn) và giỏ trượt (compact). */
@Component({
  selector: 'fm-ship-road',
  imports: [VndPipe],
  host: { class: 'road-box', '[class.compact]': 'compact()', '[class.done]': 'need() <= 0' },
  template: `
    <p class="road-msg" aria-live="polite">
      @if (need() > 0) { Mua thêm <b class="num">{{ need() | vnd }}</b> để được miễn phí giao hàng. }
      @else { <b>Đơn của bạn được miễn phí giao hàng.</b> }
    </p>
    <div class="road" aria-hidden="true">
      <img class="road-truck" src="/img/cut/xe-freshmart.webp" alt="" [style.--p]="pct() / 100">
      <span class="road-flag"><span>Miễn phí</span></span>
      <span class="road-asphalt"></span>
    </div>
  `
})
export class ShipRoad {
  /** Tiền hàng hiện tại */
  readonly sub = input.required<number>();
  readonly compact = input(false);
  protected need = computed(() => FREE_SHIP_FROM - this.sub());
  protected pct = computed(() => Math.max(0, Math.min(100, (this.sub() / FREE_SHIP_FROM) * 100)));
}
