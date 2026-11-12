# Module auth

Phụ trách: Người A.

Đăng ký, login/logout, regenerate/destroy session, password hash và middleware phân quyền. Đã có auth API và kiểm thử; xem hợp đồng để sử dụng.

Khi triển khai, tạo `auth.routes.js`, `auth.controller.js` và `auth.model.js`. Thêm service nếu nghiệp vụ cần. Dùng `require/module.exports`; mount router trong `src/app.js`. Xem catalog để tham khảo MVC và `docs/team-guide.md` để thống nhất API.

Hợp đồng hiện hành: [backend-contract.md](../../../docs/backend-contract.md).
