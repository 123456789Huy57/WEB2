import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest { title: string; message: string; ok: string; danger?: boolean; resolve: (v: boolean) => void; }

/** Hộp xác nhận trong trang (thay cho window.confirm, vốn bị chặn ở một số trình duyệt nhúng) */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmRequest | null>(null);
  ask(title: string, message: string, ok = 'Đồng ý', danger = true): Promise<boolean> {
    return new Promise(resolve => this.current.set({ title, message, ok, danger, resolve }));
  }
  answer(v: boolean): void { const c = this.current(); this.current.set(null); c?.resolve(v); }
}
