// 受保護（src/server/**）：分類、標籤頁的取資料函式。
import type { GetServerSideProps } from 'next';
import type { ListableType, TaxonomyViewProps } from '@/lib/content/types';
import type { PageProps } from '@/lib/page-props';
import { COLLECTION_TITLE, LISTABLE_TYPES, TYPE_LABEL } from '@/lib/paths';
import { QUERY_ARRAY, isValidSlug, lastValue, matchesSlugRoute, parsePage, queryValue, taxonomyRequest } from '../api-path';
import { toCard, toPageInfo } from '../mappers';
import { invalidSlugPage, isReadMethod, loadPage, methodNotAllowedPage, notFoundPage, requestContext } from '../page-data';
import { TaxonomyResponseSchema } from '../schemas';

export function taxonomyProps(kind: 'category' | 'tag'): GetServerSideProps<PageProps<TaxonomyViewProps>> {
  return async (ctx) => {
    const rc = requestContext(ctx);
    const slug = lastValue(ctx.params?.slug);
    // Laravel 先比對路由：slug 不符路由規則時沒有對應路由（任何方法都是 404），符合時才檢查方法
    if (matchesSlugRoute(slug) && !isReadMethod(ctx.req.method)) return methodNotAllowedPage(ctx, rc);
    if (!isValidSlug(slug)) return invalidSlugPage(ctx, rc, slug);
    const page = parsePage(queryValue(ctx.query, 'page'));
    const typeValue = queryValue(ctx.query, 'type');
    // type 是陣列（?type[]=post）時 Laravel 判為不認得的型別 → 404（ContentController::taxonomy）
    if (!page.ok || typeValue === QUERY_ARRAY) return notFoundPage(ctx, rc);
    // type 照原樣交給 API 判斷（不認得的值 API 回 404）；空白視同未帶
    const rawType = typeValue?.trim() ?? '';
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
