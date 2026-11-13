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
  /** Sản phẩm bán nguyên thùng/bao/combo: không tự chọn mua, khách tự tick nếu muốn */
  bulk?: boolean;
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
  /** Icon SVG vẽ phẳng của nguyên liệu; nguyên liệu admin mới thêm chưa có icon thì dùng ảnh sản phẩm */
  ingredientImage(i: Ingredient): string {
    if (i.imageUrl?.startsWith('/img/ingredients/')) return i.imageUrl;
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

  /** Quy đổi lượng trong công thức (theo số người ăn) ra số lượng sản phẩm cần cho vào giỏ.
   *  Có nhiều sản phẩm cùng nguyên liệu thì chọn cách mua rẻ nhất cho đúng lượng cần. */
  purchase(line: RecipeLine, servings: number, r: Recipe): PurchaseLine {
    const ing = this.ingredient(line.ingredientId);
    // Định lượng công thức tính cho r.servings người; quy theo số người ăn bạn chọn (tăng hoặc giảm).
    const scale = servings / (r.servings || servings);
    const q = (line.quantity || 0) * scale;
    const need = `${+q.toFixed(1)} ${line.unit}`;
    const options = this.candidates(line.ingredientId).map(p => this.quote(p, q, line.unit, ing));
    if (!options.length) return { line, ingredient: ing, product: null, need, cartQty: 0, total: 0 };
    const best = options.sort((a, b) => Number(a.bulk) - Number(b.bulk) || a.total - b.total)[0];
    return { line, ingredient: ing, need, ...best };
  }

  /** Mọi sản phẩm còn hàng dùng được cho nguyên liệu (ưu tiên sản phẩm được chỉ định trước) */
  private candidates(ingredientId: string): Product[] {
    const e = this.data.ingredientMap()[ingredientId];
    if (!e) return [];
    const ids = [...new Set([e.preferredProductId, ...(e.productIds ?? [])].filter((x): x is string => !!x))];
    return ids.map(id => this.products.get(id)).filter((p): p is Product => !!p && p.stock > 0 && p.active !== false);
  }

  private quote(p: Product, q: number, recipeUnit: string, ing?: Ingredient): { product: Product; cartQty: number; total: number; bulk: boolean } {
    const u = String(recipeUnit || '').toLowerCase();
    const su = this.products.unit(p);
    const w = p.netWeightGram || p.unitWeightGram || ing?.unitWeightGram || 0;
    let conv = 1; // mặc định: một đơn vị bán (chai, gói, hộp) đủ cho lượng nhỏ như ml, muỗng, lát
    if (u === su) conv = q; // cùng đơn vị đếm: 2 cây xà lách → 2 cây
    else if (u === 'g' && su === 'kg') conv = q / 1000;
    else if (u === 'g' && w) conv = q / w;
    else if (u === 'kg') conv = su === 'kg' ? q : (q * 1000) / (w || 1000);
    else if (su === 'kg' && ing?.unitWeightGram) conv = (q * ing.unitWeightGram) / 1000;
    const step = this.products.step(p);
    const cartQty = Math.max(step, Math.ceil(conv / step - 1e-9) * step);
    const bulk = /^(thùng|bao|combo|lốc)$/.test(su) || /^(thùng|combo|\d+\s*(túi|hộp|gói|chai|lon))\b/i.test(p.name.trim());
    return { product: p, cartQty, total: Math.round(cartQty * this.products.price(p)), bulk };
  }
}
