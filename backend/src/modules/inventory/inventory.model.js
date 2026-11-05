const { getDatabase } = require('../../config/database');
const products = () => getDatabase().collection('products');
const movements = () => getDatabase().collection('inventoryMovements');
module.exports = { products, movements };
