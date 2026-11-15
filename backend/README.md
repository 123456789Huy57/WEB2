# FreshMart · Backend

API Express cho FreshMart, chạy trên Node.js 22 và MongoDB. Cách cài đặt và chạy xem [README gốc](../README.md). Danh sách endpoint xem [docs/api.md](../docs/api.md).

## Cấu trúc

```
src/
├── server.js          Khởi động: kết nối database, tạo index, cập nhật luật kiểm tra, mở cổng
├── app.js             Ghép middleware và router của các module
├── config/            Biến môi trường, kết nối DB, session, index, $jsonSchema, quy tắc giá và phí ship
├── lib/               Hàm dùng chung: lỗi HTTP, kiểm tra dữ liệu, Cloudinary
├── middleware/        Đăng nhập và phân quyền, CSRF, ghi log thao tác, xử lý lỗi
└── modules/           Mỗi nghiệp vụ một thư mục
    ├── auth/          Đăng ký, đăng nhập, quên mật khẩu, gửi email
    ├── users/         Hồ sơ, đổi mật khẩu, quản lý khách hàng
    ├── catalog/       Sản phẩm, danh mục, tải ảnh
    ├── cart/          Giỏ hàng trong session, báo giá
    ├── orders/        Đặt đơn, trạng thái đơn, khung giờ giao, tự hủy đơn quá hạn
    ├── payments/      VNPay, chuyển khoản VietQR qua SePay, hoàn tiền
    ├── inventory/     Tồn kho và lịch sử nhập xuất
    ├── vouchers/      Voucher và giới hạn lượt dùng
    ├── recipes/       Công thức, nguyên liệu, cửa hàng, lượt nấu
    ├── reviews/       Đánh giá sản phẩm
    ├── community/     Bài viết, bình luận, cảm xúc, bình chọn
    ├── recommendations/  Luật kết hợp "thường được mua cùng"
    ├── dashboard/     Số liệu trang tổng quan admin
    └── newsletter/    Đăng ký nhận ưu đãi qua email
scripts/               Khởi tạo, đồng bộ và rà soát dữ liệu
tests/                 *.test.js là unit test, *.integration.cjs là integration test
```

## Quy ước

- **Một module gồm** `*.routes.js` (khai báo đường dẫn và quyền), `*.controller.js` (đọc request, trả response) và `*.service.js` (nghiệp vụ, truy cập database). Module nhỏ có thể gộp controller vào routes.
- **Lỗi** ném ra bằng `HttpError(status, code, message)` trong `src/lib/http-error.js`. Middleware lỗi đổi thành JSON `{ error: { code, message } }`.
- **Kiểm tra đầu vào** dùng các hàm trong `src/lib/validation.js`. Body có trường lạ hoặc sai kiểu đều bị từ chối.
- **Quyền** dùng `requireAuth` và `requireAdmin` trong `src/middleware/auth.js`. Vai trò và trạng thái tài khoản được đọc lại từ database ở mỗi request.
- **Nghiệp vụ nhiều bước** (đặt đơn, hủy đơn, thanh toán, chỉnh kho) chạy trong transaction MongoDB, nhận `session` và truyền xuống mọi câu truy vấn.
- **Tiền** là số nguyên VND. **Giá, phí ship, bước số lượng, trạng thái đơn** chỉ khai báo một lần trong `src/config/commerce.js`.

## Biến môi trường

Mẫu đầy đủ kèm giải thích nằm trong [`.env.example`](.env.example).

| Nhóm | Biến | Bắt buộc |
|---|---|---|
| Cơ bản | `MONGODB_URI`, `MONGODB_DB`, `SESSION_SECRET`, `FRONTEND_ORIGIN`, `BACKEND_URL` | Có (production) |
| Tài khoản admin | `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PHONE`, `DEV_ADMIN_PASSWORD`, `DEV_ADMIN_NAME` | Chỉ khi chạy `seed:admin` |
| Email | `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Không. Để trống thì ghi thư vào hộp thư thử |
| VNPay | `PAYMENT_PROVIDER`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_URL` | Không. Để trống thì dùng cổng giả lập |
| Chuyển khoản | `BANK_CODE`, `BANK_ACCOUNT`, `BANK_HOLDER`, `SEPAY_API_KEY` | Không. Thiếu một biến thì ẩn phương thức này |
| Ảnh | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Không. Để trống thì lưu ảnh ở máy |

Không đưa file `.env` lên Git.

## Kiểm thử

```bash
npm test                    # unit test, không cần database
npm run test:integration    # tài khoản, sản phẩm, phân quyền
npm run test:b              # giỏ, đơn, thanh toán, kho, voucher, giao hàng
```

Integration test cần `MONGODB_URI` (hoặc `MONGODB_TEST_URI`), tự tạo database tạm có tên ngẫu nhiên và xóa khi chạy xong.

## Postman

Import [docs/freshmart.postman_collection.json](../docs/freshmart.postman_collection.json). Postman cần bật lưu cookie, và phải gọi `GET /api/auth/session` để lấy CSRF token trước khi gửi request ghi dữ liệu.
