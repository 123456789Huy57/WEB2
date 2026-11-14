import { Component, computed, input } from '@angular/core';

export type BannerTone = 'yellow' | 'forest' | 'lime' | 'green';
const TONES: Record<BannerTone, { bg: string; dark: boolean }> = {
  yellow: { bg: 'var(--yellow)', dark: false },
  forest: { bg: 'var(--forest)', dark: true },
  lime: { bg: 'var(--lime)', dark: false },
  green: { bg: 'var(--green)', dark: false }
};

/** Banner đầu trang cho các trang nội dung, cùng kiểu banner quầy ở trang Sản phẩm và khu "Đi chợ theo quầy" ở trang chủ:
 *  mảng màu bo góc, tên trang chữ khổng lồ (cỡ chữ tự co theo độ dài), nội dung phụ chèn vào giữa,
 *  hình minh họa đặt ở góc phải qua <ng-content select="[art]">.
 *  Dùng: <fm-page-banner title="Ưu đãi tuần này" tone="yellow" [art]="true"> <p>…</p> <div art>…</div> </fm-page-banner> */
@Component({
  selector: 'fm-page-banner',
  host: { class: 'band pg-top' },
  template: `
    <div class="pg-banner" [class.dark]="look().dark" [class.has-art]="art()" [style.--bn-bg]="look().bg">
      <ng-content select="nav" />
      <h1 class="pg-title">
        @if (small()) { <span class="pg-small">{{ small() }}</span> }
        <span class="pg-big" [style.--len]="title().length">{{ title() }}</span>
      </h1>
      <ng-content />
      @if (art()) { <div class="pg-art" aria-hidden="true"><ng-content select="[art]" /></div> }
    </div>
  `
})
export class PageBanner {
  readonly title = input.required<string>();
  /** Dòng nhỏ phía trên tên trang (như tiêu đề hai dòng .duo-h) */
  readonly small = input<string>('');
  readonly tone = input<BannerTone>('yellow');
  /** Có hình minh họa ở góc phải hay không (khi có, phần chữ chỉ chiếm 60% bề ngang) */
  readonly art = input(false);
  protected look = computed(() => TONES[this.tone()]);
}
