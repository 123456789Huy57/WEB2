import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiMessage } from '../core/auth.service';
import { NewsletterService } from '../core/newsletter.service';

@Component({
  selector: 'fm-footer',
  imports: [RouterLink, FormsModule],
  host: { class: 'footer band' },
  template: `
    <div class="f-top">
      <div class="f-news">
        <p class="h3">Nhận ưu đãi mỗi tuần</p>
        <form (ngSubmit)="subscribe()">
          <label class="sr" for="newsletter-email">Email</label>
          <input id="newsletter-email" name="email" type="email" autocomplete="email" placeholder="Email của bạn" required maxlength="254" [(ngModel)]="email" [disabled]="busy()">
          <button class="btn btn-paper" type="submit" [disabled]="busy()">{{ busy() ? 'Đang gửi…' : 'Đăng ký' }}</button>
        </form>
        <p class="small" style="margin-top:10px" role="status" aria-live="polite">{{ note() }}</p>
      </div>
      <div class="f-cols">
      <div><h3 class="f-h">FreshMart</h3><ul><li><a routerLink="/cua-hang">Về FreshMart</a></li><li><a routerLink="/thong-tin/doi-ngu">Đội ngũ phát triển</a></li><li><a routerLink="/thong-tin/doi-tac">Đối tác</a></li><li><a routerLink="/blog">Blog ẩm thực</a></li><li><a routerLink="/cua-hang" fragment="faq">Câu hỏi thường gặp</a></li></ul></div>
      <div><h3 class="f-h">Hỗ trợ</h3><ul><li><a routerLink="/thong-tin/huong-dan">Hướng dẫn mua hàng</a></li><li><a routerLink="/tra-cuu-don">Tra cứu đơn hàng</a></li><li><a routerLink="/thong-tin/giao-hang">Chính sách giao hàng</a></li><li><a routerLink="/thong-tin/doi-tra">Đổi trả, hoàn tiền</a></li><li><a routerLink="/thong-tin/bao-mat">Bảo mật thông tin</a></li></ul></div>
      <div><h3 class="f-h">Liên hệ</h3><ul><li>63 Đường Số 1, P. Tân Hưng, Quận 7, TP.HCM</li><li class="num">038 369 0006</li><li>7:00 – 22:00 mỗi ngày</li></ul></div>
      </div>
    </div>
    <div class="f-bottom">
      <p class="f-mark" aria-hidden="true">FreshMart</p>
      <div class="f-base"><span>© 2026 FreshMart · Đồ án môn Phát triển web kinh doanh</span></div>
    </div>
  `
})
export class Footer {
  private newsletter = inject(NewsletterService);
  protected email = '';
  protected busy = signal(false);
  protected note = signal('Không spam. Hủy đăng ký bất cứ lúc nào.');
  protected async subscribe(): Promise<void> {
    const email = this.email.trim();
    if (this.busy()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.note.set('Email chưa đúng định dạng.'); return; }
    this.busy.set(true);
    try {
      const result = await this.newsletter.subscribe(email);
      this.note.set(result.delivery === 'outbox' ? 'Đã đăng ký. Máy chủ đang dùng hộp thư thử của nhóm nên chưa gửi tới email thật.' : result.message);
      this.email = '';
    } catch (error) { this.note.set(apiMessage(error)); }
    finally { this.busy.set(false); }
  }
}
