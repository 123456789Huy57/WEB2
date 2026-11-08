import { Component, ViewEncapsulation, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { VoucherService } from '../../core/voucher.service';

type Errors = Partial<Record<'identifier' | 'password' | 'fullName' | 'phone' | 'email' | 'confirm', string>>;

@Component({
  selector: 'fm-login',
  imports: [FormsModule, RouterLink],
  styleUrl: './login.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="auth band">
      <div class="auth-media"><img src="/img/thu-ngan.jpg" alt="Quầy thu ngân FreshMart" width="1400" height="933"></div>
      <div class="auth-box">
        <div class="tabs" role="tablist" aria-label="Tài khoản">
          <button class="tab" role="tab" type="button" [attr.aria-selected]="!signup()" (click)="switchTab(false)">Đăng nhập</button>
          <button class="tab" role="tab" type="button" [attr.aria-selected]="signup()" (click)="switchTab(true)">Tạo tài khoản</button>
        </div>
        @if (!signup()) {
          <form class="auth-form" (ngSubmit)="login()" novalidate>
            <h1 class="h2">Chào bạn quay lại</h1>
            <p class="muted">{{ admin() ? 'Trang quản trị cần tài khoản admin.' : 'Đăng nhập để xem đơn hàng, mã đã lưu và món yêu thích.' }}</p>
            <div class="field">
              <label for="in-id">Email hoặc số điện thoại</label>
              <input id="in-id" name="identifier" type="text" autocomplete="username" required [(ngModel)]="identifier" [attr.aria-invalid]="!!fe().identifier" aria-describedby="in-id-err">
              <span id="in-id-err" class="err small">{{ fe().identifier }}</span>
            </div>
            <div class="field">
              <label for="in-pw">Mật khẩu</label>
              <div class="pw-wrap">
                <input id="in-pw" name="pw" [type]="showPw() ? 'text' : 'password'" autocomplete="current-password" required [(ngModel)]="password" [attr.aria-invalid]="!!fe().password" aria-describedby="in-pw-err">
                <button class="pw-toggle" type="button" (click)="showPw.set(!showPw())" [attr.aria-label]="showPw() ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" [attr.aria-pressed]="showPw()">{{ showPw() ? 'Ẩn' : 'Hiện' }}</button>
              </div>
              <span id="in-pw-err" class="err small">{{ fe().password }}</span>
            </div>
            <div class="auth-row">
              <label class="check"><input type="checkbox" name="rememberMe" [(ngModel)]="rememberMe"> Ghi nhớ đăng nhập 7 ngày</label>
              <a class="link" routerLink="/quen-mat-khau">Quên mật khẩu?</a>
            </div>
            <p class="err small" role="alert">{{ err() }}</p>
            <button class="btn btn-forest" type="submit" [disabled]="busy()">{{ busy() ? 'Đang xử lý…' : 'Đăng nhập' }}</button>
          </form>
        } @else {
          <form class="auth-form" (ngSubmit)="register()" novalidate>
            <h1 class="h2">Tạo tài khoản</h1>
            <p class="muted">Nhận mã WELCOME10 giảm 10% cho đơn đầu tiên.</p>
            <div class="field">
              <label for="up-name">Họ và tên</label>
              <input id="up-name" name="name" autocomplete="name" required [(ngModel)]="fullName" [attr.aria-invalid]="!!fe().fullName">
              <span class="err small">{{ fe().fullName }}</span>
            </div>
            <div class="field">
              <label for="up-phone">Số điện thoại</label>
              <input id="up-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required [(ngModel)]="phone" [attr.aria-invalid]="!!fe().phone">
              <span class="err small">{{ fe().phone }}</span>
            </div>
            <div class="field">
              <label for="up-email">Email</label>
              <input id="up-email" name="email" type="email" autocomplete="email" required [(ngModel)]="email" [attr.aria-invalid]="!!fe().email">
              <span class="err small">{{ fe().email }}</span>
            </div>
            <div class="field">
              <label for="up-pw">Mật khẩu</label>
              <div class="pw-wrap">
                <input id="up-pw" name="pw" [type]="showPw() ? 'text' : 'password'" autocomplete="new-password" required [(ngModel)]="password" [attr.aria-invalid]="!!fe().password">
                <button class="pw-toggle" type="button" (click)="showPw.set(!showPw())" [attr.aria-label]="showPw() ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" [attr.aria-pressed]="showPw()">{{ showPw() ? 'Ẩn' : 'Hiện' }}</button>
              </div>
              <span class="err small">{{ fe().password || '' }}</span>
              @if (!fe().password) { <span class="hint">Ít nhất 8 ký tự</span> }
            </div>
            <div class="field">
              <label for="up-pw2">Nhập lại mật khẩu</label>
              <input id="up-pw2" name="pw2" [type]="showPw() ? 'text' : 'password'" autocomplete="new-password" required [(ngModel)]="confirm" [attr.aria-invalid]="!!fe().confirm">
              <span class="err small">{{ fe().confirm }}</span>
            </div>
            <p class="err small" role="alert">{{ err() }}</p>
            <button class="btn btn-forest" type="submit" [disabled]="busy()">{{ busy() ? 'Đang xử lý…' : 'Tạo tài khoản' }}</button>
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
  protected busy = signal(false);
  protected showPw = signal(false);
  protected err = signal('');
  protected fe = signal<Errors>({});
  protected rememberMe = false;
  protected identifier = '';
  protected email = '';
  protected password = '';
  protected confirm = '';
  protected fullName = '';
  protected phone = '';

  protected switchTab(signup: boolean): void {
    this.signup.set(signup);
    this.err.set('');
    this.fe.set({});
    this.password = '';
    this.confirm = '';
  }

  protected async login(): Promise<void> {
    const id = this.identifier.trim();
    const e: Errors = {};
    if (!id) e.identifier = 'Nhập email hoặc số điện thoại';
    else if (!isEmail(id) && !isPhone(id)) e.identifier = 'Email hoặc số điện thoại chưa đúng định dạng';
    if (!this.password) e.password = 'Nhập mật khẩu';
    this.fe.set(e);
    this.err.set('');
    if (Object.keys(e).length || this.busy()) return;
    this.busy.set(true);
    const r = await this.auth.login(id, this.password, this.rememberMe);
    this.busy.set(false);
    if (!r.ok) { this.err.set(r.msg); return; }
    this.router.navigateByUrl(this.safeNext() || (r.user?.role === 'admin' ? '/admin' : '/tai-khoan'));
  }

  protected async register(): Promise<void> {
    const name = this.fullName.trim(), phone = this.phone.trim(), email = this.email.trim();
    const e: Errors = {};
    if (name.length < 2) e.fullName = 'Nhập họ và tên';
    if (!isPhone(phone)) e.phone = 'Số điện thoại gồm 10 số, bắt đầu bằng 0';
    if (!isEmail(email)) e.email = 'Email chưa đúng định dạng';
    if (this.password.length < 8) e.password = 'Mật khẩu cần ít nhất 8 ký tự';
    if (this.confirm !== this.password) e.confirm = 'Mật khẩu nhập lại chưa khớp';
    this.fe.set(e);
    this.err.set('');
    if (Object.keys(e).length || this.busy()) return;
    this.busy.set(true);
    const r = await this.auth.register({ fullName: name, phone, email, password: this.password });
    this.busy.set(false);
    if (!r.ok) { this.err.set(r.msg); return; }
    if (!this.vs.isSaved('WELCOME10')) this.vs.toggleSave('WELCOME10');
    this.router.navigateByUrl(this.safeNext() || '/tai-khoan');
  }

  /** Chỉ cho quay về đường dẫn nội bộ, chặn chuyển hướng sang trang ngoài. */
  private safeNext(): string | undefined {
    const n = this.next();
    return n?.startsWith('/') && !n.startsWith('//') ? n : undefined;
  }
}

const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);
const isPhone = (v: string) => /^0\d{9}$/.test(v);
