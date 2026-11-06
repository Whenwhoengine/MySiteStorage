// 受保護（src/server/**）：取資料的唯一出口。真資料呼叫 Laravel 公開 API；假資料讀 mocks/。
// 回應分類（v1 §6.3）：
//   200 且格式符合契約 → ok
//   404 且為契約錯誤格式 → not_found（畫 404 錯誤頁）
//   422 且為契約錯誤格式（只有搜尋）→ invalid（搜尋頁的錯誤分支）
//   其餘一律 unavailable（503）：連線被拒、逾時、轉址、非 JSON、格式不符、5xx、其他狀態碼
// 每次請求都呼叫，不快取；轉送同一個 X-Request-Id。
import type { z } from 'zod';
import { apiUrl, type ApiRequest } from './api-path';
import type { ServerConfig } from './config';
import { mockResponse } from './mock-source';
import { ErrorSchema } from './schemas';

export type FetchResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'not_found'; requestId: string | null }
  | { kind: 'invalid'; message: string; requestId: string | null }
  | { kind: 'unavailable'; reason: UnavailableReason };

export type UnavailableReason =
  | 'transport'
  | 'timeout'
  | 'redirect'
  | 'status'
  | 'not_json'
  | 'schema'
  | 'config';

interface RawResponse {
  status: number;
  /** 解析後的 JSON；不是 JSON 時為 undefined。 */
  json: unknown;
}

export interface FetchOptions {
  config: ServerConfig;
  requestId: string;
  /** 允許 422（只有搜尋端點） */
  allowInvalid?: boolean;
}

function classify<T>(raw: RawResponse, schema: z.ZodType<T>, allowInvalid: boolean): FetchResult<T> {
  if (raw.json === undefined) return { kind: 'unavailable', reason: 'not_json' };
  if (raw.status === 200) {
    const parsed = schema.safeParse(raw.json);
    return parsed.success ? { kind: 'ok', data: parsed.data } : { kind: 'unavailable', reason: 'schema' };
  }
  if (raw.status === 404 || (raw.status === 422 && allowInvalid)) {
    const parsed = ErrorSchema.safeParse(raw.json);
    if (!parsed.success) return { kind: 'unavailable', reason: 'schema' };
    if (raw.status === 404) return { kind: 'not_found', requestId: parsed.data.request_id };
    return { kind: 'invalid', message: parsed.data.message, requestId: parsed.data.request_id };
  }
  return { kind: 'unavailable', reason: 'status' };
}

async function fetchApi(request: ApiRequest, options: FetchOptions): Promise<RawResponse | { failure: UnavailableReason }> {
  const { config, requestId } = options;
  if (config.apiOrigin === null || config.timeoutMs === null) return { failure: 'config' };
  const url = apiUrl(config.apiOrigin, request.path, request.query);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-Request-Id': requestId },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    return { failure: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'transport' };
  }
  if (response.status >= 300 && response.status < 400) return { failure: 'redirect' };
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    return { failure: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'transport' };
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(contentType)) return { status: response.status, json: undefined };
  try {
    return { status: response.status, json: JSON.parse(text) as unknown };
  } catch {
    return { status: response.status, json: undefined };
  }
}

/** 取一個端點並以契約驗證。不丟例外：所有失敗都轉成結果物件。 */
export async function getJson<T>(request: ApiRequest, schema: z.ZodType<T>, options: FetchOptions): Promise<FetchResult<T>> {
  const allowInvalid = options.allowInvalid ?? false;
  if (options.config.mode === 'mock') {
    const raw = await mockResponse(request, options.requestId);
    return classify(raw, schema, allowInvalid);
  }
  const raw = await fetchApi(request, options);
  if ('failure' in raw) return { kind: 'unavailable', reason: raw.failure };
  return classify(raw, schema, allowInvalid);
}
