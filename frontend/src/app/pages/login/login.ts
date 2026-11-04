import { Component, ViewEncapsulation, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { VoucherService } from '../../core/voucher.service';

@Component({
  selector: 'fm-login',
  imports: [FormsModule],
  styleUrl: './login.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="auth band">
      <div class="auth-media"><img src="/img/thu-ngan.jpg" alt="Quầy thu ngân FreshMart" width="1400" height="933"></div>
      <div class="auth-box">
        <div class="tabs" role="tablist" aria-label="Tài khoản">
          <button class="tab" role="tab" type="button" [attr.aria-selected]="!signup()" (click)="signup.set(false); err.set('')">Đăng nhập</button>
          <button class="tab" role="tab" type="button" [attr.aria-selected]="signup()" (click)="signup.set(true); err.set('')">Tạo tài khoản</button>
        </div>
        @if (!signup()) {
          <form class="auth-form" (ngSubmit)="login()" novalidate>
            <h1 class="h2">Chào bạn quay lại</h1>
            <p class="muted">{{ admin() ? 'Trang quản trị cần tài khoản admin.' : 'Đăng nhập để xem đơn hàng, mã đã lưu và món yêu thích.' }}</p>
            <div class="field"><label for="in-email">Email</label><input id="in-email" name="email" type="email" autocomplete="email" required [(ngModel)]="email"></div>
            <div class="field"><label for="in-pw">Mật khẩu</label><input id="in-pw" name="pw" type="password" autocomplete="current-password" required [(ngModel)]="password"></div>
            <p class="err small" aria-live="polite">{{ err() }}</p>
            <button class="btn btn-forest" type="submit">Đăng nhập</button>
          </form>
        } @else {
          <form class="auth-form" (ngSubmit)="register()" novalidate>
            <h1 class="h2">Tạo tài khoản</h1>
            <p class="muted">Nhận mã WELCOME10 giảm 10% cho đơn đầu tiên.</p>
            <div class="field"><label for="up-name">Họ và tên</label><input id="up-name" name="name" autocomplete="name" required [(ngModel)]="fullName"></div>
            <div class="field"><label for="up-phone">Số điện thoại</label><input id="up-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required [(ngModel)]="phone"></div>
            <div class="field"><label for="up-email">Email</label><input id="up-email" name="email" type="email" autocomplete="email" required [(ngModel)]="email"></div>
            <div class="field"><label for="up-pw">Mật khẩu</label><input id="up-pw" name="pw" type="password" autocomplete="new-password" required [(ngModel)]="password"><span class="hint">Ít nhất 8 ký tự</span></div>
            <p class="err small" aria-live="polite">{{ err() }}</p>
            <button class="btn btn-forest" type="submit">Tạo tài khoản</button>
          </form>
        }
      </div>
    </section>
  `
})
export class Login {
  /** ?next=/thanh-toan để quay lại đúng trang sau khi đăng nhập */
  readonly next = input<string>();
  readonly admin = input<string>();
  private auth = inject(AuthService);
  private vs = inject(VoucherService);
  private router = inject(Router);
  protected signup = signal(false);
  protected err = signal('');
  protected email = '';
  protected password = '';
  protected fullName = '';
  protected phone = '';

  protected async login(): Promise<void> {
    const r = await this.auth.login(this.email, this.password);
    if (!r.ok) { this.err.set(r.msg); return; }
    this.router.navigateByUrl((this.next()?.startsWith('/') && !this.next()?.startsWith('//') ? this.next() : undefined) || (r.user?.role === 'admin' ? '/admin' : '/tai-khoan'));
  }
  protected async register(): Promise<void> {
    const name = this.fullName.trim(), phone = this.phone.trim(), email = this.email.trim();
    if (name.length < 2) return this.err.set('Nhập họ và tên');
    if (!/^0\d{9}$/.test(phone)) return this.err.set('Số điện thoại gồm 10 số, bắt đầu bằng 0');
    if (!/^\S+@\S+\.\S+$/.test(email)) return this.err.set('Email chưa đúng định dạng');
    if (this.password.length < 8) return this.err.set('Mật khẩu cần ít nhất 8 ký tự');
    const r = await this.auth.register({ fullName: name, phone, email, password: this.password });
    if (!r.ok) return this.err.set(r.msg);
    if (!this.vs.isSaved('WELCOME10')) this.vs.toggleSave('WELCOME10');
    this.router.navigateByUrl((this.next()?.startsWith('/') && !this.next()?.startsWith('//') ? this.next() : undefined) || '/tai-khoan');
  }
}
