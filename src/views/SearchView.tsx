// 開放區：搜尋畫面。比照 Blade content/search.blade.php。
// 必須保留：原生表單 <form method="get" action="/search" data-search-form>、輸入框 id="search-q"、
// 零結果提示（<main> 內唯一的 role="status"、data-search-empty、文字「找不到符合」）、
// 有結果的摘要（role="status"、data-search-summary）、每筆結果 li[data-search-result] 與 a[data-search-result-link]（連結文字只放標題）、
// 錯誤分支（role="alert"、id="search-error"、data-search-error）。不要改成邊打字邊搜尋，也不要改用程式換頁。
import { SampleBadge } from '@/components/Badge';
import { EmptyState, Notice, PageHeader } from '@/components/Blocks';
import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { SiteLink } from '@/components/safe/SiteLink';
import { TypeChip } from '@/components/TypeChip';
import { buttonClass, inputClass } from '@/components/ui';
import type { SearchViewProps } from '@/lib/content/types';
import { formatTaipeiDate } from '@/lib/format';

export default function SearchView({ q, type, typeOptions, error, result }: SearchViewProps) {
  return (
    <>
      <PageHeader title="搜尋" lede="搜尋站內公開的文章、影片、Podcast 與頁面。" />

      <form
        className="mb-6 grid items-end gap-3 rounded-md border border-line bg-surface-card p-4 md:grid-cols-[minmax(0,1fr)_12rem_auto]"
        role="search"
        action="/search"
        method="get"
        noValidate
        data-search-form=""
      >
        <div className="grid gap-1">
          <label className="font-semibold" htmlFor="search-q">
            搜尋字詞
          </label>
          <input
            id="search-q"
            className={inputClass()}
            type="search"
            name="q"
            defaultValue={q}
            maxLength={100}
            {...(error !== null ? { 'aria-invalid': true, 'aria-describedby': 'search-error' } : {})}
          />
        </div>
        <div className="grid gap-1">
          <label className="font-semibold" htmlFor="search-type">
            內容類型
          </label>
          <select id="search-type" className={inputClass()} name="type" defaultValue={type ?? ''}>
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button className={buttonClass('primary')} type="submit">
          <Icon name="search" />
          搜尋
        </button>
      </form>

      {error !== null ? (
        <Notice variant="danger" title="無法搜尋" role="alert" id="search-error" data-search-error="">
          {error}
        </Notice>
      ) : q === '' || result === null ? (
        <p className="text-ink-secondary">輸入關鍵字開始搜尋，例如作品名稱或主題。</p>
      ) : result.items.length === 0 ? (
        <EmptyState title={`找不到符合「${q}」的內容`} role="status" data-search-empty="">
          <p>請換個關鍵字、減少字數，或改選「全部」類型再試一次。</p>
        </EmptyState>
      ) : (
        <>
          <p className="text-ink-secondary" role="status" data-search-summary="">
            找到 {result.pagination.total} 則符合「{q}」的內容
          </p>
          <ul className="m-0 grid list-none gap-3 p-0" role="list">
            {result.items.map((item) => (
              <li
                key={item.path}
                className="relative rounded-md border border-line bg-surface-card p-4 focus-within:shadow-focus"
                data-search-result=""
              >
                <p className="m-0 flex flex-wrap items-center gap-2">
                  <TypeChip type={item.type} />
                  {item.isSample ? <SampleBadge /> : null}
                </p>
                <h2 className="my-1 text-lg [overflow-wrap:anywhere]">
                  <SiteLink className="text-ink-primary visited:text-ink-primary" href={item.path} data-search-result-link="">
                    {item.title}
                  </SiteLink>
                </h2>
                {item.excerpt !== '' ? <p className="m-0 text-ink-secondary">{item.excerpt}</p> : null}
                <p className="mt-2 mb-0 text-sm text-ink-tertiary">
                  <time dateTime={item.publishedAt}>{formatTaipeiDate(item.publishedAt)}</time>
                </p>
              </li>
            ))}
          </ul>
          <Pagination pagination={result.pagination} path="/search" query={{ q, type }} />
        </>
      )}
    </>
  );
}
