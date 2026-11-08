import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from './auth.service';

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  const token = inject(AuthService).csrfToken();
  const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  return next(request.clone({ withCredentials: true, ...(write && token ? { setHeaders: { 'X-CSRF-Token': token } } : {}) }));
};
