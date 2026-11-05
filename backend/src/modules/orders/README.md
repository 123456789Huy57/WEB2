# Module orders

Phụ trách: Người B. Tạo đơn COD từ session cart, lưu snapshot, chống gửi trùng bằng Idempotency-Key, quản lý ownership và trạng thái. Các thay đổi đơn/kho/voucher dùng chung MongoDB transaction.

Routes ánh xạ endpoint, controller nối HTTP với service; service điều phối cart, catalog, voucher và inventory.

Hợp đồng hiện hành: docs/backend-contract.md.
