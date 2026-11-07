// 受保護（src/server/**）：API 形狀 → 畫面 props（src/lib/content/types.ts）。只放畫面需要的欄位。
import type {
  CardItem,
  CollectionInfo,
  EntryItem,
  ImageInfo,
  PageInfo,
  SiteInfo,
  TermLink,
} from '@/lib/content/types';
import type {
  ApiContentDetail,
  ApiContentSummary,
  ApiImage,
  ApiPagination,
  ApiSite,
  ApiTerm,
} from './schemas';

export function toImage(image: ApiImage | null): ImageInfo | null {
  return image === null ? null : { url: image.url, alt: image.alt, width: image.width, height: image.height };
}

export function toSiteInfo(site: ApiSite): SiteInfo {
  return {
    name: site.name,
    tagline: site.tagline,
    authorBio: site.author_bio,
    socialLinks: site.social_links.map((l) => ({ label: l.label, url: l.url })),
    logo: toImage(site.logo),
    isSample: site.is_sample,
    primaryMenu: site.menus.primary.map((m) => ({ label: m.label, url: m.url, external: m.external })),
    footerMenu: site.menus.footer.map((m) => ({ label: m.label, url: m.url, external: m.external })),
    commerceEnabled: site.commerce_enabled,
  };
}

export function toCard(item: ApiContentSummary): CardItem {
  return {
    type: item.type,
    path: item.path,
    title: item.title,
    excerpt: item.excerpt,
    publishedAt: item.published_at,
    authorName: item.author_name,
    cover: toImage(item.cover),
    durationSeconds: item.duration_seconds,
    isSample: item.is_sample,
  };
}

function toTerm(term: ApiTerm): TermLink {
  return { name: term.name, path: term.path };
}

export function toEntry(item: ApiContentDetail): EntryItem {
  return {
    type: item.type,
    path: item.path,
    title: item.title,
    excerpt: item.excerpt,
    publishedAt: item.published_at,
    modifiedAt: item.modified_at,
    authorName: item.author_name,
    cover: toImage(item.cover),
    isSample: item.is_sample,
    contentHtml: item.content_html,
    categories: item.categories.map(toTerm),
    tags: item.tags.map(toTerm),
    video:
      item.type === 'video' && item.video !== null
        ? {
            youtubeId: item.video.video_unavailable ? null : item.video.youtube_id,
            watchUrl: item.video.video_unavailable ? null : item.video.watch_url,
            embedUrl: item.video.video_unavailable ? null : item.video.embed_url,
            durationSeconds: item.video.duration_seconds,
          }
        : item.type === 'video'
          ? { youtubeId: null, watchUrl: null, embedUrl: null, durationSeconds: null }
          : null,
    podcast:
      item.type === 'podcast' && item.podcast !== null
        ? {
            audioUrl: item.podcast.audio_unavailable ? null : item.podcast.audio_url,
            audioMime: item.podcast.audio_unavailable ? null : item.podcast.audio_mime,
            durationSeconds: item.podcast.duration_seconds,
          }
        : item.type === 'podcast'
          ? { audioUrl: null, audioMime: null, durationSeconds: null }
          : null,
  };
}

export function toPageInfo(meta: ApiPagination): PageInfo {
  return { page: meta.page, totalPages: meta.total_pages, total: meta.total, perPage: meta.per_page };
}

export function toCollection(collection: { type: 'post' | 'video' | 'podcast'; label: string; title: string; lede: string }): CollectionInfo {
  return { type: collection.type, label: collection.label, title: collection.title, lede: collection.lede };
}
