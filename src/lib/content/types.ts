// 受保護（src/lib/**，只讀）：畫面元件收到的 props 型別。
// 設計（MyDyad）只改畫面，不改這裡；需要新欄位時交給施工者，施工者同步契約、資料層與測試。
// 資料由 src/server/pages/* 從公開 API（或假資料）轉成這些形狀；props 會原樣出現在 HTML 裡，
// 所以只放畫面需要的欄位（v1 §6.3）。

/** 內容型別：post＝文章、video＝影片、podcast＝Podcast、page＝一般頁面。 */
export type ContentType = 'post' | 'video' | 'podcast' | 'page';

/** 有列表頁的型別。 */
export type ListableType = 'post' | 'video' | 'podcast';

export interface ImageInfo {
  /** 圖片網址（正式為通過媒體政策的絕對網址；假資料為 /mock-media/…）。 */
  url: string;
  /** 替代文字（照 WordPress 原樣，可能是空字串）。 */
  alt: string;
  width: number | null;
  height: number | null;
}

export interface MenuLink {
  label: string;
  /** 站內為相對路徑（以 / 開頭）；站外為完整網址。 */
  url: string;
  external: boolean;
}

export interface SocialLink {
  label: string;
  url: string;
}

/** 網站資訊與選單（每一頁都即時取得，不快取）。 */
export interface SiteInfo {
  name: string;
  tagline: string;
  authorBio: string;
  socialLinks: SocialLink[];
  logo: ImageInfo | null;
  /** 網站資訊為示例內容時為 true（要保留「示例內容」標示）。 */
  isSample: boolean;
  primaryMenu: MenuLink[];
  footerMenu: MenuLink[];
  /** 模擬商店開啟時為 true（顯示「商店」選單）。 */
  commerceEnabled: boolean;
}

/** 列表卡片、搜尋結果用的內容摘要。 */
export interface CardItem {
  type: ContentType;
  /** 站內相對路徑（slug 已百分比編碼），連結一律用它。 */
  path: string;
  title: string;
  /** 純文字摘要，可能是空字串。 */
  excerpt: string;
  /** UTC ISO 8601；顯示一律經 formatTaipeiDate()。 */
  publishedAt: string;
  authorName: string | null;
  cover: ImageInfo | null;
  /** 影片或 Podcast 的片長（秒）；沒有時為 null。 */
  durationSeconds: number | null;
  isSample: boolean;
}

export interface TermLink {
  name: string;
  /** 站內相對路徑，例如 /categories/news、/tags/sample。 */
  path: string;
}

export interface VideoInfo {
  /** 影片 ID 合法時為 11 碼 ID；不合法或缺少時為 null（顯示失效狀態）。 */
  youtubeId: string | null;
  watchUrl: string | null;
  embedUrl: string | null;
  durationSeconds: number | null;
}

export interface PodcastInfo {
  /** 可播放的音訊網址；來源缺少或不在允許清單時為 null（顯示失效狀態）。 */
  audioUrl: string | null;
  audioMime: string | null;
  durationSeconds: number | null;
}

/** 單篇內容（文章、影片、Podcast、一般頁面）。 */
export interface EntryItem {
  type: ContentType;
  path: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  modifiedAt: string;
  authorName: string | null;
  cover: ImageInfo | null;
  isSample: boolean;
  /** 已由 Laravel 淨化的正文 HTML；只能交給 <SafeHtml>。 */
  contentHtml: string;
  categories: TermLink[];
  tags: TermLink[];
  /** 只有影片有值。 */
  video: VideoInfo | null;
  /** 只有 Podcast 有值。 */
  podcast: PodcastInfo | null;
}

export interface PageInfo {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
}

/** 列表頁的標題與說明（文章、影片、Podcast）。 */
export interface CollectionInfo {
  type: ListableType;
  /** 型別名稱，例如「文章」「Podcast」。 */
  label: string;
  /** 列表頁標題，例如「文章」「Podcast 節目」。 */
  title: string;
  /** 列表頁說明，可能是空字串。 */
  lede: string;
}

// ===== 各頁型畫面元件的 props =====

export interface HomeViewProps {
  /** 站名（網站資訊取不到時為內建站名）。 */
  siteName: string;
  site: SiteInfo | null;
  featured: CardItem | null;
  posts: CardItem[];
  videos: CardItem[];
  podcasts: CardItem[];
}

export interface CollectionViewProps {
  collection: CollectionInfo;
  items: CardItem[];
  pagination: PageInfo;
  /** 分頁連結的基準路徑，例如 /articles。 */
  basePath: string;
}

export interface EntryViewProps {
  item: EntryItem;
}

export interface TaxonomySection {
  type: ListableType;
  /** 區塊標題，例如「文章」「Podcast 節目」。 */
  title: string;
  items: CardItem[];
  total: number;
  perPage: number;
}

export interface TaxonomyViewProps {
  kind: 'category' | 'tag';
  /** 「分類」或「標籤」。 */
  label: string;
  term: { name: string; path: string; count: number | null };
  /** 目前篩選的型別；null 為總覽。 */
  type: ListableType | null;
  /** 篩選頁籤（全部＋三種型別）。 */
  tabs: { label: string; href: string; current: boolean }[];
  /** 總覽模式：三個區塊；篩選模式為 null。 */
  overview: TaxonomySection[] | null;
  /** 篩選模式：該型別的分頁列表；總覽模式為 null。 */
  listing: { items: CardItem[]; pagination: PageInfo; typeLabel: string } | null;
}

export interface SearchTypeOption {
  value: '' | ContentType;
  label: string;
}

export interface SearchViewProps {
  /** 正規化後的查詢詞（空字串表示尚未搜尋）。 */
  q: string;
  type: ContentType | null;
  typeOptions: SearchTypeOption[];
  /** 查詢詞不合格時的說明（API 422）；有值時畫錯誤分支。 */
  error: string | null;
  /** 已搜尋時的結果；尚未搜尋或錯誤時為 null。 */
  result: { items: CardItem[]; pagination: PageInfo } | null;
}

/** 錯誤畫面需要的資訊（404／503／500）。 */
export interface ErrorInfo {
  /** 400 只出現在網址本身無法解析時（例如百分比編碼殘缺），由 Next.js 判定。 */
  status: 400 | 404 | 500 | 503;
  /** 固定的正體中文說明（比照 Laravel ErrorCode／ErrorRenderer 的訊息）。 */
  message: string;
  /** 請求編號（32 碼十六進位）。 */
  requestId: string;
  /** 「重新整理」連結要回到的站內路徑（含查詢字串），只在 503 使用。 */
  retryPath: string | null;
}
