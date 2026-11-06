import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CartService } from '../core/cart.service';
import { AuthService } from '../core/auth.service';
import { UiService } from '../core/ui.service';
import { ProductService } from '../core/product.service';
import { VndPipe } from '../shared/vnd.pipe';
import { ImgFallbackDirective } from '../shared/img-fallback.directive';

@Component({
  selector: 'fm-header',
  imports: [RouterLink, RouterLinkActive, FormsModule, VndPipe, ImgFallbackDirective],
  host: { class: 'header band', '[class.compact]': 'compact()', '[style.--nav-h]': 'navH() + "px"' },
  template: `
    <div class="h-row">
      <a class="logo" routerLink="/">FreshMart</a>
      <form class="search" role="search" (ngSubmit)="search()" (focusout)="blur($event)" (keydown.escape)="open.set(false)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>
        <label class="sr" for="q">Tìm sản phẩm</label>
        <input id="q" name="q" type="search" placeholder="Tìm rau, thịt, cá, trái cây…" autocomplete="off" aria-controls="q-list" aria-autocomplete="list" [attr.aria-expanded]="open() && term().length > 1"
          [ngModel]="term()" (ngModelChange)="term.set($event); open.set(true)" (focus)="open.set(true)">
        @if (open() && term().trim().length > 1) {
          <div class="sugg" id="q-list" role="listbox" aria-label="Gợi ý sản phẩm">
            @for (p of hits().slice(0, 6); track p.id) {
              <a class="sugg-row" role="option" [routerLink]="['/san-pham', p.id]" (click)="open.set(false)">
                <span class="ph"><img [fmImg]="p.name" [src]="ps.img(p)" alt=""></span>
                <span class="sugg-nm">{{ ps.shortName(p) }}<span class="small muted">{{ ps.catName(p.category) }}</span></span>
                <span class="num">{{ ps.price(p) | vnd }}</span>
              </a>
            } @empty {
              <p class="sugg-empty">Chưa có sản phẩm khớp “{{ term() }}”. Thử “rau”, “thịt heo”, “trứng”.</p>
            }
            @if (hits().length > 6) {
              <button class="sugg-all" type="submit">Xem tất cả {{ hits().length }} kết quả</button>
            }
          </div>
        }
      </form>
      <nav class="h-actions" aria-label="Tài khoản">
        <a class="h-act" [routerLink]="auth.isAdmin() ? '/admin' : auth.user() ? '/tai-khoan' : '/dang-nhap'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></svg>
          <span class="t">{{ firstName() || 'Tài khoản' }}</span>
        </a>
        <button class="h-act h-cart" type="button" (click)="ui.openCart()" aria-haspopup="dialog">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>
          <span class="t">Giỏ hàng</span>
          <span class="badge num" [class.bump]="bump()" (animationend)="bump.set(false)">{{ cart.count() }}</span>
        </button>
      </nav>
    </div>
    <nav class="h-nav" aria-label="Quầy hàng" #navEl>
      @for (n of nav; track n.c) {
        <a class="nav-cat" routerLink="/san-pham" [queryParams]="{ c: n.c }" routerLinkActive #rla="routerLinkActive" [attr.aria-current]="rla.isActive ? 'page' : null">{{ n.label }}</a>
      }
      <a routerLink="/san-pham" routerLinkActive #all="routerLinkActive" [routerLinkActiveOptions]="{ exact: true }" [attr.aria-current]="all.isActive ? 'page' : null">Tất cả quầy</a>
      <span class="sep nav-cat" aria-hidden="true"></span>
      <a routerLink="/meal-planner" routerLinkActive #mp="routerLinkActive" [attr.aria-current]="mp.isActive ? 'page' : null">Meal Planner</a>
      <a routerLink="/uu-dai" routerLinkActive #of="routerLinkActive" [attr.aria-current]="of.isActive ? 'page' : null">Ưu đãi</a>
      <a routerLink="/cua-hang" routerLinkActive #st="routerLinkActive" [attr.aria-current]="st.isActive ? 'page' : null">Về FreshMart</a>
    </nav>
  `
})
export class Header {
  protected cart = inject(CartService);
  protected auth = inject(AuthService);
  protected ui = inject(UiService);
  protected compact = signal(false);
  /** Chiều cao hàng menu quầy (px), dùng trong CSS để trượt header lên đúng bằng hàng menu */
  protected navH = signal(0);
  private navEl = viewChild.required<ElementRef<HTMLElement>>('navEl');
  private router = inject(Router);
  protected ps = inject(ProductService);
  /** Ô tìm kiếm: gợi ý ngay khi gõ từ 2 ký tự */
  protected term = signal('');
  protected open = signal(false);
  protected hits = computed(() => (this.term().trim().length > 1 ? this.ps.search(this.term().trim()).sort((a, b) => b.sold_count - a.sold_count) : []));
  protected bump = signal(false);
  protected firstName = computed(() => this.auth.user()?.fullName.split(' ').slice(-1)[0] ?? '');
  protected nav = [
    { c: 'vegetables', label: 'Rau, củ' }, { c: 'fruits', label: 'Trái cây' }, { c: 'meat', label: 'Thịt' },
    { c: 'seafood', label: 'Hải sản' }, { c: 'dairy-eggs', label: 'Sữa, trứng' }, { c: 'rice-grains', label: 'Gạo, ngũ cốc' }
  ];

  constructor() {
    let first = true;
    effect(() => { this.cart.bumps(); if (first) { first = false; return; } this.bump.set(true); });
    // Ô tìm kiếm hiển thị đúng từ khóa đang xem ở trang Sản phẩm
    // Header bị gỡ khi vào /admin và tạo lại khi quay ra, nên phải hủy đăng ký theo component
    this.router.events.pipe(takeUntilDestroyed()).subscribe(e => {
      if (e instanceof NavigationEnd) { this.term.set(this.router.parseUrl(e.urlAfterRedirects).queryParams['q'] ?? ''); this.open.set(false); }
    });
    // Cuộn xuống quá 240px thì ẩn hàng menu quầy, cuộn lên thì hiện lại
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) <= 8) return;
      const hide = y > 240 && y > last;
      // Chỉ đo chiều cao menu lúc chuyển sang thu gọn, không đo ở mọi lần cuộn
      if (hide && !this.compact()) this.navH.set(this.navEl().nativeElement.offsetHeight);
      this.compact.set(hide);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', onScroll));
  }
  search(): void {
    const q = this.term().trim();
    this.open.set(false);
    this.router.navigate(['/san-pham'], { queryParams: q ? { q } : {} });
  }
  protected blur(e: FocusEvent): void {
    const form = e.currentTarget as HTMLElement;
    if (!form.contains(e.relatedTarget as Node | null)) this.open.set(false);
  }
}
