// 顯示格式、站內連結分流、分頁、500 錯誤頁、開發模式資料來源提示。
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataSourceNotice } from '@/components/safe/DataSourceNotice';
import { ErrorView } from '@/components/safe/ErrorView';
import { SiteLink, isFrontendPage } from '@/components/safe/SiteLink';
import { formatDuration, formatDurationSpoken, formatTaipeiDate, isMeaningfullyUpdated, isoDuration } from '@/lib/format';
import { isCurrentPath, pageHref, pageWindow } from '@/lib/paths';
import { limitChars, normalizeQuery, strimWidth } from '@/lib/text';
import ErrorPage from '@/pages/_error';

describe('formatTaipeiDate（比照 DisplayTime::date）', () => {
  it.each([
    ['2026-11-05T02:00:00Z', '2026年11月5日'],
    ['2026-11-05T15:59:59Z', '2026年11月5日'],
    ['2026-11-05T16:00:00Z', '2026年11月6日'],
    ['2026-12-31T16:00:00Z', '2027年1月1日'],
  ])('%s → %s', (iso, text) => {
    expect(formatTaipeiDate(iso)).toBe(text);
  });
  it('更新於：晚超過一天才顯示', () => {
    expect(isMeaningfullyUpdated('2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z')).toBe(false);
    expect(isMeaningfullyUpdated('2026-11-01T00:00:00Z', '2026-11-02T00:00:01Z')).toBe(true);
  });
});

describe('片長（比照 DisplayTime::duration／durationSpoken／isoDuration）', () => {
  it.each([
    [0, null, null, null],
    [5, '0:05', '5 秒', 'PT5S'],
    [245, '4:05', '4 分 5 秒', 'PT4M5S'],
    [3723, '1:02:03', '1 小時 2 分', 'PT1H2M3S'],
    [3600, '1:00:00', '1 小時', 'PT1H'],
  ])('%i 秒', (s, short, spoken, iso) => {
    expect(formatDuration(s)).toBe(short);
    expect(formatDurationSpoken(s)).toBe(spoken);
    expect(isoDuration(s)).toBe(iso);
  });
});

describe('文字', () => {
  it('normalizeQuery 合併空白、去頭尾', () => {
    expect(normalizeQuery('  示例\t\n 搜尋  ')).toBe('示例 搜尋');
  });
  it('strimWidth 以全形寬 2 截斷', () => {
    expect(strimWidth('示例', 40)).toBe('示例');
    expect(strimWidth('示'.repeat(25), 40)).toBe(`${'示'.repeat(19)}…`);
  });
  it('limitChars 比照 Str::limit', () => {
    expect(limitChars('一二三四五', 3)).toBe('一二三…');
    expect(limitChars('一二三', 3)).toBe('一二三');
  });
});

describe('分頁（比照 components/pagination.blade.php）', () => {
  it('頁碼範圍', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(5, 10)).toEqual([1, 3, 4, 5, 6, 7, 10]);
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 10]);
  });
  it('網址：第 1 頁不帶 page、空值略過、RFC 3986 編碼', () => {
    expect(pageHref('/articles', {}, 1)).toBe('/articles');
    expect(pageHref('/articles', {}, 2)).toBe('/articles?page=2');
    expect(pageHref('/search', { q: '示例 (a)', type: null }, 3)).toBe('/search?q=%E7%A4%BA%E4%BE%8B%20%28a%29&page=3');
  });
  it('目前位置', () => {
    expect(isCurrentPath('/', '/')).toBe(true);
    expect(isCurrentPath('/', '/articles')).toBe(false);
    expect(isCurrentPath('/articles', '/articles/x')).toBe(true);
    expect(isCurrentPath('/articles', '/articlesx')).toBe(false);
    expect(isCurrentPath('https://example.com/', '/')).toBe(false);
  });
});

describe('SiteLink 分流（定案執行書 §4.4）', () => {
  it.each([
    ['/', true],
    ['/articles', true],
    ['/articles?page=2', true],
    ['/videos/abc', true],
    ['/podcasts/%E7%A4%BA', true],
    ['/pages/about', true],
    ['/categories/news?type=post', true],
    ['/tags/sample', true],
    ['/search', false],
    ['/search?q=x&page=2', false],
    ['/shop', false],
    ['/admin/login', false],
    ['/feed.xml', false],
    ['/sitemap.xml', false],
    ['/preview/abc', false],
    ['/pages', false],
    ['/articles/a/b', false],
    ['//evil.example/articles', false],
    ['https://example.com/', false],
  ])('%s → 前端站內換頁 %s', (href, expected) => {
    expect(isFrontendPage(href)).toBe(expected);
  });
  it('外部連結加 rel；站內一律相對路徑', () => {
    expect(renderToStaticMarkup(<SiteLink href="https://example.com/">外</SiteLink>)).toBe(
      '<a href="https://example.com/" rel="noopener noreferrer">外</a>',
    );
    expect(renderToStaticMarkup(<SiteLink href="/feed.xml">RSS</SiteLink>)).toBe('<a href="/feed.xml">RSS</a>');
    expect(renderToStaticMarkup(<SiteLink href="/articles/x">文</SiteLink>)).toBe('<a href="/articles/x">文</a>');
  });
});

describe('500 錯誤頁（_error；FE-17）', () => {
  it('狀態碼 500、沿用合格的請求編號、內建靜態版面', async () => {
    const headers: Record<string, string> = {};
    const res = { statusCode: 200, setHeader: (k: string, v: string) => (headers[k] = v) };
    const rid = 'c'.repeat(32);
    const props = await ErrorPage.getInitialProps({
      req: { headers: { 'x-request-id': rid } },
      res,
    } as never);
    expect(res.statusCode).toBe(500);
    expect(headers['X-Request-Id']).toBe(rid);
    expect(props.shell.site).toBeNull();
    expect(props.error).toMatchObject({ status: 500, requestId: rid });
    expect(props.head.robots).toBe('noindex, nofollow');
    const html = renderToStaticMarkup(<ErrorView error={props.error!} />);
    expect(html).toContain('data-error-view="500"');
    expect(html).toContain('系統發生錯誤');
    expect(html).toContain(`請求編號：<code>${rid}</code>`);
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*data-error-home-link="">回首頁<\/a>/);
  });
  it('不合格的請求編號改用自行產生的 32 碼', async () => {
    const res = { statusCode: 200, setHeader: () => undefined };
    const props = await ErrorPage.getInitialProps({ req: { headers: { 'x-request-id': '../../x' } }, res } as never);
    expect(props.error?.requestId).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('資料來源提示只在開發模式', () => {
  it('非開發模式不輸出任何內容', () => {
    expect(process.env.NODE_ENV).not.toBe('development');
    expect(renderToStaticMarkup(<DataSourceNotice source="mock" />)).toBe('');
  });
});
