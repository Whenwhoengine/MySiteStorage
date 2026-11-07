// 受保護（src/server/**）：每一頁共用的取資料流程（v1 §4.3、§6.3；定案執行書 §4.9）。
// 1. 以 Promise.allSettled 並行取 /api/v1/site 與內容端點。
// 2. 結果對照（§4.9）：
//    內容 200＋site 成功 → 正常畫面
//    內容 200＋site 失敗 → 正文照常；頁首頁尾改用內建靜態版
//    內容 404／503＋site 成功 → 錯誤頁，完整版面，附請求編號
//    內容 404／503＋site 失敗 → 錯誤頁，內建靜態頁首頁尾，附請求編號
//    傳輸失敗、逾時、非 JSON、格式不符 → 503
// 3. 404、405、503 由頁面自己設 res.statusCode（不用 notFound: true，v1 §4.3 第 4 步）。
// 4. 公開頁只接受 GET（HEAD 由 Next.js 隨 GET 處理、不送內文）；其他方法回 405（比照 Laravel 路由＋ErrorRenderer）。
import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next';
import type { z } from 'zod';
import type { SiteInfo } from '@/lib/content/types';
import { ERROR_MESSAGES, errorHead, fullTitle, unavailableMessage } from '@/lib/errors';
import type { HeadProps, PageProps, ShellProps } from '@/lib/page-props';
export { ERROR_HEADINGS, ERROR_MESSAGES, errorHead, fullTitle } from '@/lib/errors';
import { getJson, type FetchResult } from './api-client';
import { matchesSlugRoute, siteRequest, type ApiRequest } from './api-path';
import { serverConfig, type ServerConfig } from './config';
import { toSiteInfo } from './mappers';
import { requestIdFrom } from './request-id';
import { SiteResponseSchema, type ApiSeo } from './schemas';

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
    staticSiteName: rc.config.siteName,
    currentPath: rc.currentPath,
    dataSource: process.env.NODE_ENV === 'development' ? rc.config.mode : null,
  };
}

/**
 * canonical 與 og:url：一律「主站公開網址＋路徑」，比照 PageMeta::canonicalUrl（rtrim(APP_URL, '/') . $path）。
 * 不論路徑長怎樣（包括 // 或 /\ 開頭）都接在主站網址之後，結果必定同源，不會變成指向其他主機的網址。
 * 契約保證 canonical_path 以 / 開頭；不是時不輸出 canonical。
 */
export function canonicalUrl(origin: string, canonicalPath: string): string | null {
  return canonicalPath.startsWith('/') ? `${origin}${canonicalPath}` : null;
}

/**
 * og:image：只收兩種，其餘不輸出——
 * 1. 單一 / 開頭的站內路徑（假資料的 /mock-media/…），接在主站網址之後；
 * 2. https 絕對網址（主機非空、不含帳號密碼），對應媒體政策 Sanitizer::isAllowedMediaUrl 的 https 分支
 *    （正式環境 WP_PUBLIC_URL 必須是 https，所以正式環境通過政策的圖片都屬此類）。
 * 與該政策相同，含控制字元、空白或反斜線的一律不收；// 開頭（協定相對、會指向其他主機）不收。
 */
export function ogImageUrl(origin: string, raw: string): string | null {
  // eslint-disable-next-line no-control-regex -- 刻意比對控制字元（同 Sanitizer::isAllowedMediaUrl 的 [\x00-\x20\\]）
  if (raw === '' || /[\u0000- \\]/.test(raw)) return null;
  if (raw.startsWith('/')) return raw.startsWith('//') ? null : `${origin}${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname === '' || url.username !== '' || url.password !== '') return null;
  return raw;
}

export function headFromSeo(seo: ApiSeo, siteName: string, config: ServerConfig): HeadProps {
  const canonical = canonicalUrl(config.publicOrigin, seo.canonical_path);
  const image = seo.og_image === null ? null : ogImageUrl(config.publicOrigin, seo.og_image);
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

/** 錯誤頁的 props（404／405／503；500 由 _error 產生）。 */
export function errorProps<V>(
  ctx: Pick<GetServerSidePropsContext, 'res'>,
  rc: RequestContext,
  status: 404 | 405 | 503,
  site: SiteInfo | null,
  message: string = status === 404
    ? ERROR_MESSAGES.contentNotFound
    : status === 405
      ? ERROR_MESSAGES.methodNotAllowed
      : ERROR_MESSAGES.unavailable,
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
  if (content.kind === 'unavailable') return errorProps(ctx, rc, 503, site, unavailableMessage(content.code));
  if (content.kind !== 'ok') return errorProps(ctx, rc, 503, site);
  const { view, seo } = build(content.data, site);
  const shell = shellProps(rc, site);
  return { props: { shell, head: headFromSeo(seo, shell.siteName, rc.config), view } };
}

/**
 * 不合格的網址參數：不呼叫內容端點，只取網站資訊畫 404。
 * 說明預設為「找不到這個內容。」（page 不合格時 Laravel 丟 CONTENT_NOT_FOUND，PublicContentInput::page）；
 * 沒有對應路由的情況（萬用路由、slug 不符路由規則）傳入 ERROR_MESSAGES.pageNotFound。
 */
export async function notFoundPage<V>(
  ctx: GetServerSidePropsContext,
  rc: RequestContext,
  message: string = ERROR_MESSAGES.contentNotFound,
): Promise<GetServerSidePropsResult<PageProps<V>>> {
  return errorProps(ctx, rc, 404, await loadSite(rc), message);
}

/**
 * slug 不合格的 404：不符合 Laravel 路由規則（超過 200 字等）時 Laravel 沒有對應路由 →「找不到這個頁面。」；
 * 符合路由但不送出（. 、.. 、控制字元）時，Laravel 的內容端同樣回 CONTENT_NOT_FOUND →「找不到這個內容。」。
 */
export function invalidSlugPage<V>(
  ctx: GetServerSidePropsContext,
  rc: RequestContext,
  slug: string | undefined,
): Promise<GetServerSidePropsResult<PageProps<V>>> {
  return notFoundPage(ctx, rc, matchesSlugRoute(slug) ? ERROR_MESSAGES.contentNotFound : ERROR_MESSAGES.pageNotFound);
}

/** 公開頁接受的方法：GET 與 HEAD（Laravel 的 Route::get 同時登記兩者）。未提供時視同 GET。 */
export function isReadMethod(method: string | undefined): boolean {
  const upper = (method ?? 'GET').toUpperCase();
  return upper === 'GET' || upper === 'HEAD';
}

/**
 * 其他方法：405「不支援這個操作。」，完整版面（只取網站資訊，不呼叫內容端點）。
 * 比照 Blade：Laravel 路由丟 MethodNotAllowedHttpException → ErrorRenderer::respond，回應不帶 Allow 標頭
 * （ErrorRenderer 不沿用例外的標頭）。
 * OPTIONS：正式伺服器（next start）在進到頁面程式之前就回 400、空內文（2026-11-07 實測），本函式碰不到；
 * Blade 對 OPTIONS 回 200 空內文＋Allow: GET,HEAD（Laravel AbstractRouteCollection::getRouteForMethods）。
 * 本專案不得用 middleware／proxy，所以這個差異留給 F6 的 gateway 在 next 模式處理。
 * 萬一 OPTIONS 進到這裡（例如日後 Next.js 改變行為），一樣回 405，不畫內容。
 */
export async function methodNotAllowedPage<V>(
  ctx: GetServerSidePropsContext,
  rc: RequestContext,
): Promise<GetServerSidePropsResult<PageProps<V>>> {
  return errorProps(ctx, rc, 405, await loadSite(rc));
}
