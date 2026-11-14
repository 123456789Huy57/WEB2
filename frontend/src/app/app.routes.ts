import { Routes } from '@angular/router';
import { adminGuard, authGuard, dataGuard, guestGuard } from './core/auth.guard';
import { Home } from './pages/home/home';

/** Mỗi trang tải riêng (lazy) để trang chủ mở nhanh. Đường dẫn tiếng Việt không dấu. */
const pages: Routes = [
  { path: 'quen-mat-khau', title: 'Quên mật khẩu · FreshMart', loadComponent: () => import('./pages/login/password-recovery').then(m => m.PasswordRecovery) },
  { path: 'dat-lai-mat-khau', title: 'Đặt lại mật khẩu · FreshMart', data: { resetMode: true }, loadComponent: () => import('./pages/login/password-recovery').then(m => m.PasswordRecovery) },
  { path: 'huy-nhan-uu-dai', title: 'Hủy nhận ưu đãi · FreshMart', loadComponent: () => import('./pages/login/unsubscribe').then(m => m.Unsubscribe) },
  // Trang chủ là trang vào nhiều nhất: nạp sẵn trong bundle chính để bớt một lượt tải. Các trang khác vẫn lazy.
  { path: '', title: 'FreshMart · Đi chợ liền tay, giao ngay trước tối', component: Home },
  { path: 'san-pham', title: 'Sản phẩm · FreshMart', loadComponent: () => import('./pages/catalog/catalog').then(m => m.Catalog) },
  { path: 'san-pham/:id', title: 'Sản phẩm · FreshMart', loadComponent: () => import('./pages/product/product').then(m => m.ProductPage) },
  { path: 'gio-hang', title: 'Giỏ hàng · FreshMart', loadComponent: () => import('./pages/cart/cart').then(m => m.CartPage) },
  { path: 'thanh-toan/chuyen-khoan', canActivate: [authGuard], title: 'Chuyển khoản · FreshMart', loadComponent: () => import('./pages/checkout/bank-transfer').then(m => m.BankTransfer) },
  { path: 'thanh-toan/ket-qua', canActivate: [authGuard], title: 'Kết quả thanh toán · FreshMart', loadComponent: () => import('./pages/checkout/payment-result').then(m => m.PaymentResult) },
  { path: 'thanh-toan', canActivate: [authGuard], title: 'Thanh toán · FreshMart', loadComponent: () => import('./pages/checkout/checkout').then(m => m.Checkout) },
  { path: 'meal-planner', title: 'Meal Planner · FreshMart', loadComponent: () => import('./pages/meal-planner/meal-planner').then(m => m.MealPlanner) },
  { path: 'cong-dong', title: 'Cộng đồng · FreshMart', loadComponent: () => import('./pages/community/community').then(m => m.Community) },
  { path: 'uu-dai', title: 'Ưu đãi · FreshMart', loadComponent: () => import('./pages/offers/offers').then(m => m.Offers) },
  { path: 'cua-hang', title: 'Về FreshMart · Tươi mỗi ngày, ngon mỗi bữa', loadComponent: () => import('./pages/stores/stores').then(m => m.Stores) },
  { path: 'he-thong-cua-hang', title: 'Hệ thống cửa hàng · FreshMart', loadComponent: () => import('./pages/stores/store-list').then(m => m.StoreList) },
  { path: 'dang-nhap', title: 'Đăng nhập · FreshMart', canActivate: [guestGuard], loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  { path: 'tai-khoan', title: 'Tài khoản · FreshMart', canActivate: [authGuard], loadComponent: () => import('./pages/account/account').then(m => m.Account) },
  { path: 'tra-cuu-don', canActivate: [authGuard], title: 'Tra cứu đơn hàng · FreshMart', loadComponent: () => import('./pages/order-lookup/order-lookup').then(m => m.OrderLookup) },
  { path: 'so-sanh', title: 'So sánh sản phẩm · FreshMart', loadComponent: () => import('./pages/compare/compare').then(m => m.Compare) },
  { path: 'thong-tin/gioi-thieu', redirectTo: 'cua-hang', pathMatch: 'full' },
  { path: 'thong-tin/:slug', loadComponent: () => import('./pages/info/info').then(m => m.Info) },
  { path: 'blog', title: 'Blog ẩm thực · FreshMart', loadComponent: () => import('./pages/blog/blog').then(m => m.Blog) },
  { path: 'blog/:slug', title: 'Blog ẩm thực · FreshMart', loadComponent: () => import('./pages/blog/blog').then(m => m.Blog) },
  { path: 'admin', title: 'Quản trị · FreshMart', canActivate: [adminGuard], loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES) },
  { path: '**', title: 'Không tìm thấy trang · FreshMart', loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFound) }
];

/** Mọi trang trừ trang chủ đều chờ catalog trước (dataGuard chạy trước các guard đăng nhập/quản trị).
 *  Route chỉ để chuyển hướng (redirectTo) không được gắn guard, Angular sẽ báo lỗi và không mở được app. */
export const routes: Routes = pages.map(r => r.path === '' || r.redirectTo ? r : { ...r, canActivate: [dataGuard, ...(r.canActivate ?? [])] });
