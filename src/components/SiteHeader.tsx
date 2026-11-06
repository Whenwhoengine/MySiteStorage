// 開放區：頁首（品牌、主選單、站內搜尋）。比照 Blade layouts/partials/header.blade.php。
// 必須保留：<header data-site-header>、nav#site-nav[data-site-nav]、button[data-site-nav-toggle]、
// ul[data-site-nav-list]、a[data-site-nav-link]、商店連結 data-site-nav-shop、搜尋框 #site-search-q（不得與搜尋頁的 #search-q 同名）。
// 手機版選單：伺服器輸出時選單展開（沒有 JavaScript 也能用）；載入後才收合並顯示「選單」按鈕。
import { useState, useSyncExternalStore } from 'react';
import { SiteLink } from '@/components/safe/SiteLink';
import type { SiteInfo } from '@/lib/content/types';
import { isCurrentPath } from '@/lib/paths';
import { Icon } from './Icon';
import { buttonClass, containerClass, inputClass } from './ui';

const linkBase = 'inline-flex min-h-11 items-center rounded-sm px-3 no-underline max-md:w-full';
const linkIdle = `${linkBase} text-ink-secondary visited:text-ink-secondary hover:bg-surface-raised hover:text-ink-primary`;
const linkCurrent = `${linkBase} rounded-b-none bg-surface-raised text-brand visited:text-brand shadow-nav-current`;
const linkShop = `${linkBase} text-state-warning visited:text-state-warning hover:bg-surface-raised`;

function subscribeNothing(): () => void {
  return () => {};
}

export function BrandMark() {
  return (
    <span className="grid size-7 flex-none place-items-center rounded-mark bg-brand text-[0.9rem] text-ink-on-brand" aria-hidden="true">
      <Icon name="play" sizeClass="ml-[2px] size-[15px]" />
    </span>
  );
}

export function SiteHeader({ site, currentPath }: { site: SiteInfo; currentPath: string }) {
  // 伺服器輸出與 hydrate 時為 false（選單展開、按鈕隱藏）；瀏覽器接手後為 true
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [open, setOpen] = useState(false);
  const collapsed = ready && !open;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface-card" data-site-header="">
      <div className={`${containerClass} flex min-h-16 flex-wrap items-center gap-4`}>
        <SiteLink
          className="inline-flex items-center gap-2 text-lg font-extrabold tracking-brand no-underline text-ink-primary visited:text-ink-primary"
          href="/"
        >
          <BrandMark />
          <span className="[overflow-wrap:anywhere]">{site.name}</span>
          <span className="visually-hidden">（回首頁）</span>
        </SiteLink>
        <button
          type="button"
          className={buttonClass('default', ready ? 'hidden max-md:ml-auto max-md:inline-flex' : 'hidden')}
          data-site-nav-toggle=""
          aria-controls="site-nav"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="menu" />
          <span>選單</span>
        </button>
        <nav
          id="site-nav"
          className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2 max-md:ml-0 max-md:w-full max-md:flex-col max-md:items-stretch"
          data-site-nav=""
          data-open={ready ? String(open) : undefined}
          aria-label="主選單"
        >
          <ul
            className={`m-0 flex list-none flex-wrap gap-x-2 gap-y-1 p-0 max-md:flex-col max-md:pb-3 ${collapsed ? 'max-md:hidden' : ''}`}
            data-site-nav-list=""
          >
            {site.primaryMenu.map((menu) => {
              const current = isCurrentPath(menu.url, currentPath);
              return (
                <li key={`${menu.label}|${menu.url}`}>
                  <SiteLink
                    className={current ? linkCurrent : linkIdle}
                    href={menu.url}
                    external={menu.external}
                    data-site-nav-link=""
                    aria-current={current ? 'page' : undefined}
                  >
                    {menu.label}
                    {menu.external ? (
                      <>
                        <Icon name="external" inline />
                        <span className="visually-hidden">（外部網站）</span>
                      </>
                    ) : null}
                  </SiteLink>
                </li>
              );
            })}
            {site.commerceEnabled ? (
              <li>
                <SiteLink
                  className={isCurrentPath('/shop', currentPath) ? linkCurrent : linkShop}
                  href="/shop"
                  data-site-nav-link=""
                  data-site-nav-shop=""
                  aria-current={isCurrentPath('/shop', currentPath) ? 'page' : undefined}
                >
                  商店
                </SiteLink>
              </li>
            ) : null}
          </ul>
          <form
            className={`flex gap-1 max-md:w-full max-md:pb-3 ${collapsed ? 'max-md:hidden' : ''}`}
            role="search"
            action="/search"
            method="get"
          >
            <label className="visually-hidden" htmlFor="site-search-q">
              搜尋站內內容
            </label>
            <input
              id="site-search-q"
              className={inputClass('min-h-10 w-52 py-1 max-md:w-auto max-md:min-w-0 max-md:flex-1')}
              type="search"
              name="q"
              maxLength={100}
              placeholder="搜尋文章、影片、Podcast"
              autoComplete="off"
            />
            <button className={buttonClass('default', 'inline-flex', 'min-h-10 px-3')} type="submit">
              <Icon name="search" />
              <span className="visually-hidden">搜尋</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
