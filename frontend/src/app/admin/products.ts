import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../core/auth.service';
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
              <a class="link-btn" style="margin-left:12px" [routerLink]="['/san-pham', p.slug || p.id]" target="_blank">Xem</a>
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
          <div class="field"><label for="pf-cat">Quầy</label><select id="pf-cat" formControlName="category" (change)="form.controls.subcategory.setValue('')">@for (c of ps.categories(); track c.id) { <option [value]="c.id">{{ ps.catName(c) }}</option> }</select></div>
          <div class="field"><label for="pf-sub">Loại sản phẩm</label><select id="pf-sub" formControlName="subcategory"><option value="">Không chọn</option>@for (sub of subcategories(); track sub.id) { <option [value]="sub.id">{{ sub.name }}</option> }</select></div><div class="field"><label for="pf-brand">Thương hiệu</label><input id="pf-brand" formControlName="brand"></div>
          <div class="field"><label for="pf-price">Giá (đ)</label><input id="pf-price" type="number" min="0" step="500" formControlName="price">@if (bad('price')) { <span class="err">Giá phải lớn hơn 0</span> }</div>
          <div class="field"><label for="pf-sale">Giá giảm (đ, 0 = không giảm)</label><input id="pf-sale" type="number" min="0" step="500" formControlName="sale_price">@if (saleBad()) { <span class="err">Giá giảm phải thấp hơn giá gốc</span> }</div>
          <div class="field"><label for="pf-unit">Đơn vị bán</label><select id="pf-unit" formControlName="unit"><option>Kg</option><option>Gói</option><option>Hộp</option><option>Chai</option><option>Khay</option><option>Trái</option><option>Bó</option><option>Lon</option><option>Túi</option><option>Bao</option><option>Cái</option><option>Lốc</option><option>Thùng</option><option>Vỉ</option><option>Bịch</option><option>Hũ</option><option>Quả</option></select></div>
          <div class="field"><label for="pf-stock">Tồn kho</label><input id="pf-stock" type="number" min="0" step="0.5" formControlName="stock" readonly><span class="hint">Tồn kho được quản lý riêng tại mục Tồn kho.</span>@if (bad('stock')) { <span class="err">Tồn kho không âm</span> }</div>
          <div class="field full"><label for="pf-img">Link ảnh</label><input id="pf-img" formControlName="image_url" placeholder="https://..."></div>
          <div class="field full"><label for="pf-upload">Tải ảnh từ máy</label><input id="pf-upload" type="file" accept="image/png,image/jpeg,image/webp" [disabled]="uploading()" (change)="upload($event)"><span class="hint">{{ uploading() ? 'Đang tải ảnh…' : 'PNG, JPEG hoặc WebP, tối đa 2 MB.' }}</span></div>
          <div class="field full"><label for="pf-gallery">Ảnh bổ sung</label><textarea id="pf-gallery" formControlName="galleryText" placeholder="Mỗi dòng một link ảnh"></textarea></div>
          <div class="field"><label for="pf-origin">Xuất xứ</label><input id="pf-origin" formControlName="origin"></div>
          <div class="field"><label for="pf-tags">Từ khóa</label><input id="pf-tags" formControlName="tagsText" placeholder="Rau xanh, ăn chay"></div>
          <div class="field"><label for="pf-weight">Khối lượng một gói (g)</label><input id="pf-weight" type="number" min="0" formControlName="netWeightGram"><span class="hint">0 nếu không áp dụng</span></div>
          <div class="field"><label for="pf-unit-weight">Khối lượng một đơn vị (g)</label><input id="pf-unit-weight" type="number" min="0" formControlName="unitWeightGram"><span class="hint">Dùng để quy đổi nguyên liệu</span></div>
          <h3 class="h3 full">Dinh dưỡng</h3>
          <div class="field"><label for="pf-energy">Năng lượng (kcal)</label><input id="pf-energy" type="number" min="0" formControlName="energy_kcal"></div>
          <div class="field"><label for="pf-protein">Protein (g)</label><input id="pf-protein" type="number" min="0" formControlName="protein"></div>
          <div class="field"><label for="pf-fat">Chất béo (g)</label><input id="pf-fat" type="number" min="0" formControlName="fat"></div>
          <div class="field"><label for="pf-carbs">Carbohydrate (g)</label><input id="pf-carbs" type="number" min="0" formControlName="carbohydrates"></div>
          <div class="field"><label for="pf-sugars">Đường (g)</label><input id="pf-sugars" type="number" min="0" formControlName="sugars"></div>
          <div class="field"><label for="pf-fiber">Chất xơ (g)</label><input id="pf-fiber" type="number" min="0" formControlName="fiber"></div>
          <div class="field"><label for="pf-salt">Muối (g)</label><input id="pf-salt" type="number" min="0" formControlName="salt"></div>
          <div class="field full"><label for="pf-desc">Mô tả</label><textarea id="pf-desc" formControlName="description"></textarea></div>
          <label class="check full"><input type="checkbox" formControlName="active"> Đang bán (hiện ở cửa hàng)</label>
        </div>
        <div class="acts"><button class="btn btn-stone" type="button" (click)="dlg.close()">Hủy</button><button class="btn btn-forest" type="submit" [disabled]="saving() || uploading()">{{ saving() ? 'Đang lưu…' : 'Lưu' }}</button></div>
      </form>
    </dialog>
  `
})
export class AdminProducts {
  protected data = inject(DataService);
  protected ps = inject(ProductService);
  private toast = inject(ToastService);
  protected size = PAGE;
  protected saving = signal(false);
  protected uploading = signal(false);
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
    image_url: [''], description: [''], active: [true], subcategory: [''], galleryText: [''], origin: [''], tagsText: [''],
    netWeightGram: [0, Validators.min(0)], unitWeightGram: [0, Validators.min(0)], energy_kcal: [null as number | null, Validators.min(0)], protein: [null as number | null, Validators.min(0)], fat: [null as number | null, Validators.min(0)], carbohydrates: [null as number | null, Validators.min(0)], sugars: [null as number | null, Validators.min(0)], fiber: [null as number | null, Validators.min(0)], salt: [null as number | null, Validators.min(0)]
  });
  protected subcategories(): { id: string; name: string }[] { return this.ps.category(this.form.controls.category.value)?.subcategories ?? []; }
  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement; const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { this.toast.show('Ảnh tối đa 2 MB'); input.value = ''; return; }
    this.uploading.set(true);
    try { this.form.controls.image_url.setValue(await this.data.uploadImage(file)); this.toast.show('Đã tải ảnh'); }
    catch (error) { this.toast.show(apiMessage(error)); }
    finally { this.uploading.set(false); input.value = ''; }
  }
  protected bad(k: 'name' | 'price' | 'stock'): boolean { const c = this.form.controls[k]; return c.invalid && (c.touched || this.tried()); }
  protected saleBad(): boolean { const v = this.form.getRawValue(); return v.sale_price > 0 && v.sale_price >= v.price; }

  protected edit(p: Product | null): void {
    this.editing.set(p); this.tried.set(false);
    this.form.reset(p ? { name: p.name, category: p.category, brand: p.brand ?? '', price: p.price, sale_price: p.sale_price, unit: p.unit, stock: p.stock, image_url: p.image_url, description: p.description, active: p.active !== false }
      : { name: '', category: this.cat() || 'vegetables', brand: '', price: 0, sale_price: 0, unit: 'Kg', stock: 0, image_url: '', description: '', active: true });
    this.form.patchValue({ subcategory: p?.subcategory ?? '', galleryText: p?.gallery?.join('\n') ?? '', origin: p?.origin ?? '', tagsText: p?.tags?.join(', ') ?? '', netWeightGram: p?.netWeightGram ?? 0, unitWeightGram: p?.unitWeightGram ?? 0, energy_kcal: p?.nutrition?.energy_kcal ?? null, protein: p?.nutrition?.protein ?? null, fat: p?.nutrition?.fat ?? null, carbohydrates: p?.nutrition?.carbohydrates ?? null, sugars: p?.nutrition?.sugars ?? null, fiber: p?.nutrition?.fiber ?? null, salt: p?.nutrition?.salt ?? null });
    this.dlg().nativeElement.showModal();
  }
  protected async save(): Promise<void> {
    if (this.saving() || this.uploading()) return;
    this.tried.set(true);
    if (this.form.invalid || this.saleBad()) return;
    const v = this.form.getRawValue();
    const c = this.ps.category(v.category);
    if (!c) { this.toast.show('Chọn danh mục hợp lệ'); return; }
    const old = this.editing();
    const id = old?.id ?? 'p-' + Date.now().toString(36);
    const p: Product = {
      ...(old ?? { gallery: [], sold_count: 0, origin: 'Việt Nam', slug: slugify(v.name) + '-' + id }),
      id, name: v.name.trim(), brand: v.brand.trim(), category: c.id, categoryName: c.name.replace(/ - /g, ', '),
      subcategory: v.subcategory, gallery: v.galleryText.split('\n').map(value => value.trim()).filter(Boolean), origin: v.origin, tags: v.tagsText.split(',').map(value => value.trim()).filter(Boolean),
      netWeightGram: v.netWeightGram || undefined, unitWeightGram: v.unitWeightGram || undefined,
      nutrition: Object.fromEntries((['energy_kcal', 'protein', 'fat', 'carbohydrates', 'sugars', 'fiber', 'salt'] as const).filter(key => v[key] !== null).map(key => [key, v[key]!])),
      price: v.price, sale_price: v.sale_price, unit: v.unit, stock: v.stock, image_url: v.image_url.trim() || (old?.image_url ?? ''),
      img: v.image_url.trim() && v.image_url !== old?.image_url ? undefined : old?.img,
      description: v.description.trim() || `${v.name.trim()} chọn lọc, giao nhanh trong ngày.`, active: v.active
    } as Product;
    this.saving.set(true);
    try {
      await this.data.saveProduct(p);
      this.dlg().nativeElement.close();
      this.toast.show(old ? `Đã lưu ${this.ps.shortName(p)}` : `Đã thêm ${this.ps.shortName(p)}`);
    } catch (error) { this.toast.show(apiMessage(error)); }
    finally { this.saving.set(false); }
  }
  protected async toggleActive(p: Product): Promise<void> {
    try { await this.data.saveProduct({ ...p, active: p.active === false }); this.toast.show('Đã cập nhật trạng thái sản phẩm'); }
    catch (error) { this.toast.show(apiMessage(error)); }
  }
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
