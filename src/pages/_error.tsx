// 受保護（src/pages/**）：前端自身程式錯誤（500）；Next.js 已判定的 400（網址無法解析）與 404 保留原狀態碼。伺服器端渲染，顯示請求編號（v1 §4.3 第 4 步、FE-17）。
// 不建立靜態的 404.tsx、500.tsx：那兩頁會在建置時靜態產生，拿不到即時選單也印不出請求編號。
// 這裡不呼叫任何 API，一律用內建靜態頁首頁尾。
// 瀏覽器端也可能執行 getInitialProps（站內換頁後畫面程式出錯時，Next.js 在瀏覽器直接畫錯誤頁）：
// - 沒有對應的伺服器請求，不產生請求編號（requestId 為 null，ErrorView 不顯示編號，不捏造）；
// - 讀不到伺服器的環境變數，改用第一次載入時伺服器放進頁面的內建站名（shell.staticSiteName）。
import type { NextPageContext } from 'next';
import { ERROR_MESSAGES, errorHead } from '@/lib/errors';
import type { PageProps } from '@/lib/page-props';
import { requestIdFrom } from '@/server/request-id';

const DEFAULT_SITE_NAME = 'mysite';

function siteNameFromEnv(): string {
  return (process.env.MYSITE_SITE_NAME ?? '').trim() || DEFAULT_SITE_NAME;
}

/** 瀏覽器端：Next.js 第一次載入時寫進頁面的 props（window.__NEXT_DATA__）裡的內建站名。 */
function siteNameFromInitialProps(): string {
  const data = (globalThis as { __NEXT_DATA__?: { props?: { pageProps?: { shell?: { staticSiteName?: unknown } } } } })
    .__NEXT_DATA__;
  const name = data?.props?.pageProps?.shell?.staticSiteName;
  return typeof name === 'string' && name !== '' ? name : DEFAULT_SITE_NAME;
}

function ErrorPage() {
  // 畫面由 _app 依 pageProps.error 畫 ErrorView
  return null;
}

ErrorPage.getInitialProps = async ({ req, res, err }: NextPageContext): Promise<PageProps<never>> => {
  // 伺服器端才有請求（req）：沿用合格的 X-Request-Id，否則自行產生並回在標頭；瀏覽器端為 null
  const requestId = req !== undefined ? requestIdFrom(req.headers['x-request-id']) : null;
  // Next.js 已判定的 400（網址無法解析）、404 照舊；其他一律 500
  const original = res?.statusCode ?? err?.statusCode ?? 500;
  const status = original === 400 || original === 404 ? original : 500;
  if (res) {
    res.statusCode = status;
    if (requestId !== null) res.setHeader('X-Request-Id', requestId);
  }
  const siteName = typeof window === 'undefined' ? siteNameFromEnv() : siteNameFromInitialProps();
  const message = status === 400 ? ERROR_MESSAGES.badRequest : status === 404 ? ERROR_MESSAGES.pageNotFound : ERROR_MESSAGES.internal;
  return {
    shell: { site: null, siteName, staticSiteName: siteName, currentPath: '/', dataSource: null },
    head: errorHead(status, siteName),
    error: { status, message, requestId, retryPath: null },
  };
};

export default ErrorPage;
