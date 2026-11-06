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
}
export interface Category {
  id: string; slug: string; name: string; description: string; productCount: number; sortOrder: number;
  subcategories: { id: string; name: string }[];
}
export interface Voucher {
  id: string; code: string; title: string; description: string;
  category: 'product' | 'shipping'; discountType: 'percent' | 'fixed'; discountValue: number;
  minOrderValue: number; maxDiscountValue?: number | null; startDate: string; endDate: string; isActive: boolean;
}
export interface RecipeLine { productId: string; ingredientId: string; quantity: number; unit: string; }
export interface RecipeStep { title: string; description: string; durationMinutes?: number; tip?: string; }
export interface Recipe {
  id: string; slug: string; name: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number; prepTimeMinutes: number; cookTimeMinutes: number; difficulty: 'easy' | 'medium' | 'hard';
  imageUrl: string; ingredients: RecipeLine[]; steps: Array<string | RecipeStep>;
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  tags: string[]; goalTags?: string[]; isActive?: boolean;
}
export interface Ingredient {
  id: string; slug: string; name: string; categoryId: string; defaultUnit: string; unitWeightGram?: number;
  imageUrl: string; isActive?: boolean;
}
export interface IngredientProductMap { [ingredientId: string]: { preferredProductId?: string; productIds?: string[] } }
export interface Store { id: string; name: string; address: string; phone: string; hours: string; }

export interface CartLine { id: string; qty: number; }
export type Role = 'customer' | 'admin';
export interface User { id: string; fullName: string; email: string; phone: string; address: string; role: Role; createdAt?: string; }
export interface UserRecord extends User { password: string; }
export type PaymentMethod = 'cod' | 'bank' | 'momo';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';
export interface OrderItem { id: string; qty: number; price: number; }
export interface Order {
  orderCode: string; createdAt: string; updatedAt?: string; status: OrderStatus; items: OrderItem[];
  /** Có khi khách đăng nhập lúc đặt; khách vãng lai tra cứu bằng mã đơn + số điện thoại */
  userId?: string;
  shippingFee: number; discount: number; voucherCode?: string; paymentMethod: PaymentMethod;
  customer?: CheckoutInfo;
}
export interface CheckoutInfo { name: string; phone: string; email: string; address: string; note: string; slot: string; payment: PaymentMethod; }
