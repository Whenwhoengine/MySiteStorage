// 受保護：/api/v1/site 取不到時使用的內建靜態頁首、頁尾（v1 §6.3；定案執行書 §4.9）。
// 站名取環境變數（MYSITE_SITE_NAME），只放「回首頁」與「隱私說明」連結；不呼叫任何 API。
// 掛鉤：data-site-header、main#main、data-site-footer、頁尾 a[href="/pages/privacy"]。
import type { ReactNode } from 'react';
import { staticShellClasses as c } from '../safe-styles';

export function StaticShell({ siteName, children }: { siteName: string; children: ReactNode }) {
  return (
    <>
      <header className={c.header} data-site-header="">
        <div className={c.headerInner}>
          <a className={c.brand} href="/">
            {siteName}
            <span className="visually-hidden">（回首頁）</span>
          </a>
        </div>
      </header>
      <main id="main" className={c.main} tabIndex={-1}>
        <div className={c.container}>{children}</div>
      </main>
      <footer className={c.footer} data-site-footer="">
        <div className={c.container}>
          <ul className={c.footerLinks}>
            <li>
              <a className={c.footerLink} href="/">
                回首頁
              </a>
            </li>
            <li>
              <a className={c.footerLink} href="/pages/privacy">
                隱私說明
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </>
  );
}
