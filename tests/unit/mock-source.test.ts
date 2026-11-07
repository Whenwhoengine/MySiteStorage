// 假資料讀取器：與真 API 同形狀（以契約驗證）、超出範圍回 404、搜尋與分類列表的合成回應帶哨兵。
import { describe, expect, it } from 'vitest';
import { detailRequest, listRequest, searchRequest, siteRequest, taxonomyRequest } from '@/server/api-path';
import { mockResponse } from '@/server/mock-source';
import {
  DetailResponseSchema,
  ErrorSchema,
  ListResponseSchema,
  SearchResponseSchema,
  SiteResponseSchema,
  TaxonomyResponseSchema,
} from '@/server/schemas';

const RID = 'd'.repeat(32);

describe('mockResponse', () => {
  it('網站資訊、列表、單篇照 manifest 回傳', async () => {
    expect(SiteResponseSchema.safeParse((await mockResponse(siteRequest(), RID)).json).success).toBe(true);
    expect(ListResponseSchema.safeParse((await mockResponse(listRequest('post', null), RID)).json).success).toBe(true);
    expect(ListResponseSchema.safeParse((await mockResponse(listRequest('post', 1), RID)).json).success).toBe(true);
    const detail = await mockResponse(detailRequest('post', 'sample-gutenberg-blocks'), RID);
    expect(detail.status).toBe(200);
    expect(DetailResponseSchema.safeParse(detail.json).success).toBe(true);
  });

  it('邊界案例的單篇也可以開（中文 slug）', async () => {
    const r = await mockResponse(detailRequest('post', '示例中文網址邊界案例'), RID);
    expect(r.status).toBe(200);
  });

  it('不存在或超出範圍 → 契約錯誤格式的 404', async () => {
    for (const request of [detailRequest('post', 'nope'), listRequest('post', 2), taxonomyRequest('tag', 'sample', null, 2), taxonomyRequest('tag', 'nope', null, null)]) {
      const r = await mockResponse(request, RID);
      expect(r.status).toBe(404);
      expect(ErrorSchema.safeParse(r.json).success).toBe(true);
    }
  });

  it('分類／標籤的單一型別列表（合成）', async () => {
    const r = await mockResponse(taxonomyRequest('tag', 'sample', 'video', null), RID);
    expect(r.status).toBe(200);
    const parsed = TaxonomyResponseSchema.parse(r.json);
    expect(parsed.data.mode).toBe('listing');
    expect(parsed.data.type).toBe('video');
    expect(parsed.seo.canonical_path).toBe('/tags/sample?type=video');
    expect(parsed.seo.description.startsWith('MSMOCK-7F3A9C1E')).toBe(true);
    expect((await mockResponse(taxonomyRequest('tag', 'sample', 'page', null), RID)).status).toBe(404);
  });

  it('搜尋：空字詞、有結果、零結果、422', async () => {
    const empty = SearchResponseSchema.parse((await mockResponse(searchRequest(null, null, null), RID)).json);
    expect(empty.data.searched).toBe(false);
    const found = SearchResponseSchema.parse((await mockResponse(searchRequest('示例', null, null), RID)).json);
    expect(found.data.items.length).toBeGreaterThan(0);
    expect(found.meta?.total).toBeGreaterThan(0);
    const none = SearchResponseSchema.parse((await mockResponse(searchRequest('完全不存在的字詞', null, null), RID)).json);
    expect(none.data.items).toEqual([]);
    expect(none.data.searched).toBe(true);
    const bad = await mockResponse(searchRequest('x', 'bad', null), RID);
    expect(bad.status).toBe(422);
    const long = await mockResponse(searchRequest('字'.repeat(101), null, null), RID);
    expect(long.status).toBe(422);
  });

  it('搜尋：沒有字詞但帶 page → 200、不搜尋（與真 API／Blade 相同，不是 404）', async () => {
    for (const page of [2, 1000]) {
      const r = await mockResponse(searchRequest(null, null, page), RID);
      expect(r.status).toBe(200);
      const parsed = SearchResponseSchema.parse(r.json);
      expect(parsed.data).toMatchObject({ q: '', searched: false, items: [] });
      expect(parsed.meta).toBeNull();
      expect(parsed.seo.title).toBe('搜尋');
    }
  });
});
