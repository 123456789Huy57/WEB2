import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataService } from '../core/data.service';
import { ProductService } from '../core/product.service';
import { ToastService } from '../core/toast.service';
import { Product } from '../core/models';
import { norm } from '../core/storage';
import { VndPipe } from '../shared/vnd.pipe';
import { ImgFallbackDirective } from '../shared/img-fallback.directive';

const PAGE = 20;

@Component({
  selector: 'fm-admin-products',
  imports: [ReactiveFormsModule, RouterLink, VndPipe, ImgFallbackDirective],
  template: `
    <div class="adm-head">
      <div><h1 class="h2">Sản phẩm</h1><p>{{ data.products().length }} sản phẩm · {{ hidden() }} đang ẩn khỏi cửa hàng</p></div>
      <button class="btn btn-forest" type="button" (click)="edit(null)">Thêm sản phẩm</button>
    </div>
    <div class="toolbar">
      <input class="adm-input" type="search" placeholder="Tìm tên, thương hiệu, mã sản phẩm" [value]="q()" (input)="q.set($any($event.target).value); page.set(0)" aria-label="Tìm sản phẩm">
      <select [value]="cat()" (change)="cat.set($any($event.target).value); page.set(0)" aria-label="Lọc theo quầy">
        <option value="">Tất cả quầy</option>
        @for (c of ps.categories(); track c.id) { <option [value]="c.id">{{ ps.catName(c) }}</option> }
      </select>
      <select [value]="show()" (change)="show.set($any($event.target).value); page.set(0)" aria-label="Lọc trạng thái">
        <option value="all">Mọi trạng thái</option><option value="on">Đang bán</option><option value="off">Đang ẩn</option><option value="sale">Đang giảm giá</option>
      </select>
    </div>
    <div class="card"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th></th><th>Sản phẩm</th><th>Quầy</th><th class="r">Giá</th><th class="r">Giá giảm</th><th class="r">Tồn</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>
        @for (p of paged(); track p.id) {
          <tr [class.dim]="p.active === false">
            <td><div class="thumb"><img [fmImg]="p.name" [src]="ps.img(p)" alt=""></div></td>
            <td class="nm">{{ ps.shortName(p) }}<br><span class="small muted num">{{ p.id }} · {{ p.brand || '—' }}</span></td>
            <td>{{ ps.catName(p.category) }}</td>
            <td class="r num">{{ p.price | vnd }}</td>
            <td class="r num">{{ p.sale_price ? (p.sale_price | vnd) : '—' }}</td>
            <td class="r num" [class.low]="p.stock <= 10">{{ ps.qty(p.stock) }} {{ ps.unit(p) }}</td>
            <td><span class="pill" [class.on]="p.active !== false">{{ p.active === false ? 'Đang ẩn' : 'Đang bán' }}</span></td>
            <td class="r" style="white-space:nowrap">
              <button class="link-btn" type="button" (click)="edit(p)">Sửa</button>
              <button class="link-btn" type="button" style="margin-left:12px" (click)="toggleActive(p)">{{ p.active === false ? 'Hiện' : 'Ẩn' }}</button>
              <a class="link-btn" style="margin-left:12px" [routerLink]="['/san-pham', p.id]" target="_blank">Xem</a>
            </td>
          </tr>
        } @empty { <tr><td colspan="8" class="empty-row">Không có sản phẩm khớp bộ lọc.</td></tr> }
      </tbody>
    </table></div>
    <div class="pager">
      <span class="num">{{ filtered().length ? page() * size + 1 : 0 }}–{{ min((page() + 1) * size, filtered().length) }} trên {{ filtered().length }}</span>
      <div><button class="btn btn-stone btn-sm" type="button" [disabled]="page() === 0" (click)="page.set(page() - 1)">Trước</button><button class="btn btn-stone btn-sm" type="button" [disabled]="(page() + 1) * size >= filtered().length" (click)="page.set(page() + 1)">Sau</button></div>
    </div></div>

    <dialog class="adm-dlg" #dlg aria-labelledby="pf-title">
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <h2 class="h3" id="pf-title">{{ editing() ? 'Sửa sản phẩm' : 'Thêm sản phẩm' }}</h2>
        <div class="form-grid">
          <div class="field full"><label for="pf-name">Tên sản phẩm</label><input id="pf-name" formControlName="name">@if (bad('name')) { <span class="err">Nhập tên sản phẩm</span> }</div>
          <div class="field"><label for="pf-cat">Quầy</label><select id="pf-cat" formControlName="category">@for (c of ps.categories(); track c.id) { <option [value]="c.id">{{ ps.catName(c) }}</option> }</select></div>
          <div class="field"><label for="pf-brand">Thương hiệu</label><input id="pf-brand" formControlName="brand"></div>
          <div class="field"><label for="pf-price">Giá (đ)</label><input id="pf-price" type="number" min="0" step="500" formControlName="price">@if (bad('price')) { <span class="err">Giá phải lớn hơn 0</span> }</div>
          <div class="field"><label for="pf-sale">Giá giảm (đ, 0 = không giảm)</label><input id="pf-sale" type="number" min="0" step="500" formControlName="sale_price">@if (saleBad()) { <span class="err">Giá giảm phải thấp hơn giá gốc</span> }</div>
          <div class="field"><label for="pf-unit">Đơn vị bán</label><select id="pf-unit" formControlName="unit"><option>Kg</option><option>Gói</option><option>Hộp</option><option>Chai</option><option>Khay</option><option>Trái</option><option>Bó</option><option>Lon</option><option>Túi</option><option>Bao</option></select></div>
          <div class="field"><label for="pf-stock">Tồn kho</label><input id="pf-stock" type="number" min="0" step="0.5" formControlName="stock">@if (bad('stock')) { <span class="err">Tồn kho không âm</span> }</div>
          <div class="field full"><label for="pf-img">Link ảnh</label><input id="pf-img" formControlName="image_url" placeholder="https://..."></div>
          <div class="field full"><label for="pf-desc">Mô tả</label><textarea id="pf-desc" formControlName="description"></textarea></div>
          <label class="check full"><input type="checkbox" formControlName="active"> Đang bán (hiện ở cửa hàng)</label>
        </div>
        <div class="acts"><button class="btn btn-stone" type="button" (click)="dlg.close()">Hủy</button><button class="btn btn-forest" type="submit">Lưu</button></div>
      </form>
    </dialog>
  `
})
export class AdminProducts {
  protected data = inject(DataService);
  protected ps = inject(ProductService);
  private toast = inject(ToastService);
  protected size = PAGE;
  protected min = Math.min;
  protected q = signal('');
  protected cat = signal('');
  protected show = signal<'all' | 'on' | 'off' | 'sale'>('all');
  protected page = signal(0);
  protected hidden = computed(() => this.data.products().filter(p => p.active === false).length);
  protected filtered = computed(() => {
    const k = norm(this.q());
    return this.data.products().filter(p =>
      (!this.cat() || p.category === this.cat()) &&
      (!k || norm(`${p.name} ${p.brand} ${p.id}`).includes(k)) &&
      (this.show() === 'all' || (this.show() === 'on' && p.active !== false) || (this.show() === 'off' && p.active === false) || (this.show() === 'sale' && this.ps.off(p) > 0)));
  });
  protected paged = computed(() => this.filtered().slice(this.page() * PAGE, (this.page() + 1) * PAGE));

  protected dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected editing = signal<Product | null>(null);
  private tried = signal(false);
  protected form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    category: ['vegetables'], brand: [''],
    price: [0, [Validators.required, Validators.min(1)]], sale_price: [0, [Validators.min(0)]],
    unit: ['Kg'], stock: [0, [Validators.required, Validators.min(0)]],
    image_url: [''], description: [''], active: [true]
  });
  protected bad(k: 'name' | 'price' | 'stock'): boolean { const c = this.form.controls[k]; return c.invalid && (c.touched || this.tried()); }
  protected saleBad(): boolean { const v = this.form.getRawValue(); return v.sale_price > 0 && v.sale_price >= v.price; }

  protected edit(p: Product | null): void {
    this.editing.set(p); this.tried.set(false);
    this.form.reset(p ? { name: p.name, category: p.category, brand: p.brand ?? '', price: p.price, sale_price: p.sale_price, unit: p.unit, stock: p.stock, image_url: p.image_url, description: p.description, active: p.active !== false }
      : { name: '', category: this.cat() || 'vegetables', brand: '', price: 0, sale_price: 0, unit: 'Kg', stock: 0, image_url: '', description: '', active: true });
    this.dlg().nativeElement.showModal();
  }
  protected save(): void {
    this.tried.set(true);
    if (this.form.invalid || this.saleBad()) return;
    const v = this.form.getRawValue();
    const c = this.ps.category(v.category)!;
    const old = this.editing();
    const id = old?.id ?? 'p-' + Date.now().toString(36);
    const p: Product = {
      ...(old ?? { gallery: [], sold_count: 0, origin: 'Việt Nam', slug: slugify(v.name) + '-' + id }),
      id, name: v.name.trim(), brand: v.brand.trim(), category: c.id, categoryName: c.name.replace(/ - /g, ', '),
      price: v.price, sale_price: v.sale_price, unit: v.unit, stock: v.stock, image_url: v.image_url.trim() || (old?.image_url ?? ''),
      img: v.image_url.trim() && v.image_url !== old?.image_url ? undefined : old?.img,
      description: v.description.trim() || `${v.name.trim()} chọn lọc, giao nhanh trong ngày.`, active: v.active
    } as Product;
    this.data.saveProduct(p);
    this.dlg().nativeElement.close();
    this.toast.show(old ? `Đã lưu ${this.ps.shortName(p)}` : `Đã thêm ${this.ps.shortName(p)}`);
  }
  protected toggleActive(p: Product): void {
    this.data.saveProduct({ ...p, active: p.active === false });
    this.toast.show(p.active === false ? `Đã hiện ${this.ps.shortName(p)} trên cửa hàng` : `Đã ẩn ${this.ps.shortName(p)} khỏi cửa hàng`);
  }
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
