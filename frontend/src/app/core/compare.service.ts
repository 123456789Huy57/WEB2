import { Injectable, signal } from '@angular/core';
import { store } from './storage';

export const COMPARE_MAX = 3;

/** Danh sách sản phẩm đang so sánh (tối đa 3), giữ khi tải lại trang */
@Injectable({ providedIn: 'root' })
export class CompareService {
  readonly ids = signal<string[]>(store.get('compare', []));
  has(id: string): boolean { return this.ids().includes(id); }
  /** Trả về false nếu đã đủ 3 sản phẩm */
  toggle(id: string): boolean {
    const list = [...this.ids()];
    const i = list.indexOf(id);
    if (i > -1) list.splice(i, 1);
    else if (list.length >= COMPARE_MAX) return false;
    else list.push(id);
    this.ids.set(list); store.set('compare', list);
    return true;
  }
  clear(): void { this.ids.set([]); store.set('compare', []); }
}
