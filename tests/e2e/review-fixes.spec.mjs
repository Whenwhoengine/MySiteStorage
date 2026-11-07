// 審查修正的瀏覽器／HTTP 驗證：對正式建置（next start）確認與 Blade 一致的行為。
// 期望值出處：mysite app/routes/content.php、PublicContentInput、ContentController、ErrorRenderer、PageMetaFactory、
// content/show.blade.php（Str::limit(..., 40, '…')），以及 2026-11-07 對 mysite 開發環境 Blade 站的實測。
import { expect, test } from '@playwright/test';
import { HOOK, LIVE, MOCK, apiCalls, rawGet, rid } from './helpers.mjs';

test.describe('非 GET、HEAD：405', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    test(`${method} /articles → 405「不支援這個操作。」，不帶 Allow`, async ({ request }) => {
      const res = await request.fetch(`${MOCK}/articles`, { method, maxRedirects: 0 });
      expect(res.status()).toBe(405);
      expect(res.headers().allow).toBeUndefined();
      expect(res.headers()['x-request-id']).toMatch(/^[a-f0-9]{32}$/);
      const html = await res.text();
      expect(html).toContain('data-error-view="405"');
      expect(html).toContain('不支援這個操作。');
      expect(html).toContain('<title>無法完成請求｜mysite</title>');
    });
  }

  test('POST 不呼叫內容端點（只取網站資訊畫完整版面）', async ({ request }) => {
    const id = rid();
    const res = await request.post(`${LIVE}/articles/sample-gutenberg-blocks`, { headers: { 'x-request-id': id } });
    expect(res.status()).toBe(405);
    expect(await apiCalls(request, id)).toEqual(['/api/v1/site']);
  });

  test('HEAD 照常 200、沒有內文', async ({ request }) => {
    const res = await request.head(`${MOCK}/articles`);
    expect(res.status()).toBe(200);
    expect((await res.body()).length).toBe(0);
  });

  test('不存在的路徑：POST 也是 404', async ({ request }) => {
    const res = await request.post(`${MOCK}/no-such-page`);
    expect(res.status()).toBe(404);
  });
});

test.describe('page 上限與陣列參數', () => {
  for (const query of ['page=1001', 'page=9999', 'page%5B%5D=2', 'page=1&page%5B%5D=1']) {
    test(`/articles?${query} → 404「找不到這個內容。」`, async ({ page }) => {
      const res = await page.goto(`${MOCK}/articles?${query}`);
      expect(res.status()).toBe(404);
      await expect(page.locator(HOOK('error_view.root'))).toHaveAttribute('data-error-view', '404');
      await expect(page.locator('main')).toContainText('找不到這個內容。');
    });
  }

  test('/tags/sample?type[]=post → 404', async ({ page }) => {
    const res = await page.goto(`${MOCK}/tags/sample?type%5B%5D=post`);
    expect(res.status()).toBe(404);
  });

  test('/search?q[]=x → 200、不搜尋', async ({ page }) => {
    const res = await page.goto(`${MOCK}/search?q%5B%5D=x`);
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle('搜尋｜mysite');
  });

  test('/search?page=2（沒有字詞）→ 200 空白搜尋頁（假資料模式也一樣）', async ({ page }) => {
    const res = await page.goto(`${MOCK}/search?page=2`);
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle('搜尋｜mysite');
  });
});

test.describe('錯誤說明與站名', () => {
  test('slug 含控制字元（符合 Laravel 路由、內容端拒絕）→ 404「找不到這個內容。」；超過 200 字 →「找不到這個頁面。」', async () => {
    const control = await rawGet(MOCK, '/articles/a%0Ab');
    expect(control.status).toBe(404);
    expect(control.body).toContain('找不到這個內容。');
    const long = await rawGet(MOCK, `/articles/${'x'.repeat(201)}`);
    expect(long.status).toBe(404);
    expect(long.body).toContain('找不到這個頁面。');
  });

  test('API 503 CONTENT_MODEL_UNSUPPORTED → 「內容暫時無法顯示，請稍後再試。」', async ({ page }) => {
    const res = await page.goto(`${LIVE}/articles/fe-503-model`);
    expect(res.status()).toBe(503);
    await expect(page.locator('main')).toContainText('內容暫時無法顯示，請稍後再試。');
  });

  test('首頁＋網站資訊取不到：<title> 與內建靜態頁首都是內建站名', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-request-id': rid('dead') });
    const res = await page.goto(`${LIVE}/`);
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle('內建站名');
    await expect(page.locator('[data-site-header]')).toContainText('內建站名');
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', '內建站名');
  });
});

test('麵包屑標題以字寬截斷（Str::limit($title, 40, \'…\')，全形寬 2）', async ({ page }) => {
  await page.goto(`${MOCK}/articles/msmock-edge-long-title`);
  await expect(page.locator('nav[aria-label="麵包屑"] [aria-current="page"]')).toHaveText('示例邊界案例：這是一個刻意加長的中文標題…');
});
