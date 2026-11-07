// 開放區：小標籤（.badge）。sample（示例內容）必須保留 data-sample-badge 與文字「示例內容」。
import type { ReactNode } from 'react';

const VARIANT = {
  default: 'border-line-strong bg-surface-raised text-ink-secondary',
  sample: 'border-state-warning bg-surface-sample text-state-warning',
  accent: 'border-brand text-brand',
} as const;

export function Badge({ variant = 'default', children }: { variant?: keyof typeof VARIANT; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-[0.55rem] py-[0.1rem] text-xs font-bold ${VARIANT[variant]}`}
      {...(variant === 'sample' ? { 'data-sample-badge': '' } : {})}
    >
      {children}
    </span>
  );
}

/** 「示例內容」標示（is_sample 為真時一律顯示）。 */
export function SampleBadge() {
  return <Badge variant="sample">示例內容</Badge>;
}
