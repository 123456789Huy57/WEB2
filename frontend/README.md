# FreshMart · Web2 (Angular)

Frontend Angular 20 của đồ án FreshMart, chuyển từ bản Web1 (HTML/CSS/JS thuần).
Tài khoản, hồ sơ và catalog gọi Express/MongoDB. Công thức, voucher và các phần B còn dùng dữ liệu demo trong lúc nối backend.

## Chạy thử

Cần Node.js 20.19 trở lên (hoặc 22.12+).

```bash
npm install
npm run images     # chạy 1 lần: tải ảnh sản phẩm, nguyên liệu, món ăn về public/img/remote
npm start          # mở http://localhost:4200
```

`npm run images` nên chạy trước hôm demo: ảnh gốc của Web1 nằm ở CDN Bách Hóa Xanh và Pinterest, nếu các trang đó chặn hoặc mạng yếu thì web vẫn đủ ảnh. Ảnh nào không tải được thì giữ link cũ; trên web, ảnh lỗi hiện chữ cái đầu của tên trên nền đá thay vì biểu tượng ảnh vỡ.

## Tài khoản và backend

Chạy/cấu hình backend theo [hướng dẫn backend](../backend/README.md), import catalog rồi mới chạy frontend. Khách tự đăng ký; admin được tạo qua `npm run seed:admin` với thông tin riêng. Không còn tài khoản demo hoặc mật khẩu trong public/data/users.json.

Frontend đã có dev proxy, cookie và CSRF interceptor. Login/profile/catalog admin dùng API; JSON/localStorage không còn là nguồn chuẩn của tài khoản và sản phẩm. Reset dữ liệu mẫu trên giao diện chỉ xóa dữ liệu demo ở trình duyệt, không xóa MongoDB.

Checkout, sửa stock và đổi trạng thái đơn đang chặn để chờ API phần B; đơn/voucher/giỏ hiện có vẫn là dữ liệu demo. Hợp đồng MVP chốt member-only checkout và COD. B nối API rồi bật chức năng tương ứng.

## Các màn hình

| Đường dẫn | Màn hình | File |
|---|---|---|
| `/` | Trang chủ, bảng giá sáng nay | `pages/home` |
| `/san-pham?c=vegetables&q=...` | Danh sách, lọc theo quầy, loại, giá, giảm giá; sắp xếp | `pages/catalog` |
| `/san-pham/:id` | Chi tiết sản phẩm, dinh dưỡng, yêu thích | `pages/product` |
| `/gio-hang` | Giỏ hàng, mã giảm giá, miễn phí giao từ 300.000 đ | `pages/cart` |
| `/thanh-toan` | Thanh toán (Reactive Forms), chờ API COD phần B | `pages/checkout` |
| `/meal-planner` | Chọn nguyên liệu → tiêu chí → gợi ý món → thêm phần còn thiếu vào giỏ | `pages/meal-planner` |
| `/uu-dai` | Mã giảm giá, sản phẩm đang giảm | `pages/offers` |
| `/cua-hang` | 12 cửa hàng, tìm theo quận | `pages/stores` |
| `/dang-nhap` | Đăng nhập, tạo tài khoản | `pages/login` |
| `/tai-khoan` | Đơn của mình kèm tiến trình giao, hủy đơn, mua lại; yêu thích; mã đã lưu; thông tin | `pages/account` |
| `/tra-cuu-don?ma=&sdt=` | Tra cứu demo cũ; không thuộc API công khai của MVP | `pages/order-lookup` |
| `/so-sanh` | So sánh tối đa 3 sản phẩm theo giá và dinh dưỡng | `pages/compare` |
| `/thong-tin/:slug` | Giới thiệu, đội ngũ, đối tác, hướng dẫn mua hàng, giao hàng, đổi trả, bảo mật | `pages/info` |
| `/blog`, `/blog/:slug` | Blog ẩm thực | `pages/blog` |
| `/admin` | Tổng quan: doanh thu 7 ngày, đơn theo trạng thái, bán chạy, hàng sắp hết | `admin/dashboard` |
| `/admin/don-hang` | Lọc, tìm, chuyển trạng thái đơn từng bước; hủy đơn trả hàng về kho | `admin/orders` |
| `/admin/san-pham` | Thêm, sửa, ẩn/hiện sản phẩm (Reactive Forms có kiểm tra) | `admin/products` |
| `/admin/ton-kho` | Nhập thêm, đặt lại số tồn, lọc hàng sắp hết | `admin/inventory` |
| `/admin/voucher` | Tạo, sửa, bật/tắt mã giảm giá | `admin/vouchers` |
| `/admin/khach-hang` | Khách hàng, số đơn, tổng chi tiêu | `admin/customers` |

## Quy tắc nghiệp vụ đã cài

- Phí giao 20.000 đ, miễn phí cho đơn từ 300.000 đ (thống nhất giữa giỏ hàng, thanh toán và trang Chính sách giao hàng).
- Hàng cân ký bán theo nấc 0,5 kg. Không thêm quá số tồn kho; lúc đặt hàng kiểm tra tồn kho lần nữa.
- Đặt hàng trừ tồn kho; hủy đơn (khách hoặc admin) cộng lại.
- Khách chỉ hủy được đơn khi trạng thái là Chờ xác nhận hoặc Đã xác nhận.
- Trạng thái đơn: Chờ xác nhận → Đã xác nhận → Đang soạn hàng → Đang giao → Đã giao (hoặc Đã hủy).
- Mã WELCOME10 và NEWUSER20 chỉ dùng cho đơn đầu tiên; mã hết hạn hoặc bị admin tắt thì không áp dụng.
- Tài khoản chỉ thấy đơn của chính mình. Đơn đặt khi chưa đăng nhập tra cứu bằng mã đơn + số điện thoại.
- Tìm kiếm không phân biệt dấu ("ca chua" ra "Cà chua"), gợi ý ngay khi gõ từ 2 ký tự.
- Trang sản phẩm gợi ý món nấu được với sản phẩm đó (tra ngược bảng nguyên liệu của Meal Planner).
- Giỏ hàng gợi ý đồ tươi đang giảm giá khi đơn chưa đủ 300.000 đ để miễn phí giao.
- `/tai-khoan` cần đăng nhập, `/admin` cần tài khoản quản trị (route guard).

## Cấu trúc

```
src/
  styles.css               Hệ thiết kế dùng chung (màu, chữ, nút, thẻ sản phẩm…)
  app/
    app.config.ts          Router, HttpClient, nạp dữ liệu khi mở app
    app.routes.ts          Danh sách trang (lazy load)
    admin/                 Khu quản trị (route con của /admin, khung riêng không có header cửa hàng)
    core/                  Service + kiểu dữ liệu (không có giao diện)
      models.ts            Interface Product, Recipe, Order… khớp JSON Web1
      data.service.ts      Đọc JSON. ĐỔI BASE THÀNH API KHI CÓ BACKEND
      product.service.ts   Giá, % giảm, tìm kiếm không dấu
      cart.service.ts      Giỏ hàng (signal), phí giao, áp mã
      voucher.service.ts   Kiểm tra và tính mã giảm giá (giữ công thức Web1)
      meal-planner.service.ts  Chấm điểm món (giữ thuật toán Web1), quy đổi số lượng cần mua
      auth.service.ts, auth.guard.ts, order.service.ts, wishlist.service.ts, toast.service.ts
    shared/                Thành phần dùng lại: thẻ sản phẩm, nút thêm giỏ, danh sách voucher, pipe vnd
    layout/                Header, footer
    pages/                 Mỗi màn hình một thư mục
public/
  data/                    JSON của Web1 (sinh lại từ thư mục data/ của Web1)
  fonts/                   Noto Serif Display + Be Vietnam Pro (giấy phép OFL, tự host)
  img/                     Ảnh cửa hàng và ảnh sản phẩm đã tách nền
```

## Ghép với Backend Express và MongoDB

Phần A đã nối: AuthService, API interceptor, DataService, login/remember-me, đổi/quên mật khẩu, profile, admin products/categories/customers và upload ảnh. Session được khôi phục trước khi Angular vào route; customer không tải danh sách user hoặc sản phẩm ẩn.

Phần B nối theo [backend-contract.md](../backend/docs/backend-contract.md): CartService → /api/cart, OrderService → /api/orders và /api/users/me/orders, admin order/inventory theo các endpoint trong hợp đồng. Không dùng catalog PATCH để trừ/hoàn kho. Giữ thuật toán Meal Planner hiện tại và đổi thao tác mua nguyên liệu sang Cart API khi B hoàn thành.

## Quy ước giao diện

- Màu và cỡ chữ lấy từ biến trong `styles.css` (`--forest`, `--stone`, `--t-head`…). Không tự đặt màu mới trong component.
- Tên món, giá, tiêu đề dùng chữ có chân (`.h2`, `.h3`, `.price`). Nội dung dùng Be Vietnam Pro.
- Không đổ bóng, không gradient. Tách khối bằng khoảng trắng hoặc nền đá `--stone`.
- Chữ trên giao diện viết như người bán hàng nói: “Thêm vào giỏ”, “Cần mua thêm 2 nguyên liệu”.

## Chức năng phần A đã hoàn thiện

Quản lý danh mục/danh mục con ở `/admin/danh-muc`. Trong form sản phẩm có upload PNG/JPEG/WebP, gallery, dinh dưỡng và khối lượng; stock chỉ đọc. Admin khách hàng có Chi tiết và Khóa/Mở. Trang tài khoản có đổi mật khẩu; trang đăng nhập có ghi nhớ 7 ngày và Quên mật khẩu.

Khôi phục local dùng hộp thư thử của backend (`npm run mail:inbox`), không gửi email thật. Cấu hình SMTP khi nhóm có dịch vụ gửi thư. Xem [bàn giao A](../backend/docs/part-a-handoff.md) để kiểm tra toàn bộ các mục.
