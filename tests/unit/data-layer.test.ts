// 資料層的錯誤分類與並行取資料的結果對照（v1 §6.3；定案執行書 §4.9；FE-05）。
// 以假 API 伺服器實際走 HTTP：連線被拒、逾時、非 JSON、格式不符、轉址、5xx 一律 503。
import type { GetServerSidePropsContext } from 'next';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getJson } from '@/server/api-client';
import { detailRequest, searchRequest } from '@/server/api-path';
import type { ServerConfig } from '@/server/config';
import { loadPage, type RequestContext } from '@/server/page-data';
import { DetailResponseSchema, SearchResponseSchema } from '@/server/schemas';
import { startFakeApi, type FakeApi } from '../support/fake-api.mjs';

let api: FakeApi;
let config: ServerConfig;
// 測試專用的短逾時（不是正式值；正式值依 D13c 裁定）
const TEST_TIMEOUT_MS = 400;

const OK_RID = 'a'.repeat(32);
const SITE_503_RID = `dead${'0'.repeat(28)}`;
const SITE_NONJSON_RID = `beef${'0'.repeat(28)}`;
const SITE_HANG_RID = `cafe${'0'.repeat(28)}`;

beforeAll(async () => {
  api = await startFakeApi();
  config = {
    mode: 'api',
    apiOrigin: `http://127.0.0.1:${api.port}`,
    timeoutMs: TEST_TIMEOUT_MS,
    publicOrigin: 'https://www.example.test',
    siteName: '內建站名',
    deployEnvironment: null,
  };
});

afterAll(async () => {
  await api.close();
});

function rc(requestId: string, overrides: Partial<ServerConfig> = {}): RequestContext {
  return { config: { ...config, ...overrides }, requestId, currentPath: '/articles/x', retryPath: '/articles/x?a=1' };
}

function fakeCtx() {
  const res = { statusCode: 200, setHeader: () => undefined };
  return { ctx: { res } as unknown as GetServerSidePropsContext, res };
}

async function page(slug: string, requestId = OK_RID, overrides: Partial<ServerConfig> = {}) {
  const { ctx, res } = fakeCtx();
  const result = await loadPage(ctx, rc(requestId, overrides), detailRequest('post', slug), DetailResponseSchema, (body) => ({
    view: { title: body.data.title },
    seo: body.seo,
  }));
  if (!('props' in result)) throw new Error('預期回傳 props');
  return { props: await result.props, status: res.statusCode };
}

describe('getJson 的分類', () => {
  const opts = () => ({ config, requestId: OK_RID });
  it('200＋符合契約 → ok', async () => {
    const r = await getJson(detailRequest('post', 'sample-gutenberg-blocks'), DetailResponseSchema, opts());
    expect(r.kind).toBe('ok');
  });
  it('404＋契約錯誤格式 → not_found', async () => {
    expect((await getJson(detailRequest('post', 'fe-404'), DetailResponseSchema, opts())).kind).toBe('not_found');
  });
  // 503 且為契約錯誤格式時另帶 API 的錯誤碼（第三欄；錯誤頁據此顯示與 Blade 相同的說明）
  it.each([
    ['fe-404-html', 'not_json', undefined],
    ['fe-503', 'status', 'CONTENT_UPSTREAM_UNAVAILABLE'],
    ['fe-503-model', 'status', 'CONTENT_MODEL_UNSUPPORTED'],
    ['fe-500', 'status', undefined],
    ['fe-429', 'status', undefined],
    ['fe-nonjson', 'not_json', undefined],
    ['fe-schema', 'schema', undefined],
    ['fe-extra', 'schema', undefined],
    ['fe-timeout', 'timeout', undefined],
    ['fe-redirect', 'redirect', undefined],
    ['fe-reset', 'transport', undefined],
  ])('%s → unavailable（%s）', async (slug, reason, code) => {
    const r = await getJson(detailRequest('post', slug), DetailResponseSchema, opts());
    expect(r).toEqual(code === undefined ? { kind: 'unavailable', reason } : { kind: 'unavailable', reason, code });
  });
  it('連線被拒 → unavailable', async () => {
    const closed = await startFakeApi();
    const port = closed.port;
    await closed.close();
    const r = await getJson(detailRequest('post', 'x'), DetailResponseSchema, {
      config: { ...config, apiOrigin: `http://127.0.0.1:${port}` },
      requestId: OK_RID,
    });
    expect(r).toEqual({ kind: 'unavailable', reason: 'transport' });
  });
  it('422 只在搜尋允許，其他端點一律當 503', async () => {
    const long = 'x'.repeat(101);
    const search = await getJson(searchRequest(long, null, null), SearchResponseSchema, { ...opts(), allowInvalid: true });
    expect(search.kind).toBe('invalid');
    const notAllowed = await getJson(searchRequest(long, null, null), SearchResponseSchema, opts());
    expect(notAllowed.kind).toBe('unavailable');
  });
  it('轉送同一個請求編號', async () => {
    const rid = 'b'.repeat(32);
    await getJson(detailRequest('post', 'sample-gutenberg-blocks'), DetailResponseSchema, { config, requestId: rid });
    expect(api.log.get(rid)).toEqual(['/api/v1/articles/sample-gutenberg-blocks']);
  });
});

describe('並行取資料的結果對照（§4.9）', () => {
  it('內容 200＋site 成功 → 正常畫面、完整版面', async () => {
    const { props, status } = await page('sample-gutenberg-blocks');
    expect(status).toBe(200);
    expect(props.view).toBeDefined();
    expect(props.error).toBeUndefined();
    expect(props.shell.site).not.toBeNull();
    expect(props.head.canonical).toBe('https://www.example.test/articles/sample-gutenberg-blocks');
  });
  it.each([
    ['site 503', SITE_503_RID],
    ['site 非 JSON', SITE_NONJSON_RID],
    ['site 逾時', SITE_HANG_RID],
  ])('內容 200＋%s → 正文照常、內建靜態頁首頁尾', async (_label, rid) => {
    const { props, status } = await page('sample-gutenberg-blocks', rid);
    expect(status).toBe(200);
    expect(props.view).toBeDefined();
    expect(props.shell.site).toBeNull();
    expect(props.shell.siteName).toBe('內建站名');
  });
  it('內容 404＋site 成功 → 404、完整版面、請求編號', async () => {
    const { props, status } = await page('fe-404');
    expect(status).toBe(404);
    expect(props.error).toMatchObject({ status: 404, requestId: OK_RID, retryPath: null });
    expect(props.shell.site).not.toBeNull();
    expect(props.head.robots).toBe('noindex, nofollow');
  });
  it('內容 404＋site 失敗 → 404、內建靜態頁首頁尾', async () => {
    const { props, status } = await page('fe-404', SITE_503_RID);
    expect(status).toBe(404);
    expect(props.error?.status).toBe(404);
    expect(props.shell.site).toBeNull();
  });
  it('內容 503＋site 成功 → 503、完整版面、重新整理連結', async () => {
    const { props, status } = await page('fe-503');
    expect(status).toBe(503);
    expect(props.error).toMatchObject({ status: 503, requestId: OK_RID, retryPath: '/articles/x?a=1' });
    expect(props.error?.message).toBe('內容暫時無法讀取，請稍後再試。');
    expect(props.shell.site).not.toBeNull();
  });
  it('內容 503 CONTENT_MODEL_UNSUPPORTED → 說明與 Blade 相同（ErrorCode::publicMessage）', async () => {
    const { props, status } = await page('fe-503-model');
    expect(status).toBe(503);
    expect(props.error).toMatchObject({ status: 503, message: '內容暫時無法顯示，請稍後再試。', requestId: OK_RID });
  });
  it('內容 404 的說明是「找不到這個內容。」（CONTENT_NOT_FOUND）', async () => {
    const { props } = await page('fe-404');
    expect(props.error?.message).toBe('找不到這個內容。');
  });
  it.each(['fe-nonjson', 'fe-schema', 'fe-extra', 'fe-timeout', 'fe-redirect', 'fe-reset', 'fe-500', 'fe-404-html'])(
    '傳輸層或格式問題（%s）→ 503',
    async (slug) => {
      const { props, status } = await page(slug);
      expect(status).toBe(503);
      expect(props.error?.status).toBe(503);
    },
  );
  it('API 完全連不上 → 503、內建靜態頁首頁尾', async () => {
    const closed = await startFakeApi();
    const port = closed.port;
    await closed.close();
    const { props, status } = await page('sample-gutenberg-blocks', OK_RID, { apiOrigin: `http://127.0.0.1:${port}` });
    expect(status).toBe(503);
    expect(props.shell.site).toBeNull();
  });
});
