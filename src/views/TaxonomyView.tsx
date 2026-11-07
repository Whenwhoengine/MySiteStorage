// 開放區：分類、標籤畫面。比照 Blade content/taxonomy.blade.php。
// 必須保留：唯一的 h1（data-page-title）、內容卡片、分頁。
import { CardGrid, EmptyState, PageHeader, Section, sectionMoreClass } from '@/components/Blocks';
import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { SiteLink } from '@/components/safe/SiteLink';
import type { TaxonomyViewProps } from '@/lib/content/types';

const tabBase = '-mb-px inline-flex min-h-11 items-center border-b-[3px] px-4 no-underline';

export default function TaxonomyView({ kind, label, term, type, tabs, overview, listing }: TaxonomyViewProps) {
  const nothing = overview !== null && overview.every((section) => section.items.length === 0);
  return (
    <>
      <PageHeader
        eyebrow={label}
        title={`${kind === 'tag' ? '#' : ''}${term.name}`}
        count={term.count !== null ? `共 ${term.count} 則公開內容` : undefined}
      />

      <nav aria-label="依內容類型篩選">
        <ul className="m-0 mb-6 flex list-none flex-wrap gap-1 border-b border-line p-0">
          {tabs.map((tab) => (
            <li key={tab.href}>
              <SiteLink
                className={
                  tab.current
                    ? `${tabBase} border-brand font-bold text-ink-primary visited:text-ink-primary`
                    : `${tabBase} border-transparent text-ink-secondary visited:text-ink-secondary hover:text-ink-primary`
                }
                href={tab.href}
                aria-current={tab.current ? 'page' : undefined}
              >
                {tab.label}
              </SiteLink>
            </li>
          ))}
        </ul>
      </nav>

      {overview !== null ? (
        <>
          {nothing ? (
            <EmptyState title={`這個${label}目前沒有公開內容`}>
              <p>
                <SiteLink href="/">回首頁</SiteLink>或<SiteLink href="/search">搜尋其他內容</SiteLink>。
              </p>
            </EmptyState>
          ) : null}
          {overview
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <Section
                key={section.type}
                id={`tax-${section.type}`}
                icon={section.type}
                title={section.title}
                more={
                  section.total > section.perPage ? (
                    <SiteLink className={sectionMoreClass} href={`${term.path}?type=${section.type}`}>
                      查看全部 {section.total} 則
                      <Icon name="arrow" inline />
                    </SiteLink>
                  ) : undefined
                }
              >
                <CardGrid
                  items={section.items}
                  grid={section.type === 'podcast' ? 'podcast' : 'default'}
                  variant={section.type === 'podcast' ? 'row' : 'default'}
                />
              </Section>
            ))}
        </>
      ) : listing !== null && type !== null ? (
        listing.items.length === 0 ? (
          <EmptyState title={`這個${label}目前沒有公開的${listing.typeLabel}`}>
            <p>
              <SiteLink href={term.path}>查看全部類型</SiteLink>
            </p>
          </EmptyState>
        ) : (
          <>
            <CardGrid
              items={listing.items}
              grid={type === 'podcast' ? 'podcast' : 'default'}
              level={2}
              variant={type === 'podcast' ? 'row' : 'default'}
            />
            <Pagination pagination={listing.pagination} path={term.path} query={{ type }} />
          </>
        )
      ) : null}
    </>
  );
}
