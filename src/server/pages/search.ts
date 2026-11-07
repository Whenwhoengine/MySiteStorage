// 受保護（src/server/**）：搜尋頁的取資料函式。
// 搜尋一律走原生表單（GET /search），不做逐字即時搜尋（定案執行書 §4.4）。
// 查詢詞不合格時 API 回 422 SEARCH_INVALID，本頁同樣回 422 並畫錯誤分支（比照 Blade ContentController::search）。
import type { GetServerSideProps } from 'next';
import type { ContentType, SearchViewProps } from '@/lib/content/types';
import { unavailableMessage } from '@/lib/errors';
import type { PageProps } from '@/lib/page-props';
import { COLLECTION_TITLE } from '@/lib/paths';
import { normalizeQuery, strimWidth } from '@/lib/text';
import { parsePage, queryString, queryValue, searchRequest } from '../api-path';
import { toCard, toPageInfo } from '../mappers';
import {
  errorProps,
  headFromSeo,
  isReadMethod,
  loadWithSite,
  methodNotAllowedPage,
  notFoundPage,
  requestContext,
  shellProps,
} from '../page-data';
import { SearchResponseSchema } from '../schemas';

const TYPES: ContentType[] = ['post', 'page', 'video', 'podcast'];

const TYPE_OPTIONS: SearchViewProps['typeOptions'] = [
  { value: '', label: '全部' },
  ...TYPES.map((t) => ({ value: t, label: COLLECTION_TITLE[t] })),
];

function asType(value: string): ContentType | null {
  return (TYPES as string[]).includes(value) ? (value as ContentType) : null;
}

export const searchProps: GetServerSideProps<PageProps<SearchViewProps>> = async (ctx) => {
  const rc = requestContext(ctx);
  if (!isReadMethod(ctx.req.method)) return methodNotAllowedPage(ctx, rc);
  const page = parsePage(queryValue(ctx.query, 'page'));
  if (!page.ok) return notFoundPage(ctx, rc);

  // q、type 是陣列時 Laravel 當成沒帶（PublicContentInput::search 的 is_string 判斷）
  const rawQ = queryString(ctx.query, 'q');
  const rawType = queryString(ctx.query, 'type');
  const typeValue = rawType?.trim() ?? '';
  const q = normalizeQuery(rawQ ?? '');

  const { site, content } = await loadWithSite(
    rc,
    searchRequest(rawQ ?? null, typeValue === '' ? null : typeValue, page.page),
    SearchResponseSchema,
    true,
  );
  if (content.kind === 'not_found') return errorProps(ctx, rc, 404, site);
  if (content.kind === 'unavailable') return errorProps(ctx, rc, 503, site, unavailableMessage(content.code));

  const shell = shellProps(rc, site);
  if (content.kind === 'invalid') {
    ctx.res.statusCode = 422;
    const title = q !== '' ? `搜尋「${strimWidth(q, 40)}」${(page.page ?? 1) > 1 ? `（第 ${page.page} 頁）` : ''}` : '搜尋';
    return {
      props: {
        shell,
        head: headFromSeo(
          {
            title,
            description: '搜尋站內文章、影片與 Podcast。',
            canonical_path: '/search',
            noindex: true,
            og_type: 'website',
            og_image: null,
            og_image_alt: null,
          },
          shell.siteName,
          rc.config,
        ),
        view: { q, type: asType(typeValue), typeOptions: TYPE_OPTIONS, error: content.message, result: null },
      },
    };
  }

  const data = content.data.data;
  return {
    props: {
      shell,
      head: headFromSeo(content.data.seo, shell.siteName, rc.config),
      view: {
        q: data.q,
        type: data.type,
        typeOptions: TYPE_OPTIONS,
        error: null,
        result:
          data.searched && content.data.meta !== null
            ? { items: data.items.map(toCard), pagination: toPageInfo(content.data.meta) }
            : null,
      },
    },
  };
};
