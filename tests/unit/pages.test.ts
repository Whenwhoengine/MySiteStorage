// 各頁取資料函式（src/server/pages/*）與 Blade 的一致性：非 GET 回 405、page 上限與陣列參數、
// slug 不合格的說明、首頁在網站資訊取不到時的 <title>、canonical 與 og:image 的網址政策。
// 期望值出處：mysite app/routes/content.php、PublicContentInput、ContentController、ErrorRenderer、PageMetaFactory，
// 以及 2026-11-07 對 mysite 開發環境 Blade 站（http://mysite.localhost:8080）的實測。
// 以真資料模式連假 API（tests/support/fake-api.mjs），用請求編號查每個情境實際呼叫了哪些 API。
import type { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PageProps } from '@/lib/page-props';
import type { ServerConfig } from '@/server/config';
import { headFromSeo } from '@/server/page-data';
import { catchAllProps } from '@/server/pages/catch-all';
import { articlesProps } from '@/server/pages/collection';
import { articleProps, pageProps } from '@/server/pages/entry';
import { homeProps, staticHomeSeo } from '@/server/pages/home';
import { searchProps } from '@/server/pages/search';
import { categoryProps, tagProps } from '@/server/pages/taxonomy';
import type { ApiSeo } from '@/server/schemas';
import { startFakeApi, type FakeApi } from '../support/fake-api.mjs';

let api: FakeApi;
// 測試專用的短逾時（不是正式值；正式值依 D13c 為 50000）
const TEST_TIMEOUT_MS = '400';
const PUBLIC_ORIGIN = 'https://www.example.test';

beforeAll(async () => {
  api = await startFakeApi();
  vi.stubEnv('MYSITE_DATA_MODE', 'api');
  vi.stubEnv('MYSITE_API_ORIGIN', `http://127.0.0.1:${api.port}`);
  vi.stubEnv('MYSITE_API_TIMEOUT_MS', TEST_TIMEOUT_MS);
  vi.stubEnv('MYSITE_PUBLIC_ORIGIN', PUBLIC_ORIGIN);
  vi.stubEnv('MYSITE_SITE_NAME', '內建站名');
  vi.stubEnv('DEPLOY_ENVIRONMENT', '');
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await api.close();
});

let counter = 0;
/** 每個情境各用一個請求編號；prefix 決定假 API 的 /api/v1/site 行為（dead → 503）。 */
function newRid(prefix = ''): string {
  counter += 1;
  return `${prefix}${counter.toString(16).padStart(32 - prefix.length, '0')}`;
}

interface Call {
  method?: string;
  rid?: string;
  query?: Record<string, string | string[]>;
  params?: Record<string, string | string[]>;
  url: string;
}

async function run<V>(fn: GetServerSideProps<PageProps<V>>, call: Call) {
  const rid = call.rid ?? newRid();
  const headers: Record<string, string> = {};
  const res = { statusCode: 200, setHeader: (k: string, v: string) => void (headers[k.toLowerCase()] = v) };
  const ctx = {
    req: { method: call.method ?? 'GET', headers: { 'x-request-id': rid } },
    res,
    // Next.js 的 ctx.query 含路由參數
    query: { ...(call.query ?? {}), ...(call.params ?? {}) },
    params: call.params,
    resolvedUrl: call.url,
  } as unknown as GetServerSidePropsContext;
  const result = await fn(ctx);
  if (!('props' in result)) throw new Error('預期回傳 props');
  return { props: await result.props, status: res.statusCode, headers, calls: api.log.get(rid) ?? [] };
}

const ARTICLE = { slug: 'sample-gutenberg-blocks' };

describe('非 GET、HEAD 的方法：405（Laravel Route::get＋ErrorRenderer）', () => {
  const pages: [string, GetServerSideProps<PageProps<unknown>>, Call][] = [
    ['首頁', homeProps as GetServerSideProps<PageProps<unknown>>, { url: '/' }],
    ['文章列表', articlesProps as GetServerSideProps<PageProps<unknown>>, { url: '/articles' }],
    ['單篇', articleProps as GetServerSideProps<PageProps<unknown>>, { url: '/articles/sample-gutenberg-blocks', params: ARTICLE }],
    ['一般頁面', pageProps as GetServerSideProps<PageProps<unknown>>, { url: '/pages/privacy', params: { slug: 'privacy' } }],
    ['分類', categoryProps as GetServerSideProps<PageProps<unknown>>, { url: '/categories/sample-tech', params: { slug: 'sample-tech' } }],
    ['標籤', tagProps as GetServerSideProps<PageProps<unknown>>, { url: '/tags/sample', params: { slug: 'sample' } }],
    ['搜尋', searchProps as GetServerSideProps<PageProps<unknown>>, { url: '/search?q=x', query: { q: 'x' } }],
  ];
  for (const [label, fn, call] of pages) {
    it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(`${label}：%s → 405，完整版面，不呼叫內容端點`, async (method) => {
      const { props, status, headers, calls } = await run(fn, { ...call, method });
      expect(status).toBe(405);
      expect(props.error).toMatchObject({ status: 405, message: '不支援這個操作。', retryPath: null });
      expect(props.error?.requestId).toMatch(/^[a-f0-9]{32}$/);
      expect(props.view).toBeUndefined();
      expect(props.head.title).toBe('無法完成請求｜mysite');
      expect(props.head.robots).toBe('noindex, nofollow');
      expect(props.shell.site).not.toBeNull();
      // Blade 的 405 不帶 Allow（ErrorRenderer::respond 不沿用例外的標頭）
      expect(headers.allow).toBeUndefined();
      expect(headers['x-request-id']).toBe(props.error?.requestId);
      expect(calls).toEqual(['/api/v1/site']);
    });
  }

  it.each(['GET', 'HEAD', 'get'])('%s 照常回內容', async (method) => {
    const { props, status } = await run(articlesProps, { url: '/articles', method });
    expect(status).toBe(200);
    expect(props.view).toBeDefined();
  });

  it('slug 不符路由規則時沒有對應路由：任何方法都是 404「找不到這個頁面。」', async () => {
    const { props, status, calls } = await run(articleProps, { url: '/articles/x', params: { slug: 'x'.repeat(201) }, method: 'POST' });
    expect(status).toBe(404);
    expect(props.error?.message).toBe('找不到這個頁面。');
    expect(calls).toEqual(['/api/v1/site']);
  });

  it('slug 符合路由（.. 也符合）時先回 405', async () => {
    const { status } = await run(articleProps, { url: '/articles/..', params: { slug: '..' }, method: 'POST' });
    expect(status).toBe(405);
  });

  it('不存在的路徑：任何方法都是 404「找不到這個頁面。」', async () => {
    const { props, status } = await run(catchAllProps, { url: '/no-such-page', params: { path: ['no-such-page'] }, method: 'POST' });
    expect(status).toBe(404);
    expect(props.error?.message).toBe('找不到這個頁面。');
  });
});

describe('page 參數上限 1000 與陣列寫法（PublicContentInput::page）', () => {
  it.each([
    ['1001', { page: '1001' }],
    ['9999', { page: '9999' }],
    ['page[]=2', { 'page[]': '2' }],
    ['page[a]=2', { 'page[a]': '2' }],
    ['page=1&page[]=1', { page: '1', 'page[]': '1' }],
  ])('/articles?%s → 404「找不到這個內容。」，不呼叫內容端點', async (_label, query) => {
    const { props, status, calls } = await run(articlesProps, { url: '/articles', query });
    expect(status).toBe(404);
    expect(props.error).toMatchObject({ status: 404, message: '找不到這個內容。' });
    expect(props.shell.site).not.toBeNull();
    expect(calls).toEqual(['/api/v1/site']);
  });

  it('page=1000 照常送往 API（超過總頁數由 API 回 404）', async () => {
    const { calls } = await run(articlesProps, { url: '/articles?page=1000', query: { page: '1000' } });
    expect(calls).toContain('/api/v1/articles?page=1000');
  });

  it('page[ 與 page] 不是 page（PHP 名稱為 page_、page]）', async () => {
    const { status, calls } = await run(articlesProps, { url: '/articles', query: { 'page[': '2', 'page]': '3' } });
    expect(status).toBe(200);
    expect(calls).toContain('/api/v1/articles');
  });

  it('分類／標籤：type 是陣列 → 404；type 空白 → 總覽', async () => {
    const array = await run(tagProps, { url: '/tags/sample', params: { slug: 'sample' }, query: { 'type[]': 'post' } });
    expect(array.status).toBe(404);
    expect(array.props.error?.message).toBe('找不到這個內容。');
    expect(array.calls).toEqual(['/api/v1/site']);
    const pageArray = await run(tagProps, { url: '/tags/sample', params: { slug: 'sample' }, query: { 'page[]': '1' } });
    expect(pageArray.status).toBe(404);
    const blank = await run(tagProps, { url: '/tags/sample', params: { slug: 'sample' }, query: { type: '' } });
    expect(blank.status).toBe(200);
  });

  it('搜尋：q、type 是陣列時當成沒帶；page 是陣列 → 404', async () => {
    const qArray = await run(searchProps, { url: '/search', query: { 'q[]': 'x' } });
    expect(qArray.status).toBe(200);
    expect(qArray.props.view).toMatchObject({ q: '', result: null, error: null });
    expect(qArray.calls).toContain('/api/v1/search');
    // 同名以最後一個為準：q=示例&q[]=y 的 q 是陣列 → 不搜尋（Blade 實測 <title>搜尋｜…）
    const lastWins = await run(searchProps, { url: '/search', query: { q: '示例', 'q[]': 'y' } });
    expect(lastWins.props.view).toMatchObject({ q: '', result: null });
    const typeArray = await run(searchProps, { url: '/search', query: { 'type[]': 'bad' } });
    expect(typeArray.status).toBe(200);
    expect(typeArray.props.view?.error).toBeNull();
    const pageArray = await run(searchProps, { url: '/search', query: { q: 'x', 'page[]': '2' } });
    expect(pageArray.status).toBe(404);
    expect(pageArray.props.error?.message).toBe('找不到這個內容。');
  });

  it('搜尋：沒有字詞但帶 page → 200 空白搜尋頁（不是 404）', async () => {
    const { status, props } = await run(searchProps, { url: '/search?page=2', query: { page: '2' } });
    expect(status).toBe(200);
    expect(props.view).toMatchObject({ q: '', result: null, error: null });
    expect(props.head.title).toBe('搜尋｜mysite');
  });
});

describe('slug 不合格的說明（Laravel 有無對應路由）', () => {
  it.each([
    ['..', '找不到這個內容。'],
    ['.', '找不到這個內容。'],
    ['a\nb', '找不到這個內容。'],
    ['a\u007fb', '找不到這個內容。'],
    ['x'.repeat(201), '找不到這個頁面。'],
  ])('單篇 slug %j → 404「%s」，不呼叫內容端點', async (slug, message) => {
    const { props, status, calls } = await run(articleProps, { url: '/articles/x', params: { slug } });
    expect(status).toBe(404);
    expect(props.error?.message).toBe(message);
    expect(calls).toEqual(['/api/v1/site']);
  });

  it('標籤 slug 超過 200 字 → 「找不到這個頁面。」', async () => {
    const { props } = await run(tagProps, { url: '/tags/x', params: { slug: '示'.repeat(201) } });
    expect(props.error?.message).toBe('找不到這個頁面。');
  });

  it('內容不存在（API 404）→「找不到這個內容。」', async () => {
    const { props, status } = await run(articleProps, { url: '/articles/no-such', params: { slug: 'no-such' } });
    expect(status).toBe(404);
    expect(props.error?.message).toBe('找不到這個內容。');
  });
});

describe('首頁：網站資訊取不到時，<title> 與內建靜態頁首用同一個站名', () => {
  it('site 503 → title、og:title、說明都用內建站名（PageMetaFactory::home(null)）', async () => {
    const { props, status } = await run(homeProps, { url: '/', rid: newRid('dead') });
    expect(status).toBe(200);
    expect(props.shell).toMatchObject({ site: null, siteName: '內建站名', staticSiteName: '內建站名' });
    expect(props.head.title).toBe('內建站名');
    expect(props.head.siteName).toBe('內建站名');
    expect(props.head.og?.title).toBe('內建站名');
    expect(props.head.description).toBe('內建站名：影片、Podcast 與文章。');
    expect(props.view?.siteName).toBe('內建站名');
  });

  it('site 正常 → 沿用 API 的首頁 seo（網站資訊的站名）', async () => {
    const { props } = await run(homeProps, { url: '/' });
    expect(props.shell).toMatchObject({ siteName: 'mysite', staticSiteName: '內建站名' });
    expect(props.head.title).toBe('mysite');
  });

  it('內建站名很長時說明以 Str::limit(…, 150, "…") 截斷', () => {
    const seo = staticHomeSeo({} as ApiSeo, '示'.repeat(80));
    expect(seo.title).toBe('示'.repeat(80));
    expect(seo.description).toBe(`${'示'.repeat(75)}…`);
  });
});

describe('canonical 與 og:image 的網址政策', () => {
  const config: ServerConfig = {
    mode: 'api',
    apiOrigin: 'http://api.internal.test',
    timeoutMs: 1000,
    publicOrigin: PUBLIC_ORIGIN,
    siteName: '內建站名',
    deployEnvironment: null,
  };
  const seo = (over: Partial<ApiSeo>): ApiSeo => ({
    title: 't',
    description: '',
    canonical_path: '/articles/x',
    noindex: false,
    og_type: 'article',
    og_image: null,
    og_image_alt: null,
    ...over,
  });

  it.each(['/articles/x', '//evil.test/x', '/\\evil.test/x', '/?page=2'])('canonical %j 一律接在主站網址之後（同源）', (path) => {
    const head = headFromSeo(seo({ canonical_path: path }), 'mysite', config);
    expect(head.canonical).toBe(`${PUBLIC_ORIGIN}${path}`);
    expect(new URL(head.canonical!).origin).toBe(PUBLIC_ORIGIN);
  });

  it.each([
    ['/mock-media/mock-cover.png', `${PUBLIC_ORIGIN}/mock-media/mock-cover.png`],
    ['https://cdn.example.test/a.png', 'https://cdn.example.test/a.png'],
    ['//evil.test/a.png', null],
    ['http://cdn.example.test/a.png', null],
    ['javascript:alert(1)', null],
    ['data:image/png;base64,AAAA', null],
    ['https://u:p@cdn.example.test/a.png', null],
    ['https://cdn.example.test/a b.png', null],
    ['https://cdn.example.test/a\\b.png', null],
    ['relative.png', null],
    ['', null],
  ])('og:image %j → %j', (raw, expected) => {
    const head = headFromSeo(seo({ og_image: raw, og_image_alt: '替代文字' }), 'mysite', config);
    expect(head.og?.image).toBe(expected);
    expect(head.og?.imageAlt).toBe(expected === null ? null : '替代文字');
  });
});
