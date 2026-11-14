import { ingredientMatch, rankIngredients } from '../../core/ingredient-priority';
import { Component, ElementRef, ViewEncapsulation, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
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
import { RecipeDialog } from '../../shared/recipe-dialog';

/** Tab Cộng đồng: món được nấu nhiều nhất hôm nay (hoặc 7 ngày nếu hôm nay chưa có ai) */

@Component({
  selector: 'fm-meal-planner',
  imports: [VndPipe, ImgFallbackDirective, RecipeDialog],
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

  /** "Mọi người đang nấu gì" mở thẳng trang Cộng đồng (bảng tin bài người dùng đã nấu) */
  protected showCommunity(): void {
    void this.router.navigate(['/cong-dong']);
  }
  protected explore(event: Event): void {
    event.preventDefault();
    setTimeout(() => this.toolEl()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  /** Ghi một lượt nấu lên server để thống kê món được nấu (mỗi tài khoản một lượt/món/ngày, server tự chặn bấm lặp).
   *  Chỉ thành viên đã đăng nhập mới ghi lượt; khách vẫn mua nguyên liệu bình thường nhưng không được tính. */
  private async cooked(r: Recipe): Promise<void> {
    if (!this.cs.me()) return;
    try { await firstValueFrom(this.http.post(`/api/recipes/${r.id}/cook`, { servings: this.f().servings })); } catch { /* không chặn việc mua hàng */ }
  }

  /** Nút nấu ngay ở món nổi bật (không mở hộp thoại) */
  protected async cookNow2(r: Recipe): Promise<void> {
    if (!this.cs.requireLogin('Đăng nhập để ghi lại món bạn nấu')) return;
    await this.cooked(r);
    this.toast.show(`Chúc bạn nấu ${r.name} ngon miệng!`);
  }

  protected groups = INGREDIENT_GROUPS;
  protected meal = MEAL_LABEL;
  protected diff = DIFF_LABEL;
  // Bước 1: chọn nguyên liệu đang có (nhớ lại lần trước)
  // Một nguồn duy nhất cho các nguyên liệu đã chọn; tìm kiếm, đổi nhóm, mở rộng hay thu gọn đều không đụng tới
  protected selected = signal<string[]>([...new Set(store.get<string[]>('mpSel', []))]);
  protected group = signal('all');
  protected q = signal('');
  /** false: chỉ hiện nguyên liệu phổ biến; true: hiện toàn bộ nhóm đang chọn */
  protected showAll = signal(false);
  /** Số công thức dùng mỗi nguyên liệu, để xếp các nguyên liệu ngoài danh sách phổ biến */
  private recipeUse = computed(() => {
    const m = new Map<string, number>();
    this.data.recipes().forEach(r => r.ingredients.forEach(l => m.set(l.ingredientId, (m.get(l.ingredientId) ?? 0) + 1)));
    return m;
  });
  private ranked = computed(() => rankIngredients(this.mp.ingredients(), this.recipeUse()));
  /** Nhóm đang chọn, đã xếp theo mức ưu tiên */
  private inGroup = computed(() => this.group() === 'all' ? this.ranked() : this.ranked().filter(i => i.categoryId === this.group()));
  /** Số món hiện khi thu gọn: 16 ở "Tất cả", 8 trong một nhóm */
  private collapsedCount = computed(() => this.group() === 'all' ? 16 : 8);
  /** Đang tìm: tìm trên toàn bộ dữ liệu, không phụ thuộc nhóm hay trạng thái thu gọn */
  protected searching = computed(() => this.q().trim().length > 0);
  protected visible = computed(() => {
    if (this.searching()) {
      return this.ranked()
        .map((i, rank) => ({ i, score: ingredientMatch(i, this.q()), rank }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score || a.rank - b.rank)
        .map(x => x.i);
    }
    const list = this.inGroup();
    return this.showAll() || list.length <= this.collapsedCount() + 2 ? list : list.slice(0, this.collapsedCount());
  });
  /** Số nguyên liệu đang bị ẩn sau nút "Xem thêm" */
  protected hiddenCount = computed(() => this.searching() ? 0 : this.inGroup().length - this.visible().length);
  protected listLabel = computed(() => {
    if (this.searching()) return `Kết quả cho “${this.q().trim()}”`;
    const g = this.group() === 'all' ? '' : ' ' + (this.groupName().get(this.group()) ?? '').toLowerCase();
    return this.showAll() || !this.hiddenCount() && this.group() !== 'all' ? `Tất cả${g}` : `Nguyên liệu${g} phổ biến`;
  });
  protected setQuery(v: string): void { this.q.set(v); }
  protected setGroup(g: string): void { this.group.set(g); }
  protected isSel(id: string): boolean { return this.selected().includes(id); }
  protected clearSelected(): void { this.selected.set([]); store.set('mpSel', []); }
  protected toggle(id: string): void {
    const s = this.isSel(id) ? this.selected().filter(x => x !== id) : [...new Set([...this.selected(), id])];
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
    this.q.set(''); this.group.set('all'); this.showAll.set(false); this.otherPage.set(0);
    this.results.set(null); this.featuredId.set(null); this.qtyOverride.set({});
  }

  // Món nổi bật (mặc định món hợp nhất) và phần mua hàng ngay trên trang, không cần mở hộp thoại
  protected recipeCount = computed(() => this.data.recipes().length);
  /** Trạng thái chưa chọn gì: gợi ý vài món nấu nhanh nhất để bắt đầu từ món thay vì từ nguyên liệu */
  protected quickPicks = computed(() => [...this.data.recipes()].sort((a, b) => this.mp.totalTime(a) - this.mp.totalTime(b)).slice(0, 6));
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
  // Bước 4: xem món trong hộp công thức dùng chung (shared/recipe-dialog)
  private recipeDlg = viewChild.required<RecipeDialog>('recipeDlg');
  protected setServings(n: number): void { this.patch('servings', Math.min(6, Math.max(1, n))); }
  protected saveRecipe(r: Recipe): void { this.cs.toggleRecipeSaved(r.id); }
  /** Luồng A: mở khung đăng bài trong Cộng đồng, điền sẵn món này */
  protected shareToCommunity(id: string): void { void this.router.navigate(['/cong-dong'], { queryParams: { 'chia-se': id } }); }

  protected stepTip(step: Recipe['steps'][number]): string | null {
    return typeof step === 'string' ? null : step.tip ?? null;
  }

  protected open(id: string): void { this.recipeDlg().open(id, this.f().servings); }
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
}
