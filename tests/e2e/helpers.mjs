// 受保護（tests/**）：E2E 共用工具。掛鉤選擇器一律從 contracts/dom-hooks.json（mysite 正本的副本）讀取。
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hooksDoc = JSON.parse(readFileSync(path.join(ROOT, 'contracts/dom-hooks.json'), 'utf8'));

/** 掛鉤 id → 選擇器 */
export const HOOK = (() => {
  const map = new Map();
  for (const h of hooksDoc.layout.hooks) map.set(h.id, h);
  for (const group of Object.values(hooksDoc.components)) for (const h of group.hooks) map.set(h.id, h);
  for (const page of Object.values(hooksDoc.pages)) for (const h of page.hooks ?? []) map.set(h.id, h);
  return (id) => {
    const hook = map.get(id);
    if (!hook || !hook.selector) throw new Error(`掛鉤清單沒有 ${id}`);
    return hook.selector;
  };
})();

export const MOCK = process.env.E2E_MOCK_BASE;
export const LIVE = process.env.E2E_LIVE_BASE;
export const API = process.env.E2E_API_BASE;

/** 依情境產生 32 碼請求編號（fake-api 依前 4 碼決定 /api/v1/site 的行為）。 */
export function rid(prefix = '') {
  const hex = '0123456789abcdef';
  let out = prefix;
  while (out.length < 32) out += hex[Math.floor(Math.random() * 16)];
  return out;
}

/** 這個請求編號打過哪些 API。 */
export async function apiCalls(request, requestId) {
  const res = await request.get(`${API}/__log?rid=${requestId}`);
  return (await res.json()).paths;
}

/** 每個掛鉤都至少出現一次。 */
export async function expectHooks(page, ids, scope = page) {
  for (const id of ids) {
    await expect(scope.locator(HOOK(id)).first(), `掛鉤 ${id}（${HOOK(id)}）`).toBeAttached();
  }
}

/** 文件寬度不超過視窗（視覺隱藏與跳到主要內容連結除外）。 */
export async function expectNoHorizontalOverflow(page, label) {
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('.visually-hidden, [data-skip-link]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    }
    return { scrollWidth: document.documentElement.scrollWidth, vw, offenders: offenders.slice(0, 5) };
  });
  expect(result.scrollWidth, `${label}：文件寬 ${result.scrollWidth} > 視窗 ${result.vw}；${result.offenders.join('、')}`).toBeLessThanOrEqual(result.vw);
}

/** 全部公開頁型（假資料）。 */
export const PAGES = [
  { key: 'home', path: '/' },
  { key: 'articles_index', path: '/articles' },
  { key: 'videos_index', path: '/videos' },
  { key: 'podcasts_index', path: '/podcasts' },
  { key: 'article_detail', path: '/articles/sample-gutenberg-blocks' },
  { key: 'article_long_url', path: '/articles/sample-long-url' },
  { key: 'article_long_title', path: '/articles/msmock-edge-long-title' },
  { key: 'video_detail', path: '/videos/sample-video-1' },
  { key: 'video_unavailable', path: '/videos/msmock-edge-video-unavailable' },
  { key: 'podcast_detail', path: '/podcasts/sample-podcast-episode-1' },
  { key: 'podcast_unavailable', path: '/podcasts/msmock-edge-audio-unavailable' },
  { key: 'page_detail', path: '/pages/privacy' },
  { key: 'category', path: '/categories/sample-tech' },
  { key: 'tag', path: '/tags/sample' },
  { key: 'tag_listing', path: '/tags/sample?type=post' },
  { key: 'search_results', path: '/search?q=%E7%A4%BA%E4%BE%8B' },
  { key: 'search_empty', path: '/search?q=%E6%89%BE%E4%B8%8D%E5%88%B0%E7%9A%84%E5%AD%97' },
  { key: 'error_404', path: '/no-such-page' },
];

/** 原樣送出路徑（不經 URL 正規化），回傳狀態碼與內文。用來測 %2e%2e 這類瀏覽器會先改寫的路徑。 */
export function rawGet(base, rawPath, headers = {}) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, path: rawPath, method: 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}
