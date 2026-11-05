# Bàn giao phần A FreshMart

Phần A theo bảng phân công đã hoàn thành cả backend và giao diện Angular. Phần B tiếp tục theo [hợp đồng backend](backend-contract.md). Tài liệu này liệt kê việc đã làm và cách kiểm tra, không gọi phần A là bản MVP.

## Đối chiếu các đầu việc A

| Thứ tự | Đầu việc | Kết quả bàn giao |
|---|---|---|
| 1 | Chốt schema, session và API với B | backend-contract.md; config/commerce.js; quy định phí ship, trạng thái, chống trùng và quyền stock |
| 2 | Backend, MongoDB, cấu hình và seed | Express/CommonJS/MongoClient, indexes, env example, seed catalog và tạo admin với password hash |
| 3 | Đăng ký, login/logout, session | API và Angular đăng nhập bằng email/phone; giữ giỏ guest qua regenerate, rememberMe 7 ngày, hủy session khi logout |
| 4 | Phân quyền | requireAuth/requireAdmin; role và isActive từ DB, CSRF, giới hạn login/recovery, hủy phiên cũ khi đổi mật khẩu/khóa tài khoản |
| 5 | Hồ sơ, địa chỉ và quản lý khách hàng | Sửa hồ sơ/địa chỉ mặc định, đổi mật khẩu, danh sách/tìm kiếm/chi tiết khách, khóa/mở từ admin |
| 6 | API catalog | Xem list/detail theo ID/slug, query lọc/sort/phân trang, tên danh mục và số lượng cập nhật theo dữ liệu hiện hành |
| 7 | CRUD admin | Màn hình sản phẩm và danh mục/danh mục con; thêm/sửa/ẩn, slug unique, dinh dưỡng/khối lượng/gallery, upload ảnh; không sửa stock qua catalog |
| 8 | Nối Angular | Auth/profile/products/categories/customers dùng API; dev proxy, cookie/CSRF, trạng thái chờ và thông báo lỗi |
| 9 | Kiểm thử và tài liệu | HTTP/session tests, integration MongoDB riêng, kiểm tra reset một lần/upload/quyền/stock, build Angular; Postman và README |

## Các màn hình A

- `/dang-nhap`: đăng ký, login, ghi nhớ đăng nhập, link quên mật khẩu.
- `/quen-mat-khau`: yêu cầu khôi phục; không tiết lộ tài khoản có tồn tại không.
- `/dat-lai-mat-khau?token=...`: đặt mật khẩu mới qua mã một lần, thời hạn 20 phút.
- `/tai-khoan`, mục Thông tin: hồ sơ, địa chỉ mặc định, đổi mật khẩu.
- `/admin/san-pham`: quản lý sản phẩm, ảnh/gallery, giá, thuộc tính và dinh dưỡng.
- `/admin/danh-muc`: quản lý danh mục và danh mục con; giữ mã để không phá liên kết sản phẩm.
- `/admin/khach-hang`: tìm, xem chi tiết, khóa/mở tài khoản customer.

## Chạy và kiểm tra

1. Cấu hình `.env` theo README, nhập catalog và tạo admin riêng.
2. Chạy backend bằng `npm run dev`, chạy frontend bằng `npm start`.
3. `npm test`: kiểm tra khung và các luật dùng chung.
4. `npm run test:integration`: kiểm tra phần A bằng database/thư mục thử riêng, tự xóa sau khi chạy.

Không có mật khẩu admin mặc định. Dữ liệu người dùng/sản phẩm không lấy localStorage hoặc users.json làm nguồn chuẩn. Sau khi bàn giao phần A, người B đã triển khai API giỏ, voucher, đơn và kho theo hợp đồng; frontend đã nối các luồng chính.

## Email khôi phục

Nhóm chưa có dịch vụ gửi email. Chức năng khôi phục đã có đầy đủ API/giao diện và kiểm thử với hộp thư local: `MAIL_TRANSPORT=outbox` lưu thư trong `.local-mail`, chỉ xem bằng `npm run mail:inbox` ở máy chạy backend. Giao diện nói rõ thư chưa gửi tới email thật. Thư/token không nằm trong Git hoặc API public.

Khi cần email thật, chuyển MAIL_TRANSPORT=smtp và điền MAIL_FROM/SMTP_HOST/SMTP_PORT/SMTP_SECURE/SMTP_USER/SMTP_PASSWORD trong .env. Mã gửi SMTP đã có; chưa thực hiện gửi email qua nhà cung cấp vì chưa có cấu hình của nhóm. Production không cho dùng outbox. Không lưu mật khẩu dịch vụ trong source code.

## Quyền dữ liệu bàn giao cho B

A cung cấp middleware, session, catalog read service và quy tắc thương mại dùng chung. B sở hữu giỏ, checkout, đơn, voucher, kho và báo cáo. Khi B hoàn thành, nối/bật lại các màn hình tương ứng; không đổi session contract hoặc dùng catalog PATCH để cập nhật stock. B không cần làm lại các module A.
