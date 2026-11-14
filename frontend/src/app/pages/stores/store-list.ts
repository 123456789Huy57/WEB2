import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { DataService } from '../../core/data.service';
import { norm } from '../../core/storage';

/** Danh sách cửa hàng FreshMart ở TP.HCM, tìm theo quận hoặc tên đường.
 *  Khôi phục từ trang /cua-hang cũ (trước khi trang đó đổi thành "Về FreshMart"). */
@Component({
  selector: 'fm-store-list',
  styleUrl: './store-list.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="st-hero band">
      <div class="st-hero-in">
        <div>
          <h1 class="h2">{{ data.stores().length || 12 }} cửa hàng ở TP.HCM</h1>
          <p class="lead">Mở cửa 7:00 – 22:00 mỗi ngày. Đơn online được soạn ở cửa hàng gần bạn nhất nên rau vẫn còn hơi lạnh khi tới tay.</p>
        </div>
        <img src="/img/quay-rau.jpg" alt="Kệ rau củ trong cửa hàng FreshMart" width="1400" height="933">
      </div>
    </section>
    <section class="band st-list" aria-labelledby="h-list">
      <div class="sec-head">
        <h2 class="h3" id="h-list">Tìm cửa hàng</h2>
        <div class="st-search"><label class="sr" for="st-q">Tìm theo quận hoặc tên đường</label><input id="st-q" type="search" placeholder="Nhập quận hoặc tên đường" (input)="q.set($any($event.target).value)"></div>
      </div>
      <ul class="stores">
        @for (s of list(); track s.id) {
          <li>
            <span class="small muted">{{ s.district }}</span>
            <h3 class="h3">{{ s.street }}</h3>
            <p class="a">{{ s.address }}, {{ s.district }}, TP.HCM</p>
            <div class="row">
              <span class="open" [class.closed]="!open">{{ open ? 'Đang mở cửa · đến 22:00' : 'Đã đóng cửa · mở lại 7:00' }}</span>
              <a class="link num" [href]="'tel:' + s.tel">{{ s.phone }}</a>
            </div>
          </li>
        } @empty {
          @if (data.stores().length) {
            <li class="empty"><p class="h3">Chưa có cửa hàng ở khu vực này.</p><p class="muted">Đơn online vẫn giao toàn TP.HCM trong 1–2 giờ.</p></li>
          } @else {
            <li class="empty"><p class="muted">Đang tải danh sách cửa hàng…</p></li>
          }
        }
      </ul>
    </section>
  `
})
export class StoreList {
  protected data = inject(DataService);
  protected q = signal('');
  protected open = (() => { const h = new Date().getHours(); return h >= 7 && h < 22; })();
  protected list = computed(() => {
    const k = norm(this.q().trim());
    return this.data.stores()
      .filter(s => !k || norm(s.name + ' ' + s.address).includes(k))
      .map(s => { const [district, street] = s.name.split(' - '); return { ...s, district, street: street ?? s.name, tel: s.phone.replace(/\s/g, '') }; });
  });
}
