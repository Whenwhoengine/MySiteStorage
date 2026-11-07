// 顯示格式、站內連結分流、分頁、500 錯誤頁、開發模式資料來源提示。
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSourceNotice } from '@/components/safe/DataSourceNotice';
import { ErrorView } from '@/components/safe/ErrorView';
import { SiteLink, isFrontendPage } from '@/components/safe/SiteLink';
import { ERROR_MESSAGES, unavailableMessage } from '@/lib/errors';
import { formatDuration, formatDurationSpoken, formatTaipeiDate, isMeaningfullyUpdated, isoDuration } from '@/lib/format';
import { isCurrentPath, pageHref, pageWindow } from '@/lib/paths';
import {
  charWidth,
  isEmptyHtml,
  limitChars,
  normalizeQuery,
  phpRtrim,
  stripTags,
  strimWidth,
  strLimit,
  strWidth,
} from '@/lib/text';
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
  it('limitChars 比照 Str::limit（以字寬計，全形寬 2）', () => {
    // 原本以字數計（預期 '一二三…'、'一二三'）是錯的：Laravel 13 的 Str::limit 用 mb_strwidth／mb_strimwidth。
    // 以下期望值都是 PHP 8.5.12 實測：rtrim(mb_strimwidth($v, 0, 3, '')) . '…'
    expect(limitChars('一二三四五', 3)).toBe('一…');
    expect(limitChars('一二三', 3)).toBe('一…');
    expect(limitChars('abc', 3)).toBe('abc');
  });
});

describe('PHP 字寬（mb_strwidth，PHP 8.5.12 實測）', () => {
  it.each([
    ['a', 1],
    ['é', 1],
    ['…', 1],
    ['ｱ', 1], // 半形片假名
    ['〿', 1], // U+303F
    ['⺚', 1], // U+2E9A（未指派）
    ['Ａ', 2], // 全形英數
    ['　', 2], // 全形空白
    ['한', 2], // 韓文音節
    ['ᄀ', 2], // 韓文字母 U+1100
    ['😀', 2], // emoji U+1F600
    ['👍🏽', 4], // emoji＋膚色修飾（各寬 2）
    ['🇹🇼', 2], // 區域指示符號（各寬 1）
    ['𠀀', 2], // CJK 擴充 B U+20000
    ['𪛟', 2], // CJK 擴充 B U+2A6DF
  ])('%s → %i', (text, width) => {
    expect(strWidth(text)).toBe(width);
  });

  it('區間邊界', () => {
    expect(charWidth(0x115f)).toBe(2);
    expect(charWidth(0x1160)).toBe(1);
    expect(charWidth(0xff60)).toBe(2);
    expect(charWidth(0xff61)).toBe(1);
    expect(charWidth(0x2fffd)).toBe(2);
    expect(charWidth(0x2fffe)).toBe(1);
    expect(charWidth(0x3fffd)).toBe(2);
    expect(charWidth(0x3fffe)).toBe(1);
    expect(charWidth(0x10ffff)).toBe(1);
  });
});

describe('Str::limit 與 mb_strimwidth（PHP 8.5.12 實測向量）', () => {
  it.each([
    ['示'.repeat(20), 40, '示'.repeat(20)],
    ['示'.repeat(21), 40, `${'示'.repeat(20)}…`],
    [`a${'示'.repeat(20)}`, 40, `a${'示'.repeat(19)}…`],
    ['abc   def', 6, 'abc…'],
    ['ab\t\ncd', 4, 'ab…'],
    ['ab　cd', 4, 'ab　…'], // rtrim 不去全形空白
    ['😀'.repeat(21), 40, `${'😀'.repeat(20)}…`],
    ['𠀀'.repeat(21), 40, `${'𠀀'.repeat(20)}…`],
    ['한국어', 4, '한국…'],
  ])('Str::limit(%j, %i, "…")', (text, limit, expected) => {
    expect(strLimit(text, limit, '…')).toBe(expected);
  });

  it('Str::limit 預設結尾是 "..."', () => {
    expect(strLimit('一二三四五', 3)).toBe('一...');
  });

  it.each([
    ['😀'.repeat(25), 40, `${'😀'.repeat(19)}…`],
    ['Ａ'.repeat(21), 40, `${'Ａ'.repeat(19)}…`],
    ['abc', 1, '…'],
    ['abc', 0, '…'],
    ['示示', 3, '示…'],
  ])('mb_strimwidth(%j, 0, %i, "…")', (text, width, expected) => {
    expect(strimWidth(text, width)).toBe(expected);
  });

  it('phpRtrim 只去半形空白類', () => {
    expect(phpRtrim('a \t\n\r\0\x0B')).toBe('a');
    expect(phpRtrim('a　')).toBe('a　');
    expect(phpRtrim('a ')).toBe('a ');
    expect(phpRtrim('a\f')).toBe('a\f');
  });
});

describe('正文是否為空（SafeContent::isEmpty；PHP 8.5.12 實測）', () => {
  it.each([
    ['', true],
    ['   ', true],
    ['<p></p>', true],
    ['<p> <br> </p>', true],
    ['<!-- 註解 -->', true],
    ['<p title="a>b"></p>', true],
    ['<iframe src="x"></iframe>', true],
    ['<IMG src="x">', true], // str_contains 區分大小寫
    ['\0', true],
    ['\x0B<p>\r\n</p>\x0B', true],
    ['<p> </p>', false], // PHP trim 不去 U+00A0
    ['<p>&nbsp;</p>', false], // strip_tags 不解碼實體
    ['<p>　</p>', false],
    ['\f', false],
    ['<figure><img src="x" alt=""></figure>', false],
    ['<p>文字</p>', false],
    ['a < b', false],
  ])('%j → %s', (html, empty) => {
    expect(isEmptyHtml(html)).toBe(empty);
  });

  it('strip_tags 的狀態機（註解、處理指令、引號、<!DOCTYPE、<?xml）', () => {
    expect(stripTags('a<b>c</b>d')).toBe('acd');
    expect(stripTags('a < b > c')).toBe('a < b > c');
    expect(stripTags('<a title="x>y">t</a>')).toBe('t');
    expect(stripTags('x<!-- <p>y</p> -->z')).toBe('xz');
    expect(stripTags('x<?php echo "?>"; ?>z')).toBe('xz');
    expect(stripTags('<!DOCTYPE html><p>t</p>')).toBe('t');
    expect(stripTags('<?xml version="1.0"?><r>t</r>')).toBe('t');
    expect(stripTags('a<b')).toBe('a');
  });
});

describe('錯誤說明（ErrorCode::publicMessage、ErrorRenderer）', () => {
  it('503 依 API 錯誤碼', () => {
    expect(unavailableMessage('CONTENT_MODEL_UNSUPPORTED')).toBe('內容暫時無法顯示，請稍後再試。');
    expect(unavailableMessage('HTTP_503')).toBe('服務暫時無法使用，請稍後再試。');
    expect(unavailableMessage('CONTENT_UPSTREAM_UNAVAILABLE')).toBe('內容暫時無法讀取，請稍後再試。');
    expect(unavailableMessage(undefined)).toBe(ERROR_MESSAGES.unavailable);
  });

  it('405：標題「無法完成請求」、說明「不支援這個操作。」，沒有搜尋表單與重新整理', () => {
    const html = renderToStaticMarkup(
      <ErrorView error={{ status: 405, message: ERROR_MESSAGES.methodNotAllowed, requestId: 'e'.repeat(32), retryPath: null }} />,
    );
    expect(html).toContain('data-error-view="405"');
    expect(html).toContain('>無法完成請求</h1>');
    expect(html).toContain('不支援這個操作。');
    expect(html).not.toContain('state-q');
    expect(html).not.toContain('data-error-retry-link');
    expect(html).toContain(`請求編號：<code>${'e'.repeat(32)}</code>`);
  });

  it('沒有請求編號時不顯示編號（不捏造）', () => {
    const html = renderToStaticMarkup(<ErrorView error={{ status: 500, message: ERROR_MESSAGES.internal, requestId: null, retryPath: null }} />);
    expect(html).not.toContain('data-request-id');
    expect(html).not.toContain('請求編號');
    expect(html).toContain('data-error-home-link');
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
  it('伺服器端：站名取 MYSITE_SITE_NAME，並放進 shell.staticSiteName 供瀏覽器端沿用', async () => {
    vi.stubEnv('MYSITE_SITE_NAME', '內建站名');
    try {
      const res = { statusCode: 200, setHeader: () => undefined };
      const props = await ErrorPage.getInitialProps({ req: { headers: {} }, res } as never);
      expect(props.shell).toMatchObject({ siteName: '內建站名', staticSiteName: '內建站名' });
      expect(props.head.title).toBe('系統發生錯誤｜內建站名');
      expect(props.error?.requestId).toMatch(/^[a-f0-9]{32}$/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('瀏覽器端畫出的錯誤頁（_error 在瀏覽器執行 getInitialProps）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('不捏造請求編號；站名取第一次載入時伺服器放進頁面的內建站名', async () => {
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('__NEXT_DATA__', { props: { pageProps: { shell: { siteName: 'WordPress 站名', staticSiteName: '內建站名' } } } });
    // 瀏覽器端讀不到伺服器的環境變數（就算這裡有值也不能用）
    vi.stubEnv('MYSITE_SITE_NAME', '不該出現');
    const props = await ErrorPage.getInitialProps({ err: new Error('畫面程式錯誤') } as never);
    expect(props.error).toMatchObject({ status: 500, requestId: null });
    expect(props.shell).toMatchObject({ site: null, siteName: '內建站名', staticSiteName: '內建站名' });
    expect(props.head.title).toBe('系統發生錯誤｜內建站名');
    const html = renderToStaticMarkup(<ErrorView error={props.error!} />);
    expect(html).not.toContain('請求編號');
    expect(html).toContain('系統發生錯誤');
  });

  it('頁面資料沒有內建站名時用預設 mysite', async () => {
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('__NEXT_DATA__', undefined);
    const props = await ErrorPage.getInitialProps({ err: Object.assign(new Error('x'), { statusCode: 404 }) } as never);
    expect(props.shell.siteName).toBe('mysite');
    expect(props.error).toMatchObject({ status: 404, requestId: null, message: '找不到這個頁面。' });
  });
});

describe('資料來源提示只在開發模式', () => {
  it('非開發模式不輸出任何內容', () => {
    expect(process.env.NODE_ENV).not.toBe('development');
    expect(renderToStaticMarkup(<DataSourceNotice source="mock" />)).toBe('');
  });
});
