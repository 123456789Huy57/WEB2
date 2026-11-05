const { getDatabase } = require('../../config/database');
const vouchers = () => getDatabase().collection('vouchers');
const usages = () => getDatabase().collection('voucherUsages');
const saved = () => getDatabase().collection('savedVouchers');
const orders = () => getDatabase().collection('orders');
module.exports = { vouchers, usages, saved, orders };
