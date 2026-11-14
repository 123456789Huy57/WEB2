import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';

@Component({
  selector: 'fm-stores',
  imports: [RouterLink],
  styleUrl: './stores.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="about-page">
      <section class="about-hero band" aria-labelledby="about-title">
        <div class="about-hero-copy">
          <h1 id="about-title" class="about-title">Tươi mỗi ngày,<br><em>ngon mỗi bữa</em></h1>
          <p class="about-lead">FreshMart là siêu thị thực phẩm ở TP.HCM: rau củ, trái cây, thịt cá, sữa trứng và đồ khô, bán ở {{ storeCount() }} cửa hàng và trên website. Đơn online được soạn ở cửa hàng gần bạn rồi giao trong ngày.</p>
          <div class="about-actions">
            <a class="btn btn-ink" routerLink="/san-pham">Đi chợ online</a>
            <a class="about-text-link" routerLink="/he-thong-cua-hang">Tìm cửa hàng gần bạn</a>
          </div>
        </div>
        <div class="about-hero-visual">
          <img class="about-hero-img" src="/img/quay-trai-cay.jpg" alt="Quầy rau củ và trái cây trong một cửa hàng FreshMart" width="1400" height="933" fetchpriority="high">
          <div class="about-sticker" aria-hidden="true"><strong>Fresh</strong><span>Cho bữa cơm<br>nhà mình</span></div>
          <div class="about-hero-caption">Top 1 fresh picks</div>
        </div>
      </section>

      <!-- Thông tin khách cần trước khi đặt, đặt ngay dưới phần mở đầu thay vì nằm cuối trang -->
      <section class="about-facts band" aria-label="Mua hàng ở FreshMart">
        <a class="about-fact" routerLink="/he-thong-cua-hang"><strong class="about-fact-num num">{{ storeCount() }}</strong><span>cửa hàng ở TP.HCM, mở {{ hours() }} mỗi ngày</span></a>
        <div class="about-fact"><strong class="about-fact-num num">1–2 giờ</strong><span>giao nội thành cho đơn đặt trước 16:00</span></div>
        <div class="about-fact"><strong class="about-fact-num num">300.000 đ</strong><span>trở lên được miễn phí giao</span></div>
        <div class="about-fact"><strong class="about-fact-num num">24 giờ</strong><span>để báo đổi trả hàng tươi không đúng mô tả</span></div>
      </section>

      <section class="about-intro band" aria-labelledby="about-story">
        <div class="about-intro-grid">
          <h2 id="about-story" class="about-heading">Đi chợ tốt hơn, bữa cơm vui hơn</h2>
          <div class="about-intro-copy">
            <p>FreshMart bắt đầu từ câu hỏi quen thuộc của mọi nhà: <strong>hôm nay ăn gì?</strong> Vì vậy ngoài việc bán thực phẩm, website giúp bạn đi từ câu hỏi đó tới giỏ hàng: chọn món, xem cần những gì, rồi mua đúng phần còn thiếu.</p>
            <p>Bạn có thể đi chợ theo quầy như ở cửa hàng, hoặc mở Meal Planner, chọn nguyên liệu đang có trong bếp và để FreshMart gợi ý món nấu được.</p>
          </div>
        </div>
        <div class="about-photo-grid">
          <figure class="about-photo about-photo-large">
            <img src="/img/quay-rau.jpg" alt="Kệ rau củ tươi xếp theo từng loại trong cửa hàng FreshMart" width="1400" height="933" loading="lazy">
            <figcaption><span>01</span> Chọn nguyên liệu tươi</figcaption>
          </figure>
          <figure class="about-photo about-photo-small">
            <img src="/img/bep.jpg" alt="Hai người chuẩn bị nấu ăn trong căn bếp gia đình" width="900" height="600" loading="lazy">
            <figcaption><span>02</span> Cùng chuẩn bị bữa ngon</figcaption>
          </figure>
        </div>
      </section>

      <!-- Hành trình đơn hàng: tiêu đề cột trái, ba bước bậc thang đi xuống từ trái sang phải -->
      <section class="about-journey band" aria-labelledby="about-journey-title">
        <div class="about-journey-head">
          <h2 id="about-journey-title" class="about-heading">Từ nguồn hàng<br><em>đến bàn ăn</em></h2>
          <p class="about-section-desc">Một hành trình đơn giản, được thiết kế để bạn dễ dàng chọn mua và chuẩn bị bữa ăn mỗi ngày.</p>
          <a class="about-journey-link" routerLink="/san-pham">Bắt đầu chọn hàng</a>
        </div>
        <ol class="about-journey-grid">
          <li class="about-journey-card">
            <div class="about-journey-image"><img src="/img/quay-rau.jpg" alt="Các loại rau củ được trưng bày tại quầy" width="1400" height="933" loading="lazy"><span class="num">01</span></div>
            <p class="about-card-kicker">Tại quầy</p><h3>Chọn thực phẩm</h3><p>Khám phá các quầy rau củ, trái cây, thịt cá, sữa trứng và thực phẩm khô.</p>
          </li>
          <li class="about-journey-card">
            <div class="about-journey-image"><img src="/img/thu-ngan.jpg" alt="Quầy thu ngân trong cửa hàng FreshMart" width="1400" height="715" loading="lazy"><span class="num">02</span></div>
            <p class="about-card-kicker">Ở cửa hàng gần bạn</p><h3>Soạn đơn cẩn thận</h3><p>Đơn hàng được chuẩn bị tại cửa hàng; thông tin sản phẩm và số lượng được thể hiện rõ ràng.</p>
          </li>
          <li class="about-journey-card">
            <div class="about-journey-image"><img src="/img/giao-hang.jpg" alt="Nhân viên FreshMart trao túi thực phẩm cho khách" width="1400" height="933" loading="lazy"><span class="num">03</span></div>
            <p class="about-card-kicker">Trong 1–2 giờ</p><h3>Giao đến tận nhà</h3><p>Chọn khung giờ giao phù hợp khi thanh toán và theo dõi đơn bằng mã đơn hàng.</p>
          </li>
        </ol>
      </section>

      <section class="about-meal band" aria-labelledby="about-meal-title">
        <div class="about-meal-copy">
          <p class="about-kicker"><span></span> MORE THAN GROCERY</p>
          <h2 id="about-meal-title" class="about-heading">Bạn có nguyên liệu,<br><em>FreshMart có ý tưởng</em></h2>
          <p>Chưa biết nấu gì với những thứ đang có trong bếp? Meal Planner giúp bạn chọn nguyên liệu, thiết lập sở thích và khám phá những món ăn phù hợp — kèm danh sách nguyên liệu còn thiếu để mua ngay.</p>
          <a class="btn btn-forest" routerLink="/meal-planner">Khám phá Meal Planner</a>
        </div>
        <div class="about-meal-visual">
          <img src="/img/bep.jpg" alt="Cùng nhau chuẩn bị món ăn trong căn bếp gia đình" width="900" height="600" loading="lazy">
          <div class="about-meal-tag">PLAN A MEAL.<br>MAKE IT FRESH.</div>
        </div>
      </section>

      <section class="about-community band" aria-labelledby="about-community-title">
        <div class="about-community-copy">
          <p class="about-kicker about-kicker-light"><span></span> COOK, SHARE, CONNECT</p>
          <h2 id="about-community-title" class="about-heading about-heading-light">Bếp chung,<br><em>nấu cùng nhau</em></h2>
          <p>Mỗi bữa ăn đều có một câu chuyện. Chia sẻ món ngon, trao đổi mẹo bếp và cùng nhau tham gia thử thách nấu ăn mỗi tuần trong Cộng đồng FreshMart.</p>
          <ul class="about-community-topics" aria-label="Hoạt động trong Cộng đồng FreshMart">
            <li><span aria-hidden="true">01</span> Chia sẻ công thức</li>
            <li><span aria-hidden="true">02</span> Hỏi đáp chuyện bếp</li>
            <li><span aria-hidden="true">03</span> Thử thách mỗi tuần</li>
          </ul>
          <a class="btn btn-paper" routerLink="/cong-dong">Khám phá Cộng đồng</a>
        </div>
        <div class="about-community-visual">
          <img src="/img/cong-dong-bep.jpg" width="636" height="497" alt="Mọi người cùng chuẩn bị và chia sẻ món ăn trong một buổi nấu ăn cộng đồng" loading="lazy">
          <span class="about-community-stamp">BẾP VUI<br>NHÀ MÌNH</span>
          <p>Ý tưởng món ngon bắt đầu từ những điều mình cùng chia sẻ.</p>
        </div>
      </section>

      <section class="about-faq band" id="faq" aria-labelledby="about-faq-title">
        <div class="about-faq-heading">
          <h2 id="about-faq-title" class="about-heading">Câu hỏi thường gặp</h2>
          <p>Chưa thấy câu bạn cần? Gọi cửa hàng gần nhất, số điện thoại có ở trang <a routerLink="/he-thong-cua-hang">Hệ thống cửa hàng</a>.</p>
        </div>
        <div class="about-faq-list">
          @for (faq of faqs; track faq.q; let i = $index) {
            <details class="about-faq-item" [attr.open]="i === 0 ? '' : null">
              <summary><span>{{ faq.q }}</span><span class="about-faq-toggle" aria-hidden="true"></span></summary>
              <div class="about-faq-answer"><p>{{ faq.a }}</p>@if (faq.link) { <a [routerLink]="faq.link.path">{{ faq.link.label }}</a> }</div>
            </details>
          }
        </div>
      </section>

      <!-- Kết trang: một lời mời duy nhất, giữ túi FreshMart làm hình ảnh thương hiệu -->
      <section class="about-bottom band">
        <div class="about-bottom-image"><img src="/img/cut/tui-freshmart.webp" alt="Túi giấy FreshMart đựng rau củ và trái cây" width="800" height="1007" loading="lazy"></div>
        <div class="about-bottom-copy">
          <h2 class="about-heading">Bữa cơm nhà<br><em>bắt đầu từ đây</em></h2>
          <p>Chọn nguyên liệu cho hôm nay, đặt trước 16:00 để nhận trong 1–2 giờ.</p>
          <a class="btn btn-ink" routerLink="/san-pham">Đi chợ ngay</a>
        </div>
      </section>
    </div>
`
})
export class Stores {
  protected data = inject(DataService);
  /** Số cửa hàng và giờ mở cửa lấy từ /api/stores, có giá trị dự phòng khi dữ liệu chưa tải xong */
  protected storeCount = computed(() => this.data.stores().length || 12);
  protected hours = computed(() => this.data.stores()[0]?.hours.replace(/\s/g, '') ?? '7:00–22:00');
  protected faqs = [
    { q: 'FreshMart giao hàng trong bao lâu?', a: 'Đơn nội thành TP.HCM đặt trước 16:00 dự kiến được giao trong 1–2 giờ. Nếu đặt sau 16:00, bạn có thể chọn khung giao vào sáng hôm sau khi thanh toán.', link: { path: '/thong-tin/giao-hang', label: 'Chính sách giao hàng' } },
    { q: 'Phí giao hàng được tính như thế nào?', a: 'Đơn hàng từ 300.000 đ được miễn phí giao. Với đơn thấp hơn, phí giao được tính theo khoảng cách; hệ thống đang tạm tính 20.000 đ khi đặt hàng.', link: { path: '/thong-tin/giao-hang', label: 'Chi tiết phí giao' } },
    { q: 'Tôi có cần tạo tài khoản để đặt hàng không?', a: 'Không. Bạn có thể đặt hàng với tư cách khách và dùng mã đơn cùng số điện thoại để tra cứu trạng thái sau đó.', link: { path: '/tra-cuu-don', label: 'Tra cứu đơn hàng' } },
    { q: 'Làm sao để biết sản phẩm có nguồn gốc rõ ràng?', a: 'Thông tin xuất xứ được ghi trên trang chi tiết sản phẩm khi nhà cung cấp có dữ liệu. Nếu sản phẩm chưa ghi, bạn có thể hỏi cửa hàng qua số điện thoại ở trang Hệ thống cửa hàng.', link: { path: '/he-thong-cua-hang', label: 'Hệ thống cửa hàng' } },
    { q: 'Nếu sản phẩm nhận được không đúng mô tả thì sao?', a: 'Bạn có thể yêu cầu đổi hoặc hoàn tiền theo chính sách của FreshMart. Với hàng tươi sống, vui lòng phản hồi trong vòng 24 giờ kể từ khi nhận hàng.', link: { path: '/thong-tin/doi-tra', label: 'Chính sách đổi trả' } },
    { q: 'Meal Planner hoạt động như thế nào?', a: 'Chọn nguyên liệu bạn đang có, thiết lập khẩu vị và các tiêu chí món ăn. Meal Planner sẽ gợi ý công thức, hiển thị nguyên liệu còn thiếu và giúp bạn thêm chúng vào giỏ hàng.', link: { path: '/meal-planner', label: 'Thử Meal Planner' } }
  ];
}
