import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { ToastService } from './toast.service';

/** Trang cần catalog (sản phẩm, danh mục, voucher): chờ lần tải dữ liệu đang chạy xong rồi mới mở.
 *  Trang chủ không dùng guard này nên hiện ngay, không đợi dữ liệu. */
export const dataGuard: CanActivateFn = () => inject(DataService).ready().then(() => true);

/** Trang cần đăng nhập (Tài khoản) */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.user() ? true : inject(Router).createUrlTree(['/dang-nhap'], { queryParams: { next: state.url } });
};

/** Trang chỉ dành cho quản trị viên.
 *  Khách chưa đăng nhập: sang trang Đăng nhập kèm ghi chú cần tài khoản admin.
 *  Đã đăng nhập bằng tài khoản khách: trang Đăng nhập sẽ đẩy về Tài khoản (guestGuard), nên báo lý do ngay ở đây. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) return true;
  const router = inject(Router);
  if (auth.user()) {
    inject(ToastService).error('Trang quản trị cần tài khoản admin. Đăng xuất rồi đăng nhập bằng tài khoản quản trị.');
    return router.createUrlTree(['/tai-khoan']);
  }
  return router.createUrlTree(['/dang-nhap'], { queryParams: { next: state.url, admin: 1 } });
};

/** Đã đăng nhập thì không cần vào trang đăng nhập nữa */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.user()) return true;
  return inject(Router).createUrlTree([auth.isAdmin() ? '/admin' : '/tai-khoan']);
};
