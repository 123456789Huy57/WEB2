# Hợp đồng backend FreshMart v1

Trạng thái: đã chốt để A và B triển khai thống nhất. API phần A và phần B đều đã có mã nguồn và kiểm thử (xem [bàn giao phần B](part-b-handoff.md)). Nếu cần đổi hợp đồng, cập nhật tài liệu và cả hai bên gọi API trong cùng một thay đổi.

## 1. Nền tảng và định dạng

- Một Express backend, CommonJS, MongoDB native driver. Base URL local `http://localhost:3000/api`.
- Mọi ID qua API là string. Product/category hiện có giữ mã demo; bản ghi mới dùng `p-UUID`, `c-UUID`, `u-UUID`, `ord-UUID`. `_id` nội bộ cùng giá trị với `id`; không ép mã `p-0053` thành ObjectId.
- Tiền VND là số nguyên. Giá và tổng tiền lấy từ server. Thời gian lưu ISO 8601 UTC; giao diện hiển thị giờ Việt Nam.
- Body JSON, response object/mảng JSON. Không trả passwordHash, authVersion hoặc `_id` nội bộ.
- Lỗi: `{ "error": { "code": "...", "message": "...", "details": [] } }`; details tùy lỗi. HTTP 400 input sai, 401 cần login, 403 quyền/CSRF, 404 không có/không thuộc quyền xem, 409 xung đột, 429 quá nhiều lần đăng nhập, 503 chưa có DB.
- GET sản phẩm/danh mục mặc định trả mảng để tương thích Angular. Khi có `page` hoặc `pageSize`, GET sản phẩm trả `{items,page,pageSize,total}`. User admin luôn trả dạng phân trang. Page bắt đầu từ 1, pageSize mặc định 20, tối đa 100.

## 2. Session và CSRF do A cung cấp

Browser chỉ giữ cookie `freshmart.sid` (HttpOnly, SameSite=Lax, Path=/, Secure khi HTTPS production). Thời hạn thường 1 giờ, rememberMe 7 ngày. Dữ liệu lưu server trong collection sessions:

```json
{
  "userId": "u-UUID",
  "authVersion": 0,
  "csrfToken": "random-token",
  "cart": [{ "productId": "p-0053", "quantity": 0.5 }]
}
```

`cookie` là metadata do express-session quản lý. Với guest, chưa có userId/authVersion; cart chưa có thì đọc như `[]`. Không tự lưu role, giá, password hay dữ liệu sản phẩm vào session. Middleware đọc user còn hoạt động và role từ DB trên mỗi request cần quyền. B dùng `requireAuth` và `requireAdmin` ở `src/middleware/auth.js`; sau requireAuth có `req.user.id`, `req.user.role` và hồ sơ an toàn.

**MVP chốt giỏ trong session cho cả guest và người đăng nhập.** Login/register tạo lại session ID và giữ giỏ guest; chuyển sang tài khoản khác thì xóa giỏ cũ. Logout hủy session và giỏ. Chưa có giỏ tài khoản đồng bộ nhiều thiết bị hoặc giữ qua logout; phần đó để sau, không triển khai merge cart collection riêng trong MVP.

Trình tự gọi API:

1. `GET /auth/session` nhận `{user: null|User, csrfToken}` và cookie. Endpoint này tạo CSRF token cả cho guest.
2. Mọi POST/PATCH/PUT/DELETE gửi cookie và header `X-CSRF-Token` nhận ở bước 1. Angular dùng withCredentials; interceptor đã có.
3. Login/register trả `{user,csrfToken}` mới. Luôn cập nhật token sau khi login/register; token cũ hết hiệu lực.
4. Logout 204, cookie bị xóa. Muốn thao tác ghi tiếp, gọi lại GET /auth/session. Lỗi CSRF không tự retry POST đặt đơn.

Origin khi browser gửi request phải khớp FRONTEND_ORIGIN. Postman/CLI không có Origin vẫn cần cookie + CSRF token. Middleware CSRF đã mount toàn bộ `/api` cho các method ghi, áp dụng luôn cho router B sau này.

## 3. API phần A đã triển khai

| Method | Endpoint | Body/query | Kết quả |
|---|---|---|---|
| GET | `/auth/session` | Không | `{user,csrfToken}`; user null nếu guest |
| POST | `/auth/register` | fullName, email, phone, password | 201 `{user,csrfToken}`; tự đăng nhập customer |
| POST | `/auth/login` | identifier (email/phone) hoặc email, password, rememberMe? boolean | 200 `{user,csrfToken}` |
| POST | `/auth/logout` | `{}` | 204, hủy session |
| GET | `/users/me` | Cần login | User hiện tại |
| PATCH | `/users/me` | Một hoặc nhiều: fullName, phone, address | User đã cập nhật |
| PATCH | `/users/me/password` | currentPassword, newPassword | 204; mọi session phải login lại |
| GET | `/admin/users` | q?, page?, pageSize? | Phân trang User, chỉ admin |
| GET | `/admin/users/:id` | Chỉ admin | User |
| PATCH | `/admin/users/:id/status` | isActive boolean | User; không khóa admin qua API này |
| GET | `/products` | q?, category?, minPrice?, maxPrice?, sort?, page?, pageSize? | Mảng hoặc phân trang sản phẩm đang bán |
| GET | `/products/:id` | Product ID | Product, hoặc 404 |
| GET | `/products/slug/:slug` | Slug | Product, hoặc 404 |
| GET | `/categories` | Không | Mảng danh mục đang hoạt động |
| GET | `/admin/products` | Query như public | Kể cả sản phẩm ẩn, chỉ admin |
| POST | `/admin/products` | Product fields bên dưới | 201 Product mới, stock=0 |
| PATCH | `/admin/products/:id` | Một phần Product fields | Product đã sửa, giữ nguyên stock/counters |
| DELETE | `/admin/products/:id` | Không | Product với active=false, không xóa vật lý |
| GET | `/admin/categories` | Không | Mọi danh mục, chỉ admin |
| POST | `/admin/categories` | Category fields | 201 Category |
| PATCH | `/admin/categories/:id` | Một phần Category fields | Category |
| DELETE | `/admin/categories/:id` | Không | Category active=false; 409 nếu còn sản phẩm đang bán |

User có id, fullName, email, phone, address, role (`customer|admin`), isActive, createdAt, updatedAt. Email chuẩn hóa lowercase, phone 10 số bắt đầu bằng 0; email/phone unique. Password ít nhất 8 ký tự, tối đa 72 byte UTF-8; không trim password. Chỉ seed script có quyền tạo admin; body role/isActive/passwordHash bị từ chối khi đăng ký/cập nhật hồ sơ. Đã có khôi phục qua email một lần theo mục bổ sung dưới đây; OTP qua SMS và social login không thuộc phần A của bảng phân công.

Product giữ tên trường frontend: name, slug, brand, category, subcategory, description, price, sale_price, unit, image_url, gallery, origin, badges, nutrition, netWeightGram, unitWeightGram, sellUnit, tags, active. Tạo mới bắt buộc name, category và price dương; unit mặc định Kg; sale_price mặc định 0 và nếu có phải nhỏ hơn price. ID do server cấp. Không gửi id, stock, sold_count, rating, review_count, categoryName hoặc img vào API ghi. categoryName/subcategoryName do server suy ra. Khi có hàng tồn, không được đổi đơn vị bán. PATCH cập nhật một phần, không dùng PUT thay toàn bộ sản phẩm. Ảnh dùng URL HTTP(S) hoặc đường dẫn bắt đầu `/`; Upload dùng POST /admin/uploads theo mục bổ sung.

Category ghi name, slug, description, sortOrder, active, subcategories (`[{id,name}]`). ID do server cấp. Giữ các mã cũ để không phá recipe/product mapping. Không gỡ danh mục con đang được sản phẩm sử dụng.

Product query sort nhận `name`, `price_asc`, `price_desc`, `newest`; lọc/sort giá trên trường price. Giá bán ở checkout dùng sale_price hợp lệ nếu có.

## 4. Giỏ hàng B cần triển khai

| Method | Endpoint | Request | Hành vi |
|---|---|---|---|
| GET | `/cart` | Không | Đọc giỏ session, không cần login |
| POST | `/cart/items` | `{productId,quantity}` | Cộng quantity vào dòng có sẵn; tạo dòng nếu chưa có |
| PATCH | `/cart/items/:productId` | `{quantity}` | Đặt số lượng tuyệt đối cho dòng đã có; không có dòng trả 404 |
| DELETE | `/cart/items/:productId` | Không | Xóa dòng; gọi lại vẫn trả giỏ hiện tại |
| DELETE | `/cart` | Không | Xóa giỏ; gọi lại vẫn trả giỏ rỗng |
| POST | `/checkout/quote` | `{voucherCode?:string}` | Đọc giỏ và tính lại tạm tính; không giữ kho hoặc tiêu lượt voucher |

Quantity phải là số dương: hàng Kg theo nấc 0.5, hàng khác số nguyên theo nấc 1. Dùng `quantityStep(product)` trong `config/commerce.js`. Không clamp im lặng: vượt kho trả 409 OUT_OF_STOCK kèm available/requested. Sản phẩm không còn bán trả 409 PRODUCT_UNAVAILABLE. Gộp dòng theo productId, tối đa 100 dòng; quantity phải hữu hạn và không vượt kho thực. Không lưu thông tin có thẩm quyền do client cung cấp ngoài productId/quantity.

Response giỏ/quote:

```json
{
  "items": [{
    "productId": "p-0053", "quantity": 0.5,
    "product": { "id": "p-0053", "name": "Tên sản phẩm", "unit": "Kg", "image_url": "/img/example.jpg", "stock": 10 },
    "unitPrice": 50000, "lineTotal": 25000
  }],
  "subtotal": 25000, "shippingFee": 20000,
  "productDiscount": 0, "shippingDiscount": 0, "discount": 0,
  "total": 45000, "voucherCode": null
}
```

Dòng không còn khả dụng trong GET giỏ trả `issues: [{productId,code,available,requested}]` để khách sửa; quote/checkout phải từ chối giỏ có lỗi, không âm thầm bỏ sản phẩm. Quote có thể dùng cho guest nhưng voucher yêu cầu tài khoản phải trả AUTH_REQUIRED nếu chưa login. Voucher code chỉ truyền qua quote/đặt đơn, không lưu trong session v1.

## 5. Phí ship và tiền đơn đã chốt

- unitPrice = sale_price nếu 0 < sale_price < price, ngược lại price. Dùng `salePrice(product)`.
- lineTotal = Math.round(unitPrice * quantity); subtotal = tổng lineTotal.
- Giỏ rỗng phí 0, không được đặt đơn rỗng.
- subtotal từ 300000đ trở lên: phí ship 0; còn lại 20000đ. Ngưỡng xét trước voucher, không thay đổi khi giảm tiền hàng.
- Một voucher/đơn. Voucher product giảm tối đa subtotal; voucher shipping giảm tối đa shippingFee. Giảm phần trăm làm tròn Math.round rồi giới hạn theo maxDiscountValue nếu có.
- discount = productDiscount + shippingDiscount; total = subtotal - productDiscount + shippingFee - shippingDiscount. Tất cả giá trị không âm, VND nguyên.
- Checkout tính lại từ DB; quote không đảm bảo giá/kho giữ nguyên.

## 6. Đơn hàng B cần triển khai

MVP **bắt buộc đăng nhập và chỉ COD**. Không có guest checkout/tra cứu đơn công khai bằng mã + phone. Bank/MoMo trả 400 PAYMENT_METHOD_UNSUPPORTED. Tài khoản admin vẫn có thể mua hàng; API admin kiểm tra role riêng.

| Method | Endpoint | Request/quyền | Kết quả |
|---|---|---|---|
| POST | `/orders` | Login, Idempotency-Key; body bên dưới | 201 Order; replay trả 200 Order cũ |
| GET | `/users/me/orders` | Login; page/pageSize/status? | `{items,page,pageSize,total}` chỉ đơn của mình |
| GET | `/users/me/orders/:id` | Login | Order; không thuộc mình trả 404 |
| POST | `/users/me/orders/:id/cancel` | Login, `{}` | Order cancelled hoặc lỗi trạng thái |
| GET | `/admin/orders` | Admin; page/pageSize/status/q? | Danh sách phân trang |
| GET | `/admin/orders/:id` | Admin | Order |
| PATCH | `/admin/orders/:id/status` | Admin, `{status,expectedStatus}` | Order mới; trạng thái đã đổi trả 409 ORDER_CHANGED |

Tạo đơn:

```json
{
  "customer": { "name": "Nguyễn Văn A", "phone": "0900000001", "email": "a@example.com", "address": "123 Đường A", "note": "Gọi trước khi giao" },
  "paymentMethod": "cod",
  "voucherCode": null
}
```

Server đọc items từ session, không nhận userId, items, price, discount, total, stock hoặc orderStatus do client chọn. Name/phone/address bắt buộc; email/note tùy chọn. Khung giờ giao là mở rộng, chưa bắt buộc ở v1. Frontend B cần chuyển CheckoutInfo hiện tại sang body này và dùng tổng do server trả.

Order tối thiểu: id, orderCode, userId, customer snapshot, items (`productId,productNameSnapshot,unitSnapshot,unitPriceSnapshot,quantity,lineTotal`), subtotal, shippingFee, productDiscount, shippingDiscount, discount, total, voucherCode, paymentMethod, paymentStatus, status, history, createdAt, updatedAt. orderCode unique theo dạng `FM-YYYYMMDD-XXXXXXXX`, không dùng bộ đếm ngẫu nhiên chỉ 3 số. Khi đọc đơn cũ, dùng snapshot, không tính lại từ catalog hiện tại.

**Chống đặt trùng:** POST /orders bắt buộc header Idempotency-Key là UUID mới cho mỗi lần đặt. Unique index `{userId:1,idempotencyKey:1}`. Lưu hash body đã chuẩn hóa. Retry cùng key/body trả Order đã tạo trước khi đọc giỏ mới; cùng key nhưng body khác trả 409 IDEMPOTENCY_CONFLICT. Hai request đồng thời cùng key chỉ tạo một Order. Lỗi checkout không để lại order thiếu item hoặc đã trừ kho một phần.

Trình tự: xác thực + validate → kiểm tra idempotency → lấy cart → transaction DB đọc giá/trạng thái và trừ kho có điều kiện → tính ship/voucher → tạo Order + usage/movement → commit → xóa giỏ đã checkout nếu giỏ vẫn đúng phiên bản vừa dùng → lưu session → trả Order. Nếu lưu session thất bại sau commit, retry cùng key vẫn trả Order cũ; tuyệt đối không tạo lại đơn. B phải quản lý cartRevision hoặc fingerprint để không xóa sản phẩm khách vừa thêm trong lúc checkout.

## 7. Trạng thái đơn và thanh toán

| Trạng thái hiện tại | Admin được chuyển sang | Khách được hủy? |
|---|---|---|
| pending | confirmed, cancelled | Có |
| confirmed | preparing, cancelled | Có |
| preparing | shipping, cancelled | Không |
| shipping | delivered | Không |
| delivered | Không | Không |
| cancelled | Không | Đã hủy thì trả lại đơn, không hoàn kho lần nữa |

Không chuyển lùi/mở lại đơn hủy. History ghi from/to, actorId, thời gian (`actorId=system` khi hệ thống tự hủy). `paymentStatus` gồm `unpaid`, `paid`, `refunded`.

- **COD:** mới đặt `unpaid`; chuyển delivered đồng thời ghi `paid` và paidAt. Hủy trước shipping giữ unpaid.
- **VNPay:** mới đặt `unpaid`, có `paymentDueAt` = lúc đặt + 15 phút; hàng đã trừ kho để giữ chỗ. Chỉ khi cổng thanh toán xác nhận (return/IPN có chữ ký hợp lệ) mới ghi `paid`. Đơn VNPay chưa `paid` chỉ được hủy; admin chuyển sang trạng thái khác trả 409 `ORDER_NOT_PAID`. Giao xong không tự ghi `paid` cho VNPay.
- **Quá hạn:** backend quét mỗi phút, hủy đơn VNPay `pending` + `unpaid` đã qua `paymentDueAt`, hoàn kho và lượt voucher. Tạo thanh toán cho đơn đã quá hạn trả 409 `ORDER_PAYMENT_EXPIRED` và hủy đơn ngay.
- **Hoàn tiền:** khách không tự hủy đơn đã trả tiền (409 `ORDER_PAID_CONTACT_SUPPORT`). Admin hủy đơn đã trả, hoặc tiền về sau khi đơn đã hủy → payment chuyển `refund_required`. Admin hoàn tiền trên cổng VNPay rồi gọi `POST /admin/payments/:paymentId/refund` `{note?}` → payment `refunded`, đơn đã hủy chuyển `paymentStatus=refunded`. Gọi lại trả kết quả cũ. Danh sách: `GET /admin/payments/refunds?status=refund_required|refunded`.

## 8. Quyền tồn kho và điểm nối A/B

- A sở hữu thuộc tính catalog, giá, trạng thái bán. Product mới luôn stock=0; API catalog từ chối stock/counters. Seed chỉ thêm sản phẩm còn thiếu, không ghi đè stock đã có.
- B sở hữu mọi tăng/giảm stock và lịch sử kho. B tạo inventory service; checkout và hủy gọi service này, không gọi PATCH catalog.
- Dùng `getDatabase()` và `getMongoClient()` trong config/database; truyền cùng MongoDB session vào TẤT CẢ truy vấn của transaction.
- A cung cấp `catalog.service.checkoutProducts(productIds, session)` để B đọc các sản phẩm/danh mục đang bán trong transaction; thiếu ID nào phải báo lỗi. Giá/kho chưa được giữ bởi hàm đọc này.
- B trừ stock bằng update có điều kiện `stock >= quantity` và kiểm tra modifiedCount; đối chiếu unit vừa đọc. Không dùng read → tính ở JS → $set stock. Hủy dùng chuyển trạng thái có điều kiện và hoàn kho trong cùng transaction, bảo đảm đúng một lần.
- Tạo inventory movement với operationId/orderId để chống ghi trùng, lưu actor và thời gian. Collection products có trường stock do B cập nhật qua inventory service theo ranh giới này; đây là quyền ghi đã thống nhất.
- Transaction nhiều document yêu cầu replica set/Atlas phù hợp. Không chạy checkout theo kiểu bỏ transaction trên MongoDB standalone.

API kho do B tạo: GET /admin/inventory (phân trang, q?, lowStock?), POST /admin/inventory/:productId/adjustments với `{quantityDelta,reason}` và Idempotency-Key. Admin only, CSRF; quantityDelta theo nấc bán, khác 0, không để stock âm; trả `{productId,stock,movementId}`. Gửi lại cùng Idempotency-Key và cùng nội dung trả kết quả cũ; cùng khóa nhưng khác sản phẩm/số lượng/lý do trả 409 `IDEMPOTENCY_CONFLICT`. Admin tăng hay giảm đều ghi `type=adjustment`; chỉ đặt đơn là `order`, hủy đơn là `cancel`.

Đổi đơn vị bán (A) chỉ được khi stock = 0 **và** không còn đơn chưa kết thúc (pending → shipping) chứa sản phẩm; nếu còn trả 409 `UNIT_HAS_OPEN_ORDERS`. Kiểm tra chạy trong transaction cùng sản phẩm nên không lọt với đơn đặt đồng thời. Hoàn kho khi hủy chỉ cộng nếu đơn vị hiện tại khớp `unitSnapshot`.

Giỏ trong session được cập nhật tuần tự theo session (khóa trong tiến trình Node): nhiều tab hoặc request song song không ghi đè mất món. Chạy nhiều instance backend thì cần chuyển khóa này xuống database. Dùng điều chỉnh tăng/giảm thay cho đặt tuyệt đối stock từ một màn hình có thể đã cũ.

## 9. Checklist B bắt đầu làm

1. Đọc config/commerce.js, middleware/auth.js và cấu trúc session ở mục 2.
2. Dựng cart routes/service, không sửa auth hoặc tự tạo session middleware khác.
3. Viết quote và COD checkout theo các body/response đã chốt.
4. Dựng schema/index orders, voucher usage và inventory movement; kiểm tra transaction trên replica set.
5. Nối Angular cart/order/inventory; bỏ demo OrderService và bật lại checkout khi API đã chạy.
6. Kiểm thử đặt đồng thời, idempotency, đổi giá/kho sau quote, rollback và hủy đúng một lần.

API phần B trả 404 cho tới khi B mount router thật. Không thêm mock endpoint trả thành công giả.

## 10. Bổ sung hoàn thiện phần A

- POST `/auth/forgot-password`: body `{email}`, cần cookie/CSRF; 202 `{message,delivery}` giống nhau với tài khoản có/không tồn tại. Delivery `outbox` là thư thử, không gửi tới email thật; `smtp` dùng cấu hình của nhóm. Có giới hạn tần suất riêng.
- POST `/auth/reset-password`: body `{token,newPassword}`, cần cookie/CSRF; 204 thành công. Token ngẫu nhiên chỉ lưu SHA-256 trong User, sống 20 phút, dùng đúng một lần bằng update nguyên tử. Token sai/hết hạn/đã dùng/tài khoản bị khóa trả 400 RESET_TOKEN_INVALID. Yêu cầu mới thay mã cũ. Đổi mật khẩu bình thường hoặc khóa/mở tài khoản cũng làm mã reset cũ mất hiệu lực.
- POST `/admin/uploads`: admin + CSRF; multipart/form-data với đúng một field file `image`. PNG/JPEG/WebP, tối đa 2 MB và 20 triệu pixel; xác minh/giải mã ảnh, bỏ metadata và chuyển WebP, kích thước tối đa 1600×1600. Trả 201 `{imageUrl:"/images/uploads/UUID.webp"}`. MIME giả/nội dung lỗi trả 400, quá dung lượng trả 413. Không sử dụng tên file người dùng làm đường dẫn.
- API upload không tự sửa Product; Angular đưa imageUrl vào lần lưu sản phẩm. File local là lưu trữ của môi trường chạy, không commit Git. Triển khai nhiều máy cần chọn shared/object storage trước khi vận hành.
- PATCH product cho phép `netWeightGram:null` hoặc `unitWeightGram:null` để bỏ trường tùy chọn; không ảnh hưởng stock.
- Audit ghi method/path, actorId, status và thời gian cho API ghi; giữ 90 ngày bằng TTL index. Không ghi body/query/password/token/cookie hoặc secret SMTP.

Các bổ sung này không đổi contract session/giỏ/đơn/kho của B. Danh sách kiểm tra bàn giao ở [part-a-handoff.md](part-a-handoff.md).

Login hỗ trợ email hoặc số điện thoại trong field `identifier`; field `email` cũ vẫn tương thích. Không gửi cả hai field trong cùng request.
