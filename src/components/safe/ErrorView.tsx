// 受保護：404、503、500 錯誤畫面（v1 §6.4；FE-17；掛鉤 error_view.*）。比照 Blade errors/mysite.blade.php。
// - 標題：404「找不到這個頁面」、503「內容暫時無法讀取」、500「系統發生錯誤」。
// - 一律有名稱完全等於「回首頁」的連結與「請求編號：…」；503 另有「重新整理」。
// - 404 頁內保留原生搜尋表單（#state-q）。
// 版面（完整版面或內建靜態頁首頁尾）由 _app 決定；外觀見 src/components/safe-styles.ts。
import type { ErrorInfo } from '@/lib/content/types';
import { ERROR_HEADINGS as HEADINGS } from '@/lib/errors';
import { errorViewClasses as c } from '../safe-styles';

export function ErrorView({ error }: { error: ErrorInfo }) {
  const { status } = error;
  return (
    <section className={c.section} aria-labelledby="state-title" data-error-view={String(status)}>
      <p className={status === 503 ? c.code503 : c.code} aria-hidden="true">
        {status}
      </p>
      <h1 id="state-title" className={c.title} data-error-title="">
        {HEADINGS[status]}
      </h1>
      <p className={c.message}>{error.message}</p>

      {status === 404 ? (
        <>
          <p>連結可能已變更，或內容已不再公開。</p>
          <form className={c.search} role="search" action="/search" method="get">
            <label className="visually-hidden" htmlFor="state-q">
              搜尋站內內容
            </label>
            <input
              id="state-q"
              className={c.searchInput}
              type="search"
              name="q"
              maxLength={100}
              placeholder="搜尋文章、影片、Podcast"
            />
            <button className={c.button} type="submit">
              搜尋
            </button>
          </form>
        </>
      ) : null}
      {status === 503 ? <p>內容系統目前沒有回應。這不代表內容已被刪除，請稍候一分鐘再重新整理。</p> : null}

      <p className={c.actions}>
        <a className={c.buttonPrimary} href="/" data-error-home-link="">
          回首頁
        </a>
        {status === 503 && error.retryPath !== null ? (
          <a className={c.button} href={error.retryPath} data-error-retry-link="">
            重新整理
          </a>
        ) : null}
      </p>
      <p className={c.ref} data-request-id="">
        請求編號：<code>{error.requestId}</code>
      </p>
    </section>
  );
}
