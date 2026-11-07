// 受保護（src/pages/**）：全站外框。依 getServerSideProps 回傳的 shell／head／view／error 組成每一頁：
//   <head> 中繼資料 → 跳到主要內容 → 完整版面（網站資訊取得成功）或內建靜態頁首頁尾（取不到）→ 畫面或錯誤頁。
import type { AppProps } from 'next/app';
import { DataSourceNotice } from '@/components/safe/DataSourceNotice';
import { ErrorView } from '@/components/safe/ErrorView';
import { PageHead } from '@/components/safe/PageHead';
import { SkipLink } from '@/components/safe/SkipLink';
import { StaticShell } from '@/components/safe/StaticShell';
import { SiteLayout } from '@/components/SiteLayout';
import type { PageProps } from '@/lib/page-props';
import '@/styles/globals.css';

export default function App({ Component, pageProps, router }: AppProps<PageProps<Record<string, unknown>>>) {
  const { shell, head, view, error } = pageProps;
  const content = error !== undefined ? <ErrorView error={error} /> : <Component {...view} />;
  // 每換一頁（不含 # 之後）就整棵版面重新掛載，比照 Blade 每次整頁載入：
  // 同一頁型之間換頁時，播放器、圖片失效狀態、手機選單等元件狀態不會帶到下一頁。
  const pageKey = router.asPath.split('#')[0];
  return (
    <>
      <PageHead head={head} />
      <SkipLink />
      {shell.site !== null ? (
        <SiteLayout key={pageKey} site={shell.site} currentPath={shell.currentPath}>
          {content}
        </SiteLayout>
      ) : (
        <StaticShell key={pageKey} siteName={shell.siteName}>
          {content}
        </StaticShell>
      )}
      <DataSourceNotice source={shell.dataSource} />
    </>
  );
}
