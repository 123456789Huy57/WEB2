import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from '../core/confirm.service';

@Component({
  selector: 'fm-confirm',
  template: `
    <dialog class="cf-dlg" #dlg aria-labelledby="cf-title" (cancel)="$event.preventDefault(); cf.answer(false)">
      @if (cf.current(); as c) {
        <h2 class="h3" id="cf-title">{{ c.title }}</h2>
        <p class="muted">{{ c.message }}</p>
        <div class="cf-acts">
          <button class="btn btn-stone" type="button" (click)="cf.answer(false)">Quay lại</button>
          <button class="btn" [class.btn-forest]="!c.danger" [class.btn-danger]="c.danger" type="button" (click)="cf.answer(true)">{{ c.ok }}</button>
        </div>
      }
    </dialog>
  `
})
export class ConfirmDialog {
  protected cf = inject(ConfirmService);
  private dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  constructor() {
    effect(() => {
      const d = this.dlg().nativeElement;
      if (this.cf.current() && !d.open) d.showModal();
      if (!this.cf.current() && d.open) d.close();
    });
  }
}
