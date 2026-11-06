import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, forkJoin } from 'rxjs';
import { Category, Ingredient, IngredientProductMap, Product, Recipe, Store, UserRecord, Voucher } from './models';
import { store } from './storage';

/**
 * Nạp toàn bộ dữ liệu một lần khi mở app (xem provideAppInitializer trong app.config.ts).
 * Hiện đọc file JSON trong public/data, phần admin sửa (giá, tồn kho, voucher…) được lưu đè ở localStorage.
 * Khi nhóm Backend xong API Express + MongoDB: đổi BASE thành địa chỉ API và thay các hàm save…/remove…
 * bằng lệnh gọi PUT / POST / DELETE tương ứng.
 */
const BASE = '/data';

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
  readonly users = signal<UserRecord[]>([]);
  readonly error = signal<string>('');

  async load(): Promise<void> {
    try {
      const d = await firstValueFrom(forkJoin({
        products: this.http.get<Product[]>(`${BASE}/products.json`),
        categories: this.http.get<Category[]>(`${BASE}/categories.json`),
        vouchers: this.http.get<Voucher[]>(`${BASE}/vouchers.json`),
        recipes: this.http.get<Recipe[]>(`${BASE}/recipes.json`),
        ingredients: this.http.get<Ingredient[]>(`${BASE}/ingredients.json`),
        map: this.http.get<IngredientProductMap>(`${BASE}/ingredient-product-map.json`),
        stores: this.http.get<Store[]>(`${BASE}/stores.json`),
        users: this.http.get<UserRecord[]>(`${BASE}/users.json`)
      }));
      this.products.set(merge(d.products, store.get<Record<string, Product>>('db.products', {})));
      this.categories.set([...d.categories].sort((a, b) => a.sortOrder - b.sortOrder));
      this.vouchers.set(merge(d.vouchers, store.get<Record<string, Voucher>>('db.vouchers', {}), v => v.code));
      this.recipes.set(d.recipes.filter(r => r.isActive !== false));
      this.ingredients.set(d.ingredients.filter(i => i.isActive !== false));
      this.ingredientMap.set(d.map);
      this.stores.set(d.stores);
      this.users.set([...d.users, ...store.get<UserRecord[]>('users', [])]);
    } catch (e) {
      console.error(e);
      this.error.set('Không tải được dữ liệu. Kiểm tra kết nối rồi tải lại trang.');
    }
  }

  // ---- Ghi dữ liệu (admin, đặt hàng). Backend: PUT /api/products/:id ----
  saveProduct(p: Product): void {
    const list = this.products();
    const i = list.findIndex(x => x.id === p.id);
    this.products.set(i > -1 ? list.map(x => (x.id === p.id ? p : x)) : [p, ...list]);
    this.persist('db.products', p.id, p);
  }
  adjustStock(id: string, delta: number): void {
    const p = this.products().find(x => x.id === id);
    if (p) this.saveProduct({ ...p, stock: Math.max(0, +(p.stock + delta).toFixed(2)) });
  }
  saveVoucher(v: Voucher): void {
    const list = this.vouchers();
    const i = list.findIndex(x => x.code === v.code);
    this.vouchers.set(i > -1 ? list.map(x => (x.code === v.code ? v : x)) : [v, ...list]);
    this.persist('db.vouchers', v.code, v);
  }
  addUser(u: UserRecord): void {
    this.users.update(list => [...list, u]);
    store.set('users', [...store.get<UserRecord[]>('users', []), u]);
  }
  updateUser(id: string, patch: Partial<UserRecord>): void {
    this.users.update(list => list.map(u => (u.id === id ? { ...u, ...patch } : u)));
    const local = store.get<UserRecord[]>('users', []);
    const i = local.findIndex(u => u.id === id);
    const base = this.users().find(u => u.id === id);
    if (i > -1) local[i] = { ...local[i], ...patch }; else if (base) local.push(base);
    store.set('users', local);
  }
  /** Xóa mọi chỉnh sửa của admin, quay về dữ liệu gốc (dùng khi demo) */
  resetEdits(): void { ['db.products', 'db.vouchers', 'orders', 'users', 'cart', 'compare'].forEach(k => store.remove(k)); location.reload(); }

  private persist<T>(key: string, id: string, value: T): void {
    store.set(key, { ...store.get<Record<string, T>>(key, {}), [id]: value });
  }
}

function merge<T extends object>(base: T[], edits: Record<string, T>, key: (x: T) => string = x => (x as { id: string }).id): T[] {
  const seen = new Set<string>();
  const out = base.map(x => { const k = key(x); seen.add(k); return edits[k] ?? x; });
  const added = Object.entries(edits).filter(([k]) => !seen.has(k)).map(([, v]) => v);
  return [...added, ...out];
}
