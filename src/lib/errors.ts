// 受保護（src/lib/**）：錯誤頁的固定文字與 <head>（伺服器與瀏覽器共用，不依賴 Node.js 模組）。
import type { ErrorInfo } from './content/types';
import type { HeadProps } from './page-props';

/** 錯誤頁標題（比照 Blade errors/mysite.blade.php）。 */
export const ERROR_HEADINGS: Record<ErrorInfo['status'], string> = {
  404: '找不到這個頁面',
  500: '系統發生錯誤',
  503: '內容暫時無法讀取',
};

/** 錯誤說明（比照 Laravel ErrorCode::publicMessage 與 ErrorRenderer）。 */
export const ERROR_MESSAGES = {
  contentNotFound: '找不到這個內容。',
  pageNotFound: '找不到這個頁面。',
  unavailable: '內容暫時無法讀取，請稍後再試。',
  internal: '系統發生錯誤，請稍後再試。',
} as const;

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
