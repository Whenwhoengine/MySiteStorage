// 版面與無障礙（v1 §6.8 第 8、9 步；AI_RULES 第 8、9 條）：
// 手機 390、平板 768、桌面 1440 與 720×450（等同 1440 的 200% 縮放）每個頁型都沒有水平溢位、
// axe 無嚴重（critical）與重大（serious）問題；每頁存截圖（CI 產物，供與現行 Blade 並排目視）。
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PAGES, expectNoHorizontalOverflow } from './helpers.mjs';

const VIEWPORTS = [
  { label: '390', width: 390, height: 844 },
  { label: '768', width: 768, height: 1024 },
  { label: '1440', width: 1440, height: 900 },
  { label: '200pct', width: 720, height: 450 },
];

for (const vp of VIEWPORTS) {
  test.describe(`寬度 ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const p of PAGES) {
      test(`${p.key}`, async ({ page }, testInfo) => {
        const res = await page.goto(p.path);
        expect(res.status()).toBeLessThan(500);
        await page.waitForLoadState('networkidle');
        await expectNoHorizontalOverflow(page, `${vp.label} ${p.key}`);
        if (vp.label !== '200pct') {
          const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
          const bad = axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
          expect(bad.map((v) => `${v.id}（${v.impact}）：${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('；')}`)).toEqual([]);
        }
        await page.screenshot({ path: testInfo.outputPath(`${p.key}-${vp.label}.png`), fullPage: true });
      });
    }
  });
}

test.describe('減少動態效果', () => {
  test.use({ reducedMotion: 'reduce' });
  test('--duration 為 0、轉場時間不超過 0.001 秒', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const duration = getComputedStyle(document.documentElement).getPropertyValue('--duration').trim();
      const el = document.querySelector('.site-nav__link, .button, a');
      const t = el ? getComputedStyle(el).transitionDuration : '0s';
      return { duration, transition: Math.max(...t.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 0.001 : 1))) };
    });
    expect(['0ms', '0s', '0']).toContain(result.duration);
    expect(result.transition).toBeLessThanOrEqual(0.001);
  });
  test('一般情況 --duration 非零、--color-focus 有定義', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto(process.env.E2E_MOCK_BASE + '/');
    const vars = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return { duration: s.getPropertyValue('--duration').trim(), focus: s.getPropertyValue('--color-focus').trim() };
    });
    // 建置時 CSS 會被壓縮（160ms → .16s），只驗非零
    expect(parseFloat(vars.duration)).toBeGreaterThan(0);
    expect(vars.focus).not.toBe('');
    await ctx.close();
  });
});

test('鍵盤：每個 Tab 停點都有可見的焦點樣式', async ({ page }) => {
  await page.goto('/articles/sample-gutenberg-blocks');
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const ok = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return true;
      const has = (node) => {
        const s = getComputedStyle(node);
        return (s.boxShadow && s.boxShadow !== 'none') || (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0);
      };
      if (el.matches(':focus-visible') && has(el)) return true;
      let node = el.parentElement;
      for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) if (has(node)) return true;
      return `${el.tagName}.${el.className}`;
    });
    expect(ok, `第 ${i + 1} 個 Tab 停點沒有焦點樣式：${ok}`).toBe(true);
  }
});
