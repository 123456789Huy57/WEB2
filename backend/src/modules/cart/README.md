# Module cart

Phụ trách: Người B.

Giỏ guest qua req.session.cart, giỏ tài khoản nếu chọn lưu bền, merge sau login. Thống nhất contract với A trước khi code.

Khi triển khai, tạo `cart.routes.js`, `cart.controller.js` và `cart.model.js`. Thêm service nếu nghiệp vụ cần. Dùng `require/module.exports`; mount router trong `src/app.js`. Xem catalog để tham khảo MVC và `docs/team-guide.md` để thống nhất API.
