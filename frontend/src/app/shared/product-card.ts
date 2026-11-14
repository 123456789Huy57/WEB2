import { Component, DestroyRef, ElementRef, NgZone, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../core/product.service';
import { Product } from '../core/models';
import { VndPipe } from './vnd.pipe';
import { AddControl } from './add-control';
import { ImgFallbackDirective } from './img-fallback.directive';
import { WishlistService } from '../core/wishlist.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'fm-product-card',
  imports: [RouterLink, VndPipe, AddControl, ImgFallbackDirective],
  host: { class: 'p-card' },
  styles: `
    .p-wish { position: absolute; top: 10px; right: 10px; z-index: 2; display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 50%; background: var(--paper); color: var(--ink); }
    .p-wish svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 1.6; }
    .p-wish[aria-pressed="true"] { background: var(--forest); color: var(--paper); }
    .p-wish[aria-pressed="true"] svg { fill: currentColor; }
    .p-wish:focus-visible { outline: 2px solid var(--forest); outline-offset: 2px; }
  `,
  template: `
    <div class="ph-wrap">
      <a class="ph" [routerLink]="['/san-pham', p().slug || p().id]" tabindex="-1" aria-hidden="true" (click)="morph($event)">
        <img [fmImg]="name()" [src]="ps.img(p())" [alt]="name()" loading="lazy">
      </a>
      <button class="p-wish" type="button" [attr.aria-pressed]="wished()" [attr.aria-label]="wished() ? 'Bỏ ' + name() + ' khỏi yêu thích' : 'Lưu ' + name() + ' vào yêu thích'" (click)="toggleWish()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>
      </button>
      <div class="add"><fm-add-control [product]="p()" /></div>
    </div>
    <h3><a [routerLink]="['/san-pham', p().slug || p().id]" (focus)="prefetch()" (click)="morph($event)">{{ name() }}</a></h3>
    <p class="sub">{{ p().subcategoryName || p().categoryName }} · {{ ps.unit(p()) }}</p>
    <div class="price-row">
      <span class="price num">{{ ps.price(p()) | vnd }}</span>
      @if (off()) {
        <s class="num">{{ p().price | vnd }}</s><span class="off num">−{{ off() }}%</span>
      }
    </div>
  `
})
export class ProductCard {
  readonly p = input.required<Product>({ alias: 'product' });
  protected ps = inject(ProductService);
  /** Rê chuột vào là tải sẵn mô tả, bộ ảnh: bấm vào trang chi tiết hiện đủ ngay */
  protected prefetch(): void { void this.ps.loadDetail(this.p().id); }
  constructor() {
    // Tải trước chi tiết khi chuột DỪNG trên thẻ 150 ms (đang nhắm vào sản phẩm), không phải mỗi lần thẻ trượt qua
    // dưới con trỏ lúc cuộn (trước đây cuộn qua 50 thẻ = 50 request + 50 lần Angular kiểm tra lại giao diện).
    // Nghe ngoài vùng theo dõi của Angular vì việc này không đổi gì trên màn hình.
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const enter = (e: PointerEvent) => { if (e.pointerType === 'mouse') { clearTimeout(timer); timer = setTimeout(() => this.prefetch(), 150); } };
    const leave = () => clearTimeout(timer);
    inject(NgZone).runOutsideAngular(() => { host.addEventListener('pointerenter', enter); host.addEventListener('pointerleave', leave); });
    inject(DestroyRef).onDestroy(() => { clearTimeout(timer); host.removeEventListener('pointerenter', enter); host.removeEventListener('pointerleave', leave); });
  }
  /** Ảnh của thẻ vừa bấm "bay" sang ảnh lớn ở trang chi tiết (View Transitions; chỉ gắn tên cho đúng một thẻ) */
  protected morph(e: MouseEvent): void {
    const img = (e.currentTarget as HTMLElement).closest('fm-product-card')?.querySelector('img');
    if (!img || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    img.style.viewTransitionName = 'pd-hero';
    setTimeout(() => (img.style.viewTransitionName = ''), 800);
  }
  private wishlist = inject(WishlistService);
  private toast = inject(ToastService);
  readonly name = computed(() => this.ps.shortName(this.p()));
  readonly off = computed(() => this.ps.off(this.p()));
  protected wished = computed(() => { this.wishlist.ids(); return this.wishlist.has(this.p().id); });

  protected toggleWish(): void {
    this.toast.show(this.wishlist.toggle(this.p().id) ? 'Đã lưu vào yêu thích' : 'Đã bỏ khỏi yêu thích');
  }
}
