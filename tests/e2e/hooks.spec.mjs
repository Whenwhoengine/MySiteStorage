// FE-12：每個畫面元件都具備 DOM 測試掛鉤清單（contracts/dom-hooks.json）上的掛鉤；另驗 FE-17 錯誤頁。
import { expect, test } from '@playwright/test';
import { HOOK, LIVE, MOCK, apiCalls, expectHooks, rid } from './helpers.mjs';

const LAYOUT_FULL = [
  'layout.skip-link',
  'layout.main',
  'layout.site-header',
  'layout.site-nav',
  'layout.site-nav-toggle',
  'layout.site-nav-list',
  'layout.site-nav-link',
  'layout.site-search-q',
  'layout.site-footer',
  'layout.footer-privacy-link',
  'layout.sample-badge',
];
const LAYOUT_STATIC = ['layout.skip-link', 'layout.main', 'layout.site-header', 'layout.site-footer', 'layout.footer-privacy-link'];
const CARDS = ['page_heading.page-title', 'content_card.card', 'content_card.link', 'content_image.frame', 'content_image.img'];

async function open(page, url, status = 200) {
  const res = await page.goto(url);
  expect(res.status(), `${url} 狀態碼`).toBe(status);
  return res;
}

async function uniqueLandmarks(page) {
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
}

test.describe('FE-12 掛鉤（假資料）', () => {
  for (const [label, path] of [
    ['首頁', '/'],
    ['文章列表', '/articles'],
    ['影片列表', '/videos'],
    ['Podcast 列表', '/podcasts'],
    ['分類', '/categories/sample-tech'],
    ['標籤', '/tags/sample'],
    ['標籤單一型別', '/tags/sample?type=post'],
  ]) {
    test(`${label} ${path}`, async ({ page }) => {
      await open(page, path);
      await expectHooks(page, [...LAYOUT_FULL, ...CARDS]);
      await uniqueLandmarks(page);
      // 卡片連結：相對路徑、文字只有標題
      const link = page.locator(HOOK('content_card.link')).first();
      expect(await link.getAttribute('href')).toMatch(/^\/(articles|videos|podcasts|pages)\/[^?#]+$/);
      expect(await link.evaluate((a) => a.children.length)).toBe(0);
    });
  }

  test('文章詳情', async ({ page }) => {
    await open(page, '/articles/sample-gutenberg-blocks');
    await expectHooks(page, [...LAYOUT_FULL, 'entry.root', 'entry.title', 'entry.body', 'entry.cover', 'content_image.frame', 'content_image.img']);
    await uniqueLandmarks(page);
    await expect(page.locator(HOOK('entry.title'))).toHaveText('示例內容：Gutenberg 區塊格式驗收');
    await expect(page.locator(`main ${HOOK('entry.body')} .prose`)).toBeAttached();
  });

  test('影片詳情：伺服器輸出 embed-src、點擊前沒有 iframe', async ({ page }) => {
    await open(page, '/videos/sample-video-1');
    await expectHooks(page, [...LAYOUT_FULL, 'entry.root', 'entry.title', 'entry.body', 'youtube_player.player', 'youtube_player.embed-src', 'youtube_player.start']);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator(HOOK('youtube_player.start'))).toHaveCount(1);
    expect(await page.locator(HOOK('youtube_player.start')).getAttribute('href')).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/);
  });

  test('影片 ID 不合法：失效狀態，不輸出播放器掛鉤', async ({ page }) => {
    await open(page, '/videos/msmock-edge-video-unavailable');
    await expect(page.locator(HOOK('youtube_player.unavailable'))).toContainText('影片目前無法播放');
    await expect(page.locator(HOOK('youtube_player.unavailable'))).toHaveAttribute('role', 'note');
    await expect(page.locator('[data-youtube-player], [data-embed-src]')).toHaveCount(0);
    await expectHooks(page, ['entry.body']);
  });

  test('Podcast 詳情：audio、片長、下載、失效訊息（初始隱藏）', async ({ page }) => {
    await open(page, '/podcasts/sample-podcast-episode-1');
    await expectHooks(page, [...LAYOUT_FULL, 'entry.root', 'entry.title', 'entry.body', 'audio_player.player', 'audio_player.audio', 'audio_player.duration', 'audio_player.download', 'audio_player.error']);
    const audio = page.locator(HOOK('audio_player.audio'));
    await expect(audio).toHaveCount(1);
    await expect(audio).toHaveAttribute('controls', '');
    await expect(audio).toHaveAttribute('preload', 'none');
    await expect(page.locator(HOOK('audio_player.error'))).toBeHidden();
    // 片長是播放器內第一個 <time>
    expect(await page.locator('[data-audio-player] time').first().getAttribute('data-audio-duration')).toBe('');
    const src = await page.locator('[data-audio-player] source').getAttribute('src');
    expect(await page.locator(HOOK('audio_player.download')).getAttribute('href')).toBe(src);
  });

  test('音訊不可播：失效說明，不輸出 audio', async ({ page }) => {
    await open(page, '/podcasts/msmock-edge-audio-unavailable');
    await expect(page.locator(HOOK('audio_player.unavailable'))).toContainText('音訊目前無法播放');
    await expect(page.locator('[data-audio-player] audio')).toHaveCount(0);
    await expectHooks(page, ['audio_player.player', 'entry.body']);
  });

  test('一般頁面：沒有麵包屑、類型標示與日期', async ({ page }) => {
    await open(page, '/pages/privacy');
    await expectHooks(page, [...LAYOUT_FULL, 'entry.root', 'entry.title', 'entry.body']);
    await expect(page.locator('nav[aria-label="麵包屑"]')).toHaveCount(0);
    await expect(page.locator('main time')).toHaveCount(0);
  });

  test('搜尋：有結果', async ({ page }) => {
    await open(page, '/search?q=%E7%A4%BA%E4%BE%8B');
    await expectHooks(page, [...LAYOUT_FULL, 'page_heading.page-title', 'search.form', 'search.q', 'search.summary', 'search.result', 'search.result-link']);
    await expect(page.locator(HOOK('search.summary'))).toHaveAttribute('role', 'status');
    await expect(page.locator(HOOK('search.form'))).toHaveAttribute('method', 'get');
    await expect(page.locator(HOOK('search.form'))).toHaveAttribute('action', '/search');
    const html = await (await page.request.get('/search?q=%E7%A4%BA%E4%BE%8B')).text();
    const title = await page.locator(HOOK('search.result-link')).first().textContent();
    expect(html.includes(`>${title}<`)).toBe(true);
  });

  test('搜尋：零結果（main 內唯一的 role=status、文字「找不到符合」）', async ({ page }) => {
    await open(page, '/search?q=%E6%89%BE%E4%B8%8D%E5%88%B0%E7%9A%84%E5%AD%97');
    await expect(page.locator(HOOK('search.empty'))).toContainText('找不到符合');
    await expect(page.locator('main [role="status"]')).toHaveCount(1);
    await expect(page.locator(HOOK('search.result'))).toHaveCount(0);
  });

  test('搜尋：查詢詞不合格回 422 與錯誤分支（role=alert）', async ({ page }) => {
    await open(page, '/search?q=x&type=bad', 422);
    await expect(page.locator(HOOK('search.error'))).toHaveAttribute('role', 'alert');
    await expect(page.locator('#search-error')).toContainText('內容類型不正確');
    await expect(page.locator('#search-q')).toHaveAttribute('aria-invalid', 'true');
  });

  test('搜尋：兩個搜尋框的 id 不同名', async ({ page }) => {
    await open(page, '/search');
    await expect(page.locator('#search-q')).toHaveCount(1);
    await expect(page.locator('#site-search-q')).toHaveCount(1);
  });
});

test.describe('FE-17 錯誤頁', () => {
  test('不存在的路徑：404、完整版面、請求編號、回首頁、站內搜尋', async ({ page }) => {
    const id = rid();
    await page.setExtraHTTPHeaders({ 'x-request-id': id });
    await open(page, '/no-such-page', 404);
    await expectHooks(page, [...LAYOUT_FULL, 'error_view.root', 'error_view.title', 'error_view.home-link', 'error_view.request-id', 'error_view.state-q']);
    await expect(page.locator(HOOK('error_view.root'))).toHaveAttribute('data-error-view', '404');
    await expect(page.locator(HOOK('error_view.title'))).toContainText('找不到');
    await expect(page.locator('main').getByRole('link', { name: '回首頁', exact: true })).toBeVisible();
    await expect(page.locator(HOOK('error_view.request-id'))).toContainText(`請求編號：${id}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });

  test('不存在的單篇：404', async ({ page }) => {
    await open(page, '/articles/no-such-article', 404);
    await expect(page.locator(HOOK('error_view.root'))).toHaveAttribute('data-error-view', '404');
    await expect(page.locator(HOOK('entry.body'))).toHaveCount(0);
  });

  test('段數過深：不呼叫任何 API，內建靜態頁首頁尾回 404', async ({ page, request }) => {
    const id = rid();
    await page.setExtraHTTPHeaders({ 'x-request-id': id });
    await open(page, `${LIVE}/a/b/c/d`, 404);
    await expectHooks(page, [...LAYOUT_STATIC, 'error_view.root', 'error_view.request-id']);
    await expect(page.locator(HOOK('layout.site-nav'))).toHaveCount(0);
    expect(await apiCalls(request, id)).toEqual([]);
  });

  test('內容 503：完整版面、請求編號、重新整理', async ({ page }) => {
    const id = rid();
    await page.setExtraHTTPHeaders({ 'x-request-id': id });
    await open(page, `${LIVE}/articles/fe-503`, 503);
    await expect(page.locator(HOOK('error_view.root'))).toHaveAttribute('data-error-view', '503');
    await expect(page.locator(HOOK('error_view.title'))).toHaveText('內容暫時無法讀取');
    await expect(page.locator(HOOK('error_view.retry-link'))).toHaveAttribute('href', '/articles/fe-503');
    await expect(page.locator(HOOK('error_view.request-id'))).toContainText(id);
    await expectHooks(page, LAYOUT_FULL);
  });

  for (const slug of ['fe-timeout', 'fe-nonjson', 'fe-schema', 'fe-extra', 'fe-redirect', 'fe-reset', 'fe-500', 'fe-404-html']) {
    test(`傳輸層或格式問題 ${slug} → 503`, async ({ page }) => {
      await open(page, `${LIVE}/articles/${slug}`, 503);
      await expect(page.locator(HOOK('error_view.root'))).toHaveAttribute('data-error-view', '503');
    });
  }

  for (const [label, prefix] of [
    ['site 503', 'dead'],
    ['site 非 JSON', 'beef'],
    ['site 逾時', 'cafe'],
  ]) {
    test(`內容 200＋${label} → 正文照常、內建靜態頁首頁尾`, async ({ page }) => {
      await page.setExtraHTTPHeaders({ 'x-request-id': rid(prefix) });
      await open(page, `${LIVE}/articles/sample-gutenberg-blocks`, 200);
      await expectHooks(page, [...LAYOUT_STATIC, 'entry.root', 'entry.body']);
      await expect(page.locator(HOOK('layout.site-nav'))).toHaveCount(0);
      await expect(page.locator('[data-site-header]')).toContainText('內建站名');
    });
  }

  test('內容 404＋site 失敗 → 404、內建靜態頁首頁尾', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-request-id': rid('dead') });
    await open(page, `${LIVE}/articles/fe-404`, 404);
    await expectHooks(page, [...LAYOUT_STATIC, 'error_view.root', 'error_view.home-link', 'error_view.request-id']);
  });

  for (const [slug, status] of [
    ['fe-404', '404'],
    ['fe-503', '503'],
  ]) {
    test(`站內換頁（/_next/data）遇到 ${status}：整頁載入後畫出伺服器的錯誤頁`, async ({ page }) => {
      await open(page, `${LIVE}/articles`);
      await page.waitForFunction(() => Boolean(window.next && window.next.router));
      const navigation = page.waitForResponse((r) => r.url().endsWith(`/articles/${slug}`) && r.request().resourceType() === 'document');
      await page.evaluate((target) => window.next.router.push(target), `/articles/${slug}`);
      const res = await navigation;
      expect(res.status()).toBe(Number(status));
      await expect(page.locator(HOOK('error_view.root'))).toHaveAttribute('data-error-view', status);
      await expect(page).toHaveURL(`${LIVE}/articles/${slug}`);
    });
  }

  test('正常站內換頁仍走 /_next/data（不整頁重載）', async ({ page }) => {
    await open(page, `${MOCK}/articles`);
    await page.waitForFunction(() => Boolean(window.next && window.next.router));
    const data = page.waitForResponse((r) => r.url().includes('/_next/data/'));
    await page.locator(HOOK('content_card.link')).first().click();
    expect((await data).status()).toBe(200);
    await expect(page.locator(HOOK('entry.title'))).toBeVisible();
  });
});
