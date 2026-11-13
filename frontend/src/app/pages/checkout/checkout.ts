import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { ProductService } from '../../core/product.service';
import { VoucherService } from '../../core/voucher.service';
import { AuthService, apiMessage } from '../../core/auth.service';
import { OrderService, PAYMENT_LABEL } from '../../core/order.service';
import { ToastService } from '../../core/toast.service';
import { PaymentMethod, Product } from '../../core/models';
import { VndPipe } from '../../shared/vnd.pipe';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';

/** Khung giờ giao: khung nào bắt đầu trong vòng 1 giờ tới thì không chọn được */
function buildSlots() {
  const h = new Date().getHours();
  const raw: [string, string, number][] = [['9:00', '11:00', 9], ['12:00', '14:00', 12], ['16:00', '18:00', 16], ['18:00', '20:00', 18]];
  const first = raw.findIndex(s => s[2] - 1 > h);
  const day = first < 0 ? 'Ngày mai' : 'Hôm nay';
  return raw.map(([from, to], i) => ({ day, from, to, value: `${day} ${from}–${to}`, disabled: first >= 0 && i < first, preferred: first < 0 ? i === 0 : i === first }));
}

import { normalizePhone, personNameValidator, phoneMessage, vnPhoneValidator } from '../../shared/validators';

@Component({
  selector: 'fm-checkout',
  imports: [ReactiveFormsModule, RouterLink, VndPipe, ImgFallbackDirective],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
  encapsulation: ViewEncapsulation.None
})
export class Checkout {
  protected cart = inject(CartService);
  protected ps = inject(ProductService);
  protected auth = inject(AuthService);
  private vs = inject(VoucherService);
  protected orders = inject(OrderService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected t = this.cart.totals;
  protected slots = buildSlots();
  protected sending = signal(false);
  protected done = signal<{
    code: string; subtotal: number; shipping: number; discount: number; total: number;
    slot: string; payment: string; name: string; phone: string; address: string; note: string;
    items: { product: Product; qty: number; price: number }[]; guest: boolean;
  } | null>(null);
  private tried = signal(false);

  private u = this.auth.user();
  protected form = inject(FormBuilder).nonNullable.group({
    name: [this.u?.fullName ?? '', [Validators.required, Validators.minLength(2), personNameValidator()]],
    phone: [this.u?.phone ?? '', [Validators.required, vnPhoneValidator()]],
    email: [this.u?.email ?? '', [Validators.email]],
    address: [this.u?.address ?? '', [Validators.required, Validators.minLength(6)]],
    note: [''],
    slot: [this.slots.find(s => s.preferred)!.value],
    payment: ['cod' as PaymentMethod]
  });

  /** Mã đã lưu lên đầu; mã chưa đủ điều kiện vẫn hiện nhưng không chọn được */
  protected voucherOptions = computed(() => {
    const sub = this.cart.subtotal(), saved = this.vs.saved(), ordered = this.orders.hasOrdered(this.auth.user());
    const mine = new Map(this.vs.mine().map(v => [v.code, v]));
    const list = [...this.vs.all().map(v => ({ ...v, ...mine.get(v.code) })), ...[...mine.values()].filter(v => !this.vs.all().some(x => x.code === v.code))];
    return list
      .sort((a, b) => Number(saved.includes(b.code)) - Number(saved.includes(a.code)))
      .map(v => { const r = this.vs.check(v, sub, ordered); return { ...v, ok: r.ok, why: r.msg }; });
  });

  constructor() {
    // Giỏ tải từ server: chỉ quay về giỏ khi đã chắc chắn giỏ trống.
    void this.cart.load().then(() => { if (!this.cart.lines().length && !this.done()) this.router.navigateByUrl('/gio-hang'); });
    // Sửa thông tin là một yêu cầu đặt đơn mới (khóa chống trùng mới).
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.orders.resetAttempt());
  }

  protected phoneError = () => phoneMessage(this.form.controls.phone.errors);
  protected bad(name: 'name' | 'phone' | 'email' | 'address'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.tried());
  }

  protected async submit(): Promise<void> {
    this.tried.set(true); this.form.markAllAsTouched();
    if (this.form.invalid || this.sending()) return;
    if (!this.auth.user()) { this.router.navigate(['/dang-nhap'], { queryParams: { next: '/thanh-toan' } }); return; }
    if (this.cart.issues().length) { this.toast.show('Giỏ có sản phẩm vừa hết hàng hoặc ngừng bán. Sửa giỏ trước khi đặt.'); this.router.navigateByUrl('/gio-hang'); return; }
    this.sending.set(true);
    try {
      const raw = this.form.getRawValue();
      const f = { ...raw, name: raw.name.trim(), phone: normalizePhone(raw.phone) };
      // Giữ lại dòng hàng trước khi đặt (đặt xong giỏ sẽ trống) để trang xác nhận hiện đủ món.
      const items = this.cart.lines().map(l => ({ product: l.p, qty: l.qty, price: this.ps.price(l.p) }));
      const o = await this.orders.place(f, this.t().voucher ? this.cart.voucherCode() : '');
      // Đơn đã giữ hàng; thanh toán online thì chuyển sang cổng, kết quả quay về /thanh-toan/ket-qua.
      if (o.paymentMethod === 'bank') { await this.orders.pay(o); return; }
      if (o.paymentMethod === 'vnpay') {
        try { await this.orders.pay(o); return; }
        catch (error) { this.toast.show(`Đã tạo đơn ${o.orderCode} nhưng chưa mở được cổng thanh toán. Thanh toán lại trong Tài khoản.`); }
      }
      this.done.set({
        code: o.orderCode, subtotal: o.subtotal, shipping: o.shippingFee - o.shippingDiscount, discount: o.productDiscount, total: o.total,
        slot: f.slot, payment: PAYMENT_LABEL[o.paymentMethod], name: f.name, phone: f.phone, address: f.address, note: f.note,
        items, guest: false
      });
      window.scrollTo({ top: 0 });
    } catch (error) {
      this.toast.show(apiMessage(error));
      // Giá/tồn kho/voucher vừa đổi: tải lại giỏ để khách thấy số mới rồi bấm lại.
      if (error instanceof HttpErrorResponse && error.status === 409) { this.orders.resetAttempt(); await this.cart.load(); }
    } finally { this.sending.set(false); }
  }
}
