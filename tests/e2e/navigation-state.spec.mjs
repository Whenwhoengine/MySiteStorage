// 站內換頁不帶走上一頁的元件狀態（比照 Blade 每次整頁載入）：
// YouTube 已播放、音訊與圖片失效狀態、手機選單展開，換到同一頁型的另一頁後都要回到初始狀態。
import { expect, test } from '@playwright/test';
import { HOOK } from './helpers.mjs';

/** 以 Next.js 路由做站內換頁（不整頁重新載入），並確認真的沒有重新載入。 */
async function clientNavigate(page, href) {
  await page.evaluate(() => {
    window.__sameDocument = true;
  });
  await page.evaluate((target) => window.next.router.push(target), href);
  await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  expect(await page.evaluate(() => window.__sameDocument === true), '應為站內換頁，不是整頁載入').toBe(true);
}

test('YouTube：播放後換到另一部影片，新頁回到未播放狀態且海報與連結屬於新影片', async ({ page }) => {
  await page.route(/youtube|ytimg|googlevideo|ggpht|youtu\.be/, (route) => route.abort());
  await page.goto('/videos/sample-video-1');
  await page.waitForFunction(() => Boolean(window.next?.router));
  await page.locator(HOOK('youtube_player.start')).click();
  await expect(page.locator(HOOK('youtube_player.player')).locator('iframe')).toHaveCount(1);

  await clientNavigate(page, '/videos/sample-video-2');
  await expect(page.locator(HOOK('entry.title'))).toContainText(/./);
  const player = page.locator(HOOK('youtube_player.player'));
  await expect(player).toHaveAttribute('data-embed-src', /Sample-Vid2/);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator(HOOK('youtube_player.start'))).toHaveAttribute('href', /Sample-Vid2$/);
});

test('Podcast：上一集音訊失效，換到下一集後不沿用失效狀態', async ({ page }) => {
  await page.route('**/mock-media/mock-audio.wav', (route) => route.abort());
  await page.goto('/podcasts/sample-podcast-episode-1');
  await page.waitForFunction(() => Boolean(window.next?.router));
  await page.locator('[data-audio-player] audio').evaluate((audio) => audio.load());
  await expect(page.locator(HOOK('audio_player.error'))).toBeVisible({ timeout: 15_000 });

  await page.unroute('**/mock-media/mock-audio.wav');
  await clientNavigate(page, '/podcasts/sample-podcast-episode-2');
  await expect(page.locator(HOOK('audio_player.player'))).toBeVisible();
  await expect(page.locator(HOOK('audio_player.error'))).toBeHidden();
});

test('圖片：上一頁的破圖狀態不帶到下一頁', async ({ page }) => {
  let block = true;
  await page.route('**/mock-media/mock-cover.png', (route) =>
    block ? route.fulfill({ status: 404, body: '' }) : route.continue(),
  );
  await page.goto('/articles/sample-gutenberg-blocks');
  await page.waitForFunction(() => Boolean(window.next?.router));
  await expect(page.locator('[data-media-broken]').first()).toBeVisible({ timeout: 15_000 });

  block = false;
  await clientNavigate(page, '/articles/sample-article-multi-paragraph');
  await expect(page.locator(HOOK('entry.root'))).toBeVisible();
  await expect(page.locator(HOOK('content_image.img')).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-media-broken]')).toHaveCount(0);
});

test.describe('手機選單', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('展開後點選單裡的連結，新頁的選單是收合的', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.next?.router));
    await page.evaluate(() => {
      window.__sameDocument = true;
    });
    const toggle = page.locator(HOOK('layout.site-nav-toggle'));
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.locator(`${HOOK('layout.site-nav-link')}[href="/articles"]`).click();
    await expect(page).toHaveURL(/\/articles$/);
    expect(await page.evaluate(() => window.__sameDocument === true), '應為站內換頁').toBe(true);
    await expect(page.locator(HOOK('layout.site-nav-toggle'))).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(HOOK('layout.site-nav-list'))).toBeHidden();
  });
});
