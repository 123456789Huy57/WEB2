import { Component, ViewEncapsulation, computed, effect, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { INFO, INFO_NAV } from './info-content';

@Component({
  selector: 'fm-info',
  imports: [RouterLink, RouterLinkActive],
  encapsulation: ViewEncapsulation.None,
  styles: `
    .info { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 56px; align-items: start; }
    .info-nav { position: sticky; top: var(--header-h); display: flex; flex-direction: column; gap: 4px; }
    .info-nav a { padding: 8px 14px; border-radius: var(--r); color: var(--muted); transition: background-color .2s, color .2s; }
    .info-nav a:hover { background: var(--stone); color: var(--ink); }
    .info-nav a[aria-current] { background: var(--forest); color: #fff; }
    .info-body { max-width: 720px; display: flex; flex-direction: column; gap: 48px; }
    .info-body .h3 { margin-bottom: 14px; }
    .info-body ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
    .info-rows { margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .info-rows div { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 16px; padding: 14px 18px; background: var(--stone); border-radius: var(--r); }
    .info-rows dt { font-weight: 500; }
    .info-rows dd { margin: 0; color: var(--muted); }
    @media (max-width: 860px) {
      .info { grid-template-columns: 1fr; gap: 28px; }
      .info-nav { position: static; flex-direction: row; overflow-x: auto; margin-inline: calc(-1 * var(--gut-l)) calc(-1 * var(--gut-r)); padding-inline: var(--gut-l) var(--gut-r); scrollbar-width: none; }
      .info-nav a { flex: 0 0 auto; background: var(--stone); }
      .info-rows div { grid-template-columns: 1fr; gap: 2px; }
    }
  `,
  template: `
    @if (page(); as pg) {
      <section class="page-head band">
        <h1 class="h2">{{ pg.title }}</h1>
        <p class="lead" style="max-width:640px">{{ pg.lead }}</p>
      </section>
      <section class="band info">
        <nav class="info-nav" aria-label="Thông tin">
          @for (n of nav; track n.slug) {
            <a [routerLink]="['/thong-tin', n.slug]" routerLinkActive #r="routerLinkActive" [attr.aria-current]="r.isActive ? 'page' : null">{{ n.label }}</a>
          }
          <a routerLink="/blog">Blog ẩm thực</a>
          <a routerLink="/tra-cuu-don">Tra cứu đơn hàng</a>
        </nav>
        <div class="info-body">
          @for (b of pg.blocks; track b.h) {
            <section>
              <h2 class="h3">{{ b.h }}</h2>
              @if (b.p) { <p>{{ b.p }}</p> }
              @if (b.list) { <ul>@for (x of b.list; track x) { <li>{{ x }}</li> }</ul> }
              @if (b.rows) { <dl class="info-rows">@for (r of b.rows; track r[0]) { <div><dt>{{ r[0] }}</dt><dd>{{ r[1] }}</dd></div> }</dl> }
            </section>
          }
        </div>
      </section>
    } @else {
      <section class="band empty" style="padding-block:120px"><h1 class="h2">Trang này không có trên kệ.</h1><a class="btn btn-forest" routerLink="/">Về trang chủ</a></section>
    }
  `
})
export class Info {
  readonly slug = input.required<string>();
  protected nav = INFO_NAV;
  protected page = computed(() => INFO[this.slug()]);
  private title = inject(Title);
  constructor() { effect(() => { const p = this.page(); if (p) this.title.setTitle(p.title + ' · FreshMart'); }); }
}
