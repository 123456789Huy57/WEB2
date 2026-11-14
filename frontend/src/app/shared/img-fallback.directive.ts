import { DestroyRef, Directive, ElementRef, NgZone, inject, input } from '@angular/core';

/**
 * Ảnh ngoài (CDN) lỗi thì ẩn ảnh, khung chứa hiện chữ cái đầu của tên trên nền đá
 * thay vì biểu tượng ảnh vỡ. Dùng: <img [fmImg]="tên sản phẩm" [src]="...">
 */
@Directive({ selector: 'img[fmImg]' })
export class ImgFallbackDirective {
  readonly fmImg = input<string>('');
  private el = inject<ElementRef<HTMLImageElement>>(ElementRef);

  constructor() {
    // Ảnh sản phẩm/món ăn mặc định tải khi sắp cuộn tới và giải mã không chặn luồng chính.
    // Ảnh nằm ngay màn hình đầu (ảnh chính trang sản phẩm) ghi loading="eager" trong template.
    const img = this.el.nativeElement;
    if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
    // Ảnh hiện dần khi tải xong thay vì bật ra từng mảng.
    img.classList.add('img-wait', 'img-in');
    // load/error chỉ đổi class trên chính ảnh, không cần Angular vẽ lại: nghe NGOÀI vùng theo dõi của Angular,
    // nếu không mỗi ảnh tải xong (hàng chục ảnh khi cuộn danh sách) bắt Angular kiểm tra lại toàn trang → giật.
    const onLoad = () => this.loaded();
    const onError = () => this.failed();
    inject(NgZone).runOutsideAngular(() => { img.addEventListener('load', onLoad); img.addEventListener('error', onError); });
    inject(DestroyRef).onDestroy(() => { img.removeEventListener('load', onLoad); img.removeEventListener('error', onError); });
  }

  private failed(): void {
    const img = this.el.nativeElement;
    img.classList.add('img-missing');
    img.classList.remove('img-wait');
    const box = img.parentElement;
    const name = (this.fmImg() || img.alt || '').trim();
    if (box && name) { box.classList.add('ph-missing'); box.dataset['initial'] = name.charAt(0).toUpperCase(); }
  }
  private loaded(): void {
    const img = this.el.nativeElement;
    img.classList.remove('img-missing', 'img-wait');
    img.parentElement?.classList.remove('ph-missing');
  }
}
