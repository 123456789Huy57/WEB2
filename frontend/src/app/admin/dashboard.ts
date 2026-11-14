import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DatePipe, DecimalPipe } from '@angular/common';
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

interface Rule { from: string; to: string; fromName: string; toName: string; count: number; support: number; confidence: number; lift: number; }
interface RulesData {
  computedAt: string;
  orders: { transactions: number; totalRules: number; rules: Rule[] };
  recipes: { transactions: number; totalRules: number; rules: Rule[] };
}

/** Số liệu do server tính bằng aggregation trên toàn bộ đơn (GET /api/admin/dashboard). */
@Component({
  selector: 'fm-admin-dashboard',
  imports: [DatePipe, DecimalPipe, RouterLink, VndPipe],
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
    @if (rules(); as r) {
      <section class="card" aria-labelledby="h-rules">
        <div class="rules-head">
          <div>
            <h2 class="h3" id="h-rules">Thường được mua cùng</h2>
            <p class="muted">Cặp món hay đi chung, dùng cho gợi ý ở trang sản phẩm.</p>
          </div>
          <div class="rules-src" role="group" aria-label="Nguồn luật">
            <button class="tab" type="button" [attr.aria-pressed]="ruleSource() === 'orders'" (click)="ruleSource.set('orders')">Từ đơn hàng <span class="num">{{ r.orders.totalRules }}</span></button>
            <button class="tab" type="button" [attr.aria-pressed]="ruleSource() === 'recipes'" (click)="ruleSource.set('recipes')">Từ công thức <span class="num">{{ r.recipes.totalRules }}</span></button>
          </div>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Khi mua</th><th>Thường mua thêm</th><th class="r">Số lần</th><th class="r">Support</th><th class="r">Confidence</th><th class="r">Lift</th></tr></thead>
          <tbody>
            @for (x of shownRules(); track x.from + x.to) {
              <tr><td>{{ x.fromName }}</td><td>{{ x.toName }}</td><td class="r num">{{ x.count }}</td><td class="r num">{{ x.support * 100 | number: '1.0-1' }}%</td><td class="r num">{{ x.confidence * 100 | number: '1.0-0' }}%</td><td class="r num">{{ x.lift | number: '1.1-2' }}</td></tr>
            } @empty {
              <tr><td colspan="6" class="empty-row">{{ ruleSource() === 'orders' ? 'Chưa đủ đơn để rút ra luật (cần mỗi cặp xuất hiện ít nhất 2 lần). Gợi ý đang dùng luật từ công thức.' : 'Chưa có luật.' }}</td></tr>
            }
          </tbody>
        </table></div>
        <p class="rules-foot">
          <span>Học từ {{ ruleSource() === 'orders' ? r.orders.transactions + ' đơn chưa hủy' : r.recipes.transactions + ' công thức' }}, cập nhật {{ r.computedAt | date: 'HH:mm dd/MM' }}.</span>
          <span><b>Confidence</b>: trong số người mua món đầu, bao nhiêu % mua thêm món sau.</span>
          <span><b>Lift</b> trên 1: hai món đi cùng nhau nhiều hơn ngẫu nhiên.</span>
        </p>
      </section>
    }
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
  protected rules = signal<RulesData | null>(null);
  protected ruleSource = signal<'orders' | 'recipes'>('orders');
  protected shownRules = computed(() => (this.rules()?.[this.ruleSource()].rules ?? []).slice(0, 10));
  constructor() {
    void firstValueFrom(this.http.get<DashboardData>('/api/admin/dashboard')).then(x => this.d.set(x)).catch(() => this.d.set(null));
    void firstValueFrom(this.http.get<RulesData>('/api/admin/recommendations')).then(x => {
      this.rules.set(x);
      if (!x.orders.rules.length) this.ruleSource.set('recipes');
    }).catch(() => this.rules.set(null));
  }

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
