import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../core/toast.service';
import { POST_TYPE_LABEL, PostType } from '../core/community.service';

interface AdminPost {
  id: string; authorName: string; type: PostType; text: string; createdAt: number;
  hidden?: boolean; sample?: boolean; image?: string; comments?: unknown[]; reactions?: Record<string, string>;
}
type Page = { items: AdminPost[]; total: number };
const PAGE = 50;

/** Duyệt bài Cộng đồng: ẩn bài vi phạm (không xóa, hiện lại được), lọc bài đã ẩn, tìm theo nội dung hoặc tác giả */
@Component({
  selector: 'fm-admin-community',
  imports: [DatePipe, RouterLink],
  template: `
    <div class="adm-head"><div><h1 class="h2">Cộng đồng</h1><p>Ẩn bài vi phạm nội quy. Bài ẩn biến mất khỏi trang Cộng đồng nhưng vẫn giữ ở đây để hiện lại khi cần.</p></div></div>
    <div class="toolbar">
      <input class="adm-input" type="search" placeholder="Tìm nội dung, tên tác giả" [value]="q()" (input)="q.set($any($event.target).value)" (keyup.enter)="load()" aria-label="Tìm bài viết">
      <select class="adm-input" [value]="filter()" (change)="filter.set($any($event.target).value); load()" aria-label="Lọc">
        <option value="all">Tất cả bài</option>
        <option value="hidden">Chỉ bài đã ẩn</option>
      </select>
      <button class="btn btn-stone btn-sm" type="button" (click)="load()">Tìm</button>
    </div>
    <div class="card"><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Bài viết</th><th>Tác giả</th><th class="r">Tương tác</th><th>Ngày</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>
        @for (p of posts(); track p.id) {
          <tr [class.dim]="p.hidden">
            <td class="cm-cell">
              <span class="pill">{{ label[p.type] }}</span>@if (p.sample) { <span class="pill">Bài mẫu</span> }@if (p.image) { <span class="pill">Có ảnh</span> }
              <p class="cm-text" [title]="p.text">{{ p.text }}</p>
            </td>
            <td>{{ p.authorName }}</td>
            <td class="r num small">{{ count(p.reactions) }} cảm xúc · {{ p.comments?.length ?? 0 }} bình luận</td>
            <td class="num small">{{ p.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
            <td><span class="pill" [class.on]="!p.hidden" [class.warn]="p.hidden">{{ p.hidden ? 'Đã ẩn' : 'Đang hiện' }}</span></td>
            <td class="r">
              @if (!p.hidden) { <a class="link-btn" routerLink="/cong-dong" target="_blank" rel="noopener">Xem</a> · }
              <button class="link-btn" type="button" [disabled]="busy() === p.id" (click)="toggle(p)">{{ p.hidden ? 'Hiện lại' : 'Ẩn' }}</button>
            </td>
          </tr>
        } @empty { <tr><td colspan="6" class="empty-row">{{ loading() ? 'Đang tải…' : 'Không có bài viết nào khớp.' }}</td></tr> }
      </tbody>
    </table></div>
    <p class="small muted">Đang hiện {{ posts().length }}/{{ total() }} bài
      @if (posts().length < total()) { · <button class="link-btn" type="button" [disabled]="loading()" (click)="more()">Tải thêm</button> }
    </p></div>
  `,
  styles: [`
    .cm-cell { max-width: 520px; }
    .cm-cell .pill { margin: 0 6px 6px 0; }
    .cm-text { margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.45; }
  `],
  encapsulation: ViewEncapsulation.None
})
export class AdminCommunity {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  protected readonly label = POST_TYPE_LABEL;
  protected posts = signal<AdminPost[]>([]);
  protected total = signal(0);
  protected loading = signal(false);
  protected busy = signal('');
  protected q = signal('');
  protected filter = signal<'all' | 'hidden'>('all');
  private page = 1;

  constructor() { void this.load(); }

  protected count(r?: Record<string, string>): number { return r ? Object.keys(r).length : 0; }

  private async fetch(page: number): Promise<Page> {
    const params: Record<string, string> = { page: String(page), pageSize: String(PAGE) };
    if (this.q().trim()) params['q'] = this.q().trim();
    if (this.filter() === 'hidden') params['hidden'] = 'true';
    return firstValueFrom(this.http.get<Page>('/api/admin/community/posts', { params }));
  }
  protected async load(): Promise<void> {
    this.loading.set(true); this.page = 1;
    try { const p = await this.fetch(1); this.posts.set(p.items); this.total.set(p.total); }
    catch { this.toast.show('Không tải được bài viết Cộng đồng'); }
    finally { this.loading.set(false); }
  }
  protected async more(): Promise<void> {
    this.loading.set(true);
    try { const p = await this.fetch(++this.page); this.posts.update(l => [...l, ...p.items]); this.total.set(p.total); }
    catch { this.page--; this.toast.show('Không tải thêm được'); }
    finally { this.loading.set(false); }
  }
  protected async toggle(post: AdminPost): Promise<void> {
    this.busy.set(post.id);
    try {
      const updated = await firstValueFrom(this.http.patch<AdminPost>(`/api/admin/community/posts/${post.id}`, { hidden: !post.hidden }));
      if (this.filter() === 'hidden' && !updated.hidden) { this.posts.update(l => l.filter(x => x.id !== post.id)); this.total.update(n => n - 1); }
      else this.posts.update(l => l.map(x => (x.id === post.id ? updated : x)));
      this.toast.show(updated.hidden ? 'Đã ẩn bài viết' : 'Đã hiện lại bài viết');
    } catch { this.toast.show('Không cập nhật được trạng thái bài viết'); }
    finally { this.busy.set(''); }
  }
}
