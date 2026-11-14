import { Component, computed, inject, input } from '@angular/core';
import { CartService } from '../core/cart.service';
import { ProductService } from '../core/product.service';
import { ToastService } from '../core/toast.service';
import { UiService } from '../core/ui.service';
import { Product } from '../core/models';

/** Nút "+" tròn, bấm xong biến thành bộ tăng giảm số lượng. Dùng ở thẻ sản phẩm và bảng giá. */
@Component({
  selector: 'fm-add-control',
  template: `
    @if (qty()) {
      <div class="stepper">
        <button type="button" (click)="change(-1)" [attr.aria-label]="'Bớt ' + name()">−</button>
        <span class="num">{{ products.qtyLabel(product(), qty()) }}</span>
        <button type="button" (click)="change(1)" [disabled]="qty() + products.step(product()) > maxQty()" [attr.aria-label]="'Thêm ' + name()">+</button>
      </div>
    } @else {
      <button class="add-btn" type="button" (click)="change(1)" [disabled]="maxQty() < products.step(product())" [attr.aria-label]="'Thêm ' + name() + ' vào giỏ'">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>
      </button>
    }
  `
})
export class AddControl {
  readonly product = input.required<Product>();
  private cart = inject(CartService);
  protected products = inject(ProductService);
  private toast = inject(ToastService);
  private ui = inject(UiService);
  readonly qty = computed(() => { this.cart.lines(); return this.cart.qty(this.product().id); });
  readonly name = computed(() => this.products.shortName(this.product()));
  readonly maxQty = computed(() => {
    const step = this.products.step(this.product());
    return Math.floor((this.product().stock + Number.EPSILON) / step) * step;
  });

  /** Chỉ báo "đã thêm" sau khi giỏ trên server thật sự có món này; lỗi do CartService tự báo */
  async change(d: number): Promise<void> {
    const p = this.product(), before = this.qty();
    await this.cart.nudge(p.id, d > 0 ? 1 : -1);
    if (d > 0 && !before && this.qty() > 0) this.toast.success(`Đã thêm ${this.name()} vào giỏ`, { label: 'Xem giỏ', run: () => this.ui.openCart() });
  }
}
