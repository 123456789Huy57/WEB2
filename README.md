# FreshMart

Website đi chợ online kèm **Meal Planner**: chọn những nguyên liệu đang có trong bếp, FreshMart gợi ý món nấu được và thêm phần còn thiếu vào giỏ theo đúng quy cách đóng gói ngoài cửa hàng.

Đồ án môn Web2, Nhóm 1, Trường Đại học Kinh tế - Luật (ĐHQG-HCM).

- Website: https://web-2-two-lyart.vercel.app
- Trang quản trị: https://web-2-two-lyart.vercel.app/admin
- Kiểm tra API: https://web-2-two-lyart.vercel.app/api/health

## Tính năng

**Khách hàng**
- Xem 227 sản phẩm trong 13 quầy, tìm kiếm không cần gõ dấu, lọc theo giá và loại, so sánh sản phẩm.
- Giỏ hàng cập nhật ngay, voucher, miễn phí giao cho đơn từ 300.000 đ.
- Đặt đơn với khung giờ giao hàng, thanh toán bằng tiền mặt (COD), VNPay hoặc chuyển khoản VietQR tự xác nhận.
- Theo dõi, hủy và mua lại đơn hàng; tra cứu đơn bằng mã.
- Meal Planner: 66 công thức, chấm điểm theo nguyên liệu đang có, quy đổi gram sang gói hàng thật, chỉnh theo số người ăn.
- Cộng đồng: đăng bài, bình luận, thả cảm xúc, bình chọn, xem món được nấu nhiều nhất trong ngày.
- Đánh giá sản phẩm (chỉ khi đã nhận hàng), gợi ý "thường được mua cùng".

**Quản trị**
- Bảng tổng quan doanh thu, đơn hàng, sản phẩm bán chạy, sắp hết hàng và luật mua kèm.
- Quản lý sản phẩm, danh mục, tồn kho, đơn hàng, voucher, khách hàng, đánh giá và bài viết cộng đồng.
- Xác nhận chuyển khoản bằng tay, theo dõi các khoản cần hoàn tiền, rà soát ảnh lỗi.

## Công nghệ

| Phần | Công nghệ |
|---|---|
| Frontend | Angular 20, TypeScript, standalone component, signals |
| Backend | Node.js 22, Express 5 |
| Database | MongoDB Atlas, MongoDB Node.js driver (không dùng Mongoose), `$jsonSchema` |
| Đăng nhập | Session phía server, cookie `HttpOnly`, CSRF token, bcrypt |
| Thanh toán | VNPay (sandbox), VietQR + SePay webhook |
| Hạ tầng | Vercel (frontend), Render (backend), Cloudinary (ảnh) |
| Kiểm thử | Node.js test runner: unit test và integration test |

## Kiến trúc

```
Trình duyệt
    │
    ▼
Vercel ── Angular (giao diện)
    │   /api/*  được chuyển tiếp nên frontend và backend dùng chung một tên miền
    ▼
Render ── Express API ──► MongoDB Atlas
              │
              ├──► VNPay, SePay (thanh toán)
              ├──► Cloudinary (ảnh)
              └──► SMTP (email quên mật khẩu, nhận ưu đãi)
```

## Cấu trúc thư mục

```
WEB2/
├── frontend/              Ứng dụng Angular
│   ├── src/app/pages/     Trang cho khách (trang chủ, sản phẩm, giỏ, thanh toán, Meal Planner...)
│   ├── src/app/admin/     Trang quản trị
│   ├── src/app/core/      Service, guard, interceptor, kiểu dữ liệu dùng chung
│   ├── src/app/shared/    Component dùng lại (thẻ sản phẩm, hộp thoại, pipe...)
│   └── public/data/       Dữ liệu mẫu để khởi tạo database
├── backend/               API Express
│   ├── src/modules/       Mỗi nghiệp vụ một thư mục: routes, controller, service
│   ├── src/middleware/    Đăng nhập, phân quyền, CSRF, ghi log, xử lý lỗi
│   ├── scripts/           Khởi tạo và đồng bộ dữ liệu
│   └── tests/             Unit test và integration test
├── docs/                  Tài liệu API, database, triển khai, thiết kế
└── render.yaml            Cấu hình triển khai backend trên Render
```

## Chạy trên máy

**Cần có:** Node.js 22 trở lên và một chuỗi kết nối MongoDB (Atlas hoặc MongoDB chạy ở máy, phải là replica set vì đặt đơn dùng transaction).

**1. Lấy code**

```bash
git clone https://github.com/123456789Huy57/WEB2.git
cd WEB2
```

**2. Cấu hình backend**

Sao chép `backend/.env.example` thành `backend/.env` rồi điền tối thiểu hai biến:

```
MONGODB_URI=<chuỗi kết nối MongoDB>
SESSION_SECRET=<chuỗi ngẫu nhiên>
```

Tạo `SESSION_SECRET` bằng lệnh:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Các biến còn lại (VNPay, SePay, Cloudinary, SMTP) có thể để trống. Khi đó web dùng cổng thanh toán giả lập, lưu ảnh ở máy và ghi email vào hộp thư thử thay vì gửi thật.

**3. Chạy backend** (cửa sổ terminal thứ nhất)

```bash
cd backend
npm ci
npm run check:db     # kiểm tra kết nối database
npm run db:setup     # chỉ cần khi database còn trống
npm run dev          # http://localhost:3000
```

**4. Chạy frontend** (cửa sổ terminal thứ hai)

```bash
cd frontend
npm install
npm start            # http://localhost:4200
```

**5. Tạo tài khoản quản trị** (tùy chọn)

Điền `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PHONE`, `DEV_ADMIN_PASSWORD` trong `backend/.env` rồi chạy `npm run seed:admin` trong thư mục `backend`. Tài khoản khách thì tự đăng ký trên giao diện.

## Lệnh thường dùng

Chạy trong thư mục `backend`:

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy API, tự khởi động lại khi sửa code |
| `npm start` | Chạy API ở chế độ production |
| `npm test` | Unit test, không cần database |
| `npm run test:integration` | Integration test phần tài khoản và sản phẩm |
| `npm run test:b` | Integration test giỏ, đơn, thanh toán, kho, voucher |
| `npm run check:db` | Kiểm tra kết nối database và in lý do nếu lỗi |
| `npm run db:setup` | Tạo collection, luật kiểm tra, index và dữ liệu mẫu còn thiếu. Chạy lại không mất dữ liệu |
| `npm run db:sync` | Cập nhật nội dung sản phẩm và công thức, không đụng tới giá, tồn kho, đơn hàng |
| `npm run audit:data` | Rà dữ liệu trước khi demo: ảnh, tồn kho, voucher, nguyên liệu Meal Planner |
| `npm run seed:admin` | Tạo tài khoản quản trị từ thông tin trong `.env` |
| `npm run mail:inbox` | Xem email thử khi chưa cấu hình SMTP |

Integration test tự tạo một database tạm và xóa sau khi chạy, không ảnh hưởng dữ liệu đang dùng.

Chạy trong thư mục `frontend`: `npm start` để chạy giao diện, `npm run build` để đóng gói bản production.

## Lỗi thường gặp

| Thông báo | Cách sửa |
|---|---|
| `MONGODB_URI đang trống` | Kiểm tra file tên đúng là `.env`, nằm trong thư mục `backend` và đã lưu |
| `querySrv ECONNREFUSED` | Mạng chặn bản ghi DNS SRV. Dùng chuỗi kết nối dạng `mongodb://...` (mục Legacy trên Atlas) |
| `bad auth` | Sai tên đăng nhập hoặc mật khẩu trong chuỗi kết nối |
| `Cổng 3000 đang được dùng` | Tắt terminal backend cũ (Ctrl + C) rồi chạy lại |

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/api.md](docs/api.md) | Danh sách API, quy ước và quy tắc nghiệp vụ |
| [docs/database.md](docs/database.md) | 19 collection, thuộc tính, quan hệ, [ERD](docs/erd.png) |
| [docs/deployment.md](docs/deployment.md) | Triển khai lên Vercel, Render, MongoDB Atlas |
| [docs/design-system.md](docs/design-system.md) | Màu, chữ, khoảng cách và quy tắc giao diện |
| [backend/README.md](backend/README.md) | Cấu trúc và quy ước code backend |
| [frontend/README.md](frontend/README.md) | Cấu trúc và quy ước code frontend |

## Nhóm thực hiện

| Thành viên | Phụ trách chính |
|---|---|
| Nguyễn Quang Huy (nhóm trưởng) | Kế hoạch, backend giỏ hàng, đơn hàng, thanh toán, BPMN, triển khai |
| Vũ Đại Đồng | ERD, dữ liệu, backend phần dữ liệu |
| Hoàng Phương Anh | Thiết kế UI/UX, frontend, use case, test case |
| Bùi Lê Hạnh Nguyên | Thiết kế UI/UX, frontend, slide |
| Nguyễn Lê Quỳnh Thơ | Sitemap, frontend Meal Planner, backend tài khoản, sản phẩm, cộng đồng |
