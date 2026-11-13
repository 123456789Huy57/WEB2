import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../core/toast.service';

interface AdminPost {
  id: string; authorName: string; type: string; text: string; createdAt: number;
  hidden?: boolean; image?: string; comments?: unknown[]; reactions?: Record<string, string>;
}
type Page = { items: AdminPost[]; total: number };

@Component({
  selector: 'fm-admin-community',
  imports: [DatePipe],
  template: `
    <section class="adm-page">
      <header class="adm-head">
        <div><h1 class="h2">Duyệt Cộng đồng</h1><p>Ẩn hoặc hiện bài viết vi phạm nội quy.</p></div>
        <button class="btn btn-stone btn-sm" type="button" (click)="load()">Làm mới</button>
      </header>
      <div class="card">
        @if (loading()) { <p class="muted">Đang tải...</p> }
        @else {
          <div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Bài viết</th><th>Tác giả</th><th>Ngày</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              @for (p of posts(); track p.id) {
                <tr [class.dim]="p.hidden">
                  <td class="nm"><b>{{ p.type }}</b><br>{{ p.text }}</td>
                  <td>{{ p.authorName }}</td>
                  <td>{{ p.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td><span class="pill" [class.warn]="p.hidden" [class.on]="!p.hidden">{{ p.hidden ? 'Đã ẩn' : 'Đang hiện' }}</span></td>
                  <td class="r"><button class="link-btn" type="button" (click)="toggle(p)">{{ p.hidden ? 'Hiện lại' : 'Ẩn bài' }}</button></td>
                </tr>
              } @empty { <tr><td class="empty-row" colspan="5">Chưa có bài viết.</td></tr> }
            </tbody>
          </table></div>
          <p class="small muted">{{ total() }} bài viết</p>
        }
      </div>
    </section>
  `,
  encapsulation: ViewEncapsulation.None
})
export class AdminCommunity {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  protected posts = signal<AdminPost[]>([]);
  protected total = signal(0);
  protected loading = signal(false);

  constructor() { void this.load(); }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      const page = await firstValueFrom(this.http.get<Page>('/api/admin/community/posts?pageSize=100'));
      this.posts.set(page.items); this.total.set(page.total);
    } catch { this.toast.show('Không tải được bài viết cộng đồng'); }
    finally { this.loading.set(false); }
  }

  protected async toggle(post: AdminPost): Promise<void> {
    try {
      const updated = await firstValueFrom(this.http.patch<AdminPost>(`/api/admin/community/posts/${post.id}`, { hidden: !post.hidden }));
      this.posts.update(items => items.map(item => item.id === post.id ? updated : item));
      this.toast.show(updated.hidden ? 'Đã ẩn bài viết' : 'Đã hiện lại bài viết');
    } catch { this.toast.show('Không cập nhật được trạng thái bài viết'); }
  }
}
