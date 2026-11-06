// 開放區：單篇內容畫面（文章、影片、Podcast、一般頁面）。比照 Blade content/show.blade.php＋partials/entry.blade.php。
// 必須保留：article[data-entry]、唯一的 h1[data-entry-title]（只放標題本身）、正文 div[data-entry-body] 內用 <SafeHtml>、
// 影片用 <YouTubeFacade>、Podcast 用 <PodcastPlayer>、封面用 <ContentImage>。
import { SampleBadge } from '@/components/Badge';
import { EmptyLine } from '@/components/Blocks';
import { ContentImage } from '@/components/safe/ContentImage';
import { PodcastPlayer } from '@/components/safe/PodcastPlayer';
import { SafeHtml } from '@/components/safe/SafeHtml';
import { SiteLink } from '@/components/safe/SiteLink';
import { YouTubeFacade } from '@/components/safe/YouTubeFacade';
import { TypeChip } from '@/components/TypeChip';
import type { EntryViewProps, TermLink } from '@/lib/content/types';
import { formatTaipeiDate, isMeaningfullyUpdated } from '@/lib/format';
import { COLLECTION_TITLE, collectionPath } from '@/lib/paths';
import { limitChars } from '@/lib/text';

const measure = 'mx-auto max-w-measure';

function TermList({ title, terms, prefix = '', tag = false }: { title: string; terms: TermLink[]; prefix?: string; tag?: boolean }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-ink-tertiary">{title}</h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {terms.map((term) => (
          <li key={term.path}>
            <SiteLink
              className={`inline-flex min-h-9 items-center rounded-full border border-line-strong bg-surface-card px-3 text-sm no-underline hover:border-brand hover:text-brand ${
                tag ? 'text-ink-secondary visited:text-ink-secondary' : 'text-ink-primary visited:text-ink-primary'
              }`}
              href={term.path}
            >
              {prefix}
              {term.name}
            </SiteLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function EntryView({ item }: EntryViewProps) {
  const isPage = item.type === 'page';
  return (
    <>
      {!isPage ? (
        <nav aria-label="麵包屑">
          <ol className="m-0 mb-6 flex list-none flex-wrap gap-x-2 gap-y-1 p-0 text-sm text-ink-tertiary">
            <li className="min-w-0 [overflow-wrap:anywhere]">
              <SiteLink className="text-ink-secondary visited:text-ink-secondary" href="/">
                首頁
              </SiteLink>
            </li>
            <li className="min-w-0 [overflow-wrap:anywhere] before:mr-2 before:text-line-strong before:content-['／']">
              <SiteLink className="text-ink-secondary visited:text-ink-secondary" href={collectionPath(item.type)}>
                {COLLECTION_TITLE[item.type]}
              </SiteLink>
            </li>
            <li className="min-w-0 [overflow-wrap:anywhere] before:mr-2 before:text-line-strong before:content-['／']" aria-current="page">
              <span>{limitChars(item.title, 40)}</span>
            </li>
          </ol>
        </nav>
      ) : null}

      <article aria-labelledby="entry-title" data-entry="">
        <header className={`${measure} mb-6`}>
          <p className="mb-3 flex flex-wrap items-center gap-2">
            {!isPage ? <TypeChip type={item.type} href={collectionPath(item.type)} /> : null}
            {item.isSample ? <SampleBadge /> : null}
          </p>
          <h1 id="entry-title" className="mb-3 text-3xl [overflow-wrap:anywhere]" data-entry-title="">
            {item.title !== '' ? item.title : '（未命名）'}
          </h1>
          {item.excerpt !== '' && !isPage ? <p className="text-lg text-ink-secondary">{item.excerpt}</p> : null}
          {!isPage ? (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-tertiary">
              <time dateTime={item.publishedAt}>{formatTaipeiDate(item.publishedAt)}</time>
              {isMeaningfullyUpdated(item.publishedAt, item.modifiedAt) ? (
                <span>
                  更新於 <time dateTime={item.modifiedAt}>{formatTaipeiDate(item.modifiedAt)}</time>
                </span>
              ) : null}
              {item.authorName ? <span>作者：{item.authorName}</span> : null}
            </p>
          ) : null}
        </header>

        {item.type === 'video' ? (
          <YouTubeFacade video={item.video} title={item.title} poster={item.cover} className="mx-auto mb-12 max-w-entry-media" />
        ) : item.type === 'podcast' ? (
          <PodcastPlayer podcast={item.podcast} title={item.title} cover={item.cover} className="mx-auto mb-12 max-w-entry-media" />
        ) : item.cover !== null ? (
          <figure className="mx-auto mb-8 max-w-entry-media">
            <ContentImage image={item.cover} eager className="rounded-lg border border-line" />
            {item.cover.alt !== '' ? <figcaption className="visually-hidden">{item.cover.alt}</figcaption> : null}
          </figure>
        ) : null}

        <div className={measure} data-entry-body="">
          {item.contentHtml.trim() !== '' ? <SafeHtml html={item.contentHtml} /> : <EmptyLine>這個內容目前沒有內文。</EmptyLine>}
        </div>

        {item.categories.length > 0 || item.tags.length > 0 ? (
          <footer className={`${measure} mt-12 grid gap-4 border-t border-line pt-6`}>
            {item.categories.length > 0 ? <TermList title="分類" terms={item.categories} /> : null}
            {item.tags.length > 0 ? <TermList title="標籤" terms={item.tags} prefix="#" tag /> : null}
          </footer>
        ) : null}
      </article>
    </>
  );
}
