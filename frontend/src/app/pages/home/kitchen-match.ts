import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Ingredient, Recipe } from '../../core/models';
import { MealPlannerService, PlannerFilters, PlannerResult } from '../../core/meal-planner.service';
import { DataService } from '../../core/data.service';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';
import { RevealDirective } from '../../shared/reveal.directive';

/** Kệ nguyên liệu ở trang chủ: các nguyên liệu hay dùng nhất trong recipes.json (bỏ gạo, dầu ăn, nước mắm vì nhà nào cũng có) */
const PANTRY = ['ing-trung-ga-ta', 'ing-ca-chua', 'ing-rau-muong', 'ing-uc-ga-tuoi', 'ing-ca-basa', 'ing-xa-lach', 'ing-ca-rot', 'ing-ba-chi-heo'];
/** Hình vẽ (#km-*) theo tên nguyên liệu; không khớp tên nào thì lấy hình theo nhóm (BY_GROUP) */
const BY_NAME: [RegExp, string][] = [
  [/trứng/i, 'egg'], [/sữa|phô mai|kem/i, 'milk'], [/gà/i, 'chicken'], [/bò/i, 'steak'], [/heo/i, 'pork'],
  [/tôm|ghẹ/i, 'shrimp'], [/cá|lươn|mực/i, 'fish'], [/cà chua/i, 'tomato'], [/cà rốt/i, 'carrot'],
  [/xà lách|rau sống|bông cải/i, 'lettuce'], [/rau muống|hành lá/i, 'greens'], [/dưa leo|khổ qua/i, 'cucumber'],
  [/nấm/i, 'mushroom'], [/bắp/i, 'corn'], [/ớt/i, 'chili']
];
const BY_GROUP: Record<string, string> = {
  vegetables: 'leaf', fruits: 'fruit', meat: 'pork', seafood: 'fish', dairy: 'milk', pantry: 'rice', condiments: 'bottle', beverages: 'cup'
};
/** Ba nguyên liệu được chọn sẵn khi mở trang */
const START = ['ing-trung-ga-ta', 'ing-ca-chua', 'ing-rau-muong'];
/** Bộ lọc mặc định của trang Meal Planner: không lọc gì, 2 người ăn */
const FILTERS: PlannerFilters = { mealType: 'all', time: 'all', difficulty: 'all', servings: 2, lowFat: false, highProtein: false, vegetarian: false };

/** Có gì trong bếp, nấu món đó: Meal Planner thu nhỏ.
 *  Chạm chọn nguyên liệu trên kệ, thẻ công thức bên phải đổi ngay sang món hợp nhất
 *  (cùng thuật toán với trang Meal Planner) và ghi rõ còn thiếu gì. */
@Component({
  selector: 'fm-kitchen-match',
  imports: [RouterLink, ImgFallbackDirective, RevealDirective],
  templateUrl: './kitchen-match.html',
  styleUrl: './kitchen-match.css'
})
export class KitchenMatch {
  protected mp = inject(MealPlannerService);
  private data = inject(DataService);
  protected recipeCount = computed(() => this.data.recipes().length);
  protected selected = signal<string[]>(START);
  /** Danh sách chọn dạng chuỗi để truyền sang trang Meal Planner (?co=) */
  protected co = computed(() => this.selected().join(','));

  protected shelf = computed(() => PANTRY.map(id => this.mp.ingredient(id)).filter((i): i is Ingredient => !!i));
  /** Ba món hợp nhất: điểm cao trước, cùng điểm thì món thiếu ít nguyên liệu hơn đứng trước */
  protected results = computed<PlannerResult[]>(() => this.selected().length
    ? this.mp.generate(this.selected(), FILTERS).sort((a, b) => b.score - a.score || a.missing - b.missing).slice(0, 3)
    : []);
  protected top = computed(() => this.results()[0]);

  /** Tên hình vẽ của nguyên liệu (dùng với <use href="#km-..."/>) */
  protected icon(i: Ingredient): string {
    return BY_NAME.find(([re]) => re.test(i.name))?.[1] ?? BY_GROUP[i.categoryId] ?? 'leaf';
  }
  protected isSel(id: string): boolean { return this.selected().includes(id); }
  protected toggle(id: string): void {
    this.selected.update(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }
  /** Tên các nguyên liệu của món mà bếp chưa có */
  protected missing(r: Recipe): string[] {
    return r.ingredients.filter(l => !this.isSel(l.ingredientId)).map(l => this.mp.ingredient(l.ingredientId)?.name ?? '');
  }
}
