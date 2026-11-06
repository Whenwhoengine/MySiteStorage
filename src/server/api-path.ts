// 受保護（src/server/**）：組 API 網址的規矩（防路徑穿越，v1 §6.3）。
// - slug 先驗 ^[^/]{1,200}$（沿用 mysite app/routes/content.php），不得為 . 或 ..，也不收控制字元；不合格直接 404，不送出請求。
// - page 照契約：去頭尾空白後須符合 ^[1-9]\d{0,3}$；空字串視同未帶；其他值 404。
// - 每一段都編碼，用 URL 物件組成完整網址；送出前斷言路徑以 /api/v1/ 開頭，否則視為程式錯誤。
import type { ContentType, ListableType } from '@/lib/content/types';
import { TYPE_PREFIX, rawUrlEncode } from '@/lib/paths';

export const API_PREFIX = '/api/v1/';

/** 路由參數或查詢參數可能是陣列（同名參數重複）；PHP 取最後一個，這裡比照。 */
export function lastValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.length === 0 ? undefined : value[value.length - 1];
  return value;
}

// 控制字元（C0 與 DEL）一律不收
// eslint-disable-next-line no-control-regex -- 刻意比對控制字元
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** 已解碼的 slug 是否合格（Next.js 傳進來的路由參數已解碼）。 */
export function isValidSlug(slug: string | undefined): slug is string {
  if (slug === undefined) return false;
  if (slug === '.' || slug === '..') return false;
  if (slug.includes('/') || CONTROL_CHARS.test(slug)) return false;
  const length = [...slug].length;
  return length >= 1 && length <= 200;
}

export type PageParam = { ok: true; page: number | null } | { ok: false };

/** page 參數：未帶或空白 → null；合格 → 數字；其他 → 不合格（404）。 */
export function parsePage(raw: string | string[] | undefined): PageParam {
  const value = lastValue(raw);
  if (value === undefined) return { ok: true, page: null };
  const trimmed = value.trim();
  if (trimmed === '') return { ok: true, page: null };
  if (!/^[1-9]\d{0,3}$/.test(trimmed)) return { ok: false };
  return { ok: true, page: Number(trimmed) };
}

/** 斷言組好的網址確實落在 API 前綴之下、且來源沒有被改掉。 */
export function assertApiUrl(url: URL, origin: string): URL {
  if (url.origin !== origin || !url.pathname.startsWith(API_PREFIX)) {
    throw new Error('組出的 API 網址不在允許範圍內（程式錯誤）');
  }
  return url;
}

/** 由「API 路徑＋查詢參數」組完整網址。path 必須是本檔函式產生的相對路徑。 */
export function apiUrl(origin: string, path: string, query: Record<string, string | null> = {}): URL {
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(query)) {
    if (value !== null) url.searchParams.set(key, value);
  }
  return assertApiUrl(url, origin);
}

/** API 路徑（含查詢字串）——資料層與假資料讀取器共用同一個表示法。 */
export interface ApiRequest {
  /** 例如 /api/v1/articles/%E7%A4%BA%E4%BE%8B */
  path: string;
  query: Record<string, string | null>;
}

export function siteRequest(): ApiRequest {
  return { path: `${API_PREFIX}site`, query: {} };
}

export function homeRequest(): ApiRequest {
  return { path: `${API_PREFIX}home`, query: {} };
}

export function listRequest(type: ListableType, page: number | null): ApiRequest {
  return { path: `${API_PREFIX}${TYPE_PREFIX[type]}`, query: { page: page === null ? null : String(page) } };
}

export function detailRequest(type: ContentType, slug: string): ApiRequest {
  if (!isValidSlug(slug)) throw new Error('slug 未驗證（程式錯誤）');
  return { path: `${API_PREFIX}${TYPE_PREFIX[type]}/${rawUrlEncode(slug)}`, query: {} };
}

export function taxonomyRequest(
  kind: 'category' | 'tag',
  slug: string,
  type: string | null,
  page: number | null,
): ApiRequest {
  if (!isValidSlug(slug)) throw new Error('slug 未驗證（程式錯誤）');
  const base = kind === 'category' ? 'categories' : 'tags';
  return {
    path: `${API_PREFIX}${base}/${rawUrlEncode(slug)}`,
    query: { type, page: page === null ? null : String(page) },
  };
}

export function searchRequest(q: string | null, type: string | null, page: number | null): ApiRequest {
  return { path: `${API_PREFIX}search`, query: { q, type, page: page === null ? null : String(page) } };
}

/** 把 ApiRequest 轉成「路徑＋查詢字串」字串（假資料以此對應 manifest 的 api_path）。 */
export function requestKey(request: ApiRequest): string {
  const url = apiUrl('http://mock.invalid', request.path, request.query);
  return `${url.pathname}${url.search}`;
}
