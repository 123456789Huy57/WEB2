import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, apiMessage } from '../../core/auth.service';

@Component({
  selector: 'fm-password-recovery', imports: [FormsModule, RouterLink],
  template: `
    <section class="band" style="max-width:560px;padding-top:56px;padding-bottom:56px">
      <h1 class="h2">{{ resetMode() ? 'Đặt lại mật khẩu' : 'Quên mật khẩu' }}</h1>
      @if (done()) {
        <p class="lead" role="status">{{ message() }}</p>
        <a class="btn btn-forest" routerLink="/dang-nhap">Về đăng nhập</a>
      } @else {
        <form class="form-grid" (ngSubmit)="submit()" style="margin-top:24px">
          @if (resetMode()) {
            <div class="field full"><label for="recover-password">Mật khẩu mới</label><input id="recover-password" name="password" type="password" autocomplete="new-password" minlength="8" required [(ngModel)]="password"></div>
            <div class="field full"><label for="recover-confirm">Nhập lại mật khẩu mới</label><input id="recover-confirm" name="confirm" type="password" autocomplete="new-password" required [(ngModel)]="confirm"></div>
          } @else {
            <p class="muted full">Nhập email đã đăng ký để nhận hướng dẫn khôi phục.</p>
            <div class="field full"><label for="recover-email">Email</label><input id="recover-email" name="email" type="email" autocomplete="email" required [(ngModel)]="email"></div>
          }
          <p class="err small full" role="status">{{ error() }}</p>
          <div class="full"><button class="btn btn-forest" type="submit" [disabled]="busy()">{{ busy() ? 'Đang xử lý…' : resetMode() ? 'Lưu mật khẩu mới' : 'Yêu cầu khôi phục' }}</button></div>
          <a class="link full" routerLink="/dang-nhap">Về đăng nhập</a>
        </form>
      }
    </section>
  `
})
export class PasswordRecovery {
  readonly token = input<string>();
  readonly resetMode = input(false);
  private auth = inject(AuthService);
  protected email = ''; protected password = ''; protected confirm = '';
  protected busy = signal(false); protected error = signal(''); protected done = signal(false); protected message = signal('');
  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    if (this.resetMode() && this.password !== this.confirm) { this.error.set('Hai mật khẩu mới chưa trùng nhau'); return; }
    this.busy.set(true);
    try {
      if (this.resetMode()) {
        if (!this.token()) { this.error.set('Liên kết khôi phục thiếu mã xác nhận'); return; }
        await this.auth.resetPassword(this.token()!, this.password);
        this.message.set('Đã đặt lại mật khẩu. Bạn hãy đăng nhập bằng mật khẩu mới.');
      } else {
        const result = await this.auth.requestRecovery(this.email);
        this.message.set(result.delivery === 'outbox' ? 'Yêu cầu đã được ghi nhận. Máy chủ đang dùng hộp thư thử (chưa cấu hình SMTP) nên thư chưa gửi tới email thật: chạy npm run mail:inbox trong thư mục backend để lấy liên kết.' : result.message);
      }
      this.done.set(true);
    } catch (error) { this.error.set(apiMessage(error)); }
    finally { this.busy.set(false); }
  }
}
