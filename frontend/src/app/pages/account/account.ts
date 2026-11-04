import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

@Component({
  selector: 'fm-account',
  imports: [FormsModule, RouterLink, ProductCard, VoucherList, OrderCard],
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
  protected passwordForm = { current: '', next: '', confirm: '' };
  protected passwordBusy = signal(false);
  protected passwordError = signal('');
  protected profileBusy = signal(false);
  protected profile = { fullName: this.u?.fullName ?? '', phone: this.u?.phone ?? '', address: this.u?.address ?? '' };

  protected buyAgain(o: OrderView): void {
    const ok = o.lines.filter(l => l.p.active !== false && l.p.stock > 0);
    ok.forEach(l => this.cart.add(l.p.id, Math.min(l.qty, l.p.stock)));
    this.toast.show(ok.length < o.lines.length ? `Đã thêm ${ok.length}/${o.lines.length} sản phẩm, số còn lại tạm hết hàng` : `Đã thêm ${ok.length} sản phẩm của đơn ${o.orderCode} vào giỏ`);
  }
  protected async cancelOrder(_o: OrderView): Promise<void> {
    this.toast.show('Quản lý đơn hàng đang được hoàn thiện.');
  }
  protected useVoucher(code: string): void { this.cart.setVoucher(code); this.router.navigateByUrl('/gio-hang'); }
  protected async saveProfile(): Promise<void> {
    if (this.profileBusy()) return;
    this.profileBusy.set(true);
    try { await this.auth.update({ ...this.profile, fullName: this.profile.fullName.trim() }); this.toast.show('Đã lưu thông tin'); }
    catch (error) { this.toast.show(apiMessage(error)); }
    finally { this.profileBusy.set(false); }
  }
  protected async changePassword(): Promise<void> {
    if (this.passwordBusy()) return;
    this.passwordError.set('');
    if (this.passwordForm.next.length < 8) { this.passwordError.set('Mật khẩu mới cần ít nhất 8 ký tự'); return; }
    if (this.passwordForm.next !== this.passwordForm.confirm) { this.passwordError.set('Hai mật khẩu mới chưa trùng nhau'); return; }
    this.passwordBusy.set(true);
    try {
      await this.auth.changePassword(this.passwordForm.current, this.passwordForm.next);
      this.toast.show('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');
      this.router.navigateByUrl('/dang-nhap');
    } catch (error) { this.passwordError.set(apiMessage(error)); }
    finally { this.passwordBusy.set(false); }
  }
  protected async logout(): Promise<void> {
    try { await this.auth.logout(); this.router.navigateByUrl('/'); } catch (error) { this.toast.show(apiMessage(error)); }
  }
}
