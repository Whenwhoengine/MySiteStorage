// 契約（定案執行書 M-18②；v1 §6.8 第 5 步）：
// - 契約副本與 mysite 正本雜湊一致（contracts/SOURCE.json）；假資料 manifest 記錄的契約雜湊與副本一致
// - 樣本集：valid 全部通過 zod、invalid 全部失敗（與 mysite 的 PHP 驗證器用同一批）
// - 假資料：每一份都通過 zod、只含示例內容（is_sample 全為 true）、每一份都含哨兵字串、媒體只指向 /mock-media/ 實有檔案
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  DetailResponseSchema,
  ErrorSchema,
  HomeResponseSchema,
  ListResponseSchema,
  SearchResponseSchema,
  SiteResponseSchema,
  TaxonomyResponseSchema,
} from '@/server/schemas';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative: string) => readFileSync(path.join(ROOT, relative));
const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
const readJson = (relative: string): unknown => JSON.parse(read(relative).toString('utf8'));

function schemaFor(operation: string, status: number): z.ZodType {
  if (status !== 200) return ErrorSchema;
  if (operation === '/api/v1/site') return SiteResponseSchema;
  if (operation === '/api/v1/home') return HomeResponseSchema;
  if (operation === '/api/v1/search') return SearchResponseSchema;
  if (/^\/api\/v1\/(articles|videos|podcasts)$/.test(operation)) return ListResponseSchema;
  if (/^\/api\/v1\/(articles|videos|podcasts|pages)\/\{slug\}$/.test(operation)) return DetailResponseSchema;
  if (/^\/api\/v1\/(categories|tags)\/\{slug\}$/.test(operation)) return TaxonomyResponseSchema;
  throw new Error(`未知的 operation：${operation}`);
}

/** 由實際 API 路徑推回 operation path。 */
function operationOf(apiPath: string): string {
  const pathname = apiPath.split('?')[0] ?? apiPath;
  const m = /^\/api\/v1\/(articles|videos|podcasts|pages|categories|tags)\/[^/]+$/.exec(pathname);
  return m ? `/api/v1/${m[1]}/{slug}` : pathname;
}

interface SampleEntry {
  file: string;
  operation: string;
  status: number;
  note: string;
}

describe('契約副本', () => {
  const source = readJson('contracts/SOURCE.json') as { files: Record<string, string> };
  it.each(Object.entries(source.files))('%s 與記錄的雜湊一致', (file, hash) => {
    expect(sha256(read(file))).toBe(hash);
  });
  it('假資料 manifest 的契約雜湊與副本一致', () => {
    const manifest = readJson('mocks/manifest.json') as { contract: { sha256: string } };
    expect(manifest.contract.sha256).toBe(sha256(read('contracts/public-api-v1.openapi.json')));
  });
});

describe('樣本集（PHP 與 zod 同一批）', () => {
  const manifest = readJson('contracts/samples/manifest.json') as { valid: SampleEntry[]; invalid: SampleEntry[] };
  it('數量與 mysite 相同（valid 54、invalid 16）', () => {
    expect(manifest.valid).toHaveLength(54);
    expect(manifest.invalid).toHaveLength(16);
  });
  it.each(manifest.valid.map((s) => [s.file, s] as const))('valid：%s', (file, sample) => {
    const result = schemaFor(sample.operation, sample.status).safeParse(readJson(`contracts/samples/${file}`));
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues.slice(0, 3))).toBe(true);
  });
  it.each(manifest.invalid.map((s) => [s.file, s] as const))('invalid：%s', (file, sample) => {
    expect(schemaFor(sample.operation, sample.status).safeParse(readJson(`contracts/samples/${file}`)).success).toBe(false);
  });
});

describe('假資料（mocks/）', () => {
  const manifest = readJson('mocks/manifest.json') as {
    sentinel: string;
    files: { file: string; api_path: string; status: number }[];
    media: { file: string; url: string; sha256: string }[];
  };
  const mediaUrls = new Set(manifest.media.map((m) => m.url));

  it('合成媒體檔都存在且雜湊正確', () => {
    for (const media of manifest.media) {
      expect(sha256(read(media.file))).toBe(media.sha256);
      expect(media.url.startsWith('/mock-media/')).toBe(true);
    }
  });

  it.each(manifest.files.map((f) => [f.file, f] as const))('%s', (file, entry) => {
    const raw = read(file).toString('utf8');
    const body = JSON.parse(raw) as unknown;
    const result = schemaFor(operationOf(entry.api_path), entry.status).safeParse(body);
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues.slice(0, 3))).toBe(true);
    expect(raw.includes(manifest.sentinel)).toBe(true);

    // 只含示例內容；媒體只指向實有的合成檔
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value === null || typeof value !== 'object') return;
      const obj = value as Record<string, unknown>;
      if ('is_sample' in obj) expect(obj.is_sample).toBe(true);
      for (const key of ['url', 'og_image', 'audio_url']) {
        const v = obj[key];
        if (typeof v === 'string' && (key !== 'url' || 'alt' in obj)) expect(mediaUrls.has(v), `${key}=${v}`).toBe(true);
      }
      Object.values(obj).forEach(walk);
    };
    walk(body);
    expect(raw).not.toMatch(/wp-content\/uploads/);
  });

  it('manifest 列的檔案都在 mocks/ 之下', () => {
    for (const f of manifest.files) expect(existsSync(path.join(ROOT, f.file)) && f.file.startsWith('mocks/')).toBe(true);
  });
});
