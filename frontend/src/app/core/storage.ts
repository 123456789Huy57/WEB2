/** Đọc/ghi localStorage an toàn (chế độ ẩn danh có thể ném lỗi). Khi có backend, phần lớn dữ liệu chuyển lên server. */
export const store = {
  get<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem('fm.' + key); return v ? ((JSON.parse(v) as T) ?? fallback) : fallback; } catch { return fallback; }
  },
  set(key: string, value: unknown): void {
    try { localStorage.setItem('fm.' + key, JSON.stringify(value)); } catch { /* bỏ qua */ }
  },
  remove(key: string): void {
    try { localStorage.removeItem('fm.' + key); } catch { /* bỏ qua */ }
  }
};

/** Bỏ dấu tiếng Việt để tìm kiếm: "Cà chua" → "ca chua" */
export function norm(s: string | undefined | null): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

export function vnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN') + ' đ';
}
