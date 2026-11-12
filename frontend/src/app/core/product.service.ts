import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DataService } from './data.service';
import { Category, Product } from './models';
import { norm } from './storage';

export { cdnImage } from './cdn-image';
import { cdnImage } from './cdn-image';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private data = inject(DataService);
  /** Sản phẩm đang bán (admin ẩn thì không hiện ở cửa hàng) */
  readonly all = computed(() => this.data.products().filter(p => p.active !== false));
  readonly categories = this.data.categories;
  private byId = computed(() => new Map(this.data.products().map(p => [p.id, p])));
  private catById = computed(() => new Map(this.categories().map(c => [c.id, c])));

  get(id: string | null | undefined): Product | undefined { return id ? this.byId().get(id) : undefined; }

  /** Danh sách chỉ có dữ liệu cho thẻ sản phẩm. Mô tả, bộ ảnh, dinh dưỡng tải khi mở chi tiết rồi nhớ lại (như các sàn lớn). */
  private http = inject(HttpClient);
  private details = signal<Record<string, Pick<Product, 'description' | 'usage' | 'storage' | 'gallery' | 'nutrition'>>>({});
  private pending = new Map<string, Promise<void>>();
  /** Bản đầy đủ nếu đã tải, không thì bản rút gọn trong danh sách */
  full(id: string | null | undefined): Product | undefined {
    const base = this.get(id);
    const extra = id ? this.details()[id] : undefined;
    return base && extra ? { ...base, ...extra } : base; // giá, tồn kho luôn lấy từ danh sách mới nhất
  }
  loadDetail(id: string): Promise<void> {
    if (this.details()[id]) return Promise.resolve();
    let job = this.pending.get(id);
    if (!job) {
      job = firstValueFrom(this.http.get<Product>(`/api/products/${encodeURIComponent(id)}`))
        .then(({ description, usage, storage, gallery, nutrition }) => this.details.update(d => ({ ...d, [id]: { description, usage, storage, gallery: gallery ?? [], nutrition } })))
        .catch(() => undefined)
        .finally(() => this.pending.delete(id));
      this.pending.set(id, job);
    }
    return job;
  }
  bySlug(slug: string | null | undefined): Product | undefined { return this.all().find(p => p.slug === slug); }
  category(id: string | null | undefined): Category | undefined { return id ? this.catById().get(id) : undefined; }

  /** Giá đang bán: giá giảm nếu có */
  price(p: Product): number { return p.sale_price > 0 && p.sale_price < p.price ? p.sale_price : p.price; }
  /** Phần trăm giảm, 0 nếu không giảm */
  off(p: Product): number { return p.sale_price > 0 && p.sale_price < p.price ? Math.round((1 - p.sale_price / p.price) * 100) : 0; }
  /** Ảnh sản phẩm. Ảnh Cloudinary được xin bản đã tối ưu: định dạng hợp trình duyệt (WebP/AVIF), nén tự động, giới hạn bề ngang. */
  img(p: Product, width = 480): string { return cdnImage(p.img ? p.img : p.image_url, width); }
  unit(p: Product): string { return String(p.unit || '').toLowerCase(); }
  /** Hàng cân ký bán theo nấc 0,5 kg; hàng đóng gói bán theo từng đơn vị */
  step(p: Product): number { return this.unit(p) === 'kg' ? 0.5 : 1; }
  /** 1.5 → "1,5" */
  qty(n: number): string { return String(+n.toFixed(2)).replace('.', ','); }
  /** Số lượng kèm đơn vị cho hàng cân ký: "0,5 kg"; hàng đếm cái chỉ hiện số */
  qtyLabel(p: Product, n: number): string { return this.unit(p) === 'kg' ? `${this.qty(n)} kg` : this.qty(n); }
  /** "Măng cụt trái từ 65g (giao ngẫu nhiên)" → bỏ phần trong ngoặc cho gọn */
  shortName(p: Product): string { return p.name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim(); }
  /** "Rau - Củ" → "Rau, củ" */
  catName(c: Category | string | undefined): string {
    const name = (typeof c === 'string' ? this.category(c)?.name : c?.name) ?? '';
    return name.split(' - ').map((x, i) => (i ? x.toLowerCase() : x)).join(', ').replace(' & ', ', ');
  }
  search(q: string): Product[] {
    const k = norm(q);
    return this.all().filter(p => norm(`${p.name} ${p.categoryName} ${p.brand ?? ''}`).includes(k));
  }
}
