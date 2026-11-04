import { AfterViewInit, Component, DestroyRef, ElementRef, ViewEncapsulation, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/product.service';
import { DataService } from '../../core/data.service';
import { VndPipe } from '../../shared/vnd.pipe';
import { AddControl } from '../../shared/add-control';
import { RevealDirective } from '../../shared/reveal.directive';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';

type GroupKey = 'rau-cu' | 'trai-cay' | 'thit-ca';
/** Bảng giá sáng nay: mỗi quầy chọn vài mặt hàng: [mã sản phẩm, tên gọn, ghi chú cân/quy cách, ảnh đã tách nền trong public/img/cut/bang-gia] */
const BOARD: Record<GroupKey, [string, string, string, string][]> = {
  'rau-cu': [['p-0004', 'Rau muống nước', 'Gói 400 g', 'rau-muong'], ['p-0020', 'Bí đỏ hồ lô', 'Trái nhỏ, ruột vàng', 'bi-do'], ['p-0013', 'Bắp Mỹ', 'Trái từ 300 g', 'bap-my'], ['p-0015', 'Khoai tây', 'Củ từ 130 g', 'khoai-tay']],
  'trai-cay': [['p-0021', 'Măng cụt', 'Trái từ 65 g', 'mang-cut'], ['p-0025', 'Dưa hấu đỏ', 'Cắt nửa nếu bạn ghi chú', 'dua-hau'], ['p-0023', 'Cam sành', 'Trái từ 130 g', 'cam-sanh'], ['p-0026', 'Chuối già Nam Mỹ', 'Trái 120–220 g', 'chuoi']],
  'thit-ca': [['p-0053', 'Cá basa cắt khúc', 'Khay cắt khúc, làm sạch', 'ca-basa'], ['p-0042', 'Ba rọi heo C.P', 'Khay 1 kg, nạc mỡ xen kẽ', 'ba-roi'], ['p-0071', 'Trứng gà ta', 'Hộp 6 quả, 180–210 g', 'trung-ga']]
};
/** Quầy hàng ở trang chủ: [mã quầy, ảnh trong public/img, tên hiển thị].
 *  Ảnh trong img/quay/ là banner 2:1 đã in sẵn tên quầy, phủ kín ô; các ô còn lại là ảnh sản phẩm */
const AISLES: [string, string, string?][] = [
  ['vegetables', 'quay/rau-cu.webp', 'Rau, củ'], ['fruits', 'quay/trai-cay.webp'], ['meat', 'quay/thit.webp'], ['seafood', 'p/ca-basa.jpg'],
  ['dairy-eggs', 'p/trung-ga.jpg', 'Sữa, trứng'], ['rice-grains', 'p/gao.jpg', 'Gạo, ngũ cốc'], ['noodles', 'p/mien.jpg', 'Mì, bún, phở'], ['condiments', 'p/dau-an.jpg', 'Gia vị, nước sốt']
];

@Component({
  selector: 'fm-home',
  imports: [RouterLink, VndPipe, AddControl, RevealDirective, ImgFallbackDirective],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements AfterViewInit {
  protected ps = inject(ProductService);
  private data = inject(DataService);

  protected groups: { key: GroupKey; label: string }[] = [{ key: 'rau-cu', label: 'Rau, củ' }, { key: 'trai-cay', label: 'Trái cây' }, { key: 'thit-ca', label: 'Thịt, cá, trứng' }];
  protected group = signal<GroupKey>('rau-cu');
  protected board = computed(() => BOARD[this.group()].map(([id, name, note, cut]) => ({ p: this.ps.get(id)!, name, note, cut })).filter(r => r.p));
  protected aisles = computed(() => AISLES.map(([id, img, name]) => {
    const c = this.ps.category(id);
    return { id, img, name: name ?? this.ps.catName(c), banner: img.startsWith('quay/') };
  }));
  /** Nguyên liệu trong thẻ ví dụ Meal Planner */
  protected have = 'ing-rau-muong,ing-trung-ga-ta,ing-ca-chua';
  protected recipeCount = computed(() => this.data.recipes().length);
  /** Ba món mẫu ở khu Meal Planner */
  protected homeRecipes = computed(() => this.data.recipes().filter(r => ['rec-001', 'rec-002', 'rec-003'].includes(r.id)));
  /** Dải chữ chạy dưới hero */
  /** Vòng rau củ quả quanh khu cam kết: tên icon trong sprite SVG (#ic-...), 20 món chia đều 360° */
  protected ringFood = ['tomato', 'leaf', 'lime', 'carrot', 'dots', 'cucumber', 'chili', 'orange', 'corn', 'mushroom',
    'melon', 'leaf', 'eggplant', 'lime', 'tomato', 'dots', 'carrot', 'orange', 'cucumber', 'chili'];
  /** Dải chữ chạy cuối khu Bảng giá (lặp 2 lần cho đủ dài trên màn hình rộng) */
  protected boardMarquee = [...Array(2)].flatMap(() => ['Hàng canh tác an toàn', 'Giá tốt mỗi ngày', 'Giao nhanh 1–2 giờ (TP.HCM)', 'Đổi trả dễ dàng trong 7 ngày']);
  protected marquee = [
    'Rau củ tươi mỗi sáng', 'Giao 1–2 giờ nội thành', 'Sản phẩm chất lượng và đạt chuẩn', '12 cửa hàng tại TP.HCM', 'Meal Planner', 'Ưu đãi hấp dẫn'
  ];

  protected today = (() => {
    const d = new Date(), days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return `${days[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
  })();

  /** Hero trượt: 0 = trang video, 1 = trang hero vàng */
  protected slide = signal(0);
  /** Người dùng đã bấm tạm dừng video */
  protected paused = signal(false);
  /** Đang rê chuột hoặc focus trong hero: tạm hoãn tự quay lại trang video */
  protected hold = signal(false);
  private vid = viewChild<ElementRef<HTMLVideoElement>>('vid');
  /** Người dùng bật "giảm chuyển động": không tự phát video, không tự đổi trang */
  private reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private backTimer?: ReturnType<typeof setTimeout>;
  private startX = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.backTimer));
  }

  ngAfterViewInit(): void {
    if (this.reduce) this.paused.set(true);
    else this.play();
  }

  /** Chuyển tới trang i. Về trang video thì phát lại từ đầu; sang trang 2 thì dừng video và hẹn 9 giây sau quay lại */
  protected go(i: number): void {
    if (i === this.slide()) return;
    this.slide.set(i);
    clearTimeout(this.backTimer);
    const v = this.vid()?.nativeElement;
    if (i === 0) {
      if (v) v.currentTime = 0;
      if (!this.paused()) this.play();
    } else {
      v?.pause();
      if (!this.reduce) this.backTimer = setTimeout(() => this.autoBack(), 9000);
    }
  }
  private autoBack(): void {
    // Người dùng đang xem (rê chuột, focus) thì chờ thêm
    if (this.hold()) { this.backTimer = setTimeout(() => this.autoBack(), 3000); return; }
    this.go(0);
  }
  private play(): void {
    const v = this.vid()?.nativeElement;
    if (!v) return;
    v.muted = true; // trình duyệt chỉ cho tự phát video không tiếng
    v.play().catch(() => this.paused.set(true));
  }
  protected togglePlay(): void {
    const v = this.vid()?.nativeElement;
    this.paused.update(p => !p);
    if (this.paused()) v?.pause(); else this.play();
  }

  /** Vuốt ngang trên hero: kéo sang trái quá 50px thì sang trang sau, sang phải thì về trang trước */
  protected swipeStart(e: PointerEvent): void { this.startX = e.clientX; }
  protected swipeEnd(e: PointerEvent): void {
    const dx = e.clientX - this.startX;
    if (Math.abs(dx) > 50) this.go(dx < 0 ? 1 : 0);
  }

  /** Tab bảng giá: phím ← → chuyển quầy, giống tab chuẩn của trình duyệt */
  protected moveTab(step: number): void {
    const i = this.groups.findIndex(g => g.key === this.group());
    const next = this.groups[(i + step + this.groups.length) % this.groups.length];
    this.group.set(next.key);
    document.getElementById('tab-' + next.key)?.focus();
  }
}
