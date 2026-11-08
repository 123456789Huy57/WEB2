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
    this.toast.show(`Đã chọn ${this.mp.ingredient(id)?.name ?? 'nguyên liệu'}. Bấm “Gợi ý món” để xem món hợp.`);
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
  protected clearSelected(): void { this.selected.set([]); store.set('mpSel', []); }
  protected toggle(id: string): void {
    const s = this.isSel(id) ? this.selected().filter(x => x !== id) : [...this.selected(), id];
    this.selected.set(s); store.set('mpSel', s);
  }

  // Bước 2: tiêu chí
  protected f = signal<PlannerFilters>({ mealType: 'all', time: 'all', difficulty: 'all', servings: 2, lowFat: false, highProtein: false, vegetarian: false });
  protected patch<K extends keyof PlannerFilters>(k: K, v: PlannerFilters[K]): void { this.f.update(x => ({ ...x, [k]: v })); }

  // Các tiêu chí mở rộng được thu thập ở frontend để nhóm backend tích hợp API recommendation.
  protected taste = signal('all');
  protected cuisine = signal('all');
  protected extraRequest = signal('');
  protected readonly tastes = ['Đậm đà', 'Thanh nhẹ', 'Cay', 'Chua ngọt', 'Béo thơm'];
  protected readonly cuisines = ['Việt Nam', 'Châu Á', 'Châu Âu', 'Hàn Quốc', 'Nhật Bản'];
  protected readonly mealOptions = [{ v: 'all', l: 'Bất kỳ' }, { v: 'breakfast', l: 'Bữa sáng' }, { v: 'lunch', l: 'Bữa trưa' }, { v: 'dinner', l: 'Bữa tối' }, { v: 'snack', l: 'Ăn vặt' }];
  protected readonly timeOptions = [{ v: 'all', l: 'Không giới hạn' }, { v: 'quick', l: 'Dưới 15 phút' }, { v: 'normal', l: '15 – 30 phút' }, { v: 'long', l: '30 – 60 phút' }];
  protected readonly difficultyOptions = [{ v: 'all', l: 'Bất kỳ' }, { v: 'easy', l: 'Dễ' }, { v: 'medium', l: 'Vừa' }, { v: 'hard', l: 'Thử thách' }];

  // Bước 3: kết quả
  protected results = signal<PlannerResult[] | null>(null);
  protected loading = signal(false);
  private resultsEl = viewChild<ElementRef<HTMLElement>>('resultsEl');
  protected generate(): void {
    if (!this.selected().length) { this.toast.show('Chọn ít nhất 1 nguyên liệu bạn đang có'); document.getElementById('ing-q')?.focus(); return; }
    this.loading.set(true);
    setTimeout(() => {
      this.results.set(this.mp.generate(this.selected(), this.f()));
      this.loading.set(false);
      setTimeout(() => this.resultsEl()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }, 450);
  }

  // Bước 4: xem món, thêm phần còn thiếu vào giỏ
  private dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected current = signal<Recipe | null>(null);
  protected unchecked = signal<string[]>([]);
  protected purchase = computed(() => { const r = this.current(); return r ? r.ingredients.map(l => this.mp.purchase(l, this.f().servings, r)) : []; });
  protected missing = computed(() => this.purchase().filter(x => !this.isSel(x.line.ingredientId)));
  protected chosen = computed(() => this.missing().filter(x => x.product && !this.unchecked().includes(x.line.ingredientId)));
  protected chosenTotal = computed(() => this.chosen().reduce((s, x) => s + x.total, 0));
  protected relatedRecipes = computed(() => {
    const current = this.current();
    if (!current) return [];
    const ids = new Set(current.ingredients.map(x => x.ingredientId));
    return this.data.recipes()
      .filter(recipe => recipe.id !== current.id && recipe.isActive !== false)
      .map(recipe => ({ recipe, overlap: recipe.ingredients.filter(line => ids.has(line.ingredientId)).length }))
      .filter(item => item.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3)
      .map(item => item.recipe);
  });

  protected stepTitle(step: Recipe['steps'][number], index: number): string {
    return typeof step === 'string' ? `Bước ${index + 1}` : step.title;
  }
  protected stepDescription(step: Recipe['steps'][number]): string {
    return typeof step === 'string' ? step : step.description;
  }
  protected stepDuration(step: Recipe['steps'][number]): number | null {
    return typeof step === 'string' ? null : step.durationMinutes ?? null;
  }
  protected stepTip(step: Recipe['steps'][number]): string | null {
    return typeof step === 'string' ? null : step.tip ?? null;
  }
  protected openRelated(id: string): void {
    const recipe = this.mp.recipe(id);
    if (!recipe) return;
    this.current.set(recipe);
    this.unchecked.set([]);
    this.dlg().nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
