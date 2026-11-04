# FreshMart · Design system

Hướng thiết kế: **"Bảng giá chợ sáng"**, kiểu bold editorial cho một cửa hàng thực phẩm.

Tất cả giá trị nằm trong `src/styles.css` (khối `:root`). Component chỉ dùng biến, không tự đặt màu hay cỡ chữ mới.

## 1. Ý tưởng

Mỗi sáng ở chợ, người bán viết giá lên tấm bảng. FreshMart lấy tấm bảng đó làm hình ảnh chính của thương hiệu:

- **Tiêu đề và giá in bằng chữ đứng (condensed) thật lớn**, như chữ viết trên bảng giá.
- **Rau củ cắt nền được đặt to trên những mảng màu phẳng.** Ảnh nền trắng hòa vào màu nền nhờ `mix-blend-mode: multiply`.
- **Mục "Bảng giá sáng nay" ở trang chủ** là tấm bảng thật: nền đen, giá in vàng, bấm tab đổi quầy, thêm vào giỏ ngay trên từng dòng.

Nguồn cảm hứng là barcoopbevy.com: chữ condensed lớn, mảng màu đậm, dải chữ chạy, sản phẩm đặt to. Không lấy code, logo, ảnh hay nội dung của trang đó.

## 2. Chia khu: mạnh và dịu

Giao diện được chia làm hai loại khu, không làm tối toàn bộ trang.

| Loại khu | Ở đâu | Cách trình bày |
|---|---|---|
| Khu giới thiệu thương hiệu | Hero, dải chữ chạy, Bảng giá sáng nay, khu Meal Planner, footer | Mảng màu lớn (vàng, xanh lá, đen), chữ rất to |
| Khu mua hàng | Danh sách sản phẩm, chi tiết, giỏ hàng, thanh toán, tài khoản, quản trị | Nền kem sáng, chữ đen, giá rõ ràng |

Lý do: người mua thực phẩm cần đọc giá, so sánh và lướt danh sách trong thời gian dài. Nền tối hợp với phần kể chuyện thương hiệu, nhưng đọc lâu sẽ mỏi mắt.

## 3. Màu

| Biến | Giá trị | Vai trò |
|---|---|---|
| `--ink` | `#121212` | Chữ chính; nền của bảng giá và footer |
| `--cream` / `--paper` | `#FEFCF5` | Nền trang |
| `--stone` | `#F3EEDD` | Bậc nền thứ hai: ô ảnh, panel |
| `--stone-2` | `#E4DCC3` | Viền ô nhập, nền khi rê chuột |
| `--muted` | `#5B584D` | Chữ phụ (tương phản 6,6:1 trên nền kem) |
| `--forest` | `#1C6E55` | Nút chính, trạng thái đang chọn (chữ kem trên nền này đạt 5,9:1) |
| `--green` | `#289E7C` | Mảng màu lớn: dải chữ chạy, Meal Planner. **Luôn đi với chữ đen** |
| `--yellow` | `#FFC517` | Hero; giá trên bảng tối; badge giỏ hàng |
| `--lime` | `#D2E07D` | Thanh thông báo; mảng màu phụ |
| `--sale` | `#B3302A` | Phần trăm giảm giá, lỗi |

**Vì sao có hai màu xanh?** Chữ trắng trên `#289E7C` chỉ đạt khoảng 3,4:1, không đủ cho chữ nhỏ trên nút. Vì vậy:
- `--forest` (đậm hơn) dùng cho nút có chữ.
- `--green` dùng cho mảng nền lớn, chữ đặt trên đó luôn là màu đen.

## 4. Chữ

| Vai trò | Font | Ghi chú |
|---|---|---|
| Tiêu đề, giá, nút, menu | **Oswald** (variable, 200–700) | In hoa, chữ đứng. Có đủ dấu tiếng Việt. Tự host: `public/fonts/Oswald-Variable.ttf`, giấy phép OFL |
| Nội dung | **Be Vietnam Pro** (400/500/600) | Dễ đọc, thiết kế cho tiếng Việt |

Có năm cỡ chữ: `--t-small` 14px, `--t-body` 16px, `--t-lead` 19px, `--t-head` (36–64px), `--t-display` (52–120px).

**Dòng cao (line-height) tiêu đề là `--lh-head: 1.25`, không thấp hơn.** Mọi tiêu đề Oswald in hoa (`.display`, `.h2`, `.h3`, tiêu đề hero, tên sản phẩm, tên quầy) đều dùng biến này. Chữ hoa tiếng Việt có dấu chồng lên trên (Ố, Ớ) cao gần 1,12 lần cỡ chữ, còn dấu nặng và dấu phẩy thò xuống dưới khoảng 0,2 lần. Dòng thấp hơn thì dấu của hai dòng sẽ chạm nhau. Chỉ những chữ luôn nằm trên một dòng (giá, con số, logo, đồng hồ) mới được dùng dòng cao 1.

## 5. Hình khối và khoảng cách

- **Góc gần vuông:** `--r: 3px`, dùng chung cho nút, ô nhập, thẻ, tab, chip. Không dùng nút bo tròn kiểu viên thuốc.
- **Không dùng gradient. Không đổ bóng cho thứ nằm yên trên trang.** Chỉ những thứ nổi lên trên mới có bóng (`--shadow-float`): hộp thoại, giỏ trượt, ô gợi ý tìm kiếm, thông báo toast.
- **Tách khối bằng bậc màu nền** (kem → kem đậm → đen), không dùng đường kẻ mảnh.
- **Lề ngoài:** `--gut`, từ 16 đến 56px theo bề ngang màn hình. **Khoảng cách giữa các khu:** ở trang chủ mọi khu dùng chung `--sec-y` (56–88px) cho khoảng trống trên và dưới, tiêu đề khu cùng cỡ `--t-head` (34–56px) và cách nội dung 40px; mỗi khu cố gói gọn khoảng một màn hình laptop. Các trang khác vẫn dùng `--gap-sec` (96–168px).

## 6. Ảnh

- Ảnh sản phẩm có nền trắng, đặt trên ô có màu nền và dùng `mix-blend-mode: multiply` để nền trắng biến mất.
- Hero dùng ảnh dưa hấu của chính dự án (`public/img/p/dua-hau.jpg`), xoay nghiêng và để mép khung cắt bớt.
- Ảnh chụp (giao hàng, bếp, cửa hàng) dùng góc vuông, `object-fit: cover`.
- Không dùng ảnh của trang tham khảo.

## 7. Chuyển động

| Hiệu ứng | Làm bằng |
|---|---|
| Phần tử hiện dần khi cuộn tới | directive `fmReveal` (class `.rv`) |
| Dải chữ chạy | CSS `@keyframes marquee`; dừng khi rê chuột |
| Ảnh hero trượt vào khi mở trang | `@keyframes heroIn` |
| Ảnh sản phẩm phóng nhẹ và nghiêng khi rê chuột | `transform` |
| Gạch chân menu mọc từ trái sang | `transform: scaleX` |

Tất cả chỉ dùng CSS, không dùng thư viện animation. Khi người dùng bật `prefers-reduced-motion`, mọi chuyển động tắt và nội dung vẫn hiện đầy đủ.

## 8. Thành phần chính

| Thành phần | Class |
|---|---|
| Nút | `.btn` + `.btn-forest` (chính), `.btn-ink` (trên nền màu), `.btn-stone` (phụ), `.btn-paper` |
| Tab và chip | `.tab`, `.chip`. Trạng thái đang chọn: nền đen chữ kem |
| Thẻ sản phẩm | `fm-product-card` (`.p-card`): ô ảnh kem, nút "+" đen ở góc, giá bằng Oswald |
| Bảng giá | `.board-sec` (chỉ có ở trang chủ) |
| Đi chợ theo quầy | `fm-aisle-carousel`: nền kem, banner bo góc đổi màu theo quầy (vàng, xanh đậm, chanh, xanh lá lặp lại). Trạng thái băng chuyền nằm trong class `Carousel` (`shared/carousel.ts`) |
| Dải chữ chạy | `.marquee` |
| Thanh thông báo | `.notice` (trong `app.ts`) |

## 9. Kiểm tra

Đã đối chiếu bằng Taste Skill (`inspect.mjs`, ở 1440/768/390px) và Impeccable (`detect` + critique). Một số cảnh báo được giữ nguyên có chủ ý:

- **"Nền kem ngả vàng" (palette-cream):** đây là bảng màu do chủ dự án chọn.
- **"Eyebrow":** giá cũ gạch ngang nằm ngay trên giá của dòng kế tiếp, và dòng chữ cuối footer nằm trên chữ FRESHMART. Công cụ hiểu nhầm đó là nhãn nhỏ đặt trên tiêu đề.
