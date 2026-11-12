// Số liệu tổng quan cho admin. Doanh thu = tổng tiền các đơn không bị hủy (giống quy ước trên giao diện);
// "đã thu" = đơn COD đã giao (paymentStatus = paid). Mọi con số tính bằng aggregation trong MongoDB.
const router = require('express').Router();
const { getDatabase } = require('../../config/database');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { LOW_STOCK } = require('../inventory/inventory.service');

const VN = 7 * 60 * 60 * 1000;
const vnDay = ms => new Date(ms + VN).toISOString().slice(0, 10);

router.get('/admin/dashboard', requireAuth, requireAdmin, async (req, res) => {
  const db = getDatabase();
  const orders = db.collection('orders');
  const days = [...Array(7)].map((_, i) => vnDay(Date.now() - (6 - i) * 86400000));
  const since = new Date(Date.parse(`${days[0]}T00:00:00+07:00`)).toISOString();
  const live = { status: { $ne: 'cancelled' } };
  const [money, byStatus, byDay, top, recent, customers, lowStock, activeProducts] = await Promise.all([
    orders.aggregate([{ $match: live }, { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 }, collected: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] } } } }]).toArray(),
    orders.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    orders.aggregate([
      { $match: { ...live, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: { $dateFromString: { dateString: '$createdAt' } }, timezone: '+07:00' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]).toArray(),
    orders.aggregate([
      { $match: live }, { $unwind: '$items' },
      { $group: { _id: '$items.productId', name: { $first: '$items.productNameSnapshot' }, unit: { $first: '$items.unitSnapshot' }, qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
      { $sort: { qty: -1 } }, { $limit: 8 },
    ]).toArray(),
    orders.find({}, { projection: { _id: 0, id: 1, orderCode: 1, 'customer.name': 1, createdAt: 1, total: 1, status: 1 } }).sort({ createdAt: -1 }).limit(6).toArray(),
    db.collection('users').countDocuments({ role: 'customer' }),
    db.collection('products').find({ active: { $ne: false }, stock: { $lte: LOW_STOCK } }, { projection: { _id: 0, id: 1, name: 1, unit: 1, stock: 1 } }).sort({ stock: 1 }).limit(20).toArray(),
    db.collection('products').countDocuments({ active: { $ne: false } }),
  ]);
  const m = money[0] || { revenue: 0, count: 0, collected: 0 };
  const perDay = new Map(byDay.map(d => [d._id, d]));
  res.json({
    revenue: m.revenue, collected: m.collected, orders: m.count, averageOrderValue: m.count ? Math.round(m.revenue / m.count) : 0,
    statusCounts: Object.fromEntries(byStatus.map(s => [s._id, s.n])),
    last7Days: days.map(date => ({ date, revenue: perDay.get(date)?.revenue || 0, orders: perDay.get(date)?.orders || 0 })),
    topProducts: top.map(t => ({ productId: t._id, name: t.name, unit: t.unit, qty: t.qty, revenue: t.revenue })),
    recentOrders: recent, customers, activeProducts, lowStock, lowStockThreshold: LOW_STOCK,
  });
});
module.exports = router;
