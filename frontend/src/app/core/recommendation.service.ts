import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Product } from './models';
import { ProductService } from './product.service';

/** Nguồn của một gợi ý: luật kết hợp từ đơn hàng, từ công thức Meal Planner, hoặc món bán chạy cùng quầy. */
export type RecommendationSource = 'orders' | 'recipes' | 'category';
export interface Recommendation { product: Product; source: RecommendationSource; confidence?: number; lift?: number; }
interface ApiResult { items: { productId: string; source: RecommendationSource; confidence?: number; lift?: number }[]; transactions: number; }

/** Gợi ý "Thường được mua cùng" (luật kết hợp, xem backend/src/modules/recommendations). Lỗi mạng thì trả rỗng: gợi ý không bắt buộc. */
@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private http = inject(HttpClient);
  private ps = inject(ProductService);

  alsoBought(productId: string, limit = 4): Promise<Recommendation[]> {
    return this.fetch(`/api/products/${encodeURIComponent(productId)}/also-bought?limit=${limit}`);
  }
  forCart(limit = 4): Promise<Recommendation[]> {
    return this.fetch(`/api/cart/recommendations?limit=${limit}`);
  }

  private async fetch(url: string): Promise<Recommendation[]> {
    try {
      const r = await firstValueFrom(this.http.get<ApiResult>(url));
      return r.items.flatMap(i => {
        const product = this.ps.get(i.productId);
        return product ? [{ product, source: i.source, confidence: i.confidence, lift: i.lift }] : [];
      });
    } catch {
      return [];
    }
  }
}
