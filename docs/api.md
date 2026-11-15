# API FreshMart

Backend là một ứng dụng Express duy nhất, mọi endpoint nằm dưới tiền tố `/api`.

- Máy dev: `http://localhost:3000/api`
- Production: `https://web-2-two-lyart.vercel.app/api` (Vercel chuyển tiếp sang Render)

Collection Postman để thử nhanh: [freshmart.postman_collection.json](freshmart.postman_collection.json).

## Quy ước chung

| Mục | Quy ước |
|---|---|
| Định dạng | Request và response đều là JSON (`Content-Type: application/json`), trừ upload ảnh dùng `multipart/form-data` |
| Đăng nhập | Session phía server, lưu trong MongoDB. Trình duyệt chỉ giữ cookie `HttpOnly`, `SameSite=Lax` chứa mã phiên |
| CSRF | Mọi request `POST`, `PUT`, `PATCH`, `DELETE` phải gửi header `X-CSRF-Token`. Lấy token từ `GET /api/auth/session`; token đổi sau khi đăng nhập hoặc đăng ký |
| Chống gửi trùng | `POST /orders` và điều chỉnh kho bắt buộc header `Idempotency-Key` (UUID). Gửi lại cùng khóa thì nhận lại kết quả cũ |
| ID | Luôn là chuỗi, ví dụ `p-…`, `ord-…`, `u-…` |
| Tiền | Số nguyên, đơn vị VND |
| Thời gian | Chuỗi ISO 8601 theo UTC. Khung giờ giao hàng tính theo giờ Việt Nam (UTC+7) |
| Lỗi | `{ "error": { "code": "CART_INVALID", "message": "…", "details": … } }`. `code` cố định để frontend xử lý, `message` là câu tiếng Việt cho người dùng |

Mã HTTP thường gặp: `400` dữ liệu sai, `401` chưa đăng nhập, `403` không đủ quyền hoặc sai CSRF, `404` không tìm thấy, `409` dữ liệu đã thay đổi (hết hàng, sai trạng thái, trùng khóa), `429` gửi quá nhiều lần, `503` thiếu cấu hình (database, SMTP).

Quyền trong các bảng dưới: **Công khai** là ai cũng gọi được, **Khách** là đã đăng nhập, **Admin** là tài khoản quản trị.

## Hệ thống

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/health` | Công khai | Server còn sống và trạng thái kết nối database |

## Tài khoản

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/auth/session` | Công khai | Người dùng hiện tại (nếu có) và CSRF token |
| POST | `/auth/register` | Công khai | Đăng ký, đăng nhập luôn. Có giới hạn số lần |
| POST | `/auth/login` | Công khai | Đăng nhập, tùy chọn ghi nhớ 7 ngày. Có giới hạn số lần |
| POST | `/auth/logout` | Công khai | Đăng xuất, xóa phiên |
| POST | `/auth/forgot-password` | Công khai | Gửi link đặt lại mật khẩu (hết hạn sau 20 phút) |
| POST | `/auth/reset-password` | Công khai | Đặt mật khẩu mới bằng token trong thư |
| GET / PATCH | `/users/me` | Khách | Xem, sửa hồ sơ |
| PATCH | `/users/me/password` | Khách | Đổi mật khẩu, đăng xuất mọi thiết bị để đăng nhập lại |
| GET | `/admin/users`, `/admin/users/:id` | Admin | Danh sách và chi tiết khách hàng |
| PATCH | `/admin/users/:id/status` | Admin | Khóa hoặc mở khóa tài khoản |

## Sản phẩm và danh mục

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/products` | Công khai | Danh sách sản phẩm đang bán (bản gọn cho trang danh sách) |
| GET | `/products/:id`, `/products/slug/:slug` | Công khai | Chi tiết một sản phẩm |
| GET | `/categories` | Công khai | 13 quầy hàng và nhóm con |
| GET / POST | `/admin/products` | Admin | Danh sách đầy đủ, thêm sản phẩm |
| PATCH / DELETE | `/admin/products/:id` | Admin | Sửa, ẩn sản phẩm (không xóa hẳn) |
| GET / POST | `/admin/categories` | Admin | Danh sách, thêm danh mục |
| PATCH / DELETE | `/admin/categories/:id` | Admin | Sửa, ẩn danh mục |
| POST | `/admin/uploads` | Admin | Tải ảnh sản phẩm (tối đa 2 MB, chuyển sang WebP) |

## Giỏ hàng và đặt đơn

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/cart` | Công khai | Giỏ trong session, kèm `issues` nếu có món hết hàng hoặc ngừng bán |
| POST | `/cart/items` | Công khai | Thêm một món `{ productId, quantity }` |
| POST | `/cart/items/bulk` | Công khai | Thêm nhiều món một lần (dùng cho Meal Planner) |
| PATCH / DELETE | `/cart/items/:productId` | Công khai | Đổi số lượng, xóa một món |
| DELETE | `/cart` | Công khai | Xóa cả giỏ |
| POST | `/checkout/quote` | Công khai | Báo giá: tạm tính, phí ship, giảm giá, tổng |
| GET | `/delivery-slots` | Công khai | Các khung giờ giao còn chọn được hôm nay và ngày mai |
| POST | `/orders` | Khách | Đặt đơn. Cần header `Idempotency-Key` |
| GET | `/users/me/orders`, `/users/me/orders/:id` | Khách | Đơn của chính mình |
| POST | `/users/me/orders/:id/cancel` | Khách | Hủy đơn khi còn chờ xác nhận hoặc đã xác nhận |
| POST | `/users/me/orders/:id/reorder` | Khách | Thêm lại các món của đơn cũ vào giỏ |
| GET | `/admin/orders`, `/admin/orders/:id` | Admin | Tìm, lọc, xem đơn |
| PATCH | `/admin/orders/:id/status` | Admin | Chuyển trạng thái, kèm `expectedStatus` để tránh hai người sửa cùng lúc |

## Thanh toán

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/payments/methods` | Công khai | Các phương thức đang bật (COD, VNPay, chuyển khoản) |
| POST | `/users/me/orders/:id/payments` | Khách | Tạo giao dịch VNPay (trả `payUrl`) hoặc thông tin chuyển khoản VietQR |
| GET | `/payments/return` | VNPay | Trang VNPay trả khách về, kiểm tra chữ ký |
| GET | `/payments/vnpay/ipn` | VNPay | VNPay báo kết quả giữa hai máy chủ |
| GET | `/payments/mock/pay` | Công khai | Cổng giả lập khi chưa cấu hình VNPay (chỉ để demo) |
| POST | `/payments/sepay/webhook` | SePay | SePay báo có tiền vào. Xác thực bằng API key, không cần CSRF |
| POST | `/admin/orders/:id/confirm-payment` | Admin | Xác nhận tay đã nhận tiền chuyển khoản |
| GET | `/admin/payments/refunds` | Admin | Các khoản cần hoàn tiền |
| POST | `/admin/payments/:id/refund` | Admin | Đánh dấu đã hoàn tiền |

## Kho và voucher

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/admin/inventory` | Admin | Tồn kho và lịch sử nhập xuất |
| POST | `/admin/inventory/:productId/adjustments` | Admin | Tăng hoặc giảm kho. Cần `Idempotency-Key` |
| GET | `/vouchers` | Công khai | Voucher đang chạy |
| GET / POST | `/users/me/vouchers` | Khách | Voucher đã lưu, lưu thêm mã |
| DELETE | `/users/me/vouchers/:code` | Khách | Bỏ lưu mã |
| GET / POST | `/admin/vouchers` | Admin | Danh sách, tạo voucher |
| PATCH | `/admin/vouchers/:id` | Admin | Sửa, bật hoặc tắt voucher |

## Meal Planner, đánh giá, gợi ý

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/recipes`, `/recipes/:id` | Công khai | 66 công thức món ăn |
| GET | `/recipes/trending` | Công khai | Món và nguyên liệu được nấu nhiều nhất hôm nay |
| POST | `/recipes/:id/cook` | Khách | Ghi một lượt nấu (mỗi người, mỗi món, mỗi ngày một lần) |
| GET | `/ingredients`, `/ingredient-products` | Công khai | Nguyên liệu và sản phẩm tương ứng để mua |
| GET | `/stores` | Công khai | 12 cửa hàng |
| GET | `/products/:id/reviews` | Công khai | Đánh giá và điểm trung bình của sản phẩm |
| GET / DELETE | `/products/:id/reviews/me` | Khách | Đánh giá của tôi, xóa đánh giá |
| POST | `/products/:id/reviews` | Khách | Viết hoặc sửa đánh giá (chỉ khi đã nhận hàng) |
| GET | `/admin/reviews` | Admin | Danh sách đánh giá |
| PATCH | `/admin/reviews/:id` | Admin | Ẩn hoặc hiện đánh giá |
| GET | `/products/:id/also-bought` | Công khai | Sản phẩm thường được mua cùng |
| GET | `/cart/recommendations` | Công khai | Gợi ý thêm cho giỏ hiện tại |
| GET | `/admin/recommendations` | Admin | Bảng luật kết hợp (support, confidence, lift) |

## Cộng đồng và nhận ưu đãi

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/community/posts`, `/community/posts/:id` | Công khai | Bài viết, kèm bình luận, cảm xúc, bình chọn |
| GET | `/community/summary` | Công khai | Số liệu tổng quan cho trang Cộng đồng |
| POST | `/community/posts` | Khách | Đăng bài |
| DELETE | `/community/posts/:id` | Khách | Xóa bài của mình |
| POST | `/community/posts/:id/reactions` | Khách | Thả cảm xúc |
| POST / DELETE | `/community/posts/:id/comments`, `…/comments/:cid` | Khách | Bình luận, xóa bình luận |
| POST | `/community/posts/:id/votes` | Khách | Bình chọn |
| GET / PUT | `/community/saves` | Khách | Bài viết và món đã lưu |
| POST | `/community/uploads` | Khách | Tải ảnh cho bài viết (có giới hạn số lần) |
| GET | `/admin/community/posts` | Admin | Danh sách bài để kiểm duyệt |
| PATCH | `/admin/community/posts/:id` | Admin | Ẩn hoặc hiện bài vi phạm |
| POST | `/newsletter/subscribe`, `/newsletter/unsubscribe` | Công khai | Đăng ký, hủy nhận ưu đãi qua email |
| GET | `/newsletter/subscribers` | Admin | Danh sách email đăng ký |
| GET | `/admin/dashboard` | Admin | Doanh thu, đơn theo trạng thái, 7 ngày gần nhất, bán chạy, sắp hết hàng |

## Quy tắc nghiệp vụ

**Giá và phí ship.** Giá bán là giá khuyến mãi nếu có, ngược lại là giá gốc. Phí ship 20.000 đ, miễn phí cho đơn từ 300.000 đ. Hàng bán theo kg đi bước 0,5 kg, hàng khác đi bước 1. Server luôn tự tính lại tiền, không tin con số từ trình duyệt.

**Đặt đơn.** Chạy trong một transaction MongoDB: đọc giá mới, trừ kho có điều kiện `stock >= số lượng`, dùng voucher, ghi lịch sử kho, lưu đơn. Một bước lỗi thì không lưu gì. Hai người cùng mua món cuối cùng thì chỉ một người thành công.

**Trạng thái đơn.** `pending → confirmed → preparing → shipping → delivered`. Có thể hủy (`cancelled`) trước khi giao. Khách tự hủy được khi đơn còn `pending` hoặc `confirmed`. Hủy đơn thì trả hàng về kho và trả lượt voucher, mỗi việc đúng một lần.

**Thanh toán trả trước.** Đơn VNPay giữ hàng 15 phút, đơn chuyển khoản giữ 30 phút. Quá hạn chưa trả tiền thì đơn tự hủy. Đơn COD chưa được xác nhận sau 48 giờ cũng tự hủy. Đơn trả trước chưa thanh toán thì admin chưa xử lý được.

**Chuyển khoản VietQR.** Nội dung chuyển khoản là mã đơn. Khi SePay báo có tiền: báo trùng thì bỏ qua, chuyển thiếu thì không xác nhận, tiền đến khi đơn đã hủy hoặc đã trả thì ghi nhận cần hoàn tiền.

**Voucher.** Ba lớp giới hạn: đối tượng (khách mới hay mọi khách), tổng lượt dùng, số lượt mỗi khách. Không vượt giới hạn kể cả khi nhiều người bấm cùng lúc.

**Database tự kiểm tra.** 17 collection có luật `$jsonSchema`, chặn dữ liệu sai như kho âm hay tổng tiền không khớp, kể cả khi code có lỗi. Chi tiết xem [database.md](database.md).
