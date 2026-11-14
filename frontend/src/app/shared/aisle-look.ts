/** Màu và ảnh của từng quầy, dùng chung cho banner trang danh sách và trang chi tiết sản phẩm.
 *  Màu lặp theo đúng nhịp của khu "Đi chợ theo quầy" ở trang chủ: vàng, xanh đậm, chanh, xanh lá. */
export interface AisleLook {
  /** Màu nền banner */
  bg: string;
  /** Nền tối thì chữ kem */
  dark: boolean;
  /** Màu sáng cho khung ảnh sản phẩm (ảnh nền trắng hòa vào bằng multiply nên nền phải sáng) */
  soft: string;
  /** Ảnh đã tách nền của quầy, nếu có */
  img?: string;
}

const ORDER = ['vegetables', 'fruits', 'meat', 'seafood', 'dairy-eggs', 'rice-grains', 'noodles', 'condiments', 'beverages', 'bakery', 'snacks', 'frozen', 'tea-coffee'];
const PALETTE: Omit<AisleLook, 'img'>[] = [
  { bg: 'var(--yellow)', dark: false, soft: 'var(--yellow)' },
  { bg: 'var(--forest)', dark: true, soft: 'var(--lime)' },
  { bg: 'var(--lime)', dark: false, soft: 'var(--lime)' },
  { bg: 'var(--green)', dark: false, soft: 'var(--yellow)' }
];
const CUT: Record<string, string> = {
  vegetables: 'rau-cu', fruits: 'trai-cay', meat: 'thit', seafood: 'hai-san',
  'dairy-eggs': 'sua-trung', 'rice-grains': 'gao-ngu-coc', noodles: 'mi-goi', condiments: 'gia-vi'
};

/** Màu, ảnh của quầy theo mã quầy. Không có quầy (tất cả, tìm kiếm) thì nền vàng với túi FreshMart */
export function aisleLook(categoryId?: string | null): AisleLook {
  if (!categoryId) return { ...PALETTE[0], img: '/img/cut/tui-freshmart.webp' };
  const i = Math.max(0, ORDER.indexOf(categoryId));
  return { ...PALETTE[i % PALETTE.length], img: CUT[categoryId] ? `/img/cut/bang-gia/${CUT[categoryId]}.webp` : undefined };
}
