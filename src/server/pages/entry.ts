// 受保護（src/server/**）：單篇內容（文章、影片、Podcast、一般頁面）的取資料函式。
import type { GetServerSideProps } from 'next';
import type { ContentType, EntryViewProps } from '@/lib/content/types';
import type { PageProps } from '@/lib/page-props';
import { detailRequest, isValidSlug, lastValue } from '../api-path';
import { toEntry } from '../mappers';
import { loadPage, notFoundPage, requestContext } from '../page-data';
import { DetailResponseSchema } from '../schemas';

export function entryProps(type: ContentType): GetServerSideProps<PageProps<EntryViewProps>> {
  return async (ctx) => {
    const rc = requestContext(ctx);
    const slug = lastValue(ctx.params?.slug);
    if (!isValidSlug(slug)) return notFoundPage(ctx, rc);
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
