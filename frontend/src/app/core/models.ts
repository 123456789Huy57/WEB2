/** Kiểu dữ liệu khớp với file JSON của Web1 (public/data). Khi có backend, API trả về đúng các kiểu này. */
export interface Nutrition {
  energy_kcal?: number; protein?: number; fat?: number; carbohydrates?: number; sugars?: number; fiber?: number; salt?: number;
}
export interface Product {
  id: string; slug: string; name: string; brand?: string; active?: boolean;
  category: string; categoryName: string; subcategory?: string; subcategoryName?: string;
  description: string; price: number; sale_price: number; unit: string; stock: number;
  rating?: number; review_count?: number; sold_count: number;
  image_url: string; img?: string; gallery: string[];
  origin?: string; badges?: string[]; nutrition?: Nutrition;
  netWeightGram?: number; unitWeightGram?: number; sellUnit?: string; tags?: string[];
  usage?: string; storage?: string;
}
export interface Category {
  id: string; slug: string; name: string; description: string; active?: boolean; productCount: number; sortOrder: number;
  subcategories: { id: string; name: string }[];
}
export interface Voucher {
  id: string; code: string; title: string; description: string;
  category: 'product' | 'shipping'; discountType: 'percent' | 'fixed'; discountValue: number;
  minOrderValue: number; maxDiscountValue?: number | null; startDate: string; endDate: string; isActive: boolean;
  /** all: mọi khách đăng nhập; new_customer: chỉ khách chưa có đơn */
  audience?: 'all' | 'new_customer'; perUserLimit?: number; usageLimit?: number | null; usedCount?: number;
  /** Số suất còn lại; null = không giới hạn */
  remaining?: number | null; saved?: boolean; usedByMe?: number;
}
export interface RecipeLine { productId: string; ingredientId: string; quantity: number; unit: string; }
export interface RecipeStep { title: string; description: string; durationMinutes?: number; tip?: string; }
export interface Recipe {
  id: string; slug: string; name: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number; prepTimeMinutes: number; cookTimeMinutes: number; difficulty: 'easy' | 'medium' | 'hard';
  imageUrl: string; ingredients: RecipeLine[]; steps: Array<string | RecipeStep>;
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  tags: string[]; goalTags?: string[]; isActive?: boolean;
  /** Nội dung hướng dẫn (đồng bộ bằng npm run db:sync) */
  description?: string; tips?: string[]; seasonings?: { name: string; amount?: string }[]; servingNote?: string; storage?: string;
}
export interface Ingredient {
  id: string; slug: string; name: string; categoryId: string; defaultUnit: string; unitWeightGram?: number;
  imageUrl: string; isActive?: boolean;
}
export interface IngredientProductMap { [ingredientId: string]: { preferredProductId?: string; productIds?: string[] } }
export interface Store { id: string; name: string; address: string; phone: string; hours: string; }

export type Role = 'customer' | 'admin';
export interface User { id: string; fullName: string; email: string; phone: string; address: string; role: Role; isActive?: boolean; createdAt?: string; }
export type PaymentMethod = 'cod' | 'vnpay' | 'bank';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';
/** Dòng đơn lưu bản chụp tên/giá lúc đặt (backend-contract mục 6) */
export interface OrderItem {
  productId: string; productNameSnapshot: string; unitSnapshot: string; unitPriceSnapshot: number;
  quantity: number; lineTotal: number; image_url?: string;
}
export interface OrderHistory { from: OrderStatus | null; to: OrderStatus; actorId?: string; at: string; }
export interface Order {
  id: string; orderCode: string; userId: string; createdAt: string; updatedAt?: string;
  status: OrderStatus; items: OrderItem[];
  subtotal: number; shippingFee: number; productDiscount: number; shippingDiscount: number; discount: number; total: number;
  voucherCode: string | null; paymentMethod: PaymentMethod; paymentStatus: 'unpaid' | 'paid' | 'refunded'; paidAt?: string | null; paymentDueAt?: string;
  customer: { name: string; phone: string; email?: string; address: string; note?: string; slot?: string };
  history: OrderHistory[];
}
export interface CheckoutInfo { name: string; phone: string; email: string; address: string; note: string; slot: string; payment: PaymentMethod; }
/** Giỏ/báo giá do server tính (backend-contract mục 4) */
export interface CartIssue { productId: string; code: string; available?: number; requested?: number; step?: number; }
export interface ServerCart {
  items: { productId: string; quantity: number; unitPrice: number; lineTotal: number; product: Partial<Product> & { id: string; name: string; unit: string } }[];
  subtotal: number; shippingFee: number; productDiscount: number; shippingDiscount: number; discount: number; total: number;
  voucherCode: string | null; issues?: CartIssue[];
}
