import { Component, DestroyRef, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/product.service';
import { CartService } from '../../core/cart.service';
import { VoucherService } from '../../core/voucher.service';
import { ToastService } from '../../core/toast.service';
import { DataService } from '../../core/data.service';
import { Product } from '../../core/models';
import { VndPipe } from '../../shared/vnd.pipe';
import { AddControl } from '../../shared/add-control';
import { ProductCard } from '../../shared/product-card';
import { VoucherList } from '../../shared/voucher-list';
import { RevealDirective } from '../../shared/reveal.directive';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';

type GroupKey = 'rau-cu' | 'trai-cay' | 'thit-ca';
/** Bảng giá sáng nay: mỗi quầy chọn vài mặt hàng, kèm tên gọn và ghi chú cân/quy cách */
const BOARD: Record<GroupKey, [string, string, string][]> = {
  'rau-cu': [['p-0004', 'Rau muống nước', 'Gói 400 g'], ['p-0020', 'Bí đỏ hồ lô', 'Trái nhỏ, ruột vàng'], ['p-0013', 'Bắp Mỹ', 'Trái từ 300 g'], ['p-0015', 'Khoai tây', 'Củ từ 130 g']],
  'trai-cay': [['p-0021', 'Măng cụt', 'Trái từ 65 g'], ['p-0025', 'Dưa hấu đỏ', 'Cắt nửa nếu bạn ghi chú'], ['p-0023', 'Cam sành', 'Trái từ 130 g'], ['p-0026', 'Chuối già Nam Mỹ', 'Trái 120–220 g']],
  'thit-ca': [['p-0053', 'Cá basa cắt khúc', 'Khay cắt khúc, làm sạch'], ['p-0042', 'Ba rọi heo C.P', 'Khay 1 kg, nạc mỡ xen kẽ'], ['p-0071', 'Trứng gà ta', 'Hộp 6 quả, 180–210 g']]
};
const AISLES: [string, string, string?][] = [
  ['vegetables', 'rau-muong', 'Rau, củ'], ['fruits', 'cam-sanh'], ['meat', 'ba-roi'], ['seafood', 'ca-basa'],
  ['dairy-eggs', 'trung-ga', 'Sữa, trứng'], ['rice-grains', 'gao', 'Gạo, ngũ cốc'], ['noodles', 'mien', 'Mì, bún, phở'], ['condiments', 'dau-an', 'Gia vị, nước sốt']
];

@Component({
  selector: 'fm-home',
  imports: [RouterLink, VndPipe, AddControl, ProductCard, VoucherList, RevealDirective, ImgFallbackDirective],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  protected ps = inject(ProductService);
  private cart = inject(CartService);
  private vs = inject(VoucherService);
  private toast = inject(ToastService);
  private data = inject(DataService);

  protected groups: { key: GroupKey; label: string }[] = [{ key: 'rau-cu', label: 'Rau, củ' }, { key: 'trai-cay', label: 'Trái cây' }, { key: 'thit-ca', label: 'Thịt, cá, trứng' }];
  protected group = signal<GroupKey>('rau-cu');
  protected board = computed(() => BOARD[this.group()].map(([id, name, note]) => ({ p: this.ps.get(id)!, name, note })).filter(r => r.p));
  protected aisles = computed(() => AISLES.map(([id, img, name]) => {
    const c = this.ps.category(id);
    return { id, img, name: name ?? this.ps.catName(c), count: c?.productCount ?? 0 };
  }));
  protected picks = computed(() => [
    { p: this.ps.get('p-0021')!, title: 'Măng cụt', text: 'Chọn trái vỏ tím sẫm, cuống còn xanh. Bóp nhẹ thấy vỏ hơi mềm là trái chín, múi trắng và ngọt. Để nơi thoáng mát, ăn trong 2–3 ngày.' },
    { p: this.ps.get('p-0025')!, title: 'Dưa hấu đỏ', text: 'Gõ nghe tiếng đanh, cuống khô và mặt dưới có vệt vàng là trái chín. Ghi chú khi đặt nếu muốn cắt nửa. Sau khi cắt, bọc kín và để ngăn mát.' }
  ].filter(x => x.p));
  protected deals = computed(() => ['p-0042', 'p-0025', 'p-0020', 'p-0004'].map(id => this.ps.get(id)).filter((p): p is Product => !!p));
  protected homeVouchers = computed(() => ['WELCOME10', 'FREESHIP', 'SAVE30K', 'PROTEIN20'].map(c => this.vs.find(c)).filter(v => !!v).map(v => v!));
  /** Nguyên liệu trong thẻ ví dụ Meal Planner */
  protected have = 'ing-rau-muong,ing-trung-ga-ta,ing-ca-chua';
  protected recipeCount = computed(() => this.data.recipes().length);

  protected today = (() => {
    const d = new Date(), days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return `${days[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
  })();
  protected clock = signal('');

  constructor() {
    const end = new Date(); end.setHours(23, 59, 59, 0);
    const two = (n: number) => String(n).padStart(2, '0');
    const tick = () => { const s = Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000)); this.clock.set(`${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`); };
    tick();
    const t = setInterval(tick, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  protected addOne(p: Product): void {
    this.cart.add(p.id, 1);
    this.toast.show(`Đã thêm ${this.ps.shortName(p)} vào giỏ`);
  }
}
