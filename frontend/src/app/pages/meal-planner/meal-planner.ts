import { AfterViewInit, Component, ElementRef, ViewEncapsulation, computed, inject, input, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DataService } from '../../core/data.service';
import { ProductService } from '../../core/product.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';
import { DIFF_LABEL, INGREDIENT_GROUPS, MEAL_LABEL, MealPlannerService, PlannerFilters, PlannerResult } from '../../core/meal-planner.service';
import { Recipe } from '../../core/models';
import { norm, store } from '../../core/storage';
import { VndPipe } from '../../shared/vnd.pipe';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';

/** Tab Cộng đồng: món được nấu nhiều nhất hôm nay (hoặc 7 ngày nếu hôm nay chưa có ai) */
interface Trending {
  period: 'today' | 'week'; day: string; cooks: number;
  recipes: { recipeId: string; name: string; imageUrl: string; mealType: Recipe['mealType']; count: number }[];
  ingredients: { ingredientId: string; name: string; count: number }[];
}

@Component({
  selector: 'fm-meal-planner',
  imports: [VndPipe, ImgFallbackDirective],
  templateUrl: './meal-planner.html',
  styleUrl: './meal-planner.css',
  encapsulation: ViewEncapsulation.None
})
export class MealPlanner implements AfterViewInit {
  /** /meal-planner?mon=rec-003 mở thẳng công thức (link từ trang chủ) */
  readonly mon = input<string>();
  /** ?co=ing-a,ing-b : nguyên liệu đang có, chọn sẵn khi mở từ link */
  readonly co = input<string>();
  protected mp = inject(MealPlannerService);
  protected ps = inject(ProductService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private data = inject(DataService);
  private http = inject(HttpClient);

  // Tab: tự chọn nguyên liệu / xem cộng đồng đang nấu gì
  protected tab = signal<'pick' | 'community'>('pick');
  protected trend = signal<Trending | null>(null);
  protected async showCommunity(): Promise<void> {
    this.tab.set('community');
    try { this.trend.set(await firstValueFrom(this.http.get<Trending>('/api/recipes/trending'))); }
    catch { this.trend.set({ period: 'today', day: '', cooks: 0, recipes: [], ingredients: [] }); }
  }
  /** Bấm nguyên liệu hot: chọn sẵn rồi quay về tab tự chọn */
  protected useHot(id: string): void {
    if (!this.isSel(id)) this.toggle(id);
    this.tab.set('pick');
    this.toast.show(`Đã chọn ${this.mp.ingredient(id)?.name ?? 'nguyên liệu'}. Danh sách món đã cập nhật.`);
  }
  /** Ghi một lượt nấu cho tab Cộng đồng (mỗi người một lượt/món/ngày, server tự chặn bấm lặp) */
  private async cooked(r: Recipe): Promise<void> {
    try { await firstValueFrom(this.http.post(`/api/recipes/${r.id}/cook`, { servings: this.f().servings })); } catch { /* không chặn việc mua hàng */ }
  }
  protected async cookNow(): Promise<void> {
    const r = this.current();
    if (!r) return;
    await this.cooked(r);
    this.toast.show(`Chúc bạn nấu ${r.name} ngon miệng!`);
  }

  protected groups = INGREDIENT_GROUPS;
  protected meal = MEAL_LABEL;
  protected diff = DIFF_LABEL;
  protected recipeCount = computed(() => this.data.recipes().length);

  // Bước 1: chọn nguyên liệu đang có (nhớ lại lần trước)
  protected selected = signal<string[]>(store.get('mpSel', []));
  protected group = signal('all');
  protected q = signal('');
  protected visible = computed(() => {
    const k = norm(this.q().trim());
    return this.mp.ingredients().filter(i => (this.group() === 'all' || i.categoryId === this.group()) && (!k || norm(i.name).includes(k)));
  });
  protected isSel(id: string): boolean { return this.selected().includes(id); }
  protected toggle(id: string): void {
    const s = this.isSel(id) ? this.selected().filter(x => x !== id) : [...this.selected(), id];
    this.selected.set(s); store.set('mpSel', s);
  }

  protected clearAll(): void { this.selected.set([]); store.set('mpSel', []); }

  // Bước 2: tiêu chí (chip bấm là lọc ngay)
  protected f = signal<PlannerFilters>({ mealType: 'all', time: 'all', difficulty: 'all', servings: 2, lowFat: false, highProtein: false, vegetarian: false });
  protected patch<K extends keyof PlannerFilters>(k: K, v: PlannerFilters[K]): void { this.f.update(x => ({ ...x, [k]: v })); }
  protected resetFilters(): void { this.f.update(x => ({ ...x, mealType: 'all', time: 'all', difficulty: 'all', lowFat: false, highProtein: false, vegetarian: false })); }
  protected readonly mealOpts: [PlannerFilters['mealType'], string][] = [['all', 'Mọi bữa'], ['breakfast', 'Sáng'], ['lunch', 'Trưa'], ['dinner', 'Tối'], ['snack', 'Ăn vặt']];
  protected readonly timeOpts: [PlannerFilters['time'], string][] = [['all', 'Mọi thời gian'], ['quick', 'Dưới 15 phút'], ['normal', '15–30 phút'], ['long', '30–60 phút']];
  protected readonly diffOpts: [PlannerFilters['difficulty'], string][] = [['all', 'Mọi độ khó'], ['easy', 'Dễ'], ['medium', 'Vừa'], ['hard', 'Khó']];

  // Bước 3: kết quả cập nhật ngay khi chọn nguyên liệu hay đổi bộ lọc (tính trên trình duyệt, không cần bấm nút)
  protected results = computed<PlannerResult[]>(() =>
    this.selected().length ? this.mp.generate(this.selected(), this.f()) : this.mp.browse(this.f()));
  private resultsEl = viewChild<ElementRef<HTMLElement>>('resultsEl');
  /** Điện thoại: tủ bếp nằm trên, bấm thanh dưới để nhảy xuống danh sách món */
  protected jump(): void { this.resultsEl()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  protected missingNames(r: Recipe): string {
    const names = r.ingredients.filter(l => !this.isSel(l.ingredientId)).map(l => this.mp.ingredient(l.ingredientId)?.name).filter(Boolean) as string[];
    return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
  }

  // Bước 4: xem món, thêm phần còn thiếu vào giỏ
  private dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected current = signal<Recipe | null>(null);
  protected unchecked = signal<string[]>([]);
  protected purchase = computed(() => { const r = this.current(); return r ? r.ingredients.map(l => this.mp.purchase(l, this.f().servings, r)) : []; });
  protected missing = computed(() => this.purchase().filter(x => !this.isSel(x.line.ingredientId)));
  protected chosen = computed(() => this.missing().filter(x => x.product && !this.unchecked().includes(x.line.ingredientId)));
  protected chosenTotal = computed(() => this.chosen().reduce((s, x) => s + x.total, 0));

  protected open(id: string): void {
    this.current.set(this.mp.recipe(id) ?? null);
    // Không tự chọn: hàng bán nguyên thùng/bao (thùng sữa 48 hộp) và gia vị (nhà thường có sẵn). Khách tự tick nếu cần.
    this.unchecked.set(this.purchase().filter(x => x.bulk || x.ingredient?.categoryId === 'condiments').map(x => x.line.ingredientId));
    this.dlg().nativeElement.showModal();
    this.dlg().nativeElement.scrollTop = 0;
  }
  ngAfterViewInit(): void {
    const have = (this.co() ?? '').split(',').filter(id => this.mp.ingredient(id));
    if (have.length) { this.selected.set(have); store.set('mpSel', have); }
    const id = this.mon();
    if (id && this.mp.recipe(id)) setTimeout(() => this.open(id));
  }
  /** "Sơ chế: rửa sạch…" → ["Sơ chế:", "rửa sạch…"] để in đậm tên bước */
  protected stepTitle(s: string): [string, string] | null {
    const m = /^([^:.]{2,28}:)\s*(.+)$/s.exec(s);
    return m ? [m[1], m[2]] : null;
  }
  protected toggleBuy(id: string): void {
    this.unchecked.update(u => (u.includes(id) ? u.filter(x => x !== id) : [...u, id]));
  }
  protected readonly adding = signal(false);

  protected async addMissing(): Promise<void> {
    if (this.adding()) return;
    const items = this.chosen(), recipe = this.current()!, name = recipe.name;
    this.adding.set(true);
    try {
      const { added, failed } = await this.cart.addMany(items.map(x => ({ id: x.product!.id, qty: x.cartQty })));
      if (added) void this.cooked(recipe);
      if (!failed.length) {
        this.dlg().nativeElement.close();
        this.toast.show(`Đã thêm ${added} sản phẩm còn thiếu của “${name}” vào giỏ`);
      } else {
        // Giữ hộp thoại mở để khách thấy món nào chưa thêm được và chọn món khác.
        this.toast.show(`Đã thêm ${added}/${items.length} sản phẩm. Chưa thêm đủ: ${failed.join(', ')} (hết hàng hoặc không đủ số lượng)`);
      }
    } finally {
      this.adding.set(false);
    }
  }
}
