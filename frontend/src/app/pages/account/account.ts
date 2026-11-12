import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, NgForm, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, apiMessage } from '../../core/auth.service';
import { OrderService, OrderView } from '../../core/order.service';
import { ProductService } from '../../core/product.service';
import { CartService } from '../../core/cart.service';
import { WishlistService } from '../../core/wishlist.service';
import { VoucherService } from '../../core/voucher.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';
import { Product, Voucher } from '../../core/models';
import { ProductCard } from '../../shared/product-card';
import { VoucherList } from '../../shared/voucher-list';
import { OrderCard } from '../../shared/order-card';

type Tab = 'orders' | 'wish' | 'vouchers' | 'profile';

import { matchFieldsValidator } from '../../shared/validators';

@Component({
  selector: 'fm-account',
  imports: [FormsModule, ReactiveFormsModule, RouterLink, ProductCard, VoucherList, OrderCard],
  templateUrl: './account.html',
  styleUrl: './account.css',
  encapsulation: ViewEncapsulation.None
})
export class Account {
  protected auth = inject(AuthService);
  protected ps = inject(ProductService);
  private orderSvc = inject(OrderService);
  private cart = inject(CartService);
  private wish = inject(WishlistService);
  private vs = inject(VoucherService);
  private toast = inject(ToastService);
  private cf = inject(ConfirmService);
  private router = inject(Router);

  protected tabs: { key: Tab; label: string }[] = [
    { key: 'orders', label: 'Đơn hàng' }, { key: 'wish', label: 'Yêu thích' }, { key: 'vouchers', label: 'Mã đã lưu' }, { key: 'profile', label: 'Thông tin' }
  ];
  protected tab = signal<Tab>('orders');
  protected firstName = computed(() => this.auth.user()?.fullName.split(' ').slice(-1)[0] ?? '');
  protected orders = computed(() => this.orderSvc.forUser(this.auth.user()));
  protected wishProducts = computed(() => this.wish.ids().map(id => this.ps.get(id)).filter((p): p is Product => !!p));
  protected savedVouchers = computed(() => this.vs.saved().map(c => this.vs.find(c)).filter((v): v is Voucher => !!v));

  private u = this.auth.user();
  /** Reactive Form: độ dài kiểm tra ở từng ô, "nhập lại phải trùng" kiểm tra ở cấp nhóm (Cross-Field Validation) */
  protected passwordForm = inject(FormBuilder).nonNullable.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  }, { validators: matchFieldsValidator('next', 'confirm') });
  protected pwTried = signal(false);
  protected passwordBusy = signal(false);
  protected passwordError = signal('');
  protected profileBusy = signal(false);
  protected profile = { fullName: this.u?.fullName ?? '', phone: this.u?.phone ?? '', address: this.u?.address ?? '' };

  protected async buyAgain(o: OrderView): Promise<void> {
    try {
      const skipped = await this.orderSvc.reorder(o);
      const added = o.lines.length - skipped.length;
      this.toast.show(skipped.length ? `Đã thêm ${added}/${o.lines.length} sản phẩm, số còn lại tạm hết hàng` : `Đã thêm ${added} sản phẩm của đơn ${o.orderCode} vào giỏ`);
    } catch (error) { this.toast.show(apiMessage(error)); }
  }
  protected async cancelOrder(o: OrderView): Promise<void> {
    if (!(await this.cf.ask('Hủy đơn hàng?', `Đơn ${o.orderCode} sẽ bị hủy và hàng được trả lại kho.`, 'Hủy đơn'))) return;
    try { await this.orderSvc.cancel(o); this.toast.show(`Đã hủy đơn ${o.orderCode}`); }
    catch (error) { this.toast.show(apiMessage(error)); }
  }
  protected useVoucher(code: string): void { this.cart.setVoucher(code); this.router.navigateByUrl('/gio-hang'); }
  protected async saveProfile(form: NgForm): Promise<void> {
    if (form.invalid) { form.form.markAllAsTouched(); this.toast.show('Kiểm tra lại họ tên và số điện thoại'); return; }
    if (this.profileBusy()) return;
    this.profileBusy.set(true);
    try { await this.auth.update({ ...this.profile, fullName: this.profile.fullName.trim(), phone: this.profile.phone.trim() }); this.toast.show('Đã lưu thông tin'); }
    catch (error) { this.toast.show(apiMessage(error)); }
    finally { this.profileBusy.set(false); }
  }
  protected async changePassword(): Promise<void> {
    if (this.passwordBusy()) return;
    this.passwordError.set('');
    this.pwTried.set(true);
    const f = this.passwordForm;
    if (f.invalid) {
      this.passwordError.set(f.controls.current.hasError('required') ? 'Nhập mật khẩu hiện tại'
        : f.controls.next.invalid ? 'Mật khẩu mới cần ít nhất 8 ký tự'
        : f.hasError('fieldsMismatch') ? 'Hai mật khẩu mới chưa trùng nhau' : 'Nhập lại mật khẩu mới');
      return;
    }
    this.passwordBusy.set(true);
    try {
      await this.auth.changePassword(f.controls.current.value, f.controls.next.value);
      this.toast.show('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');
      this.router.navigateByUrl('/dang-nhap');
    } catch (error) { this.passwordError.set(apiMessage(error)); }
    finally { this.passwordBusy.set(false); }
  }
  protected async logout(): Promise<void> {
    try { await this.auth.logout(); this.router.navigateByUrl('/'); } catch (error) { this.toast.show(apiMessage(error)); }
  }
}
