# Hướng dẫn chia việc backend

## Đối chiếu môn học

Đã đọc nội dung văn bản của 8 bộ slide được cung cấp (702 slide) và đối chiếu code thực hành trong LearnAngular.

| Chương | Nội dung môn học | Áp dụng vào FreshMart |
|---|---|---|
| I | Angular, SPA, module/component/service, CLI | Frontend Angular riêng, backend chỉ cung cấp API |
| II | Binding, directives, tương tác component | UI thuộc Angular, không dựng HTML giao diện trong Express |
| III | Service, DI, HttpClient, Observable, xử lý lỗi | Team frontend gọi API qua service và xử lý response/lỗi |
| IV | Routing, ID/slug, query params, lazy loading, guards | API chi tiết theo ID/slug; backend tự kiểm tra quyền, guard phục vụ điều hướng |
| V | Template-driven/Reactive Forms, validation | Nhận JSON/form-urlencoded; phải kiểm tra lại input khi triển khai API ghi |
| VI | MVC, Node/Express, CRUD, Morgan, Nodemon, ảnh static, Postman | CommonJS, route/controller/model, request log, dev tự restart, public/images và collection mẫu |
| VII | MongoDB/Atlas, MongoClient, collection, CRUD | Dùng native mongodb driver, getDatabase().collection(...), API đọc catalog và seed |
| VIII | Cookie, express-session, req.session, giỏ tạm và đơn bền | cookie-parser, session middleware và nơi A/B triển khai login/cart |

Nguồn bài thực hành đã đối chiếu: `LearnAngular/my-server/index.js`, `my-server-mongodb/index.js`, `auth.js`, `slug.js`, `similarity.js`; các Angular service, app module/routing, proxy, forms, profile và cart component. Khung dùng cách viết giống bài học nhưng chia module để hai người làm song song.

Mongoose xuất hiện trong danh sách thư viện của slide VII, nhưng truy vấn thực hành dùng MongoClient. Vì vậy khung chỉ dùng native driver. Không cài thêm mongoclient hoặc cả hai lớp truy cập DB. `express.json`/`express.urlencoded` đảm nhiệm phần parse body của bài body-parser. Chưa cài upload middleware vì chưa có API upload; thư mục ảnh static đã sẵn sàng.

`connect-mongo` bổ sung để session dùng chung MongoDB và còn sau khi restart; đây là phần mở rộng từ ví dụ RAM trên lớp. Trong local chưa cấu hình DB, session tạm giống ví dụ trên lớp. Không sao chép cách lưu mật khẩu có thể giải mã trong cookie hoặc trả mật khẩu về Angular từ bài thực hành. A sẽ dùng password hash và cơ chế session.

## Ranh giới công việc

- A: auth, users, catalog; bổ sung hash password, login/logout, profile và kiểm tra customer/admin.
- B: cart, vouchers, orders, inventory; giỏ khách trong req.session.cart chỉ chứa productId và quantity, không tin giá client.
- Cùng thống nhất: ID, status `preparing` như Angular hiện tại, phí ship, guest checkout, giá/stock và response.
- API admin chưa mở. Khi bổ sung POST/PUT/DELETE phải gắn auth, role, ownership và validation.
- Không coi việc có cookie/session middleware là đã hoàn thành đăng nhập/phân quyền.

Mỗi module có routes, controller, model khi cần. Controller nhận req/res; model gọi collection. Service bổ sung cho nghiệp vụ nhiều bước như checkout; các truy vấn cùng giao dịch phải nhận chung MongoDB session.

## Cookie và giỏ hàng

A quyết định dữ liệu định danh session sau login; B dùng cùng định danh đó thay vì nhận userId tùy ý từ body. Trước regenerate phải giữ giỏ guest để merge/khôi phục sau login, tránh mất giỏ. Logout hủy session và xóa cookie đúng tên/path. Nếu cần giỏ tài khoản còn sau logout, B lưu cart tài khoản bền trong MongoDB.

Trước khi thêm API ghi dùng cookie, nhóm bổ sung kiểm tra Origin/CSRF theo kiến trúc triển khai. CORS không thay thế xác thực hoặc CSRF protection. Không có write API nghiệp vụ công khai trong khung hiện tại.

## Dữ liệu và API

Seed chỉ nhập products/categories bằng mã string hiện có, không đổi field names hoặc import mật khẩu. Product model không trả _id nội bộ. Sau này nếu dùng ObjectId cho order/user mới, API vẫn cần id string nhất quán và quan hệ productId giữ cùng kiểu mã đã chọn.

API đọc mẫu trả mảng hoặc object JSON cho HttpClient. Lỗi có `{ error: { code, message } }`. Chưa có pagination/filter nâng cao. Không thay API đang đọc JSON của Angular cho đến khi frontend được nối theo từng luồng.

## Mốc tiếp theo

1. A hoàn thiện auth/session, role, profile và admin catalog; B dùng contract mẫu để bắt đầu cart/order.
2. Nối một luồng Angular: catalog → login → cart → đặt COD → xem đơn.
3. Kiểm tra server tính tiền, chống đặt trùng, kho không âm, hủy hoàn kho đúng một lần. Transaction nhiều document cần môi trường MongoDB hỗ trợ.
4. Thêm voucher và Meal Planner theo phạm vi đã chốt; AI API và loyalty để sau nếu thiếu thời gian.
