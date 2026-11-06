// 組網址的規矩（v1 §6.3）：穿越測試至少涵蓋 ..、%2e%2e、%2F、%00、中文 slug、200 字 slug、
// q 含 ?、#、&、/ 與全形字。FE-05 的「網址組合的穿越測試」。
import { describe, expect, it } from 'vitest';
import {
  apiUrl,
  assertApiUrl,
  detailRequest,
  isValidSlug,
  parsePage,
  requestKey,
  searchRequest,
  taxonomyRequest,
} from '@/server/api-path';

const ORIGIN = 'http://api.internal.test:8080';

/** Next.js 傳進來的路由參數是已解碼的值；這裡模擬瀏覽器送出的原始片段經解碼後的樣子。 */
const decoded = (raw: string) => decodeURIComponent(raw);

describe('slug 驗證', () => {
  it.each([
    ['..', false],
    ['.', false],
    [decoded('%2e%2e'), false],
    [decoded('%2E%2E'), false],
    [decoded('a%2Fb'), false],
    [decoded('%00'), false],
    [decoded('abc%0A'), false],
    ['', false],
    ['x'.repeat(201), false],
    ['x'.repeat(200), true],
    ['示'.repeat(200), true],
    [decoded('%E7%A4%BA%E4%BE%8B'), true],
    ['sample.article', true],
    ['..hidden', true],
  ])('%j → %s', (slug, ok) => {
    expect(isValidSlug(slug)).toBe(ok);
  });
});

describe('API 網址一律落在 /api/v1/ 之下', () => {
  it('中文 slug 以百分比編碼送出（與 manifest 的 api_path 相同）', () => {
    const key = requestKey(detailRequest('post', '示例中文網址邊界案例'));
    expect(key).toBe('/api/v1/articles/%E7%A4%BA%E4%BE%8B%E4%B8%AD%E6%96%87%E7%B6%B2%E5%9D%80%E9%82%8A%E7%95%8C%E6%A1%88%E4%BE%8B');
  });

  it.each(['%2e%2e', '%252e%252e', 'a?b', 'a#b', 'a&b=c', '%00x', '..%2F..'])('slug %j 原樣編碼成單一路徑段', (slug) => {
    const request = detailRequest('video', slug);
    const url = apiUrl(ORIGIN, request.path, request.query);
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname.startsWith('/api/v1/videos/')).toBe(true);
    expect(url.pathname.split('/')).toHaveLength(5);
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
  });

  it('200 字 slug', () => {
    const slug = 'a'.repeat(200);
    expect(requestKey(detailRequest('page', slug))).toBe(`/api/v1/pages/${slug}`);
  });

  it('不合格的 slug 不得組網址（程式錯誤）', () => {
    expect(() => detailRequest('post', '..')).toThrow();
    expect(() => detailRequest('post', 'a/b')).toThrow();
    expect(() => taxonomyRequest('tag', '.', null, null)).toThrow();
  });

  it.each(['?', '#', '&', '/', '？＃＆／', '示例 搜尋', 'a=b&c=d', '../../internal'])('搜尋字詞 %j 只會出現在 q 參數', (q) => {
    const request = searchRequest(q, null, null);
    const url = apiUrl(ORIGIN, request.path, request.query);
    expect(url.pathname).toBe('/api/v1/search');
    expect(url.searchParams.get('q')).toBe(q);
    expect([...url.searchParams.keys()]).toEqual(['q']);
    expect(url.hash).toBe('');
  });

  it('分類與標籤帶 type、page', () => {
    expect(requestKey(taxonomyRequest('category', 'news', 'post', 2))).toBe('/api/v1/categories/news?type=post&page=2');
    expect(requestKey(taxonomyRequest('tag', 'a b', null, null))).toBe('/api/v1/tags/a%20b');
  });

  it('組出的網址若不在前綴之下或換了來源，一律丟出例外', () => {
    expect(() => assertApiUrl(new URL('http://api.internal.test:8080/internal/deploy-status'), ORIGIN)).toThrow();
    expect(() => assertApiUrl(new URL('http://evil.test/api/v1/site'), ORIGIN)).toThrow();
    expect(() => apiUrl(ORIGIN, '//evil.test/api/v1/site')).toThrow();
    expect(() => apiUrl(ORIGIN, '/api/v1/../internal/x')).toThrow();
  });
});

describe('page 參數（契約：^[1-9]\\d{0,3}$，空白視同未帶）', () => {
  it.each([
    [undefined, { ok: true, page: null }],
    ['', { ok: true, page: null }],
    ['  ', { ok: true, page: null }],
    ['1', { ok: true, page: 1 }],
    [' 2 ', { ok: true, page: 2 }],
    ['1000', { ok: true, page: 1000 }],
    ['9999', { ok: true, page: 9999 }],
    ['10000', { ok: false }],
    ['0', { ok: false }],
    ['01', { ok: false }],
    ['-1', { ok: false }],
    ['1.5', { ok: false }],
    ['abc', { ok: false }],
    [['1', '3'], { ok: true, page: 3 }],
  ])('%j', (raw, expected) => {
    expect(parsePage(raw as string | string[] | undefined)).toEqual(expected);
  });
});
