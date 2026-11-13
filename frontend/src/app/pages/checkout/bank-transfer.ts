import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BankInstructions, OrderService } from '../../core/order.service';
import { ToastService } from '../../core/toast.service';
import { apiMessage } from '../../core/auth.service';
import { Order } from '../../core/models';
import { VndPipe } from '../../shared/vnd.pipe';

/** Trang chuyển khoản: /thanh-toan/chuyen-khoan?ma=FM-... Hiện mã QR, hỏi server vài giây một lần, tiền vào thì báo thành công. */
@Component({
  selector: 'fm-bank-transfer',
  imports: [RouterLink, VndPipe],
  template: `
    <section class="band bt">
      @if (state() === 'paid') {
        <div class="bt-done">
          <h1 class="h2">Đã nhận tiền</h1>
          <p class="lead">FreshMart đã nhận {{ info()?.amount | vnd }} cho đơn {{ ma() }}. Cửa hàng sẽ gọi xác nhận và giao trong khung giờ bạn chọn.</p>
          <div class="bt-cta"><a class="btn btn-forest" routerLink="/tai-khoan">Xem đơn hàng</a><a class="btn btn-stone" routerLink="/san-pham">Tiếp tục mua sắm</a></div>
        </div>
      } @else if (state() === 'closed') {
        <div class="bt-done">
          <h1 class="h2">Đơn không còn chờ thanh toán</h1>
          <p class="lead">{{ reason() }}</p>
          <div class="bt-cta"><a class="btn btn-forest" routerLink="/tai-khoan">Xem đơn hàng</a></div>
        </div>
      } @else if (info(); as i) {
        <div class="bt-grid">
          <div class="bt-qr">
            <img [src]="i.qrUrl" width="320" height="320" alt="Mã QR chuyển khoản {{ i.amount }} đồng cho đơn {{ ma() }}">
            <p class="small muted">Mở app ngân hàng, chọn quét QR. Số tiền và nội dung đã điền sẵn.</p>
          </div>
          <div>
            <h1 class="h2">Quét mã để thanh toán</h1>
            <p class="bt-warn">Web demo đồ án: vui lòng không chuyển tiền thật.</p>
            <dl class="bt-facts">
              <div><dt>Ngân hàng</dt><dd>{{ i.bankCode }}</dd></div>
              <div><dt>Số tài khoản</dt><dd class="num">{{ i.account }} <button class="link-btn" type="button" (click)="copy(i.account)">Chép</button></dd></div>
              <div><dt>Chủ tài khoản</dt><dd>{{ i.holder }}</dd></div>
              <div><dt>Số tiền</dt><dd class="num">{{ i.amount | vnd }} <button class="link-btn" type="button" (click)="copy(i.amount + '')">Chép</button></dd></div>
              <div class="wide"><dt>Nội dung chuyển khoản (bắt buộc đúng)</dt><dd class="num">{{ i.content }} <button class="link-btn" type="button" (click)="copy(i.content)">Chép</button></dd></div>
            </dl>
            <p class="bt-wait" role="status"><span class="dot" aria-hidden="true"></span>Đang chờ tiền vào… trang tự cập nhật, không cần tải lại.</p>
            @if (left(); as l) { <p class="small muted">Đơn được giữ thêm {{ l }}. Quá hạn đơn tự hủy và trả hàng về kho.</p> }
            <p class="small muted">Đã chuyển nhưng chưa thấy cập nhật sau 5 phút? Cửa hàng sẽ kiểm tra và xác nhận tay, bạn không cần chuyển lại.</p>
          </div>
        </div>
      } @else {
        <p class="lead">{{ state() === 'error' ? reason() : 'Đang tạo mã QR…' }}</p>
        @if (state() === 'error') { <a class="btn btn-stone" routerLink="/tai-khoan">Xem đơn hàng</a> }
      }
    </section>
  `,
  styles: [`
    .bt { padding-block: clamp(40px, 6vw, 96px); }
    .bt-grid { display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: clamp(24px, 5vw, 64px); align-items: start; }
    .bt-qr img { width: 100%; height: auto; aspect-ratio: 1; border: 1px solid var(--stone-2); border-radius: 12px; background: #fff; display: block; }
    .bt-qr p { margin-top: 12px; }
    .bt-warn { margin: 12px 0 0; padding: 10px 14px; border-radius: 8px; background: #fff4e0; color: #7a4b00; font-size: var(--t-small); }
    .bt-facts { margin: 24px 0 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 32px; }
    .bt-facts .wide { grid-column: 1 / -1; }
    .bt-facts dt { color: var(--muted); font-size: var(--t-small); }
    .bt-facts dd { margin: 4px 0 0; font-size: 20px; font-weight: 600; overflow-wrap: anywhere; }
    .bt-facts .link-btn { font-size: var(--t-small); font-weight: 400; margin-left: 6px; }
    .bt-wait { margin-top: 28px; display: flex; align-items: center; gap: 10px; font-weight: 600; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--forest); animation: bt-pulse 1.2s ease-in-out infinite; }
    @keyframes bt-pulse { 50% { opacity: .25; } }
    .bt-done { max-width: 720px; }
    .bt-done .lead { margin-top: 16px; }
    .bt-cta { margin-top: 32px; display: flex; gap: 12px; flex-wrap: wrap; }
    @media (max-width: 720px) { .bt-grid { grid-template-columns: 1fr; } .bt-qr { max-width: 320px; } .bt-facts { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
  `]
})
export class BankTransfer {
  readonly ma = input<string>();
  private orders = inject(OrderService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  protected info = signal<BankInstructions | null>(null);
  protected state = signal<'loading' | 'waiting' | 'paid' | 'closed' | 'error'>('loading');
  protected reason = signal('');
  private now = signal(Date.now());
  protected left = computed(() => {
    const due = this.info()?.dueAt; if (!due) return '';
    const s = Math.max(0, Math.floor((Date.parse(due) - this.now()) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  private orderId = '';
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
    // Danh sách đơn tải xong mới biết id của mã đơn trên đường dẫn.
    effect(() => {
      const o = this.ma() ? this.orders.lookup(this.ma()!) : undefined;
      if (o && !this.orderId) untracked(() => void this.start(o));
      else if (!o && !this.orders.loading() && this.orders.mine().length && this.state() === 'loading') untracked(() => this.fail('Không tìm thấy đơn này trong tài khoản của bạn.'));
    });
  }

  private async start(o: Order): Promise<void> {
    this.orderId = o.id;
    if (this.check(o)) return;
    try { this.info.set(await this.orders.bankInstructions(o)); this.state.set('waiting'); }
    catch (error) { this.fail(apiMessage(error)); return; }
    this.timer = setInterval(() => void this.poll(), 4000);
  }
  private async poll(): Promise<void> {
    this.now.set(Date.now());
    if (document.hidden) return;
    try { this.check(await firstValueFrom(this.http.get<Order>(`/api/users/me/orders/${this.orderId}`))); }
    catch { /* mạng chập chờn: thử lại lượt sau */ }
  }
  /** true khi đơn đã ra khỏi trạng thái chờ chuyển khoản */
  private check(o: Order): boolean {
    if (o.paymentStatus === 'paid') { this.state.set('paid'); this.stop(); return true; }
    if (o.status !== 'pending' || o.paymentMethod !== 'bank') {
      this.reason.set(o.status === 'cancelled' ? 'Đơn đã hủy (quá hạn giữ hàng hoặc bạn đã hủy). Nếu bạn đã chuyển tiền, cửa hàng sẽ hoàn lại.' : 'Đơn này không dùng chuyển khoản.');
      this.state.set('closed'); this.stop(); return true;
    }
    return false;
  }
  private stop(): void { clearInterval(this.timer); void this.orders.reload(); }
  private fail(msg: string): void { this.reason.set(msg); this.state.set('error'); }
  protected async copy(text: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); this.toast.show('Đã chép'); } catch { this.toast.show('Không chép được, hãy chép tay'); }
  }
}
