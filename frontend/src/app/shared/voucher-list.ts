import { Component, inject, input, output } from '@angular/core';
import { VoucherService } from '../core/voucher.service';
import { ToastService } from '../core/toast.service';
import { Voucher } from '../core/models';
import { vnd } from '../core/storage';

/** Danh sách mã giảm giá dạng hàng ngang (trang chủ, Ưu đãi, Tài khoản) */
@Component({
  selector: 'fm-voucher-list',
  template: `
    <ul class="vouchers">
      @for (v of list(); track v.code) {
        <li>
          <span class="v num">{{ vs.label(v) }}</span>
          <span class="c">{{ v.code }}</span>
          <span class="d">{{ desc(v) }}</span>
          @if (mode() === 'use') {
            <button class="btn btn-forest btn-sm" type="button" (click)="use.emit(v.code)">Dùng ngay</button>
          } @else {
            <button class="btn btn-forest btn-sm" type="button" [attr.aria-pressed]="vs.isSaved(v.code)" (click)="toggle(v.code)">
              {{ vs.isSaved(v.code) ? 'Đã lưu' : 'Lưu mã' }}
            </button>
          }
        </li>
      }
    </ul>
  `
})
export class VoucherList {
  readonly list = input.required<Voucher[]>();
  readonly mode = input<'save' | 'use'>('save');
  readonly use = output<string>();
  protected vs = inject(VoucherService);
  private toast = inject(ToastService);

  desc(v: Voucher): string {
    return `${v.title}, đơn từ ${vnd(v.minOrderValue)}` + (v.maxDiscountValue ? `, tối đa ${vnd(v.maxDiscountValue)}` : '') + ` · hạn ${v.endDate.split('-').reverse().join('/')}`;
  }
  toggle(code: string): void { if (this.vs.toggleSave(code)) this.toast.show(`Đã lưu mã ${code}`); }
}
