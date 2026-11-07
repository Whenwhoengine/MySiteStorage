// 受保護：「目前資料來源」提示（定案執行書 §6 F3 第 8 步、§9.4）。
// 只在開發模式（MyDyad 預覽、next dev）顯示；正式建置連文字都不會出現（CI 全文搜尋檢查）。
import type { ShellProps } from '@/lib/page-props';

export function DataSourceNotice({ source }: { source: ShellProps['dataSource'] }) {
  if (process.env.NODE_ENV !== 'development' || source === null) return null;
  return (
    <p
      role="note"
      className="fixed bottom-2 left-2 z-[60] m-0 rounded-sm border border-state-warning bg-surface-card px-3 py-1 text-xs font-bold text-state-warning"
    >
      {source === 'mock' ? '目前資料：示例資料' : '目前資料：staging 真資料'}
    </p>
  );
}
