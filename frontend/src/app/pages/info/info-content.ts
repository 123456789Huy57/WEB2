/** Nội dung các trang thông tin, viết lại từ Web1 (about, team, guide, partner, các chính sách). Số liệu thống nhất với giỏ hàng: miễn phí giao từ 300.000 đ; dưới mức này phí tính theo khoảng cách, giỏ hàng tạm tính 20.000 đ. */
export interface InfoBlock { h: string; p?: string; list?: string[]; rows?: [string, string][]; }
export interface InfoPage { title: string; lead: string; group: 'about' | 'help'; blocks: InfoBlock[]; }

export const INFO: Record<string, InfoPage> = {
  'gioi-thieu': {
    title: 'Về FreshMart', group: 'about',
    lead: 'Chợ thực phẩm online cho bữa cơm nhà ở TP.HCM: rau củ, trái cây, thịt cá chọn lọc mỗi sáng, giao trong 1–2 giờ.',
    blocks: [
      { h: 'Câu chuyện', p: 'FreshMart bắt đầu từ một câu hỏi rất đời thường: tối nay nấu gì? Chúng tôi gom rau củ, thịt cá và đồ khô từ những nhà cung cấp quen mặt, bày lên một bảng giá cập nhật mỗi sáng, rồi thêm Meal Planner để bạn nấu được ngay từ những gì đang có trong bếp.' },
      { h: 'Sứ mệnh', p: 'Kết nối nông sản sạch đến bàn ăn người Việt. Chúng tôi làm việc trực tiếp với nông trại, hợp tác xã và nhà sản xuất có nguồn gốc rõ ràng.' },
      { h: 'Điều chúng tôi giữ', list: ['Chất lượng: chọn từ nguồn đầu vào đến lúc soạn đơn', 'Minh bạch: giá niêm yết rõ, hàng cân ký tính theo cân thực tế', 'Tiện lợi: đặt trước 16:00, có hàng trước bữa tối', 'Cộng đồng: ưu tiên nông hộ và hợp tác xã trong nước'] },
      { h: 'Cam kết', p: 'Sản phẩm không đúng mô tả được đổi hoặc hoàn tiền 100% trong 7 ngày. Chi tiết ở trang Đổi trả, hoàn tiền.' }
    ]
  },
  'doi-ngu': {
    title: 'Đội ngũ phát triển', group: 'about',
    lead: 'FreshMart là đồ án môn Phát triển web kinh doanh. Web1 làm giao diện HTML/CSS/JS, Web2 chuyển sang Angular và thêm backend Node.js, Express, MongoDB.',
    blocks: [
      { h: 'Nhóm thực hiện', rows: [['Trưởng nhóm', 'Điều phối, ghép frontend và backend'], ['Frontend', '2 thành viên: các trang Angular, service, giao diện'], ['Backend', '2 thành viên: API Express, MongoDB, đăng nhập JWT']] },
      { h: 'Công nghệ', list: ['Angular 20: standalone component, signals, router lazy load, reactive forms', 'Node.js + Express: REST API', 'MongoDB (Compass để xem dữ liệu): sản phẩm, đơn hàng, người dùng, công thức', 'Dữ liệu thật của Web1: 200 sản phẩm, 66 công thức, 75 nguyên liệu'] }
    ]
  },
  'doi-tac': {
    title: 'Đồng hành cùng FreshMart', group: 'about',
    lead: 'Chúng tôi chào đón nhà nông, hợp tác xã, nhà sản xuất và cộng tác viên có cùng mong muốn đưa thực phẩm sạch đến tay người tiêu dùng.',
    blocks: [
      { h: 'Tiêu chí hợp tác cung ứng', list: ['Đạt tiêu chuẩn vệ sinh an toàn thực phẩm', 'Nguồn gốc xuất xứ rõ ràng, có chứng nhận', 'Quy trình sản xuất bền vững', 'Cung ứng ổn định về số lượng và chất lượng'] },
      { h: 'Đối tác hiện tại', rows: [['Nông trại Xanh', 'Rau củ hữu cơ'], ['Trại heo sạch', 'Thịt heo an toàn'], ['Vườn trái Miền Tây', 'Trái cây tươi'], ['Hải sản Phú Quốc', 'Hải sản tươi sống']] },
      { h: 'Cộng tác viên', p: 'Giới thiệu FreshMart cho bạn bè và nhận hoa hồng cho mỗi đơn thành công. Liên hệ collab@freshmart.local.' }
    ]
  },
  'huong-dan': {
    title: 'Hướng dẫn mua hàng', group: 'help',
    lead: 'Năm bước từ lúc chọn hàng đến lúc nhận hàng, không cần tạo tài khoản.',
    blocks: [
      { h: 'Đặt hàng', list: ['Tìm sản phẩm theo quầy hoặc ô tìm kiếm, hoặc để Meal Planner gợi ý món từ nguyên liệu bạn có', 'Bấm dấu + để thêm vào giỏ. Hàng cân ký thêm theo nấc 0,5 kg', 'Mở giỏ hàng kiểm tra số lượng, nhập mã giảm giá nếu có', 'Điền người nhận, chọn giờ nhận và cách thanh toán', 'Bấm Đặt hàng. Chúng tôi gọi xác nhận trong 10 phút'] },
      { h: 'Thanh toán', rows: [['Tiền mặt khi nhận (COD)', 'Kiểm hàng rồi trả cho shipper'], ['Chuyển khoản', 'Thông tin tài khoản hiện sau khi đặt'], ['Ví MoMo', 'Quét mã QR sau khi đặt']] },
      { h: 'Lưu ý', list: ['Đơn đặt trước 16:00 giao trong ngày ở nội thành', 'Bạn hủy được đơn khi cửa hàng chưa bắt đầu soạn hàng', 'Không có tài khoản vẫn theo dõi được đơn ở trang Tra cứu đơn hàng', 'Kiểm tra hàng khi nhận, khiếu nại trong vòng 24 giờ'] }
    ]
  },
  'giao-hang': {
    title: 'Chính sách giao hàng', group: 'help',
    lead: 'Giao trong 1–2 giờ ở nội thành TP.HCM cho đơn đặt trước 16:00.',
    blocks: [
      { h: 'Thời gian giao', rows: [['Nội thành TP.HCM', '1–2 giờ, đặt trước 16:00'], ['Đặt sau 16:00', 'Sáng hôm sau, chọn khung giờ khi thanh toán'], ['Tỉnh lân cận', '1–2 ngày']] },
      { h: 'Phí giao', rows: [['Đơn từ 300.000 đ', 'Miễn phí'], ['Đơn dưới 300.000 đ', 'Tính theo khoảng cách giao, tạm tính 20.000 đ khi đặt hàng'], ['Mã FREESHIP', 'Giảm đến 20.000 đ phí giao cho đơn từ 250.000 đ']] },
      { h: 'Khi nhận hàng', p: 'Hàng tươi sống được đóng túi giữ lạnh. Bạn kiểm tra trước khi thanh toán; thiếu hoặc dập hỏng thì báo shipper để đổi ngay hoặc trừ tiền.' }
    ]
  },
  'doi-tra': {
    title: 'Đổi trả, hoàn tiền', group: 'help',
    lead: 'Đổi hoặc hoàn tiền 100% trong 7 ngày nếu sản phẩm không đúng mô tả.',
    blocks: [
      { h: 'Điều kiện', list: ['Sản phẩm còn nguyên tem nhãn, bao bì', 'Trong vòng 7 ngày kể từ ngày nhận', 'Có mã đơn hàng', 'Hàng tươi sống báo trong 24 giờ kèm ảnh chụp'] },
      { h: 'Các bước', list: ['Gọi 038 369 0006 hoặc email support@freshmart.local', 'Cung cấp mã đơn, sản phẩm và lý do', 'Chúng tôi đến lấy hàng hoặc bạn gửi lại cửa hàng gần nhất', 'Hoàn tiền trong 3–5 ngày làm việc'] },
      { h: 'Không áp dụng', list: ['Thực phẩm đã chế biến hoặc đã dùng', 'Hư hỏng do bảo quản sai cách sau khi nhận', 'Sản phẩm hết hạn do để quá lâu sau khi nhận'] }
    ]
  },
  'bao-mat': {
    title: 'Bảo mật thông tin', group: 'help',
    lead: 'Chúng tôi chỉ thu thập thông tin cần để giao hàng và chăm sóc bạn.',
    blocks: [
      { h: 'Thông tin thu thập', rows: [['Cá nhân', 'Họ tên, số điện thoại, email, địa chỉ giao hàng'], ['Giao dịch', 'Lịch sử đơn, cách thanh toán, giá trị đơn'], ['Kỹ thuật', 'Loại trình duyệt, thời gian truy cập']] },
      { h: 'Mục đích', list: ['Xử lý đơn hàng, giao hàng và hỗ trợ', 'Gửi ưu đãi khi bạn đồng ý nhận', 'Cải thiện dịch vụ, phát hiện gian lận'] },
      { h: 'Quyền của bạn', list: ['Xem, sửa thông tin ở trang Tài khoản', 'Yêu cầu ngừng nhận tin khuyến mãi', 'Yêu cầu xóa dữ liệu: privacy@freshmart.local'] }
    ]
  }
};

export const INFO_NAV: { slug: string; label: string }[] = [
  { slug: 'gioi-thieu', label: 'Giới thiệu' }, { slug: 'doi-ngu', label: 'Đội ngũ' }, { slug: 'doi-tac', label: 'Đối tác' },
  { slug: 'huong-dan', label: 'Hướng dẫn mua hàng' }, { slug: 'giao-hang', label: 'Giao hàng' }, { slug: 'doi-tra', label: 'Đổi trả' }, { slug: 'bao-mat', label: 'Bảo mật' }
];
