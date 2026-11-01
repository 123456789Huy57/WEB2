# FreshMart · Web2

Đồ án môn Phát triển web kinh doanh: chợ thực phẩm online FreshMart với Meal Planner (chọn nguyên liệu đang có, gợi ý món, thêm phần còn thiếu vào giỏ).

| Thư mục | Nội dung | Nhóm phụ trách |
|---|---|---|
| `frontend/` | Angular 20: cửa hàng, Meal Planner, tài khoản, tra cứu đơn, khu quản trị | Frontend |
| `backend/` | Node.js + Express + MongoDB (sẽ thêm) | Backend |

## Chạy frontend

```bash
cd frontend
npm install
npm run images     # 1 lần: tải ảnh sản phẩm về project
npm start          # http://localhost:4200
```

Chi tiết màn hình, tài khoản thử, quy tắc nghiệp vụ và chỗ nối API xem `frontend/README.md`.

## Cách làm việc nhóm

1. `git pull` trước khi bắt đầu.
2. Tạo nhánh riêng cho mỗi việc: `git checkout -b fe-ten-viec` hoặc `be-ten-viec`.
3. Commit nhỏ, viết rõ đã làm gì; `git push -u origin ten-nhanh`.
4. Mở Pull Request vào `main`, trưởng nhóm duyệt rồi gộp.
