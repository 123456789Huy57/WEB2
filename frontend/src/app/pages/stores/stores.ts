import { Component, ViewEncapsulation, inject } from '@angular/core';
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
          <p class="about-kicker"><span></span> TỪ CHỢ SÁNG ĐẾN BỮA CƠM NHÀ</p>
          <h1 id="about-title" class="about-title">TƯƠI MỖI NGÀY.<br><em>NGON MỖI BỮA.</em></h1>
          <p class="about-lead">FreshMart mang thực phẩm tươi và những lựa chọn dễ dàng hơn đến căn bếp của bạn — để chuyện đi chợ mỗi ngày trở nên nhẹ nhàng hơn.</p>
          <div class="about-actions">
            <a class="btn btn-ink" routerLink="/san-pham">Khám phá thực phẩm <span aria-hidden="true">↗</span></a>
            <a class="about-text-link" routerLink="/meal-planner">Thử Meal Planner <span aria-hidden="true">→</span></a>
          </div>
          <div class="about-hero-note"><span class="about-note-mark">FM</span><span>FRESH FOOD, EVERYDAY GOOD.</span></div>
        </div>
        <div class="about-hero-visual">
          <img class="about-hero-img" src="/img/quay-trai-cay.jpg" alt="Không gian quầy thực phẩm FreshMart với rau củ và trái cây tươi" fetchpriority="high">
          <div class="about-sticker"><strong>FRESH</strong><span>CHO BỮA CƠM<br>NHÀ MÌNH</span></div>
          <div class="about-hero-caption"><span>01 / FRESH PICKS</span><span>Chọn điều tươi ngon</span></div>
        </div>
      </section>

      <section class="about-intro band" aria-labelledby="about-story">
        <div class="about-intro-label"><span>OUR STORY</span><span>02 — 05</span></div>
        <div class="about-intro-grid">
          <h2 id="about-story" class="about-heading">ĐI CHỢ TỐT HƠN,<br><em>BỮA CƠM VUI HƠN.</em></h2>
          <div class="about-intro-copy">
            <p>FreshMart bắt đầu từ một câu hỏi quen thuộc: <strong>Hôm nay nhà mình ăn gì?</strong> Từ câu hỏi ấy, tụi mình xây dựng một khu chợ thực phẩm online, nơi bạn có thể tìm nguyên liệu cho bữa cơm, khám phá món mới và đặt mua những thứ còn thiếu trong căn bếp.</p>
            <p>Không chỉ là nơi chọn sản phẩm, FreshMart muốn việc chuẩn bị bữa ăn trở nên rõ ràng, tiện lợi và có thêm cảm hứng mỗi ngày.</p>
            <a class="about-underlink" routerLink="/meal-planner">Khám phá cách FreshMart lên ý tưởng bữa ăn <span>↗</span></a>
          </div>
        </div>
        <div class="about-photo-grid">
          <figure class="about-photo about-photo-large">
            <img src="/img/quay-rau.jpg" alt="Quầy rau củ với nhiều loại rau xanh và nông sản tươi" loading="lazy">
            <figcaption><span>01</span> Chọn nguyên liệu tươi</figcaption>
          </figure>
          <figure class="about-photo about-photo-small">
            <img src="/img/bep.jpg" alt="Hai người chuẩn bị nấu ăn trong căn bếp gia đình" loading="lazy">
            <figcaption><span>02</span> Cùng chuẩn bị bữa ngon</figcaption>
          </figure>
        </div>
      </section>

      <section class="about-promise" aria-labelledby="about-promise-title">
        <div class="about-promise-inner band">
          <div class="about-promise-head">
            <p class="about-kicker about-kicker-light"><span></span> THE FRESHMART PROMISE</p>
            <h2 id="about-promise-title" class="about-heading about-heading-light">TƯƠI TRONG TỪNG<br><em>LỰA CHỌN.</em></h2>
            <p>Từ lúc chọn hàng đến khi đơn được giao đi, trải nghiệm mua sắm cần rõ ràng và dễ tin cậy.</p>
          </div>
          <div class="about-values">
            <article class="about-value">
              <span class="about-value-no">01</span>
              <div><h3>Chọn lọc mỗi ngày</h3><p>Ưu tiên rau củ, trái cây và thực phẩm có nguồn gốc rõ ràng từ nhà cung cấp, nông trại và hợp tác xã.</p></div>
              <span class="about-value-icon" aria-hidden="true">✳</span>
            </article>
            <article class="about-value">
              <span class="about-value-no">02</span>
              <div><h3>Thông tin minh bạch</h3><p>Giá niêm yết rõ ràng; sản phẩm cân ký được tính theo khối lượng thực tế khi soạn đơn.</p></div>
              <span class="about-value-icon" aria-hidden="true">＋</span>
            </article>
            <article class="about-value">
              <span class="about-value-no">03</span>
              <div><h3>Tiện lợi cho bữa nhà</h3><p>Tìm món, chọn nguyên liệu và đặt mua trong cùng một trải nghiệm — kể cả khi bạn chưa biết nấu món gì.</p></div>
              <span class="about-value-icon" aria-hidden="true">↗</span>
            </article>
          </div>
        </div>
      </section>

      <section class="about-journey band" aria-labelledby="about-journey-title">
        <div class="about-section-top">
          <div><p class="about-kicker"><span></span> FROM SOURCE TO TABLE</p><h2 id="about-journey-title" class="about-heading">TỪ NGUỒN HÀNG<br><em>ĐẾN BÀN ĂN.</em></h2></div>
          <p class="about-section-desc">Một hành trình đơn giản, được thiết kế để bạn dễ dàng chọn mua và chuẩn bị bữa ăn mỗi ngày.</p>
        </div>
        <div class="about-journey-grid">
          <article class="about-journey-card">
            <div class="about-journey-image"><img src="/img/quay-rau.jpg" alt="Các loại rau củ được trưng bày tại quầy" loading="lazy"><span>01</span></div>
            <p class="about-card-kicker">SELECT</p><h3>Chọn thực phẩm</h3><p>Khám phá các quầy rau củ, trái cây, thịt cá, sữa trứng và thực phẩm khô.</p>
          </article>
          <article class="about-journey-card">
            <div class="about-journey-image"><img src="/img/thu-ngan.jpg" alt="Không gian bên trong cửa hàng FreshMart" loading="lazy"><span>02</span></div>
            <p class="about-card-kicker">PREPARE</p><h3>Soạn đơn cẩn thận</h3><p>Đơn hàng được chuẩn bị tại cửa hàng; thông tin sản phẩm và số lượng được thể hiện rõ ràng.</p>
          </article>
          <article class="about-journey-card">
            <div class="about-journey-image"><img src="/img/giao-hang.jpg" alt="Nhân viên giao hàng FreshMart trao túi thực phẩm cho khách" loading="lazy"><span>03</span></div>
            <p class="about-card-kicker">DELIVER</p><h3>Giao đến tận nhà</h3><p>Chọn khung giờ giao phù hợp khi thanh toán và theo dõi đơn bằng mã đơn hàng.</p>
          </article>
        </div>
      </section>

      <section class="about-meal band" aria-labelledby="about-meal-title">
        <div class="about-meal-copy">
          <p class="about-kicker"><span></span> MORE THAN GROCERY</p>
          <h2 id="about-meal-title" class="about-heading">BẠN CÓ NGUYÊN LIỆU.<br><em>FRESHMART CÓ Ý TƯỞNG.</em></h2>
          <p>Chưa biết nấu gì với những thứ đang có trong bếp? Meal Planner giúp bạn chọn nguyên liệu, thiết lập sở thích và khám phá những món ăn phù hợp — kèm danh sách nguyên liệu còn thiếu để mua ngay.</p>
          <a class="btn btn-forest" routerLink="/meal-planner">Khám phá Meal Planner <span aria-hidden="true">↗</span></a>
        </div>
        <div class="about-meal-visual">
          <img src="/img/bep.jpg" alt="Cùng nhau chuẩn bị món ăn trong căn bếp gia đình" loading="lazy">
          <div class="about-meal-tag">PLAN A MEAL.<br>MAKE IT FRESH.</div>
        </div>
      </section>

      <section class="about-community band" aria-labelledby="about-community-title">
        <div class="about-community-copy">
          <p class="about-kicker about-kicker-light"><span></span> COOK, SHARE, CONNECT</p>
          <h2 id="about-community-title" class="about-heading about-heading-light">BẾP CHUNG,<br><em>NẤU CÙNG NHAU.</em></h2>
          <p>Mỗi bữa ăn đều có một câu chuyện. Chia sẻ món ngon, trao đổi mẹo bếp và cùng nhau tham gia thử thách nấu ăn mỗi tuần trong Cộng đồng FreshMart.</p>
          <ul class="about-community-topics" aria-label="Hoạt động trong Cộng đồng FreshMart">
            <li><span aria-hidden="true">01</span> Chia sẻ công thức</li>
            <li><span aria-hidden="true">02</span> Hỏi đáp chuyện bếp</li>
            <li><span aria-hidden="true">03</span> Thử thách mỗi tuần</li>
          </ul>
          <a class="btn btn-paper" routerLink="/cong-dong">Khám phá Cộng đồng <span aria-hidden="true">↗</span></a>
        </div>
        <div class="about-community-visual">
          <img src="/img/cookingcommunity.jpg" alt="Mọi người cùng chuẩn bị và chia sẻ món ăn trong một buổi nấu ăn cộng đồng" loading="lazy">
          <span class="about-community-stamp">BẾP VUI<br>NHÀ MÌNH</span>
          <p>Ý tưởng món ngon bắt đầu từ những điều mình cùng chia sẻ.</p>
        </div>
      </section>

      <section class="about-facts band" aria-label="FreshMart trong vài con số">
        <div><strong class="about-fact-num">{{ data.stores().length || 12 }}</strong><span>cửa hàng tại TP.HCM</span></div>
        <div><strong class="about-fact-num">1–2<span> giờ</span></strong><span>thời gian giao nội thành theo thông tin dịch vụ</span></div>
        <div><strong class="about-fact-num">07:00–22:00</strong><span>giờ hoạt động mỗi ngày</span></div>
      </section>

      <section class="about-faq band" id="faq" aria-labelledby="about-faq-title">
        <div class="about-faq-heading">
          <p class="about-kicker"><span></span> GOOD TO KNOW</p>
          <h2 id="about-faq-title" class="about-heading">BẠN MUỐN<br><em>BIẾT THÊM?</em></h2>
          <p>Một vài câu hỏi thường gặp trước khi bạn đi chợ cùng FreshMart.</p>
          <a class="about-underlink" routerLink="/thong-tin/huong-dan">Xem hướng dẫn mua hàng <span>↗</span></a>
        </div>
        <div class="about-faq-list">
          @for (faq of faqs; track faq.q; let i = $index) {
            <details class="about-faq-item" [attr.open]="i === 0 ? '' : null">
              <summary><span class="about-faq-index">0{{ i + 1 }}</span><span>{{ faq.q }}</span><span class="about-faq-toggle" aria-hidden="true">+</span></summary>
              <div class="about-faq-answer"><p>{{ faq.a }}</p>@if (faq.link) { <a [routerLink]="faq.link.path">{{ faq.link.label }} ↗</a> }</div>
            </details>
          }
        </div>
      </section>

      <section class="about-bottom band">
        <div class="about-bottom-image"><img src="/img/cut/tui-freshmart.webp" alt="Túi FreshMart đựng rau củ và trái cây tươi" loading="lazy"></div>
        <div class="about-bottom-copy">
          <p class="about-kicker"><span></span> YOUR EVERYDAY FRESH MARKET</p>
          <h2 class="about-heading">BỮA CƠM NHÀ<br><em>BẮT ĐẦU TỪ ĐÂY.</em></h2>
          <p>Chọn nguyên liệu cho hôm nay, hoặc để FreshMart gợi ý một món ngon mới.</p>
          <div class="about-actions"><a class="btn btn-ink" routerLink="/san-pham">Đi chợ ngay <span>↗</span></a><a class="about-text-link" routerLink="/meal-planner">Lên thực đơn <span>→</span></a></div>
        </div>
      </section>
    </div>
  `
})
export class Stores {
  protected data = inject(DataService);
  protected faqs = [
    { q: 'FreshMart giao hàng trong bao lâu?', a: 'Đơn nội thành TP.HCM đặt trước 16:00 dự kiến được giao trong 1–2 giờ. Nếu đặt sau 16:00, bạn có thể chọn khung giao vào sáng hôm sau khi thanh toán.', link: { path: '/thong-tin/giao-hang', label: 'Xem chính sách giao hàng' } },
    { q: 'Phí giao hàng được tính như thế nào?', a: 'Đơn hàng từ 300.000 đ được miễn phí giao. Với đơn thấp hơn, phí giao được tính theo khoảng cách; hệ thống đang tạm tính 20.000 đ khi đặt hàng.', link: { path: '/thong-tin/giao-hang', label: 'Chi tiết phí giao' } },
    { q: 'Tôi có cần tạo tài khoản để đặt hàng không?', a: 'Không. Bạn có thể đặt hàng với tư cách khách và dùng mã đơn cùng số điện thoại để tra cứu trạng thái sau đó.', link: { path: '/tra-cuu-don', label: 'Tra cứu đơn hàng' } },
    { q: 'Làm sao để biết sản phẩm có nguồn gốc rõ ràng?', a: 'FreshMart ưu tiên làm việc với nhà cung cấp, nông trại và hợp tác xã có thông tin nguồn gốc và tiêu chí chất lượng rõ ràng. Thông tin xuất xứ được thể hiện trên trang chi tiết sản phẩm khi có dữ liệu.', link: { path: '/san-pham', label: 'Khám phá sản phẩm' } },
    { q: 'Nếu sản phẩm nhận được không đúng mô tả thì sao?', a: 'Bạn có thể yêu cầu đổi hoặc hoàn tiền theo chính sách của FreshMart. Với hàng tươi sống, vui lòng phản hồi trong vòng 24 giờ kể từ khi nhận hàng.', link: { path: '/thong-tin/doi-tra', label: 'Xem chính sách đổi trả' } },
    { q: 'Meal Planner hoạt động như thế nào?', a: 'Chọn nguyên liệu bạn đang có, thiết lập khẩu vị và các tiêu chí món ăn. Meal Planner sẽ gợi ý công thức, hiển thị nguyên liệu còn thiếu và giúp bạn thêm chúng vào giỏ hàng.', link: { path: '/meal-planner', label: 'Thử Meal Planner' } }
  ];
}
