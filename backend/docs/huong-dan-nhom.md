# Hướng dẫn cho cả nhóm (đọc trước khi code tiếp)

Cập nhật: 05/11/2026 · Người viết: Huy (leader)

## 1. Chuyện gì vừa thay đổi

- **Lịch sử Git đã được làm lại** (chỉ bỏ dòng ghi chú tự động trong commit, code giữ nguyên). Máy ai đang có repo cũ phải chạy một lần:
  ```
  git fetch
  git checkout lu
  git reset --hard origin/lu
  ```
  Có code chưa push thì copy ra chỗ khác trước khi chạy.
- **Nhánh làm việc chính là `lu`**. `lu` đã gồm giao diện mới của pa và backend phần A của Thơ. `main` để nộp bài, chưa dùng.
- **Database dùng chung trên MongoDB Atlas** (MongoDB chạy trên mạng). Cả nhóm nối vào cùng một database `freshmart`, dữ liệu sản phẩm, danh mục, voucher, admin đã nhập sẵn.

## 2. Phân công

| Người | Việc |
|---|---|
| Huy | Leader: database, ghép frontend với backend, duyệt Pull Request, deploy |
| Thơ | Backend phần A (đã xong): đăng nhập, phân quyền, hồ sơ, sản phẩm, danh mục |
| Đồng | Backend phần B: giỏ hàng, đặt đơn COD, đơn hàng, kho, voucher, dashboard |
| pa | Frontend: giao diện, nối các màn hình với API mới |

## 3. Cài đặt trên máy (làm một lần)

1. Lấy code: `git clone https://github.com/123456789Huy57/WEB2.git`, rồi `cd WEB2` và `git checkout lu`. Đã có repo thì làm bước reset ở mục 1.
2. Cần Node.js 22 trở lên (`node -v` để kiểm tra).
3. Trong thư mục `backend`: copy `.env.example` thành `.env`.
4. Mở `.env`, điền:
   - `MONGODB_URI=` chuỗi kết nối Huy gửi riêng cho bạn (mỗi người một tài khoản riêng).
   - `MONGODB_DB=freshmart`
   - `SESSION_SECRET=` kết quả của lệnh `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
5. Chạy trong `backend`:
   ```
   npm ci
   npm run check:db
   ```
   Thấy `KẾT NỐI OK` là được. **Không chạy các lệnh seed**, dữ liệu đã có sẵn.
6. Chạy web: Terminal 1 trong `backend` chạy `npm run dev`; Terminal 2 trong `frontend` chạy `npm install` rồi `npm start`, mở `http://localhost:4200`.

### Nếu `check:db` báo lỗi

| Thông báo | Cách xử lý |
|---|---|
| `MONGODB_URI đang trống` | File phải tên đúng `.env`, nằm trong `backend`, đã lưu |
| `querySrv ECONNREFUSED` | Mạng không tra được địa chỉ Atlas. Nhắn Huy xin chuỗi dạng `mongodb://...` (Legacy) |
| `bad auth` | Sai username hoặc mật khẩu trong chuỗi |
| `Server selection timed out` | Báo Huy kiểm tra Network Access trên Atlas |

## 4. Quy tắc làm việc

- **Không đưa `.env` hay chuỗi kết nối lên GitHub, nhóm chat chung hay ảnh chụp.** Chuỗi có mật khẩu database.
- Database là chung: sửa, xóa dữ liệu thì cả nhóm đều thấy. Muốn thử thoải mái thì đặt `MONGODB_DB=freshmart_<tên>` để dùng database riêng (khi đó tự chạy `npm run seed:catalog` và `npm run seed:vouchers`).
- Mỗi việc một nhánh tách từ `lu`: `git checkout lu`, `git pull`, `git checkout -b be-gio-hang` (backend) hoặc `fe-...` (frontend).
- Commit nhỏ, push nhánh của mình, mở Pull Request vào `lu`. Huy duyệt rồi gộp. Không push thẳng vào `lu`.
- Muốn đổi API, tên trường hay cấu trúc database thì báo cả nhóm trước, sửa luôn tài liệu tương ứng.

## 5. Tài liệu cần đọc

| File | Ai đọc | Nội dung |
|---|---|---|
| `backend/docs/backend-contract.md` | Đồng, pa | Chi tiết API, quy tắc giỏ, đơn, phí ship, trạng thái, kho |
| `backend/docs/backend-task-assignment.md` | Đồng | Thứ tự làm phần B, những gì dùng lại từ phần A |
| `backend/docs/database-schema.md` | Cả nhóm | Các collection, trường dữ liệu, index, quy tắc voucher |
| `frontend/README.md` | pa | Màn hình, chỗ nối API |

## 6. Việc tiếp theo

1. **Đồng:** bắt đầu từ giỏ hàng và báo giá (`backend-contract.md` mục 4), rồi đặt đơn COD.
2. **pa + Huy:** khi có API giỏ, chuyển `frontend/src/app/core/cart.service.ts` sang gọi API; tiếp theo là đơn hàng và voucher.
3. Mục tiêu gần nhất: chạy trọn luồng xem sản phẩm → đăng nhập → thêm giỏ → đặt đơn → admin xử lý đơn.
