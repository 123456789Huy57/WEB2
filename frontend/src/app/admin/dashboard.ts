import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService, ORDER_STATUS, STATUS_FLOW } from '../core/order.service';
import { ProductService } from '../core/product.service';
import { OrderStatus, Product } from '../core/models';
import { VndPipe } from '../shared/vnd.pipe';

interface DashboardData {
  revenue: number; collected: number; orders: number; averageOrderValue: number;
  statusCounts: Partial<Record<OrderStatus, number>>;
  last7Days: { date: string; revenue: number; orders: number }[];
  topProducts: { productId: string; name: string; unit: string; qty: number; revenue: number }[];
  customers: number; activeProducts: number; lowStock: { id: string; name: string; unit: string; stock: number }[];
}

/** Số liệu do server tính bằng aggregation trên toàn bộ đơn (GET /api/admin/dashboard). */
@Component({
  selector: 'fm-admin-dashboard',
  imports: [DatePipe, RouterLink, VndPipe],
  template: `
    <div class="adm-head"><div><h1 class="h2">Tổng quan</h1><p>Tính trên toàn bộ đơn hàng. Đơn đã hủy không tính doanh thu; đã thu {{ (d()?.collected ?? 0) | vnd }} từ đơn đã thanh toán.</p></div></div>
    <dl class="stats">
      <div class="card stat"><dt>Doanh thu 7 ngày</dt><dd class="num">{{ revenue7() | vnd }}</dd><p class="sub">Tổng từ trước tới nay {{ revenueAll() | vnd }}</p></div>
      <div class="card stat"><dt>Đơn hàng</dt><dd class="num">{{ totalOrders() }}</dd><p class="sub">{{ count('pending') }} đơn chờ xác nhận</p></div>
      <div class="card stat"><dt>Giá trị đơn trung bình</dt><dd class="num">{{ aov() | vnd }}</dd><p class="sub">{{ d()?.activeProducts ?? ps.all().length }} sản phẩm đang bán</p></div>
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
  private http = inject(HttpClient);
  protected st = ORDER_STATUS;
  protected d = signal<DashboardData | null>(null);
  constructor() { void firstValueFrom(this.http.get<DashboardData>('/api/admin/dashboard')).then(x => this.d.set(x)).catch(() => this.d.set(null)); }

  protected revenueAll = computed(() => this.d()?.revenue ?? 0);
  protected aov = computed(() => this.d()?.averageOrderValue ?? 0);
  protected customers = computed(() => this.d()?.customers ?? 0);
  protected totalOrders = computed(() => Object.values(this.d()?.statusCounts ?? {}).reduce((a, b) => a + (b ?? 0), 0));
  /** Ưu tiên sản phẩm đã tải (có ảnh, tên ngắn); không có thì dùng dữ liệu server trả */
  protected lowStock = computed(() => (this.d()?.lowStock ?? []).map(x => this.ps.get(x.id) ?? ({ ...x, slug: '', category: '', categoryName: '', description: '', price: 0, sale_price: 0, sold_count: 0, image_url: '', gallery: [] } as Product)));
  protected count(s: OrderStatus): number { return this.d()?.statusCounts[s] ?? 0; }

  protected days = computed(() => {
    const list = this.d()?.last7Days ?? [];
    const max = Math.max(1, ...list.map(x => x.revenue));
    return list.map((x, i) => {
      const [, m, day] = x.date.split('-').map(Number);
      return { key: x.date, label: i === list.length - 1 ? 'Hôm nay' : `${day}/${m}`, value: x.revenue, short: x.revenue ? `${Math.round(x.revenue / 1000)}K` : '0', pct: (x.revenue / max) * 100 };
    });
  });
  protected revenue7 = computed(() => this.days().reduce((s, d) => s + d.value, 0));
  protected chartLabel = computed(() => this.days().map(d => `${d.label} ${d.short}`).join(', '));
  protected statuses = computed(() => {
    const all = this.totalOrders() || 1;
    return [...STATUS_FLOW, 'cancelled' as OrderStatus].map(k => { const n = this.count(k); return { key: k, label: ORDER_STATUS[k], n, pct: (n / all) * 100 }; });
  });
  protected top = computed(() => (this.d()?.topProducts ?? []).slice(0, 6).map(t => {
    const p = this.ps.get(t.productId);
    return { name: p ? this.ps.shortName(p) : t.name, qty: p ? this.ps.qtyLabel(p, t.qty) : String(t.qty), rev: t.revenue };
  }));
}
