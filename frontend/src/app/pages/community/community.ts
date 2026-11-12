import { Component, ElementRef, ViewEncapsulation, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CHALLENGE, COMMUNITY_TAGS, CPost, MEMBERS, POST_TYPE_LABEL, PostType, REACTIONS, CommunityService } from '../../core/community.service';
import { DIFF_LABEL, MEAL_LABEL, MealPlannerService } from '../../core/meal-planner.service';
import { DataService } from '../../core/data.service';
import { ToastService } from '../../core/toast.service';
import { ImgFallbackDirective } from '../../shared/img-fallback.directive';

type Filter = 'all' | PostType | 'saved';

@Component({
  selector: 'fm-community',
  imports: [RouterLink, ImgFallbackDirective],
  templateUrl: './community.html',
  styleUrl: './community.css',
  encapsulation: ViewEncapsulation.None
})
export class Community {
  /** /cong-dong?chia-se=rec-003 : mở sẵn khung đăng bài với món từ Meal Planner */
  readonly share = input<string>(undefined, { alias: 'chia-se' });
  /** /cong-dong?mon=rec-003 : chỉ xem các bài chia sẻ món này */
  readonly mon = input<string>();
  protected cs = inject(CommunityService);
  protected mp = inject(MealPlannerService);
  private data = inject(DataService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected readonly reactions = REACTIONS;
  protected readonly typeLabel = POST_TYPE_LABEL;
  protected readonly meal = MEAL_LABEL;
  protected readonly diff = DIFF_LABEL;
  protected readonly challenge = CHALLENGE;
  protected readonly suggestedTags = COMMUNITY_TAGS;
  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tất cả' }, { id: 'recipe', label: 'Công thức' }, { id: 'question', label: 'Hỏi đáp' }, { id: 'discussion', label: 'Thảo luận' }, { id: 'saved', label: 'Đã lưu' }
  ];

  // ---- Bộ lọc & sắp xếp ----
  protected filter = signal<Filter>('all');
  protected sort = signal<'new' | 'top'>('new');
  protected tagFilter = signal('');
  protected challengeOnly = signal(false);
  protected recipeFilter = computed(() => { const id = this.mon(); return id ? this.mp.recipe(id) ?? null : null; });
  protected counts = computed(() => {
    const l = this.cs.posts();
    return { all: l.length, recipe: l.filter(p => p.type === 'recipe').length, question: l.filter(p => p.type === 'question').length, discussion: l.filter(p => p.type === 'discussion').length, saved: this.cs.savedPosts().length };
  });
  protected feed = computed(() => {
    const f = this.filter(), t = this.tagFilter(), rid = this.mon();
    let l = this.cs.posts().filter(p =>
      (f === 'all' || (f === 'saved' ? this.cs.isSaved(p.id) : p.type === f)) &&
      (!t || p.tags.includes(t)) && (!rid || p.recipeId === rid) && (!this.challengeOnly() || p.challengeId === CHALLENGE.id));
    l = [...l].sort((a, b) => (this.sort() === 'top' ? this.cs.score(b) - this.cs.score(a) : b.createdAt - a.createdAt));
    return l;
  });
  protected trending = computed(() => [...this.cs.posts()].sort((a, b) => this.cs.score(b) - this.cs.score(a)).slice(0, 4));
  protected popularTags = computed(() => {
    const n = new Map<string, number>();
    this.cs.posts().forEach(p => p.tags.forEach(t => n.set(t, (n.get(t) ?? 0) + 1)));
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
  });
  protected poll = computed(() => this.cs.posts().find(p => p.poll) ?? null);
  protected topMembers = computed(() => {
    const score = new Map<string, { id: string; name: string; posts: number; likes: number }>();
    this.cs.posts().forEach(p => {
      const s = score.get(p.authorId) ?? { id: p.authorId, name: p.authorName, posts: 0, likes: 0 };
      s.posts++; s.likes += this.cs.reactionCount(p); score.set(p.authorId, s);
    });
    return [...score.values()].sort((a, b) => b.likes + b.posts * 3 - (a.likes + a.posts * 3)).slice(0, 4);
  });
  protected stats = computed(() => ({ members: 1280 + new Set(this.cs.posts().map(p => p.authorId)).size - MEMBERS.length, recipes: this.counts().recipe, talks: this.counts().question + this.counts().discussion }));
  protected challengeDays = computed(() => Math.max(0, Math.ceil((CHALLENGE.endsAt - Date.now()) / 86_400_000)));
  protected setFilter(f: Filter): void { this.filter.set(f); this.tagFilter.set(''); }
  protected setTag(t: string): void { this.tagFilter.set(this.tagFilter() === t ? '' : t); this.filter.set('all'); }
  protected clearRecipeFilter(): void { void this.router.navigate([], { queryParams: { mon: null }, queryParamsHandling: 'merge' }); }
  protected showChallenge(): void { this.challengeOnly.set(!this.challengeOnly()); this.filter.set('all'); this.tagFilter.set(''); }

  // ---- Công thức gắn trong bài (lấy từ Meal Planner, không sao chép dữ liệu) ----
  protected recipeOf(p: CPost) { return p.recipeId ? this.mp.recipe(p.recipeId) ?? null : null; }
  protected ingNames(id: string, limit = 5): { names: string[]; more: number } {
    const r = this.mp.recipe(id);
    const all = (r?.ingredients ?? []).map(l => this.mp.ingredient(l.ingredientId)?.name).filter((x): x is string => !!x);
    return { names: all.slice(0, limit), more: Math.max(0, all.length - limit) };
  }
  protected cook(id: string): void { void this.router.navigate(['/meal-planner'], { queryParams: { mon: id, tu: 'cong-dong' } }); }
  protected total(p: CPost): number { return p.poll ? p.poll.options.reduce((s, o) => s + o.votes.length, 0) : 0; }
  protected pct(p: CPost, votes: number): number { const t = this.total(p); return t ? Math.round((votes / t) * 100) : 0; }
  protected isMine(p: CPost): boolean { return this.cs.me()?.id === p.authorId; }

  // ---- Bình luận ----
  protected openComments = signal<string[]>([]);
  protected replyTo = signal<string | null>(null);
  protected drafts = signal<Record<string, string>>({});
  protected setDraft(k: string, v: string): void { this.drafts.update(d => ({ ...d, [k]: v })); }
  protected toggleComments(id: string): void { this.openComments.update(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id])); }
  protected topLevel(p: CPost) { return p.comments.filter(c => !c.parentId); }
  protected repliesOf(p: CPost, cid: string) { return p.comments.filter(c => c.parentId === cid); }
  protected sendComment(p: CPost, parentId?: string): void {
    const key = parentId ? 'r:' + parentId : 'p:' + p.id;
    if (this.cs.comment(p.id, this.drafts()[key] ?? '', parentId)) {
      this.setDraft(key, '');
      if (parentId) this.replyTo.set(null);
      if (!this.openComments().includes(p.id)) this.toggleComments(p.id);
    }
  }
  protected startReply(cid: string, authorName: string): void {
    if (!this.cs.requireLogin('Đăng nhập để trả lời bình luận')) return;
    this.replyTo.set(this.replyTo() === cid ? null : cid);
    if (!this.drafts()['r:' + cid]) this.setDraft('r:' + cid, '@' + authorName + ' ');
    setTimeout(() => document.getElementById('r-' + cid)?.focus());
  }

  // ---- Soạn bài ----
  private dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private feedTop = viewChild<ElementRef<HTMLElement>>('feedTop');
  protected dType = signal<PostType>('recipe');
  protected dText = signal('');
  protected dTags = signal<string[]>([]);
  protected dTagInput = signal('');
  protected dRecipe = signal<string | null>(null);
  protected dImage = signal('');
  protected dChallenge = signal(false);
  protected dPoll = signal(false);
  protected dPollQ = signal('');
  protected dPollOpts = signal<string[]>(['', '']);
  protected dRecipeQ = signal('');
  protected dBusy = signal(false);
  protected newId = signal('');
  protected dRecipeObj = computed(() => { const id = this.dRecipe(); return id ? this.mp.recipe(id) ?? null : null; });
  protected recipeHits = computed(() => {
    const k = this.dRecipeQ().trim().toLowerCase();
    return this.data.recipes().filter(r => !k || r.name.toLowerCase().includes(k)).slice(0, 6);
  });

  protected openComposer(type: PostType = 'discussion', recipeId?: string, challenge = false): void {
    if (!this.cs.requireLogin('Đăng nhập để đăng bài')) return;
    this.dType.set(type); this.dText.set(''); this.dTags.set([]); this.dTagInput.set(''); this.dImage.set('');
    this.dRecipe.set(recipeId ?? null); this.dRecipeQ.set(''); this.dChallenge.set(challenge); this.dPoll.set(false); this.dPollQ.set(''); this.dPollOpts.set(['', '']);
    if (recipeId) { const r = this.mp.recipe(recipeId); if (r) this.dTags.set([this.mealTag(r.mealType)]); }
    if (challenge) this.dTags.update(t => [...t, CHALLENGE.tag]);
    if (!this.dlg().nativeElement.open) this.dlg().nativeElement.showModal();
  }
  private mealTag(m: string): string { return ({ breakfast: 'bua-sang', lunch: 'bua-trua', dinner: 'bua-toi', snack: 'an-vat' } as Record<string, string>)[m] ?? 'mon-ngon'; }
  protected closeComposer(): void { this.dlg().nativeElement.close(); }
  protected pickType(t: PostType): void { this.dType.set(t); if (t !== 'recipe') this.dRecipe.set(null); }
  protected pickRecipe(id: string | null): void {
    this.dRecipe.set(id);
    const r = id ? this.mp.recipe(id) : null;
    if (r) this.dTags.update(t => (t.includes(this.mealTag(r.mealType)) ? t : [this.mealTag(r.mealType), ...t]));
  }
  protected toggleTag(t: string): void { this.dTags.update(l => (l.includes(t) ? l.filter(x => x !== t) : l.length < 6 ? [...l, t] : l)); }
  protected addTag(): void {
    const t = this.cs.slug(this.dTagInput());
    if (t && !this.dTags().includes(t) && this.dTags().length < 6) this.dTags.update(l => [...l, t]);
    this.dTagInput.set('');
  }
  protected setPollOpt(i: number, v: string): void { this.dPollOpts.update(l => l.map((x, j) => (j === i ? v : x))); }
  protected addPollOpt(): void { if (this.dPollOpts().length < 4) this.dPollOpts.update(l => [...l, '']); }

  /** Ảnh người dùng chọn được thu nhỏ về tối đa 900px (JPEG) trước khi lưu để không đầy bộ nhớ trình duyệt */
  protected pickImage(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      this.dImage.set(c.toDataURL('image/jpeg', 0.78)); URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); this.toast.show('Không đọc được ảnh này, thử ảnh khác nhé'); };
    img.src = url;
  }

  protected canPublish = computed(() => {
    const t = this.dText().trim();
    if (this.dType() === 'recipe') return !!this.dRecipe() || t.length >= 3;
    if (this.dPoll() && (this.dPollQ().trim().length < 3 || this.dPollOpts().filter(o => o.trim()).length < 2)) return false;
    return t.length >= 3 || (this.dPoll() && this.dPollQ().trim().length >= 3);
  });
  protected publish(): void {
    if (!this.canPublish() || this.dBusy()) return;
    const post = this.cs.publish({
      type: this.dType(), text: this.dText(), tags: this.dTags(), recipeId: this.dType() === 'recipe' ? this.dRecipe() ?? undefined : undefined,
      image: this.dImage() || undefined, challenge: this.dChallenge(),
      poll: this.dPoll() ? { question: this.dPollQ(), options: this.dPollOpts() } : undefined
    });
    if (!post) return;
    this.closeComposer();
    this.filter.set('all'); this.sort.set('new'); this.tagFilter.set(''); this.challengeOnly.set(false);
    if (this.mon()) this.clearRecipeFilter();
    this.newId.set(post.id);
    this.toast.show('Đã đăng bài lên Cộng đồng');
    setTimeout(() => this.feedTop()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    setTimeout(() => this.newId.set(''), 4000);
  }

  constructor() {
    // Luồng A: Meal Planner → ?chia-se=<id món>. Công thức nạp nền nên chờ có dữ liệu rồi mới mở khung đăng bài.
    let handled = '';
    effect(() => {
      const id = this.share();
      if (!id || id === handled) return;
      if (!this.cs.me()) { handled = id; this.cs.requireLogin('Đăng nhập để chia sẻ công thức lên Cộng đồng'); return; }
      if (!this.mp.recipe(id)) return;
      handled = id;
      setTimeout(() => {
        this.openComposer('recipe', id);
        void this.router.navigate([], { queryParams: { 'chia-se': null }, queryParamsHandling: 'merge', replaceUrl: true });
      });
    });
  }
}
