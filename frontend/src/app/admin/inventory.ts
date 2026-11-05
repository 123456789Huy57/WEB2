import { Component, computed, inject, signal } from '@angular/core';
import { DataService } from '../core/data.service';
import { ProductService } from '../core/product.service';
import { ToastService } from '../core/toast.service';
import { Product } from '../core/models';
import { norm } from '../core/storage';
import { ImgFallbackDirective } from '../shared/img-fallback.directive';

@Component({
  selector: 'fm-admin-inventory',
  imports: [ImgFallbackDirective],
  template: `
    <div class="adm-head"><div><h1 class="h2">Tồn kho</h1><p>Sắp theo số lượng còn lại. Đặt hàng tự trừ kho, hủy đơn tự cộng lại.</p></div></div>
    <dl class="stats">
      <div class="card stat"><dt>Hết hàng</dt><dd class="num">{{ out() }}</dd></div>
      <div class="card stat"><dt>Sắp hết (≤ 10)</dt><dd class="num">{{ low() }}</dd></div>
      <div class="card stat"><dt>Đủ hàng</dt><dd class="num">{{ ok() }}</dd></div>
      <div class="card stat"><dt>Tổng mặt hàng</dt><dd class="num">{{ ps.all().length }}</dd></div>
    </dl>
    <div class="toolbar">
      <input class="adm-input" type="search" placeholder="Tìm sản phẩm" [value]="q()" (input)="q.set($any($event.target).value)" aria-label="Tìm sản phẩm">
      <label class="check"><input type="checkbox" [checked]="onlyLow()" (change)="onlyLow.set($any($event.target).checked)"> Chỉ hiện hàng sắp hết</label>
    </div>
    <div class="card"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th></th><th>Sản phẩm</th><th>Quầy</th><th class="r">Còn</th><th>Nhập thêm</th><th>Điều chỉnh (+/−)</th></tr></thead>
      <tbody>
        @for (p of list(); track p.id) {
          <tr>
            <td><div class="thumb"><img [fmImg]="p.name" [src]="ps.img(p)" alt=""></div></td>
            <td class="nm">{{ ps.shortName(p) }}</td>
            <td>{{ ps.catName(p.category) }}</td>
            <td class="r num" [class.low]="p.stock <= 10">{{ ps.qty(p.stock) }} {{ ps.unit(p) }}</td>
            <td style="white-space:nowrap">
              @for (n of [10, 50]; track n) { <button class="btn btn-stone btn-sm" type="button" style="margin-right:6px" (click)="add(p, n)">+{{ n }}</button> }
            </td>
            <td>
              <form style="display:flex;gap:6px" (submit)="$event.preventDefault(); setTo(p, $any(inp).value)">
                <input #inp class="adm-input" type="number" step="0.5" style="width:96px;height:38px" value="0" [attr.aria-label]="'Số lượng điều chỉnh của ' + ps.shortName(p)">
                <button class="btn btn-forest btn-sm" type="submit">Điều chỉnh</button>
              </form>
            </td>
          </tr>
        } @empty { <tr><td colspan="6" class="empty-row">Không có sản phẩm nào khớp.</td></tr> }
      </tbody>
    </table></div></div>
  `
})
export class AdminInventory {
  protected ps = inject(ProductService);
  private data = inject(DataService);
  private toast = inject(ToastService);
  protected q = signal('');
  protected onlyLow = signal(false);
  protected out = computed(() => this.ps.all().filter(p => p.stock <= 0).length);
  protected low = computed(() => this.ps.all().filter(p => p.stock > 0 && p.stock <= 10).length);
  protected ok = computed(() => this.ps.all().filter(p => p.stock > 10).length);
  protected list = computed(() => {
    const k = norm(this.q());
    return this.ps.all().filter(p => (!k || norm(p.name).includes(k)) && (!this.onlyLow() || p.stock <= 10)).sort((a, b) => a.stock - b.stock).slice(0, 60);
  });
  protected async add(p: Product, amount: number): Promise<void> {
    try { await this.data.adjustStock(p.id, amount, 'Nhập thêm hàng'); this.toast.show('Đã cập nhật tồn kho.'); }
    catch (error: any) { this.toast.show(error?.error?.error?.message || 'Không cập nhật được tồn kho.'); }
  }
  protected async setTo(p: Product, value: string): Promise<void> {
    const delta = Number(value);
    if (!Number.isFinite(delta) || delta === 0) { this.toast.show('Nhập số lượng điều chỉnh khác 0.'); return; }
    try { await this.data.adjustStock(p.id, delta, 'Điều chỉnh tồn kho'); this.toast.show('Đã cập nhật tồn kho.'); }
    catch (error: any) { this.toast.show(error?.error?.error?.message || 'Không cập nhật được tồn kho.'); }
  }
}
