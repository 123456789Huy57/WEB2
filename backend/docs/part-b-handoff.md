# Bàn giao phần B và phần mở rộng FreshMart

Nhánh `huy-phan-b`. Kiểm thử: `npm test` (không cần DB) và `npm run test:b` (database tạm trên Atlas, tự xóa). Tài liệu dữ liệu: [database-schema.md](database-schema.md), ERD: [erd.png](erd.png).

## Lệnh vận hành

| Lệnh | Việc |
|---|---|
| `npm run db:setup` | Dựng database: collection + luật kiểm tra + index + dữ liệu mẫu còn thiếu + sửa dữ liệu đã biết |
| `npm run check:db` | Kiểm tra kết nối MongoDB, in lý do nếu lỗi |
| `npm run audit:data` | Kiểm tra trước demo: ảnh mở được, Meal Planner mua đủ nguyên liệu, tồn kho, voucher |
| `npm run images:cloudinary` | Chuyển ảnh link ngoài lên Cloudinary (`--dry` để đếm trước) |
| `npm run test:b` | Kiểm thử tích hợp phần B qua HTTP thật |

## API mới

Mọi API ghi cần cookie + `X-CSRF-Token` (xem contract mục 2). Lỗi dạng `{ error: { code, message, details? } }`.

| Method | Endpoint | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/cart` | Mọi người | Giỏ trong session, có `issues` nếu hàng hết/ngừng bán |
| POST | `/cart/items` | Mọi người | `{productId, quantity}` cộng dồn; bước 0,5 kg hoặc 1 |
| PATCH / DELETE | `/cart/items/:productId` | Mọi người | Đặt số lượng tuyệt đối / xóa dòng |
| DELETE | `/cart` | Mọi người | Xóa giỏ |
| POST | `/checkout/quote` | Mọi người | `{voucherCode?}`; voucher cần đăng nhập |
| POST | `/orders` | Khách | Header `Idempotency-Key`; `paymentMethod: cod | vnpay` |
| GET | `/users/me/orders`, `/users/me/orders/:id` | Khách | Chỉ đơn của mình |
| POST | `/users/me/orders/:id/cancel` | Khách | Khi chờ xác nhận / đã xác nhận, chưa trả tiền online |
| POST | `/users/me/orders/:id/reorder` | Khách | Thêm lại vào giỏ theo giá, tồn kho mới |
| POST | `/users/me/orders/:id/payments` | Khách | Tạo giao dịch VNPay, trả `payUrl` |
| GET | `/payments/return`, `/payments/vnpay/ipn` | Cổng thanh toán | Kiểm chữ ký, ghi nhận đúng một lần |
| GET | `/vouchers`, `/users/me/vouchers` | Mọi người / Khách | Voucher đang chạy; voucher đã lưu + mã khách mới |
| POST / DELETE | `/users/me/vouchers`, `/users/me/vouchers/:code` | Khách | Lưu / bỏ lưu mã |
| GET | `/recipes`, `/recipes/:id`, `/ingredients`, `/ingredient-products`, `/stores` | Mọi người | Dữ liệu Meal Planner |
| GET | `/recipes/trending` | Mọi người | Tab Cộng đồng: món và nguyên liệu nấu nhiều hôm nay (hoặc 7 ngày) |
| POST | `/recipes/:id/cook` | Mọi người | Ghi một lượt nấu (một người/món/ngày) |
| GET | `/products/:id/reviews`, `/products/:id/reviews/me` | Mọi người / Khách | Đánh giá + thống kê; quyền đánh giá của tôi |
| POST / DELETE | `/products/:id/reviews`, `/products/:id/reviews/me` | Khách đã nhận hàng | Viết/sửa, xóa đánh giá |
| GET / PATCH | `/admin/orders`, `/admin/orders/:id/status` | Admin | Lọc, tìm; đổi trạng thái kèm `expectedStatus` |
| GET / POST | `/admin/inventory`, `/admin/inventory/:productId/adjustments` | Admin | Tăng/giảm kho, `Idempotency-Key` |
| GET / POST / PATCH | `/admin/vouchers`, `/admin/vouchers/:id` | Admin | Tạo, sửa, bật/tắt |
| GET / PATCH | `/admin/reviews`, `/admin/reviews/:id` | Admin | Ẩn/hiện đánh giá |
| GET | `/admin/dashboard` | Admin | Doanh thu, trạng thái, 7 ngày, bán chạy, sắp hết hàng |

## Quy tắc quan trọng (để thuyết trình)

- **Đặt đơn là một transaction:** đọc giá mới, trừ kho có điều kiện `stock >= số lượng`, tiêu voucher, ghi lịch sử kho, tạo đơn. Lỗi ở bước nào cũng hoàn tác hết.
- **Chống đặt trùng:** `Idempotency-Key` + unique index `{userId, idempotencyKey}`; gửi lại cùng khóa trả đơn cũ.
- **Hai người mua món cuối:** MongoDB phát hiện xung đột ghi, chỉ một transaction thành công.
- **Hủy đơn:** hoàn kho đúng một lần (`stockRestored` + `operationId` unique), hoàn lượt voucher.
- **Voucher:** ba lớp giới hạn `audience`, `usageLimit`, `perUserLimit`; lượt mỗi khách giữ bằng "ô" có `_id` cố định nên không vượt được khi bấm đồng thời.
- **Thanh toán:** cổng giả lập ký dữ liệu y hệt VNPay (HMAC-SHA512); có mã sandbox thì đổi `.env` là chạy VNPay thật.
- **Database tự kiểm tra:** `$jsonSchema` + `$expr` chặn kho âm, tổng tiền sai, voucher vượt suất dù code có lỗi.
