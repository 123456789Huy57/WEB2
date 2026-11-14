import { Ingredient } from './models';
import { norm } from './storage';

/**
 * Thứ tự hiển thị nguyên liệu trong Meal Planner: nguyên liệu quen thuộc lên trước, hiếm dùng xuống sau.
 *
 * Đây là danh sách chọn tay cho bữa cơm nhà ở Việt Nam (mặc định về trải nghiệm), KHÔNG phải số liệu đo
 * mức độ phổ biến thật. Chỉ dùng id có trong dữ liệu; đổi thứ tự ở đây không ảnh hưởng tới việc ghép món,
 * vì Meal Planner vẫn ghép theo id nguyên liệu.
 *
 * Mức 1 (COMMON): hiện ngay khi mở trang, theo đúng thứ tự dưới đây.
 * Mức 2: các nguyên liệu còn lại, nguyên liệu dùng trong nhiều công thức hơn xếp trước.
 * Mức 3 (SPECIALIZED): đồ làm bánh, đồ uống, loại nấm/rau đặc thù; vẫn chọn được qua "Xem thêm" hoặc tìm kiếm.
 */
export const COMMON_INGREDIENTS: readonly string[] = [
  // Thịt, trứng, hải sản
  'ing-uc-ga-tuoi', 'ing-ba-chi-heo', 'ing-thit-heo-xay', 'ing-than-bo', 'ing-trung-ga-ta', 'ing-tom-su', 'ing-ca-basa',
  // Rau củ
  'ing-ca-chua', 'ing-rau-muong', 'ing-ca-rot', 'ing-khoai-tay', 'ing-hanh-la', 'ing-hanh-tay',
  // Tinh bột
  'ing-gao-thom', 'ing-bun-gao', 'ing-mi-trung',
  // Phổ biến nhưng xếp sau 16 món đầu
  'ing-banh-mi', 'ing-dau-hu', 'ing-xa-lach', 'ing-dua-leo', 'ing-toi', 'ing-muc-ong'
];

export const SPECIALIZED_INGREDIENTS: ReadonlySet<string> = new Set([
  'ing-bot-banh-xeo', 'ing-bot-bap', 'ing-bot-mi', 'ing-bot-san', 'ing-tran-chau', 'ing-hat-sen', 'ing-kem-tuoi',
  'ing-nam-dong-co', 'ing-rieng', 'ing-dua-chua', 'ing-mi-quang', 'ing-duong-phen', 'ing-bot-ca-ri', 'ing-mat-ong',
  'ing-bia', 'ing-nuoc-loc', 'ing-tra-dao', 'ing-tra-den', 'ing-tra-xanh-khong-duong', 'ing-ca-phe-hoa-tan', 'ing-nuoc-suoi'
]);

/** Tên gọi thường ngày, để gõ "thịt gà" vẫn ra "Ức gà tươi", gõ "trứng" ra "Trứng gà ta" */
export const SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'ing-uc-ga-tuoi': ['thịt gà', 'gà'],
  'ing-ba-chi-heo': ['thịt heo', 'thịt lợn', 'ba rọi'],
  'ing-thit-heo-xay': ['thịt heo', 'thịt lợn', 'thịt băm'],
  'ing-than-bo': ['thịt bò'],
  'ing-trung-ga-ta': ['trứng'],
  'ing-tom-su': ['tôm'],
  'ing-ca-basa': ['cá'],
  'ing-ca-hoi': ['cá'],
  'ing-ca-ngu': ['cá'],
  'ing-gao-thom': ['gạo', 'cơm'],
  'ing-mi-trung': ['mì'],
  'ing-hanh-tay': ['củ hành'],
  'ing-dau-hu': ['đậu phụ', 'tàu hũ'],
  'ing-rau-ngo': ['ngò', 'rau mùi'],
  'ing-muc-ong': ['mực'],
  'ing-luon-tuoi': ['lươn'],
  'ing-ghe-tuoi': ['ghẹ', 'cua']
};

const COMMON_RANK = new Map(COMMON_INGREDIENTS.map((id, i) => [id, i]));

/** Mức ưu tiên 1–3 của một nguyên liệu */
export function ingredientTier(id: string): 1 | 2 | 3 {
  return COMMON_RANK.has(id) ? 1 : SPECIALIZED_INGREDIENTS.has(id) ? 3 : 2;
}

/**
 * Xếp danh sách theo mức ưu tiên. Cùng mức 1: theo thứ tự trong COMMON_INGREDIENTS.
 * Cùng mức 2 hoặc 3: nguyên liệu có trong nhiều công thức hơn lên trước, rồi theo tên (so sánh tiếng Việt) để thứ tự luôn ổn định.
 */
export function rankIngredients(list: readonly Ingredient[], recipeUse: ReadonlyMap<string, number>): Ingredient[] {
  return [...list].sort((a, b) => {
    const ta = ingredientTier(a.id), tb = ingredientTier(b.id);
    if (ta !== tb) return ta - tb;
    if (ta === 1) return COMMON_RANK.get(a.id)! - COMMON_RANK.get(b.id)!;
    return (recipeUse.get(b.id) ?? 0) - (recipeUse.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'vi');
  });
}

/**
 * Điểm khớp khi tìm kiếm (0 = không khớp). Tìm trong tên, alias của dữ liệu và tên gọi thường ngày,
 * bỏ dấu để gõ "nam" hay "nấm" đều ra. Tên bắt đầu bằng từ khóa được điểm cao hơn khớp giữa chừng.
 */
export function ingredientMatch(i: Ingredient & { aliases?: string[] }, query: string): number {
  const k = norm(query.trim());
  if (!k) return 0;
  const name = norm(i.name);
  if (name.startsWith(k)) return 3;
  if (name.split(/\s+/).some(w => w.startsWith(k)) || name.includes(k)) return 2;
  const extra = [...(i.aliases ?? []), ...(SEARCH_ALIASES[i.id] ?? [])].map(norm);
  return extra.some(a => a.includes(k) || k.includes(a) && a.length > 2) ? 1 : 0;
}
