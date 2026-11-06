// 開放區：頁尾。比照 Blade layouts/partials/footer.blade.php。
// 必須保留：<footer data-site-footer>、連到 /pages/privacy 的「隱私說明」（選單沒有時自動補上）、
// 網站為示例內容時的「示例內容」標示。
import { SiteLink } from '@/components/safe/SiteLink';
import type { MenuLink, SiteInfo } from '@/lib/content/types';
import { SampleBadge } from './Badge';
import { Icon } from './Icon';
import { BrandMark } from './SiteHeader';
import { containerClass } from './ui';

const footerLink = 'inline-flex min-h-8 items-center text-ink-secondary visited:text-ink-secondary';

function taipeiYear(): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric' }).format(new Date()));
}

export function SiteFooter({ site }: { site: SiteInfo }) {
  const urls = site.footerMenu.map((m) => m.url);
  const extra: MenuLink[] = [];
  if (!urls.includes('/pages/privacy')) extra.push({ label: '隱私說明', url: '/pages/privacy', external: false });
  return (
    <footer className="border-t border-line py-8 text-sm text-ink-tertiary" data-site-footer="">
      <div className={`${containerClass} grid gap-6 pb-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]`}>
        <section aria-labelledby="footer-brand">
          <p id="footer-brand" className="mb-2 flex flex-wrap items-center gap-2 text-lg font-extrabold text-ink-primary">
            <BrandMark />
            {site.name}
            {site.isSample ? <SampleBadge /> : null}
          </p>
          {site.tagline !== '' ? <p className="text-ink-secondary">{site.tagline}</p> : null}
          {site.authorBio !== '' ? <p className="max-w-footer-bio">{site.authorBio}</p> : null}
        </section>
        <nav aria-label="頁尾選單">
          <ul className="m-0 mb-3 flex list-none flex-wrap gap-3 p-0">
            {[...site.footerMenu, ...extra].map((menu) => (
              <li key={`${menu.label}|${menu.url}`}>
                <SiteLink className={footerLink} href={menu.url} external={menu.external}>
                  {menu.label}
                  {menu.external ? (
                    <>
                      <Icon name="external" inline />
                      <span className="visually-hidden">（外部網站）</span>
                    </>
                  ) : null}
                </SiteLink>
              </li>
            ))}
            {!urls.includes('/search') ? (
              <li>
                <SiteLink className={footerLink} href="/search">
                  搜尋
                </SiteLink>
              </li>
            ) : null}
            {!urls.includes('/feed.xml') ? (
              <li>
                <SiteLink className={footerLink} href="/feed.xml">
                  <Icon name="rss" inline />
                  RSS
                </SiteLink>
              </li>
            ) : null}
          </ul>
          {site.socialLinks.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-3 p-0" aria-label="社群連結">
              {site.socialLinks.map((link) => (
                <li key={`${link.label}|${link.url}`}>
                  <SiteLink className={footerLink} href={link.url} external rel="noopener noreferrer me">
                    {link.label}
                    <Icon name="external" inline />
                    <span className="visually-hidden">（外部網站）</span>
                  </SiteLink>
                </li>
              ))}
            </ul>
          ) : null}
        </nav>
      </div>
      <div className={`${containerClass} border-t border-line pt-4 text-xs`}>
        <p className="m-0">
          © {taipeiYear()} {site.name}。播放影片時才會連線到 YouTube；音訊由本站內容系統提供。
        </p>
      </div>
    </footer>
  );
}
