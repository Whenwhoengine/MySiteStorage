// 受保護：全站唯一輸出 HTML 的地方（v1 §6.4；FE-03）。
// 只接受公開 API 的 *_html 欄位（已由 mysite Sanitizer 淨化）；呼叫端由 CI 檢查。
// 外觀由 src/styles/globals.css 的 .prose 決定。

export function SafeHtml({ html, className = '' }: { html: string; className?: string }) {
  // eslint-disable-next-line no-restricted-syntax -- 本檔是唯一允許的輸出點（FE-03）
  return <div className={`prose ${className}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />;
}
