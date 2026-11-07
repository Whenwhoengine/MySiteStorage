// 開放區：文章、影片、Podcast 列表畫面。比照 Blade content/index.blade.php。
// 必須保留：唯一的 h1（data-page-title）、內容卡片（相對路徑的詳情連結）、分頁。
import { CardGrid, EmptyState, PageHeader } from '@/components/Blocks';
import { Pagination } from '@/components/Pagination';
import { SiteLink } from '@/components/safe/SiteLink';
import { TypeChip } from '@/components/TypeChip';
import type { CollectionViewProps } from '@/lib/content/types';

export default function CollectionView({ collection, items, pagination, basePath }: CollectionViewProps) {
  const podcast = collection.type === 'podcast';
  return (
    <>
      <PageHeader
        eyebrow={<TypeChip type={collection.type} />}
        title={collection.title}
        titleSuffix={
          pagination.page > 1 ? (
            <span className="ml-3 inline-block text-base font-semibold text-ink-tertiary">第 {pagination.page} 頁</span>
          ) : null
        }
        lede={collection.lede}
        count={pagination.total > 0 ? `共 ${pagination.total} 則` : undefined}
      />
      {items.length === 0 ? (
        <EmptyState title={`目前沒有公開的${collection.label}`}>
          <p>
            內容發布後會出現在這裡。<SiteLink href="/">回首頁</SiteLink>
          </p>
        </EmptyState>
      ) : (
        <>
          <CardGrid
            items={items}
            grid={podcast ? 'podcast' : collection.type === 'video' ? 'media' : 'default'}
            level={2}
            variant={podcast ? 'row' : 'default'}
          />
          <Pagination pagination={pagination} path={basePath} />
        </>
      )}
    </>
  );
}
