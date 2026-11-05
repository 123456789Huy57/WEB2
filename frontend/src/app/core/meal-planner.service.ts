import { Injectable, computed, inject } from '@angular/core';
import { DataService } from './data.service';
import { ProductService } from './product.service';
import { Ingredient, Product, Recipe, RecipeLine } from './models';

export interface PlannerFilters {
  mealType: 'all' | Recipe['mealType'];
  time: 'all' | 'quick' | 'normal' | 'long';
  difficulty: 'all' | Recipe['difficulty'];
  servings: number;
  lowFat: boolean; highProtein: boolean; vegetarian: boolean;
}
export interface PlannerResult { recipe: Recipe; score: number; matched: number; missing: number; }
export interface PurchaseLine {
  line: RecipeLine; ingredient?: Ingredient; product: Product | null;
  need: string; cartQty: number; total: number;
}

export const MEAL_LABEL: Record<Recipe['mealType'], string> = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối', snack: 'Ăn vặt' };
export const DIFF_LABEL: Record<Recipe['difficulty'], string> = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' };
export const INGREDIENT_GROUPS: [string, string][] = [
  ['all', 'Tất cả'], ['vegetables', 'Rau củ'], ['fruits', 'Trái cây'], ['meat', 'Thịt'], ['seafood', 'Hải sản'],
  ['dairy', 'Sữa, trứng'], ['pantry', 'Đồ khô'], ['condiments', 'Gia vị']
];

/** Thuật toán giữ nguyên Web1 (js/meal-planner.js → filterRecipes) để nhóm dễ đối chiếu khi chấm. */
@Injectable({ providedIn: 'root' })
export class MealPlannerService {
  private data = inject(DataService);
  private products = inject(ProductService);
  readonly ingredients = this.data.ingredients;
  private ingById = computed(() => new Map(this.ingredients().map(i => [i.id, i])));

  ingredient(id: string): Ingredient | undefined { return this.ingById().get(id); }
  recipe(id: string): Recipe | undefined { return this.data.recipes().find(r => r.id === id); }
  totalTime(r: Recipe): number { return (r.prepTimeMinutes || 0) + (r.cookTimeMinutes || 0); }

  /** Sản phẩm trong kho dùng để mua nguyên liệu này (ưu tiên preferredProductId còn hàng) */
  productFor(ingredientId: string): Product | null {
    const e = this.data.ingredientMap()[ingredientId];
    if (!e) return null;
    for (const id of [e.preferredProductId, ...(e.productIds ?? [])]) {
      const p = this.products.get(id);
      if (p && p.stock > 0) return p;
    }
    return null;
  }
  /** Các món dùng sản phẩm này (tra ngược bảng nguyên liệu → sản phẩm) */
  recipesWithProduct(productId: string, limit = 3): { recipe: Recipe; ingredientId: string }[] {
    const map = this.data.ingredientMap();
    const ings = Object.keys(map).filter(k => map[k].preferredProductId === productId || (map[k].productIds ?? []).includes(productId));
    if (!ings.length) return [];
    return this.data.recipes()
      .map(r => ({ recipe: r, ingredientId: r.ingredients.find(l => ings.includes(l.ingredientId))?.ingredientId ?? '' }))
      .filter(x => x.ingredientId)
      .sort((a, b) => a.recipe.ingredients.length - b.recipe.ingredients.length)
      .slice(0, limit);
  }
  ingredientImage(i: Ingredient): string {
    const p = this.productFor(i.id);
    return p ? this.products.img(p) : i.imageUrl;
  }

  generate(selected: string[], f: PlannerFilters): PlannerResult[] {
    const timeOk = (t: number) => ({ all: true, quick: t < 15, normal: t >= 15 && t <= 30, long: t > 30 && t <= 60 })[f.time];
    return this.data.recipes()
      .map(r => {
        const ids = r.ingredients.map(l => l.ingredientId);
        const matched = ids.filter(id => selected.includes(id)).length;
        if (!matched) return null;
        let score = matched * 10;
        const t = this.totalTime(r);
        if (f.mealType !== 'all' && r.mealType === f.mealType) score += 10;
        if (f.difficulty !== 'all' && r.difficulty === f.difficulty) score += 5;
        if (f.time !== 'all' && timeOk(t)) score += 5;
        if (r.servings === f.servings) score += 5; else if (Math.abs(r.servings - f.servings) <= 2) score += 2;
        if (f.vegetarian && !r.tags.includes('vegetarian')) return null;
        if (f.lowFat && (r.nutrition?.fat ?? 0) > 15) return null;
        if (f.highProtein && (r.nutrition?.protein ?? 0) < 20) return null;
        return { recipe: r, score, matched, missing: ids.length - matched };
      })
      .filter((x): x is PlannerResult => !!x)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }

  /** Quy đổi lượng trong công thức (theo số người ăn) ra số lượng sản phẩm cần cho vào giỏ */
  purchase(line: RecipeLine, servings: number, r: Recipe): PurchaseLine {
    const ing = this.ingredient(line.ingredientId);
    const p = this.productFor(line.ingredientId);
    // Định lượng công thức tính cho r.servings người; quy theo số người ăn bạn chọn (tăng hoặc giảm).
    const scale = servings / (r.servings || servings);
    const q = (line.quantity || 0) * scale;
    const need = `${+q.toFixed(1)} ${line.unit}`;
    if (!p) return { line, ingredient: ing, product: null, need, cartQty: 0, total: 0 };
    const u = String(line.unit || '').toLowerCase();
    const su = this.products.unit(p);
    const w = p.netWeightGram || p.unitWeightGram || ing?.unitWeightGram || 0;
    let conv = 1;
    if (u === 'g' && su === 'kg') conv = q / 1000;
    else if (u === 'g' && w) conv = q / w;
    else if (u === 'kg') conv = su === 'kg' ? q : (q * 1000) / (w || 1000);
    else if (su === 'kg' && ing?.unitWeightGram) conv = (q * ing.unitWeightGram) / 1000;
    const step = this.products.step(p);
    const cartQty = Math.max(step, Math.ceil(conv / step - 1e-9) * step);
    return { line, ingredient: ing, product: p, need, cartQty, total: Math.round(cartQty * this.products.price(p)) };
  }
}
