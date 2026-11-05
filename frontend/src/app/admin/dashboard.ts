import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService, ORDER_STATUS, STATUS_FLOW } from '../core/order.service';
import { ProductService } from '../core/product.service';
import { DataService } from '../core/data.service';
import { OrderStatus } from '../core/models';
import { VndPipe } from '../shared/vnd.pipe';

@Component({
  selector: 'fm-admin-dashboard',
  imports: [DatePipe, RouterLink, VndPipe],
  template: `
    <div class="adm-head"><div><h1 class="h2">Tổng quan</h1><p>Số liệu tính từ đơn hàng hiện có. Đơn đã hủy không tính doanh thu.</p></div></div>
    <dl class="stats">
      <div class="card stat"><dt>Doanh thu 7 ngày</dt><dd class="num">{{ revenue7() | vnd }}</dd><p class="sub">Tổng từ trước tới nay {{ revenueAll() | vnd }}</p></div>
      <div class="card stat"><dt>Đơn hàng</dt><dd class="num">{{ orders.all().length }}</dd><p class="sub">{{ count('pending') }} đơn chờ xác nhận</p></div>
      <div class="card stat"><dt>Giá trị đơn trung bình</dt><dd class="num">{{ aov() | vnd }}</dd><p class="sub">{{ ps.all().length }} sản phẩm đang bán</p></div>
      <div class="card stat"><dt>Khách hàng</dt><dd class="num">{{ customers() }}</dd><p class="sub">{{ lowStock().length }} sản phẩm sắp hết hàng</p></div>
    </dl>
    <div class="grid-2">
      <section class="card" aria-labelledby="h-rev">
        <h2 class="h3" id="h-rev">Doanh thu 7 ngày gần nhất</h2>
        <div class="bars" role="img" [attr.aria-label]="'Doanh thu theo ngày: ' + chartLabel()">
          @for (d of days(); track d.key; let last = $last) {
            <div class="bar" [class.today]="last"><b class="num">{{ d.short }}</b><i [style.height.%]="d.pct"></i><span>{{ d.label }}</span></div>
          }
        </div>
      </section>
      <section class="card" aria-labelledby="h-st">
        <h2 class="h3" id="h-st">Đơn theo trạng thái</h2>
        <ul class="st-list">
          @for (s of statuses(); track s.key) {
            <li><span>{{ s.label }}</span><span class="track"><i [style.width.%]="s.pct"></i></span><b class="num">{{ s.n }}</b></li>
          }
        </ul>
        <a class="link-btn" routerLink="/admin/don-hang" style="display:inline-block;margin-top:18px">Xử lý đơn hàng</a>
      </section>
    </div>
    <div class="grid-2">
      <section class="card" aria-labelledby="h-recent">
        <h2 class="h3" id="h-recent">Đơn mới nhất</h2>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Mã đơn</th><th>Khách</th><th>Thời gian</th><th class="r">Tổng</th><th>Trạng thái</th></tr></thead>
          <tbody>
            @for (o of orders.all().slice(0, 6); track o.orderCode) {
              <tr><td class="num"><a class="link-btn" routerLink="/admin/don-hang" [queryParams]="{ q: o.orderCode }">{{ o.orderCode }}</a></td><td>{{ o.customer.name }}</td><td class="num">{{ o.createdAt | date: 'dd/MM HH:mm' }}</td><td class="r num">{{ o.total | vnd }}</td><td><span class="pill" [class.on]="o.status === 'delivered'" [class.warn]="o.status === 'pending'">{{ st[o.status] }}</span></td></tr>
            }
          </tbody>
        </table></div>
      </section>
      <section class="card" aria-labelledby="h-top">
        <h2 class="h3" id="h-top">Bán chạy theo đơn</h2>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Sản phẩm</th><th class="r">Đã bán</th><th class="r">Doanh thu</th></tr></thead>
          <tbody>
            @for (t of top(); track t.name) {
              <tr><td class="nm">{{ t.name }}</td><td class="r num">{{ t.qty }}</td><td class="r num">{{ t.rev | vnd }}</td></tr>
            }
          </tbody>
        </table></div>
      </section>
    </div>
    @if (lowStock().length) {
      <section class="card" aria-labelledby="h-low">
        <h2 class="h3" id="h-low">Sắp hết hàng</h2>
        <p class="muted" style="margin:-8px 0 14px">Còn 10 đơn vị trở xuống. Nhập thêm ở trang Tồn kho.</p>
        <div class="toolbar">
          @for (p of lowStock().slice(0, 8); track p.id) { <span class="pill warn">{{ ps.shortName(p) }} · {{ ps.qty(p.stock) }} {{ ps.unit(p) }}</span> }
        </div>
        <a class="link-btn" routerLink="/admin/ton-kho">Mở Tồn kho</a>
      </section>
    }
  `
})
export class Dashboard {
  protected orders = inject(OrderService);
  protected ps = inject(ProductService);
  private data = inject(DataService);
  protected st = ORDER_STATUS;
  private valid = computed(() => this.orders.all().filter(o => o.status !== 'cancelled'));
  protected revenueAll = computed(() => this.valid().reduce((s, o) => s + o.total, 0));
  protected aov = computed(() => (this.valid().length ? this.revenueAll() / this.valid().length : 0));
  protected customers = computed(() => this.data.users().filter(u => u.role === 'customer').length);
  protected lowStock = computed(() => this.ps.all().filter(p => p.stock <= 10).sort((a, b) => a.stock - b.stock));
  protected count(s: OrderStatus): number { return this.orders.all().filter(o => o.status === s).length; }

  protected days = computed(() => {
    const out: { key: string; label: string; value: number; short: string; pct: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const value = this.valid().filter(o => new Date(o.createdAt).toDateString() === key).reduce((s, o) => s + o.total, 0);
      out.push({ key, label: i === 0 ? 'Hôm nay' : `${d.getDate()}/${d.getMonth() + 1}`, value, short: value ? `${Math.round(value / 1000)}K` : '0', pct: 0 });
    }
    const max = Math.max(1, ...out.map(x => x.value));
    return out.map(x => ({ ...x, pct: (x.value / max) * 100 }));
  });
  protected revenue7 = computed(() => this.days().reduce((s, d) => s + d.value, 0));
  protected chartLabel = computed(() => this.days().map(d => `${d.label} ${d.short}`).join(', '));
  protected statuses = computed(() => {
    const all = this.orders.all().length || 1;
    return [...STATUS_FLOW, 'cancelled' as OrderStatus].map(k => { const n = this.count(k); return { key: k, label: ORDER_STATUS[k], n, pct: (n / all) * 100 }; });
  });
  protected top = computed(() => {
    const m = new Map<string, { name: string; qty: number; rev: number }>();
    this.valid().forEach(o => o.lines.forEach(l => {
      const cur = m.get(l.p.id) ?? { name: this.ps.shortName(l.p), qty: 0, rev: 0 };
      cur.qty += l.qty; cur.rev += l.qty * l.price; m.set(l.p.id, cur);
    }));
    return [...m.values()].sort((a, b) => b.rev - a.rev).slice(0, 6);
  });
}
