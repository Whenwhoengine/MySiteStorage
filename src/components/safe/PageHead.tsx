// 受保護：<head> 中繼資料，逐項比照 mysite layouts/app.blade.php（v1 §6.3）。
// title「頁面標題｜站名」、description、robots、canonical 與 og:url（主站公開網址＋路徑，不讀 Host）、
// Open Graph、twitter:card、theme-color、color-scheme、RSS 連結。
import Head from 'next/head';
import type { HeadProps } from '@/lib/page-props';

export function PageHead({ head }: { head: HeadProps }) {
  const og = head.og;
  return (
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{head.title}</title>
      {head.description !== null ? <meta name="description" content={head.description} /> : null}
      {head.robots !== null ? <meta name="robots" content={head.robots} /> : null}
      {head.canonical !== null ? (
        <>
          <link rel="canonical" href={head.canonical} />
          <meta property="og:url" content={head.canonical} />
        </>
      ) : null}
      {og !== null ? (
        <>
          <meta property="og:type" content={og.type} />
          <meta property="og:title" content={og.title} />
          <meta property="og:site_name" content={head.siteName} />
          <meta property="og:locale" content="zh_TW" />
          {og.description !== null ? <meta property="og:description" content={og.description} /> : null}
          {og.image !== null ? (
            <>
              <meta property="og:image" content={og.image} />
              {og.imageAlt ? <meta property="og:image:alt" content={og.imageAlt} /> : null}
              <meta name="twitter:card" content="summary_large_image" />
            </>
          ) : (
            <meta name="twitter:card" content="summary" />
          )}
        </>
      ) : null}
      <meta name="theme-color" content="#0f1115" />
      <meta name="color-scheme" content="dark" />
      <link rel="alternate" type="application/rss+xml" title={head.siteName} href="/feed.xml" />
    </Head>
  );
}
