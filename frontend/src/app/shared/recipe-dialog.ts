import { Component, ElementRef, ViewEncapsulation, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DataService } from '../core/data.service';
import { ProductService } from '../core/product.service';
import { CartService } from '../core/cart.service';
import { ToastService } from '../core/toast.service';
import { CommunityService } from '../core/community.service';
import { DIFF_LABEL, MEAL_LABEL, MealPlannerService, PurchaseLine } from '../core/meal-planner.service';
import { Recipe } from '../core/models';
import { VndPipe } from './vnd.pipe';
import { ImgFallbackDirective } from './img-fallback.directive';

/**
 * Hộp công thức chi tiết (ảnh, khẩu phần, nguyên liệu cần mua, cách làm từng bước, dinh dưỡng, bài cộng đồng, món liên quan).
 * Dùng chung cho Meal Planner và Lướt món trong Cộng đồng để xem công thức ngay tại trang đang đứng.
 */
@Component({
  selector: 'fm-recipe-dialog',
  imports: [VndPipe, ImgFallbackDirective, RouterLink],
  templateUrl: './recipe-dialog.html',
  styleUrl: './recipe-dialog.css',
  encapsulation: ViewEncapsulation.None
})
export class RecipeDialog {
  /** Nguyên liệu người dùng đã có (Meal Planner); những món này không cần mua */
  readonly have = input<readonly string[]>([]);
  /** Mở từ bài trong Cộng đồng: hiện nút quay lại */
  readonly backToCommunity = input(false);
  /** Đổi khẩu phần trong hộp thoại (Meal Planner đồng bộ lại bộ lọc của nó) */
  readonly servingsChange = output<number>();
  /** Bấm "Chia sẻ lên Cộng đồng"; trang chứa tự quyết mở khung đăng bài thế nào */
  readonly share = output<string>();

  protected mp = inject(MealPlannerService);
  protected ps = inject(ProductService);
  protected cs = inject(CommunityService);
  private data = inject(DataService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private http = inject(HttpClient);
  protected readonly meal = MEAL_LABEL;
  protected readonly diff = DIFF_LABEL;

  private dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected current = signal<Recipe | null>(null);
  protected serv = signal(2);
  protected unchecked = signal<string[]>([]);
  protected doneSteps = signal<number[]>([]);
  protected readonly adding = signal(false);

  protected isSel(id: string): boolean { return this.have().includes(id); }
  protected purchase = computed(() => { const r = this.current(); return r ? r.ingredients.map(l => this.mp.purchase(l, this.serv(), r)) : []; });
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
  protected stepsLeft = computed(() => { const r = this.current(); return r ? r.steps.length - this.doneSteps().length : 0; });
  protected currentStep = computed(() => { const r = this.current(); return r ? r.steps.findIndex((_, i) => !this.doneSteps().includes(i)) : -1; });
  protected progress = computed(() => { const r = this.current(); return r?.steps.length ? Math.round((this.doneSteps().length / r.steps.length) * 100) : 0; });
  protected communityPosts = computed(() => { const r = this.current(); return r ? this.cs.postsForRecipe(r.id) : []; });

  /** Mở công thức. servings: khẩu phần đang chọn ở trang gọi (không có thì theo công thức) */
  open(id: string, servings?: number): void {
    const r = this.mp.recipe(id) ?? null;
    this.current.set(r);
    this.serv.set(servings ?? r?.servings ?? 2);
    this.doneSteps.set([]);
    this.resetUnchecked();
    this.dlg().nativeElement.showModal();
    this.dlg().nativeElement.scrollTop = 0;
  }
  /** Không tự chọn: hàng bán nguyên thùng/bao và gia vị (nhà thường có sẵn). Khách tự tick nếu cần. */
  private resetUnchecked(): void {
    this.unchecked.set(this.purchase().filter(x => x.bulk || x.ingredient?.categoryId === 'condiments').map(x => x.line.ingredientId));
  }
  close(): void { this.dlg().nativeElement.close(); }

  protected setServ(n: number): void {
    const v = Math.min(6, Math.max(1, n));
    this.serv.set(v);
    this.servingsChange.emit(v);
  }
  protected toggleStep(i: number): void { this.doneSteps.update(l => (l.includes(i) ? l.filter(x => x !== i) : [...l, i])); }
  protected toggleBuy(id: string): void { this.unchecked.update(u => (u.includes(id) ? u.filter(x => x !== id) : [...u, id])); }
  protected saveRecipe(r: Recipe): void { this.cs.toggleRecipeSaved(r.id); }
  protected shareToCommunity(r: Recipe): void { this.close(); this.share.emit(r.id); }
  protected startCooking(): void { this.dlg().nativeElement.querySelector('#d-steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  protected openRelated(id: string): void {
    const recipe = this.mp.recipe(id);
    if (!recipe) return;
    this.current.set(recipe);
    this.doneSteps.set([]);
    this.resetUnchecked();
    this.dlg().nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
  }

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

  /** Bước dạng chữ "Sơ chế: rửa sạch…" tách thành tiêu đề + nội dung; bước dạng object giữ nguyên */
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
  protected stepDuration(step: Recipe['steps'][number]): number | null { return typeof step === 'string' ? null : step.durationMinutes ?? null; }
  protected stepTip(step: Recipe['steps'][number]): string | null { return typeof step === 'string' ? null : step.tip ?? null; }

  /** Ghi một lượt nấu lên server để thống kê món được nấu (mỗi người một lượt/món/ngày, server tự chặn bấm lặp) */
  private async cooked(r: Recipe): Promise<void> {
    try { await firstValueFrom(this.http.post(`/api/recipes/${r.id}/cook`, { servings: this.serv() })); } catch { /* không chặn việc mua hàng */ }
  }
  protected async cookNow(): Promise<void> {
    const r = this.current();
    if (!r) return;
    await this.cooked(r);
    this.toast.show(`Chúc bạn nấu ${r.name} ngon miệng!`);
  }
  protected async addMissing(): Promise<void> {
    if (this.adding()) return;
    const items = this.chosen(), recipe = this.current()!, name = recipe.name;
    this.adding.set(true);
    try {
      const { added, failed } = await this.cart.addMany(items.map(x => ({ id: x.product!.id, qty: x.cartQty })));
      if (added) void this.cooked(recipe);
      if (!failed.length) {
        this.close();
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
