# Deploy FreshMart

```
Trình duyệt ──► Vercel (Angular, tên miền của nhóm)
                  │  /api/*, /images/*  (chuyển tiếp, người dùng chỉ thấy một tên miền)
                  ▼
                Render (Express, Singapore) ──► MongoDB Atlas (Singapore)
Ảnh sản phẩm: Cloudinary (trình duyệt tải thẳng)     Thanh toán: VNPay sandbox hoặc cổng giả lập
```

Vì sao chuyển tiếp `/api` qua Vercel: đăng nhập dùng cookie session `HttpOnly` + CSRF. Frontend và backend chung một tên miền thì cookie là cookie của chính trang, không bị trình duyệt chặn như cookie bên thứ ba.

Chỉ **leader** làm các bước dưới. Không đưa chuỗi kết nối, mật khẩu, khóa API vào Git hay ảnh chụp.

## 0. Chuẩn bị (một lần)

1. Code đã ở nhánh `main` và `npm run test:b` qua hết.
2. Cập nhật luật kiểm tra trên Atlas: `cd backend` rồi `npm run db:setup` (không xóa dữ liệu).
3. Atlas → **Network Access** có `0.0.0.0/0` (Render không có IP cố định).
4. Atlas → **Database Access**: tạo user riêng cho server, ví dụ `render`, quyền `readWrite` trên `freshmart`. Lấy chuỗi `mongodb+srv://render:<mật khẩu>@...`.

## 1. Backend lên Render

1. Đăng nhập https://render.com bằng GitHub → **New → Blueprint** → chọn repo `WEB2`. Render đọc `render.yaml` ở gốc repo và tạo service `freshmart-api` (vùng Singapore, gói Free).
2. Render hỏi các biến bí mật, điền:

| Biến | Giá trị |
|---|---|
| `MONGODB_URI` | chuỗi Atlas của user `render` |
| `FRONTEND_ORIGIN` | tên miền frontend, ví dụ `https://freshmart-web2.vercel.app` (chưa có thì điền tạm, sửa ở bước 3) |
| `BACKEND_URL` | **giống `FRONTEND_ORIGIN`** (cổng thanh toán trả khách về `/api/...` qua Vercel) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER` | như trong `backend/.env` của leader |
| `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Gmail + **mật khẩu ứng dụng** (Google Account → Bảo mật → Mật khẩu ứng dụng). Bỏ trống thì "Quên mật khẩu" báo chưa cấu hình, phần còn lại vẫn chạy |

`SESSION_SECRET` Render tự sinh. Muốn VNPay sandbox thật: đổi `PAYMENT_PROVIDER` thành `vnpay`, thêm `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`.

3. Chờ deploy xong, mở `https://freshmart-api.onrender.com/api/health` → thấy `"status":"ok"` và `"database":"connected"`.
   Nếu Render đặt tên khác (tên đã có người dùng), sửa hai dòng `destination` trong `frontend/vercel.json` cho đúng rồi commit.

## 2. Frontend lên Vercel

1. Đăng nhập https://vercel.com bằng GitHub → **Add New → Project** → chọn repo `WEB2`.
2. **Root Directory**: `frontend`. Framework: Angular (Vercel tự nhận). Build và thư mục đầu ra đã khai báo trong `frontend/vercel.json`, không cần sửa.
3. **Deploy**. Xong sẽ có địa chỉ dạng `https://<tên-project>.vercel.app`.
4. Quay lại Render → Environment: đặt `FRONTEND_ORIGIN` và `BACKEND_URL` đúng bằng địa chỉ này (không có `/` ở cuối) → **Save, rebuild and deploy**.

## 3. Tên miền riêng (tùy chọn)

1. Đăng ký `.id.vn` tại tenten.vn (miễn phí cho công dân 18–23 tuổi, xác minh eKYC).
2. Vercel → Project → **Settings → Domains** → thêm tên miền. Vercel hiện bản ghi DNS cần tạo (A hoặc CNAME).
3. Tenten → Quản lý tên miền → **DNS** → tạo đúng các bản ghi đó. Chờ vài phút đến vài giờ, Vercel tự cấp HTTPS.
4. Render: đổi `FRONTEND_ORIGIN` và `BACKEND_URL` sang tên miền mới.

## 4. Kiểm tra sau khi deploy

- Trang chủ, danh mục, trang sản phẩm mở được; ảnh hiện.
- Đăng ký, đăng nhập, tải lại trang vẫn còn đăng nhập (cookie hoạt động).
- Thêm giỏ, đặt đơn COD; đặt đơn VNPay → cổng (giả lập) → quay về trang kết quả "đã thanh toán".
- Admin: đổi trạng thái đơn, xem bảng luật "Thường được mua cùng" ở Tổng quan.
- Chạy Lighthouse (Chrome DevTools → Lighthouse, chế độ Mobile) trên trang chủ.

## Lưu ý gói miễn phí

- Render Free tắt máy chủ sau 15 phút không có truy cập; lượt đầu sau đó chờ khoảng nửa phút đến một phút. Trước buổi demo mở `/api/health` để đánh thức. Muốn luôn thức: tạo lịch gọi `https://<tên miền>/api/health` mỗi 10 phút trên cron-job.org hoặc UptimeRobot.
- Ảnh upload qua admin lưu trên Cloudinary (ổ đĩa Render bị xóa mỗi lần deploy, không dùng để lưu ảnh).
- Push lên `main` là Render và Vercel tự deploy lại.
