import { computed, signal } from '@angular/core';

/** Vị trí của một trang so với trang đang xem: giữa, ngay trước, ngay sau hoặc ẩn */
export type SlidePos = 'cur' | 'prev' | 'next' | 'off';

/** Băng chuyền quay vòng: giữ trang đang xem, cho đi tới/lui, nhảy tới trang bất kỳ
 *  và cho biết mỗi trang đang ở đâu. Chỉ giữ trạng thái, không biết gì về giao diện. */
export class Carousel<T> {
  readonly index = signal(0);
  readonly current = computed(() => this.items[this.index()]);

  constructor(readonly items: readonly T[]) {}

  get size(): number { return this.items.length; }

  /** Sang trang sau (+1) hoặc trang trước (-1), hết thì quay vòng */
  move(step: number): void {
    const n = this.size;
    this.index.update(i => (i + step + n) % n);
  }

  goTo(i: number): void { this.index.set(i); }

  pos(k: number): SlidePos {
    const n = this.size, d = (k - this.index() + n) % n;
    return d === 0 ? 'cur' : d === 1 ? 'next' : d === n - 1 ? 'prev' : 'off';
  }
}
