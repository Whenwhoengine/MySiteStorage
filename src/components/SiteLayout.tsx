// 開放區：完整版面（頁首、<main id="main">、頁尾）。網站資訊取得成功時使用；取不到時 _app 改用受保護的內建靜態版。
// 必須保留：<main id="main" tabIndex={-1}>（跳到主要內容的落點）。
import type { ReactNode } from 'react';
import type { SiteInfo } from '@/lib/content/types';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { containerClass } from './ui';

/** 首頁主視覺的背景光暈（.page-home .site-main）。 */
const HOME_GLOW = 'bg-[radial-gradient(1100px_420px_at_85%_-12%,var(--color-brand-wash),transparent_62%)]';

export function SiteLayout({
  site,
  currentPath,
  children,
}: {
  site: SiteInfo;
  currentPath: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader site={site} currentPath={currentPath} />
      <main id="main" className={`min-h-[60vh] pt-8 pb-16 ${currentPath === '/' ? HOME_GLOW : ''}`} tabIndex={-1}>
        <div className={containerClass}>{children}</div>
      </main>
      <SiteFooter site={site} />
    </>
  );
}
