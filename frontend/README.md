# FreshMart · Frontend

Giao diện Angular 20 của FreshMart. Mọi dữ liệu (tài khoản, sản phẩm, giỏ, đơn, voucher, Meal Planner, cộng đồng) đọc và ghi qua API backend. Cách cài đặt và chạy xem [README gốc](../README.md).

```bash
npm install
npm start          # http://localhost:4200, gọi API qua proxy tới http://localhost:3000
npm run build      # đóng gói vào dist/freshmart/browser
```

Cần chạy backend trước. Ở máy dev, `src/proxy.conf.json` chuyển `/api` và `/images` sang backend. Khi triển khai, `vercel.json` làm việc tương tự nên trình duyệt chỉ thấy một tên miền.

## Cấu trúc

```
src/
├── styles.css           Biến màu, chữ, khoảng cách và các lớp dùng chung
└── app/
    ├── app.config.ts    Router, HttpClient, interceptor, tải trước các trang
    ├── app.routes.ts    Danh sách trang, mỗi trang tải riêng khi cần (lazy load)
    ├── layout/          Header, footer
    ├── pages/           Mỗi trang một thư mục
    ├── admin/           Khu quản trị, khung giao diện riêng
    ├── core/            Service, guard, interceptor, kiểu dữ liệu (không có giao diện)
    └── shared/          Component, directive, pipe dùng lại
public/
├── data/                Dữ liệu mẫu, backend đọc khi chạy db:setup
├── fonts/               Be Vietnam Pro, Oswald (giấy phép OFL, tự host)
└── img/, video/         Ảnh và video tĩnh
```

## Trang cho khách

| Đường dẫn | Trang |
|---|---|
| `/` | Trang chủ |
| `/san-pham`, `/san-pham/:id` | Danh sách theo quầy, bộ lọc; chi tiết sản phẩm, đánh giá, sản phẩm mua kèm |
| `/so-sanh` | So sánh sản phẩm |
| `/gio-hang` | Giỏ hàng, voucher, gợi ý thêm |
| `/thanh-toan` | Thông tin nhận hàng, khung giờ giao, phương thức thanh toán |
| `/thanh-toan/chuyen-khoan` | Mã VietQR, tự cập nhật khi nhận được tiền |
| `/thanh-toan/ket-qua` | Kết quả thanh toán VNPay |
| `/meal-planner` | Chọn nguyên liệu, gợi ý món, thêm phần còn thiếu vào giỏ |
| `/cong-dong` | Bài viết, món được nấu nhiều, lướt món |
| `/uu-dai` | Voucher và sản phẩm đang giảm giá |
| `/cua-hang`, `/he-thong-cua-hang` | Giới thiệu FreshMart, danh sách 12 cửa hàng |
| `/blog`, `/thong-tin/:slug` | Blog ẩm thực, trang chính sách |
| `/dang-nhap`, `/quen-mat-khau`, `/dat-lai-mat-khau` | Đăng nhập, đăng ký, khôi phục mật khẩu |
| `/tai-khoan`, `/tra-cuu-don` | Đơn hàng, yêu thích, voucher đã lưu, hồ sơ; tra cứu đơn |

## Trang quản trị (`/admin`)

| Đường dẫn | Trang |
|---|---|
| `/admin` | Tổng quan: doanh thu, đơn theo trạng thái, bán chạy, sắp hết hàng, luật mua kèm |
| `/admin/don-hang` | Xử lý đơn, xác nhận chuyển khoản |
| `/admin/san-pham`, `/admin/danh-muc` | Sản phẩm, danh mục |
| `/admin/ton-kho` | Nhập, điều chỉnh tồn kho |
| `/admin/voucher` | Voucher |
| `/admin/khach-hang` | Khách hàng, khóa tài khoản |
| `/admin/danh-gia`, `/admin/cong-dong` | Kiểm duyệt đánh giá và bài viết |
| `/admin/ra-anh` | Tìm ảnh sản phẩm, món ăn bị lỗi |

## Quy ước

- **Component** là standalone, trạng thái giữ bằng `signal` và `computed`.
- **Gọi API** chỉ qua service trong `core/`. `api.interceptor.ts` tự gửi cookie và CSRF token, component không tự thêm header.
- **Quyền truy cập** dùng `authGuard`, `guestGuard`, `adminGuard`. Backend vẫn kiểm tra lại quyền, guard chỉ để điều hướng.
- **Tiền và tổng đơn** luôn lấy từ server. Giỏ cập nhật giao diện ngay khi bấm rồi khớp lại với kết quả server trả về.
- **Giao diện** chỉ dùng biến trong `styles.css`, không đặt màu hay cỡ chữ riêng trong component. Quy tắc chi tiết ở [docs/design-system.md](../docs/design-system.md).
- **Tôn trọng** cài đặt giảm chuyển động của người dùng (`prefers-reduced-motion`).
