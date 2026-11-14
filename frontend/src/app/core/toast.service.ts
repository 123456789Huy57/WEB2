import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastAction { label: string; run: () => void; }

/**
 * Một thông báo duy nhất ở đáy màn hình. Thông báo mới thay thế thông báo cũ (không chồng nhiều hộp khi bấm thêm liên tục).
 * Rê chuột hoặc đưa phím Tab vào thì dừng đếm giờ để kịp đọc / bấm nút; có nút đóng.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal('');
  readonly visible = signal(false);
  readonly kind = signal<ToastKind>('info');
  readonly action = signal<ToastAction | null>(null);
  /** Tăng mỗi lần hiện để khung chạy lại hiệu ứng khi nội dung đổi */
  readonly seq = signal(0);
  private timer?: ReturnType<typeof setTimeout>;
  private duration = 3000;

  show(msg: string, opts: { kind?: ToastKind; action?: ToastAction; duration?: number } = {}): void {
    const kind = opts.kind ?? 'info';
    this.message.set(msg);
    this.kind.set(kind);
    this.action.set(opts.action ?? null);
    this.seq.update(n => n + 1);
    this.visible.set(true);
    // Lỗi cần đọc kỹ hơn; có nút thao tác thì chừa thời gian để bấm
    this.duration = opts.duration ?? (kind === 'error' ? 5000 : opts.action ? 4500 : 3000);
    this.resume();
  }
  /** Thao tác thành công (chỉ gọi sau khi server đã xác nhận) */
  success(msg: string, action?: ToastAction): void { this.show(msg, { kind: 'success', action }); }
  error(msg: string): void { this.show(msg, { kind: 'error' }); }

  pause(): void { clearTimeout(this.timer); }
  resume(): void {
    clearTimeout(this.timer);
    if (this.visible()) this.timer = setTimeout(() => this.visible.set(false), this.duration);
  }
  dismiss(): void { clearTimeout(this.timer); this.visible.set(false); }
  runAction(): void { const a = this.action(); this.dismiss(); a?.run(); }
}
