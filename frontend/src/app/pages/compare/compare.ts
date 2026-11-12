import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompareService } from '../../core/compare.service';
import { ProductService } from '../../core/product.service';
import { Product } from '../../core/models';
import { VndPipe } from '../../shared/vnd.pipe';
import { AddControl } from '../../shared/add-control';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';

/** So sánh tối đa 3 sản phẩm theo giá, quy cách và dinh dưỡng trên 100 g (tính năng Web1 compare.html) */
@Component({
  selector: 'fm-compare',
  imports: [RouterLink, AddControl, ImgFallbackDirective],
  encapsulation: ViewEncapsulation.None,
  styles: `
    .cmp-wrap { overflow-x: auto; }
    .cmp { width: 100%; min-width: 640px; border-collapse: collapse; table-layout: fixed; }
    .cmp th, .cmp td { text-align: left; vertical-align: top; padding: 14px 16px; }
    .cmp tbody tr:nth-child(odd) { background: var(--stone); }
    .cmp th[scope="row"] { width: 180px; font-weight: 500; color: var(--muted); }
    .cmp thead td { padding-bottom: 24px; }
    .cmp .ph { aspect-ratio: 1; margin-bottom: 12px; }
    .cmp .ph img { padding: 8%; }
    .cmp .nm { font-weight: 500; display: block; min-height: 48px; }
    .cmp .best { color: var(--forest); font-weight: 600; }
    .cmp .rm { border: 0; background: none; padding: 0; margin-top: 10px; color: var(--muted); text-decoration: underline; text-underline-offset: 4px; font-size: var(--t-small); }
    .cmp .add-wrap { margin-top: 12px; }
    .cmp .add-btn { background: var(--stone); }
    .cmp .add-btn:hover { background: var(--forest); }
  `,
  template: `
    <section class="page-head band">
      <h1 class="h2">So sánh sản phẩm</h1>
      <p>Đặt tối đa 3 sản phẩm cạnh nhau để so giá và dinh dưỡng. Thêm sản phẩm bằng nút “So sánh” ở trang chi tiết.</p>
    </section>
    <section class="band">
      @if (items().length) {
        <div class="cmp-wrap">
          <table class="cmp">
            <thead><tr><td></td>
              @for (p of items(); track p.id) {
                <td>
                  <a class="ph" [routerLink]="['/san-pham', p.slug || p.id]"><img [fmImg]="p.name" [src]="ps.img(p)" [alt]="ps.shortName(p)"></a>
                  <a class="nm" [routerLink]="['/san-pham', p.slug || p.id]">{{ ps.shortName(p) }}</a>
                  <div class="add-wrap"><fm-add-control [product]="p" /></div>
                  <button class="rm" type="button" (click)="cmp.toggle(p.id)">Bỏ khỏi so sánh</button>
                </td>
              }
            </tr></thead>
            <tbody>
              @for (r of rows(); track r.label) {
                <tr><th scope="row">{{ r.label }}</th>
                  @for (v of r.values; track $index) { <td class="num" [class.best]="r.best === $index">{{ v }}</td> }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="small muted" style="margin-top:16px">Chữ xanh đậm là lựa chọn tốt nhất ở từng dòng: giá thấp nhất, đạm cao nhất, năng lượng và đường thấp nhất.</p>
        <button class="btn btn-stone" type="button" style="margin-top:20px" (click)="cmp.clear()">Xóa danh sách so sánh</button>
      } @else {
        <div class="empty"><p class="h3">Chưa có sản phẩm nào để so sánh.</p><p class="muted">Mở một sản phẩm và bấm “So sánh”, rồi chọn thêm sản phẩm khác cùng loại.</p><a class="btn btn-forest" routerLink="/san-pham">Xem sản phẩm</a></div>
      }
    </section>
  `
})
export class Compare {
  protected cmp = inject(CompareService);
  protected ps = inject(ProductService);
  protected items = computed(() => this.cmp.ids().map(id => this.ps.get(id)).filter((p): p is Product => !!p));
  protected rows = computed(() => {
    const it = this.items();
    const vnd = (n: number) => new VndPipe().transform(n);
    const num = (n: number | undefined, u: string) => (n == null ? '—' : `${String(n).replace('.', ',')} ${u}`);
    const pick = (vals: (number | undefined)[], better: 'min' | 'max') => {
      const ok = vals.map((v, i) => [v, i] as const).filter(([v]) => v != null) as [number, number][];
      if (ok.length < 2) return -1;
      return ok.reduce((a, b) => ((better === 'min' ? b[0] < a[0] : b[0] > a[0]) ? b : a))[1];
    };
    const n = it.map(p => p.nutrition ?? {});
    return [
      { label: 'Giá', values: it.map(p => `${vnd(this.ps.price(p))} / ${this.ps.unit(p)}`), best: pick(it.map(p => this.ps.price(p)), 'min') },
      { label: 'Giảm giá', values: it.map(p => (this.ps.off(p) ? `−${this.ps.off(p)}%` : '—')), best: -1 },
      { label: 'Thương hiệu', values: it.map(p => p.brand || '—'), best: -1 },
      { label: 'Xuất xứ', values: it.map(p => p.origin || 'Việt Nam'), best: -1 },
      { label: 'Năng lượng / 100 g', values: n.map(x => num(x.energy_kcal, 'kcal')), best: pick(n.map(x => x.energy_kcal), 'min') },
      { label: 'Đạm', values: n.map(x => num(x.protein, 'g')), best: pick(n.map(x => x.protein), 'max') },
      { label: 'Béo', values: n.map(x => num(x.fat, 'g')), best: pick(n.map(x => x.fat), 'min') },
      { label: 'Tinh bột', values: n.map(x => num(x.carbohydrates, 'g')), best: -1 },
      { label: 'Đường', values: n.map(x => num(x.sugars, 'g')), best: pick(n.map(x => x.sugars), 'min') },
      { label: 'Còn hàng', values: it.map(p => (p.stock > 0 ? `${this.ps.qty(p.stock)} ${this.ps.unit(p)}` : 'Tạm hết')), best: -1 }
    ];
  });
}
