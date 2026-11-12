# Feedback tổng hợp backend và luồng Meal Planner FreshMart

Ngày rà: 05/11/2026. Phạm vi code: `lu` (`6318faf`), `huy-phan-b` (`6830381`), `dong` (`efe0771`). Đã fetch lại GitHub trước khi rà. Tài liệu này tổng hợp lỗi cần sửa và các điểm nhóm cần khớp lại; chưa merge hoặc sửa code nghiệp vụ. Những kết quả dưới đây áp dụng cho các commit đã nêu, không phải xác nhận toàn bộ hệ thống không còn lỗi khác.

## Cần chốt trước khi ghép code

Huy và Đồng đều triển khai cart/orders/inventory/vouchers và các service Angular tương ứng. Kiểm tra merge bằng `git merge-tree --write-tree` cho thấy **31 file xung đột: 14 backend, 17 frontend**. Không có bản tích hợp chạy chung nào được xác nhận trong lần review này.

- Chọn một bộ backend phần B làm nền, rồi đưa từng cải tiến từ nhánh kia vào. Không giữ đồng thời hai router cho cùng URL hoặc chọn toàn bộ một phía cho mọi file.
- Đề xuất dùng bản Huy làm nền vì đã có schema, kiểm thử tích hợp và các module mở rộng; đối chiếu cách Đồng xử lý replay đơn và hash yêu cầu điều chỉnh kho để bổ sung vào bản đó. Đây là đề xuất tích hợp, không có nghĩa nhánh Huy đã đạt kiểm thử đầy đủ.
- Chốt lại API dashboard: Huy trả `revenue`, `last7Days`, `topProducts`; Đồng trả `revenueAll`, `days`, `top`. Frontend phải dùng đúng schema cuối.
- Hai backend dùng tên hàm khác nhau, ví dụ Huy gọi `vouchers.evaluate`/`consume`, Đồng gọi `calculateDiscount`/`reserveUsage`; inventory cũng khác. Ghép controller/service từ hai phía mà không đối chiếu sẽ lỗi lúc chạy.

### Checklist các điểm cần khớp lại

| Nội dung | Việc cần chốt và cập nhật cùng nhau |
|---|---|
| Bộ code phần B cuối | Chọn một bộ cart/orders/inventory/vouchers làm nền; ghi rõ các cải tiến lấy từ bộ còn lại. Chỉ mount một router cho mỗi API. |
| Session và giỏ | Giữ cấu trúc session của A; thống nhất cách cập nhật giỏ đồng thời, giữ giỏ khi login, xóa khi logout và xóa phần đã mua sau khi tạo đơn. Kiểm tra cả nhiều tab. |
| Đặt/hủy đơn và thử lại | Cùng body + cùng Idempotency-Key phải trả cùng đơn; body khác trả 409. Thống nhất hủy lại trả đơn đã hủy, không hoàn kho/lượt voucher lần hai. |
| Kho và đơn vị | A quản lý thuộc tính sản phẩm, B quản lý biến động kho. Chốt điều kiện đổi đơn vị khi có đơn chưa kết thúc và loại lịch sử `order`/`cancel`/`adjustment`. |
| Thanh toán | Chốt COD-only hay có VNPay/mock; đồng bộ backend, kiểu dữ liệu Angular, lựa chọn trên checkout và contract. Nếu giữ online, bổ sung quy tắc chờ trả tiền/hết hạn/hoàn tiền. |
| Voucher | Giữ bộ đếm do nghiệp vụ đặt/hủy quản lý; thống nhất giới hạn mỗi người/tổng lượt, hoàn lượt khi hủy, ngày áp dụng theo giờ Việt Nam và các trường chỉ đọc. |
| Response API và Angular | Chốt schema dashboard, voucher, giỏ có `issues`, order snapshot và mã lỗi. Map đúng response vào Angular; không gửi ngược trường chỉ đọc khi sửa dữ liệu. |
| Meal Planner | Dùng chung API recipes/ingredients/ingredient-products; thống nhất quy đổi đơn vị, số lượng thêm giỏ và thông báo món thêm thất bại. Giữ các tính năng cộng đồng của Huy nếu nhóm chọn dùng. |
| MongoDB dùng chung | Thử transaction trên replica set/Atlas; thống nhất validator/index trước khi chạy bản tích hợp. Một người phụ trách chạy setup trên DB nhóm, các thành viên không tự seed/đổi schema tùy ý. |
| Bàn giao | Sau khi chọn code cuối, cập nhật `backend-contract.md`, README và bộ kiểm thử cùng lúc. Kết quả chạy riêng mỗi nhánh chưa thay thế kiểm thử bản ghép. |

## Lỗi cần sửa trước — P1

### 1. Huy: VNPay chưa thanh toán vẫn được ghi đã thanh toán khi giao xong

- Vị trí: [orders.service.js:136](https://github.com/123456789Huy57/WEB2/blob/6830381/backend/src/modules/orders/orders.service.js#L136).
- Đã tái hiện: tạo đơn `vnpay`, không tạo giao dịch, admin chuyển lần lượt đến `delivered` → `paymentStatus=paid`, số bản ghi payment vẫn bằng 0.
- Sửa: chỉ COD tự ghi nhận đã thu tiền khi giao. VNPay phải có xác nhận thanh toán hợp lệ; chặn tiến trình giao nếu chưa trả tiền theo quy tắc nhóm chọn.

### 2. Chung A/B: đổi đơn vị khi tồn kho bằng 0 nhưng còn đơn có thể hủy

- Vị trí chung: [catalog.service.js:21](https://github.com/123456789Huy57/WEB2/blob/6830381/backend/src/modules/catalog/catalog.service.js#L21); phần hoàn kho nằm trong inventory của B.
- Đã tái hiện trên Huy: đặt hết 1 Kg → tồn kho 0 → đổi thành Hộp → hủy đơn → kho thành 1 Hộp. Check `stock=0` chưa bảo vệ hàng đang nằm trong đơn chưa kết thúc.
- Sửa: đơn vị của sản phẩm không được đổi khi còn đơn có thể hoàn kho, hoặc tạo biến thể/SKU mới cho quy cách khác. Kiểm tra cả tình huống đổi đơn vị và đặt đơn đồng thời; giao dịch hoàn kho phải tương thích đơn vị đã lưu.

### 3. Đồng: sửa voucher ghi đè số lượt khách vừa sử dụng

- Vị trí: [vouchers.service.js:120](https://github.com/123456789Huy57/WEB2/blob/efe0771/backend/src/modules/vouchers/vouchers.service.js#L120).
- `voucherData` lấy `usedCount` từ bản đọc cũ; `update` ghi lại toàn bộ dữ liệu đó. Đã tái hiện bằng cách xen một lần tăng lượt dùng giữa đọc và ghi: số lượt đúng phải là 1 nhưng bị trả về 0. Mã có thể được dùng quá giới hạn, số liệu không khớp lịch sử sử dụng.
- Sửa: loại `usedCount` khỏi cập nhật thông tin voucher, chỉ thay qua nghiệp vụ đặt/hủy. Khi đổi giới hạn tổng lượt, kiểm tra với số lượt hiện tại bằng điều kiện cập nhật để không dùng dữ liệu cũ.

## Lỗi cần sửa tiếp — P2

### 4. Cả Huy và Đồng: cập nhật giỏ đồng thời làm mất món

- Vị trí: [cart Huy:43](https://github.com/123456789Huy57/WEB2/blob/6830381/backend/src/modules/cart/cart.service.js#L43), [cart Đồng:64](https://github.com/123456789Huy57/WEB2/blob/efe0771/backend/src/modules/cart/cart.service.js#L64).
- Đã thử HTTP thật trên cả hai nhánh: cùng cookie, thêm hai sản phẩm đồng thời → cả hai trả 200 nhưng giỏ cuối chỉ còn một sản phẩm. Session được đọc rồi ghi đè nguyên giỏ; `cartRevision` tăng ở bộ nhớ từng request chưa chống được xung đột.
- Sửa: tuần tự hóa thay đổi theo session hoặc cập nhật giỏ nguyên tử/có kiểm tra phiên bản. Hàng đợi ở Angular chỉ bảo vệ một instance ứng dụng, không bảo vệ nhiều tab hay nhiều request trực tiếp. Cần xử lý cả lúc xóa giỏ sau checkout.

### 5. Huy: danh sách đánh giá admin trả 500

- Vị trí: [reviews.routes.js:86](https://github.com/123456789Huy57/WEB2/blob/6830381/backend/src/modules/reviews/reviews.routes.js#L86).
- Kiểm thử tích hợp hiện có thất bại tại API này. `$project` trộn `userId:0` với các trường `:1`; MongoDB không cho trộn loại trừ và chọn trường, ngoại trừ `_id`.
- Sửa: bỏ `userId:0` khỏi phép chiếu đang liệt kê các trường cho phép trả về. Chạy lại ca admin xem/ẩn đánh giá.

### 6. Huy: hai yêu cầu đặt đơn cùng khóa có thể trả kết quả trái nhau

- Vị trí: [orders.service.js:106](https://github.com/123456789Huy57/WEB2/blob/6830381/backend/src/modules/orders/orders.service.js#L106).
- Đã tái hiện khi kho còn một món: cùng người, body và khóa UUID, gửi đồng thời → một yêu cầu 201, một yêu cầu `CART_INVALID` 409, dù đơn đã lưu. Transaction chạy lại có thể thấy hết kho trước khi chạm index trùng khóa; catch chỉ xử lý lỗi 11000 nên bỏ sót.
- Sửa: đọc lại đơn theo khóa khi transaction chạy lại và trước khi trả lỗi phù hợp sau rollback; vẫn kiểm tra hash nội dung. Cùng ca thử, Đồng trả 200/201 và cùng một ID đơn.

### 7. Huy: dùng lại khóa điều chỉnh kho cho nội dung khác không báo xung đột

- Vị trí: [inventory.service.js:62](https://github.com/123456789Huy57/WEB2/blob/6830381/backend/src/modules/inventory/inventory.service.js#L62).
- Đã tái hiện: điều chỉnh A, sau đó gửi cùng khóa để chỉnh B với số lượng khác → API trả kết quả A, B không đổi, không có lỗi rõ ràng.
- Sửa: lưu hash nội dung và đối chiếu productId, quantityDelta, reason cùng phạm vi người thao tác; khác nội dung trả 409. Đồng đã có kiểm tra hash cho sản phẩm/số lượng/lý do, có thể tham khảo.

### 8. Đồng: voucher dùng ngày UTC thay vì ngày Việt Nam

- Vị trí: [vouchers.service.js:12](https://github.com/123456789Huy57/WEB2/blob/efe0771/backend/src/modules/vouchers/vouchers.service.js#L12); `listPublic` cũng dùng cách này.
- Đã mô phỏng 01:00 ngày 06/11 giờ Việt Nam: mã bắt đầu 06/11 bị trả `VOUCHER_EXPIRED` vì UTC vẫn là 05/11. Mã kết thúc ngày trước cũng có thể còn dùng thêm đến 07:00.
- Sửa: dùng chung ngày theo `Asia/Ho_Chi_Minh`/UTC+7 ở kiểm tra và danh sách. Huy đã có `todayVN` cho việc này.

### 9. Đồng: admin giảm kho bị ghi là xuất hàng cho đơn

- Vị trí: [inventory.service.js:23](https://github.com/123456789Huy57/WEB2/blob/efe0771/backend/src/modules/inventory/inventory.service.js#L23).
- Đã tái hiện điều chỉnh -1 không có orderId nhưng movement có `type=order`. Code suy loại từ dấu âm nên nhầm giảm kho do hỏng/hết hạn/kiểm kê thành bán hàng.
- Sửa: truyền loại nghiệp vụ rõ ràng. Admin tăng hoặc giảm đều là `adjustment`; chỉ đặt đơn là `order`, hủy đơn là `cancel`.

### 10. Đồng: gửi lại yêu cầu hủy đơn đã hủy trả lỗi

- Vị trí: [orders.service.js:152](https://github.com/123456789Huy57/WEB2/blob/efe0771/backend/src/modules/orders/orders.service.js#L152).
- Đã tái hiện: hủy lần đầu thành công, hủy lại trả 409 `ORDER_CANNOT_CANCEL`; contract v1 yêu cầu trả lại đơn đã hủy và không hoàn kho lần hai. Khách dễ hiểu nhầm thao tác trước thất bại khi gửi lại sau lỗi mạng.
- Sửa: sau khi xác nhận quyền sở hữu, trả đơn hiện tại nếu đã cancelled. Vẫn giữ transaction và điều kiện hoàn kho một lần. Huy đã có nhánh xử lý này.

### 11. Đồng: Meal Planner đóng hộp thoại và báo đã xử lý dù thêm giỏ lỗi

- Vị trí: [meal-planner.ts:118](https://github.com/123456789Huy57/WEB2/blob/efe0771/frontend/src/app/pages/meal-planner/meal-planner.ts#L118), [cart.service.ts:99](https://github.com/123456789Huy57/WEB2/blob/efe0771/frontend/src/app/core/cart.service.ts#L99).
- Kết luận từ code: `CartService.enqueue` bắt lỗi rồi resolve; `addMissing` không nhận được kết quả từng món và vẫn đếm toàn bộ lựa chọn, báo đã xử lý rồi đóng dialog. Khi hết hàng hoặc mất mạng, người dùng không biết còn thiếu món nào. Chưa chạy tái hiện UI riêng cho ca này.
- Sửa: trả kết quả thành công/thất bại từ thao tác giỏ, đếm đúng số món thêm được, liệt kê món lỗi và giữ dialog để khách xử lý. Tách hàng đợi nội bộ khỏi promise kết quả trả cho caller.

## Phần còn thiếu khi giữ thanh toán online

Đây là khoảng trống nghiệp vụ cần nhóm chốt, chưa xếp thành lỗi COD:

- Đơn VNPay đã trừ kho ngay khi tạo nhưng chưa thấy cơ chế tự hết hạn và hoàn kho/lượt voucher khi khách bỏ thanh toán. Cần timeout giữ hàng hoặc luồng xử lý đơn bỏ dở.
- Có trạng thái payment `refund_required` khi tiền về sau lúc đơn bị hủy, nhưng chưa thấy API/màn admin xử lý hoàn tiền tương ứng. Hủy đơn đã thanh toán cũng cần ghi nhận yêu cầu hoàn tiền nhất quán.
- Hai nhánh phải chốt lại contract thanh toán: Đồng vẫn chỉ COD, Huy thêm VNPay/mock. Nếu chỉ cần MVP COD, nên hoàn thiện và kiểm thử luồng đó trước khi mở thanh toán online cho cả nhóm.

## Kết quả kiểm tra và giới hạn

| Kiểm tra | Kết quả |
|---|---|
| Huy: `npm test` | 17/17 qua |
| Huy: tích hợp phần A | 12/12 qua, gồm test cha |
| Huy: tích hợp phần B | 23/25 test node qua; một ca con danh sách đánh giá admin lỗi, làm test cha lỗi theo |
| Đồng: `npm test` | 8/8 qua; bộ này chưa có kiểm thử tích hợp B tương đương Huy |
| Angular build Huy và Đồng | Cả hai thành công; Đồng có cảnh báo CSS trang chủ vượt budget |
| Ca bổ sung trên MongoDB replica set riêng | Đã xác nhận các lỗi tiền/kho/giỏ/voucher/replay nêu là đã tái hiện |
| Ghép Huy + Đồng | Mô phỏng merge: 31 file xung đột; chưa sửa xung đột hoặc kiểm thử một bản ghép thực tế |

Các script tái hiện dùng database tạm riêng và đã xóa sau khi chạy; không sửa dữ liệu FreshMart local hiện tại hay database Atlas của nhóm. Các cổng và tiến trình preview chỉ phục vụ lần rà local, không phải cấu hình chạy bắt buộc của nhóm.

## Thứ tự đề xuất cho nhóm

1. Chốt backend B và schema API cuối, phân công ai xử lý từng nhóm file xung đột.
2. Sửa ba lỗi P1 về thanh toán, đơn vị/tồn kho và bộ đếm voucher.
3. Sửa cạnh tranh cập nhật giỏ, replay đơn/điều chỉnh kho và API đánh giá admin.
4. Sửa ngày voucher, phân loại lịch sử kho, hủy lại và thông báo Meal Planner.
5. Build và chạy test trên bản đã ghép; thêm các ca tái hiện trên thành regression tests trước khi bàn giao.
