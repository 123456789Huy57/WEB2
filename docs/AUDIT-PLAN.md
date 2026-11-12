# Kế hoạch rà soát và chuẩn hóa dữ liệu FreshMart

Cập nhật: 12/11/2026 · Nhánh `huy-phan-b`

## 1. Kết quả rà soát

| Khu vực | Hiện trạng trước khi sửa | Mức độ |
|---|---|---|
| Công thức (66 món) | Mỗi món chỉ có 3 bước chung chung ("Ướp gà.", "Nướng chín."). Không có giới thiệu, gia vị, mẹo nấu hay cách bảo quản. | Nặng |
| Công thức, dữ liệu gốc | Tên món không khớp nguyên liệu (Canh chua **cá lóc** nhưng dùng cá basa; Dồi sụn xào miến nhưng nguyên liệu là mực và rau). Định lượng sai đơn vị (dưa leo 1 kg cho 2 người, 30 g bột ngọt thay cho bột cà ri). Gắn nhãn "chay" cho món có nước mắm hoặc trứng. Tên món không có thật ("Bánh vọng", "Tỏa lan"). | Nặng |
| Mô tả sản phẩm | 135/200 mô tả là câu mẫu "X thuộc nhóm…, phù hợp cho bữa ăn gia đình…". | Nặng |
| Dinh dưỡng sản phẩm | Số liệu ngẫu nhiên (cá basa có 27 g tinh bột và 14 g đường; trứng có 5 g chất xơ). | Nặng, sai sự thật |
| Xuất xứ | 66 sản phẩm để trống, trang hiển thị mặc định "Việt Nam", kể cả hàng ghi "nhập khẩu Đức", "nội địa Trung". | Trung bình, sai sự thật |
| Khối lượng | 125 sản phẩm thiếu hoặc sai `netWeightGram`, làm Meal Planner tính sai số lượng cần mua. | Trung bình |
| Danh mục | Quầy "Bánh kẹo - Ăn vặt" có 0 sản phẩm, Hải sản có 6, Bánh mì có 3. 32 sản phẩm đặt sai quầy (kẹo thạch trong Bánh mì, trà túi lọc trong Đồ uống, sữa tươi trong Trứng, cà phê trong Trà). | Trung bình |
| Thương hiệu | 85 sản phẩm ghi sai thương hiệu (Dasani ghi "Lavie", Con Bò Cười ghi "Vinamilk", táo ghi "Winmart"). | Trung bình |
| Sản phẩm bị ẩn | Trong 12 món "Bách Hóa Xanh không bán", có 3 món thật ra có bán: bột bánh xèo, bột bắp, trà xanh túi lọc. | Nhẹ |
| API danh sách sản phẩm | Trả toàn bộ trường, kể cả trường nội bộ (`sourceUrl`, `hiddenReason`) và mô tả, bộ ảnh, dinh dưỡng mà trang danh sách không dùng: 330 KB. | Trung bình |

## 2. Đã triển khai

**Dữ liệu** (`backend/scripts/data/`, ghi vào database bằng `npm run db:sync`):

- `content/recipes.json`: 66 món, mỗi món có giới thiệu, 5–8 bước chi tiết (lượng, lửa, thời gian, dấu hiệu chín), gia vị kèm định lượng, 3 mẹo nấu, gợi ý ăn kèm, cách bảo quản. Dinh dưỡng các món sai rõ ràng được ước lại.
- `content/recipe-fixes.json`: sửa 14 lỗi dữ liệu gốc (tên món, định lượng, nhãn chay). Mỗi mục ghi lý do.
- `content/products.json`: 211 sản phẩm có mô tả riêng, gợi ý dùng, cách bảo quản, xuất xứ (chỉ ghi khi chắc chắn), khối lượng tính theo tên hàng.
  - Dinh dưỡng / 100 g lấy theo bảng thành phần thực phẩm cho 95 mặt hàng tươi hoặc đơn chất.
  - Hàng chế biến không có số liệu đáng tin thì bỏ bảng dinh dưỡng, không hiển thị số sai.
- `content/product-moves.json`, `content/product-brands.json`: đưa 32 sản phẩm về đúng quầy, sửa 85 thương hiệu.
- `content/categories.json`: mô tả 13 danh mục, thêm danh mục con: Gia vị khô, Bún - phở - miến khô, Bánh mì, Củ - nấm.
- `new-products.json`: thêm 24 sản phẩm thật của Bách Hóa Xanh (12 bánh kẹo, 6 hải sản, 6 bánh mì - bánh ngọt) gồm giá, ảnh và link nguồn. Tồn kho 40, chưa có lượt bán hay đánh giá giả.
- `catalog-fix.json`: chuyển 3 món "không bán" sang sản phẩm thật. Còn 9 món Bách Hóa Xanh thật sự không bán (mật ong, ghẹ, đào, kem tươi…).
- Seed `frontend/public/data/*.json` cập nhật theo đúng dữ liệu trên, để database mới tạo cũng đầy đủ.

**Backend**

- `GET /api/products` chỉ trả trường cần cho thẻ sản phẩm. Mô tả, bộ ảnh và dinh dưỡng lấy qua `GET /api/products/:id` khi mở trang chi tiết, giống cách các sàn lớn chia danh sách và chi tiết. Payload giảm từ 330 KB xuống 144 KB (21 KB sau gzip).
- Trường nội bộ (`sourceImage`, `sourceUrl`, `hiddenReason`, `mergedInto`) không còn gửi cho khách. Trang admin vẫn nhận đủ.
- `schema.js` khai báo các trường mới: `usage`, `storage` cho sản phẩm; `description`, `tips`, `seasonings`, `servingNote`, `storage` cho công thức.
- `scripts/sync-content.js` (`npm run db:sync`):
  - Mặc định chỉ xem trước; `--apply` mới ghi. Sao lưu bản ghi bị đổi trước khi ghi. Chạy lại nhiều lần vẫn cho cùng kết quả.
  - Không đụng giá, tồn kho, lượt bán, đánh giá, đơn hàng hay người dùng.
  - Mô tả nhóm đã tự sửa trong admin được giữ nguyên, trừ khi thêm `--force`.

**Frontend**

- Hộp công thức Meal Planner: giới thiệu món, bảng "Gia vị thường có sẵn", các bước có tên bước in đậm, khung "Mẹo nấu ngon", phần ăn kèm và bảo quản.
- Trang sản phẩm: tải chi tiết riêng, hiện thêm gợi ý dùng và bảo quản. Chỉ hiện xuất xứ khi có dữ liệu (bỏ mặc định "Việt Nam"). Dinh dưỡng ghi rõ "giá trị tham khảo".
- Trang so sánh: tải chi tiết để có dinh dưỡng; xuất xứ trống hiện "Chưa ghi".

## 3. Đợt 2 (đã làm)

1. **Icon nguyên liệu**: 83 icon SVG vẽ phẳng theo bộ mẫu đã duyệt (`frontend/public/img/ingredients/`), mỗi icon dưới 1,2 KB, thay ảnh bao bì sản phẩm trong Meal Planner.
2. **Ảnh món ăn**: 65/66 món chuyển sang ảnh Unsplash (giấy phép tự do), chọn bằng mắt cho đúng món, tải lên Cloudinary qua `fix:catalog`. Khổ qua xào trứng chưa có ảnh phù hợp nên giữ ảnh cũ.
3. **Nguyên liệu còn thiếu**: thêm 8 nguyên liệu có hàng thật (tỏi, thịt heo xay, giá đỗ, sợi mì Quảng, hành tím, chanh, ớt, bột mì) và bổ sung cho 21 món (`content/recipe-additions.json`).
   - Bún chả có thịt xay làm chả viên.
   - Mì Quảng dùng sợi mì Quảng, ba chỉ, đậu phộng.
   - Bánh xèo có giá và thịt thay cho mực khô.
   - Nem nướng dùng thịt xay và cuốn bánh tráng.
   - Cách làm của 22 món được viết lại theo danh sách mới.
4. **Giao diện Meal Planner**:
   - Đầu trang gọn hơn.
   - Hai cột: "Tủ bếp của bạn" dính bên trái, bộ lọc dạng chip và danh sách món bên phải.
   - Kết quả cập nhật ngay khi chọn, không cần bấm nút.
   - Chưa chọn gì thì hiện món gợi ý theo bộ lọc.
   - Thẻ món hiện icon nguyên liệu (đã có thì đậm), nhãn "Có 3/5" và tên các nguyên liệu cần thêm.
   - Trên điện thoại có thanh nổi "Xem n món" để nhảy xuống danh sách.
   - Thuật toán xếp món giữ nguyên như Web1.

## 4. Còn lại

1. **9 nguyên liệu không có hàng** (mật ong, ghẹ, đào, kem tươi, ớt chuông, riềng, đậu nành hạt, trân châu, mực khô): Meal Planner báo "chưa có sản phẩm phù hợp".
2. **Tab Cộng đồng**: dữ liệu là lượt nấu thật. Database mới thì trống cho tới khi có người dùng; không tạo lượt nấu giả.
