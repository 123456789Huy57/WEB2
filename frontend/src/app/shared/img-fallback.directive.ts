import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';

/**
 * Ảnh ngoài (CDN) lỗi thì ẩn ảnh, khung chứa hiện chữ cái đầu của tên trên nền đá
 * thay vì biểu tượng ảnh vỡ. Dùng: <img [fmImg]="tên sản phẩm" [src]="...">
 */
@Directive({ selector: 'img[fmImg]' })
export class ImgFallbackDirective {
  readonly fmImg = input<string>('');
  private el = inject<ElementRef<HTMLImageElement>>(ElementRef);

  @HostListener('error') onError(): void {
    const img = this.el.nativeElement;
    img.classList.add('img-missing');
    const box = img.parentElement;
    const name = (this.fmImg() || img.alt || '').trim();
    if (box && name) { box.classList.add('ph-missing'); box.dataset['initial'] = name.charAt(0).toUpperCase(); }
  }
  @HostListener('load') onLoad(): void {
    const img = this.el.nativeElement;
    img.classList.remove('img-missing');
    img.parentElement?.classList.remove('ph-missing');
  }
}
