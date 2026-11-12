import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../core/models';
import { DataService } from '../core/data.service';
import { apiMessage } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { norm } from '../core/storage';

@Component({
  selector: 'fm-admin-categories', imports: [ReactiveFormsModule],
  template: `
    <div class="adm-head"><div><h1 class="h2">Danh mục</h1><p>Quản lý quầy hàng và danh mục con.</p></div><button class="btn btn-forest" type="button" (click)="edit(null)">Thêm danh mục</button></div>
    <div class="toolbar"><input class="adm-input" type="search" placeholder="Tìm danh mục" aria-label="Tìm danh mục" [value]="q()" (input)="q.set($any($event.target).value)"></div>
    <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Tên</th><th>Đường dẫn</th><th>Sản phẩm đang bán</th><th>Thứ tự</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      @for (category of list(); track category.id) {
        <tr><td class="nm">{{ category.name }}<br><span class="muted small">{{ category.subcategories.length }} danh mục con</span></td><td>{{ category.slug }}</td><td>{{ category.productCount }}</td><td>{{ category.sortOrder }}</td><td>{{ category.active === false ? 'Đang ẩn' : 'Đang hiện' }}</td><td><button class="link-btn" type="button" (click)="edit(category)">Sửa</button><button class="link-btn" type="button" style="margin-left:16px" [disabled]="busy()" (click)="toggle(category)">{{ category.active === false ? 'Hiện' : 'Ẩn' }}</button></td></tr>
      } @empty { <tr><td colspan="6" class="empty-row">Không tìm thấy danh mục.</td></tr> }
    </tbody></table></div>
    <dialog class="adm-dlg" #dialog aria-labelledby="category-title"><form [formGroup]="form" (ngSubmit)="save()">
      <h2 class="h3" id="category-title">{{ editing() ? 'Sửa danh mục' : 'Thêm danh mục' }}</h2>
      <div class="form-grid">
        <div class="field full"><label for="category-name">Tên danh mục</label><input id="category-name" formControlName="name" maxlength="100" required></div>
        <div class="field"><label for="category-slug">Đường dẫn</label><input id="category-slug" formControlName="slug" placeholder="Để trống để tạo tự động"></div>
        <div class="field"><label for="category-order">Thứ tự hiển thị</label><input id="category-order" formControlName="sortOrder" type="number" min="0" max="10000" step="1"></div>
        <div class="field full"><label for="category-description">Mô tả</label><textarea id="category-description" formControlName="description"></textarea></div>
        <label class="check full"><input type="checkbox" formControlName="active"> Hiện danh mục</label>
        <h3 class="h3 full">Danh mục con</h3>
        @for (sub of subs(); track sub.id; let i = $index) {
          <div class="field full" style="display:flex;gap:12px"><input [attr.aria-label]="'Tên danh mục con ' + (i + 1)" [value]="sub.name" (input)="renameSub(i, $any($event.target).value)"><button class="btn btn-stone btn-sm" type="button" (click)="removeSub(i)">Bỏ</button></div>
        }
        <div class="full"><button class="btn btn-stone btn-sm" type="button" (click)="addSub()">Thêm danh mục con</button></div>
        <p class="err small full" role="status">{{ error() }}</p>
      </div>
      <div class="acts"><button class="btn btn-stone" type="button" (click)="dialog.close()" [disabled]="busy()">Hủy</button><button class="btn btn-forest" type="submit" [disabled]="busy()">{{ busy() ? 'Đang lưu…' : 'Lưu danh mục' }}</button></div>
    </form></dialog>
  `
})
export class AdminCategories {
  private data = inject(DataService); private toast = inject(ToastService);
  protected q = signal(''); protected busy = signal(false); protected error = signal('');
  protected editing = signal<Category | null>(null);
  protected subs = signal<{ id: string; name: string }[]>([]);
  protected dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected list = computed(() => this.data.categories().filter(c => norm(c.name).includes(norm(this.q()))));
  protected form = inject(FormBuilder).nonNullable.group({ name: ['', [Validators.required, Validators.minLength(2)]], slug: [''], description: [''], sortOrder: [0, [Validators.min(0)]], active: [true] });
  protected edit(category: Category | null): void {
    this.editing.set(category); this.error.set('');
    this.form.reset(category ? { name: category.name, slug: category.slug, description: category.description, sortOrder: category.sortOrder, active: category.active !== false } : { name: '', slug: '', description: '', sortOrder: 0, active: true });
    this.subs.set((category?.subcategories || []).map(sub => ({ ...sub })));
    this.dialog().nativeElement.showModal();
  }
  protected renameSub(index: number, name: string): void { this.subs.update(items => items.map((sub, i) => i === index ? { ...sub, name } : sub)); }
  protected removeSub(index: number): void { this.subs.update(items => items.filter((_, i) => i !== index)); }
  protected addSub(): void { if (this.subs().length < 50) this.subs.update(items => [...items, { id: 'sub-' + crypto.randomUUID(), name: '' }]); }
  protected async save(): Promise<void> {
    this.error.set('');
    if (this.form.invalid || this.subs().some(sub => !sub.name.trim())) { this.error.set('Nhập tên danh mục và tên các danh mục con.'); return; }
    if (this.busy()) return; this.busy.set(true);
    try {
      const value = this.form.getRawValue();
      const payload = { ...value, ...(value.slug ? { slug: value.slug } : {}), subcategories: this.subs().map(sub => ({ ...sub, name: sub.name.trim() })) };
      if (!payload.slug) delete (payload as Partial<Category>).slug;
      await this.data.saveCategory(this.editing()?.id ?? null, payload);
      this.dialog().nativeElement.close(); this.toast.show('Đã lưu danh mục');
    } catch (error) { this.error.set(apiMessage(error)); }
    finally { this.busy.set(false); }
  }
  protected async toggle(category: Category): Promise<void> {
    this.busy.set(true);
    try { await this.data.saveCategory(category.id, { active: category.active === false }); this.toast.show('Đã cập nhật danh mục'); }
    catch (error) { this.toast.show(apiMessage(error)); }
    finally { this.busy.set(false); }
  }
}
