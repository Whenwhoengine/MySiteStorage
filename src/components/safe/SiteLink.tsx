// 受保護：站內與站外連結一律經這裡（定案執行書 §4.4、§5 M-09；AI_RULES 第 4 條）。
//   前端負責的公開頁（首頁、列表、單篇、一般頁面、分類、標籤）→ next/link，prefetch={false}，href 為相對路徑
//   搜尋頁與搜尋結果的分頁                                      → 一般 <a>
//   其他站內路徑（商店、後臺、預覽、/feed.xml、/sitemap.xml…）    → 一般 <a>，相對路徑
//   外部網址（external 為真，或完整網址）                         → 一般 <a>，rel="noopener noreferrer"
// 不使用 shallow 路由。
import Link from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

const PUBLIC_PAGE = /^\/(?:(?:articles|videos|podcasts)(?:\/[^/?#]+)?|(?:pages|categories|tags)\/[^/?#]+)?$/;

/** 這個 href 是否由前端（Next.js）負責、可以站內換頁。 */
export function isFrontendPage(href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  const path = href.split(/[?#]/, 1)[0] ?? '';
  return PUBLIC_PAGE.test(path);
}

export function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}

type SiteLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  /** 選單項目的 external 旗標；未給時依網址判斷。 */
  external?: boolean;
  children: ReactNode;
};

export function SiteLink({ href, external, rel, children, ...rest }: SiteLinkProps) {
  const isExternal = external ?? isExternalHref(href);
  if (isExternal) {
    return (
      <a href={href} rel={rel ?? 'noopener noreferrer'} {...rest}>
        {children}
      </a>
    );
  }
  if (isFrontendPage(href)) {
    return (
      <Link href={href} prefetch={false} rel={rel} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} rel={rel} {...rest}>
      {children}
    </a>
  );
}
