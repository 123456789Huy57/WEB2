import { Injectable, signal } from '@angular/core';

/** Trạng thái giao diện dùng chung (ngăn giỏ hàng bên phải) */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly cartOpen = signal(false);
  openCart(): void { this.cartOpen.set(true); }
  closeCart(): void { this.cartOpen.set(false); }
}
