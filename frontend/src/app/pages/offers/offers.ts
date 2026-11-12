import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoucherService } from '../../core/voucher.service';
import { ProductService } from '../../core/product.service';
import { ProductCard } from '../../shared/product-card';
import { VoucherList } from '../../shared/voucher-list';

@Component({
  selector: 'fm-offers',
  imports: [RouterLink, ProductCard, VoucherList],
  encapsulation: ViewEncapsulation.None,
  styles: `.v-tabs { margin-bottom: 24px; }`,
  template: `
    <section class="page-head band">
      <h1 class="h2">Ưu đãi tuần này</h1>
      <p>Lưu mã trước, khi thanh toán mã đã lưu hiện ở đầu danh sách. Mỗi đơn dùng được một mã.</p>
    </section>
    <section class="band" aria-label="Mã giảm giá">
      <div class="tabs v-tabs" role="group" aria-label="Lọc mã">
        @for (k of kinds; track k.key) {
          <button class="tab" type="button" [attr.aria-pressed]="kind() === k.key" (click)="kind.set(k.key)">{{ k.label }}</button>
        }
      </div>
      <fm-voucher-list [list]="vouchers()" />
    </section>
    <section class="sec band" aria-labelledby="h-sale">
      <div class="sec-head">
        <div><h2 class="h2" id="h-sale">Đang giảm giá</h2><p>{{ sale().length }} sản phẩm, xếp theo mức giảm nhiều nhất.</p></div>
        <a class="link" routerLink="/san-pham">Xem tất cả sản phẩm</a>
      </div>
      <div class="p-grid">
        @for (p of sale().slice(0, limit()); track p.id) { <fm-product-card [product]="p" /> }
      </div>
      @if (limit() < sale().length) {
        <div class="more" style="margin-top:56px;display:flex;justify-content:center"><button class="btn btn-stone" type="button" (click)="limit.set(limit() + 16)">Xem thêm</button></div>
      }
    </section>
  `
})
export class Offers {
  private vs = inject(VoucherService);
  private ps = inject(ProductService);
  protected kinds: { key: 'all' | 'product' | 'shipping'; label: string }[] = [
    { key: 'all', label: 'Tất cả mã' }, { key: 'product', label: 'Giảm tiền hàng' }, { key: 'shipping', label: 'Phí giao hàng' }
  ];
  protected kind = signal<'all' | 'product' | 'shipping'>('all');
  protected limit = signal(16);
  protected vouchers = computed(() => this.vs.all().filter(v => this.kind() === 'all' || v.category === this.kind()));
  protected sale = computed(() => this.ps.all().filter(p => this.ps.off(p) > 0 && p.stock > 0).sort((a, b) => this.ps.off(b) - this.ps.off(a)));
}
