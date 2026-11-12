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
    this.io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { node.classList.add('in'); this.io?.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px' });
    this.io.observe(node);
  }
  ngOnDestroy(): void { this.io?.disconnect(); }
}
