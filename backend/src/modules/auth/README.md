# Module auth

Phụ trách: Người A.

Đăng ký, login/logout, regenerate/destroy session, password hash và middleware phân quyền. Khung mới cấu hình session, chưa có auth API.

Khi triển khai, tạo `auth.routes.js`, `auth.controller.js` và `auth.model.js`. Thêm service nếu nghiệp vụ cần. Dùng `require/module.exports`; mount router trong `src/app.js`. Xem catalog để tham khảo MVC và `docs/team-guide.md` để thống nhất API.
