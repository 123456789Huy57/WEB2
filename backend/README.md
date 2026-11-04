# Backend FreshMart

Khung backend bám theo slide chương VI–VIII và code `LearnAngular/my-server`, `LearnAngular/my-server-mongodb`: Node.js, Express, CommonJS (`require/module.exports`), MongoDB native driver (`MongoClient`), Morgan, Nodemon và cookie/session. Frontend Angular gọi API JSON qua HttpClient service.

## Chạy local

Yêu cầu Node.js 22 trở lên. Trong thư mục `backend`:

```bash
npm ci
cp .env.example .env
npm run dev
```

- `npm run dev`: Nodemon tự khởi động lại khi sửa code.
- `npm start`: chạy server bằng Node.
- `npm test`: kiểm tra health, CORS, lỗi và cookie/session.
- `npm run seed:catalog`: nhập sản phẩm/danh mục mẫu vào MongoDB đã cấu hình.

Mở `http://localhost:3000/api/health`. Có thể để trống `MONGODB_URI` để kiểm tra HTTP server local. Khi đó API dữ liệu trả 503 và session chỉ lưu tạm trong RAM. `status: ok` chỉ nói HTTP server đang hoạt động; `database` thể hiện kết nối đã được khởi tạo, không phải kiểm tra readiness trực tiếp.

## Cấu hình MongoDB và session

Điền `MONGODB_URI` (local ví dụ `mongodb://127.0.0.1:27017` hoặc URI Atlas), `MONGODB_DB=freshmart` và `SESSION_SECRET` trong `.env`. Tạo secret riêng:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Không commit `.env` hoặc secret. Nếu cấu hình URI nhưng không kết nối được, server dừng. Khi có MongoDB, session lưu trong collection `sessions`; khi chưa có DB, MemoryStore chỉ dành cho thử khung local. Thiếu secret trong development sẽ dùng secret tạm thay đổi sau restart. Production bắt buộc MongoDB và secret, dùng HTTPS cho cookie Secure. Nếu triển khai sau reverse proxy, nhóm cần cấu hình trust proxy phù hợp hạ tầng trước khi bật login.

Cookie `freshmart.sid` chỉ giữ session ID, có HttpOnly, SameSite=Lax, hết hạn sau 1 giờ. Auth chưa triển khai. A cần xác thực mật khẩu hash, regenerate session khi login và destroy khi logout; không đưa mật khẩu vào cookie hoặc trả mật khẩu đã giải mã về Angular. B dùng `req.session.cart` cho giỏ khách và phối hợp A giữ giỏ qua regenerate/merge. Chi tiết trong `docs/team-guide.md`.

## Cấu trúc và phân công

```text
backend/
  src/
    app.js                 Middleware, static images, mount router
    server.js              Kết nối MongoDB, mở/đóng server
    config/                env, database, session
    middleware/            Xử lý lỗi; auth/role/validation sẽ bổ sung
    modules/
      auth/                A
      users/               A
      catalog/             A: routes, controller, model mẫu đọc MongoDB
      cart/                B
      vouchers/            B
      orders/              B
      inventory/           B
  public/images/           Vị trí ảnh static, chưa có API upload
  scripts/seed-catalog.js   Import categories/products từ frontend
  tests/                   Kiểm thử khung
  docs/                    Quy ước API, đối chiếu bài học, Postman collection
```

Luồng mẫu: route → controller → model → MongoDB. Khi checkout hoặc voucher phức tạp, thêm service nghiệp vụ trong module đó. Không bắt buộc mọi module phải có đủ các lớp ngay khi còn trống. Giữ một backend chung; mỗi người sửa module của mình.

## API đã có

| Method | URL | Kết quả |
|---|---|---|
| GET | `/` | Thông tin server |
| GET | `/api/health` | Trạng thái HTTP và khởi tạo DB |
| GET | `/api/products` | Mảng sản phẩm đang bán từ MongoDB |
| GET | `/api/products/:id` | Sản phẩm theo mã như `p-0053` |
| GET | `/api/products/slug/:slug` | Sản phẩm theo slug hiện có |
| GET | `/api/categories` | Mảng danh mục theo sortOrder |

Giữ tên trường Angular hiện có như `sale_price`, `image_url`, `category`, `active`. Seed dùng `_id` string bằng `id`, giữ các mã `p-...`; không ép mã demo thành ObjectId. Với dữ liệu mới, thống nhất tiếp quy tắc cấp ID trước khi làm POST. Seed chỉ thêm mã chưa có, không ghi đè giá/tồn kho đã sửa; không import users hoặc mật khẩu demo. Seed không tự chạy khi khởi động server; kiểm tra URI và tên DB trước khi chạy lệnh import.

Chưa có auth, admin CRUD, checkout, upload hoặc API nghiệp vụ khác. Frontend FreshMart hiện vẫn đọc JSON/localStorage cho đến khi team nối từng service.

## Nối Angular

`FRONTEND_ORIGIN` mặc định `http://localhost:4200`. Khi gọi trực tiếp backend, dùng `{ withCredentials: true }` cho các API session. Có thể thêm `src/proxy.conf.json` phía Angular và cấu hình `proxyConfig` cho `serve`, như bài LearnAngular; mẫu cho builder hiện tại:

```json
{
  "/api/**": { "target": "http://localhost:3000", "secure": false },
  "/images/**": { "target": "http://localhost:3000", "secure": false }
}
```

Frontend config chưa được sửa trong lần chỉnh khung này. Kiểm thử API trước bằng collection trong `docs`, sau đó nối HttpClient. CORS/proxy chỉ hỗ trợ kết nối; quyền truy cập vẫn phải kiểm tra trên backend.

## Kiểm tra bằng Postman

Import `docs/freshmart.postman_collection.json` vào Postman. Folder `Starter` chạy khi server chưa có DB; folder `Catalog - requires seeded MongoDB` cần cấu hình và seed DB trước. Có thể chạy folder Starter bằng CLI đã cài trên máy:

```bash
/Users/quynhlu/.local/bin/postman collection run docs/freshmart.postman_collection.json -i Starter --no-report-events
```
