// 行為：FE-06（零 cookie、只對同源發請求）、FE-07（關閉 JavaScript 可讀）、YouTube 點擊前零請求、
// 音訊與圖片失效狀態、跳到主要內容、手機選單、<head> 中繼資料、狀態碼。
import { expect, test } from '@playwright/test';
import { HOOK, LIVE, MOCK, PAGES, apiCalls, rawGet, rid } from './helpers.mjs';

const YOUTUBE_HOST_RE = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|googlevideo\.com|ggpht\.com)$/;

test('FE-06：瀏覽全部公開頁零 cookie、所有請求只到同源', async ({ page, context }) => {
  const origins = new Set();
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith('http')) origins.add(url.origin);
  });
  for (const { path } of PAGES) await page.goto(path);
  expect(await context.cookies()).toEqual([]);
  expect([...origins]).toEqual([new URL(MOCK).origin]);
  for (const { path } of PAGES) {
    const res = await page.request.get(path);
    expect(res.headers()['set-cookie'], `${path} 不得設定 cookie`).toBeUndefined();
  }
});

test.describe('FE-07：關閉 JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('正文、連結、YouTube 一般連結、Podcast 音訊都在', async ({ page }) => {
    await page.goto('/articles/sample-gutenberg-blocks');
    await expect(page.locator('main [data-entry-body]')).toContainText('本文逐一列出主站必須支援的區塊格式');
    await page.goto('/articles');
    const href = await page.locator(HOOK('content_card.link')).first().getAttribute('href');
    await page.goto(href);
    await expect(page.locator(HOOK('entry.title'))).toBeVisible();
    await page.goto('/videos/sample-video-1');
    await expect(page.locator(HOOK('youtube_player.start'))).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/watch\?v=/);
    await page.goto('/podcasts/sample-podcast-episode-1');
    await expect(page.locator('[data-audio-player] audio')).toHaveCount(1);
    // 手機選單在沒有 JavaScript 時是展開的
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(HOOK('layout.site-nav-list'))).toBeVisible();
  });
});

test('YouTube：點擊前零請求，點擊後建立 youtube-nocookie iframe', async ({ page }) => {
  const youtube = [];
  page.on('request', (req) => {
    const host = new URL(req.url()).hostname;
    if (YOUTUBE_HOST_RE.test(host)) youtube.push(req.url());
  });
  // 擋下真的外連，只看有沒有發出
  await page.route(/youtube|ytimg|googlevideo|ggpht|youtu\.be/, (route) => route.abort());
  await page.goto('/videos/sample-video-1');
  await page.waitForLoadState('networkidle');
  expect(youtube).toEqual([]);
  await expect(page.locator('iframe')).toHaveCount(0);
  const player = page.locator(HOOK('youtube_player.player'));
  const embed = await player.getAttribute('data-embed-src');
  await page.locator(HOOK('youtube_player.start')).click();
  const iframe = player.locator('iframe');
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute('src', embed);
  await expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  await expect(iframe).toHaveAttribute('title', /YouTube 影片播放器/);
  await expect(page).toHaveURL(/\/videos\/sample-video-1$/);
});

test('Podcast：原始 HTML 帶音訊來源；載入失敗顯示失效訊息，下載連結與簡介保留', async ({ page, request }) => {
  const html = await (await request.get('/podcasts/sample-podcast-episode-1')).text();
  expect(html).toMatch(/<source[^>]+src="\/mock-media\/mock-audio\.wav"/);
  expect(html).toMatch(/<audio[^>]+preload="none"/);
  await page.route('**/mock-media/mock-audio.wav', (route) => route.abort());
  await page.goto('/podcasts/sample-podcast-episode-1');
  await page.waitForFunction(() => Boolean(window.next));
  await page.locator('[data-audio-player] audio').evaluate((audio) => audio.load());
  await expect(page.locator(HOOK('audio_player.error'))).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(HOOK('audio_player.download'))).toBeVisible();
  await expect(page.locator(HOOK('entry.body'))).toBeVisible();
});

test('圖片載入失敗：外框加 data-media-broken 並顯示失效狀態', async ({ page }) => {
  await page.route('**/mock-media/mock-cover.png', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/articles');
  await expect(page.locator(HOOK('content_image.broken')).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-media-broken]').first()).toContainText('圖片無法載入');
});

test('跳到主要內容：第一個 Tab，按下後焦點到 #main', async ({ page }) => {
  await page.goto('/articles/sample-gutenberg-blocks');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveAttribute('data-skip-link', '');
  await expect(focused).toHaveText('跳到主要內容');
  await expect(focused).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});

test.describe('手機選單', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('載入後收合，按「選單」展開', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator(HOOK('layout.site-nav-toggle'));
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(HOOK('layout.site-nav-list'))).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(HOOK('layout.site-nav-list'))).toBeVisible();
    await expect(page.locator('#site-search-q')).toBeVisible();
  });
  test('桌面寬度不顯示「選單」按鈕', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator(HOOK('layout.site-nav-toggle'))).toBeHidden();
    await expect(page.locator(HOOK('layout.site-nav-list'))).toBeVisible();
  });
});

test('<head>：lang、title、canonical＝og:url（主站網址）、robots、RSS', async ({ page, request }) => {
  const cases = [
    { path: '/', title: 'mysite', canonical: '/', robots: null },
    { path: '/articles', title: '文章｜mysite', canonical: '/articles', robots: null },
    { path: '/articles/sample-gutenberg-blocks', title: '示例內容：Gutenberg 區塊格式驗收｜mysite', canonical: '/articles/sample-gutenberg-blocks', robots: null },
    { path: '/tags/sample', title: '標籤：示例｜mysite', canonical: '/tags/sample', robots: null },
    { path: '/search?q=%E7%A4%BA%E4%BE%8B', title: '搜尋「示例」｜mysite', canonical: '/search', robots: 'noindex, nofollow' },
    { path: '/no-such-page', title: '找不到這個頁面｜mysite', canonical: null, robots: 'noindex, nofollow' },
  ];
  for (const c of cases) {
    await page.goto(c.path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-TW');
    await expect(page).toHaveTitle(c.title);
    if (c.canonical === null) {
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    } else {
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${MOCK}${c.canonical}`);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${MOCK}${c.canonical}`);
    }
    if (c.robots === null) await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    else await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', c.robots);
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', '/feed.xml');
  }
  // 原始 HTML 就有標題（伺服器端渲染）與相對路徑的詳情連結
  const list = await (await request.get('/articles')).text();
  expect(list).toMatch(/href="\/articles\/[^"?#]+"/);
  expect(list).not.toMatch(/href="https?:\/\/[^"]*\/articles\//);
});

test('狀態碼', async ({ request }) => {
  const expected = [
    ['/', 200],
    ['/articles?page=1', 200],
    ['/articles?page=0', 404],
    ['/articles?page=abc', 404],
    ['/articles?page=99', 404],
    ['/articles/no-such', 404],
    ['/pages/about', 200],
    ['/tags/sample?page=2', 404],
    ['/tags/sample?type=bad', 404],
    ['/search?q=' + 'x'.repeat(101), 422],
    ['/no/such/deep/path', 404],
  ];
  for (const [path, status] of expected) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(status);
    expect(res.headers()['x-powered-by'], `${path} 不帶 x-powered-by`).toBeUndefined();
    expect(res.headers()['x-request-id']).toMatch(/^[a-f0-9]{32}$/);
  }
});

test('路徑穿越：原樣送出的 ..、%2e%2e、%2F、%00 都碰不到 /api/v1/ 以外，也不把 .. 送給 API', async ({ request }) => {
  for (const raw of ['/articles/%2e%2e', '/articles/%2E%2E/internal', '/articles/..%2Finternal', '/articles/a%2Fb', '/articles/%00', '/tags/%2e%2e?type=post', '/pages/..%252f']) {
    const id = rid();
    const res = await rawGet(LIVE, raw, { 'x-request-id': id });
    expect(res.status, raw).toBeLessThan(500);
    for (const p of await apiCalls(request, id)) {
      expect(p.startsWith('/api/v1/'), `${raw} → ${p}`).toBe(true);
      expect(p, `${raw} → ${p}`).not.toMatch(/\/\.\.?(\/|$|\?)|%2e%2e|%2f/i);
    }
  }
});

test('網址無法解析（百分比編碼殘缺）：400、錯誤頁附請求編號', async () => {
  const res = await rawGet(MOCK, '/videos/%E0%A4%A');
  expect(res.status).toBe(400);
  expect(res.body).toContain('data-error-view="400"');
  expect(res.body).toMatch(/請求編號：<code>[a-f0-9]{32}<\/code>/);
});
