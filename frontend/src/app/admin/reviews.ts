import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../core/auth.service';
import { ToastService } from '../core/toast.service';

interface AdminReview { id: string; productId: string; productName?: string; userName: string; rating: number; comment: string; createdAt: string; hidden: boolean; }

/** Kiểm duyệt đánh giá: ẩn đánh giá vi phạm (không xóa, để còn đối chiếu), hiện lại khi cần. */
@Component({
  selector: 'fm-admin-reviews',
  imports: [DatePipe, RouterLink],
  template: `
    <div class="adm-head"><div><h1 class="h2">Đánh giá</h1><p>Chỉ khách đã nhận hàng mới đánh giá được. Đánh giá bị ẩn không tính vào điểm sản phẩm.</p></div></div>
    <div class="toolbar">
      <input class="adm-input" type="search" placeholder="Tìm nội dung, tên khách, mã sản phẩm" [value]="q()" (input)="q.set($any($event.target).value)" (keyup.enter)="load()" aria-label="Tìm đánh giá">
      <select class="adm-input" [value]="filter()" (change)="filter.set($any($event.target).value); load()" aria-label="Lọc">
        <option value="">Tất cả</option><option value="low">1–2 sao</option><option value="hidden">Đã ẩn</option>
      </select>
      <button class="btn btn-stone btn-sm" type="button" (click)="load()">Tìm</button>
    </div>
    <div class="card"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Sản phẩm</th><th>Khách</th><th class="r">Sao</th><th>Nhận xét</th><th>Ngày</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>
        @for (r of items(); track r.id) {
          <tr [class.dim]="r.hidden">
            <td class="nm"><a class="link-btn" [routerLink]="['/san-pham', r.productId]" fragment="h-rv">{{ r.productName || r.productId }}</a></td>
            <td>{{ r.userName }}</td>
            <td class="r num">{{ r.rating }} ★</td>
            <td style="max-width:360px">{{ r.comment || '—' }}</td>
            <td class="num small">{{ r.createdAt | date: 'dd/MM/yyyy' }}</td>
            <td><span class="pill" [class.on]="!r.hidden">{{ r.hidden ? 'Đã ẩn' : 'Đang hiện' }}</span></td>
            <td class="r"><button class="link-btn" type="button" (click)="toggle(r)">{{ r.hidden ? 'Hiện lại' : 'Ẩn' }}</button></td>
          </tr>
        } @empty { <tr><td colspan="7" class="empty-row">Chưa có đánh giá nào khớp.</td></tr> }
      </tbody>
    </table></div></div>
  `
})
export class AdminReviews {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  protected items = signal<AdminReview[]>([]);
  protected q = signal('');
  protected filter = signal<'' | 'low' | 'hidden'>('');
  constructor() { void this.load(); }
  protected async load(): Promise<void> {
    const params: string[] = ['pageSize=100'];
    if (this.q().trim()) params.push(`q=${encodeURIComponent(this.q().trim())}`);
    if (this.filter() === 'hidden') params.push('hidden=true');
    try {
      const r = await firstValueFrom(this.http.get<{ items: AdminReview[] }>(`/api/admin/reviews?${params.join('&')}`));
      this.items.set(this.filter() === 'low' ? r.items.filter(x => x.rating <= 2) : r.items);
    } catch (error) { this.toast.show(apiMessage(error)); }
  }
  protected async toggle(r: AdminReview): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`/api/admin/reviews/${r.id}`, { hidden: !r.hidden }));
      this.items.update(list => list.map(x => x.id === r.id ? { ...x, hidden: !r.hidden } : x));
      this.toast.show(r.hidden ? 'Đã hiện lại đánh giá' : 'Đã ẩn đánh giá');
    } catch (error) { this.toast.show(apiMessage(error)); }
  }
}
