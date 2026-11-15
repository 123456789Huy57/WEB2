// Commerce rules (shipping, sale price, quantity steps, order statuses). See docs/api.md.
// Inputs must be validated before calling these helpers.
// Controllers import these rules instead of duplicating them.
const SHIPPING_FEE = 20000;
const FREE_SHIPPING_FROM = 300000;
const ORDER_FLOW = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered'];
const TRANSITIONS = Object.freeze({ pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['shipping', 'cancelled'], shipping: ['delivered'], delivered: [], cancelled: [] });
const CUSTOMER_CANCEL_STATUSES = ['pending', 'confirmed'];
const PAYMENT_METHODS = ['cod', 'vnpay', 'bank'];
const ONLINE_METHODS = ['vnpay', 'bank']; // trả trước: giữ hàng có hạn, chưa trả thì chưa xử lý đơn
const BANK_TIMEOUT_MINUTES = 30; // chuyển khoản cần thêm thời gian mở app ngân hàng
const PAYMENT_TIMEOUT_MINUTES = 15; // đơn VNPay giữ hàng tối đa chừng này phút nếu khách chưa trả tiền
const shippingFee = subtotal => subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
const salePrice = p => p.sale_price > 0 && p.sale_price < p.price ? p.sale_price : p.price;
const quantityStep = p => p.unit.toLowerCase() === 'kg' ? 0.5 : 1;
module.exports = { SHIPPING_FEE, FREE_SHIPPING_FROM, ORDER_FLOW, TRANSITIONS, CUSTOMER_CANCEL_STATUSES, PAYMENT_METHODS, ONLINE_METHODS, PAYMENT_TIMEOUT_MINUTES, BANK_TIMEOUT_MINUTES, shippingFee, salePrice, quantityStep };
