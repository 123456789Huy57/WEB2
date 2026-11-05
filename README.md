# FreshMart · Web2

Chợ thực phẩm online: mua hàng, đặt đơn (COD hoặc VNPay), Meal Planner gợi ý món từ nguyên liệu bạn có, tab Cộng đồng, đánh giá sản phẩm và khu quản trị.

| Thư mục | Là gì | Chạy ở |
|---|---|---|
| `frontend/` | Giao diện Angular | http://localhost:4200 |
| `backend/` | API Node.js + Express | http://localhost:3000 |
| Database | MongoDB Atlas (dùng chung cả nhóm) | trên mạng |
| Ảnh | Cloudinary | trên mạng |

## Chạy trên máy (lần đầu)

Cần: **Node.js 22+** (`node -v` để kiểm tra) và chuỗi `MONGODB_URI` leader gửi riêng.

**1. Lấy code**
```bash
git clone https://github.com/123456789Huy57/WEB2.git
cd WEB2
git checkout huy-phan-b
```
Đã có repo rồi thì chỉ cần `git fetch`, `git checkout huy-phan-b`, `git pull`.

**2. Tạo file `backend/.env`**

Copy `backend/.env.example` thành `backend/.env`, điền 2 dòng:
```
MONGODB_URI=<chuỗi leader gửi>
SESSION_SECRET=<kết quả lệnh bên dưới>
```
Tạo `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**3. Chạy backend** (Terminal 1, để chạy luôn)
```bash
cd backend
npm ci
npm run check:db   # phải thấy: KẾT NỐI OK
npm run dev
```

**4. Chạy frontend** (Terminal 2)
```bash
cd frontend
npm install
npm start
```
Mở http://localhost:4200 là xong.

## Gặp lỗi

| Thông báo | Cách sửa |
|---|---|
| `MONGODB_URI đang trống` | File phải tên đúng `.env`, nằm trong `backend`, đã lưu |
| `querySrv ECONNREFUSED` | Xin leader chuỗi dạng `mongodb://...` (Legacy) |
| `bad auth` | Sai tên hoặc mật khẩu trong chuỗi kết nối |
| `Cổng 3000 đang được dùng` | Tắt Terminal cũ đang chạy backend (Ctrl + C) rồi chạy lại |

## Lưu ý

- **Không** đưa `.env` hay chuỗi kết nối lên GitHub hoặc nhóm chat chung.
- Database dùng chung: thêm, sửa, xóa dữ liệu thì cả nhóm đều thấy.
- Các lệnh `db:setup`, `seed:*`, `images:*` chỉ leader chạy.
- Thanh toán VNPay đang dùng **cổng giả lập** (bấm "Thanh toán thành công" là xong), không trừ tiền thật.

## Làm việc nhóm

1. `git pull` trước khi bắt đầu.
2. Mỗi việc một nhánh: `git checkout -b fe-ten-viec` hoặc `be-ten-viec`.
3. Commit nhỏ, ghi rõ đã làm gì, rồi `git push -u origin ten-nhanh`.
4. Mở Pull Request, leader duyệt rồi gộp.

## Tài liệu

- [Hướng dẫn cho nhóm](backend/docs/huong-dan-nhom.md): phân công, quy tắc
- [Danh sách API](backend/docs/part-b-handoff.md)
- [Thiết kế database](backend/docs/database-schema.md) và [ERD](backend/docs/erd.png)
- [Chi tiết backend](backend/README.md), [chi tiết frontend](frontend/README.md)
