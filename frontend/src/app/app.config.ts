import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
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
      // Khôi phục đăng nhập và tải catalog song song (trước đây chạy nối tiếp). Admin cần bản catalog
      // đầy đủ (cả sản phẩm ẩn) nên tải lại bản admin sau khi biết vai trò.
      const restored = auth.restore().catch(() => {});
      return Promise.all([restored, data.load(false)]).then(() => auth.isAdmin() ? data.load(true) : undefined);
    })
  ]
};
