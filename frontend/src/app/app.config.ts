import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { DataService } from './core/data.service';
import { AuthService } from './core/auth.service';
import { apiInterceptor } from './core/api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }), withViewTransitions({ skipInitialTransition: true })),
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
