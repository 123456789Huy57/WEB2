// Luật kiểm tra dữ liệu ngay trong MongoDB ($jsonSchema + $expr). Xem docs/database-schema.md.
// Code đã validate trước khi ghi; đây là lớp bảo vệ cuối: dù code có lỗi, database vẫn từ chối dữ liệu sai.
// validationLevel "moderate": chỉ kiểm tra khi thêm mới hoặc sửa bản ghi đang hợp lệ, không chặn dữ liệu cũ.

const str = { bsonType: 'string' };
const strOrNull = { bsonType: ['string', 'null'] };
const bool = { bsonType: 'bool' };
const num = { bsonType: 'number' };
const money = { bsonType: 'number', minimum: 0 };
const positive = { bsonType: 'number', minimum: 0, exclusiveMinimum: true };
const strings = { bsonType: 'array', items: str };
const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'cancelled'];

const ifNull = (field, fallback) => ({ $ifNull: [`$${field}`, fallback] });

const collections = {
  users: {
    schema: {
      required: ['id', 'role', 'passwordHash', 'isActive', 'createdAt'],
      properties: {
        id: str, fullName: str, email: str, phone: str, username: str, address: str,
        role: { enum: ['customer', 'admin'] }, isActive: bool, authVersion: num, passwordHash: str,
        createdAt: str, updatedAt: str,
      },
    },
  },

  categories: {
    schema: {
      required: ['id', 'name', 'slug'],
      properties: {
        id: str, name: str, slug: str, description: str, sortOrder: num, active: bool,
        subcategories: { bsonType: 'array', items: { bsonType: 'object', required: ['id', 'name'], properties: { id: str, name: str } } },
      },
    },
  },

  products: {
    schema: {
      required: ['id', 'name', 'slug', 'category', 'price', 'unit', 'stock'],
      properties: {
        id: str, name: str, slug: str, brand: str, category: str, subcategory: str, description: str,
        price: positive, sale_price: money, unit: str, stock: money, sold_count: money,
        rating: { bsonType: 'number', minimum: -1, maximum: 5 }, review_count: money, // rating -1: chưa có đánh giá
        image_url: str, gallery: strings, badges: strings, tags: strings, active: bool,
        origin: strOrNull, sellUnit: strOrNull,
        netWeightGram: { bsonType: ['number', 'null'] }, unitWeightGram: { bsonType: ['number', 'null'] },
        nutrition: { bsonType: 'object' },
      },
    },
    // Giá giảm (nếu có) phải thấp hơn giá gốc.
    expr: { $or: [{ $eq: [ifNull('sale_price', 0), 0] }, { $lt: ['$sale_price', '$price'] }] },
  },

  orders: {
    schema: {
      required: ['id', 'orderCode', 'userId', 'customer', 'items', 'subtotal', 'shippingFee', 'productDiscount', 'shippingDiscount', 'discount', 'total', 'paymentMethod', 'paymentStatus', 'status', 'history', 'createdAt'],
      properties: {
        id: str, orderCode: { bsonType: 'string', pattern: '^FM-\\d{8}-[A-Z0-9]{8}$' }, userId: str,
        customer: {
          bsonType: 'object', required: ['name', 'phone', 'address'],
          properties: { name: str, phone: { bsonType: 'string', pattern: '^0\\d{9}$' }, email: str, address: str, note: str },
        },
        items: {
          bsonType: 'array', minItems: 1,
          items: {
            bsonType: 'object',
            required: ['productId', 'productNameSnapshot', 'unitSnapshot', 'unitPriceSnapshot', 'quantity', 'lineTotal'],
            properties: { productId: str, productNameSnapshot: str, unitSnapshot: str, unitPriceSnapshot: positive, quantity: positive, lineTotal: money },
          },
        },
        subtotal: money, shippingFee: money, productDiscount: money, shippingDiscount: money, discount: money, total: money,
        voucherCode: strOrNull,
        paymentMethod: { enum: ['cod'] }, paymentStatus: { enum: ['unpaid', 'paid'] }, paidAt: strOrNull,
        status: { enum: ORDER_STATUSES },
        history: {
          bsonType: 'array',
          items: { bsonType: 'object', required: ['to', 'at'], properties: { from: { enum: [...ORDER_STATUSES, null] }, to: { enum: ORDER_STATUSES }, actorId: str, at: str } },
        },
        idempotencyKey: str, requestHash: str, stockRestored: bool, createdAt: str, updatedAt: str,
      },
    },
    // Tổng tiền phải khớp công thức; giảm giá không vượt phần được giảm; đã giao thì đã thanh toán.
    expr: {
      $and: [
        { $eq: ['$discount', { $add: ['$productDiscount', '$shippingDiscount'] }] },
        { $eq: ['$total', { $subtract: [{ $add: ['$subtotal', '$shippingFee'] }, '$discount'] }] },
        { $lte: ['$productDiscount', '$subtotal'] },
        { $lte: ['$shippingDiscount', '$shippingFee'] },
        { $or: [{ $ne: ['$status', 'delivered'] }, { $eq: ['$paymentStatus', 'paid'] }] },
      ],
    },
  },

  vouchers: {
    schema: {
      required: ['id', 'code', 'category', 'discountType', 'discountValue', 'minOrderValue', 'audience', 'perUserLimit', 'usedCount', 'startDate', 'endDate', 'isActive'],
      properties: {
        id: str, code: { bsonType: 'string', pattern: '^[A-Z0-9_-]{3,30}$' }, title: str, description: str,
        category: { enum: ['product', 'shipping'] }, discountType: { enum: ['percent', 'fixed'] },
        discountValue: positive, minOrderValue: money, maxDiscountValue: { bsonType: ['number', 'null'], minimum: 0 },
        audience: { enum: ['all', 'new_customer'] }, perUserLimit: { bsonType: 'number', minimum: 1 },
        usageLimit: { bsonType: ['number', 'null'], minimum: 1 }, usedCount: money,
        startDate: str, endDate: str, isActive: bool,
      },
    },
    // Không vượt tổng suất; giảm % tối đa 100; ngày kết thúc không trước ngày bắt đầu.
    expr: {
      $and: [
        { $or: [{ $eq: [ifNull('usageLimit', null), null] }, { $lte: ['$usedCount', '$usageLimit'] }] },
        { $or: [{ $ne: ['$discountType', 'percent'] }, { $lte: ['$discountValue', 100] }] },
        { $lte: ['$startDate', '$endDate'] },
      ],
    },
  },

  voucherUsages: {
    schema: {
      required: ['id', 'voucherId', 'code', 'userId', 'orderId', 'discount', 'usedAt'],
      properties: { id: str, voucherId: str, code: str, userId: str, orderId: str, discount: money, usedAt: str },
    },
  },

  savedVouchers: {
    schema: { required: ['userId', 'code', 'savedAt'], properties: { userId: str, code: str, savedAt: str } },
  },

  inventoryMovements: {
    schema: {
      required: ['id', 'operationId', 'productId', 'type', 'quantityDelta', 'stockAfter', 'actorId', 'createdAt'],
      properties: {
        id: str, operationId: str, productId: str, type: { enum: ['order', 'cancel', 'adjustment'] },
        quantityDelta: num, stockAfter: money, orderId: strOrNull, reason: str, actorId: str, createdAt: str,
      },
    },
    expr: { $ne: ['$quantityDelta', 0] },
  },

  recipes: {
    schema: {
      required: ['id', 'slug', 'name', 'mealType', 'servings', 'ingredients', 'steps'],
      properties: {
        id: str, slug: str, name: str, mealType: { enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        servings: positive, prepTimeMinutes: money, cookTimeMinutes: money, difficulty: { enum: ['easy', 'medium', 'hard'] },
        imageUrl: str, steps: strings, tags: strings, goalTags: strings, isActive: bool, nutrition: { bsonType: 'object' },
        ingredients: {
          bsonType: 'array', minItems: 1,
          items: { bsonType: 'object', required: ['ingredientId', 'quantity', 'unit'], properties: { ingredientId: str, productId: str, quantity: positive, unit: str } },
        },
      },
    },
  },

  ingredients: {
    schema: {
      required: ['id', 'slug', 'name', 'defaultUnit'],
      properties: { id: str, slug: str, name: str, categoryId: str, defaultUnit: str, unitWeightGram: positive, imageUrl: str, aliases: strings, isActive: bool, nutritionPer100g: { bsonType: 'object' } },
    },
  },

  ingredientProducts: {
    schema: {
      required: ['ingredientId', 'productIds'],
      properties: { ingredientId: str, preferredProductId: str, mealProductId: str, productIds: strings },
    },
  },

  stores: {
    schema: { required: ['id', 'name', 'address'], properties: { id: str, name: str, address: str, phone: str, hours: str } },
  },
};

function validator(name) {
  const { schema, expr } = collections[name];
  const jsonSchema = { $jsonSchema: { bsonType: 'object', ...schema } };
  return expr ? { $and: [jsonSchema, { $expr: expr }] } : jsonSchema;
}

module.exports = { collections, validator, ORDER_STATUSES };
