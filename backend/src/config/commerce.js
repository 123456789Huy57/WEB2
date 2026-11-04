// See docs/backend-contract.md. Inputs must be validated before calling these helpers.
// Shared contract v1. B imports these rules; do not duplicate them in controllers.
const SHIPPING_FEE = 20000;
const FREE_SHIPPING_FROM = 300000;
const ORDER_FLOW = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered'];
const TRANSITIONS = Object.freeze({ pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['shipping', 'cancelled'], shipping: ['delivered'], delivered: [], cancelled: [] });
const CUSTOMER_CANCEL_STATUSES = ['pending', 'confirmed'];
const PAYMENT_METHODS = ['cod'];
const shippingFee = subtotal => subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
const salePrice = p => p.sale_price > 0 && p.sale_price < p.price ? p.sale_price : p.price;
const quantityStep = p => p.unit.toLowerCase() === 'kg' ? 0.5 : 1;
module.exports = { SHIPPING_FEE, FREE_SHIPPING_FROM, ORDER_FLOW, TRANSITIONS, CUSTOMER_CANCEL_STATUSES, PAYMENT_METHODS, shippingFee, salePrice, quantityStep };
