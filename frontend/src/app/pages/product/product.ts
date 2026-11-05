import { Component, ViewEncapsulation, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ProductService } from '../../core/product.service';
import { CartService } from '../../core/cart.service';
import { WishlistService } from '../../core/wishlist.service';
import { ToastService } from '../../core/toast.service';
import { CompareService } from '../../core/compare.service';
import { MEAL_LABEL, MealPlannerService } from '../../core/meal-planner.service';
import { VndPipe } from '../../shared/vnd.pipe';
import { ProductCard } from '../../shared/product-card';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';

@Component({
  selector: 'fm-product',
  imports: [RouterLink, VndPipe, ProductCard, ImgFallbackDirective],
  templateUrl: './product.html',
  styleUrl: './product.css',
  encapsulation: ViewEncapsulation.None
})
export class ProductPage {
  /** /san-pham/:id — nhận cả id (p-0021) lẫn slug */
  readonly id = input.required<string>();
  protected ps = inject(ProductService);
  private cart = inject(CartService);
  private wish = inject(WishlistService);
  private toast = inject(ToastService);
  private title = inject(Title);
  protected cmp = inject(CompareService);
  protected mp = inject(MealPlannerService);
  protected meal = MEAL_LABEL;
  protected recipes = computed(() => (this.p() ? this.mp.recipesWithProduct(this.p()!.id) : []));
  /** Tên nguyên liệu gọn ("Trứng gà ta") thay cho tên sản phẩm dài */
  protected cookName = computed(() => this.mp.ingredient(this.recipes()[0]?.ingredientId ?? '')?.name ?? this.name());
  protected compared = computed(() => { this.cmp.ids(); return !!this.p() && this.cmp.has(this.p()!.id); });

  protected p = computed(() => this.ps.get(this.id()) ?? this.ps.bySlug(this.id()));
  protected name = computed(() => (this.p() ? this.ps.shortName(this.p()!) : ''));
  protected brandLine = computed(() => [this.p()?.brand, this.p()?.subcategoryName].filter(Boolean).join(' · '));
  protected step = computed(() => (this.p() ? this.ps.step(this.p()!) : 1));
  protected qty = signal(1);
  protected imgIndex = signal(0);
  protected images = computed(() => {
    const p = this.p();
    if (!p) return [];
    return [this.ps.img(p), ...(p.img ? [] : (p.gallery ?? []).slice(0, 3))];
  });
  protected unitNote = computed(() => {
    const p = this.p()!; const u = this.ps.unit(p);
    return `Giá cho 1 ${u}` + (u === 'kg' ? ' · tính theo cân thực tế khi soạn đơn' : p.netWeightGram ? ` · khoảng ${p.netWeightGram} g` : '');
  });
  protected nutrition = computed(() => {
    const n = this.p()?.nutrition ?? {};
    const rows: [string, number | undefined, string][] = [['Năng lượng', n.energy_kcal, 'kcal'], ['Đạm', n.protein, 'g'], ['Béo', n.fat, 'g'], ['Tinh bột', n.carbohydrates, 'g'], ['Đường', n.sugars, 'g'], ['Chất xơ', n.fiber, 'g']];
    return rows.filter(r => r[1] != null).map(([label, v, unit]) => ({ label, value: String(v).replace('.', ','), unit }));
  });
  protected related = computed(() => {
    const p = this.p();
    return p ? this.ps.all().filter(x => x.category === p.category && x.id !== p.id).sort((a, b) => b.sold_count - a.sold_count).slice(0, 4) : [];
  });
  protected wished = computed(() => { this.wish.ids(); return !!this.p() && this.wish.has(this.p()!.id); });

  constructor() {
    effect(() => { this.id(); this.qty.set(1); this.imgIndex.set(0); });
    effect(() => { if (this.name()) this.title.setTitle(this.name() + ' · FreshMart'); });
  }

  protected async add(): Promise<void> {
    const p = this.p()!;
    const before = this.cart.qty(p.id);
    await this.cart.add(p.id, this.qty());
    const added = this.cart.qty(p.id) - before;
    if (added <= 0 && before < p.stock) return; // lỗi đã được báo bằng toast từ giỏ
    this.toast.show(added <= 0 ? `Giỏ đã có tối đa số lượng còn trong kho (${this.ps.qty(p.stock)} ${this.ps.unit(p)})`
      : added < this.qty() ? `Chỉ thêm được ${this.ps.qty(added)} ${this.ps.unit(p)} vì kho còn ${this.ps.qty(p.stock)} ${this.ps.unit(p)}`
      : `Đã thêm ${this.ps.qty(added)} ${this.ps.unit(p)} ${this.name()} vào giỏ`);
  }
  protected toggleCompare(): void {
    if (!this.cmp.toggle(this.p()!.id)) this.toast.show('Chỉ so sánh tối đa 3 sản phẩm. Bỏ bớt ở trang So sánh nhé.');
  }
  protected toggleWish(): void {
    this.toast.show(this.wish.toggle(this.p()!.id) ? 'Đã lưu vào yêu thích' : 'Đã bỏ khỏi yêu thích');
  }
}
