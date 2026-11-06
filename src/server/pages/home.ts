// 受保護（src/server/**）：首頁的取資料函式。
import type { GetServerSideProps } from 'next';
import type { HomeViewProps } from '@/lib/content/types';
import type { PageProps } from '@/lib/page-props';
import { homeRequest } from '../api-path';
import { toCard } from '../mappers';
import { loadPage, requestContext } from '../page-data';
import { HomeResponseSchema } from '../schemas';

export const homeProps: GetServerSideProps<PageProps<HomeViewProps>> = async (ctx) => {
  const rc = requestContext(ctx);
  return loadPage(ctx, rc, homeRequest(), HomeResponseSchema, (body, site) => ({
    view: {
      siteName: site?.name ?? rc.config.siteName,
      site,
      featured: body.data.featured === null ? null : toCard(body.data.featured),
      posts: body.data.posts.map(toCard),
      videos: body.data.videos.map(toCard),
      podcasts: body.data.podcasts.map(toCard),
    },
    seo: body.seo,
  }));
};
