// 受保護（src/server/**）：文章、影片、Podcast 列表頁的取資料函式。
import type { GetServerSideProps } from 'next';
import type { CollectionViewProps, ListableType } from '@/lib/content/types';
import type { PageProps } from '@/lib/page-props';
import { collectionPath } from '@/lib/paths';
import { listRequest, parsePage } from '../api-path';
import { toCard, toCollection, toPageInfo } from '../mappers';
import { loadPage, notFoundPage, requestContext } from '../page-data';
import { ListResponseSchema } from '../schemas';

export function collectionProps(type: ListableType): GetServerSideProps<PageProps<CollectionViewProps>> {
  return async (ctx) => {
    const rc = requestContext(ctx);
    const page = parsePage(ctx.query.page);
    if (!page.ok) return notFoundPage(ctx, rc);
    return loadPage(ctx, rc, listRequest(type, page.page), ListResponseSchema, (body) => ({
      view: {
        collection: toCollection(body.collection),
        items: body.data.map(toCard),
        pagination: toPageInfo(body.meta),
        basePath: collectionPath(type),
      },
      seo: body.seo,
    }));
  };
}

export const articlesProps = collectionProps('post');
export const videosProps = collectionProps('video');
export const podcastsProps = collectionProps('podcast');
