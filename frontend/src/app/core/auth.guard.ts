import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Trang cần đăng nhập (Tài khoản) */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.user() ? true : inject(Router).createUrlTree(['/dang-nhap'], { queryParams: { next: state.url } });
};

/** Trang chỉ dành cho quản trị viên */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) return true;
  return inject(Router).createUrlTree(['/dang-nhap'], { queryParams: { next: state.url, admin: 1 } });
};

/** Đã đăng nhập thì không cần vào trang đăng nhập nữa */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.user()) return true;
  return inject(Router).createUrlTree([auth.isAdmin() ? '/admin' : '/tai-khoan']);
};
