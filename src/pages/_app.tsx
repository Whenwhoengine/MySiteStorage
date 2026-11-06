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

export default function App({ Component, pageProps }: AppProps<PageProps<Record<string, unknown>>>) {
  const { shell, head, view, error } = pageProps;
  const content = error !== undefined ? <ErrorView error={error} /> : <Component {...view} />;
  return (
    <>
      <PageHead head={head} />
      <SkipLink />
      {shell.site !== null ? (
        <SiteLayout site={shell.site} currentPath={shell.currentPath}>
          {content}
        </SiteLayout>
      ) : (
        <StaticShell siteName={shell.siteName}>{content}</StaticShell>
      )}
      <DataSourceNotice source={shell.dataSource} />
    </>
  );
}
