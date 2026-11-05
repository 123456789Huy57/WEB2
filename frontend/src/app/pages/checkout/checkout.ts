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
import { PaymentMethod } from '../../core/models';
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
  private orders = inject(OrderService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected t = this.cart.totals;
  protected slots = buildSlots();
  protected sending = signal(false);
  protected done = signal<{ code: string; total: number; slot: string; payment: string; firstName: string; phone: string; guest: boolean } | null>(null);
  private tried = signal(false);

  private u = this.auth.user();
  protected form = inject(FormBuilder).nonNullable.group({
    name: [this.u?.fullName ?? '', [Validators.required, Validators.minLength(2)]],
    phone: [this.u?.phone ?? '', [Validators.required, Validators.pattern(/^0\d{9}$/)]],
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
      const f = this.form.getRawValue();
      const o = await this.orders.place(f, this.t().voucher ? this.cart.voucherCode() : '');
      this.done.set({ code: o.orderCode, total: o.total, slot: f.slot, payment: PAYMENT_LABEL[o.paymentMethod], firstName: f.name.trim().split(/\s+/).pop() ?? '', phone: f.phone, guest: false });
      window.scrollTo({ top: 0 });
    } catch (error) {
      this.toast.show(apiMessage(error));
      // Giá/tồn kho/voucher vừa đổi: tải lại giỏ để khách thấy số mới rồi bấm lại.
      if (error instanceof HttpErrorResponse && error.status === 409) { this.orders.resetAttempt(); await this.cart.load(); }
    } finally { this.sending.set(false); }
  }
}
