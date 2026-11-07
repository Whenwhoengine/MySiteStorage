// 受保護（src/server/**）：組 API 網址的規矩（防路徑穿越，v1 §6.3）。
// - slug 先驗 ^[^/]{1,200}$（沿用 mysite app/routes/content.php），不得為 . 或 ..，也不收控制字元；不合格直接 404，不送出請求。
// - page 照契約：去頭尾空白後須符合 ^[1-9]\d{0,3}$ 且不超過 1000；空字串視同未帶；其他值 404（PublicContentInput::page）。
// - 查詢參數比照 PHP 解析（同名取最後一個；page[]=… 之類寫法 Laravel 拿到陣列）：見 queryValue。
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

/**
 * slug 是否符合 Laravel 路由的 slug 規則 [^/]{1,200}（mysite app/routes/content.php；200 以 Unicode 字元計）。
 * 不符合時 Laravel 根本沒有對應的路由（「找不到這個頁面。」）；符合但內容端拒絕時是「找不到這個內容。」。
 */
export function matchesSlugRoute(slug: string | undefined): slug is string {
  if (slug === undefined || slug.includes('/')) return false;
  const length = [...slug].length;
  return length >= 1 && length <= 200;
}

/** 已解碼的 slug 是否合格（Next.js 傳進來的路由參數已解碼）。 */
export function isValidSlug(slug: string | undefined): slug is string {
  if (!matchesSlugRoute(slug)) return false;
  if (slug === '.' || slug === '..') return false;
  return !CONTROL_CHARS.test(slug);
}

/** Laravel 的 $request->query() 拿到的不是字串、而是陣列（例如 ?page[]=2）。 */
export const QUERY_ARRAY = Symbol('query-array');
export type QueryValue = string | typeof QUERY_ARRAY | undefined;

/**
 * PHP 解析查詢字串時怎麼看參數名稱（php-src main/php_variables.c php_register_variable_ex）：
 * 遇到 NUL 截斷、去掉開頭空白；第一個 [ 之前的空白與句點改成 _；[ 之後還有 ] 時是陣列（名稱取 [ 之前）；
 * 沒有 ] 時那個 [ 也改成 _、不是陣列。名稱為空時整個參數不算（回傳 null）。
 */
export function phpQueryName(rawKey: string): { name: string; array: boolean } | null {
  const key = rawKey.split('\0', 1)[0]!.replace(/^ +/, '');
  const bracket = key.indexOf('[');
  const base = (bracket === -1 ? key : key.slice(0, bracket)).replace(/[ .]/g, '_');
  if (base === '') return null;
  if (bracket === -1) return { name: base, array: false };
  if (key.indexOf(']', bracket + 1) !== -1) return { name: base, array: true };
  return { name: `${base}_${key.slice(bracket + 1).replace(/[ .[]/g, '_')}`, array: false };
}

/**
 * 某個查詢參數在 Laravel 看到的值（Next.js 的 ctx.query 照原樣保留 page[] 之類的鍵名，這裡換成 PHP 的看法）：
 * 未帶 → undefined；同名（含 page 與 page[] 混用）以最後出現的為準；陣列寫法 → QUERY_ARRAY。
 * ctx.query 依鍵名第一次出現的順序排列，同一鍵名的多個值保持原順序；只有 page=1&page[]=2&page=3 這種
 * 不同寫法交錯出現時，順序資訊在 Next.js 解析時就已遺失（此時以鍵名第一次出現的順序判斷）。
 */
export function queryValue(query: Record<string, string | string[] | undefined>, name: string): QueryValue {
  let result: QueryValue;
  for (const [rawKey, raw] of Object.entries(query)) {
    if (raw === undefined) continue;
    const parsed = phpQueryName(rawKey);
    if (parsed === null || parsed.name !== name) continue;
    result = parsed.array ? QUERY_ARRAY : lastValue(raw);
  }
  return result;
}

/** 只要字串：陣列（QUERY_ARRAY）當成沒帶（PublicContentInput::search 對 q、type 的 is_string 判斷）。 */
export function queryString(query: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = queryValue(query, name);
  return value === QUERY_ARRAY ? undefined : value;
}

export type PageParam = { ok: true; page: number | null } | { ok: false };

/** 契約的頁數上限（PublicContentInput::page：1～1000）。 */
export const MAX_PAGE = 1000;

/** page 參數：未帶或空白 → null；合格（1～1000）→ 數字；陣列或其他 → 不合格（404）。 */
export function parsePage(raw: string | string[] | typeof QUERY_ARRAY | undefined): PageParam {
  if (raw === QUERY_ARRAY) return { ok: false };
  const value = lastValue(raw);
  if (value === undefined) return { ok: true, page: null };
  const trimmed = value.trim();
  if (trimmed === '') return { ok: true, page: null };
  if (!/^[1-9]\d{0,3}$/.test(trimmed) || Number(trimmed) > MAX_PAGE) return { ok: false };
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
// FE-11 測試：新提交多改一個受保護檔（不合併）
