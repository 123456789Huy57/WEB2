import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal('');
  readonly visible = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  show(msg: string): void {
    this.message.set(msg);
    this.visible.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.visible.set(false), 2400);
  }
}
