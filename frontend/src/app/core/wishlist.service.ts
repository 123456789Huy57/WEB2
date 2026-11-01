import { Injectable, signal } from '@angular/core';
import { store } from './storage';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  readonly ids = signal<string[]>(store.get('wish', []));
  has(id: string): boolean { return this.ids().includes(id); }
  toggle(id: string): boolean {
    const list = [...this.ids()];
    const i = list.indexOf(id);
    if (i > -1) list.splice(i, 1); else list.push(id);
    this.ids.set(list); store.set('wish', list);
    return i < 0;
  }
}
