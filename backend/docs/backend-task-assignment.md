# Phân công backend FreshMart

**Cập nhật phần A:** Auth, user, catalog và phần Angular tương ứng đã triển khai. Session/API/quy tắc mới chốt ở [hợp đồng backend v1](backend-contract.md) là nguồn chuẩn; MVP giỏ trong session, logout xóa giỏ, checkout cần login và chỉ COD. Các mục dưới đây là phân công và ghi chú nền tảng.
Phân công cho hai người theo phương án ban đầu: A phụ trách tài khoản, bảo mật và catalog; B phụ trách giao dịch, khuyến mãi và vận hành. Ưu tiên hoàn thành luồng mua hàng COD trước, sau đó bổ sung các tính năng mở rộng.

## Khung đã có

- Express chạy được qua `npm run dev`, dùng CommonJS, MongoDB native driver, Morgan và Nodemon.
- Có cấu hình cookie/session, kết nối MongoDB, xử lý lỗi và thư mục module.
- Có API đọc sản phẩm/danh mục, lệnh seed catalog và collection Postman mẫu.
- Chưa có đăng nhập, phân quyền, API ghi catalog, giỏ hàng hoặc đặt hàng. Frontend vẫn dùng JSON/localStorage cho đến khi nối API.

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
| 1 | Cùng A chốt giỏ hàng, checkout, phí ship, voucher, kho và trạng thái đơn | Chốt khách có được checkout không, lúc trừ/hoàn kho, điều kiện hủy và cách xác nhận COD đã thanh toán. |
| 2 | API giỏ khách, giỏ tài khoản và hợp nhất sau đăng nhập | Giỏ khách dùng `req.session.cart`; giỏ tài khoản lưu MongoDB nếu cần giữ sau logout. Chống trùng khi merge; kiểm tra bước mua 0.5 kg hoặc từng đơn vị. |
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

## Quy tắc phối hợp

- Dùng một backend Express chung. Tổ chức theo route → controller → model; thêm service cho nghiệp vụ nhiều bước.
- A quản lý thuộc tính/giá sản phẩm; B quản lý biến động tồn kho. Thống nhất service cập nhật stock và truyền cùng MongoDB session khi chạy transaction.
- A quản lý xác thực/session; B quản lý nội dung giỏ và quy tắc merge. Thống nhất dữ liệu session trước khi triển khai.
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
