// 開放區：版面小區塊（頁首標題區、區段、空狀態、提示框、卡片網格）。比照 Blade layout.css、components.css、content.css。
import type { ReactNode } from 'react';
import type { CardItem } from '@/lib/content/types';
import { ContentCard, type CardVariant } from './ContentCard';
import { Icon, type IconName } from './Icon';

/** 卡片網格（.grid／.grid--media／.grid--podcast）。 */
const GRID = {
  default: 'grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))]',
  media: 'grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))]',
  podcast: 'grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]',
} as const;

export function CardGrid({
  items,
  grid = 'default',
  level = 3,
  variant = 'default',
}: {
  items: CardItem[];
  grid?: keyof typeof GRID;
  level?: 2 | 3 | 4;
  variant?: CardVariant;
}) {
  return (
    <ul className={`m-0 grid list-none gap-6 p-0 ${GRID[grid]}`} role="list">
      {items.map((item) => (
        <li key={item.path} className="flex min-w-0 *:min-w-0 *:flex-1">
          <ContentCard item={item} level={level} variant={variant} />
        </li>
      ))}
    </ul>
  );
}

export function Section({
  id,
  icon,
  title,
  more,
  children,
}: {
  id: string;
  icon: IconName;
  title: string;
  more?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="my-12" aria-labelledby={id}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={id} className="m-0 flex items-center gap-2 text-xl">
          <Icon name={icon} className="text-brand" />
          {title}
        </h2>
        {more}
      </div>
      {children}
    </section>
  );
}

export const sectionMoreClass = 'inline-flex min-h-11 items-center font-semibold';

export function EmptyState({ title, children, ...rest }: { title?: string; children?: ReactNode; role?: string; 'data-search-empty'?: string }) {
  return (
    <div className="rounded-md border border-dashed border-line-strong p-8 text-center text-ink-secondary [&>p:last-child]:mb-0" {...rest}>
      {title !== undefined ? <p className="mb-2 font-bold text-ink-primary">{title}</p> : null}
      {children}
    </div>
  );
}

/** 單行的空狀態（Blade 的 <p class="empty">）。 */
export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-line-strong p-8 text-center text-ink-secondary">{children}</p>;
}

const NOTICE_EDGE = {
  info: 'border-l-state-info',
  danger: 'border-l-state-danger',
  warning: 'border-l-state-warning',
} as const;

export function Notice({
  variant = 'info',
  title,
  children,
  ...rest
}: {
  variant?: keyof typeof NOTICE_EDGE;
  title?: string;
  children: ReactNode;
  role?: string;
  id?: string;
  'data-search-error'?: string;
}) {
  return (
    <div className={`mb-4 rounded-sm border border-l-4 border-line-strong bg-surface-card px-4 py-3 ${NOTICE_EDGE[variant]}`} {...rest}>
      {title !== undefined ? (
        <p className="mb-1 flex items-center gap-2 font-bold">
          {variant !== 'info' ? <Icon name="alert" className={variant === 'danger' ? 'text-state-danger' : 'text-state-warning'} /> : null}
          {title}
        </p>
      ) : null}
      <div className="[&>:last-child]:mb-0">{children}</div>
    </div>
  );
}

/** 列表、分類、搜尋頁的頁首標題區（.page-header）。h1 帶 data-page-title。 */
export function PageHeader({
  eyebrow,
  title,
  titleSuffix,
  lede,
  count,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleSuffix?: ReactNode;
  lede?: string;
  count?: string;
}) {
  return (
    <header className="mb-8">
      {eyebrow !== undefined ? <p className="mb-2 text-sm font-bold tracking-label text-brand">{eyebrow}</p> : null}
      <h1 className="[overflow-wrap:anywhere]" data-page-title="">
        {title}
        {titleSuffix}
      </h1>
      {lede !== undefined && lede !== '' ? <p className="max-w-measure text-ink-secondary">{lede}</p> : null}
      {count !== undefined ? <p className="text-sm text-ink-tertiary">{count}</p> : null}
    </header>
  );
}
