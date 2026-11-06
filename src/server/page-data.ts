// 受保護（src/server/**）：每一頁共用的取資料流程（v1 §4.3、§6.3；定案執行書 §4.9）。
// 1. 以 Promise.allSettled 並行取 /api/v1/site 與內容端點。
// 2. 結果對照（§4.9）：
//    內容 200＋site 成功 → 正常畫面
//    內容 200＋site 失敗 → 正文照常；頁首頁尾改用內建靜態版
//    內容 404／503＋site 成功 → 錯誤頁，完整版面，附請求編號
//    內容 404／503＋site 失敗 → 錯誤頁，內建靜態頁首頁尾，附請求編號
//    傳輸失敗、逾時、非 JSON、格式不符 → 503
// 3. 404、503 由頁面自己設 res.statusCode（不用 notFound: true，v1 §4.3 第 4 步）。
import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next';
import type { z } from 'zod';
import type { ErrorInfo, SiteInfo } from '@/lib/content/types';
import type { HeadProps, PageProps, ShellProps } from '@/lib/page-props';
import { getJson, type FetchResult } from './api-client';
import { siteRequest, type ApiRequest } from './api-path';
import { serverConfig, type ServerConfig } from './config';
import { toSiteInfo } from './mappers';
import { requestIdFrom } from './request-id';
import { SiteResponseSchema, type ApiSeo } from './schemas';

export const ERROR_HEADINGS: Record<ErrorInfo['status'], string> = {
  404: '找不到這個頁面',
  500: '系統發生錯誤',
  503: '內容暫時無法讀取',
};

/** 錯誤說明（比照 Laravel ErrorCode::publicMessage 與 ErrorRenderer）。 */
export const ERROR_MESSAGES = {
  contentNotFound: '找不到這個內容。',
  pageNotFound: '找不到這個頁面。',
  unavailable: '內容暫時無法讀取，請稍後再試。',
  internal: '系統發生錯誤，請稍後再試。',
} as const;

export interface RequestContext {
  config: ServerConfig;
  requestId: string;
  currentPath: string;
  /** 「重新整理」連結用的站內路徑（含查詢字串）。 */
  retryPath: string;
}

/** 只接受站內相對路徑；// 開頭（可被當成其他網站）一律改成 /。 */
export function safeLocalPath(raw: string): string {
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

export function requestContext(ctx: Pick<GetServerSidePropsContext, 'req' | 'res' | 'resolvedUrl'>): RequestContext {
  const config = serverConfig();
  const requestId = requestIdFrom(ctx.req.headers['x-request-id']);
  ctx.res.setHeader('X-Request-Id', requestId);
  const resolved = safeLocalPath(ctx.resolvedUrl || '/');
  const currentPath = resolved.split(/[?#]/, 1)[0] ?? '/';
  return { config, requestId, currentPath, retryPath: resolved };
}

export function shellProps(rc: RequestContext, site: SiteInfo | null): ShellProps {
  return {
    site,
    siteName: site?.name ?? rc.config.siteName,
    currentPath: rc.currentPath,
    dataSource: process.env.NODE_ENV === 'development' ? rc.config.mode : null,
  };
}

/** 組 <title>：title 為空或等於站名時只用站名，否則「title｜站名」（PageMeta::fullTitle）。 */
export function fullTitle(title: string, siteName: string): string {
  return title === '' || title === siteName ? siteName : `${title}｜${siteName}`;
}

function absoluteUrl(origin: string, pathOrUrl: string): string {
  return pathOrUrl.startsWith('/') && !pathOrUrl.startsWith('//') ? `${origin}${pathOrUrl}` : pathOrUrl;
}

export function headFromSeo(seo: ApiSeo, siteName: string, config: ServerConfig): HeadProps {
  const canonical = absoluteUrl(config.publicOrigin, seo.canonical_path);
  const image = seo.og_image === null ? null : absoluteUrl(config.publicOrigin, seo.og_image);
  return {
    title: fullTitle(seo.title, siteName),
    description: seo.description === '' ? null : seo.description,
    canonical,
    robots: seo.noindex ? 'noindex, nofollow' : null,
    og: {
      type: seo.og_type,
      title: seo.title !== '' ? seo.title : siteName,
      description: seo.description === '' ? null : seo.description,
      image,
      imageAlt: image === null ? null : seo.og_image_alt,
    },
    siteName,
  };
}

export function errorHead(status: ErrorInfo['status'], siteName: string): HeadProps {
  return { title: fullTitle(ERROR_HEADINGS[status], siteName), description: null, canonical: null, robots: 'noindex, nofollow', og: null, siteName };
}

/** 錯誤頁的 props（404／503；500 由 _error 產生）。 */
export function errorProps<V>(
  ctx: Pick<GetServerSidePropsContext, 'res'>,
  rc: RequestContext,
  status: 404 | 503,
  site: SiteInfo | null,
  message: string = status === 404 ? ERROR_MESSAGES.contentNotFound : ERROR_MESSAGES.unavailable,
): GetServerSidePropsResult<PageProps<V>> {
  ctx.res.statusCode = status;
  const shell = shellProps(rc, site);
  return {
    props: {
      shell,
      head: errorHead(status, shell.siteName),
      error: { status, message, requestId: rc.requestId, retryPath: status === 503 ? rc.retryPath : null },
    },
  };
}

/** 只取網站資訊（萬用路由的 404 等不需要內容端點的情況）。 */
export async function loadSite(rc: RequestContext): Promise<SiteInfo | null> {
  const result = await getJson(siteRequest(), SiteResponseSchema, { config: rc.config, requestId: rc.requestId });
  return result.kind === 'ok' ? toSiteInfo(result.data.data) : null;
}

/** 並行取網站資訊與內容端點（§4.9）。 */
export async function loadWithSite<T>(
  rc: RequestContext,
  request: ApiRequest,
  schema: z.ZodType<T>,
  allowInvalid = false,
): Promise<{ site: SiteInfo | null; content: FetchResult<T> }> {
  const options = { config: rc.config, requestId: rc.requestId };
  const [siteResult, contentResult] = await Promise.allSettled([
    getJson(siteRequest(), SiteResponseSchema, options),
    getJson(request, schema, { ...options, allowInvalid }),
  ]);
  const site =
    siteResult.status === 'fulfilled' && siteResult.value.kind === 'ok' ? toSiteInfo(siteResult.value.data.data) : null;
  const content: FetchResult<T> =
    contentResult.status === 'fulfilled' ? contentResult.value : { kind: 'unavailable', reason: 'transport' };
  return { site, content };
}

/**
 * 一般頁面的完整流程：取資料 → 依結果回正常畫面或錯誤頁。
 * build 只在內容 200 時呼叫，回傳畫面 props 與該頁的 seo。
 */
export async function loadPage<T, V>(
  ctx: GetServerSidePropsContext,
  rc: RequestContext,
  request: ApiRequest,
  schema: z.ZodType<T>,
  build: (data: T, site: SiteInfo | null) => { view: V; seo: ApiSeo },
): Promise<GetServerSidePropsResult<PageProps<V>>> {
  const { site, content } = await loadWithSite(rc, request, schema);
  if (content.kind === 'not_found') return errorProps(ctx, rc, 404, site);
  if (content.kind !== 'ok') return errorProps(ctx, rc, 503, site);
  const { view, seo } = build(content.data, site);
  const shell = shellProps(rc, site);
  return { props: { shell, head: headFromSeo(seo, shell.siteName, rc.config), view } };
}

/** 不合格的網址參數：不呼叫內容端點，只取網站資訊畫 404。 */
export async function notFoundPage<V>(ctx: GetServerSidePropsContext, rc: RequestContext): Promise<GetServerSidePropsResult<PageProps<V>>> {
  return errorProps(ctx, rc, 404, await loadSite(rc), ERROR_MESSAGES.pageNotFound);
}
