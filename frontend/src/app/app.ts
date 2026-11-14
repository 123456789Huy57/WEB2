import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
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
    <div class="route-bar" [class.on]="navigating()" aria-hidden="true"></div>
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
    <!-- Thông báo: vùng "status" đọc nhẹ nhàng, không cướp tiêu điểm bàn phím; khi ẩn thì inert để Tab không lọt vào nút đã ẩn -->
    <div class="toast" [class.on]="toast.visible()" [attr.data-kind]="toast.kind()" [attr.inert]="toast.visible() ? null : ''"
         role="status" aria-live="polite" aria-atomic="true"
         (mouseenter)="toast.pause()" (mouseleave)="toast.resume()" (focusin)="toast.pause()" (focusout)="toast.resume()">
      @if (toast.kind() === 'success') {
        <svg class="toast-ico" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10"/><path d="M5.8 10.4l2.8 2.8 5.6-6"/></svg>
      } @else if (toast.kind() === 'error') {
        <svg class="toast-ico" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10"/><path d="M10 5.5v5.5M10 14.2v.3"/></svg>
      }
      <span class="toast-msg">{{ toast.message() }}</span>
      @if (toast.action(); as a) { <button type="button" class="toast-act" (click)="toast.runAction()">{{ a.label }}</button> }
      <button type="button" class="toast-x" aria-label="Đóng thông báo" (click)="toast.dismiss()"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
    </div>
  `
})
export class App {
  protected toast = inject(ToastService);
  protected data = inject(DataService);
  /** Khu quản trị có khung riêng, không dùng header/footer của cửa hàng */
  /** Thanh mảnh trên đầu trang khi chuyển trang chậm hơn 120 ms (tải code trang, chờ dữ liệu) thay cho vòng xoay */
  protected navigating = signal(false);
  constructor() {
    let t: ReturnType<typeof setTimeout> | undefined;
    inject(Router).events.subscribe(e => {
      if (e instanceof NavigationStart) { clearTimeout(t); t = setTimeout(() => this.navigating.set(true), 120); }
      else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) { clearTimeout(t); this.navigating.set(false); }
    });
  }
  protected isAdmin = toSignal(inject(Router).events.pipe(filter(e => e instanceof NavigationEnd), map(e => (e as NavigationEnd).urlAfterRedirects.startsWith('/admin'))), { initialValue: location.pathname.startsWith('/admin') });
}
