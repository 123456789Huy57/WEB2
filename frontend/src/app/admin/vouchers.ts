import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataService } from '../core/data.service';
import { VoucherService } from '../core/voucher.service';
import { OrderService } from '../core/order.service';
import { ToastService } from '../core/toast.service';
import { Voucher } from '../core/models';
import { VndPipe } from '../shared/vnd.pipe';

@Component({
  selector: 'fm-admin-vouchers',
  imports: [ReactiveFormsModule, VndPipe],
  template: `
    <div class="adm-head">
      <div><h1 class="h2">Voucher</h1><p>Mã tắt thì khách không áp dụng được nữa, kể cả mã đã lưu.</p></div>
      <button class="btn btn-forest" type="button" (click)="edit(null)">Tạo mã mới</button>
    </div>
    <div class="card"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Mã</th><th>Nội dung</th><th class="r">Mức giảm</th><th class="r">Đơn tối thiểu</th><th>Hiệu lực</th><th class="r">Đã dùng</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>
        @for (v of list(); track v.code) {
          <tr [class.dim]="!v.isActive">
            <td><b>{{ v.code }}</b></td>
            <td>{{ v.title }}<br><span class="small muted">{{ v.category === 'shipping' ? 'Giảm phí giao' : 'Giảm tiền hàng' }}{{ vs.isFirstOrderOnly(v) ? ' · chỉ đơn đầu tiên' : '' }}</span></td>
            <td class="r num">{{ v.discountType === 'percent' ? v.discountValue + '%' : (v.discountValue | vnd) }}@if (v.maxDiscountValue) { <br><span class="small muted">tối đa {{ v.maxDiscountValue | vnd }}</span> }</td>
            <td class="r num">{{ v.minOrderValue | vnd }}</td>
            <td class="num small">{{ fmt(v.startDate) }} – {{ fmt(v.endDate) }}</td>
            <td class="r num">{{ used(v.code) }}</td>
            <td><span class="pill" [class.on]="v.isActive">{{ v.isActive ? 'Đang chạy' : 'Đã tắt' }}</span></td>
            <td class="r" style="white-space:nowrap"><button class="link-btn" type="button" (click)="edit(v)">Sửa</button><button class="link-btn" type="button" style="margin-left:12px" (click)="toggle(v)">{{ v.isActive ? 'Tắt' : 'Bật' }}</button></td>
          </tr>
        }
      </tbody>
    </table></div></div>

    <dialog class="adm-dlg" #dlg aria-labelledby="vf-title">
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <h2 class="h3" id="vf-title">{{ editing() ? 'Sửa mã ' + editing()!.code : 'Tạo mã mới' }}</h2>
        <div class="form-grid">
          <div class="field"><label for="vf-code">Mã</label><input id="vf-code" formControlName="code" style="text-transform:uppercase">@if (codeErr()) { <span class="err">{{ codeErr() }}</span> }</div>
          <div class="field"><label for="vf-cat">Loại</label><select id="vf-cat" formControlName="category"><option value="product">Giảm tiền hàng</option><option value="shipping">Giảm phí giao</option></select></div>
          <div class="field full"><label for="vf-title">Tên hiển thị</label><input id="vf-title" formControlName="title" placeholder="Giảm 10% đơn đầu"></div>
          <div class="field"><label for="vf-type">Kiểu giảm</label><select id="vf-type" formControlName="discountType"><option value="percent">Phần trăm</option><option value="fixed">Số tiền</option></select></div>
          <div class="field"><label for="vf-val">Mức giảm ({{ form.controls.discountType.value === 'percent' ? '%' : 'đ' }})</label><input id="vf-val" type="number" min="1" formControlName="discountValue"></div>
          <div class="field"><label for="vf-min">Đơn tối thiểu (đ)</label><input id="vf-min" type="number" min="0" step="1000" formControlName="minOrderValue"></div>
          <div class="field"><label for="vf-max">Giảm tối đa (đ, 0 = không giới hạn)</label><input id="vf-max" type="number" min="0" step="1000" formControlName="maxDiscountValue"></div>
          <div class="field"><label for="vf-start">Từ ngày</label><input id="vf-start" type="date" formControlName="startDate"></div>
          <div class="field"><label for="vf-end">Đến ngày</label><input id="vf-end" type="date" formControlName="endDate"></div>
          <label class="check full"><input type="checkbox" formControlName="isActive"> Đang chạy</label>
        </div>
        @if (tried() && formErr()) { <p class="err small">{{ formErr() }}</p> }
        <div class="acts"><button class="btn btn-stone" type="button" (click)="dlg.close()">Hủy</button><button class="btn btn-forest" type="submit">Lưu</button></div>
      </form>
    </dialog>
  `
})
export class AdminVouchers {
  private data = inject(DataService);
  protected vs = inject(VoucherService);
  private orders = inject(OrderService);
  private toast = inject(ToastService);
  protected list = this.data.vouchers;
  protected dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected editing = signal<Voucher | null>(null);
  protected tried = signal(false);
  protected form = inject(FormBuilder).nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{3,20}$/)]], title: ['', Validators.required],
    category: ['product' as Voucher['category']], discountType: ['percent' as Voucher['discountType']],
    discountValue: [10, [Validators.required, Validators.min(1)]], minOrderValue: [0, Validators.min(0)], maxDiscountValue: [0, Validators.min(0)],
    startDate: [''], endDate: [''], isActive: [true]
  });
  private usedMap = computed(() => { const m = new Map<string, number>(); this.orders.all().forEach(o => { if (o.voucherCode && o.status !== 'cancelled') m.set(o.voucherCode, (m.get(o.voucherCode) ?? 0) + 1); }); return m; });
  protected used(code: string): number { return this.usedMap().get(code) ?? 0; }
  protected fmt(d: string): string { return d ? d.split('-').reverse().join('/') : '—'; }
  protected codeErr(): string {
    const c = this.form.controls.code;
    if (!(c.touched || this.tried())) return '';
    if (c.invalid) return '3–20 chữ cái hoặc số, không dấu';
    if (!this.editing() && this.vs.find(c.value)) return 'Mã này đã tồn tại';
    return '';
  }
  protected formErr(): string {
    const v = this.form.getRawValue();
    if (!v.title.trim()) return 'Nhập tên hiển thị';
    if (v.discountType === 'percent' && v.discountValue > 100) return 'Phần trăm giảm tối đa 100';
    if (v.startDate && v.endDate && v.startDate > v.endDate) return 'Ngày kết thúc phải sau ngày bắt đầu';
    return '';
  }
  protected edit(v: Voucher | null): void {
    this.editing.set(v); this.tried.set(false);
    const today = new Date().toISOString().slice(0, 10);
    this.form.reset(v ? { code: v.code, title: v.title, category: v.category, discountType: v.discountType, discountValue: v.discountValue, minOrderValue: v.minOrderValue, maxDiscountValue: v.maxDiscountValue ?? 0, startDate: v.startDate, endDate: v.endDate, isActive: v.isActive }
      : { code: '', title: '', category: 'product', discountType: 'percent', discountValue: 10, minOrderValue: 0, maxDiscountValue: 0, startDate: today, endDate: '2026-12-31', isActive: true });
    if (v) this.form.controls.code.disable(); else this.form.controls.code.enable();
    this.dlg().nativeElement.showModal();
  }
  protected async save(): Promise<void> {
    this.tried.set(true); this.form.markAllAsTouched();
    if (this.form.invalid || this.codeErr() || this.formErr()) return;
    const f = this.form.getRawValue();
    const old = this.editing();
    const v: Voucher = {
      id: old?.id ?? 'v-' + Date.now().toString(36), code: f.code.trim().toUpperCase(), title: f.title.trim(), description: old?.description ?? f.title.trim(),
      category: f.category, discountType: f.discountType, discountValue: f.discountValue, minOrderValue: f.minOrderValue,
      maxDiscountValue: f.maxDiscountValue || null, startDate: f.startDate, endDate: f.endDate, isActive: f.isActive,
      audience: old?.audience ?? 'all', perUserLimit: old?.perUserLimit ?? 1, usageLimit: old?.usageLimit ?? null
    };
    try { await this.data.saveVoucher(v); }
    catch (error: any) { this.toast.show(error?.error?.error?.message || 'Không lưu được voucher.'); return; }
    this.dlg().nativeElement.close();
    this.toast.show(old ? `Đã lưu mã ${v.code}` : `Đã tạo mã ${v.code}`);
  }
  protected async toggle(v: Voucher): Promise<void> { try { await this.data.saveVoucher({ ...v, isActive: !v.isActive }); this.toast.show((v.isActive ? 'Đã tắt mã ' : 'Đã bật mã ') + v.code); } catch (error: any) { this.toast.show(error?.error?.error?.message || 'Không cập nhật được voucher.'); } }
}
