# Backend FreshMart

Phần A đã hoàn thành theo [bảng bàn giao](docs/part-a-handoff.md): auth/session, phân quyền, hồ sơ, khách hàng, catalog, upload ảnh và khôi phục mật khẩu. Phần B (giỏ, đặt đơn COD/VNPay, kho, voucher, dashboard) và phần mở rộng (Meal Planner API, Cộng đồng, đánh giá, Cloudinary) đã triển khai: xem [bàn giao phần B](docs/part-b-handoff.md) và [hợp đồng backend v1](docs/backend-contract.md). Dùng Node.js 22+, Express, CommonJS, MongoClient, Morgan, Nodemon và express-session.

## Chạy local

```bash
cd backend
npm ci
cp .env.example .env
```

Cả nhóm dùng chung MongoDB Atlas theo [hướng dẫn](docs/mongodb-atlas.md). Điền `MONGODB_URI` (local: `mongodb://127.0.0.1:27017`), `MONGODB_DB=freshmart` và `SESSION_SECRET` riêng trong `.env`. Tạo secret bằng:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run seed:catalog
npm run seed:vouchers
npm run dev
```

Seed chỉ thêm sản phẩm/danh mục chưa có, giữ mã demo và không ghi đè giá/tồn kho đã sửa. Không tự import tài khoản/mật khẩu Web1. Khi chưa có MongoDB, chỉ dùng health API và session guest để kiểm tra khung; dữ liệu/auth cần DB. `GET /api/health` là HTTP liveness, không phải kiểm tra readiness trực tiếp.

## Tài khoản quản trị

Điền `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PHONE`, `DEV_ADMIN_PASSWORD`, `DEV_ADMIN_NAME` trong `.env` rồi chạy:

```bash
npm run seed:admin
```

Mật khẩu ít nhất 8 ký tự và tối đa 72 byte UTF-8, lưu bằng bcrypt hash. Script chỉ tạo tài khoản mới; không ghi đè/nâng quyền tài khoản đã có. Không có tài khoản hay mật khẩu admin mặc định. Khách tự đăng ký trên giao diện. Không commit `.env` hoặc thông tin đăng nhập.

## Các lệnh

| Lệnh | Mục đích |
|---|---|
| `npm run dev` | Nodemon tự khởi động lại khi sửa code |
| `npm start` | Chạy server bằng Node |
| `npm test` | Kiểm tra HTTP, session và quy tắc dùng chung |
| `npm run test:integration` | Kiểm tra phần A với MongoDB local trong DB thử riêng, xóa sau khi chạy |
| `npm run db:setup` | Dựng database: collection, luật kiểm tra, index, dữ liệu mẫu (leader chạy) |
| `npm run check:db` | Kiểm tra kết nối MongoDB, in lý do nếu lỗi |
| `npm run seed:catalog` | Nhập products/categories còn thiếu |
| `npm run seed:admin` | Tạo admin từ cấu hình riêng |
| `npm run seed:vouchers` | Nhập voucher còn thiếu, gán loại khách mới/mọi khách |
| `npm run mail:inbox` | Xem thư khôi phục thử local, không gửi email thật |

Integration test dùng `MONGODB_TEST_URI` nếu có, mặc định MongoDB local; luôn tạo tên DB thử mới, không dùng DB làm việc của nhóm.

## Điểm nối cho B

- Đọc [backend-contract.md](docs/backend-contract.md) trước khi code: đây là nguồn chuẩn về session, API giỏ/đơn, tiền, trạng thái và stock.
- A: `src/modules/auth`, `users`, `catalog`; B: `cart`, `vouchers`, `orders`, `inventory`.
- B dùng middleware `requireAuth`/`requireAdmin`; sau đó lấy user từ `req.user`.
- Toàn bộ API ghi `/api` cần cookie và X-CSRF-Token; token lấy từ GET /api/auth/session và thay sau login/register.
- MVP giỏ trong session cho guest và user; login giữ giỏ guest, logout xóa giỏ. Checkout cần login, chỉ COD.
- A sở hữu thông tin/giá sản phẩm. Product mới stock=0, catalog PATCH từ chối stock/counters. B cập nhật stock qua inventory service trong cùng transaction với đơn.
- `src/config/commerce.js` chứa phí ship, giá bán, bước quantity và ma trận trạng thái đã chốt.
- `catalog.service.checkoutProducts(productIds, mongoSession)` hỗ trợ đọc trong cùng transaction. Dùng `getMongoClient()` để mở transaction; cần replica set/Atlas phù hợp.
- Router/controller/model tách theo module; thêm service cho nghiệp vụ nhiều bước. Mount router B sau middleware chung trong `src/app.js`.

## Frontend và phiên đăng nhập

Frontend đã có dev proxy `/api/**` → localhost:3000, interceptor cookie/CSRF và gọi API phần A. Chạy backend trước, sau đó `cd frontend` và `npm ci`, `npm start`. Auth không dùng localStorage/users.json; catalog lấy dữ liệu MongoDB. Public API trả mảng mặc định; admin user API trả phân trang.

Giỏ, đơn, voucher, kho, công thức và đánh giá đều đọc/ghi qua API; trình duyệt chỉ còn lưu tiện ích cá nhân (yêu thích, so sánh, nguyên liệu đã chọn).

Session dùng cookie HttpOnly/SameSite=Lax, 1 giờ hoặc 7 ngày nếu rememberMe. Có DB thì lưu collection sessions; MemoryStore chỉ cho local chưa cấu hình DB. Production yêu cầu URI/secret, HTTPS; nếu có reverse proxy phải cấu hình trust proxy theo hạ tầng. Admin/user role và trạng thái được kiểm tra từ DB trên mỗi request cần quyền.

## Postman

Import `docs/freshmart.postman_collection.json`. Folder Starter kiểm tra server; các folder auth/catalog cần DB. Postman phải giữ cookie jar và lấy token trước khi gửi request ghi. Có thể chạy Starter trên máy này:

```bash
/Users/quynhlu/.local/bin/postman collection run docs/freshmart.postman_collection.json -i Starter --no-report-events
```

Xem [phân công](docs/backend-task-assignment.md) và [đối chiếu môn học](docs/team-guide.md) để biết phạm vi hai người.

## Thư khôi phục và ảnh tải lên

Mặc định development dùng MAIL_TRANSPORT=outbox; thư lưu private trong `.local-mail`, xem bằng `npm run mail:inbox`. Link chỉ dùng một lần và hết hạn sau 20 phút. Đây là hộp thư thử, không phải email đã gửi tới người dùng. Muốn gửi email thật, chuyển MAIL_TRANSPORT=smtp rồi điền MAIL_FROM và các trường SMTP trong .env. Không dùng outbox ở production.

Ảnh upload chỉ admin được phép gửi, tối đa 2 MB, được kiểm tra và chuyển WebP trước khi lưu trong `public/images/uploads`. Thư thử và ảnh tải lên đều không được commit. Có thể dùng MAIL_OUTBOX_DIR/UPLOAD_DIR để chỉ định thư mục riêng; integration tests luôn dùng thư mục tạm và tự xóa.

Giao diện phần A bổ sung `/admin/danh-muc`, quên/đặt lại mật khẩu, đổi mật khẩu trong hồ sơ, remember-me và chi tiết khách hàng. Logs bảo mật trong collection auditLogs không chứa nội dung nhạy cảm và hết hạn sau 90 ngày.
