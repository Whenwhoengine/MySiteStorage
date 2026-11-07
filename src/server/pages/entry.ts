// 受保護（src/server/**）：單篇內容（文章、影片、Podcast、一般頁面）的取資料函式。
import type { GetServerSideProps } from 'next';
import type { ContentType, EntryViewProps } from '@/lib/content/types';
import type { PageProps } from '@/lib/page-props';
import { detailRequest, isValidSlug, lastValue, matchesSlugRoute } from '../api-path';
import { toEntry } from '../mappers';
import { invalidSlugPage, isReadMethod, loadPage, methodNotAllowedPage, requestContext } from '../page-data';
import { DetailResponseSchema } from '../schemas';

export function entryProps(type: ContentType): GetServerSideProps<PageProps<EntryViewProps>> {
  return async (ctx) => {
    const rc = requestContext(ctx);
    const slug = lastValue(ctx.params?.slug);
    // Laravel 先比對路由：slug 不符路由規則時沒有對應路由（任何方法都是 404），符合時才檢查方法
    if (matchesSlugRoute(slug) && !isReadMethod(ctx.req.method)) return methodNotAllowedPage(ctx, rc);
    if (!isValidSlug(slug)) return invalidSlugPage(ctx, rc, slug);
    return loadPage(ctx, rc, detailRequest(type, slug), DetailResponseSchema, (body) => ({
      view: { item: toEntry(body.data) },
      seo: body.seo,
    }));
  };
}

export const articleProps = entryProps('post');
export const videoProps = entryProps('video');
export const podcastProps = entryProps('podcast');
export const pageProps = entryProps('page');
