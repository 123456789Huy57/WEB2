import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { store } from './storage';

/**
 * Cộng đồng FreshMart (chạy hoàn toàn ở frontend).
 * Chưa có API bài viết/bình luận trên backend, nên dữ liệu mẫu + bài người dùng đăng được lưu bằng `store` (localStorage),
 * cùng cơ chế với giỏ hàng/wishlist. Công thức KHÔNG được sao chép: bài chỉ giữ `recipeId`, nội dung lấy từ MealPlannerService.
 * Khi có backend: thay phần đọc/ghi `posts` bằng gọi API, giữ nguyên kiểu dữ liệu bên dưới.
 */
export type PostType = 'recipe' | 'question' | 'discussion';
export type ReactionType = 'like' | 'love' | 'yum';
export const REACTIONS: { id: ReactionType; icon: string; label: string }[] = [
  { id: 'like', icon: '👍', label: 'Thích' }, { id: 'love', icon: '❤️', label: 'Yêu thích' }, { id: 'yum', icon: '😋', label: 'Thèm quá' }
];
export const POST_TYPE_LABEL: Record<PostType, string> = { recipe: 'Công thức', question: 'Hỏi đáp nấu ăn', discussion: 'Thảo luận' };

export interface CMember { id: string; name: string; title: string; }
export interface CComment { id: string; authorId: string; authorName: string; text: string; createdAt: number; parentId?: string; }
export interface CPollOption { id: string; label: string; votes: string[]; }
export interface CPost {
  id: string; type: PostType; authorId: string; authorName: string; createdAt: number;
  text: string; tags: string[]; image?: string; recipeId?: string; challengeId?: string;
  /** userId → loại cảm xúc */
  reactions: Record<string, ReactionType>;
  comments: CComment[];
  poll?: { question: string; options: CPollOption[] };
}
export interface Challenge { id: string; title: string; description: string; tag: string; endsAt: number; baseParticipants: number; }

const DAY = 86_400_000, HOUR = 3_600_000, MIN = 60_000;
export const MEMBERS: CMember[] = [
  { id: 'm-minhanh', name: 'Minh Anh', title: 'Bếp trưởng tập sự' },
  { id: 'm-thuha', name: 'Thu Hà', title: 'Mẹ bỉm nấu nhanh' },
  { id: 'm-quocbao', name: 'Quốc Bảo', title: 'Người mê món nướng' },
  { id: 'm-lanphuong', name: 'Lan Phương', title: 'Eat clean mỗi ngày' },
  { id: 'm-duchuy', name: 'Đức Huy', title: 'Sinh viên nấu trọ' },
  { id: 'm-ngoctram', name: 'Ngọc Trâm', title: 'Đầu bếp tại gia' }
];
export const COMMUNITY_TAGS = ['mon-nhanh', 'eat-clean', 'mon-nuoc', 'mon-nuong', 'bua-sang', 'meo-bep', 'thuc-don-tuan', 'an-chay'];
export const CHALLENGE: Challenge = {
  id: 'tc-15-phut', title: 'Bữa tối trong 15 phút',
  description: 'Chia sẻ món tối bạn nấu xong trong vòng 15 phút: ít nguyên liệu, gọn bếp, vẫn ngon. Đăng ảnh thành phẩm kèm mẹo của bạn để cùng nhau lên thực đơn cho cả tuần.',
  tag: 'thachthuc15phut', endsAt: Date.now() + 4 * DAY, baseParticipants: 128
};

function seed(): CPost[] {
  const now = Date.now();
  const nm = (id: string) => MEMBERS.find(m => m.id === id)!.name;
  const c = (id: string, by: string, text: string, ago: number, parentId?: string): CComment => ({ id, authorId: by, authorName: nm(by), text, createdAt: now - ago, parentId });
  const R = (...a: [string, ReactionType][]) => Object.fromEntries(a);
  return [
    {
      id: 'post-seed-1', type: 'recipe', authorId: 'm-minhanh', authorName: nm('m-minhanh'), createdAt: now - 2 * HOUR, recipeId: 'rec-022', tags: ['mon-nuoc', 'bua-toi'],
      text: 'Cuối tuần nấu canh chua cá lóc cho cả nhà. Mẹo nhỏ: nêm me sau cùng và cho rau thơm lúc tắt bếp thì nước canh thơm hơn hẳn. Cả nhà ăn sạch nồi luôn!',
      reactions: R(['m-thuha', 'love'], ['m-quocbao', 'yum'], ['m-lanphuong', 'like'], ['m-duchuy', 'yum'], ['m-ngoctram', 'love']),
      comments: [c('c1', 'm-thuha', 'Nhìn ngon quá, tuần sau mình nấu thử. Bạn dùng cá lóc đồng hay cá nuôi vậy?', 90 * MIN), c('c2', 'm-minhanh', 'Mình dùng cá nuôi mua ở FreshMart, ít tanh, thịt chắc nên nấu rất ổn.', 70 * MIN, 'c1'), c('c3', 'm-duchuy', 'Lưu lại công thức rồi nha!', 40 * MIN)]
    },
    {
      id: 'post-seed-2', type: 'question', authorId: 'm-quocbao', authorName: nm('m-quocbao'), createdAt: now - 5 * HOUR, tags: ['meo-bep', 'hoi-dap'],
      text: 'Mình kho thịt ba rọi hay bị dai và khô nước. Mọi người kho khoảng bao lâu, lửa to hay nhỏ thì thịt mềm mà vẫn giữ màu đẹp ạ?',
      reactions: R(['m-ngoctram', 'like'], ['m-lanphuong', 'like']),
      comments: [c('c4', 'm-ngoctram', 'Chần thịt qua nước sôi trước, sau đó kho lửa nhỏ liu riu khoảng 60–75 phút. Nước dừa tươi sẽ giúp thịt mềm và ngọt tự nhiên.', 4 * HOUR), c('c5', 'm-quocbao', 'Cảm ơn bạn, cuối tuần mình thử lại theo cách này!', 3 * HOUR, 'c4')]
    },
    {
      id: 'post-seed-3', type: 'discussion', authorId: 'm-thuha', authorName: nm('m-thuha'), createdAt: now - 9 * HOUR, tags: ['bua-sang', 'mon-nhanh'],
      text: 'Sáng nào cũng 15 phút là phải xong bữa sáng cho cả nhà. Các bạn hay chọn gì để vừa nhanh vừa đủ chất?',
      reactions: R(['m-minhanh', 'like'], ['m-duchuy', 'like'], ['m-lanphuong', 'yum']),
      poll: { question: 'Bữa sáng nhanh gọn của bạn thường là…', options: [
        { id: 'o1', label: 'Trứng ốp la + bánh mì', votes: ['m-duchuy', 'm-minhanh', 'm-quocbao', 'm-thuha'] },
        { id: 'o2', label: 'Yến mạch + trái cây', votes: ['m-lanphuong', 'm-ngoctram'] },
        { id: 'o3', label: 'Phở / bún nấu sẵn', votes: ['m-ngoctram'] },
        { id: 'o4', label: 'Sữa chua + ngũ cốc', votes: [] }
      ] },
      comments: [c('c6', 'm-lanphuong', 'Mình ưu tiên yến mạch chuối, làm tối hôm trước để sáng chỉ việc lấy ra ăn.', 7 * HOUR)]
    },
    {
      id: 'post-seed-4', type: 'recipe', authorId: 'm-duchuy', authorName: nm('m-duchuy'), createdAt: now - 1 * DAY - 2 * HOUR, recipeId: 'rec-001', challengeId: CHALLENGE.id, tags: ['mon-nhanh', CHALLENGE.tag],
      text: 'Tham gia thử thách 15 phút với món trứng xào cà chua quen thuộc. Xong trong 12 phút, tốn đúng 2 quả cà chua và 3 quả trứng. Sinh viên nấu trọ chỉ cần vậy là đủ!',
      reactions: R(['m-minhanh', 'love'], ['m-thuha', 'like'], ['m-quocbao', 'like']),
      comments: [c('c7', 'm-minhanh', 'Cho thêm chút đường khi xào cà chua là bí quyết nhé bạn!', 1 * DAY)]
    },
    {
      id: 'post-seed-5', type: 'recipe', authorId: 'm-lanphuong', authorName: nm('m-lanphuong'), createdAt: now - 1 * DAY - 6 * HOUR, recipeId: 'rec-028', challengeId: CHALLENGE.id, tags: ['eat-clean', CHALLENGE.tag],
      text: 'Gỏi cuốn tôm thịt cho bữa tối nhẹ nhàng. Chuẩn bị rau sẵn từ chiều thì lúc cuốn chỉ mất đúng 15 phút. Nước chấm mình pha thêm chút tắc cho thơm.',
      reactions: R(['m-minhanh', 'yum'], ['m-thuha', 'love'], ['m-duchuy', 'yum'], ['m-ngoctram', 'like']),
      comments: []
    },
    {
      id: 'post-seed-6', type: 'discussion', authorId: 'm-ngoctram', authorName: nm('m-ngoctram'), createdAt: now - 2 * DAY, image: '/img/quay-rau.jpg', tags: ['meo-bep', 'an-chay'],
      text: 'Sáng nay đi chợ gặp mẻ rau muống non mơn mởn. Mình hay quấn khăn giấy ẩm rồi bỏ ngăn mát, để được 4–5 ngày vẫn giòn. Còn bạn bảo quản rau lá thế nào?',
      reactions: R(['m-minhanh', 'like'], ['m-thuha', 'like'], ['m-lanphuong', 'love'], ['m-quocbao', 'like']),
      comments: [c('c8', 'm-thuha', 'Mình cắm gốc vào ly nước như cắm hoa, rau thơm sống được cả tuần luôn.', 2 * DAY - 2 * HOUR)]
    },
    {
      id: 'post-seed-7', type: 'recipe', authorId: 'm-quocbao', authorName: nm('m-quocbao'), createdAt: now - 3 * DAY, recipeId: 'rec-035', tags: ['mon-nuong', 'cuoi-tuan'],
      text: 'Gà nướng mật ong cho buổi tụ họp cuối tuần: ướp qua đêm, nướng 200°C khoảng 35 phút, giữa chừng phết thêm mật ong để da lên màu cánh gián.',
      reactions: R(['m-minhanh', 'yum'], ['m-thuha', 'yum'], ['m-lanphuong', 'like'], ['m-duchuy', 'love'], ['m-ngoctram', 'yum']),
      comments: [c('c9', 'm-duchuy', 'Không có lò nướng thì dùng nồi chiên không dầu được không bạn?', 2 * DAY + 18 * HOUR), c('c10', 'm-quocbao', 'Được nhé, 180°C khoảng 25 phút, nhớ lật mặt giữa chừng.', 2 * DAY + 16 * HOUR, 'c9')]
    },
    {
      id: 'post-seed-8', type: 'question', authorId: 'm-duchuy', authorName: nm('m-duchuy'), createdAt: now - 4 * DAY, tags: ['hoi-dap', 'mon-nhanh'],
      text: 'Nhà mình không có sa tế, muốn xào mực cho đậm vị thì có thể thay bằng gì? Mong mọi người chỉ giúp.',
      reactions: R(['m-ngoctram', 'like']),
      comments: [c('c11', 'm-ngoctram', 'Phi tỏi với ớt băm, thêm chút dầu hào và đường là có vị cay mặn khá giống sa tế.', 3 * DAY + 20 * HOUR)]
    }
  ];
}

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly posts = signal<CPost[]>(store.get<CPost[] | null>('community.posts', null) ?? seed());
  /** Bài đã lưu và công thức đã lưu: lưu theo thiết bị, không cần đăng nhập (giống wishlist) */
  readonly savedPosts = signal<string[]>(store.get('community.saved', []));
  readonly savedRecipes = signal<string[]>(store.get('recipes.saved', []));

  readonly me = computed(() => { const u = this.auth.user(); return u ? { id: u.id, name: u.fullName } : null; });
  readonly challengePosts = computed(() => this.posts().filter(p => p.challengeId === CHALLENGE.id));
  readonly participants = computed(() => CHALLENGE.baseParticipants + new Set(this.challengePosts().filter(p => !MEMBERS.some(m => m.id === p.authorId)).map(p => p.authorId)).size);

  constructor() { if (!store.get<unknown>('community.posts', null)) this.persist(); }

  private persist(): void { store.set('community.posts', this.posts()); }
  private update(id: string, fn: (p: CPost) => CPost): void { this.posts.update(l => l.map(p => (p.id === id ? fn(p) : p))); this.persist(); }

  /** Hành động cần danh tính: chưa đăng nhập thì chuyển tới trang đăng nhập rồi quay lại */
  requireLogin(note = 'Đăng nhập để tham gia cộng đồng'): boolean {
    if (this.me()) return true;
    this.toast.show(note);
    void this.router.navigate(['/dang-nhap'], { queryParams: { next: this.router.url } });
    return false;
  }

  // ---- Tương tác bài viết ----
  myReaction(p: CPost): ReactionType | null { const m = this.me(); return m ? p.reactions[m.id] ?? null : null; }
  react(p: CPost, type: ReactionType): void {
    if (!this.requireLogin('Đăng nhập để thả cảm xúc')) return;
    const uid = this.me()!.id;
    this.update(p.id, x => {
      const r = { ...x.reactions };
      if (r[uid] === type) delete r[uid]; else r[uid] = type;
      return { ...x, reactions: r };
    });
  }
  isSaved(id: string): boolean { return this.savedPosts().includes(id); }
  toggleSave(id: string): void {
    const l = this.isSaved(id) ? this.savedPosts().filter(x => x !== id) : [...this.savedPosts(), id];
    this.savedPosts.set(l); store.set('community.saved', l);
    this.toast.show(this.isSaved(id) ? 'Đã lưu bài viết' : 'Đã bỏ lưu bài viết');
  }
  comment(postId: string, text: string, parentId?: string): boolean {
    const t = text.trim();
    if (!t) return false;
    if (!this.requireLogin('Đăng nhập để bình luận')) return false;
    const m = this.me()!;
    const cm: CComment = { id: 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), authorId: m.id, authorName: m.name, text: t.slice(0, 600), createdAt: Date.now(), parentId };
    this.update(postId, p => ({ ...p, comments: [...p.comments, cm] }));
    return true;
  }
  myVote(p: CPost): string | null { const m = this.me(); return m ? p.poll?.options.find(o => o.votes.includes(m.id))?.id ?? null : null; }
  vote(p: CPost, optionId: string): void {
    if (!this.requireLogin('Đăng nhập để bình chọn')) return;
    const uid = this.me()!.id;
    this.update(p.id, x => x.poll ? { ...x, poll: { ...x.poll, options: x.poll.options.map(o => ({ ...o, votes: o.id === optionId ? (o.votes.includes(uid) ? o.votes.filter(v => v !== uid) : [...o.votes, uid]) : o.votes.filter(v => v !== uid) })) } } : x);
  }
  remove(p: CPost): void {
    if (this.me()?.id !== p.authorId) return;
    this.posts.update(l => l.filter(x => x.id !== p.id)); this.persist();
    this.toast.show('Đã xóa bài viết');
  }

  // ---- Đăng bài ----
  publish(d: { type: PostType; text: string; tags: string[]; recipeId?: string; image?: string; challenge?: boolean; poll?: { question: string; options: string[] } }): CPost | null {
    if (!this.requireLogin('Đăng nhập để đăng bài')) return null;
    const m = this.me()!;
    const tags = [...new Set(d.tags.map(t => this.slug(t)).filter(Boolean))];
    if (d.challenge && !tags.includes(CHALLENGE.tag)) tags.push(CHALLENGE.tag);
    const post: CPost = {
      id: 'post-' + Date.now().toString(36), type: d.type, authorId: m.id, authorName: m.name, createdAt: Date.now(),
      text: d.text.trim().slice(0, 2000), tags, reactions: {}, comments: [],
      ...(d.recipeId ? { recipeId: d.recipeId } : {}), ...(d.image ? { image: d.image } : {}), ...(d.challenge ? { challengeId: CHALLENGE.id } : {}),
      ...(d.poll ? { poll: { question: d.poll.question.trim(), options: d.poll.options.filter(o => o.trim()).map((label, i) => ({ id: 'o' + (i + 1), label: label.trim(), votes: [] })) } } : {})
    };
    this.posts.update(l => [post, ...l]); this.persist();
    return post;
  }

  // ---- Công thức đã lưu (dùng chung với Meal Planner) ----
  isRecipeSaved(id: string): boolean { return this.savedRecipes().includes(id); }
  toggleRecipeSaved(id: string): boolean {
    const was = this.isRecipeSaved(id);
    const l = was ? this.savedRecipes().filter(x => x !== id) : [...this.savedRecipes(), id];
    this.savedRecipes.set(l); store.set('recipes.saved', l);
    this.toast.show(was ? 'Đã bỏ lưu công thức' : 'Đã lưu công thức');
    return !was;
  }
  postsForRecipe(id: string): CPost[] { return this.posts().filter(p => p.recipeId === id); }

  // ---- Tiện ích hiển thị ----
  slug(t: string): string {
    return t.trim().toLowerCase().replace(/^#/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  }
  reactionCount(p: CPost): number { return Object.keys(p.reactions).length; }
  topReactions(p: CPost): string[] {
    const n: Record<string, number> = {};
    Object.values(p.reactions).forEach(r => (n[r] = (n[r] ?? 0) + 1));
    return Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 3).map(r => REACTIONS.find(x => x.id === r)!.icon);
  }
  score(p: CPost): number { return this.reactionCount(p) + p.comments.length * 2 + (p.poll ? p.poll.options.reduce((s, o) => s + o.votes.length, 0) : 0); }
  timeAgo(ts: number): string {
    const d = Date.now() - ts;
    if (d < MIN) return 'Vừa xong';
    if (d < HOUR) return Math.floor(d / MIN) + ' phút trước';
    if (d < DAY) return Math.floor(d / HOUR) + ' giờ trước';
    if (d < 2 * DAY) return 'Hôm qua';
    if (d < 7 * DAY) return Math.floor(d / DAY) + ' ngày trước';
    return new Date(ts).toLocaleDateString('vi-VN');
  }
  member(id: string): CMember | undefined { return MEMBERS.find(m => m.id === id); }
  /** Màu avatar cố định theo id, lấy từ bảng màu thương hiệu */
  avatarColor(id: string): string {
    const palette = ['#1c6e55', '#ffc517', '#d2e07d', '#289e7c', '#121212', '#e4dcc3'];
    let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return palette[h % palette.length];
  }
  avatarInk(color: string): string { return ['#1c6e55', '#121212'].includes(color) ? '#fefcf5' : '#121212'; }
  initial(name: string): string { return (name.trim().split(/\s+/).slice(-1)[0] || '?').charAt(0).toUpperCase(); }
}
