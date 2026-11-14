import { Component, ElementRef, ViewEncapsulation, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService, FREE_SHIP_FROM } from '../../core/cart.service';
import { ProductService } from '../../core/product.service';
import { VoucherService } from '../../core/voucher.service';
import { ToastService } from '../../core/toast.service';
import { AuthService } from '../../core/auth.service';
import { VndPipe } from '../../shared/vnd.pipe';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';
import { ProductCard } from '../../shared/product-card';
import { Recommendation, RecommendationService } from '../../core/recommendation.service';

@Component({
  selector: 'fm-cart',
  imports: [RouterLink, VndPipe, ImgFallbackDirective, ProductCard],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
  encapsulation: ViewEncapsulation.None
})
export class CartPage {
  protected cart = inject(CartService);
  protected ps = inject(ProductService);
  private vs = inject(VoucherService);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  protected t = this.cart.totals;
  protected code = signal(this.cart.voucherCode());
  /** Lỗi kiểm tra phía trình duyệt (ô trống, mã không có) */
  protected msg = signal('');
  /** Thông báo trung tính sau thao tác (đã gỡ mã, mã đã đang dùng) */
  protected note = signal('');
  protected applying = signal(false);
  protected applied = computed(() => this.t().voucher ?? null);
  /** Lỗi hiện dưới ô mã: lỗi server (hết hạn, chưa đủ giá trị đơn, đã dùng...) ưu tiên, rồi tới lỗi kiểm tra tại chỗ */
  protected vErr = computed(() => this.t().voucherMsg || this.msg());
  /** Gợi ý tối đa 3 mã đang chạy mà giỏ hiện tại đủ điều kiện (chỉ để gợi ý; server vẫn kiểm tra lại khi áp dụng) */
  protected suggestions = computed(() => {
    if (this.applied() || !this.auth.user()) return []; // server chỉ nhận mã của tài khoản đã đăng nhập
    const sub = this.t().sub, seen = new Set<string>();
    return [...this.vs.mine(), ...this.vs.all()]
      .filter(v => !seen.has(v.code) && seen.add(v.code) && !this.vs.isFirstOrderOnly(v) && this.vs.check(v, sub).ok)
      .sort((a, b) => this.vs.discount(b, sub, this.t().ship) - this.vs.discount(a, sub, this.t().ship))
      .slice(0, 3);
  });
  private vInput = viewChild<ElementRef<HTMLInputElement>>('vInput');
  protected needForFree = computed(() => FREE_SHIP_FROM - this.t().sub);

  /** "Thường được mua cùng" các món đang có trong giỏ (luật kết hợp); tải lại khi danh sách món đổi */
  private recs = inject(RecommendationService);
  protected together = signal<Recommendation[]>([]);
  private cartKey = computed(() => this.cart.lines().map(l => l.p.id).sort().join(','));
  protected learned = computed(() => this.together().filter(r => r.source !== 'category').map(r => r.product).slice(0, 4));
  constructor() {
    effect(() => {
      const key = this.cartKey();
      if (!key) { this.together.set([]); return; }
      void this.recs.forCart(6).then(list => { if (this.cartKey() === key) this.together.set(list); });
    });
  }
  /** Gợi ý mua thêm: hàng đang giảm, chưa có trong giỏ; nếu chưa đủ miễn phí giao thì ưu tiên món giá vừa đủ bù */
  protected suggest = computed(() => {
    const inCart = new Set([...this.cart.lines().map(l => l.p.id), ...this.learned().map(p => p.id)]);
    const need = this.needForFree();
    const fresh = ['vegetables', 'fruits', 'meat', 'seafood', 'dairy-eggs'];
    const pool = this.ps.all().filter(p => !inCart.has(p.id) && p.stock > 0 && fresh.includes(p.category) && !/^(thùng|combo|lốc)/i.test(p.name));
    const onSale = pool.filter(p => this.ps.off(p) > 0);
    const list = (onSale.length >= 4 ? onSale : pool)
      .filter(p => need <= 0 || this.ps.price(p) <= Math.max(need, 60000))
      .sort((a, b) => this.ps.off(b) - this.ps.off(a) || b.sold_count - a.sold_count);
    return list.slice(0, 4);
  });
  protected freePct = computed(() => Math.min(100, (this.t().sub / FREE_SHIP_FROM) * 100));

  protected typed(v: string): void { this.code.set(v); this.msg.set(''); this.note.set(''); }

  protected async apply(raw?: string): Promise<void> {
    if (this.applying()) return; // chặn bấm lặp khi đang chờ server
    const code = (raw ?? this.code()).trim().toUpperCase();
    this.code.set(code); this.note.set('');
    if (!code) { this.msg.set('Nhập mã giảm giá rồi bấm Áp dụng'); this.vInput()?.nativeElement.focus(); return; }
    if (!this.auth.user()) { this.msg.set('Mã giảm giá chỉ dùng được khi đã đăng nhập.'); return; }
    if (!this.vs.find(code)) { this.msg.set(`Mã ${code} không đúng hoặc đã ngừng áp dụng`); return; }
    this.msg.set('');
    const prev = this.applied()?.code ?? ''; // chỉ giữ lại mã cũ nếu nó đang thật sự được áp dụng
    this.applying.set(true);
    try {
      await this.cart.setVoucher(code);
      // Server từ chối mã mới thì giữ lại mã cũ (nếu có) và vẫn báo lý do của server
      if (!this.t().voucher && prev && prev !== code) {
        const reason = this.t().voucherMsg;
        await this.cart.setVoucher(prev);
        this.msg.set(reason);
      }
    } finally { this.applying.set(false); }
  }
  protected async removeVoucher(): Promise<void> {
    const c = this.applied()?.code ?? this.cart.voucherCode();
    this.applying.set(true);
    try { await this.cart.setVoucher(''); } finally { this.applying.set(false); }
    this.code.set(''); this.msg.set(''); this.note.set(`Đã gỡ mã ${c}. Tổng tiền đã tính lại.`);
    setTimeout(() => this.vInput()?.nativeElement.focus());
  }
  protected remove(id: string): void {
    const p = this.ps.get(id);
    this.cart.set(id, 0);
    if (p) this.toast.show(`Đã xóa ${this.ps.shortName(p)} khỏi giỏ`);
  }
}
