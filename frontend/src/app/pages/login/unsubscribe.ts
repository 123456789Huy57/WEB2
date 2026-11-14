import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../../core/auth.service';
import { NewsletterService } from '../../core/newsletter.service';

/** Mở từ liên kết "Hủy đăng ký" trong thư ưu đãi: /huy-nhan-uu-dai?token=... */
@Component({
  selector: 'fm-unsubscribe', imports: [RouterLink],
  template: `
    <section class="band" style="max-width:560px;padding-top:56px;padding-bottom:56px">
      <h1 class="h2">Hủy nhận thư ưu đãi</h1>
      @if (state() === 'done') {
        <p class="lead" role="status">{{ message() }}</p>
        <a class="btn btn-forest" routerLink="/">Về trang chủ</a>
      } @else if (state() === 'error') {
        <p class="err" role="status">{{ message() }}</p>
        <a class="btn btn-forest" routerLink="/">Về trang chủ</a>
      } @else {
        <p class="lead">Bạn sẽ không nhận email ưu đãi từ FreshMart nữa. Có thể đăng ký lại bất cứ lúc nào ở cuối trang.</p>
        <button class="btn btn-forest" type="button" [disabled]="state() === 'busy'" (click)="confirm()">{{ state() === 'busy' ? 'Đang xử lý…' : 'Xác nhận hủy đăng ký' }}</button>
      }
    </section>
  `
})
export class Unsubscribe implements OnInit {
  readonly token = input<string>();
  private newsletter = inject(NewsletterService);
  protected state = signal<'idle' | 'busy' | 'done' | 'error'>('idle');
  protected message = signal('');
  ngOnInit(): void {
    if (!this.token()) { this.state.set('error'); this.message.set('Liên kết hủy đăng ký thiếu mã xác nhận.'); }
  }
  protected async confirm(): Promise<void> {
    this.state.set('busy');
    try { this.message.set((await this.newsletter.unsubscribe(this.token()!)).message); this.state.set('done'); }
    catch (error) { this.message.set(apiMessage(error)); this.state.set('error'); }
  }
}
