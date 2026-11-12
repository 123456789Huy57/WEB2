import { Routes } from '@angular/router';
import { AdminShell } from './admin-shell';

/** Khu quản trị: /admin/... (đã chặn bằng adminGuard trong app.routes.ts) */
export const ADMIN_ROUTES: Routes = [
  {
    path: '', component: AdminShell, children: [
      { path: '', title: 'Tổng quan · Quản trị FreshMart', loadComponent: () => import('./dashboard').then(m => m.Dashboard) },
      { path: 'don-hang', title: 'Đơn hàng · Quản trị FreshMart', loadComponent: () => import('./orders').then(m => m.AdminOrders) },
      { path: 'san-pham', title: 'Sản phẩm · Quản trị FreshMart', loadComponent: () => import('./products').then(m => m.AdminProducts) },
      { path: 'danh-muc', title: 'Danh mục · Quản trị FreshMart', loadComponent: () => import('./categories').then(m => m.AdminCategories) },
      { path: 'ton-kho', title: 'Tồn kho · Quản trị FreshMart', loadComponent: () => import('./inventory').then(m => m.AdminInventory) },
      { path: 'voucher', title: 'Voucher · Quản trị FreshMart', loadComponent: () => import('./vouchers').then(m => m.AdminVouchers) },
      { path: 'khach-hang', title: 'Khách hàng · Quản trị FreshMart', loadComponent: () => import('./customers').then(m => m.AdminCustomers) },
      { path: 'danh-gia', title: 'Đánh giá · Quản trị FreshMart', loadComponent: () => import('./reviews').then(m => m.AdminReviews) },
      { path: 'ra-anh', title: 'Rà ảnh · Quản trị FreshMart', loadComponent: () => import('./image-audit').then(m => m.AdminImageAudit) }
    ]
  }
];
