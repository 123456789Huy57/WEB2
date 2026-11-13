import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../core/data.service';
import { cdnImage } from '../core/cdn-image';
import { ToastService } from '../core/toast.service';

type Kind = 'products' | 'ingredients' | 'recipes';
interface Item { kind: Kind; id: string; name: string; group: string; url: string; link: unknown[] | null; temp?: boolean; hidden?: boolean; }
interface Check { hash?: string; color?: number[]; width?: number; error?: boolean; }

const TABS: { key: Kind; label: string }[] = [{ key: 'products', label: 'Sản phẩm' }, { key: 'ingredients', label: 'Nguyên liệu' }, { key: 'recipes', label: 'Món ăn' }];
const MARK_KEY = 'fm.imageAudit.marks';

/**
 * Rà ảnh: lưới toàn bộ ảnh sản phẩm, nguyên liệu, món ăn để phát hiện ảnh trùng, ảnh tạm, ảnh lỗi.
 * Ảnh trùng được so theo NỘI DUNG (dấu vân tay dHash 64 bit tính bằng canvas ngay trong trình duyệt),
 * vì cùng một ảnh upload lên Cloudinary nhiều lần sẽ có đường dẫn khác nhau.
 * Bấm vào ô để đánh dấu "sai ảnh"; nút Sao chép đưa danh sách ra clipboard để gửi lại.
 */
@Component({
  selector: 'fm-admin-image-audit',
  imports: [RouterLink],
  template: `
    <div class="adm-head"><div><h1 class="h2">Rà ảnh</h1>
      <p>Bấm vào ô có ảnh <b>không đúng tên</b> để đánh dấu. Hệ thống tự gắn nhãn ảnh trùng nội dung, ảnh tạm, ảnh lỗi và ảnh quá nhỏ.</p></div></div>
    <div class="toolbar">
      <div class="tabs" role="group" aria-label="Loại ảnh">
        @for (t of tabs; track t.key) { <button class="tab" type="button" [attr.aria-pressed]="tab() === t.key" (click)="tab.set(t.key)">{{ t.label }} <span class="num">({{ count(t.key) }})</span></button> }
      </div>
    </div>
    <div class="toolbar">
      <input class="adm-input" type="search" placeholder="Tìm tên hoặc mã" [value]="q()" (input)="q.set($any($event.target).value)" aria-label="Tìm">
      <select class="adm-input" [value]="filter()" (change)="filter.set($any($event.target).value)" aria-label="Lọc">
        <option value="all">Tất cả</option><option value="issue">Có vấn đề (tự phát hiện)</option><option value="marked">Đã đánh dấu sai</option>
      </select>
      <span class="pill">{{ progress() }}</span>
      <span class="pill warn">{{ issueCount() }} có vấn đề</span>
      <span class="pill">{{ markedHere() }} đã đánh dấu</span>
      <button class="btn btn-forest btn-sm" type="button" (click)="copy()">Sao chép danh sách</button>
      @if (markedHere()) { <button class="btn btn-stone btn-sm" type="button" (click)="clearMarks()">Bỏ đánh dấu tab này</button> }
    </div>
    <ul class="ia-grid">
      @for (it of shown(); track it.kind + it.id) {
        <li [class.marked]="isMarked(it)">
          <button class="ia-pic" type="button" (click)="toggle(it)" [attr.aria-pressed]="isMarked(it)" [attr.aria-label]="'Đánh dấu sai ảnh: ' + it.name">
            @if (it.url) { <img [src]="thumb(it)" alt="" loading="lazy" decoding="async"> } @else { <span class="ia-none">Không có ảnh</span> }
            @if (isMarked(it)) { <span class="ia-x">Sai ảnh</span> }
          </button>
          <div class="ia-meta">
            @if (it.link) { <a class="ia-name" [routerLink]="it.link" target="_blank">{{ it.name }}</a> } @else { <span class="ia-name">{{ it.name }}</span> }
            <span class="small muted">{{ it.id }} · {{ it.group }}</span>
            <span class="ia-flags">@for (f of flags(it); track f) { <span class="pill warn">{{ f }}</span> }</span>
          </div>
        </li>
      } @empty { <li class="empty-row">Không có ảnh nào khớp bộ lọc.</li> }
    </ul>
  `,
  styles: [`
    .ia-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
    .ia-grid li { background: var(--paper); border-radius: 6px; overflow: hidden; outline: 3px solid transparent; }
    .ia-grid li.marked { outline-color: var(--sale); }
    .ia-pic { position: relative; display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 0; background: #fff; cursor: pointer; }
    .ia-pic img { width: 100%; height: 100%; object-fit: contain; }
    .ia-none { display: grid; place-items: center; height: 100%; color: var(--sale); font-size: 13px; }
    .ia-x { position: absolute; inset: auto 6px 6px auto; padding: 2px 8px; border-radius: 3px; background: var(--sale); color: #fff; font-size: 12px; font-weight: 600; }
    .ia-meta { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 12px; }
    .ia-name { font-weight: 600; font-size: 14px; line-height: 1.35; }
    .ia-flags { display: flex; flex-wrap: wrap; gap: 4px; }
    .ia-flags .pill { height: 22px; font-size: 12px; }
  `]
})
export class AdminImageAudit {
  private data = inject(DataService);
  private toast = inject(ToastService);
  protected tabs = TABS;
  protected tab = signal<Kind>('products');
  protected q = signal('');
  protected filter = signal<'all' | 'issue' | 'marked'>('all');
  private checks = signal<Record<string, Check>>({});
  private marks = signal<Set<string>>(this.readMarks());

  private items = computed<Item[]>(() => [
    ...this.data.products().map(p => ({
      kind: 'products' as const, id: p.id, name: p.name, group: p.categoryName || p.category, url: p.img || p.image_url || '', link: ['/san-pham', p.slug || p.id],
      // Sản phẩm "mp-" đã được thay bằng hàng thật (có nguồn) thì không còn là sản phẩm tạm
      temp: p.id.startsWith('mp-') && !(p as { sourceUrl?: string }).sourceUrl, hidden: p.active === false,
    })),
    ...this.data.ingredients().map(i => ({ kind: 'ingredients' as const, id: i.id, name: i.name, group: (i as { categoryId?: string }).categoryId ?? '', url: i.imageUrl || '', link: null })),
    ...this.data.recipes().map(r => ({ kind: 'recipes' as const, id: r.id, name: r.name, group: r.mealType ?? '', url: r.imageUrl || '', link: null })),
  ]);
  protected count = (k: Kind) => this.items().filter(i => i.kind === k).length;

  /** Nhóm ảnh trùng: cùng đường dẫn, hoặc dấu vân tay chênh nhau tối đa 4/64 bit (cùng ảnh, khác nén/khác cỡ) */
  private duplicates = computed(() => {
    const list = this.items(), checks = this.checks(), dup = new Map<string, number>();
    const byUrl = new Map<string, Item[]>();
    for (const it of list) if (it.url && !it.hidden) byUrl.set(`${it.kind}|${it.url}`, [...(byUrl.get(`${it.kind}|${it.url}`) ?? []), it]);
    for (const g of byUrl.values()) if (g.length > 1) for (const it of g) dup.set(this.key(it), g.length);
    const hashed = list.filter(it => !it.hidden && checks[this.key(it)]?.hash);
    for (let a = 0; a < hashed.length; a++) {
      let same = 1;
      const ca = checks[this.key(hashed[a])];
      for (let b = 0; b < hashed.length; b++) {
        if (a === b || hashed[a].kind !== hashed[b].kind) continue;
        const cb = checks[this.key(hashed[b])];
        // Trùng khi cả hình dạng (dHash 256 bit) lẫn màu (lưới 4x4) gần như nhau: chai dầu vàng và chai nước mắm nâu không còn bị coi là một
        if (hamming(ca.hash!, cb.hash!) <= 14 && colorDistance(ca.color, cb.color) <= 12) same++;
      }
      if (same > 1) dup.set(this.key(hashed[a]), Math.max(same, dup.get(this.key(hashed[a])) ?? 0));
    }
    return dup;
  });

  protected flags(it: Item): string[] {
    const c = this.checks()[this.key(it)], out: string[] = [];
    if (!it.url) out.push('Thiếu ảnh');
    if (/\/assets\/images\/cat-|placeholder/i.test(it.url)) out.push('Ảnh tạm theo danh mục');
    if (it.hidden) return ['Đang ẩn']; // không bán: không tính là lỗi ảnh
    if (it.temp) out.push('Sản phẩm tạm (mp-)');
    const d = this.duplicates().get(this.key(it)); if (d) out.push(`Trùng ${d} ảnh`);
    if (c?.error) out.push('Không tải được');
    else if (c?.width && c.width < 300 && !/\.svg(\?|$)/i.test(it.url)) out.push(`Ảnh nhỏ ${c.width}px`); // SVG là ảnh vector, không có độ phân giải
    return out;
  }

  protected shown = computed(() => {
    const k = this.q().trim().toLowerCase(), f = this.filter();
    return this.items().filter(it => it.kind === this.tab()
      && (!k || `${it.name} ${it.id}`.toLowerCase().includes(k))
      && (f === 'all' || (f === 'issue' ? !it.hidden && this.flags(it).length > 0 : this.isMarked(it))));
  });
  protected issueCount = computed(() => this.items().filter(it => it.kind === this.tab() && !it.hidden && this.flags(it).length).length);
  protected markedHere = computed(() => this.items().filter(it => it.kind === this.tab() && this.isMarked(it)).length);
  protected progress = computed(() => {
    const all = this.items().filter(it => it.kind === this.tab() && it.url);
    const done = all.filter(it => this.checks()[this.key(it)]).length;
    return done < all.length ? `Đang so nội dung ảnh ${done}/${all.length}` : 'Đã so nội dung toàn bộ ảnh';
  });

  constructor() {
    void this.data.loadExtras();
    // Tính dấu vân tay cho mọi ảnh (cả 3 loại) khi dữ liệu về; chạy lần lượt vài ảnh một lúc để không nghẽn mạng.
    effect(() => { const list = this.items(); if (list.length) void this.fingerprint(list); });
  }

  protected thumb(it: Item): string { return cdnImage(it.url.startsWith('img/') ? '/' + it.url : it.url, 320); }
  private key(it: Item): string { return `${it.kind}:${it.id}`; }
  protected isMarked(it: Item): boolean { return this.marks().has(this.key(it)); }
  protected toggle(it: Item): void {
    const next = new Set(this.marks()); const k = this.key(it);
    if (next.has(k)) next.delete(k); else next.add(k);
    this.saveMarks(next);
  }
  protected clearMarks(): void {
    this.saveMarks(new Set([...this.marks()].filter(k => !k.startsWith(this.tab() + ':'))));
  }

  /** Danh sách gửi lại để sửa: mọi ô đã đánh dấu + mọi ô tự phát hiện có vấn đề, của cả 3 loại */
  protected async copy(): Promise<void> {
    const lines: string[] = [];
    for (const t of TABS) {
      const rows = this.items().filter(it => it.kind === t.key && (this.isMarked(it) || (!it.hidden && this.flags(it).length)));
      if (!rows.length) continue;
      lines.push(`## ${t.label} (${rows.length})`);
      for (const it of rows) lines.push(`${it.id} | ${it.name} | ${[this.isMarked(it) ? 'ĐÁNH DẤU SAI' : '', ...this.flags(it)].filter(Boolean).join(', ')}`);
    }
    const text = lines.join('\n') || 'Không có ảnh nào có vấn đề.';
    try { await navigator.clipboard.writeText(text); this.toast.show('Đã sao chép. Dán vào khung chat để gửi.'); }
    catch { this.toast.show('Trình duyệt chặn clipboard. Hãy chọn và copy thủ công.'); console.log(text); }
  }

  private running = false;
  private async fingerprint(list: Item[]): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const todo = list.filter(it => it.url && !this.checks()[this.key(it)]);
      for (let i = 0; i < todo.length; i += 6) {
        const batch = todo.slice(i, i + 6);
        const results = await Promise.all(batch.map(it => dHash(this.thumb(it))));
        this.checks.update(c => ({ ...c, ...Object.fromEntries(batch.map((it, j) => [this.key(it), results[j]])) }));
      }
    } finally { this.running = false; }
  }

  private readMarks(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(MARK_KEY) || '[]')); } catch { return new Set(); } }
  private saveMarks(s: Set<string>): void { this.marks.set(s); try { localStorage.setItem(MARK_KEY, JSON.stringify([...s])); } catch { /* chỉ là tiện ích, bỏ qua */ } }
}

/** dHash: thu ảnh về 9×8 xám, so từng điểm với điểm bên phải → 64 bit. Ảnh giống nhau cho chuỗi gần như trùng. */
function dHash(url: string): Promise<Check> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = setTimeout(() => resolve({ error: true }), 15000);
    img.onload = () => {
      clearTimeout(done);
      try {
        const W = 17, H = 16;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
        const d = ctx.getImageData(0, 0, W, H).data;
        const g = (x: number, y: number) => { const i = (y * W + x) * 4; return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; };
        let bits = '';
        for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) bits += g(x, y) > g(x + 1, y) ? '1' : '0';
        // Màu trung bình từng ô của lưới 4x4 (48 số)
        const color: number[] = [];
        for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
          const sum = [0, 0, 0]; let n = 0;
          for (let y = by * 4; y < by * 4 + 4; y++) for (let x = bx * 4; x < bx * 4 + 4; x++) { const i = (y * W + x) * 4; sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; n++; }
          color.push(...sum.map(v => v / n));
        }
        resolve({ hash: bits, color, width: img.naturalWidth });
      } catch { resolve({ width: img.naturalWidth }); } // máy chủ ảnh không cho đọc điểm ảnh (CORS): vẫn biết kích thước, chỉ không so trùng được
    };
    img.onerror = () => { clearTimeout(done); resolve({ error: true }); };
    img.src = url;
  });
}
/** Độ lệch màu trung bình giữa hai ảnh (0–255); thiếu dữ liệu màu thì coi như khác */
function colorDistance(a?: number[], b?: number[]): number {
  if (!a || !b || a.length !== b.length) return 255;
  let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}
function hamming(a: string, b: string): number { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }
