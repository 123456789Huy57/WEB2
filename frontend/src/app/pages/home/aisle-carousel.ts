import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Carousel } from '../../shared/carousel';
import { RevealDirective } from '../../shared/reveal.directive';

/** Một quầy trong khu "Đi chợ theo quầy" */
export class Aisle {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly text: string,
    /** Tên ảnh đã tách nền trong public/img/cut/bang-gia */
    private readonly cut: string,
    /** Màu nền banner, chỉ dùng màu trong bảng màu */
    readonly bg: string,
    /** Nền tối thì chữ kem */
    readonly dark = false,
    /** Tỉ lệ ảnh so với khung (ảnh nào trông to quá thì cho nhỏ hơn 1) */
    readonly fit = 1
  ) {}

  get img(): string { return `/img/cut/bang-gia/${this.cut}.webp`; }
}

/** Màu banner lặp theo nhịp vàng, xanh đậm, chanh, xanh lá: cùng bốn mảng màu lớn của trang chủ */
const AISLES = [
  new Aisle('vegetables', 'Rau, củ', 'Rau ăn lá, củ quả chọn mỗi sáng, đóng gói gọn để về nhà nấu ngay.', 'rau-cu', 'var(--yellow)'),
  new Aisle('fruits', 'Trái cây', 'Trái cây theo mùa, bán theo ký hoặc theo trái, chọn trái vừa chín tới.', 'trai-cay', 'var(--forest)', true),
  new Aisle('meat', 'Thịt', 'Thịt heo, bò, gà đóng khay, ghi rõ khối lượng trên từng sản phẩm.', 'thit', 'var(--lime)', false, .82),
  new Aisle('seafood', 'Hải sản', 'Cá, tôm, mực làm sạch, cắt khúc sẵn, đóng túi giữ lạnh khi giao.', 'hai-san', 'var(--green)'),
  new Aisle('dairy-eggs', 'Sữa, trứng', 'Trứng gà, trứng vịt và các loại sữa cho bữa sáng của cả nhà.', 'sua-trung', 'var(--yellow)'),
  new Aisle('rice-grains', 'Gạo, ngũ cốc', 'Gạo thơm, gạo lứt và ngũ cốc đóng túi, đủ dùng cho cả tháng.', 'gao-ngu-coc', 'var(--forest)', true),
  new Aisle('noodles', 'Mì, bún, phở', 'Mì, miến, bún, phở khô nấu nhanh cho những ngày bận rộn.', 'mi-goi', 'var(--lime)'),
  new Aisle('condiments', 'Gia vị, nước sốt', 'Gói gia vị nấu sẵn, nước sốt ướp và xốt trộn cho căn bếp nhà bạn.', 'gia-vi', 'var(--green)')
];

/** Đi chợ theo quầy: tiêu đề ở trên, bên dưới là banner kiểu bìa tạp chí của quầy đang xem
 *  (tên quầy khổng lồ phía sau, ảnh sản phẩm đè lên, quầy trước và sau mờ ở hai mép).
 *  Đổi quầy bằng mũi tên, vuốt ngang hoặc phím ← →.
 *  Bấm vào ảnh, tên hay mô tả quầy là vào trang quầy đó. */
@Component({
  selector: 'fm-aisle-carousel',
  imports: [RouterLink, RevealDirective],
  templateUrl: './aisle-carousel.html',
  styleUrl: './aisle-carousel.css'
})
export class AisleCarousel {
  protected c = new Carousel(AISLES);
  private startX = 0;
  /** Vừa vuốt xong: chặn cú click đi kèm để không mở quầy ngoài ý muốn */
  private swiped = false;

  /** Vuốt ngang trên banner: kéo sang trái quá 50px là quầy sau, sang phải là quầy trước */
  protected swipeStart(e: PointerEvent): void { this.startX = e.clientX; this.swiped = false; }
  protected swipeEnd(e: PointerEvent): void {
    const dx = e.clientX - this.startX;
    this.swiped = Math.abs(dx) > 50;
    if (this.swiped) this.c.move(dx < 0 ? 1 : -1);
  }
  /** Click vào ảnh hoặc chữ ngay sau cú vuốt thì không mở quầy */
  protected guard(e: MouseEvent): void { if (this.swiped) e.preventDefault(); }
}
