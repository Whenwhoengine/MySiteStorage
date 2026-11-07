// 受保護（src/server/**）：假資料讀取器（v1 §4.4）。只在 MYSITE_DATA_MODE 未設或為 mock 時使用。
// 讀 mocks/（mysite 的 content:export-api-mocks 匯出，manifest 以 api_path 對應檔案），回傳與真 API 相同形狀的回應；
// 呼叫端照樣以契約驗證。以 fs 在執行期讀取（不用 import），正式建置產物與映像才不會帶進假資料（v1 §6.9、FE-09）。
//
// 匯出只含各列表第 1 頁與分類／標籤總覽；下列情境由本檔以匯出資料合成，讓設計預覽可以操作：
//   搜尋任意字詞（在全部摘要的標題與摘要中找）、分類／標籤的單一型別列表。
//   合成的回應同樣植入哨兵字串、同樣經契約驗證。
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeQuery, strimWidth } from '@/lib/text';
import { API_PREFIX, requestKey, type ApiRequest } from './api-path';

interface ManifestFile {
  file: string;
  kind: 'export' | 'edge';
  scenario?: string | null;
  api_path: string;
  status: number;
}

interface Manifest {
  sentinel: string;
  files: ManifestFile[];
}

export interface MockRawResponse {
  status: number;
  json: unknown;
}

const MOCK_ROOT = path.join(process.cwd(), 'mocks');
const PER_PAGE = 12;
const TYPES = ['post', 'video', 'podcast', 'page'] as const;
const LISTABLE = ['post', 'video', 'podcast'] as const;
const COLLECTION_TITLE: Record<string, string> = { post: '文章', video: '影片', podcast: 'Podcast 節目', page: '頁面' };
const TYPE_LABEL: Record<string, string> = { post: '文章', video: '影片', podcast: 'Podcast', page: '頁面' };

let manifestPromise: Promise<{ manifest: Manifest; byPath: Map<string, ManifestFile> }> | null = null;

async function readJson(relative: string): Promise<unknown> {
  // relative 只來自 manifest（受保護目錄），仍限制在 mocks/ 之下
  const full = path.resolve(MOCK_ROOT, path.relative('mocks', relative));
  if (!full.startsWith(`${MOCK_ROOT}${path.sep}`)) throw new Error('假資料路徑超出 mocks/（程式錯誤）');
  return JSON.parse(await readFile(full, 'utf8')) as unknown;
}

function loadManifest() {
  manifestPromise ??= (async () => {
    const manifest = (await readJson('mocks/manifest.json')) as Manifest;
    const byPath = new Map<string, ManifestFile>();
    // 先放邊界案例、再放匯出：同一路徑以匯出為準（例如 empty-list 與文章列表同路徑）
    for (const kind of ['edge', 'export'] as const) {
      for (const file of manifest.files) {
        if (file.kind === kind && file.status === 200) byPath.set(file.api_path, file);
      }
    }
    return { manifest, byPath };
  })();
  return manifestPromise;
}

function notFound(requestId: string): MockRawResponse {
  return { status: 404, json: { error: 'CONTENT_NOT_FOUND', message: '找不到這個內容。', request_id: requestId } };
}

function invalid(message: string, requestId: string): MockRawResponse {
  return { status: 422, json: { error: 'SEARCH_INVALID', message, request_id: requestId } };
}

type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function pageOf(query: Record<string, string | null>): number {
  const raw = query.page;
  return raw === null || raw === undefined ? 1 : Number(raw);
}

/** 全部摘要（列表第 1 頁、搜尋結果、一般頁面），依路徑去重。 */
async function allSummaries(byPath: Map<string, ManifestFile>): Promise<Json[]> {
  const seen = new Map<string, Json>();
  for (const file of byPath.values()) {
    if (file.kind !== 'export') continue;
    const body = asObject(await readJson(file.file));
    const data = body.data;
    const candidates: unknown[] = [];
    if (Array.isArray(data)) candidates.push(...data);
    const dataObj = asObject(data);
    if (Array.isArray(dataObj.items)) candidates.push(...dataObj.items);
    if (typeof dataObj.content_html === 'string' && dataObj.type === 'page') {
      // 一般頁面詳情 → 摘要（去掉詳情才有的欄位）
      const { content_html: _html, video: _video, podcast: _podcast, ...summary } = dataObj;
      candidates.push(summary);
    }
    for (const item of candidates) {
      const obj = asObject(item);
      if (typeof obj.path === 'string' && !seen.has(obj.path)) seen.set(obj.path, obj);
    }
  }
  return [...seen.values()].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
}

function paginate(items: Json[], page: number) {
  const totalPages = Math.ceil(items.length / PER_PAGE);
  return {
    items: items.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    meta: { page, per_page: PER_PAGE, total: items.length, total_pages: totalPages },
    outOfRange: page > 1 && page > totalPages,
  };
}

async function mockSearch(request: ApiRequest, requestId: string, sentinel: string, byPath: Map<string, ManifestFile>): Promise<MockRawResponse> {
  const rawQ = request.query.q ?? '';
  const q = normalizeQuery(rawQ);
  const rawType = (request.query.type ?? '').trim();
  const type = rawType === '' ? null : rawType;
  if (type !== null && !(TYPES as readonly string[]).includes(type)) return invalid('內容類型不正確，請重新選擇。', requestId);
  if ([...q].length > 100) return invalid('搜尋字詞最多 100 個字，請縮短後再試。', requestId);
  const page = pageOf(request.query);
  const seo = (title: string) => ({
    title,
    description: `${sentinel} 搜尋站內文章、影片與 Podcast。`,
    canonical_path: '/search',
    noindex: true,
    og_type: 'website',
    og_image: null,
    og_image_alt: null,
  });
  if (q === '') {
    // 沒有字詞時不搜尋，page 只驗格式（呼叫端已驗）不看範圍：真 API 同樣回 200（PublicContentController::search）
    return { status: 200, json: { data: { q: '', type, searched: false, items: [] }, meta: null, seo: seo('搜尋') } };
  }
  const needle = q.toLowerCase();
  const matched = (await allSummaries(byPath)).filter(
    (item) =>
      (type === null || item.type === type) &&
      (String(item.title).toLowerCase().includes(needle) || String(item.excerpt).toLowerCase().includes(needle)),
  );
  const result = paginate(matched, page);
  if (result.outOfRange) return notFound(requestId);
  const title = `搜尋「${strimWidth(q, 40)}」${page > 1 ? `（第 ${page} 頁）` : ''}`;
  return { status: 200, json: { data: { q, type, searched: true, items: result.items }, meta: result.meta, seo: seo(title) } };
}

async function mockTaxonomyListing(base: ManifestFile, request: ApiRequest, requestId: string, sentinel: string): Promise<MockRawResponse> {
  const type = request.query.type ?? '';
  if (!(LISTABLE as readonly string[]).includes(type)) return notFound(requestId);
  const body = asObject(await readJson(base.file));
  const data = asObject(body.data);
  const term = asObject(data.term);
  const section = asObject(asObject(data.overview)[type]);
  const items = Array.isArray(section.items) ? (section.items as Json[]) : [];
  const page = pageOf(request.query);
  const result = paginate(items, page);
  if (result.outOfRange) return notFound(requestId);
  const label = String(data.label);
  const name = String(term.name);
  const canonical = `${String(term.path)}?${page > 1 ? `page=${page}&` : ''}type=${type}`;
  return {
    status: 200,
    json: {
      data: { ...data, mode: 'listing', type, overview: null, items: result.items },
      meta: result.meta,
      seo: {
        title: `${label}：${name}－${COLLECTION_TITLE[type]}${page > 1 ? `（第 ${page} 頁）` : ''}`,
        description: `${sentinel} ${label}「${name}」的${TYPE_LABEL[type]}。`,
        canonical_path: canonical,
        noindex: false,
        og_type: 'website',
        og_image: null,
        og_image_alt: null,
      },
    },
  };
}

/** 依 API 請求回傳假資料回應（形狀與真 API 相同；由呼叫端以契約驗證）。 */
export async function mockResponse(request: ApiRequest, requestId: string): Promise<MockRawResponse> {
  const { manifest, byPath } = await loadManifest();
  if (request.path === `${API_PREFIX}search`) return mockSearch(request, requestId, manifest.sentinel, byPath);

  const taxonomy = /^\/api\/v1\/(categories|tags)\/[^/]+$/.test(request.path);
  if (taxonomy) {
    const base = byPath.get(request.path);
    if (base === undefined) return notFound(requestId);
    const hasType = request.query.type !== null && request.query.type !== undefined && request.query.type !== '';
    if (hasType) return mockTaxonomyListing(base, request, requestId, manifest.sentinel);
    // 總覽不分頁：帶 page 一律 404（契約）
    if ((request.query.page ?? null) !== null) return notFound(requestId);
    return { status: 200, json: await readJson(base.file) };
  }

  // 列表第 1 頁以外沒有匯出：超出範圍一律 404（真 API 對超過總頁數也回 404）
  const page = pageOf(request.query);
  const key = requestKey({ path: request.path, query: { ...request.query, page: page === 1 ? null : request.query.page ?? null } });
  const file = byPath.get(key);
  if (file === undefined) return notFound(requestId);
  return { status: 200, json: await readJson(file.file) };
}
