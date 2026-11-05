# Sơ đồ database FreshMart (MongoDB)

Database `freshmart`. Bám theo `backend-contract.md` v1: ID là chuỗi, tiền là số nguyên VND, thời gian ISO 8601 UTC. Cột **Quản lý** cho biết phần nào được ghi vào collection.

## Tổng quan

| Collection | Quản lý | Trạng thái | Nội dung |
|---|---|---|---|
| `users` | A | Đã có | Tài khoản khách/admin, mật khẩu băm, token khôi phục |
| `products` | A (thuộc tính, giá) + B (`stock`) | Đã có | Sản phẩm; `stock` chỉ B được đổi |
| `categories` | A | Đã có | Danh mục, danh mục con |
| `sessions` | A | Đã có | Session, CSRF, **giỏ hàng** (`cart`) |
| `auditLogs` | A | Đã có | Nhật ký API ghi, tự xóa sau 90 ngày |
| `orders` | B | Mới | Đơn hàng kèm bản chụp giá/tên/địa chỉ |
| `vouchers` | B | Mới | Mã giảm giá |
| `voucherUsages` | B | Mới | Mỗi lần dùng voucher cho một đơn |
| `inventoryMovements` | B | Mới | Lịch sử tăng/giảm tồn kho |
| `savedVouchers` | B | Tùy chọn | Voucher khách đã lưu |

Giỏ hàng **không** có collection riêng: nằm trong `sessions` ở trường `cart` (contract mục 2).

## Quan hệ

```
users 1───n orders 1───n (items nhúng)
orders 1───n inventoryMovements      (orderId)
orders 1───0..1 voucherUsages        (orderId)
vouchers 1───n voucherUsages         (voucherId)
products 1───n inventoryMovements    (productId)
categories 1───n products            (products.category)
```

Quy tắc nhúng/tách: `items` và `history` nhúng trong đơn vì luôn đi cùng đơn và có giới hạn; `inventoryMovements` và `voucherUsages` tách riêng vì tăng mãi và cần tra cứu độc lập.

## orders

```json
{
  "id": "ord-UUID", "orderCode": "FM-20261105-A1B2C3D4", "userId": "u-UUID",
  "customer": { "name": "", "phone": "", "email": "", "address": "", "note": "" },
  "items": [{ "productId": "p-0053", "productNameSnapshot": "", "unitSnapshot": "Kg",
              "unitPriceSnapshot": 50000, "quantity": 0.5, "lineTotal": 25000 }],
  "subtotal": 25000, "shippingFee": 20000, "productDiscount": 0, "shippingDiscount": 0,
  "discount": 0, "total": 45000, "voucherCode": null,
  "paymentMethod": "cod", "paymentStatus": "unpaid", "paidAt": null,
  "status": "pending",
  "history": [{ "from": null, "to": "pending", "actorId": "u-UUID", "at": "ISO" }],
  "idempotencyKey": "uuid", "requestHash": "sha256",
  "stockRestored": false,
  "createdAt": "ISO", "updatedAt": "ISO"
}
```

- `stockRestored` đảm bảo hoàn kho đúng một lần khi hủy.
- `idempotencyKey`, `requestHash` phục vụ chống đặt trùng; không trả ra API.
- Đọc đơn cũ luôn dùng snapshot, không tính lại từ `products`.

Index: `{id:1}` unique; `{orderCode:1}` unique; `{userId:1, idempotencyKey:1}` unique; `{userId:1, createdAt:-1}` (lịch sử của khách); `{status:1, createdAt:-1}` (admin lọc trạng thái); `{createdAt:-1}` (dashboard).

## vouchers

Cấu trúc theo `public/data/vouchers.json` của frontend, thêm `createdAt`, `updatedAt`.

```json
{ "id": "v-001", "code": "WELCOME10", "title": "", "description": "",
  "category": "product", "discountType": "percent", "discountValue": 10,
  "minOrderValue": 100000, "maxDiscountValue": 50000,
  "usageLimit": 1000, "usedCount": 0,
  "startDate": "2026-01-01", "endDate": "2026-12-31", "isActive": true }
```

`code` lưu chữ hoa, unique. Tăng `usedCount` bằng cập nhật có điều kiện `usedCount < usageLimit` trong cùng transaction với đơn.

Index: `{id:1}` unique; `{code:1}` unique.

## voucherUsages

```json
{ "id": "vu-UUID", "voucherId": "v-001", "code": "WELCOME10", "userId": "u-UUID",
  "orderId": "ord-UUID", "discount": 12500, "usedAt": "ISO" }
```

Index: `{orderId:1}` unique (mỗi đơn một voucher); `{voucherId:1, userId:1}` (kiểm tra giới hạn mỗi người).

## inventoryMovements

```json
{ "id": "im-UUID", "operationId": "ord-UUID:p-0053:out", "productId": "p-0053",
  "type": "order | cancel | adjustment", "quantityDelta": -0.5, "stockAfter": 9.5,
  "orderId": "ord-UUID", "reason": "", "actorId": "u-UUID", "createdAt": "ISO" }
```

`operationId` unique để ghi lại cùng một thao tác không tạo hai bản ghi.

Index: `{operationId:1}` unique; `{productId:1, createdAt:-1}`; `{orderId:1}`.

## savedVouchers (tùy chọn)

```json
{ "userId": "u-UUID", "code": "WELCOME10", "savedAt": "ISO" }
```

Index: `{userId:1, code:1}` unique.

## products — phần liên quan tới B

- `stock` là số (có thể 0.5 với hàng Kg); chỉ `inventory service` được đổi, luôn qua cập nhật có điều kiện `stock >= quantity`.
- `sold_count` tăng khi đơn `delivered` (quy ước đề xuất, cần Đồng xác nhận).
- Thêm index `{stock:1}` để tìm hàng tồn thấp.

## Dữ liệu khởi tạo (seed)

| Dữ liệu | Hiện trạng | Cần làm |
|---|---|---|
| Sản phẩm, danh mục | `npm run seed:catalog` | Đã có |
| Admin | `npm run seed:admin` | Đã có |
| Voucher | Còn trong `frontend/public/data/vouchers.json` | Viết `seed-vouchers.js`, nhập vào `vouchers` |
| Tồn kho ban đầu | Sản phẩm mới `stock=0` | Nhập qua API điều chỉnh kho khi có; tạm thời seed số liệu thử |
| Công thức, nguyên liệu, ánh xạ | JSON tĩnh trong frontend | Chuyển lên MongoDB nếu làm Meal Planner API (giai đoạn sau) |

## Việc cần chốt với Đồng

1. `savedVouchers` có làm trong MVP không.
2. Có giới hạn lượt dùng mỗi người (`perUserLimit`) hay chỉ giới hạn tổng.
3. Thời điểm tăng `sold_count`.
