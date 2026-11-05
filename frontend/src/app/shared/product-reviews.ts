import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, apiMessage } from '../core/auth.service';
import { ToastService } from '../core/toast.service';

interface Review { id: string; productId: string; userName: string; rating: number; comment: string; createdAt: string; updatedAt?: string; }
interface ReviewPage { items: Review[]; page: number; pageSize: number; total: number; count: number; average: number; distribution: number[]; }

/** Đánh giá của khách đã nhận hàng. Khách chưa mua chỉ xem; đã nhận hàng thì viết hoặc sửa đánh giá của mình. */
@Component({
  selector: 'fm-product-reviews',
  imports: [DatePipe, RouterLink],
  styles: `
    .prv { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: 56px; align-items: start; }
    .prv-score { display: flex; align-items: baseline; gap: 12px; }
    .prv-score b { font-family: var(--display); font-size: 64px; line-height: 1; font-weight: 600; }
    .stars { color: var(--sun, #f5b301); letter-spacing: 2px; }
    .prv-dist { list-style: none; padding: 0; margin: 18px 0 0; display: flex; flex-direction: column; gap: 6px; }
    .prv-dist li { display: grid; grid-template-columns: 32px minmax(0, 1fr) 28px; gap: 10px; align-items: center; font-size: var(--t-small); }
    .prv-dist .track { height: 8px; background: var(--stone); border-radius: 99px; overflow: hidden; }
    .prv-dist .track i { display: block; height: 100%; background: var(--forest); }
    .prv-form { margin-top: 28px; display: flex; flex-direction: column; gap: 12px; }
    .prv-pick { display: flex; gap: 4px; }
    .prv-pick button { border: 0; background: none; font-size: 30px; line-height: 1; cursor: pointer; color: var(--line, #ccc); padding: 0 2px; }
    .prv-pick button.on { color: var(--sun, #f5b301); }
    .prv-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
    .prv-list li { padding: 18px 0; border-bottom: 1px solid var(--line, #e5e5e5); }
    .prv-list p { margin: 6px 0 0; }
    @media (max-width: 860px) { .prv { grid-template-columns: 1fr; gap: 32px; } }
  `,
  template: `
    <div class="prv">
      <div>
        @if (data(); as d) {
          @if (d.count) {
            <div class="prv-score"><b class="num">{{ d.average.toString().replace('.', ',') }}</b><span><span class="stars" aria-hidden="true">{{ stars(d.average) }}</span><br><span class="small muted">{{ d.count }} đánh giá</span></span></div>
            <ul class="prv-dist" aria-label="Phân bố số sao">
              @for (n of [5, 4, 3, 2, 1]; track n) {
                <li><span class="num">{{ n }} ★</span><span class="track"><i [style.width.%]="d.count ? (d.distribution[n - 1] / d.count) * 100 : 0"></i></span><span class="num muted">{{ d.distribution[n - 1] }}</span></li>
              }
            </ul>
          } @else { <p class="muted">Chưa có đánh giá nào. Khách đã nhận hàng sẽ là người đánh giá đầu tiên.</p> }
        }
        @if (!auth.user()) {
          <p class="small muted" style="margin-top:20px"><a class="link" routerLink="/dang-nhap">Đăng nhập</a> để đánh giá sản phẩm bạn đã mua.</p>
        } @else if (me(); as m) {
          @if (m.canReview) {
            <form class="prv-form" (submit)="$event.preventDefault(); send()">
              <span class="f-h">{{ m.review ? 'Sửa đánh giá của bạn' : 'Viết đánh giá' }}</span>
              <div class="prv-pick" role="radiogroup" aria-label="Số sao">
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <button type="button" role="radio" [attr.aria-checked]="rating() === n" [class.on]="n <= rating()" (click)="rating.set(n)" [attr.aria-label]="n + ' sao'">★</button>
                }
              </div>
              <label class="sr" for="pprv-c">Nhận xét</label>
              <textarea id="pprv-c" maxlength="1000" placeholder="Sản phẩm tươi không, đóng gói thế nào?" [value]="comment()" (input)="comment.set($any($event.target).value)"></textarea>
              <div style="display:flex;gap:10px">
                <button class="btn btn-forest btn-sm" type="submit" [disabled]="!rating() || busy()">{{ busy() ? 'Đang gửi…' : 'Gửi đánh giá' }}</button>
                @if (m.review) { <button class="btn btn-paper btn-sm" type="button" (click)="remove()">Xóa đánh giá</button> }
              </div>
            </form>
          } @else {
            <p class="small muted" style="margin-top:20px">Bạn đánh giá được sau khi đã nhận hàng sản phẩm này.</p>
          }
        }
      </div>
      <ul class="prv-list">
        @for (r of data()?.items ?? []; track r.id) {
          <li>
            <div><b>{{ r.userName || 'Khách' }}</b> <span class="stars small" style="margin-left:6px" [attr.aria-label]="r.rating + ' sao'">{{ stars(r.rating) }}</span> <span class="small muted num">· {{ r.createdAt | date: 'dd/MM/yyyy' }}</span> <span class="small muted">· Đã mua hàng</span></div>
            @if (r.comment) { <p>{{ r.comment }}</p> }
          </li>
        }
        @if (more()) { <li><button class="link-btn" type="button" (click)="loadMore()">Xem thêm đánh giá</button></li> }
      </ul>
    </div>
  `
})
export class ProductReviews {
  readonly productId = input.required<string>();
  protected auth = inject(AuthService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  protected data = signal<ReviewPage | null>(null);
  protected me = signal<{ canReview: boolean; review: Review | null } | null>(null);
  protected rating = signal(0);
  protected comment = signal('');
  protected busy = signal(false);
  protected more = computed(() => { const d = this.data(); return !!d && d.items.length < d.total; });

  constructor() {
    effect(() => { const id = this.productId(); this.auth.user(); untracked(() => void this.load(id)); });
  }
  protected stars(n: number): string { const r = Math.min(5, Math.floor(n + 0.25)); return '★'.repeat(r) + '☆'.repeat(5 - r); }

  private async load(id: string): Promise<void> {
    try { this.data.set(await firstValueFrom(this.http.get<ReviewPage>(`/api/products/${id}/reviews?pageSize=10`))); } catch { this.data.set(null); }
    if (!this.auth.user()) { this.me.set(null); return; }
    try {
      const m = await firstValueFrom(this.http.get<{ canReview: boolean; review: Review | null }>(`/api/products/${id}/reviews/me`));
      this.me.set(m); this.rating.set(m.review?.rating ?? 0); this.comment.set(m.review?.comment ?? '');
    } catch { this.me.set(null); }
  }
  protected async loadMore(): Promise<void> {
    const d = this.data(); if (!d) return;
    const next = await firstValueFrom(this.http.get<ReviewPage>(`/api/products/${this.productId()}/reviews?pageSize=10&page=${d.page + 1}`));
    this.data.set({ ...next, items: [...d.items, ...next.items] });
  }
  protected async send(): Promise<void> {
    if (!this.rating() || this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.http.post(`/api/products/${this.productId()}/reviews`, { rating: this.rating(), comment: this.comment().trim() }));
      this.toast.show('Cảm ơn bạn đã đánh giá!');
      await this.load(this.productId());
    } catch (error) { this.toast.show(apiMessage(error)); }
    finally { this.busy.set(false); }
  }
  protected async remove(): Promise<void> {
    try { await firstValueFrom(this.http.delete(`/api/products/${this.productId()}/reviews/me`)); this.toast.show('Đã xóa đánh giá'); await this.load(this.productId()); }
    catch (error) { this.toast.show(apiMessage(error)); }
  }
}
