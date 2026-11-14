import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService, apiMessage } from './auth.service';
import { ToastService } from './toast.service';
import { store } from './storage';

/**
 * Cộng đồng FreshMart: bài viết, cảm xúc, bình luận, bình chọn lưu trên backend (/api/community), mọi người cùng thấy.
 * Bài mẫu (sample) do db:setup nạp, hiện nhãn "Bài mẫu". Bài và công thức đã lưu: theo tài khoản khi đã đăng nhập,
 * chưa đăng nhập thì nhớ theo thiết bị (localStorage) như wishlist. Bài chỉ giữ `recipeId`, nội dung công thức lấy từ MealPlannerService.
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
  /** Bài mẫu nạp sẵn để trang không trống khi mới chạy */
  sample?: boolean; score?: number;
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
  tag: 'thachthuc15phut', endsAt: Date.parse('2026-11-30T23:59:59+07:00'), baseParticipants: 0
};

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private http = inject(HttpClient);

  readonly posts = signal<CPost[]>([]);
  readonly loaded = signal(false);
  readonly savedPosts = signal<string[]>(store.get('community.saved', []));
  readonly savedRecipes = signal<string[]>(store.get('recipes.saved', []));

  readonly me = computed(() => { const u = this.auth.user(); return u ? { id: u.id, name: u.fullName } : null; });
  readonly challengePosts = computed(() => this.posts().filter(p => p.challengeId === CHALLENGE.id));
  readonly participants = computed(() => CHALLENGE.baseParticipants + new Set(this.challengePosts().map(p => p.authorId)).size);

  constructor() {
    void this.load();
    // Đăng nhập: lấy danh sách đã lưu của tài khoản, gộp với danh sách trên thiết bị
    // untracked: loadSaves đọc savedPosts(); nếu để effect theo dõi thì mỗi lần bấm Lưu/Bỏ lưu lại tải danh sách server về
    // và ghi đè thao tác vừa bấm (bỏ lưu không có tác dụng khi đã đăng nhập)
    effect(() => { if (this.me()) untracked(() => void this.loadSaves()); });
  }

  async load(): Promise<void> {
    try {
      const r = await firstValueFrom(this.http.get<{ items: CPost[] }>('/api/community/posts', { params: { pageSize: 100 } }));
      this.posts.set(r.items);
    } catch { /* mất mạng: giữ danh sách đang có */ } finally { this.loaded.set(true); }
  }
  private async loadSaves(): Promise<void> {
    try {
      const local = { postIds: this.savedPosts(), recipeIds: this.savedRecipes() };
      let s = await firstValueFrom(this.http.get<{ postIds: string[]; recipeIds: string[] }>('/api/community/saves'));
      for (const id of local.postIds.filter(x => !s.postIds.includes(x))) s = await this.putSave('post', id, true);
      for (const id of local.recipeIds.filter(x => !s.recipeIds.includes(x))) s = await this.putSave('recipe', id, true);
      this.savedPosts.set(s.postIds); store.set('community.saved', s.postIds);
      this.savedRecipes.set(s.recipeIds); store.set('recipes.saved', s.recipeIds);
    } catch { /* giữ bản trên thiết bị */ }
  }
  private putSave(kind: 'post' | 'recipe', id: string, saved: boolean) {
    return firstValueFrom(this.http.put<{ postIds: string[]; recipeIds: string[] }>('/api/community/saves', { kind, id, saved }));
  }
  uploadImage(file: File): Promise<string> {
    const body = new FormData();
    body.append('image', file);
    return firstValueFrom(this.http.post<{ imageUrl: string }>('/api/community/uploads', body)).then(r => r.imageUrl);
  }
  private replace(p: CPost): void { this.posts.update(l => l.map(x => (x.id === p.id ? p : x))); }
  private async call(req: Promise<CPost>): Promise<CPost | null> {
    try { const p = await req; this.replace(p); return p; }
    catch (e: unknown) { this.toast.show(apiMessage(e)); return null; }
  }

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
    const uid = this.me()!.id, r = { ...p.reactions };
    if (r[uid] === type) delete r[uid]; else r[uid] = type;
    this.replace({ ...p, reactions: r }); // hiện ngay, server trả bản chính thức
    void this.call(firstValueFrom(this.http.post<CPost>(`/api/community/posts/${p.id}/reactions`, { type })));
  }
  isSaved(id: string): boolean { return this.savedPosts().includes(id); }
  toggleSave(id: string): void {
    const saved = !this.isSaved(id);
    const l = saved ? [...this.savedPosts(), id] : this.savedPosts().filter(x => x !== id);
    this.savedPosts.set(l); store.set('community.saved', l);
    if (this.me()) void this.putSave('post', id, saved).catch(() => undefined);
    this.toast.show(saved ? 'Đã lưu bài viết' : 'Đã bỏ lưu bài viết');
  }
  comment(postId: string, text: string, parentId?: string): boolean {
    const t = text.trim();
    if (!t) return false;
    if (!this.requireLogin('Đăng nhập để bình luận')) return false;
    void this.call(firstValueFrom(this.http.post<CPost>(`/api/community/posts/${postId}/comments`, { text: t.slice(0, 600), ...(parentId ? { parentId } : {}) })));
    return true;
  }
  myVote(p: CPost): string | null { const m = this.me(); return m ? p.poll?.options.find(o => o.votes.includes(m.id))?.id ?? null : null; }
  vote(p: CPost, optionId: string): void {
    if (!this.requireLogin('Đăng nhập để bình chọn')) return;
    void this.call(firstValueFrom(this.http.post<CPost>(`/api/community/posts/${p.id}/votes`, { optionId })));
  }
  async remove(p: CPost): Promise<void> {
    if (this.me()?.id !== p.authorId) return;
    try {
      await firstValueFrom(this.http.delete(`/api/community/posts/${p.id}`));
      this.posts.update(l => l.filter(x => x.id !== p.id));
      this.toast.show('Đã xóa bài viết');
    } catch { this.toast.show('Chưa xóa được bài viết'); }
  }

  // ---- Đăng bài ----
  async publish(d: { type: PostType; text: string; tags: string[]; recipeId?: string; image?: string; challenge?: boolean; poll?: { question: string; options: string[] } }): Promise<CPost | null> {
    if (!this.requireLogin('Đăng nhập để đăng bài')) return null;
    const tags = [...new Set(d.tags.map(t => this.slug(t)).filter(Boolean))];
    if (d.challenge && !tags.includes(CHALLENGE.tag)) tags.push(CHALLENGE.tag);
    const body = {
      type: d.type, text: d.text.trim().slice(0, 2000), tags,
      ...(d.recipeId ? { recipeId: d.recipeId } : {}), ...(d.image ? { image: d.image } : {}), ...(d.challenge ? { challengeId: CHALLENGE.id } : {}),
      ...(d.poll ? { poll: { question: d.poll.question.trim(), options: d.poll.options.map(o => o.trim()).filter(Boolean) } } : {})
    };
    try {
      const post = await firstValueFrom(this.http.post<CPost>('/api/community/posts', body));
      this.posts.update(l => [post, ...l]);
      return post;
    } catch (e: unknown) { this.toast.show(apiMessage(e)); return null; }
  }

  // ---- Công thức đã lưu (dùng chung với Meal Planner) ----
  isRecipeSaved(id: string): boolean { return this.savedRecipes().includes(id); }
  toggleRecipeSaved(id: string): boolean {
    const was = this.isRecipeSaved(id);
    const l = was ? this.savedRecipes().filter(x => x !== id) : [...this.savedRecipes(), id];
    this.savedRecipes.set(l); store.set('recipes.saved', l);
    if (this.me()) void this.putSave('recipe', id, !was).catch(() => undefined);
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
    // Chỉ tông xanh và be: đen dành cho nút, vàng dành cho điểm nhấn (thử thách, nhãn bữa ăn) nên không dùng cho ảnh đại diện
    const palette = ['#1c6e55', '#289e7c', '#d2e07d', '#e4dcc3'];
    let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return palette[h % palette.length];
  }
  avatarInk(color: string): string { return color === '#1c6e55' ? '#fefcf5' : '#121212'; }
  initial(name: string): string { return (name.trim().split(/\s+/).slice(-1)[0] || '?').charAt(0).toUpperCase(); }
}
