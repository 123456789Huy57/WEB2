import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DataService } from '../core/data.service';
import { OrderService } from '../core/order.service';
import { norm } from '../core/storage';
import { VndPipe } from '../shared/vnd.pipe';

@Component({
  selector: 'fm-admin-customers',
  imports: [DatePipe, VndPipe],
  template: `
    <div class="adm-head"><div><h1 class="h2">Khách hàng</h1><p>Tài khoản đã đăng ký và chi tiêu từ các đơn không bị hủy.</p></div></div>
    <div class="toolbar"><input class="adm-input" type="search" placeholder="Tìm tên, email, số điện thoại" [value]="q()" (input)="q.set($any($event.target).value)" aria-label="Tìm khách hàng"></div>
    <div class="card"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Ngày tham gia</th><th class="r">Số đơn</th><th class="r">Đã chi</th><th>Vai trò</th></tr></thead>
      <tbody>
        @for (u of list(); track u.id) {
          <tr><td class="nm">{{ u.fullName }}</td><td>{{ u.email }}<br><span class="small muted num">{{ u.phone }}</span></td><td class="num">{{ u.createdAt ? (u.createdAt | date: 'dd/MM/yyyy') : '—' }}</td><td class="r num">{{ u.orders }}</td><td class="r num">{{ u.spent | vnd }}</td><td><span class="pill" [class.on]="u.role === 'admin'">{{ u.role === 'admin' ? 'Quản trị' : 'Khách' }}</span></td></tr>
        } @empty { <tr><td colspan="6" class="empty-row">Không tìm thấy khách hàng.</td></tr> }
      </tbody>
    </table></div></div>
  `
})
export class AdminCustomers {
  private data = inject(DataService);
  private orders = inject(OrderService);
  protected q = signal('');
  protected list = computed(() => {
    const k = norm(this.q());
    return this.data.users()
      .filter(u => !k || norm(`${u.fullName} ${u.email} ${u.phone}`).includes(k))
      .map(u => { const os = this.orders.all().filter(o => o.userId === u.id && o.status !== 'cancelled'); return { ...u, orders: os.length, spent: os.reduce((s, o) => s + o.total, 0) }; })
      .sort((a, b) => b.spent - a.spent);
  });
}
