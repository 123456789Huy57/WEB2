import { Component, DestroyRef, ElementRef, ViewEncapsulation, afterNextRender, computed, effect, inject, input, output, signal, untracked, viewChild, viewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { CommunityService, CPost } from '../../core/community.service';
import { DIFF_LABEL, MEAL_LABEL, MealPlannerService } from '../../core/meal-planner.service';
import { DataService } from '../../core/data.service';
import { CartService } from '../../core/cart.service';
import { ToastService } from '../../core/toast.service';
import { UiService } from '../../core/ui.service';
import { cdnImage } from '../../core/cdn-image';
import { Recipe, RecipeStep } from '../../core/models';
import { VndPipe } from '../../shared/vnd.pipe';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';
import { RecipeDialog } from '../../shared/recipe-dialog';

interface ReelItem { recipe: Recipe; posts: CPost[]; }

/**
 * Lướt món trong Cộng đồng: mỗi màn một món, cuộn dọc có hít (scroll-snap), bên phải là nguyên liệu và giá
 * của đúng món đang xem. Ý tưởng học từ chế độ "Lướt" của agni.vn, dựng lại bằng dữ liệu thật của FreshMart:
 * công thức Meal Planner + bài Cộng đồng gắn công thức + sản phẩm đang bán để thêm vào giỏ.
 *
 * Chỉ dựng đầy đủ các món quanh món đang xem (±2); các ô xa hơn là khung rỗng giữ chỗ để thanh cuộn đúng chiều dài.
 */
@Component({
  selector: 'fm-dish-reel',
  imports: [VndPipe, ImgFallbackDirective, RecipeDialog],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './dish-reel.css',
  template: `
    <!-- Ba cột như chế độ "Lướt" của agni.vn, dựng bằng thành phần FreshMart:
         khung món (ảnh, tên, hai nút) · cột thao tác (đổi món, lưu, khoe, chia sẻ) · công thức của món đang xem -->
    <div class="reel" #root>
      <div class="reel-stage">
        <div class="reel-scroll" #scroller tabindex="0" role="region" aria-roledescription="lướt món"
             [attr.aria-label]="label()"
             (keydown)="onKey($event)">
          @for (it of items(); track it.recipe.id; let i = $index) {
            <article class="reel-slide" #slide [attr.data-i]="i" [attr.aria-hidden]="i !== index()">
              @if (near(i)) {
                <!-- Nền là chính ảnh món phóng to, làm mờ và tối đi; ảnh thật nằm trọn ở giữa khung, chữ ở dưới ảnh nên không che món -->
                <span class="reel-bg" aria-hidden="true" [style.background-image]="'url(' + img(it.recipe, 32) + ')'"></span>
                <span class="reel-space" aria-hidden="true"></span>
                <!-- Khung cắt: ảnh phóng nhẹ để bỏ viền trắng có sẵn trong một số ảnh món -->
                <span class="reel-frame"><img class="reel-img" [fmImg]="it.recipe.name" [src]="img(it.recipe)" [alt]="it.recipe.name" [attr.loading]="near(i, 1) ? 'eager' : 'lazy'" [attr.fetchpriority]="i === index() ? 'high' : 'low'" decoding="async"></span>
                <div class="reel-cap">
                  <h2 class="reel-name">{{ it.recipe.name }}</h2>
                  <p class="reel-meta num">{{ mp.totalTime(it.recipe) }} phút · {{ meal[it.recipe.mealType] }} · {{ diff[it.recipe.difficulty] }}</p>
                  @if (it.posts[0]; as p) {
                    <button type="button" class="reel-voice" (click)="openPosts(it.recipe.id)" [attr.tabindex]="i === index() ? 0 : -1"><b>{{ p.authorName }}</b> đã nấu · {{ it.posts.length }} bài trong Cộng đồng</button>
                  }
                  <div class="reel-cta">
                    <button type="button" class="btn btn-forest" (click)="cook(it.recipe.id)" [attr.tabindex]="i === index() ? 0 : -1">Nấu món này</button>
                    <button type="button" class="btn btn-paper" [disabled]="i !== index() || settled() !== it || !buyable().length || adding()" (click)="addAll()" [attr.tabindex]="i === index() ? 0 : -1">{{ adding() && i === index() ? 'Đang thêm…' : '+ Thêm vào giỏ' }}</button>
                  </div>
                </div>
              } @else {
                <span class="sr">{{ it.recipe.name }}</span>
              }
            </article>
          }
        </div>

        @if (cur(); as c) {
          <div class="reel-side" role="group" [attr.aria-label]="'Thao tác cho ' + c.recipe.name">
            <span class="reel-nav-group">
              <button type="button" class="reel-nav" aria-label="Món trước" [disabled]="index() === 0" (click)="go(index() - 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>
              <span class="reel-count num" aria-hidden="true">{{ index() + 1 }}/{{ items().length }}</span>
              <button type="button" class="reel-nav" aria-label="Món tiếp theo" [disabled]="index() >= items().length - 1" (click)="go(index() + 1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
            </span>
            <button type="button" class="reel-act" [attr.aria-pressed]="cs.isRecipeSaved(c.recipe.id)" (click)="cs.toggleRecipeSaved(c.recipe.id)">
              <span class="reel-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg></span>{{ cs.isRecipeSaved(c.recipe.id) ? 'Đã lưu' : 'Lưu món' }}
            </button>
            <button type="button" class="reel-act" (click)="shareCooked.emit(c.recipe.id)">
              <span class="reel-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span>Khoe món
            </button>
            <button type="button" class="reel-act" (click)="shareLink(c.recipe)">
              <span class="reel-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg></span>Chia sẻ
            </button>
            <button type="button" class="reel-act reel-only-sm" aria-haspopup="dialog" (click)="openSheet()">
              <span class="reel-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9"/></svg></span>Công thức
            </button>
          </div>
        }
      </div>

      <!-- Công thức của món đang xem. Máy tính: luôn hiện bên phải; màn hình hẹp: tấm trượt từ dưới lên -->
      <dialog class="reel-panel" #sheet aria-labelledby="reel-panel-h" (click)="$event.target === sheet ? sheet.close() : null">
        @if (settled(); as c) {
          <div class="reel-panel-in">
            <header class="reel-panel-head">
              <div>
                <h2 id="reel-panel-h">{{ c.recipe.name }}</h2>
                <p class="num">Cho {{ c.recipe.servings }} người · {{ mp.totalTime(c.recipe) }} phút</p>
              </div>
              <button type="button" class="btn btn-stone round reel-only-sm" aria-label="Đóng" (click)="sheet.close()">×</button>
            </header>

            <section>
              <h3 class="reel-sub">Nguyên liệu</h3>
              <h4 class="reel-group">Nguyên liệu chính</h4>
              <ul class="reel-ing">
                @for (l of lines(); track l.line.ingredientId) {
                  <li>
                    <span class="reel-ing-name">{{ l.ingredient?.name ?? l.line.ingredientId }}</span>
                    <span class="reel-ing-need num">{{ l.need }}</span>
                    @if (l.product) { <small class="reel-ing-buy num">{{ l.product.name }} · {{ l.total | vnd }}</small> }
                  </li>
                }
              </ul>
              @if (c.recipe.seasonings?.length) {
                <h4 class="reel-group">Gia vị</h4>
                <ul class="reel-ing">
                  @for (g of c.recipe.seasonings; track g.name) {
                    <li><span class="reel-ing-name">{{ g.name }}</span><span class="reel-ing-need num">{{ g.amount ?? '' }}</span></li>
                  }
                </ul>
              }
              <p class="reel-total num"><span>Mua {{ buyable().length }} sản phẩm ở FreshMart</span><b>{{ buyTotal() | vnd }}</b></p>
            </section>

            @if (c.recipe.steps.length) {
              <section>
                <h3 class="reel-sub">Các bước</h3>
                <ol class="reel-steps">
                  @for (st of c.recipe.steps; track $index) {
                    <li>@if (stepTitle(st); as t) { <b>{{ t }}</b> }{{ stepText(st) }}</li>
                  }
                </ol>
              </section>
            }
          </div>
        }
      </dialog>
    </div>
    <!-- Hộp công thức dùng chung với Meal Planner; "Chia sẻ lên Cộng đồng" mở khung đăng bài của trang này -->
    <fm-recipe-dialog #recipeDlg (share)="shareCooked.emit($event)" />
  `
})
export class DishReel {
  /** Món mở sẵn (từ ?luot=<id> trên URL) */
  readonly start = input<string>();
  readonly moved = output<string>();
  readonly shareCooked = output<string>();

  protected cs = inject(CommunityService);
  protected mp = inject(MealPlannerService);
  private data = inject(DataService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private ui = inject(UiService);
  private router = inject(Router);
  protected readonly meal = MEAL_LABEL;
  protected readonly diff = DIFF_LABEL;

  private scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private sheet = viewChild.required<ElementRef<HTMLDialogElement>>('sheet');
  private slides = viewChildren<ElementRef<HTMLElement>>('slide');

  /** Món có bài trong Cộng đồng lên trước (nhiều bài hơn trước), còn lại giữ thứ tự của dữ liệu */
  protected items = computed<ReelItem[]>(() => {
    const byRecipe = new Map<string, CPost[]>();
    for (const p of this.cs.posts()) if (p.recipeId) byRecipe.set(p.recipeId, [...(byRecipe.get(p.recipeId) ?? []), p]);
    const list = this.data.recipes().filter(r => r.isActive !== false && r.imageUrl)
      .map(r => ({ recipe: r, posts: (byRecipe.get(r.id) ?? []).sort((a, b) => b.createdAt - a.createdAt) }));
    return [...list.filter(x => x.posts.length).sort((a, b) => b.posts.length - a.posts.length), ...list.filter(x => !x.posts.length)];
  });
  protected index = signal(0);
  protected cur = computed(() => this.items()[this.index()] ?? null);
  /** Món đã dừng lại (sau ~120ms không đổi): bảng công thức và giá chỉ vẽ lại theo món này, không vẽ lại ở từng món lướt qua */
  private settledIdx = signal(0);
  protected settled = computed(() => this.items()[this.settledIdx()] ?? null);
  /** Các ô đã dựng giữ nguyên (không xóa khi lướt qua) để khỏi tạo lại DOM và giải mã lại ảnh mỗi lần đổi món */
  private built = signal<ReadonlySet<number>>(new Set());
  protected label = computed(() => `Lướt món, đang xem ${this.cur()?.recipe.name ?? ''}, món ${this.index() + 1} trên ${this.items().length}. Dùng phím mũi tên lên, xuống để đổi món.`);
  /** Dựng sẵn 3 món mỗi phía để khi lướt nhanh không phải tạo ô mới ngay lúc đang cuộn */
  protected near(i: number, d = 3): boolean { return Math.abs(i - this.index()) <= d || (d === 3 && this.built().has(i)); }

  protected lines = computed(() => { const r = this.settled()?.recipe; return r ? r.ingredients.map(l => this.mp.purchase(l, r.servings, r)) : []; });
  protected buyable = computed(() => this.lines().filter(l => l.product && !l.bulk && l.cartQty > 0));
  protected buyTotal = computed(() => this.buyable().reduce((s, l) => s + l.total, 0));
  protected adding = signal(false);

  /** Ảnh món theo đúng bề rộng cần (khung rộng tối đa ~560px, màn hình 2x): ảnh gốc 1200–1800px làm giải mã chậm, gây khựng khi đổi món.
   *  Ảnh Cloudinary đã có sẵn f_auto,q_auto nên chèn thêm w_ vào cùng đoạn biến đổi. Nền mờ dùng ảnh 32px phóng to, không cần filter blur. */
  protected img(r: Recipe, w = 960): string {
    const u = r.imageUrl ?? '';
    const m = u.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)([a-z]{1,3}_[^/]*)(\/.*)$/);
    return m ? `${m[1]}${m[2]},c_limit,w_${w}${m[3]}` : cdnImage(u, w);
  }
  protected stepTitle(st: string | RecipeStep): string { return typeof st === 'string' ? '' : st.title; }
  protected stepText(st: string | RecipeStep): string { return typeof st === 'string' ? st : st.description; }
  /** Chia sẻ link mở đúng món: dùng bảng chia sẻ của máy nếu có, không thì chép link */
  protected async shareLink(r: Recipe): Promise<void> {
    const url = `${location.origin}/cong-dong?xem=luot&luot=${r.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: r.name, url }); return; }
      await navigator.clipboard.writeText(url); this.toast.show('Đã chép link món ' + r.name);
    } catch { /* người dùng đóng bảng chia sẻ */ }
  }
  protected seasoningText(r: Recipe): string { return (r.seasonings ?? []).map(s => s.amount ? `${s.name} ${s.amount}` : s.name).join(', '); }

  private root = viewChild.required<ElementRef<HTMLElement>>('root');
  private destroyRef = inject(DestroyRef);
  /** Chiều cao khung = màn hình trừ header dính (điện thoại trừ thêm hàng thao tác bên dưới khung) */
  private fit(scroll: boolean): void {
    const sc = this.scroller().nativeElement, hdr = document.querySelector('.header')?.getBoundingClientRect().bottom ?? 74;
    const phone = matchMedia('(max-width: 640px)').matches;
    this.root().nativeElement.style.setProperty('--reel-fit', Math.max(phone ? 380 : 440, innerHeight - hdr - (phone ? 96 : 32)) + 'px');
    if (scroll) scrollBy({ top: sc.getBoundingClientRect().top - hdr - 12 });
    sc.scrollTop = this.index() * sc.clientHeight; // giữ đúng món sau khi đổi chiều cao
  }
  private reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private placed = false;

  protected go(i: number): void {
    const n = this.items().length;
    if (!n) return;
    const to = Math.max(0, Math.min(n - 1, i));
    const sc = this.scroller().nativeElement, el = this.slides()[to]?.nativeElement;
    // Cuộn trong khung món (không dùng scrollIntoView để trang ngoài đứng yên); cập nhật ngay để nút và bảng nguyên liệu đổi theo
    if (el) sc.scrollTo({ top: to * sc.clientHeight, behavior: this.reduced ? 'auto' : 'smooth' });
    this.index.set(to);
  }
  protected onKey(e: KeyboardEvent): void {
    const k = e.key;
    if (k === 'ArrowDown' || k === 'j' || k === 'PageDown') { e.preventDefault(); this.go(this.index() + 1); }
    else if (k === 'ArrowUp' || k === 'k' || k === 'PageUp') { e.preventDefault(); this.go(this.index() - 1); }
    else if (k === 'Home') { e.preventDefault(); this.go(0); }
    else if (k === 'End') { e.preventDefault(); this.go(this.items().length - 1); }
  }
  protected openSheet(): void { const d = this.sheet().nativeElement; if (!d.open) d.showModal(); }
  /** "Nấu món này": mở hộp công thức ngay trên trang Lướt món (không chuyển sang Meal Planner) */
  private recipeDlg = viewChild.required<RecipeDialog>('recipeDlg');
  protected cook(id: string): void { this.recipeDlg().open(id); }
  protected openPosts(id: string): void { void this.router.navigate(['/cong-dong'], { queryParams: { mon: id } }); }

  protected async addAll(): Promise<void> {
    const c = this.settled(); if (!c || this.adding()) return; // cùng món với danh sách nguyên liệu đang tính
    this.adding.set(true);
    try {
      const items = this.buyable();
      const { added, failed } = await this.cart.addMany(items.map(l => ({ id: l.product!.id, qty: l.cartQty })));
      if (failed.length) this.toast.error(`Đã thêm ${added}/${items.length} sản phẩm của “${c.recipe.name}”. Chưa thêm được: ${failed.join(', ')}`);
      else this.toast.success(`Đã thêm ${added} sản phẩm của “${c.recipe.name}” vào giỏ`, { label: 'Xem giỏ', run: () => this.ui.openCart() });
    } finally { this.adding.set(false); }
  }

  constructor() {
    // Món đang xem = ô chiếm phần lớn khung cuộn
    const io = signal<IntersectionObserver | null>(null);
    afterNextRender(() => io.set(new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) this.index.set(Number((e.target as HTMLElement).dataset['i']));
    }, { root: this.scroller().nativeElement, threshold: 0.6 })));
    effect(() => { const o = io(); if (!o) return; o.disconnect(); this.slides().forEach(s => o.observe(s.nativeElement)); });
    inject(DestroyRef).onDestroy(() => io()?.disconnect());
    // Mở đúng món trên URL một lần khi dữ liệu đã có
    effect(() => {
      const list = this.items(), id = this.start();
      if (this.placed || !list.length || !this.slides().length) return;
      this.placed = true;
      // Đưa khung món lên sát dưới header dính và cho khung cao đúng phần màn hình còn lại (mọi cỡ, mọi mức zoom).
      // Header thu nhỏ khi trang cuộn nên căn hai lần; đổi cỡ cửa sổ thì tính lại.
      setTimeout(() => this.fit(true), 250); setTimeout(() => this.fit(true), 700);
      const onResize = () => this.fit(false);
      addEventListener('resize', onResize, { passive: true });
      this.destroyRef.onDestroy(() => removeEventListener('resize', onResize));
      const i = id ? list.findIndex(x => x.recipe.id === id) : -1;
      if (i > 0) { this.index.set(i); queueMicrotask(() => { const sc = this.scroller().nativeElement, el = this.slides()[i]?.nativeElement; if (el) sc.scrollTop = i * sc.clientHeight; }); }
    });
    // Báo món đang xem lên trang cha để ghi vào URL (chia sẻ link đúng món)
    // Chỉ ghi link sau khi dừng lướt ~350ms: đổi URL ở mỗi món làm router chạy lại giữa lúc đang cuộn, gây khựng
    let urlTimer: ReturnType<typeof setTimeout> | undefined, panelTimer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const i = this.index(), c = this.cur();
      untracked(() => this.built.update(b => { if (b.has(i)) return b; const n = new Set(b); for (let k = i - 3; k <= i + 3; k++) if (k >= 0) n.add(k); return n; }));
      clearTimeout(panelTimer); panelTimer = setTimeout(() => this.settledIdx.set(i), 120);
      if (!c || !this.placed) return;
      clearTimeout(urlTimer); urlTimer = setTimeout(() => this.moved.emit(c.recipe.id), 350);
    });
  }
}
