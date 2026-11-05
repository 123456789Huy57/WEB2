import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { DataService } from './core/data.service';
import { AuthService } from './core/auth.service';
import { apiInterceptor } from './core/api.interceptor';
import { CartService } from './core/cart.service';
import { OrderService } from './core/order.service';
import { VoucherService } from './core/voucher.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }), withViewTransitions({ skipInitialTransition: true })),
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
    provideAppInitializer(() => {
      const auth = inject(AuthService), data = inject(DataService), cart = inject(CartService), orders = inject(OrderService), vouchers = inject(VoucherService);
      return auth.restore().catch(() => {}).then(async () => {
        await data.load(auth.isAdmin());
        await Promise.all([cart.load(), orders.load(auth.isAdmin()), vouchers.loadSaved()]);
      });
    })
  ]
};
