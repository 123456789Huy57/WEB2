import { AfterViewInit, Component, ElementRef, ViewEncapsulation, computed, inject, input, signal, viewChild } from '@angular/core';
import { DataService } from '../../core/data.service';
import { ProductService } from '../../core/product.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';
import { DIFF_LABEL, INGREDIENT_GROUPS, MEAL_LABEL, MealPlannerService, PlannerFilters, PlannerResult, PurchaseLine } from '../../core/meal-planner.service';
import { Recipe } from '../../core/models';
import { DecimalPipe } from '@angular/common';
import { norm, store } from '../../core/storage';
import { VndPipe } from '../../shared/vnd.pipe';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';

@Component({
  selector: 'fm-meal-planner',
  imports: [VndPipe, ImgFallbackDirective, DecimalPipe],
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

  // Bước 2: tiêu chí
  protected f = signal<PlannerFilters>({ mealType: 'all', time: 'all', difficulty: 'all', servings: 2, lowFat: false, highProtein: false, vegetarian: false });
  protected patch<K extends keyof PlannerFilters>(k: K, v: PlannerFilters[K]): void { this.f.update(x => ({ ...x, [k]: v })); }

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
  protected manualQty = signal<Record<string, number>>({});
  protected selectedProducts = signal<Record<string, string>>({});
  protected purchase = computed(() => { const r = this.current(); return r ? r.ingredients.map(l => this.mp.purchase(l, this.f().servings, r, this.selectedProducts()[l.ingredientId])) : []; });
  protected missing = computed(() => this.purchase().filter(x => !this.isSel(x.line.ingredientId)));
  protected chosen = computed(() => this.missing().filter(x => x.product && !this.unchecked().includes(x.line.ingredientId) && (!x.manual || this.manualQuantity(x) > 0)));
  protected chosenTotal = computed(() => this.chosen().reduce((s, x) => s + (x.manual ? this.manualQuantity(x) * this.ps.price(x.product!) : x.total), 0));

  protected manualQuantity(item: PurchaseLine): number {
    const p = item.product;
    return p ? this.manualQty()[item.line.ingredientId] ?? this.ps.step(p) : 0;
  }
  protected setManualQuantity(id: string, value: number): void {
    if (Number.isFinite(value) && value >= 0) this.manualQty.update(x => ({ ...x, [id]: value }));
  }
  protected quantityToAdd(item: PurchaseLine): number {
    const p = item.product;
    if (!p) return 0;
    if (!item.manual) return item.cartQty;
    const step = this.ps.step(p), requested = this.manualQuantity(item);
    return Math.max(0, Math.floor(Math.min(requested, p.stock) / step + 1e-9) * step);
  }
  protected purchaseTotal(item: PurchaseLine): number {
    return item.manual && item.product ? this.quantityToAdd(item) * this.ps.price(item.product) : item.total;
  }
  protected chooseProduct(ingredientId: string, productId: string): void {
    this.selectedProducts.update(x => ({ ...x, [ingredientId]: productId }));
  }

  protected open(id: string): void {
    this.current.set(this.mp.recipe(id) ?? null);
    this.manualQty.set({});
    this.selectedProducts.set({});
    // Gia vị, hàng bán theo thùng/bao và lượng chưa quy đổi được cần khách chủ động xác nhận.
    this.unchecked.set(this.purchase().filter(x => x.bulk || x.manual || x.ingredient?.categoryId === 'condiments').map(x => x.line.ingredientId));
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
  protected async addMissing(): Promise<void> {
    const items = this.chosen();
    for (const item of items) await this.cart.add(item.product!.id, this.quantityToAdd(item));
    this.toast.show(`Đã xử lý ${items.length} sản phẩm còn thiếu của “${this.current()!.name}” vào giỏ`);
    this.dlg().nativeElement.close();
  }
}
