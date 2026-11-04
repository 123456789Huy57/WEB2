# FreshMart · Web2

Đồ án môn Phát triển web kinh doanh: chợ thực phẩm online FreshMart với Meal Planner (chọn nguyên liệu đang có, gợi ý món, thêm phần còn thiếu vào giỏ).

| Thư mục | Nội dung | Nhóm phụ trách |
|---|---|---|
| `frontend/` | Angular 20: cửa hàng, Meal Planner, tài khoản, tra cứu đơn, khu quản trị | Frontend |
| `backend/` | Express + MongoDB: auth/session, user, catalog; hợp đồng giỏ/đơn/kho cho B | Backend |

## Chạy frontend

```bash
cd frontend
npm install
npm run images     # 1 lần: tải ảnh sản phẩm về project
npm start          # http://localhost:4200
```

Chi tiết màn hình, tài khoản thử, quy tắc nghiệp vụ và chỗ nối API xem `frontend/README.md`.

## Chạy backend

```bash
cd backend
npm ci
cp .env.example .env
npm run dev
```

Health API: `http://localhost:3000/api/health`. Điền MongoDB URI và session secret trong `.env` để dùng database/session bền. Xem [backend/README.md](backend/README.md) để import catalog và [hướng dẫn nhóm](backend/docs/team-guide.md) để chia việc theo bài học.

Hợp đồng A/B đã chốt: [backend/docs/backend-contract.md](backend/docs/backend-contract.md). Phần A và Angular tương ứng đã nối API; phần B tiếp tục giỏ, COD, đơn và kho.

## Cách làm việc nhóm

1. `git pull` trước khi bắt đầu.
2. Tạo nhánh riêng cho mỗi việc: `git checkout -b fe-ten-viec` hoặc `be-ten-viec`.
3. Commit nhỏ, viết rõ đã làm gì; `git push -u origin ten-nhanh`.
4. Mở Pull Request vào `main`, trưởng nhóm duyệt rồi gộp.
