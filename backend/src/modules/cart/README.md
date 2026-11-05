# Module cart

Phụ trách: Người B. Giỏ guest và user đều nằm trong session do A thiết lập; module này kiểm tra product/quantity, trả trạng thái giỏ và quote server-side.

Routes ánh xạ endpoint HTTP, controller kiểm tra request và response, service giữ quy tắc nghiệp vụ và dùng catalog/voucher service. Session được lưu qua middleware chung, không tạo collection cart riêng.

Hợp đồng hiện hành: docs/backend-contract.md.
