import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

/** Hiện dần phần tử khi cuộn tới. Dùng: <h2 fmReveal> hoặc <div fmReveal="2"> (độ trễ 1–3). */
@Directive({ selector: '[fmReveal]', host: { class: 'rv' } })
export class RevealDirective implements OnInit, OnDestroy {
  readonly fmReveal = input<string | number>('');
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private io?: IntersectionObserver;

  ngOnInit(): void {
    const node = this.el.nativeElement;
    const d = String(this.fmReveal());
    if (d) node.classList.add('d' + d);
    if (!('IntersectionObserver' in window)) { node.classList.add('in'); return; }
    // Bắt đầu hiện khi còn cách mép dưới màn hình gần nửa màn hình: lúc phần tử lọt vào tầm nhìn thì gần như đã hiện xong.
    // Lần báo đầu tiên (ngay khi mở trang / quay lại trang) mà phần tử đã trong màn hình: hiện luôn, không chạy hiệu ứng.
    // (Không đo getBoundingClientRect ở đây: đo lúc đang dựng trang bắt trình duyệt tính bố cục sớm, tốn ~10 ms mỗi phần tử.)
    let first = true;
    this.io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        if (first) node.classList.add('rv-now');
        node.classList.add('in'); this.io?.disconnect();
      }
      first = false;
    }, { rootMargin: '0px 0px 45% 0px' });
    this.io.observe(node);
  }
  ngOnDestroy(): void { this.io?.disconnect(); }
}
