import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { ProductService } from '../../core/product.service';
import { VoucherService } from '../../core/voucher.service';
import { AuthService } from '../../core/auth.service';
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
    const sub = this.cart.subtotal(), saved = this.vs.saved();
    return [...this.vs.all()]
      .sort((a, b) => Number(saved.includes(b.code)) - Number(saved.includes(a.code)))
      .map(v => { const r = this.vs.check(v, sub, this.cart.hasOrdered()); return { ...v, ok: r.ok, why: r.msg }; });
  });

  constructor() {
    if (!this.cart.lines().length) this.router.navigateByUrl('/gio-hang');
  }

  protected bad(name: 'name' | 'phone' | 'email' | 'address'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.tried());
  }

  protected submit(): void {
    this.toast.show('Đặt hàng đang được hoàn thiện. Vui lòng quay lại sau.');
  }
}
