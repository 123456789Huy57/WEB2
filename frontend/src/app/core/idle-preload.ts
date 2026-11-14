import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, from, of, switchMap } from 'rxjs';

/**
 * Tải trước code các trang khác khi trình duyệt RẢNH, sau khi trang đầu đã hiện.
 * PreloadAllModules tải + biên dịch ~60 file JS ngay khi trang đầu xong, đúng lúc người dùng bắt đầu cuộn → khựng.
 * Ở đây chờ 2,5 giây rồi tải từng trang trong lúc rảnh; mạng chậm / bật tiết kiệm dữ liệu thì không tải trước.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreload implements PreloadingStrategy {
  private queue?: Promise<void>;
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (c?.saveData || /(^|-)2g|3g/.test(c?.effectiveType ?? '')) return of(null);
    const idle = () => new Promise<void>(resolve => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      ric ? ric(() => resolve(), { timeout: 4000 }) : setTimeout(resolve, 300);
    });
    // Chờ 2,5 giây một lần, rồi xếp hàng: mỗi lần chỉ tải 1 trang vào lúc rảnh.
    this.queue ??= new Promise<void>(r => setTimeout(r, 2500));
    const turn = this.queue.then(idle);
    this.queue = turn.then(() => new Promise<void>(r => setTimeout(r, 150)));
    return from(turn).pipe(switchMap(() => load()));
  }
}
