import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { OrderService } from '../core/order.service';
import { DataService } from '../core/data.service';
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
  protected navOpen = signal(false);
  protected pending = computed(() => this.orders.all().filter(o => o.status === 'pending').length);
  protected nav = [
    { path: '/admin', label: 'Tổng quan' }, { path: '/admin/don-hang', label: 'Đơn hàng' }, { path: '/admin/san-pham', label: 'Sản phẩm' },
    { path: '/admin/ton-kho', label: 'Tồn kho' }, { path: '/admin/voucher', label: 'Voucher' }, { path: '/admin/khach-hang', label: 'Khách hàng' }
  ];
  protected async logout(): Promise<void> { await this.auth.logout(); this.router.navigateByUrl('/'); }
  protected async reset(): Promise<void> {
    if (await this.cf.ask('Khôi phục dữ liệu mẫu?', 'Mọi chỉnh sửa về giá, tồn kho, voucher, đơn hàng và tài khoản mới sẽ bị xóa.', 'Khôi phục')) this.data.resetEdits();
  }
}
