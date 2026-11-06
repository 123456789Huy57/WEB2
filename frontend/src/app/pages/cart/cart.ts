import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService, FREE_SHIP_FROM } from '../../core/cart.service';
import { ProductService } from '../../core/product.service';
import { VoucherService } from '../../core/voucher.service';
import { ToastService } from '../../core/toast.service';
import { VndPipe } from '../../shared/vnd.pipe';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';
import { ProductCard } from '../../shared/product-card';

@Component({
  selector: 'fm-cart',
  imports: [RouterLink, VndPipe, ImgFallbackDirective, ProductCard],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
  encapsulation: ViewEncapsulation.None
})
export class CartPage {
  protected cart = inject(CartService);
  protected ps = inject(ProductService);
  private vs = inject(VoucherService);
  private toast = inject(ToastService);

  protected t = this.cart.totals;
  protected code = signal(this.cart.voucherCode());
  protected msg = signal('');
  protected vMsg = computed(() => this.t().voucher ? 'Đã áp dụng ' + this.t().voucher!.title.toLowerCase() : this.t().voucherMsg || this.msg());
  protected needForFree = computed(() => FREE_SHIP_FROM - this.t().sub);
  /** Gợi ý mua thêm: hàng đang giảm, chưa có trong giỏ; nếu chưa đủ miễn phí giao thì ưu tiên món giá vừa đủ bù */
  protected suggest = computed(() => {
    const inCart = new Set(this.cart.lines().map(l => l.p.id));
    const need = this.needForFree();
    const fresh = ['vegetables', 'fruits', 'meat', 'seafood', 'dairy-eggs'];
    const pool = this.ps.all().filter(p => !inCart.has(p.id) && p.stock > 0 && fresh.includes(p.category) && !/^(thùng|combo|lốc)/i.test(p.name));
    const onSale = pool.filter(p => this.ps.off(p) > 0);
    const list = (onSale.length >= 4 ? onSale : pool)
      .filter(p => need <= 0 || this.ps.price(p) <= Math.max(need, 60000))
      .sort((a, b) => this.ps.off(b) - this.ps.off(a) || b.sold_count - a.sold_count);
    return list.slice(0, 4);
  });
  protected freePct = computed(() => Math.min(100, (this.t().sub / FREE_SHIP_FROM) * 100));

  protected apply(): void {
    const code = this.code().trim().toUpperCase();
    if (!code) { this.cart.setVoucher(''); this.msg.set(''); return; }
    const v = this.vs.find(code);
    if (!v) { this.cart.setVoucher(''); this.msg.set(`Mã ${code} không tồn tại hoặc đã hết hạn`); return; }
    this.msg.set('');
    this.cart.setVoucher(code);
  }
  protected remove(id: string): void {
    const p = this.ps.get(id);
    this.cart.set(id, 0);
    if (p) this.toast.show(`Đã xóa ${this.ps.shortName(p)} khỏi giỏ`);
  }
}
