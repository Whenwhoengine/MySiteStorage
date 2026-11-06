// 受保護（src/server/**）：公開 API 回應的執行期驗證（v1 §6.3「回應驗證：zod；不符即 503」）。
// 逐欄對應 contracts/public-api-v1.openapi.json（mysite 契約正本的同步副本）；
// 所有物件都是封閉的（契約 additionalProperties: false），多一個欄位也算不符。
// 型別與契約一致由 tests/unit/contract-types.test.ts（編譯期）與樣本集測試（執行期）把關。
import { z } from 'zod';

const isoUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
const sitePath = z.string().regex(/^\/[^\s]*$/);
const nonNegativeInt = z.int().min(0);

export const ImageSchema = z.strictObject({
  url: z.string(),
  alt: z.string(),
  width: z.int().min(1).nullable(),
  height: z.int().min(1).nullable(),
});

export const TermSchema = z.strictObject({
  slug: z.string().min(1).max(200),
  name: z.string(),
  path: sitePath,
  count: nonNegativeInt.nullable(),
});

export const MenuItemSchema = z.strictObject({
  label: z.string(),
  url: z.string(),
  external: z.boolean(),
});

export const SocialLinkSchema = z.strictObject({
  label: z.string(),
  url: z.string().regex(/^https:\/\//),
});

export const VideoSchema = z.strictObject({
  youtube_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/).nullable(),
  watch_url: z
    .string()
    .regex(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/)
    .nullable(),
  embed_url: z
    .string()
    .regex(/^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?autoplay=1&rel=0$/)
    .nullable(),
  duration_seconds: nonNegativeInt.nullable(),
  video_unavailable: z.boolean(),
});

export const AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/flac',
] as const;

export const PodcastSchema = z.strictObject({
  audio_url: z.string().nullable(),
  audio_mime: z.enum(AUDIO_MIMES).nullable(),
  duration_seconds: nonNegativeInt.nullable(),
  audio_unavailable: z.boolean(),
});

const contentType = z.enum(['post', 'video', 'podcast', 'page']);

const summaryShape = {
  type: contentType,
  slug: z.string().min(1).max(200),
  path: sitePath,
  title: z.string(),
  excerpt: z.string(),
  published_at: isoUtc,
  modified_at: isoUtc,
  author_name: z.string().nullable(),
  cover: ImageSchema.nullable(),
  categories: z.array(TermSchema),
  tags: z.array(TermSchema),
  duration_seconds: nonNegativeInt.nullable(),
  is_sample: z.boolean(),
};

export const ContentSummarySchema = z.strictObject(summaryShape);

export const ContentDetailSchema = z.strictObject({
  ...summaryShape,
  content_html: z.string(),
  video: VideoSchema.nullable(),
  podcast: PodcastSchema.nullable(),
});

export const PaginationSchema = z.strictObject({
  page: z.int().min(1),
  per_page: z.int().min(1),
  total: nonNegativeInt,
  total_pages: nonNegativeInt,
});

export const SeoSchema = z.strictObject({
  title: z.string(),
  description: z.string(),
  canonical_path: z.string().regex(/^\//),
  noindex: z.boolean(),
  og_type: z.enum(['website', 'article', 'video.other']),
  og_image: z.string().nullable(),
  og_image_alt: z.string().nullable(),
});

export const CollectionSchema = z.strictObject({
  type: z.enum(['post', 'video', 'podcast']),
  label: z.string(),
  title: z.string(),
  lede: z.string(),
});

export const SiteSchema = z.strictObject({
  name: z.string().min(1),
  tagline: z.string(),
  author_bio: z.string(),
  social_links: z.array(SocialLinkSchema),
  logo: ImageSchema.nullable(),
  is_sample: z.boolean(),
  fallback: z.boolean(),
  menus: z.strictObject({
    primary: z.array(MenuItemSchema),
    footer: z.array(MenuItemSchema),
  }),
  commerce_enabled: z.boolean(),
});

export const ErrorSchema = z.strictObject({
  error: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  message: z.string().min(1),
  request_id: z.string().regex(/^[a-f0-9]{32}$/),
});

const taxonomySection = z.strictObject({
  items: z.array(ContentSummarySchema),
  total: nonNegativeInt,
  per_page: z.int().min(1),
});

export const SiteResponseSchema = z.strictObject({ data: SiteSchema });

export const HomeResponseSchema = z.strictObject({
  data: z.strictObject({
    featured: ContentSummarySchema.nullable(),
    posts: z.array(ContentSummarySchema).max(6),
    videos: z.array(ContentSummarySchema).max(4),
    podcasts: z.array(ContentSummarySchema).max(4),
  }),
  seo: SeoSchema,
});

export const ListResponseSchema = z.strictObject({
  data: z.array(ContentSummarySchema),
  meta: PaginationSchema,
  collection: CollectionSchema,
  seo: SeoSchema,
});

export const DetailResponseSchema = z.strictObject({
  data: ContentDetailSchema,
  seo: SeoSchema,
});

export const TaxonomyResponseSchema = z.strictObject({
  data: z.strictObject({
    kind: z.enum(['category', 'tag']),
    label: z.enum(['分類', '標籤']),
    term: TermSchema,
    mode: z.enum(['overview', 'listing']),
    type: z.enum(['post', 'video', 'podcast']).nullable(),
    overview: z
      .strictObject({ post: taxonomySection, video: taxonomySection, podcast: taxonomySection })
      .nullable(),
    items: z.array(ContentSummarySchema).max(12).nullable(),
  }),
  meta: PaginationSchema.nullable(),
  seo: SeoSchema,
});

export const SearchResponseSchema = z.strictObject({
  data: z.strictObject({
    q: z.string().max(100),
    type: contentType.nullable(),
    searched: z.boolean(),
    items: z.array(ContentSummarySchema).max(12),
  }),
  meta: PaginationSchema.nullable(),
  seo: SeoSchema,
});

export type ApiImage = z.infer<typeof ImageSchema>;
export type ApiTerm = z.infer<typeof TermSchema>;
export type ApiMenuItem = z.infer<typeof MenuItemSchema>;
export type ApiVideo = z.infer<typeof VideoSchema>;
export type ApiPodcast = z.infer<typeof PodcastSchema>;
export type ApiContentSummary = z.infer<typeof ContentSummarySchema>;
export type ApiContentDetail = z.infer<typeof ContentDetailSchema>;
export type ApiPagination = z.infer<typeof PaginationSchema>;
export type ApiSeo = z.infer<typeof SeoSchema>;
export type ApiSite = z.infer<typeof SiteSchema>;
export type ApiError = z.infer<typeof ErrorSchema>;
export type ApiSiteResponse = z.infer<typeof SiteResponseSchema>;
export type ApiHomeResponse = z.infer<typeof HomeResponseSchema>;
export type ApiListResponse = z.infer<typeof ListResponseSchema>;
export type ApiDetailResponse = z.infer<typeof DetailResponseSchema>;
export type ApiTaxonomyResponse = z.infer<typeof TaxonomyResponseSchema>;
export type ApiSearchResponse = z.infer<typeof SearchResponseSchema>;
