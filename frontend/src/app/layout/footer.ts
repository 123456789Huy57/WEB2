import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'fm-footer',
  imports: [RouterLink],
  host: { class: 'footer band' },
  template: `
    <div class="f-top">
      <div class="f-news">
        <p class="h3">Nhận ưu đãi mỗi tuần</p>
        <form (submit)="$event.preventDefault(); done.set(true)">
          <label class="sr" for="email">Email</label>
          <input id="email" type="email" placeholder="Email của bạn" required>
          <button class="btn btn-paper" type="submit">Đăng ký</button>
        </form>
        <p class="small" style="margin-top:10px" aria-live="polite">{{ done() ? 'Đã đăng ký. Ưu đãi đầu tiên gửi vào thứ Hai.' : 'Không spam. Hủy đăng ký bất cứ lúc nào.' }}</p>
      </div>
      <div class="f-cols">
      <div><h4>FreshMart</h4><ul><li><a routerLink="/cua-hang">Về FreshMart</a></li><li><a routerLink="/thong-tin/doi-ngu">Đội ngũ phát triển</a></li><li><a routerLink="/thong-tin/doi-tac">Đối tác</a></li><li><a routerLink="/blog">Blog ẩm thực</a></li><li><a routerLink="/cua-hang" fragment="faq">Câu hỏi thường gặp</a></li></ul></div>
      <div><h4>Hỗ trợ</h4><ul><li><a routerLink="/thong-tin/huong-dan">Hướng dẫn mua hàng</a></li><li><a routerLink="/tra-cuu-don">Tra cứu đơn hàng</a></li><li><a routerLink="/thong-tin/giao-hang">Chính sách giao hàng</a></li><li><a routerLink="/thong-tin/doi-tra">Đổi trả, hoàn tiền</a></li><li><a routerLink="/thong-tin/bao-mat">Bảo mật thông tin</a></li></ul></div>
      <div><h4>Liên hệ</h4><ul><li>63 Đường Số 1, P. Tân Hưng, Quận 7, TP.HCM</li><li class="num">038 369 0006</li><li>7:00 – 22:00 mỗi ngày</li></ul></div>
      </div>
    </div>
    <div class="f-bottom">
      <p class="f-mark" aria-hidden="true">FreshMart</p>
      <div class="f-base"><span>© 2026 FreshMart · Đồ án môn Phát triển web kinh doanh</span></div>
    </div>
  `
})
export class Footer { protected done = signal(false); }
