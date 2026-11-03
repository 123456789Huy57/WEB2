# Hướng dẫn frontend FreshMart

Tài liệu này giải thích frontend Angular của FreshMart sau đợt thiết kế lại giao diện "Bảng giá chợ sáng" (nhánh `fe-redesign-bold-editorial`). Mục đích là để bạn đọc hiểu, thuyết trình và tự phát triển tiếp được.

Các quyết định về màu, chữ và bố cục nằm trong `DESIGN.md`. Phần này nói về code.

---

## A. Kiến trúc tổng quan

FreshMart là một **Single Page Application (SPA)** viết bằng **Angular 20**. Bố cục thư mục:

```
src/
  styles.css        ← Hệ thiết kế dùng chung: biến màu, chữ, nút, thẻ sản phẩm…
  index.html        ← Trang HTML duy nhất; Angular gắn app vào thẻ <fm-root>
  app/
    app.ts          ← Component gốc: thanh thông báo, header, <router-outlet>, footer
    app.config.ts   ← Cấu hình: router, HttpClient, nạp dữ liệu khi mở app
    app.routes.ts   ← Danh sách trang (route)
    core/           ← Service và kiểu dữ liệu (không có giao diện)
    shared/         ← Thành phần dùng lại: thẻ sản phẩm, nút thêm giỏ, pipe, directive
    layout/         ← Header, footer
    pages/          ← Mỗi màn hình một thư mục
    admin/          ← Khu quản trị
public/
  data/*.json       ← Dữ liệu sản phẩm, công thức, voucher… (chưa có backend)
  fonts/            ← Oswald, Be Vietnam Pro (tự host, giấy phép OFL)
  img/              ← Ảnh cửa hàng và ảnh sản phẩm
```

Luồng dữ liệu:

1. Khi mở app, `DataService` đọc các file JSON bằng `HttpClient`.
2. Các service khác (`ProductService`, `CartService`…) lấy dữ liệu từ `DataService` và giữ trạng thái bằng **signal**.
3. Component gọi service để hiển thị dữ liệu và xử lý thao tác của người dùng.

Đợt thiết kế lại **không thay đổi luồng này**. Service, route, guard, form và quy tắc nghiệp vụ đều giữ nguyên.

## B. Các component quan trọng

| Component / file | Vai trò |
|---|---|
| `app.ts` | Khung chung. Ẩn header và footer khi vào `/admin`. Hiện thanh thông báo màu lá chanh |
| `layout/header.ts` | Logo, ô tìm kiếm có gợi ý, nút tài khoản, nút giỏ hàng, menu quầy. Thu gọn menu khi cuộn xuống |
| `layout/footer.ts` | Đăng ký nhận tin, liên kết, chữ FRESHMART khổ lớn |
| `pages/home/` | Trang chủ: hero, dải chữ chạy, bảng giá, quầy hàng, mẹo chọn trái cây, Meal Planner, ưu đãi, giao hàng |
| `shared/product-card.ts` | Thẻ sản phẩm, nhận dữ liệu qua `input` |
| `shared/add-control.ts` | Nút "+". Sau khi bấm thì đổi thành bộ tăng giảm số lượng |
| `shared/reveal.directive.ts` | Directive `fmReveal`: phần tử hiện dần khi cuộn tới |
| `shared/vnd.pipe.ts` | Pipe `vnd`: `37500` → `37.500 đ` |
| `core/cart.service.ts` | Giỏ hàng (signal + localStorage), phí giao, mã giảm giá |
| `core/auth.guard.ts` | Guard bảo vệ `/tai-khoan` và `/admin` |

## C. Đối chiếu tính năng với kiến thức môn học

Cột "Nguồn" cho biết khái niệm đó có ở đâu:
- **Slides:** có trong slide bài giảng (`Web2_Slides_EN`).
- **Learning:** có trong bài tập ở `Learning/LearnAngular/my-app`.
- **Mở rộng:** chưa có trong tài liệu môn học (giải thích ở mục D).

| Tính năng | Khái niệm Angular | Nguồn | Độ khó |
|---|---|---|---|
| Hiện giá, tên sản phẩm `{{ ps.price(p) \| vnd }}` | Interpolation, Pipe | Slides ch.2 · Learning | Cơ bản |
| Ảnh sản phẩm `[src]="ps.img(p)"` | Property binding | Slides ch.2 · Learning | Cơ bản |
| Tab quầy được chọn `[attr.aria-selected]` | Attribute binding | Slides ch.2 (binding) | Cơ bản |
| Ẩn bản lặp thứ hai của dải chữ chạy `[attr.aria-hidden]` (mới thêm) | Attribute binding | Slides ch.2 | Cơ bản |
| Đổi quầy trên bảng giá `(click)="group.set(g.key)"` | Event binding | Slides ch.2 · Learning | Cơ bản |
| Ô tìm kiếm `[ngModel]` / `(ngModelChange)` | Two-way binding (tách đôi) | Slides ch.2, ch.5 · Learning | Cơ bản |
| Danh sách sản phẩm, dòng bảng giá, dải chữ chạy `@for` | Control flow (vòng lặp) | Slides ch.2 · Learning (`@for` 34 lần) | Cơ bản |
| Giá cũ chỉ hiện khi có giảm giá `@if` | Control flow (điều kiện) | Slides ch.2 · Learning | Cơ bản |
| Truyền sản phẩm vào thẻ `<fm-product-card [product]="p">` | Component interaction | Slides ch.2 (2.3) | Trung bình |
| Giỏ hàng dùng chung ở header, trang giỏ, thanh toán | Service, Dependency Injection | Slides ch.3 · Learning | Trung bình |
| Đọc dữ liệu JSON | HttpClient | Slides ch.3, ch.6 · Learning | Trung bình |
| Trạng thái giỏ hàng, tab đang chọn | `signal()` | Slides ch.3 · Learning (32 lần) | Trung bình |
| Các trang, `/san-pham/:id`, `?c=fruits` | Routing, tham số route, query params | Slides ch.4 · Learning | Trung bình |
| Mỗi trang tải riêng | Lazy loading (`loadComponent`) | Slides ch.4 (4.4.2) · Learning (1 lần) | Trung bình |
| Chặn `/admin` khi chưa đăng nhập quản trị | Route guard (`CanActivateFn`) | Slides ch.4 (4.4.3) | Trung bình |
| Form thanh toán, kiểm tra số điện thoại | Reactive Forms, Validators | Slides ch.5 · Learning | Trung bình |
| Giỏ hàng còn sau khi tải lại trang | localStorage | Slides ch.8 · Learning | Trung bình |
| Directive `fmReveal`, `fmImg` | Directive tự viết | Slides ch.2 (directive) + Mở rộng | Trung bình |
| Danh sách chữ chạy tính từ dữ liệu `computed(() => …)` (mới thêm) | `computed()` | Learning (1 lần) + Mở rộng | Trung bình |
| `inject(CartService)` thay cho constructor | Hàm `inject()` | Mở rộng | Trung bình |
| `input.required<Product>()` | Signal input | Mở rộng (slides dạy `@Input`) | Trung bình |
| Badge giỏ hàng nảy lên khi thêm hàng `effect()` | `effect()` | Mở rộng | Nâng cao |
| Component không cần NgModule | Standalone component | Mở rộng (slides dùng NgModule) | Trung bình |

**Đợt thiết kế lại chủ yếu là CSS.** Về Angular, chỉ thêm ba thứ, đều ở trang chủ: một `computed()` cho dải chữ chạy, một vòng `@for` lồng nhau, và một attribute binding. Ngoài ra không có thư viện hay khái niệm Angular mới nào.

## D. Kiến thức mới (không có trong tài liệu môn học)

Phần lớn các khái niệm dưới đây **đã có sẵn trong dự án trước khi thiết kế lại**. Chúng được liệt kê để bạn biết cần đọc thêm gì.

### 1. Standalone component
- **Là gì:** component tự khai báo những gì nó dùng trong `imports: [...]`, không cần khai báo trong `NgModule`.
- **Vì sao dùng:** Angular 17 trở đi mặc định tạo standalone component; ít file hơn.
- **File:** mọi component, ví dụ `shared/product-card.ts`.
- **Cách đơn giản hơn:** dùng `NgModule` với `standalone: false` như trong bài tập Learning. Chạy giống nhau, chỉ khác chỗ khai báo.

### 2. Hàm `inject()`
- **Là gì:** lấy một service ngay ở phần khai báo thuộc tính: `private cart = inject(CartService);`
- **Vì sao dùng:** ngắn hơn, dùng được cả trong guard dạng hàm.
- **File:** hầu hết các component, `core/auth.guard.ts`.
- **Cách đơn giản hơn:** `constructor(private cart: CartService) {}`, như trong slide chương 3.

### 3. `input()` và `input.required()`
- **Là gì:** phiên bản signal của `@Input()`. Đọc giá trị bằng cách gọi hàm: `this.p()`.
- **File:** `shared/product-card.ts`, `shared/add-control.ts`.
- **Cách đơn giản hơn:** `@Input() product!: Product;`

### 4. `computed()`
- **Là gì:** một signal được tính ra từ signal khác. Signal gốc đổi thì giá trị tự tính lại.
- **Ví dụ:** `board = computed(() => BOARD[this.group()]...)`. Bấm đổi tab thì `group` đổi, nên `board` tự cập nhật.
- **File:** `pages/home/home.ts` (`board`, `aisles`, `marquee`…), `layout/header.ts`.
- **Cách đơn giản hơn:** viết một hàm thường `getBoard()` và gọi trong template. Chạy đúng nhưng hàm bị gọi lại nhiều lần hơn.

### 5. `effect()`
- **Là gì:** chạy một đoạn code mỗi khi signal bên trong nó thay đổi.
- **File:** `layout/header.ts`, làm badge giỏ hàng nảy lên khi thêm hàng.
- **Cách đơn giản hơn:** service phát sự kiện bằng `Subject`, header `subscribe` để nhận.

### 6. Kỹ thuật CSS của đợt thiết kế lại

Đây là kỹ thuật web chung, không phải Angular:

| Kỹ thuật | Dùng để | Ở đâu |
|---|---|---|
| CSS custom properties (`--yellow`, `var(--display)`) | Đổi màu hay font toàn site ở một chỗ | `styles.css` |
| `mix-blend-mode: multiply` | Nền trắng của ảnh sản phẩm hòa vào nền màu | `.ph img`, hero, quầy hàng |
| `@keyframes` | Dải chữ chạy, ảnh hero trượt vào | `styles.css`, `home.css` |
| CSS Grid với `span` | Ô quầy đầu tiên lớn gấp 4 | `.aisles` |
| `@media (prefers-reduced-motion)` | Tắt chuyển động cho người nhạy cảm với chuyển động | `styles.css` |
| `ViewEncapsulation.None` | CSS của trang chủ áp dụng được lên component con | `home.ts` |

## E. Cách chạy

```bash
cd frontend
npm install
npm run images     # 1 lần: tải ảnh sản phẩm về public/img/remote
npm start          # http://localhost:4200
```

Build bản production:

```bash
npx ng build       # kết quả ở dist/freshmart
```

Tài khoản thử có trong `frontend/README.md`.

## F. Cách tùy chỉnh

### Đổi màu
Mở `src/styles.css`, sửa trong khối `:root`. Ví dụ muốn hero màu cam, đổi `--yellow: #ffc517;` thành màu khác. Mọi chỗ dùng `var(--yellow)` sẽ đổi theo.

Lưu ý tương phản: chữ trên nút cần đạt ít nhất 4,5:1. Có thể kiểm tra tại webaim.org/resources/contrastchecker.

### Đổi font
1. Chép file `.ttf` vào `public/fonts/`.
2. Sửa khối `@font-face` ở đầu `styles.css`.
3. Đổi biến `--display` (tiêu đề) hoặc `--sans` (nội dung).

Nên chọn font có hỗ trợ tiếng Việt, và thử với chữ hoa có dấu như "TRƯỚC", "BỮA TỐI".

### Thay ảnh
- **Ảnh hero:** sửa `src="/img/p/dua-hau.jpg"` trong `pages/home/home.html`. Nên chọn ảnh vật thể trên nền trắng để `multiply` hoạt động.
- **Ảnh quầy hàng:** mảng `AISLES` trong `pages/home/home.ts`. Phần tử thứ hai là tên file trong `public/img/p/`.
- **Ảnh sản phẩm:** trường `img` hoặc `image_url` trong `public/data/products.json`.

### Sửa thẻ sản phẩm
- **Giao diện (HTML):** template trong `shared/product-card.ts`.
- **Kiểu dáng (CSS):** các class `.p-card`, `.ph`, `.price`, `.add-btn` trong `styles.css`.

Sửa một chỗ là toàn bộ danh sách sản phẩm, trang ưu đãi, tài khoản và trang chủ đổi theo.

### Sửa các khu trang chủ
- Mỗi khu là một `<section>` trong `pages/home/home.html`, có chú thích ở đầu.
- CSS của từng khu nằm trong `pages/home/home.css`, theo đúng thứ tự đó.
- Chữ trên dải chạy: mảng `marquee` trong `home.ts`. Chỉ ghi những điều cửa hàng làm thật.

### Giữ giao diện thống nhất
- Không đặt mã màu trực tiếp (`#ff0000`) trong component. Thêm biến vào `:root` nếu thật sự cần màu mới.
- Dùng sẵn các class `.btn`, `.btn-forest`, `.h2`, `.h3`, `.tab`, `.chip`, `.panel` thay vì viết kiểu mới.
- Một bán kính góc (`var(--r)`), không gradient, không đổ bóng cho thứ nằm yên trên trang. Xem `DESIGN.md`.
