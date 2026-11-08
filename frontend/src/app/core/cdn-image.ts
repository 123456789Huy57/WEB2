/** Chèn biến đổi Cloudinary (f_auto,q_auto,c_limit,w_…) vào URL ảnh chưa có biến đổi; URL khác giữ nguyên. */
export function cdnImage(url: string | undefined | null, width = 480): string {
  if (!url) return '';
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!m || /^[a-z]{1,3}_[^/]*\//.test(m[2])) return url;
  return `${m[1]}f_auto,q_auto,c_limit,w_${width}/${m[2]}`;
}
