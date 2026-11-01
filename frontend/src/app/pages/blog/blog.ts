import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Post { slug: string; tag: string; date: string; title: string; excerpt: string; img: string; body: string[]; shop: { label: string; link: string; q?: Record<string, string> }; }

const POSTS: Post[] = [
  {
    slug: 'bao-quan-rau-cu', tag: 'Mẹo hay', date: '15/06/2026', img: '/img/quay-rau.jpg',
    title: 'Bảo quản rau củ tươi lâu hơn, không cần chật tủ lạnh',
    excerpt: 'Nhiều loại củ để nhiệt độ phòng đúng cách vẫn ngon cả tuần. Rau lá thì ngược lại, cần ẩm vừa đủ và thoáng.',
    body: [
      'Khoai tây, hành tây, tỏi, bí đỏ để nơi khô, tối và thoáng. Đừng để khoai tây cạnh hành tây vì hành làm khoai mọc mầm nhanh.',
      'Rau ăn lá như rau muống, cải: nhặt bỏ lá úa, quấn khăn giấy hơi ẩm rồi cho vào túi có lỗ thoáng, để ngăn mát. Chỉ rửa ngay trước khi nấu.',
      'Cà chua chưa chín để ngoài cho chín tự nhiên; chín rồi mới cho vào tủ lạnh và ăn trong 2–3 ngày.',
      'Rau thơm cắm gốc vào ly nước như cắm hoa, trùm túi nilon lỏng, giữ được 4–5 ngày.'
    ],
    shop: { label: 'Xem quầy rau củ', link: '/san-pham', q: { c: 'vegetables' } }
  },
  {
    slug: 'trai-cay-theo-mua', tag: 'Mùa vụ', date: '10/06/2026', img: '/img/quay-trai-cay.jpg',
    title: 'Trái cây theo mùa: ăn đúng mùa vừa ngon vừa rẻ',
    excerpt: 'Đầu hè là mùa măng cụt, vải thiều, sầu riêng. Trái đúng mùa ít phải trữ lâu, ngọt hơn và giá mềm hơn.',
    body: [
      'Măng cụt chọn trái vỏ tím sẫm, cuống còn xanh, bóp nhẹ thấy hơi mềm. Trái cứng như gỗ là để lâu, múi dễ bị trong.',
      'Dưa hấu gõ nghe tiếng đanh, mặt dưới có vệt vàng là chín. Cuống khô và hơi quăn là dấu hiệu tốt.',
      'Cam sành vỏ hơi sần, cầm nặng tay là nhiều nước. Đừng chọn trái quá to vì thường vỏ dày.',
      'Mua vừa đủ ăn trong 3–4 ngày, trái cây đúng mùa luôn có hàng mới mỗi sáng.'
    ],
    shop: { label: 'Xem quầy trái cây', link: '/san-pham', q: { c: 'fruits' } }
  },
  {
    slug: 'chon-thit-tuoi', tag: 'Nấu ăn', date: '05/06/2026', img: '/img/bep.jpg',
    title: 'Năm dấu hiệu nhận biết thịt tươi',
    excerpt: 'Màu, độ đàn hồi, mùi, mặt cắt và mỡ: chỉ cần nhìn và chạm là biết miếng thịt có tươi hay không.',
    body: [
      'Màu: thịt heo tươi hồng nhạt, thịt bò đỏ tươi. Thịt sẫm hoặc tái xanh là đã để lâu.',
      'Độ đàn hồi: ấn ngón tay, vết lõm phải trở lại ngay. Thịt nhão, rỉ nước là không nên mua.',
      'Mùi: thơm nhẹ đặc trưng, không có mùi chua hay hắc.',
      'Mặt cắt khô ráo, hơi bóng. Mỡ trắng ngà, chắc, không vàng hay nhớt.',
      'Về nhà chia phần vừa nấu một bữa rồi cấp đông, lúc dùng rã đông trong ngăn mát.'
    ],
    shop: { label: 'Xem quầy thịt', link: '/san-pham', q: { c: 'meat' } }
  }
];

@Component({
  selector: 'fm-blog',
  imports: [RouterLink],
  encapsulation: ViewEncapsulation.None,
  styles: `
    .posts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 40px 20px; }
    .post-card { display: flex; flex-direction: column; gap: 12px; }
    .post-card img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--r); transition: transform .6s var(--ease); }
    .post-card .im { overflow: hidden; border-radius: var(--r); }
    .post-card:hover img { transform: scale(1.04); }
    .post-card .h3 { font-size: 24px; }
    .article { max-width: 720px; }
    .article img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--r); margin: 8px 0 36px; }
    .article p { font-size: 18px; line-height: 1.7; margin-bottom: 18px; }
    @media (max-width: 900px) { .posts { grid-template-columns: 1fr; } }
  `,
  template: `
    @if (post(); as p) {
      <section class="page-head band">
        <nav class="crumbs" aria-label="Đường dẫn"><a routerLink="/blog">Blog ẩm thực</a><span aria-hidden="true">/</span><span>{{ p.tag }}</span></nav>
        <h1 class="h2" style="max-width:820px">{{ p.title }}</h1>
        <p class="muted">{{ p.tag }} · {{ p.date }}</p>
      </section>
      <article class="band"><div class="article">
        <img [src]="p.img" alt="">
        @for (para of p.body; track $index) { <p>{{ para }}</p> }
        <a class="btn btn-forest" [routerLink]="p.shop.link" [queryParams]="p.shop.q">{{ p.shop.label }}</a>
      </div></article>
    } @else {
      <section class="page-head band">
        <h1 class="h2">Blog ẩm thực</h1>
        <p>Cách chọn, bảo quản và nấu nguyên liệu, viết ngắn để đọc trong lúc chờ nồi canh sôi.</p>
      </section>
      <section class="band posts">
        @for (p of posts; track p.slug) {
          <a class="post-card" [routerLink]="['/blog', p.slug]">
            <span class="im"><img [src]="p.img" alt="" loading="lazy"></span>
            <span class="small muted">{{ p.tag }} · {{ p.date }}</span>
            <span class="h3">{{ p.title }}</span>
            <span class="muted">{{ p.excerpt }}</span>
          </a>
        }
      </section>
    }
  `
})
export class Blog {
  readonly slug = input<string>();
  protected posts = POSTS;
  protected post = computed(() => POSTS.find(p => p.slug === this.slug()));
}
