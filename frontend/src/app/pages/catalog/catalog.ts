import { Component, ViewEncapsulation, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ProductService } from '../../core/product.service';
import { Product } from '../../core/models';
import { ProductCard } from '../../shared/product-card';

type SortKey = 'pop' | 'new' | 'asc' | 'desc' | 'off';

@Component({
  selector: 'fm-catalog',
  imports: [RouterLink, ProductCard],
  templateUrl: './catalog.html',
  styleUrl: './catalog.css',
  encapsulation: ViewEncapsulation.None
})
export class Catalog {
  /** Lấy từ URL: /san-pham?c=vegetables&q=cà chua (nhờ withComponentInputBinding) */
  readonly c = input<string>();
  readonly q = input<string>();
  /** Loại hàng trong quầy: /san-pham?c=meat&loai=meat-pork */
  readonly loai = input<string>();
  protected ps = inject(ProductService);
  private router = inject(Router);
  private titleSvc = inject(Title);

  protected sub = computed(() => (this.cat()?.subcategories.some(s => s.id === this.loai()) ? this.loai()! : ''));
  private subCounts = computed(() => { const m = new Map<string, number>(); this.ps.all().forEach(p => p.subcategory && m.set(p.subcategory, (m.get(p.subcategory) ?? 0) + 1)); return m; });
  protected subCount(id: string): number { return this.subCounts().get(id) ?? 0; }
  protected price = signal('');
  protected sale = signal(false);
  protected inStock = signal(true);
  protected sort = signal<SortKey>('pop');
  protected limit = signal(12);
  protected filtersOpen = signal(false);
  protected priceRanges = [
    { key: '0-50000', label: 'Dưới 50.000 đ' },
    { key: '50000-150000', label: '50.000 – 150.000 đ' },
    { key: '150000-1000000000', label: 'Trên 150.000 đ' }
  ];

  protected cat = computed(() => this.ps.category(this.c()));
  protected title = computed(() => this.sub() ? this.subName() : this.cat() ? this.ps.catName(this.cat()) : this.q() ? `Kết quả cho “${this.q()}”` : 'Tất cả quầy');
  protected crumb = computed(() => this.cat() ? this.ps.catName(this.cat()) : this.q() ? 'Tìm kiếm' : 'Tất cả quầy');
  protected subName = computed(() => this.cat()?.subcategories.find(s => s.id === this.sub())?.name ?? '');
  protected desc = computed(() => this.cat()?.description ?? (this.q() ? `Tìm trong ${this.ps.all().length} sản phẩm theo tên, quầy và thương hiệu.` : `${this.ps.all().length} sản phẩm tươi và khô, giao trong 1–2 giờ ở nội thành TP.HCM.`));

  protected results = computed(() => {
    let r: Product[] = this.q() ? this.ps.search(this.q()!) : [...this.ps.all()];
    const c = this.cat()?.id;
    if (c) r = r.filter(p => p.category === c);
    if (this.sub()) r = r.filter(p => p.subcategory === this.sub());
    if (this.price()) { const [a, b] = this.price().split('-').map(Number); r = r.filter(p => { const x = this.ps.price(p); return x >= a && x < b; }); }
    if (this.sale()) r = r.filter(p => this.ps.off(p) > 0);
    if (this.inStock()) r = r.filter(p => p.stock > 0);
    const by: Record<SortKey, (a: Product, b: Product) => number> = {
      pop: (a, b) => b.sold_count - a.sold_count,
      new: (a, b) => b.id.localeCompare(a.id),
      asc: (a, b) => this.ps.price(a) - this.ps.price(b),
      desc: (a, b) => this.ps.price(b) - this.ps.price(a),
      off: (a, b) => this.ps.off(b) - this.ps.off(a)
    };
    return r.sort(by[this.sort()]);
  });
  protected shown = computed(() => this.results().slice(0, this.limit()));
  protected active = computed(() => {
    const f: { key: string; label: string }[] = [];
    if (this.q()) f.push({ key: 'q', label: 'Từ khóa: ' + this.q() });
    if (this.sub()) f.push({ key: 'sub', label: this.cat()?.subcategories.find(s => s.id === this.sub())?.name ?? '' });
    if (this.price()) f.push({ key: 'price', label: this.priceRanges.find(r => r.key === this.price())!.label });
    if (this.sale()) f.push({ key: 'sale', label: 'Đang giảm giá' });
    return f;
  });

  constructor() {
    // Đổi quầy hoặc từ khóa thì bỏ lọc "Loại" và quay về 12 sản phẩm đầu
    effect(() => { this.c(); this.q(); this.loai(); this.limit.set(12); });
    effect(() => this.titleSvc.setTitle(this.title() + ' · FreshMart'));
  }

  protected clear(key: string): void {
    if (key === 'q' || key === 'sub' || key === 'all') this.router.navigate(['/san-pham'], { queryParams: this.cat() ? { c: this.cat()!.id, ...(key === 'q' && this.sub() ? { loai: this.sub() } : {}) } : {} });
    if (key === 'price' || key === 'all') this.price.set('');
    if (key === 'sale' || key === 'all') this.sale.set(false);
  }
}
