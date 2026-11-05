import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { Category, Ingredient, IngredientProductMap, Product, Recipe, Store, User, Voucher } from './models';
import { store } from './storage';

type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);
  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly vouchers = signal<Voucher[]>([]);
  readonly recipes = signal<Recipe[]>([]);
  readonly ingredients = signal<Ingredient[]>([]);
  readonly ingredientMap = signal<IngredientProductMap>({});
  readonly stores = signal<Store[]>([]);
  readonly users = signal<User[]>([]);
  readonly error = signal('');

  async load(admin = false): Promise<void> {
    this.error.set('');
    this.users.set([]);
    try {
      const d = await firstValueFrom(forkJoin({
        products: this.http.get<Product[]>(admin ? '/api/admin/products' : '/api/products'),
        categories: this.http.get<Category[]>(admin ? '/api/admin/categories' : '/api/categories'),
        vouchers: this.http.get<Voucher[]>(admin ? '/api/admin/vouchers' : '/api/vouchers'),
        // Công thức, nguyên liệu, cửa hàng: còn đọc file tĩnh, sẽ chuyển sang API Meal Planner.
        recipes: this.http.get<Recipe[]>('/data/recipes.json'),
        ingredients: this.http.get<Ingredient[]>('/data/ingredients.json'),
        map: this.http.get<IngredientProductMap>('/data/ingredient-product-map.json'),
        stores: this.http.get<Store[]>('/data/stores.json'),
        users: admin ? this.http.get<Page<User>>('/api/admin/users?pageSize=100') : of(null)
      }));
      this.products.set(d.products);
      this.categories.set(d.categories);
      this.vouchers.set(d.vouchers);
      this.recipes.set(d.recipes.filter(r => r.isActive !== false));
      this.ingredients.set(d.ingredients.filter(i => i.isActive !== false));
      this.ingredientMap.set(d.map); this.stores.set(d.stores);
      if (d.users) {
        const users = [...d.users.items];
        for (let page = 2; users.length < d.users.total; page++) {
          const result = await firstValueFrom(this.http.get<Page<User>>(`/api/admin/users?pageSize=100&page=${page}`));
          if (!result.items.length) break;
          users.push(...result.items);
        }
        this.users.set(users);
      }
      store.remove('db.products');
    } catch (error) {
      this.products.set([]); this.categories.set([]); this.users.set([]);
      this.error.set('Không tải được dữ liệu. Kiểm tra backend và kết nối MongoDB rồi tải lại trang.');
    }
  }
  async saveProduct(p: Product): Promise<void> {
    const fields: (keyof Product)[] = ['name', 'slug', 'brand', 'category', 'subcategory', 'description', 'price', 'sale_price', 'unit', 'image_url', 'gallery', 'origin', 'badges', 'nutrition', 'netWeightGram', 'unitWeightGram', 'sellUnit', 'tags', 'active'];
    const payload: Record<string, unknown> = Object.fromEntries(fields.filter(key => p[key] !== undefined).map(key => [key, p[key]]));
    for (const key of ['netWeightGram', 'unitWeightGram'] as const) if (Object.hasOwn(p, key) && p[key] === undefined) payload[key] = null;
    const exists = this.products().some(item => item.id === p.id);
    const saved = await firstValueFrom(exists ? this.http.patch<Product>(`/api/admin/products/${p.id}`, payload) : this.http.post<Product>('/api/admin/products', payload));
    this.products.update(items => exists ? items.map(item => item.id === saved.id ? saved : item) : [saved, ...items]);
  }
  async getUser(id: string): Promise<User> {
    return firstValueFrom(this.http.get<User>(`/api/admin/users/${id}`));
  }
  async saveCategory(id: string | null, payload: Partial<Category>): Promise<void> {
    await firstValueFrom(id ? this.http.patch<Category>(`/api/admin/categories/${id}`, payload) : this.http.post<Category>('/api/admin/categories', payload));
    await this.load(true);
  }
  async uploadImage(file: File): Promise<string> {
    const body = new FormData(); body.append('image', file);
    return (await firstValueFrom(this.http.post<{ imageUrl: string }>('/api/admin/uploads', body))).imageUrl;
  }
  async setUserActive(id: string, isActive: boolean): Promise<void> {
    const user = await firstValueFrom(this.http.patch<User>(`/api/admin/users/${id}/status`, { isActive }));
    this.users.update(items => items.map(item => item.id === id ? user : item));
  }
  /** Điều chỉnh tồn kho qua API kho (tăng/giảm, không đặt số tuyệt đối). Idempotency-Key chống bấm hai lần. */
  async adjustStock(id: string, delta: number, reason = ''): Promise<number> {
    const r = await firstValueFrom(this.http.post<{ productId: string; stock: number }>(`/api/admin/inventory/${id}/adjustments`, { quantityDelta: delta, reason }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }));
    this.products.update(items => items.map(p => p.id === id ? { ...p, stock: r.stock } : p));
    return r.stock;
  }
  /** Tạo hoặc sửa voucher (admin). id có nghĩa là sửa. */
  async saveVoucher(v: Partial<Voucher>, id?: string): Promise<Voucher> {
    const { remaining, usedCount, saved, usedByMe, id: _id, ...body } = v;
    if (id) delete body.code;
    const r = await firstValueFrom(id ? this.http.patch<Voucher>(`/api/admin/vouchers/${id}`, body) : this.http.post<Voucher>('/api/admin/vouchers', body));
    this.vouchers.update(items => items.some(x => x.id === r.id) ? items.map(x => x.id === r.id ? r : x) : [r, ...items]);
    return r;
  }
  resetEdits(): void {
    ['db.vouchers', 'orders', 'cart', 'compare', 'voucher', 'savedVouchers'].forEach(key => store.remove(key));
    location.reload();
  }
}
