// 受保護（src/lib/**）：錯誤頁的固定文字與 <head>（伺服器與瀏覽器共用，不依賴 Node.js 模組）。
import type { ErrorInfo } from './content/types';
import type { HeadProps } from './page-props';

/** 錯誤頁標題（比照 Blade errors/mysite.blade.php；405 落在 default 分支「無法完成請求」）。 */
export const ERROR_HEADINGS: Record<ErrorInfo['status'], string> = {
  400: '無法完成請求',
  404: '找不到這個頁面',
  405: '無法完成請求',
  500: '系統發生錯誤',
  503: '內容暫時無法讀取',
};

/**
 * 錯誤說明（比照 Laravel ErrorCode::publicMessage 與 ErrorRenderer）：
 * - contentNotFound：CONTENT_NOT_FOUND（內容不存在、page 不合格、slug 符合路由但內容端拒絕）
 * - pageNotFound：沒有對應的路由（ErrorRenderer 的 404，例如 slug 超過 200 字、路徑不存在）
 * - modelUnsupported：CONTENT_MODEL_UNSUPPORTED；serviceUnavailable：Laravel 維護模式（HTTP_503）
 * - methodNotAllowed：非 GET（ErrorRenderer 的 405）
 */
export const ERROR_MESSAGES = {
  contentNotFound: '找不到這個內容。',
  pageNotFound: '找不到這個頁面。',
  unavailable: '內容暫時無法讀取，請稍後再試。',
  modelUnsupported: '內容暫時無法顯示，請稍後再試。',
  serviceUnavailable: '服務暫時無法使用，請稍後再試。',
  methodNotAllowed: '不支援這個操作。',
  internal: '系統發生錯誤，請稍後再試。',
  badRequest: '無法完成請求。',
} as const;

/** API 503 錯誤碼 → 錯誤頁說明（ErrorCode::publicMessage、ErrorRenderer）；其他或沒有錯誤碼一律 unavailable。 */
export function unavailableMessage(code: string | null | undefined): string {
  if (code === 'CONTENT_MODEL_UNSUPPORTED') return ERROR_MESSAGES.modelUnsupported;
  if (code === 'HTTP_503') return ERROR_MESSAGES.serviceUnavailable;
  return ERROR_MESSAGES.unavailable;
}

/** 組 <title>：title 為空或等於站名時只用站名，否則「title｜站名」（PageMeta::fullTitle）。 */
export function fullTitle(title: string, siteName: string): string {
  return title === '' || title === siteName ? siteName : `${title}｜${siteName}`;
}

export function errorHead(status: ErrorInfo['status'], siteName: string): HeadProps {
  return {
    title: fullTitle(ERROR_HEADINGS[status], siteName),
    description: null,
    canonical: null,
    robots: 'noindex, nofollow',
    og: null,
    siteName,
  };
}
