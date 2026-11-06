// 受保護（src/pages/**）：前端自身程式錯誤（500）；Next.js 已判定的 400（網址無法解析）與 404 保留原狀態碼。伺服器端渲染，顯示請求編號（v1 §4.3 第 4 步、FE-17）。
// 不建立靜態的 404.tsx、500.tsx：那兩頁會在建置時靜態產生，拿不到即時選單也印不出請求編號。
// 這裡不呼叫任何 API，一律用內建靜態頁首頁尾。
import type { NextPageContext } from 'next';
import { ERROR_MESSAGES, errorHead } from '@/lib/errors';
import type { PageProps } from '@/lib/page-props';
import { requestIdFrom } from '@/server/request-id';

function siteNameFromEnv(): string {
  return (process.env.MYSITE_SITE_NAME ?? '').trim() || 'mysite';
}

function ErrorPage() {
  // 畫面由 _app 依 pageProps.error 畫 ErrorView
  return null;
}

ErrorPage.getInitialProps = async ({ req, res, err }: NextPageContext): Promise<PageProps<never>> => {
  const requestId = requestIdFrom(req?.headers['x-request-id']);
  // Next.js 已判定的 400（網址無法解析）、404 照舊；其他一律 500
  const original = res?.statusCode ?? err?.statusCode ?? 500;
  const status = original === 400 || original === 404 ? original : 500;
  if (res) {
    res.statusCode = status;
    res.setHeader('X-Request-Id', requestId);
  }
  const siteName = siteNameFromEnv();
  const message = status === 400 ? ERROR_MESSAGES.badRequest : status === 404 ? ERROR_MESSAGES.pageNotFound : ERROR_MESSAGES.internal;
  return {
    shell: { site: null, siteName, currentPath: '/', dataSource: null },
    head: errorHead(status, siteName),
    error: { status, message, requestId, retryPath: null },
  };
};

export default ErrorPage;
