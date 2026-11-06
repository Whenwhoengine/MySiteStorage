// 受保護（src/server/**）：分類、標籤頁的取資料函式。
import type { GetServerSideProps } from 'next';
import type { ListableType, TaxonomyViewProps } from '@/lib/content/types';
import type { PageProps } from '@/lib/page-props';
import { COLLECTION_TITLE, LISTABLE_TYPES, TYPE_LABEL } from '@/lib/paths';
import { isValidSlug, lastValue, parsePage, taxonomyRequest } from '../api-path';
import { toCard, toPageInfo } from '../mappers';
import { loadPage, notFoundPage, requestContext } from '../page-data';
import { TaxonomyResponseSchema } from '../schemas';

export function taxonomyProps(kind: 'category' | 'tag'): GetServerSideProps<PageProps<TaxonomyViewProps>> {
  return async (ctx) => {
    const rc = requestContext(ctx);
    const slug = lastValue(ctx.params?.slug);
    const page = parsePage(ctx.query.page);
    if (!isValidSlug(slug) || !page.ok) return notFoundPage(ctx, rc);
    // type 照原樣交給 API 判斷（不認得的值 API 回 404）；空白視同未帶
    const rawType = lastValue(ctx.query.type)?.trim() ?? '';
    const request = taxonomyRequest(kind, slug, rawType === '' ? null : rawType, page.page);
    return loadPage(ctx, rc, request, TaxonomyResponseSchema, (body) => {
      const data = body.data;
      const basePath = data.term.path;
      const current: ListableType | null = data.mode === 'listing' ? data.type : null;
      const overview = data.mode === 'overview' ? data.overview : null;
      const view: TaxonomyViewProps = {
        kind: data.kind,
        label: data.label,
        term: { name: data.term.name, path: data.term.path, count: data.term.count },
        type: current,
        tabs: [
          { label: '全部', href: basePath, current: current === null },
          ...LISTABLE_TYPES.map((t) => ({
            label: COLLECTION_TITLE[t],
            href: `${basePath}?type=${t}`,
            current: current === t,
          })),
        ],
        overview:
          overview !== null
            ? LISTABLE_TYPES.map((t) => ({
                type: t,
                title: COLLECTION_TITLE[t],
                items: overview[t].items.map(toCard),
                total: overview[t].total,
                perPage: overview[t].per_page,
              }))
            : null,
        listing:
          data.mode === 'listing' && current !== null && body.meta !== null
            ? { items: (data.items ?? []).map(toCard), pagination: toPageInfo(body.meta), typeLabel: TYPE_LABEL[current] }
            : null,
      };
      return { view, seo: body.seo };
    });
  };
}

export const categoryProps = taxonomyProps('category');
export const tagProps = taxonomyProps('tag');
