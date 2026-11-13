import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService, apiMessage } from '../core/auth.service';
import { OrderService } from '../core/order.service';
import { DataService } from '../core/data.service';
import { ToastService } from '../core/toast.service';
import { ConfirmService } from '../core/confirm.service';

@Component({
  selector: 'fm-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styleUrl: './admin.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="adm" [class.nav-open]="navOpen()">
      <aside class="adm-side">
        <a class="logo" routerLink="/admin">FreshMart</a>
        <p class="adm-role">Quản trị</p>
        <nav class="adm-nav" aria-label="Quản trị" (click)="navOpen.set(false)">
          @for (n of nav; track n.path) {
            <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: n.path === '/admin' }">
              <span>{{ n.label }}</span>
              @if (n.path === '/admin/don-hang' && pending()) { <span class="adm-count num">{{ pending() }}</span> }
            </a>
          }
        </nav>
        <div class="adm-foot">
          <a routerLink="/">Xem cửa hàng</a>
          <button type="button" (click)="reset()">Khôi phục dữ liệu mẫu</button>
          <button type="button" (click)="logout()">Đăng xuất</button>
        </div>
      </aside>
      <div class="adm-main">
        <header class="adm-top">
          <button class="btn btn-stone btn-sm adm-menu" type="button" (click)="navOpen.set(!navOpen())" [attr.aria-expanded]="navOpen()">Menu</button>
          <span class="muted small">Xin chào, {{ auth.user()?.fullName }}</span>
        </header>
        <router-outlet />
      </div>
    </div>
  `
})
export class AdminShell {
  protected auth = inject(AuthService);
  private orders = inject(OrderService);
  private data = inject(DataService);
  private router = inject(Router);
  private cf = inject(ConfirmService);
  private toast = inject(ToastService);
  protected navOpen = signal(false);
  protected pending = computed(() => this.orders.all().filter(o => o.status === 'pending').length);
  protected nav = [
    { path: '/admin', label: 'Tổng quan' }, { path: '/admin/don-hang', label: 'Đơn hàng' }, { path: '/admin/san-pham', label: 'Sản phẩm' }, { path: '/admin/danh-muc', label: 'Danh mục' },
    { path: '/admin/ton-kho', label: 'Tồn kho' }, { path: '/admin/voucher', label: 'Voucher' }, { path: '/admin/khach-hang', label: 'Khách hàng' }, { path: '/admin/danh-gia', label: 'Đánh giá' }, { path: '/admin/cong-dong', label: 'Cộng đồng' }, { path: '/admin/ra-anh', label: 'Rà ảnh' }
  ];
  protected async logout(): Promise<void> {
    try { await this.auth.logout(); this.router.navigateByUrl('/'); } catch (error) { this.toast.show(apiMessage(error)); }
  }
  protected async reset(): Promise<void> {
    if (await this.cf.ask('Khôi phục dữ liệu mẫu?', 'Chỉ xóa giỏ và các dữ liệu demo trên trình duyệt. Dữ liệu tài khoản, sản phẩm trên máy chủ được giữ lại.', 'Khôi phục')) this.data.resetEdits();
  }
}
