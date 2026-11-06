import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { ProductService } from '../../core/product.service';
import { VoucherService } from '../../core/voucher.service';
import { AuthService } from '../../core/auth.service';
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
  protected done = signal<{
    code: string; subtotal: number; shipping: number; discount: number; total: number;
    slot: string; payment: string; name: string; phone: string; address: string; note: string;
    items: { product: Product; qty: number; price: number }[]; guest: boolean;
  } | null>(null);
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
    this.tried.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const first = (['name', 'phone', 'email', 'address'] as const).find(k => this.form.controls[k].invalid);
      document.getElementById({ name: 'f-name', phone: 'f-phone', email: 'f-email', address: 'f-addr' }[first!])?.focus();
      this.toast.show('Kiểm tra lại thông tin người nhận');
      return;
    }
    // Tồn kho có thể đã thay đổi từ lúc bỏ vào giỏ
    const over = this.cart.lines().filter(l => l.qty > l.p.stock);
    if (over.length) {
      over.forEach(l => this.cart.set(l.p.id, l.p.stock));
      this.toast.show(`${this.ps.shortName(over[0].p)} chỉ còn ${this.ps.qty(over[0].p.stock)} ${this.ps.unit(over[0].p)}, giỏ hàng đã được cập nhật`);
      return;
    }
    this.sending.set(true);
    const v = this.form.getRawValue();
    // Khi có backend: this.http.post('/api/orders', ...) thay cho dòng dưới
    setTimeout(() => {
      const t = this.t();
      const lines = this.cart.lines().map(l => ({ product: l.p, qty: l.qty, price: this.ps.price(l.p) }));
      const o = this.orders.place(v, lines.map(l => ({ id: l.product.id, qty: l.qty })), { ship: t.ship, disc: t.disc, voucherCode: t.voucher?.code }, this.auth.user());
      this.cart.clear();
      this.done.set({
        code: o.orderCode, subtotal: t.sub, shipping: t.ship, discount: t.disc, total: t.total,
        slot: v.slot, payment: PAYMENT_LABEL[v.payment], name: v.name, phone: v.phone, address: v.address, note: v.note,
        items: lines, guest: !this.auth.user()
      });
      this.sending.set(false);
      window.scrollTo(0, 0);
    }, 600);
  }
}
