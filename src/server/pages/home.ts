// 受保護（src/server/**）：首頁的取資料函式。
import type { GetServerSideProps } from 'next';
import type { HomeViewProps } from '@/lib/content/types';
import type { PageProps } from '@/lib/page-props';
import { strLimit } from '@/lib/text';
import { homeRequest } from '../api-path';
import { toCard } from '../mappers';
import { isReadMethod, loadPage, methodNotAllowedPage, requestContext } from '../page-data';
import { HomeResponseSchema, type ApiSeo } from '../schemas';

/**
 * 網站資訊取不到（內建靜態頁首頁尾）時的首頁中繼資料：比照 PageMetaFactory::home(null)——
 * 標題為內建站名、說明為「內建站名：影片、Podcast 與文章。」（PageMeta::describe 以 Str::limit 截到 150）。
 * API 的首頁 seo 是用 WordPress 的站名組的，直接沿用會讓 <title> 變成「WordPress 站名｜內建站名」，
 * 與頁首的內建站名不一致。
 */
export function staticHomeSeo(seo: ApiSeo, siteName: string): ApiSeo {
  return { ...seo, title: siteName, description: strLimit(`${siteName}：影片、Podcast 與文章。`, 150, '…') };
}

export const homeProps: GetServerSideProps<PageProps<HomeViewProps>> = async (ctx) => {
  const rc = requestContext(ctx);
  if (!isReadMethod(ctx.req.method)) return methodNotAllowedPage(ctx, rc);
  return loadPage(ctx, rc, homeRequest(), HomeResponseSchema, (body, site) => ({
    view: {
      siteName: site?.name ?? rc.config.siteName,
      site,
      featured: body.data.featured === null ? null : toCard(body.data.featured),
      posts: body.data.posts.map(toCard),
      videos: body.data.videos.map(toCard),
      podcasts: body.data.podcasts.map(toCard),
    },
    seo: site === null ? staticHomeSeo(body.seo, rc.config.siteName) : body.seo,
  }));
};
