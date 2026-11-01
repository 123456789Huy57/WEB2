import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { CartService, FREE_SHIP_FROM } from '../core/cart.service';
import { ProductService } from '../core/product.service';
import { UiService } from '../core/ui.service';
import { VndPipe } from './vnd.pipe';
import { ImgFallbackDirective } from './img-fallback.directive';

/** Giỏ hàng xem nhanh: mở từ biểu tượng giỏ ở header, không rời trang đang xem */
@Component({
  selector: 'fm-cart-drawer',
  imports: [RouterLink, VndPipe, ImgFallbackDirective],
  template: `
    <dialog class="drawer" #dlg aria-labelledby="dr-title" (close)="ui.closeCart()" (click)="$event.target === dlg && dlg.close()">
      <div class="dr-head">
        <h2 class="h3" id="dr-title">Giỏ hàng @if (cart.count()) { <span class="muted small num">· {{ cart.count() }} sản phẩm</span> }</h2>
        <button class="btn btn-stone round" type="button" aria-label="Đóng giỏ hàng" (click)="dlg.close()">×</button>
      </div>
      @if (cart.lines().length) {
        <div class="dr-ship">
          @if (need() > 0) { Mua thêm <b class="num">{{ need() | vnd }}</b> để được miễn phí giao hàng. }
          @else { <b>Đơn của bạn được miễn phí giao hàng.</b> }
          <span class="ship-bar" aria-hidden="true"><i [style.width.%]="pct()"></i></span>
        </div>
        <ul class="dr-lines">
          @for (l of cart.lines(); track l.p.id) {
            <li>
              <a class="ph" [routerLink]="['/san-pham', l.p.id]"><img [fmImg]="l.p.name" [src]="ps.img(l.p)" alt=""></a>
              <div>
                <a class="nm" [routerLink]="['/san-pham', l.p.id]">{{ ps.shortName(l.p) }}</a>
                <div class="qty">
                  <button type="button" (click)="cart.nudge(l.p.id, -1)" [attr.aria-label]="'Bớt ' + ps.shortName(l.p)">−</button>
                  <span class="num">{{ ps.qtyLabel(l.p, l.qty) }}</span>
                  <button type="button" (click)="cart.nudge(l.p.id, 1)" [attr.aria-label]="'Thêm ' + ps.shortName(l.p)">+</button>
                </div>
              </div>
              <span class="num">{{ ps.price(l.p) * l.qty | vnd }}</span>
            </li>
          }
        </ul>
        <div class="dr-foot">
          <div class="row"><span>Tạm tính</span><b class="num">{{ cart.subtotal() | vnd }}</b></div>
          <p class="small muted">Phí giao và mã giảm giá tính ở bước thanh toán.</p>
          <a class="btn btn-forest" routerLink="/thanh-toan">Thanh toán</a>
          <a class="btn btn-paper" routerLink="/gio-hang">Xem giỏ hàng</a>
        </div>
      } @else {
        <div class="dr-empty">
          <p class="h3">Giỏ hàng đang trống.</p>
          <p class="muted">Ghé bảng giá sáng nay hoặc mở Meal Planner để biết hôm nay nấu gì.</p>
          <a class="btn btn-forest" routerLink="/san-pham">Đi chợ ngay</a>
        </div>
      }
    </dialog>
  `
})
export class CartDrawer {
  protected cart = inject(CartService);
  protected ps = inject(ProductService);
  protected ui = inject(UiService);
  private dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected need = computed(() => FREE_SHIP_FROM - this.cart.subtotal());
  protected pct = computed(() => Math.min(100, (this.cart.subtotal() / FREE_SHIP_FROM) * 100));

  constructor() {
    effect(() => {
      const d = this.dlg().nativeElement;
      if (this.ui.cartOpen() && !d.open) d.showModal();
      if (!this.ui.cartOpen() && d.open) d.close();
    });
    // Bấm link trong ngăn giỏ thì đóng ngăn
    inject(Router).events.subscribe(e => { if (e instanceof NavigationStart) this.ui.closeCart(); });
  }
}
