import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions, withPreloading } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { DataService } from './core/data.service';
import { AuthService } from './core/auth.service';
import { apiInterceptor } from './core/api.interceptor';
import { IdlePreload } from './core/idle-preload';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'disabled', anchorScrolling: 'disabled' }) /* cuộn tự xử lý trong app.ts */, withViewTransitions({ skipInitialTransition: true }), withPreloading(IdlePreload)),
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
    provideAppInitializer(() => {
      const auth = inject(AuthService), data = inject(DataService);
      // Chỉ chờ khôi phục đăng nhập (một request nhỏ, các guard cần). Catalog tải song song và KHÔNG chặn:
      // trang chủ hiện ngay, các trang cần sản phẩm chờ qua dataGuard. Admin cần bản catalog đầy đủ
      // (cả sản phẩm ẩn) nên tải bản admin khi biết vai trò.
      void data.load(false);
      return auth.restore().catch(() => {}).then(() => { if (auth.isAdmin()) void data.load(true); });
    })
  ]
};
