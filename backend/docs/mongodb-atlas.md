# MongoDB Atlas dùng chung

Checkout cần transaction, mà transaction chỉ chạy trên replica set. Atlas (kể cả gói Free M0) luôn là replica set, nên cả nhóm dùng chung một cluster Atlas thay cho MongoDB cài trên máy.

## Leader tạo một lần

1. Vào https://cloud.mongodb.com, đăng ký và tạo project `FreshMart`.
2. **Create cluster** → chọn **M0 Free**, vùng Singapore. Đặt tên `freshmart`.
3. **Database Access** → Add user, cấp quyền `readWrite` trên database `freshmart`. Mỗi thành viên một user riêng để thu hồi được khi cần.
4. **Network Access** → Add IP `0.0.0.0/0` (cho phép mọi nơi, chấp nhận được với đồ án; Render cũng cần).
5. **Connect → Drivers** → copy chuỗi `mongodb+srv://...`.
6. Gửi chuỗi kết nối cho từng người **qua tin nhắn riêng**. Không đưa vào Git, README hay ảnh chụp.

## Mỗi thành viên

Trong `backend/.env`:

```
MONGODB_URI=mongodb+srv://<user>:<mật khẩu>@freshmart.xxxxx.mongodb.net/
MONGODB_DB=freshmart
SESSION_SECRET=<tự tạo, mỗi máy một chuỗi>
```

Lần đầu (chỉ một người chạy là đủ, chạy lại cũng không ghi đè):

```bash
npm run seed:catalog
npm run seed:vouchers
npm run seed:admin
```

Kiểm tra: `npm run dev` rồi mở `http://localhost:3000/api/products`.

## Lưu ý

- Database chung: dữ liệu một người sửa thì cả nhóm thấy. Muốn thử phá thoải mái, đặt `MONGODB_DB=freshmart_<tên>` để dùng database riêng trên cùng cluster.
- Test tích hợp đặt `MONGODB_TEST_URI` tới Atlas; test tự tạo và xóa database riêng.
