import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Header } from './layout/header';
import { Footer } from './layout/footer';
import { CartDrawer } from './shared/cart-drawer';
import { ConfirmDialog } from './shared/confirm-dialog';
import { ToastService } from './core/toast.service';
import { DataService } from './core/data.service';

@Component({
  selector: 'fm-root',
  imports: [RouterOutlet, Header, Footer, CartDrawer, ConfirmDialog],
  template: `
    @if (!isAdmin()) {
      <p class="notice">Miễn phí giao cho đơn từ 300.000 đ · Đặt trước 16:00, nhận hàng trong 1–2 giờ</p>
      <fm-header />
    }
    <main>
      @if (data.error()) {
        <section class="band empty"><p class="h3">{{ data.error() }}</p></section>
      } @else {
        <router-outlet />
      }
    </main>
    @if (!isAdmin()) { <fm-footer /><fm-cart-drawer /> }
    <fm-confirm />
    <div class="toast" [class.on]="toast.visible()" role="status" aria-live="polite">{{ toast.message() }}</div>
  `
})
export class App {
  protected toast = inject(ToastService);
  protected data = inject(DataService);
  /** Khu quản trị có khung riêng, không dùng header/footer của cửa hàng */
  protected isAdmin = toSignal(inject(Router).events.pipe(filter(e => e instanceof NavigationEnd), map(e => (e as NavigationEnd).urlAfterRedirects.startsWith('/admin'))), { initialValue: location.pathname.startsWith('/admin') });
}
