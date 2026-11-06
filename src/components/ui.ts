// 開放區：共用的工具類組合（按鈕、輸入框、容器）。第一版比照 Blade components.css、layout.css。

/** 版面容器（.container）。 */
export const containerClass = 'mx-auto w-full max-w-site px-4 md:px-6';

const buttonBase =
  'cursor-pointer items-center justify-center gap-2 rounded-sm border font-semibold no-underline transition-[background,border-color] duration-(--duration)';

/**
 * 按鈕（.button／.button--primary）。
 * display 預設 inline-flex、size 預設 min-h-11 px-4；要改時整組傳入自己的工具類（例如 'hidden max-md:inline-flex'），
 * 不要在後面再疊同一屬性的工具類——兩個同屬性的工具類誰生效不固定。
 */
export function buttonClass(
  variant: 'default' | 'primary' = 'default',
  display = 'inline-flex',
  size = 'min-h-11 px-4',
): string {
  return variant === 'primary'
    ? `${display} ${size} ${buttonBase} border-brand bg-brand text-ink-on-brand visited:text-ink-on-brand hover:bg-brand-strong`
    : `${display} ${size} ${buttonBase} border-line-strong bg-surface-raised text-ink-primary visited:text-ink-primary hover:border-ink-secondary`;
}

/** 輸入框與下拉選單（.input／.select）。size 可換成自己的高度、寬度與上下內距組合。 */
export function inputClass(size = 'min-h-11 w-full py-2'): string {
  return `${size} rounded-sm border border-line-strong bg-surface-page px-3 text-ink-primary aria-invalid:border-state-danger`;
}

/** 內容型別的識別色（.type-chip--*）：寫滿完整 class，不用字串拼接組 class 名稱。 */
export const typeChipColor = {
  post: 'text-type-post visited:text-type-post',
  video: 'text-type-video visited:text-type-video',
  podcast: 'text-type-podcast visited:text-type-podcast',
  page: 'text-ink-secondary visited:text-ink-secondary',
} as const;
