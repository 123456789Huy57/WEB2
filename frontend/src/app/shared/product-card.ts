import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../core/product.service';
import { Product } from '../core/models';
import { VndPipe } from './vnd.pipe';
import { AddControl } from './add-control';
import { ImgFallbackDirective } from './img-fallback.directive';

@Component({
  selector: 'fm-product-card',
  imports: [RouterLink, VndPipe, AddControl, ImgFallbackDirective],
  host: { class: 'p-card' },
  template: `
    <div class="ph-wrap">
      <a class="ph" [routerLink]="['/san-pham', p().slug || p().id]">
        <img [fmImg]="name()" [src]="ps.img(p())" [alt]="name()" loading="lazy">
      </a>
      <div class="add"><fm-add-control [product]="p()" /></div>
    </div>
    <h3><a [routerLink]="['/san-pham', p().slug || p().id]">{{ name() }}</a></h3>
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
  readonly name = computed(() => this.ps.shortName(this.p()));
  readonly off = computed(() => this.ps.off(this.p()));
}
