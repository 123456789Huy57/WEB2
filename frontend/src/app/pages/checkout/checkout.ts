import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

/** Khung giờ giao lấy từ server (giờ Việt Nam): hôm nay còn kịp và ngày mai. Server kiểm tra lại khi đặt đơn. */
interface Slot { value: string; date: string; day: 'today' | 'tomorrow'; dayLabel: string; time: string; label: string; }

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
  private http = inject(HttpClient);

  protected t = this.cart.totals;
  protected slots = signal<Slot[]>([]);
  protected slotGroups = computed(() => (['today', 'tomorrow'] as const)
    .map(day => ({ day, label: this.slots().find(s => s.day === day)?.dayLabel ?? '', slots: this.slots().filter(s => s.day === day) }))
    .filter(g => g.slots.length));
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
    slot: [''],
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
    // Thông tin điền sẵn từ tài khoản mà sai định dạng (tài khoản cũ) thì báo ngay, không đợi bấm đặt hàng.
    for (const k of ['name', 'phone', 'address'] as const) { const c = this.form.controls[k]; if (c.value && c.invalid) c.markAsTouched(); }
    this.loadSlots();
  }
  /** Tải khung giờ; chọn sẵn khung sớm nhất. Lỗi mạng thì để trống, server tự gán khung sớm nhất. */
  private loadSlots(keep = false): void {
    this.http.get<Slot[]>('/api/delivery-slots').subscribe({
      next: list => {
        this.slots.set(list);
        const cur = this.form.controls.slot.value;
        if (!keep || !list.some(x => x.value === cur)) this.form.controls.slot.setValue(list[0]?.value ?? '', { emitEvent: false });
      },
      error: () => {}
    });
  }

  protected phoneError = () => phoneMessage(this.form.controls.phone.errors);
  protected bad(name: 'name' | 'phone' | 'email' | 'address'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.tried());
  }

  protected async submit(): Promise<void> {
    this.tried.set(true); this.form.markAllAsTouched();
    if (this.form.invalid) {
      // Ô lỗi có thể nằm phía trên, ngoài màn hình: cuộn tới và đặt con trỏ vào ô đầu tiên cần sửa.
      const first = document.querySelector<HTMLElement>('.checkout [aria-invalid="true"], form [aria-invalid="true"]');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' }); first?.focus({ preventScroll: true });
      this.toast.show('Kiểm tra lại thông tin nhận hàng được đánh dấu đỏ');
      return;
    }
    if (this.sending()) return;
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
        slot: o.customer.slot ?? f.slot, payment: PAYMENT_LABEL[o.paymentMethod], name: f.name, phone: f.phone, address: f.address, note: f.note,
        items, guest: false
      });
      window.scrollTo({ top: 0 });
    } catch (error) {
      this.toast.show(apiMessage(error));
      // Giá/tồn kho/voucher vừa đổi: tải lại giỏ để khách thấy số mới rồi bấm lại.
      if (error instanceof HttpErrorResponse && error.status === 409) { this.orders.resetAttempt(); await this.cart.load(); }
      // Khung giờ vừa qua trong lúc khách điền form: tải lại danh sách, giữ khung đang chọn nếu còn.
      if (error instanceof HttpErrorResponse && error.error?.error?.code === 'DELIVERY_SLOT_UNAVAILABLE') { this.orders.resetAttempt(); this.loadSlots(true); }
    } finally { this.sending.set(false); }
  }
}
