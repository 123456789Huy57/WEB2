# Phân công backend FreshMart

**Phần A đã hoàn thành:** xem [bàn giao phần A](part-a-handoff.md). Hợp đồng tích hợp chính thức ở [backend-contract.md](backend-contract.md). Phần B chưa triển khai giỏ/đơn/kho.

Phân công cho hai người theo phương án ban đầu: A phụ trách tài khoản, bảo mật và catalog; B phụ trách giao dịch, khuyến mãi và vận hành. Ưu tiên hoàn thành luồng mua hàng COD trước, sau đó bổ sung các tính năng mở rộng.

## Trạng thái hiện tại

- Có backend Express/MongoDB, auth/session/phân quyền, profile/customer và CRUD catalog.
- Angular đã nối phần A, bao gồm danh mục, upload ảnh, đổi/quên mật khẩu và chi tiết khách hàng.
- Khôi phục mật khẩu dùng hộp thư local để thử; cấu hình SMTP khi có dịch vụ email thật.
- Giỏ, checkout, đơn, voucher và kho đã triển khai trên nhánh `huy-phan-b` ([bàn giao phần B](part-b-handoff.md)).

## Người A phụ trách tài khoản bảo mật và catalog

Thư mục chính: `src/modules/auth`, `src/modules/users`, `src/modules/catalog`.

| Thứ tự | ND cần làm | Notes |
|---|---|---|
| 1 | Cùng B chốt schema, API, tên trường và quy tắc nghiệp vụ | Thống nhất kiểu ID, trạng thái đơn, phí ship, chính sách guest checkout và cấu trúc lỗi với Angular hiện tại. |
| 2 | Hoàn thiện cấu hình backend, MongoDB và dữ liệu khởi tạo | Khung đã có. Kiểm tra `.env`, session store và seed; chỉ nhập tài khoản dev với mật khẩu đã hash. Không commit secret. |
| 3 | Đăng ký, đăng nhập, đăng xuất và quản lý session | Hash mật khẩu; tạo lại session ID sau login; hủy session khi logout. Phối hợp B để giữ giỏ khách khi tạo lại session. |
| 4 | Phân quyền customer/admin và cung cấp middleware dùng chung | Bảo vệ API admin; lấy danh tính từ session, không tin userId/role gửi từ client. Kiểm tra tài khoản còn hoạt động. |
| 5 | API hồ sơ, địa chỉ và quản lý khách hàng | Khách chỉ xem/sửa hồ sơ của mình. Admin xem/tìm khách hàng; khóa/mở tài khoản nếu nhóm chọn triển khai. |
| 6 | Hoàn thiện API danh mục và sản phẩm | Kế thừa API đọc đã có; bổ sung tìm kiếm, lọc, sắp xếp và phân trang theo contract. Giữ tên trường Angular hoặc thống nhất cách chuyển đổi. |
| 7 | CRUD sản phẩm/danh mục cho admin | Validate dữ liệu, kiểm tra mã/slug trùng; ưu tiên ẩn sản phẩm thay vì xóa. API sửa sản phẩm không ghi đè tồn kho do B quản lý. |
| 8 | Nối Angular cho auth, hồ sơ và catalog | Sửa service tương ứng để gọi HttpClient; xử lý cookie, trạng thái chờ và lỗi. Bàn giao dữ liệu giá/sản phẩm cho B. |
| 9 | Kiểm thử phần A và phối hợp kiểm thử toàn hệ thống | Kiểm tra đăng nhập sai, email trùng, session/logout, customer gọi admin API và truy cập hồ sơ người khác. Cập nhật Postman và hướng dẫn chạy. |

## Người B phụ trách giao dịch khuyến mãi và vận hành

Thư mục chính: `src/modules/cart`, `src/modules/vouchers`, `src/modules/orders`, `src/modules/inventory`.

| Thứ tự | ND cần làm | Notes |
|---|---|---|
| 1 | Đọc và triển khai hợp đồng giỏ, checkout, phí ship, voucher, kho và trạng thái đơn | A đã chốt v1 trong `backend-contract.md`; B làm theo và trao đổi nếu cần thay đổi. Xem ghi chú bàn giao bên dưới. |
| 2 | API giỏ khách và giỏ tài khoản dùng session | Giỏ guest/user cùng dùng `req.session.cart` theo hợp đồng v1; login giữ giỏ, logout xóa giỏ. Chưa cần giỏ lưu theo tài khoản hay cơ chế merge riêng; kiểm tra bước mua 0.5 kg hoặc từng đơn vị. |
| 3 | Checkout COD và tạo đơn hàng | Server lấy giá hiện tại, tính tổng và phí ship. Tạo đơn, trừ kho và xử lý voucher trong cùng transaction khi áp dụng; chống tạo đơn trùng. |
| 4 | API lịch sử, chi tiết, hủy đơn và mua lại cho khách | Kiểm tra quyền sở hữu đơn. Lưu tên/giá sản phẩm và địa chỉ tại thời điểm đặt; mua lại phải kiểm tra giá và tồn kho mới. |
| 5 | Quản lý đơn và cập nhật trạng thái cho admin | Dùng cùng bộ trạng thái với Angular: pending, confirmed, preparing, shipping, delivered, cancelled. Chốt riêng các bước được phép hủy. |
| 6 | Quản lý tồn kho, trừ/hoàn kho và cảnh báo tồn thấp | Phối hợp module catalog của A. Chống tồn kho âm khi mua đồng thời; hoàn kho đúng một lần khi hủy hợp lệ. |
| 7 | API voucher, voucher đã lưu và tính tiền xem trước | Làm sau luồng COD cơ bản. MVP dùng một mã/đơn; kiểm tra thời hạn, điều kiện và giới hạn sử dụng; kiểm tra lại khi tạo đơn. |
| 8 | Dashboard cơ bản và quản trị voucher | Thống kê đơn/doanh thu theo quy tắc đã chốt; bật/tắt voucher. Làm sau khi đơn hàng và kho chạy ổn. |
| 9 | Điểm thành viên và lịch sử điểm nếu còn thời gian | Phần mở rộng sau MVP. Cộng đúng một lần theo điều kiện đơn; không cộng cho đơn hủy. |
| 10 | API Meal Planner nếu nhóm chọn đưa lên backend | Giữ thuật toán gợi ý hiện tại ở giai đoạn đầu. Nếu thêm API, thống nhất dữ liệu công thức/nguyên liệu và ánh xạ sản phẩm với A; AI API làm sau. |
| 11 | Nối Angular cho giỏ, checkout, đơn hàng và vận hành | Luồng mua nguyên liệu thiếu từ Meal Planner phải thêm vào giỏ qua API. Xử lý giá/kho thay đổi, voucher lỗi và đơn thất bại. |
| 12 | Kiểm thử phần B và phối hợp kiểm thử toàn hệ thống | Kiểm tra đặt trùng, hai người mua hàng cuối, voucher hết lượt, hủy hai lần, truy cập đơn người khác và rollback khi checkout lỗi. Cập nhật Postman và hướng dẫn chạy. |

## Ghi chú bàn giao cho người B

Nền tảng phần A nằm trên nhánh `main` (trước đây là `lu`). B tạo nhánh riêng từ bản mới nhất của `origin/main`. Đọc [bàn giao phần A](part-a-handoff.md), chạy theo [README backend](../README.md), rồi dùng [backend-contract.md](backend-contract.md) làm chuẩn method, URL, body, response và quy tắc nghiệp vụ. File này tóm tắt công việc; contract là tài liệu chi tiết khi nối code.

### Những phần dùng lại từ A

| Nội dung | B cần làm theo |
|---|---|
| Session và CSRF | Gọi `GET /api/auth/session` lấy cookie và `csrfToken`, kể cả khách chưa đăng nhập. Mọi POST/PATCH/PUT/DELETE gửi cookie và header `X-CSRF-Token`. Login/register trả token mới; logout xong cần lấy session mới trước lần ghi tiếp theo. Angular đã có `core/api.interceptor.ts` hỗ trợ. |
| Danh tính và phân quyền | Dùng `requireAuth`, `requireAdmin` trong `src/middleware/auth.js`. Sau middleware lấy người dùng từ `req.user.id`; session lưu `userId`, không lưu object `user`. Không nhận chủ đơn hoặc quyền admin từ body. |
| Giỏ hàng | Lưu `req.session.cart = [{ productId, quantity }]`; chưa có thì xem là `[]`. Auth của A đã giữ giỏ khi login/register và xóa khi logout. Không cài thêm session middleware hoặc đổi sang JWT/localStorage để xác thực. |
| Sản phẩm | Giữ ID chuỗi hiện có như `p-0053`, không đổi sang ObjectId. Dùng `catalog.service.checkoutProducts(ids, mongoSession)` để đọc sản phẩm còn bán trong danh mục còn hoạt động; B phải kiểm tra ID thiếu và tồn kho. Helper chỉ đọc, không giữ/trừ kho. |
| Giá, phí ship và trạng thái | Dùng chung `src/config/commerce.js`, validate đầu vào trước khi gọi helper. Không viết thêm bộ hằng số khác ở backend. Tiền là số nguyên VND; giá và tổng đơn phải tính lại trên server. |
| Gắn route | Thêm router B tại vị trí ghi chú trong `src/app.js`, sau session/CSRF chung. Giữ cấu trúc lỗi `{ error: { code, message, details? } }` để Angular xử lý thống nhất. |

### Các quyết định đã chốt

- **Checkout:** khách được dùng giỏ và xem báo giá; phải đăng nhập mới tạo đơn. MVP chỉ hỗ trợ COD, chưa có thanh toán online hoặc tra cứu đơn công khai bằng mã/số điện thoại.
- **Phí ship:** 20.000đ khi tổng tiền hàng dưới 300.000đ; từ 300.000đ miễn ship, xét trước voucher. Giỏ rỗng có phí 0 nhưng không được đặt đơn. Mỗi đơn tối đa một voucher. Hàng Kg mua theo bước 0,5; đơn vị khác theo bước 1.
- **Tạo đơn:** lấy giỏ từ session; lưu bản chụp tên/giá/số lượng sản phẩm và thông tin giao hàng. Dùng `Idempotency-Key` theo contract để bấm lại hoặc gửi lại yêu cầu không tạo hai đơn. Sau khi commit, chỉ xóa phần giỏ tương ứng với lần checkout đó.
- **Trạng thái:** `pending → confirmed → preparing → shipping → delivered`; chỉ hủy từ `pending`, `confirmed`, `preparing`. Khách chỉ được hủy ở hai trạng thái đầu; admin mới được hủy khi `preparing`. Đơn giao xong/hủy là trạng thái cuối; COD chuyển sang đã thanh toán khi `delivered`.
- **Tồn kho:** B sở hữu mọi thao tác trừ/hoàn/điều chỉnh kho. API sửa sản phẩm của A không nhận `stock`; sản phẩm mới có tồn kho 0. B cập nhật kho qua service riêng, dùng cập nhật có điều kiện để không âm kho; hủy đơn chỉ hoàn kho đúng một lần.
- **Transaction:** dùng native MongoDB và cùng Mongo session cho đơn, kho, lượt dùng voucher và lịch sử biến động liên quan. Cần MongoDB replica set hoặc Atlas để chạy transaction; kiểm tra cấu hình máy trước khi làm checkout, không bỏ transaction để chạy trên standalone.
- **Máy của B:** tự tạo `.env` và tài khoản admin theo README. Tài khoản `admin / 123` hiện chỉ là dữ liệu local trên máy A, không tự xuất hiện khi clone repo. Secret, dữ liệu session và hộp thư local không đưa lên Git.

### Angular đang chờ B nối API

- `core/cart.service.ts`, `core/order.service.ts` và phần voucher vẫn còn dữ liệu demo/localStorage; B thay bằng API theo contract. Auth, profile và catalog đã nối API thật.
- Checkout, cập nhật trạng thái đơn và điều chỉnh kho hiện đang chặn thao tác chưa có API. Chỉ mở lại khi backend tương ứng hoạt động; sửa `DataService.adjustStock` để gọi API kho riêng, không đưa `stock` vào API sửa sản phẩm.
- Luồng mua nguyên liệu thiếu từ Meal Planner phải thêm vào cùng giỏ API. Dashboard phải lấy đơn thật; màn tra cứu công khai cũ cần chuyển sang lịch sử/chi tiết đơn của người đang đăng nhập.

**Thứ tự bắt đầu:** giỏ → báo giá → đặt COD và transaction kho → lịch sử/hủy đơn → admin trạng thái/điều chỉnh kho → voucher/dashboard. Khi bàn giao, kiểm tra ít nhất: hai người mua sản phẩm cuối, gửi lại cùng khóa tạo đơn, rollback khi lỗi, hủy hai lần, customer gọi API admin và xem đơn người khác. Ghi cách chạy/kiểm thử cùng API mới trong tài liệu.

## Quy tắc phối hợp

- Dùng một backend Express chung. Tổ chức theo route → controller → model; thêm service cho nghiệp vụ nhiều bước.
- A quản lý thuộc tính/giá sản phẩm; B quản lý biến động tồn kho. Thống nhất service cập nhật stock và truyền cùng MongoDB session khi chạy transaction.
- A quản lý xác thực/session; B quản lý nội dung giỏ theo cấu trúc v1 đã chốt. Thay đổi cấu trúc cần cập nhật contract và kiểm tra lại login/logout.
- Cùng thống nhất trước khi sửa `src/app.js`, `src/config`, middleware dùng chung, dependencies hoặc hợp đồng API.
- Mỗi người phát triển trên nhánh riêng từ nền tảng chung đã thống nhất; bàn giao bằng PR nhỏ và ghi rõ API/schema thay đổi.
- Mỗi API bàn giao cần có method, URL, body, response, mã lỗi và ví dụ Postman. Người làm API chịu trách nhiệm phối hợp nối service Angular tương ứng.

## Thứ tự ưu tiên và điều kiện bàn giao

1. Chốt contract và cấu hình dùng chung.
2. Hoàn thành catalog, đăng nhập và phân quyền; triển khai giỏ hàng song song theo contract.
3. Chạy được luồng Angular: xem sản phẩm → đăng nhập → thêm giỏ → đặt COD → xem đơn → admin cập nhật trạng thái.
4. Kiểm tra quyền truy cập, tính tiền phía server, giao dịch kho và hủy đơn trước khi bàn giao MVP.
5. Bổ sung voucher, dashboard cơ bản và luồng Meal Planner mua nguyên liệu; loyalty, AI API và thanh toán online là phần mở rộng.

Mỗi phần hoàn thành khi API chạy được, có kiểm tra quyền/validation phù hợp, có ví dụ kiểm thử và nối được với luồng Angular tương ứng. Người B có khối lượng lớn hơn; chỉ triển khai các phần mở rộng sau khi luồng COD và kho đã ổn.

Xem thêm [hướng dẫn chạy backend](../README.md) và [đối chiếu môn học](team-guide.md).
