const { getDatabase } = require('../../config/database');
const orders = () => getDatabase().collection('orders');
module.exports = { orders };
