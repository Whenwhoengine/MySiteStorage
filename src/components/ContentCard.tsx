// 開放區：內容卡片（首頁、列表、分類、標籤）。比照 Blade components/content-card.blade.php。
// 必須保留：data-content-card（article）、data-content-link（連結文字只放標題純文字）、經 SiteLink 的相對路徑連結。
import type { ReactNode } from 'react';
import { ContentImage } from '@/components/safe/ContentImage';
import { SiteLink } from '@/components/safe/SiteLink';
import type { CardItem } from '@/lib/content/types';
import { formatDuration, formatDurationSpoken, formatTaipeiDate } from '@/lib/format';
import { TYPE_LABEL } from '@/lib/paths';
import { SampleBadge } from './Badge';
import { Icon } from './Icon';
import { TypeChip } from './TypeChip';

export type CardVariant = 'default' | 'feature' | 'row';

const cardBase =
  'relative flex h-full min-w-0 overflow-hidden rounded-md border border-line bg-surface-card transition-[border-color,background] duration-(--duration) hover:border-line-strong hover:bg-surface-hover focus-within:shadow-focus';

function cardFrame(item: CardItem, variant: CardVariant): string {
  if (variant === 'row') return `${cardBase} flex-row items-stretch border-l-[3px] border-t-type-podcast-edge border-l-type-podcast-edge`;
  const accent =
    item.type === 'video'
      ? 'border-t-[3px] border-t-type-video'
      : item.type === 'podcast'
        ? 'border-t-[3px] border-t-type-podcast-edge'
        : '';
  return `${cardBase} flex-col ${accent} ${variant === 'feature' ? 'shadow-card' : ''}`;
}

const TITLE_SIZE: Record<CardVariant, string> = { default: 'text-lg', feature: 'text-2xl', row: 'text-base' };

function Heading({ level, className, children }: { level: 2 | 3 | 4; className: string; children: ReactNode }) {
  if (level === 2) return <h2 className={className}>{children}</h2>;
  if (level === 4) return <h4 className={className}>{children}</h4>;
  return <h3 className={className}>{children}</h3>;
}

export function ContentCard({ item, level = 3, variant = 'default' }: { item: CardItem; level?: 2 | 3 | 4; variant?: CardVariant }) {
  const duration = formatDuration(item.durationSeconds);
  const durationSpoken = formatDurationSpoken(item.durationSeconds);
  const square = item.type === 'podcast' && variant !== 'feature';
  return (
    <article className={cardFrame(item, variant)} data-content-card="">
      <div className={variant === 'row' ? 'relative min-w-0 flex-[0_0_clamp(92px,30%,150px)] self-stretch' : 'relative'}>
        <ContentImage
          image={item.cover}
          ratio={variant === 'row' ? 'auto' : square ? 'square' : 'wide'}
          placeholder={TYPE_LABEL[item.type]}
          eager={variant === 'feature'}
          className={variant === 'row' ? 'h-full min-h-[104px]' : ''}
        />
        {item.type === 'video' ? (
          <span className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
            <Icon
              name="play"
              sizeClass="size-14 rounded-full border-2 border-brand bg-surface-overlay pt-[15px] pr-[13px] pb-[15px] pl-[17px] text-brand"
            />
          </span>
        ) : null}
        {duration !== null ? (
          <span className="absolute right-2 bottom-2 rounded-xs bg-surface-scrim px-[7px] py-[2px] text-xs font-bold tabular-nums text-ink-inverse">
            <span className="visually-hidden">片長 {durationSpoken}</span>
            <span aria-hidden="true">{duration}</span>
          </span>
        ) : null}
      </div>
      <div className={`flex flex-1 flex-col gap-2 ${variant === 'row' ? 'px-4 py-3' : 'p-4'}`}>
        <p className="m-0 flex flex-wrap items-center gap-2">
          <TypeChip type={item.type} />
          {item.isSample ? <SampleBadge /> : null}
        </p>
        <Heading level={level} className={`m-0 [overflow-wrap:anywhere] ${TITLE_SIZE[variant]}`}>
          <SiteLink
            href={item.path}
            className="text-ink-primary no-underline visited:text-ink-primary hover:underline focus-visible:shadow-none after:absolute after:inset-0"
            data-content-link=""
          >
            {item.title}
          </SiteLink>
        </Heading>
        {item.excerpt !== '' ? (
          <p className={`m-0 text-ink-secondary ${variant === 'row' ? 'line-clamp-2 text-sm' : 'line-clamp-3'}`}>{item.excerpt}</p>
        ) : null}
        <p className="mt-auto mb-0 flex flex-wrap gap-2 text-sm text-ink-tertiary">
          <time dateTime={item.publishedAt}>{formatTaipeiDate(item.publishedAt)}</time>
          {item.authorName ? <span>{item.authorName}</span> : null}
        </p>
      </div>
    </article>
  );
}
