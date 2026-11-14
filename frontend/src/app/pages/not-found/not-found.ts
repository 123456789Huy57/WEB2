import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'fm-not-found',
  imports: [RouterLink],
  template: `
    <section class="band empty" style="padding-block:120px">
      <h1 class="h2">Trang này không có trên kệ</h1>
      <p class="muted">Đường dẫn có thể đã đổi. Bạn quay lại trang chủ hoặc tìm sản phẩm ở ô tìm kiếm phía trên.</p>
      <a class="btn btn-forest" routerLink="/">Về trang chủ</a>
    </section>
  `
})
export class NotFound {}
