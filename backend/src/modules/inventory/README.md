# Module inventory

Phụ trách: Người B. Đây là nơi duy nhất cập nhật stock, luôn dùng update có điều kiện, ghi inventory movement và hỗ trợ idempotency cho điều chỉnh thủ công. Catalog chỉ đọc stock.

Routes áp dụng quyền admin, controller nhận request; service dùng trong điều chỉnh kho và transaction đơn hàng.

Hợp đồng hiện hành: docs/backend-contract.md.
