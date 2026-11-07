// 受保護（src/lib/**）：站內路徑與分頁網址的規則。

import type { ContentType, ListableType } from './content/types';

/** 型別 → 主站路徑前綴（比照 mysite ContentType::pathPrefix）。 */
export const TYPE_PREFIX: Record<ContentType, string> = {
  post: 'articles',
  video: 'videos',
  podcast: 'podcasts',
  page: 'pages',
};

/** 型別名稱（卡片、標示用）。 */
export const TYPE_LABEL: Record<ContentType, string> = {
  post: '文章',
  video: '影片',
  podcast: 'Podcast',
  page: '頁面',
};

/** 列表頁標題（比照 ContentType::collectionTitle）。 */
export const COLLECTION_TITLE: Record<ContentType, string> = {
  post: '文章',
  video: '影片',
  podcast: 'Podcast 節目',
  page: '頁面',
};

export const LISTABLE_TYPES: readonly ListableType[] = ['post', 'video', 'podcast'];

/** 列表頁路徑，例如 /articles。 */
export function collectionPath(type: ContentType): string {
  return `/${TYPE_PREFIX[type]}`;
}

/**
 * 分頁網址：第 1 頁不帶 page；其餘參數照順序保留、空值略過（比照 components/pagination.blade.php）。
 * 查詢字串以 RFC 3986 編碼（空白為 %20），與 PHP http_build_query(..., PHP_QUERY_RFC3986) 相同。
 */
export function rawUrlEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function pageHref(path: string, query: Record<string, string | null | undefined>, page: number): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    pairs.push(`${rawUrlEncode(key)}=${rawUrlEncode(value)}`);
  }
  if (page > 1) pairs.push(`page=${page}`);
  return pairs.length === 0 ? path : `${path}?${pairs.join('&')}`;
}

/** 分頁要顯示的頁碼：1、目前頁前後各 2 頁、最後一頁（比照 components/pagination.blade.php）。 */
export function pageWindow(page: number, totalPages: number): number[] {
  const set = new Set<number>();
  for (const n of [1, page - 2, page - 1, page, page + 1, page + 2, totalPages]) {
    if (n >= 1 && n <= totalPages) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/** 目前路徑是否屬於選單項目（比照 header.blade.php 的 $isCurrent）。 */
export function isCurrentPath(menuUrl: string, currentPath: string): boolean {
  if (!menuUrl.startsWith('/')) return false;
  const path = menuUrl.split(/[?#]/, 1)[0] ?? menuUrl;
  if (path === '/') return currentPath === '/';
  const trimmed = path.replace(/\/+$/, '');
  return currentPath === path || currentPath.startsWith(`${trimmed}/`);
}
