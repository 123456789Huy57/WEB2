// Tải toàn bộ ảnh sản phẩm, nguyên liệu, công thức (đang nằm ở CDN ngoài) về public/img/remote
// rồi sửa link trong public/data/*.json thành ảnh nội bộ. Chạy một lần trên máy có mạng:
//   npm run images
// Chạy lại không sao: ảnh đã tải sẽ được bỏ qua.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const DATA = 'public/data';
const OUT_DIR = 'public/img/remote';
mkdirSync(OUT_DIR, { recursive: true });

const files = {
  products: join(DATA, 'products.json'),
  ingredients: join(DATA, 'ingredients.json'),
  recipes: join(DATA, 'recipes.json')
};
const products = JSON.parse(readFileSync(files.products, 'utf8'));
const ingredients = JSON.parse(readFileSync(files.ingredients, 'utf8'));
const recipes = JSON.parse(readFileSync(files.recipes, 'utf8'));

const isRemote = u => typeof u === 'string' && /^https?:\/\//.test(u);
const localName = u => {
  const ext = (extname(new URL(u).pathname).toLowerCase().match(/^\.(jpe?g|png|webp|gif|avif)$/) || ['.jpg'])[0];
  return createHash('sha1').update(u).digest('hex').slice(0, 16) + ext;
};

const urls = new Set();
for (const p of products) { if (isRemote(p.image_url)) urls.add(p.image_url); (p.gallery || []).filter(isRemote).forEach(u => urls.add(u)); }
for (const i of ingredients) if (isRemote(i.imageUrl)) urls.add(i.imageUrl);
for (const r of recipes) if (isRemote(r.imageUrl)) urls.add(r.imageUrl);

const ok = new Map();
let done = 0, failed = 0;
const queue = [...urls];
async function worker() {
  while (queue.length) {
    const u = queue.shift();
    const name = localName(u), path = join(OUT_DIR, name);
    try {
      if (!existsSync(path)) {
        const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (FreshMart student project)' }, signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (!(res.headers.get('content-type') || '').startsWith('image/')) throw new Error('không phải ảnh');
        writeFileSync(path, Buffer.from(await res.arrayBuffer()));
      }
      ok.set(u, 'img/remote/' + name);
    } catch (e) {
      failed++;
      console.warn('  bỏ qua', u, '-', e.message);
    }
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${urls.size} ảnh`);
  }
}
console.log(`Tải ${urls.size} ảnh về ${OUT_DIR} ...`);
await Promise.all(Array.from({ length: 8 }, worker));

const swap = u => ok.get(u) ?? u;
for (const p of products) { p.image_url = swap(p.image_url); p.gallery = (p.gallery || []).map(swap); }
for (const i of ingredients) i.imageUrl = swap(i.imageUrl);
for (const r of recipes) r.imageUrl = swap(r.imageUrl);
writeFileSync(files.products, JSON.stringify(products, null, 1));
writeFileSync(files.ingredients, JSON.stringify(ingredients, null, 1));
writeFileSync(files.recipes, JSON.stringify(recipes, null, 1));
console.log(`Xong: ${ok.size} ảnh dùng bản nội bộ, ${failed} ảnh lỗi (giữ link cũ).`);
