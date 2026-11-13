import { Component, ElementRef, ViewEncapsulation, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DataService } from '../../core/data.service';
import { ProductService } from '../../core/product.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';
import { CommunityService } from '../../core/community.service';
import { DIFF_LABEL, INGREDIENT_GROUPS, MEAL_LABEL, MealPlannerService, PlannerFilters, PlannerResult, PurchaseLine } from '../../core/meal-planner.service';
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
  imports: [VndPipe, ImgFallbackDirective, RouterLink],
  templateUrl: './meal-planner.html',
  styleUrl: './meal-planner.css',
  encapsulation: ViewEncapsulation.None
})
export class MealPlanner {
  /** /meal-planner?mon=rec-003 mở thẳng công thức (link từ trang chủ) */
  readonly mon = input<string>();
  /** ?co=ing-a,ing-b : nguyên liệu đang có, chọn sẵn khi mở từ link */
  readonly co = input<string>();
  /** ?tu=cong-dong : mở từ bài trong Cộng đồng, hiện nút quay lại */
  readonly tu = input<string>();
  protected mp = inject(MealPlannerService);
  protected ps = inject(ProductService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private data = inject(DataService);
  private http = inject(HttpClient);
  private router = inject(Router);
  protected cs = inject(CommunityService);

  // Tab: tự chọn nguyên liệu / xem cộng đồng đang nấu gì
  protected tab = signal<'pick' | 'community'>('pick');
  protected trend = signal<Trending | null>(null);
  protected async showCommunity(): Promise<void> {
    this.tab.set('community');
    try { this.trend.set(await firstValueFrom(this.http.get<Trending>('/api/recipes/trending'))); }
    catch { this.trend.set({ period: 'today', day: '', cooks: 0, recipes: [], ingredients: [] }); }
  }
  protected explore(event: Event): void {
    event.preventDefault();
    this.tab.set('pick');
    setTimeout(() => this.toolEl()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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

  /** Nút nấu ngay ở món nổi bật (không mở hộp thoại) */
  protected async cookNow2(r: Recipe): Promise<void> {
    await this.cooked(r);
    this.toast.show(`Chúc bạn nấu ${r.name} ngon miệng!`);
  }

  protected groups = INGREDIENT_GROUPS;
  protected meal = MEAL_LABEL;
  protected diff = DIFF_LABEL;
  // Bước 1: chọn nguyên liệu đang có (nhớ lại lần trước)
  protected selected = signal<string[]>(store.get('mpSel', []));
  protected group = signal('all');
  protected q = signal('');
  protected visible = computed(() => {
    const k = norm(this.q().trim());
    return this.mp.ingredients().filter(i => (this.group() === 'all' || i.categoryId === this.group()) && (!k || norm(i.name).includes(k)));
  });
  // Chia trang danh sách nguyên liệu: mỗi trang vài món để khung chọn luôn gọn, không phải cuộn dài
  protected readonly ingPageSize = 8;
  protected ingPage = signal(0);
  protected ingPages = computed(() => Math.max(1, Math.ceil(this.visible().length / this.ingPageSize)));
  protected pagedIngs = computed(() => {
    const page = Math.min(this.ingPage(), this.ingPages() - 1);
    return this.visible().slice(page * this.ingPageSize, (page + 1) * this.ingPageSize);
  });
  protected setQuery(v: string): void { this.q.set(v); this.ingPage.set(0); }
  protected setGroup(g: string): void { this.group.set(g); this.ingPage.set(0); }
  protected isSel(id: string): boolean { return this.selected().includes(id); }
  protected clearSelected(): void { this.selected.set([]); store.set('mpSel', []); }
  protected toggle(id: string): void {
    const s = this.isSel(id) ? this.selected().filter(x => x !== id) : [...this.selected(), id];
    this.selected.set(s); store.set('mpSel', s);
  }

  // Bước 2: tiêu chí
  private static readonly DEFAULT_FILTERS: PlannerFilters = { mealType: 'all', time: 'all', difficulty: 'all', servings: 2, lowFat: false, highProtein: false, vegetarian: false };
  protected f = signal<PlannerFilters>({ ...MealPlanner.DEFAULT_FILTERS });
  protected groupName = computed(() => new Map(this.groups));
  protected patch<K extends keyof PlannerFilters>(k: K, v: PlannerFilters[K]): void { this.f.update(x => ({ ...x, [k]: v })); }

  protected readonly mealOptions = [{ v: 'all', l: 'Bất kỳ' }, { v: 'breakfast', l: 'Bữa sáng' }, { v: 'lunch', l: 'Bữa trưa' }, { v: 'dinner', l: 'Bữa tối' }, { v: 'snack', l: 'Ăn vặt' }];
  protected readonly timeOptions = [{ v: 'all', l: 'Không giới hạn' }, { v: 'quick', l: 'Dưới 15 phút' }, { v: 'normal', l: '15 – 30 phút' }, { v: 'long', l: '30 – 60 phút' }];
  protected readonly servingOptions = [1, 2, 3, 4, 5, 6];
  protected readonly difficultyOptions = [{ v: 'all', l: 'Bất kỳ' }, { v: 'easy', l: 'Dễ' }, { v: 'medium', l: 'Vừa' }, { v: 'hard', l: 'Thử thách' }];

  // Bước 3: kết quả
  protected results = signal<PlannerResult[] | null>(null);
  protected loading = signal(false);
  private toolEl = viewChild<ElementRef<HTMLElement>>('tool');
  private resultsEl = viewChild<ElementRef<HTMLElement>>('resultsEl');
  protected generate(): void {
    if (!this.selected().length) { this.toast.show('Chọn ít nhất 1 nguyên liệu bạn đang có'); document.getElementById('ing-q')?.focus(); return; }
    this.loading.set(true);
    setTimeout(() => {
      this.results.set(this.mp.generate(this.selected(), this.f()));
      this.featuredId.set(null);
      this.otherPage.set(0);
      this.featTab.set('steps');
      this.qtyOverride.set({});
      this.loading.set(false);
      // Kết quả nằm dưới hai ô chọn nên cuộn xuống cho khách thấy ngay.
      setTimeout(() => this.resultsEl()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }); // tính ngay trên máy (không giả vờ chờ); kết quả hiện dần bằng hiệu ứng .fade-in
  }

  /** Đưa bộ chọn về như lúc mới mở trang */
  protected reset(): void {
    this.clearSelected();
    this.f.set({ ...MealPlanner.DEFAULT_FILTERS });
    this.q.set(''); this.group.set('all'); this.ingPage.set(0); this.otherPage.set(0);
    this.results.set(null); this.featuredId.set(null); this.qtyOverride.set({});
  }

  // Món nổi bật (mặc định món hợp nhất) và phần mua hàng ngay trên trang, không cần mở hộp thoại
  protected featuredId = signal<string | null>(null);
  protected featTab = signal<'steps' | 'nutrition' | 'tips'>('steps');
  protected featured = computed(() => {
    const res = this.results();
    if (!res?.length) return null;
    return res.find(x => x.recipe.id === this.featuredId()) ?? res[0];
  });
  protected others = computed(() => (this.results() ?? []).filter(x => x !== this.featured()));
  protected readonly otherPageSize = 6;
  protected otherPage = signal(0);
  protected otherPages = computed(() => Math.max(1, Math.ceil(this.others().length / this.otherPageSize)));
  protected pagedOthers = computed(() => {
    const page = Math.min(this.otherPage(), this.otherPages() - 1);
    return this.others().slice(page * this.otherPageSize, (page + 1) * this.otherPageSize);
  });
  protected featLines = computed(() => {
    const x = this.featured();
    return x ? x.recipe.ingredients.map(l => this.mp.purchase(l, this.f().servings, x.recipe)) : [];
  });
  protected featMissing = computed(() => this.featLines().filter(x => !this.isSel(x.line.ingredientId)));
  /** Tối đa 4 nguyên liệu chú thích quanh ảnh món: ưu tiên món bạn đã có */
  protected callouts = computed(() => [...this.featLines()].sort((a, b) => Number(this.isSel(b.line.ingredientId)) - Number(this.isSel(a.line.ingredientId))).slice(0, 4));
  protected featTips = computed(() => {
    const r = this.featured()?.recipe;
    if (!r) return [];
    return r.tips?.length ? r.tips : r.steps.map(s => this.stepTip(s)).filter((t): t is string => !!t);
  });
  private featureEl = viewChild<ElementRef<HTMLElement>>('featureEl');
  protected feature(id: string): void {
    this.featuredId.set(id); this.featTab.set('steps'); this.qtyOverride.set({});
    setTimeout(() => this.featureEl()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  protected matchPct(x: PlannerResult): number {
    const total = x.recipe.ingredients.length;
    return total ? Math.round((x.matched / total) * 100) : 0;
  }

  // Số lượng mua từng dòng, chỉnh bằng nút − / + theo nấc bán (0,5 kg hoặc 1 đơn vị)
  protected qtyOverride = signal<Record<string, number>>({});
  protected lineQty(x: PurchaseLine): number { return this.qtyOverride()[x.line.ingredientId] ?? x.cartQty; }
  protected bump(x: PurchaseLine, dir: 1 | -1): void {
    if (!x.product) return;
    const step = this.ps.step(x.product);
    const q = Math.max(step, Math.min(x.product.stock, +(this.lineQty(x) + dir * step).toFixed(2)));
    this.qtyOverride.update(o => ({ ...o, [x.line.ingredientId]: q }));
  }
  protected busy = signal<string | null>(null);
  protected async addLine(x: PurchaseLine): Promise<void> {
    const p = x.product;
    if (!p || this.busy()) return;
    this.busy.set(x.line.ingredientId);
    try {
      const before = this.cart.qty(p.id);
      await this.cart.add(p.id, this.lineQty(x));
      const added = this.cart.qty(p.id) - before;
      if (added > 0) this.toast.show(`Đã thêm ${this.ps.qty(added)} ${this.ps.unit(p)} ${this.ps.shortName(p)} vào giỏ`);
    } finally { this.busy.set(null); }
  }
  /** Thêm cả phần còn thiếu của một món (bỏ qua gia vị và hàng bán nguyên thùng, như hộp thoại công thức) */
  protected async addRecipe(r: Recipe, useOverrides = false): Promise<void> {
    if (this.busy()) return;
    const lines = r.ingredients.map(l => this.mp.purchase(l, this.f().servings, r))
      .filter(x => x.product && !this.isSel(x.line.ingredientId) && !x.bulk && x.ingredient?.categoryId !== 'condiments');
    if (!lines.length) { this.toast.show(`Bạn đã có đủ nguyên liệu chính cho ${r.name}`); return; }
    this.busy.set(r.id);
    try {
      const { added, failed } = await this.cart.addMany(lines.map(x => ({ id: x.product!.id, qty: useOverrides ? this.lineQty(x) : x.cartQty })));
      if (added) void this.cooked(r);
      this.toast.show(failed.length
        ? `Đã thêm ${added}/${lines.length} sản phẩm. Chưa thêm đủ: ${failed.join(', ')}`
        : `Đã thêm ${added} sản phẩm còn thiếu của “${r.name}” vào giỏ`);
    } finally { this.busy.set(null); }
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
      .slice(0, 4)
      .map(item => item.recipe);
  });

  // ---- Trang chi tiết món: lưu công thức, chia sẻ lên Cộng đồng, tiến độ nấu ----
  protected doneSteps = signal<number[]>([]);
  protected stepsLeft = computed(() => { const r = this.current(); return r ? r.steps.length - this.doneSteps().length : 0; });
  protected currentStep = computed(() => { const r = this.current(); return r ? r.steps.findIndex((_, i) => !this.doneSteps().includes(i)) : -1; });
  protected progress = computed(() => { const r = this.current(); return r?.steps.length ? Math.round((this.doneSteps().length / r.steps.length) * 100) : 0; });
  protected toggleStep(i: number): void { this.doneSteps.update(l => (l.includes(i) ? l.filter(x => x !== i) : [...l, i])); }
  protected communityPosts = computed(() => { const r = this.current(); return r ? this.cs.postsForRecipe(r.id) : []; });
  /** Mô tả ngắn dựng từ dữ liệu có sẵn (công thức chưa có trường mô tả riêng) */
  protected describe(r: Recipe): string {
    if (r.description) return r.description;
    const names = r.ingredients.map(l => this.mp.ingredient(l.ingredientId)?.name).filter((x): x is string => !!x);
    const main = names.slice(0, 3).join(', ');
    return `${this.meal[r.mealType]} mức ${this.diff[r.difficulty].toLowerCase()}, xong trong khoảng ${this.mp.totalTime(r)} phút${main ? ', từ ' + main + (names.length > 3 ? ' và ' + (names.length - 3) + ' nguyên liệu khác' : '') : ''}.`;
  }
  /** Tỷ lệ năng lượng từ đạm, tinh bột, chất béo (4 – 4 – 9 kcal/g) để vẽ thanh dinh dưỡng */
  protected macros(r: Recipe): { label: string; g: number; pct: number }[] {
    const n = r.nutrition, p = n.protein * 4, c = n.carbs * 4, f = n.fat * 9, t = p + c + f || 1;
    return [{ label: 'Đạm', g: n.protein, pct: Math.round((p / t) * 100) }, { label: 'Tinh bột', g: n.carbs, pct: Math.round((c / t) * 100) }, { label: 'Chất béo', g: n.fat, pct: Math.round((f / t) * 100) }];
  }
  protected ingImg(x: PurchaseLine): string { return x.ingredient ? this.mp.ingredientImage(x.ingredient) : ''; }
  protected setServings(n: number): void { this.patch('servings', Math.min(6, Math.max(1, n))); }
  protected saveRecipe(r: Recipe): void { this.cs.toggleRecipeSaved(r.id); }
  /** Luồng A: mở khung đăng bài trong Cộng đồng, điền sẵn món này (tên, ảnh, nguyên liệu lấy theo id món) */
  protected shareToCommunity(r: Recipe): void {
    this.dlg().nativeElement.close();
    void this.router.navigate(['/cong-dong'], { queryParams: { 'chia-se': r.id } });
  }
  protected startCooking(): void { this.dlg().nativeElement.querySelector('#d-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  /** Bước dạng chữ "Sơ chế: rửa sạch…" (dữ liệu db:sync) tách thành tiêu đề + nội dung; bước dạng object giữ nguyên */
  private splitStep(step: string): [string, string] | null {
    const m = /^([^:.]{2,40}):\s*(.+)$/s.exec(step);
    return m ? [m[1], m[2]] : null;
  }
  protected stepTitle(step: Recipe['steps'][number], index: number): string {
    return typeof step === 'string' ? this.splitStep(step)?.[0] ?? `Bước ${index + 1}` : step.title;
  }
  protected stepDescription(step: Recipe['steps'][number]): string {
    return typeof step === 'string' ? this.splitStep(step)?.[1] ?? step : step.description;
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
    this.doneSteps.set([]);
    this.dlg().nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected open(id: string): void {
    this.current.set(this.mp.recipe(id) ?? null);
    this.doneSteps.set([]);
    // Không tự chọn: hàng bán nguyên thùng/bao (thùng sữa 48 hộp) và gia vị (nhà thường có sẵn). Khách tự tick nếu cần.
    this.unchecked.set(this.purchase().filter(x => x.bulk || x.ingredient?.categoryId === 'condiments').map(x => x.line.ingredientId));
    this.dlg().nativeElement.showModal();
    this.dlg().nativeElement.scrollTop = 0;
  }
  constructor() {
    // ?co=...: chọn sẵn nguyên liệu. ?mon=...: mở công thức. Công thức nạp nền nên chờ có dữ liệu rồi mới mở (link từ Cộng đồng đến rất nhanh).
    const have = (this.co() ?? '').split(',').filter(id => this.mp.ingredient(id));
    if (have.length) { this.selected.set(have); store.set('mpSel', have); }
    let opened = '';
    effect(() => {
      const id = this.mon();
      if (!id || id === opened || !this.mp.recipe(id)) return;
      opened = id;
      setTimeout(() => this.open(id));
    });
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
