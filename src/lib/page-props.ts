// 受保護（src/lib/**）：每一頁 getServerSideProps 回傳的外層結構；_app 依此決定版面、<head> 與錯誤畫面。
// 畫面元件（src/views）只收 view 的內容，不必理會這一層。
import type { ErrorInfo, SiteInfo } from './content/types';

export interface ShellProps {
  /** 網站資訊；取不到時為 null（改用內建靜態頁首頁尾）。 */
  site: SiteInfo | null;
  /** 站名：網站資訊的站名，取不到時為內建站名。 */
  siteName: string;
  /** 目前路徑（不含查詢字串），選單標示目前位置用。 */
  currentPath: string;
  /** 只在開發模式有值：目前資料來源（畫面左下角提示）。正式建置一律為 null。 */
  dataSource: 'mock' | 'api' | null;
}

export interface OpenGraph {
  type: string;
  title: string;
  description: string | null;
  image: string | null;
  imageAlt: string | null;
}

export interface HeadProps {
  /** 完整 <title>（已含「｜站名」）。 */
  title: string;
  description: string | null;
  /** 完整 canonical 網址（主站公開網址＋路徑）；錯誤頁為 null。 */
  canonical: string | null;
  /** noindex 頁面為 'noindex, nofollow'；其他為 null。 */
  robots: string | null;
  og: OpenGraph | null;
  siteName: string;
}

export interface PageProps<V> {
  shell: ShellProps;
  head: HeadProps;
  /** 正常畫面的 props；錯誤時不存在。 */
  view?: V;
  /** 錯誤畫面資訊；正常時不存在。 */
  error?: ErrorInfo;
}
