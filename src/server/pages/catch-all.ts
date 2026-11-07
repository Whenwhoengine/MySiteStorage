// 受保護（src/server/**）：根層萬用路由（不存在的路徑）。
// 段數超過公開路由最深段數（2，出處 mysite app/routes/content.php）時不呼叫任何 API，
// 直接以內建靜態頁首頁尾回 404 並附請求編號（定案執行書 §4.6 第 2 點、FE-17）。
// 不以副檔名猜測：slug 規則允許句點。
import type { GetServerSideProps } from 'next';
import type { PageProps } from '@/lib/page-props';
import { ERROR_MESSAGES, errorProps, notFoundPage, requestContext } from '../page-data';

export const MAX_PUBLIC_DEPTH = 2;

export const catchAllProps: GetServerSideProps<PageProps<never>> = async (ctx) => {
  const rc = requestContext(ctx);
  const segments = ctx.params?.path;
  const depth = Array.isArray(segments) ? segments.length : 1;
  if (depth > MAX_PUBLIC_DEPTH) return errorProps(ctx, rc, 404, null, ERROR_MESSAGES.pageNotFound);
  // 沒有對應路由：Laravel 不論方法一律 404「找不到這個頁面。」（ErrorRenderer）
  return notFoundPage(ctx, rc, ERROR_MESSAGES.pageNotFound);
};
