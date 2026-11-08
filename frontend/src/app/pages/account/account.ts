import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
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
  protected profile = { fullName: this.u?.fullName ?? '', phone: this.u?.phone ?? '', address: this.u?.address ?? '' };

  protected buyAgain(o: OrderView): void {
    const ok = o.lines.filter(l => l.p.active !== false && l.p.stock > 0);
    ok.forEach(l => this.cart.add(l.p.id, Math.min(l.qty, l.p.stock)));
    this.toast.show(ok.length < o.lines.length ? `Đã thêm ${ok.length}/${o.lines.length} sản phẩm, số còn lại tạm hết hàng` : `Đã thêm ${ok.length} sản phẩm của đơn ${o.orderCode} vào giỏ`);
  }
  protected async cancelOrder(o: OrderView): Promise<void> {
    if (!(await this.cf.ask(`Hủy đơn ${o.orderCode}?`, 'Đơn chưa được soạn nên bạn hủy được ngay. Nếu đã chuyển khoản, FreshMart hoàn tiền trong 3–5 ngày làm việc.', 'Hủy đơn'))) return;
    this.orderSvc.setStatus(o.orderCode, 'cancelled');
    this.toast.show(`Đã hủy đơn ${o.orderCode}`);
  }
  protected useVoucher(code: string): void { this.cart.setVoucher(code); this.router.navigateByUrl('/gio-hang'); }
  protected saveProfile(form: NgForm): void {
    if (form.invalid) { form.form.markAllAsTouched(); this.toast.show('Kiểm tra lại họ tên và số điện thoại'); return; }
    this.auth.update({ ...this.profile, fullName: this.profile.fullName.trim(), phone: this.profile.phone.trim() });
    this.toast.show('Đã lưu thông tin');
  }
  protected logout(): void { this.auth.logout(); this.router.navigateByUrl('/'); }
}
