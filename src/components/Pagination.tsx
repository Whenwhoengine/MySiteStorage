// 開放區：分頁（比照 Blade components/pagination.blade.php）。頁碼：1、目前頁前後各 2 頁、最後一頁。
import { SiteLink } from '@/components/safe/SiteLink';
import type { PageInfo } from '@/lib/content/types';
import { pageHref, pageWindow } from '@/lib/paths';

const item =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-line px-3 text-ink-primary no-underline visited:text-ink-primary';

export function Pagination({
  pagination,
  path,
  query = {},
}: {
  pagination: PageInfo;
  path: string;
  query?: Record<string, string | null | undefined>;
}) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;
  const pages = pageWindow(page, totalPages);
  return (
    <nav className="mt-8" aria-label="分頁">
      <ul className="m-0 mt-8 flex list-none flex-wrap items-center justify-center gap-2 p-0">
        <li>
          {page > 1 ? (
            <SiteLink className={item} href={pageHref(path, query, page - 1)} rel="prev">
              上一頁
            </SiteLink>
          ) : (
            <span aria-disabled="true" className={`${item} opacity-45`}>
              上一頁
            </span>
          )}
        </li>
        {pages.flatMap((n, index) => {
          const previous = index > 0 ? pages[index - 1] : undefined;
          const gap =
            previous !== undefined && n > previous + 1 ? (
              <li key={`gap-${n}`}>
                <span className={`${item} border-transparent`} aria-hidden="true">
                  …
                </span>
              </li>
            ) : null;
          const entry = (
            <li key={n}>
              {n === page ? (
                <span className={`${item} border-brand bg-brand font-bold text-ink-on-brand`} aria-current="page">
                  <span className="visually-hidden">第 </span>
                  {n}
                  <span className="visually-hidden"> 頁（目前）</span>
                </span>
              ) : (
                <SiteLink className={item} href={pageHref(path, query, n)}>
                  <span className="visually-hidden">第 </span>
                  {n}
                  <span className="visually-hidden"> 頁</span>
                </SiteLink>
              )}
            </li>
          );
          return gap === null ? [entry] : [gap, entry];
        })}
        <li>
          {page < totalPages ? (
            <SiteLink className={item} href={pageHref(path, query, page + 1)} rel="next">
              下一頁
            </SiteLink>
          ) : (
            <span aria-disabled="true" className={`${item} opacity-45`}>
              下一頁
            </span>
          )}
        </li>
      </ul>
      <p className="mt-2 text-center text-sm text-ink-tertiary">
        第 {page} 頁，共 {totalPages} 頁
      </p>
    </nav>
  );
}
