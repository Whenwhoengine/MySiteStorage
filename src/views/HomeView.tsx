// 開放區：首頁畫面。比照 Blade content/home.blade.php。
// 必須保留：唯一的 h1（data-page-title）、示例內容標示、各區塊的內容卡片。
import { SampleBadge } from '@/components/Badge';
import { CardGrid, EmptyLine, Notice, Section, sectionMoreClass } from '@/components/Blocks';
import { ContentCard } from '@/components/ContentCard';
import { Icon } from '@/components/Icon';
import { SiteLink } from '@/components/safe/SiteLink';
import { buttonClass } from '@/components/ui';
import type { HomeViewProps } from '@/lib/content/types';

export default function HomeView({ siteName, site, featured, posts, videos, podcasts }: HomeViewProps) {
  const allEmpty = posts.length === 0 && videos.length === 0 && podcasts.length === 0;
  return (
    <>
      <section className="grid items-center gap-8 pt-3 pb-8 wide:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-labelledby="hero-title">
        <div>
          <p className="mb-2 text-sm font-extrabold tracking-hero text-brand">影片．Podcast．文章</p>
          <h1
            id="hero-title"
            className="mb-3 text-hero tracking-title [overflow-wrap:anywhere] after:mt-3 after:block after:h-1.5 after:w-14 after:rounded-bar after:bg-brand"
            data-page-title=""
          >
            {site?.name ?? siteName}
          </h1>
          {site !== null && site.tagline !== '' ? <p className="max-w-hero-tagline text-lg text-ink-secondary">{site.tagline}</p> : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <SiteLink className={buttonClass('primary')} href="/videos">
              <Icon name="play" />
              看影片
            </SiteLink>
            <SiteLink className={buttonClass()} href="/podcasts">
              <Icon name="podcast" />聽 Podcast
            </SiteLink>
            <SiteLink className={buttonClass()} href="/articles">
              <Icon name="post" />
              讀文章
            </SiteLink>
          </div>
          {site?.isSample ? (
            <p className="mt-4 text-sm text-ink-secondary">
              <SampleBadge /> 目前顯示的是示例資料，正式內容發布後會自動取代。
            </p>
          ) : null}
        </div>
        {featured !== null ? (
          <div>
            <p className="mb-2 text-xs font-extrabold tracking-eyebrow text-ink-tertiary">最新發布</p>
            <ContentCard item={featured} level={2} variant="feature" />
          </div>
        ) : null}
      </section>

      {allEmpty ? (
        <Notice variant="info" title="還沒有公開內容">
          內容發布後會出現在這裡。您也可以稍後再回來看看。
        </Notice>
      ) : null}

      <Section
        id="home-videos"
        icon="video"
        title="最新影片"
        more={
          <SiteLink className={sectionMoreClass} href="/videos">
            全部影片
            <Icon name="arrow" inline />
          </SiteLink>
        }
      >
        {videos.length === 0 ? <EmptyLine>目前沒有公開的影片。</EmptyLine> : <CardGrid items={videos} grid="media" />}
      </Section>

      <Section
        id="home-podcasts"
        icon="podcast"
        title="Podcast"
        more={
          <SiteLink className={sectionMoreClass} href="/podcasts">
            全部節目
            <Icon name="arrow" inline />
          </SiteLink>
        }
      >
        {podcasts.length === 0 ? (
          <EmptyLine>目前沒有公開的 Podcast 節目。</EmptyLine>
        ) : (
          <CardGrid items={podcasts} grid="podcast" variant="row" />
        )}
      </Section>

      <Section
        id="home-posts"
        icon="post"
        title="最新文章"
        more={
          <SiteLink className={sectionMoreClass} href="/articles">
            全部文章
            <Icon name="arrow" inline />
          </SiteLink>
        }
      >
        {posts.length === 0 ? <EmptyLine>目前沒有公開的文章。</EmptyLine> : <CardGrid items={posts} />}
      </Section>
    </>
  );
}
// FE-11 測試：設計分支只改開放區（不合併）
