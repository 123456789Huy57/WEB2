import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth.guard';

/** Mỗi trang tải riêng (lazy) để trang chủ mở nhanh. Đường dẫn tiếng Việt không dấu. */
export const routes: Routes = [
  { path: '', title: 'FreshMart · Đi chợ liền tay, giao ngay trước tối', loadComponent: () => import('./pages/home/home').then(m => m.Home) },
  { path: 'san-pham', title: 'Sản phẩm · FreshMart', loadComponent: () => import('./pages/catalog/catalog').then(m => m.Catalog) },
  { path: 'san-pham/:id', title: 'Sản phẩm · FreshMart', loadComponent: () => import('./pages/product/product').then(m => m.ProductPage) },
  { path: 'gio-hang', title: 'Giỏ hàng · FreshMart', loadComponent: () => import('./pages/cart/cart').then(m => m.CartPage) },
  { path: 'thanh-toan', title: 'Thanh toán · FreshMart', loadComponent: () => import('./pages/checkout/checkout').then(m => m.Checkout) },
  { path: 'meal-planner', title: 'Meal Planner · FreshMart', loadComponent: () => import('./pages/meal-planner/meal-planner').then(m => m.MealPlanner) },
  { path: 'uu-dai', title: 'Ưu đãi · FreshMart', loadComponent: () => import('./pages/offers/offers').then(m => m.Offers) },
  { path: 'cua-hang', title: 'Về FreshMart · Tươi mỗi ngày, ngon mỗi bữa', loadComponent: () => import('./pages/stores/stores').then(m => m.Stores) },
  { path: 'dang-nhap', title: 'Đăng nhập · FreshMart', canActivate: [guestGuard], loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  { path: 'quen-mat-khau', title: 'Quên mật khẩu · FreshMart', loadComponent: () => import('./pages/login/password-recovery').then(m => m.PasswordRecovery) },
  { path: 'dat-lai-mat-khau', title: 'Đặt lại mật khẩu · FreshMart', data: { resetMode: true }, loadComponent: () => import('./pages/login/password-recovery').then(m => m.PasswordRecovery) },
  { path: 'tai-khoan', title: 'Tài khoản · FreshMart', canActivate: [authGuard], loadComponent: () => import('./pages/account/account').then(m => m.Account) },
  { path: 'tra-cuu-don', title: 'Tra cứu đơn hàng · FreshMart', loadComponent: () => import('./pages/order-lookup/order-lookup').then(m => m.OrderLookup) },
  { path: 'so-sanh', title: 'So sánh sản phẩm · FreshMart', loadComponent: () => import('./pages/compare/compare').then(m => m.Compare) },
  { path: 'thong-tin/gioi-thieu', redirectTo: 'cua-hang', pathMatch: 'full' },
  { path: 'thong-tin/:slug', loadComponent: () => import('./pages/info/info').then(m => m.Info) },
  { path: 'blog', title: 'Blog ẩm thực · FreshMart', loadComponent: () => import('./pages/blog/blog').then(m => m.Blog) },
  { path: 'blog/:slug', title: 'Blog ẩm thực · FreshMart', loadComponent: () => import('./pages/blog/blog').then(m => m.Blog) },
  { path: 'admin', title: 'Quản trị · FreshMart', canActivate: [adminGuard], loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES) },
  { path: '**', title: 'Không tìm thấy trang · FreshMart', loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFound) }
];
