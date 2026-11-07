// 編譯期檢查：src/server/schemas.ts 的 zod 推出的型別，必須與 openapi-typescript 由契約產生的型別完全相同。
// 契約改了而 zod 沒跟著改（或反之），npm run typecheck 就會失敗。執行期另由 contract.test.ts 以樣本集驗證。
import { describe, expect, it } from 'vitest';
import type { components } from '@/lib/content/api-contract';
import type {
  ApiContentDetail,
  ApiContentSummary,
  ApiDetailResponse,
  ApiError,
  ApiHomeResponse,
  ApiImage,
  ApiListResponse,
  ApiPagination,
  ApiPodcast,
  ApiSearchResponse,
  ApiSeo,
  ApiSite,
  ApiSiteResponse,
  ApiTaxonomyResponse,
  ApiTerm,
  ApiVideo,
} from '@/server/schemas';

type S = components['schemas'];

/** 兩個型別完全相同時為 true（雙向可指派且結構一致）。 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** 深層展開，讓 openapi-typescript 的參照與 zod 的展開形式可以比較。 */
type Deep<T> = T extends (infer U)[] ? Deep<U>[] : T extends object ? { [K in keyof T]: Deep<T[K]> } : T;

type Check<A, B> = Equal<Deep<A>, Deep<B>>;

const checks: {
  image: Check<ApiImage, S['Image']>;
  term: Check<ApiTerm, S['Term']>;
  video: Check<ApiVideo, S['Video']>;
  podcast: Check<ApiPodcast, S['Podcast']>;
  summary: Check<ApiContentSummary, S['ContentSummary']>;
  detail: Check<ApiContentDetail, S['ContentDetail']>;
  pagination: Check<ApiPagination, S['Pagination']>;
  seo: Check<ApiSeo, S['Seo']>;
  site: Check<ApiSite, S['Site']>;
  error: Check<ApiError, S['Error']>;
  siteResponse: Check<ApiSiteResponse, S['SiteResponse']>;
  homeResponse: Check<ApiHomeResponse, S['HomeResponse']>;
  listResponse: Check<ApiListResponse, S['ListResponse']>;
  detailResponse: Check<ApiDetailResponse, S['DetailResponse']>;
  taxonomyResponse: Check<ApiTaxonomyResponse, S['TaxonomyResponse']>;
  searchResponse: Check<ApiSearchResponse, S['SearchResponse']>;
} = {
  image: true,
  term: true,
  video: true,
  podcast: true,
  summary: true,
  detail: true,
  pagination: true,
  seo: true,
  site: true,
  error: true,
  siteResponse: true,
  homeResponse: true,
  listResponse: true,
  detailResponse: true,
  taxonomyResponse: true,
  searchResponse: true,
};

describe('zod 型別與契約型別', () => {
  it('完全相同（實際檢查在型別檢查階段）', () => {
    expect(Object.values(checks).every(Boolean)).toBe(true);
  });
});
