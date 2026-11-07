// 開放區：受保護元件（src/components/safe/）的外觀。
// 受保護元件只負責結構、行為與測試掛鉤；長什麼樣子由這裡的工具類決定，設計時改這個檔即可。
// 第一版逐項比照現行 Blade CSS（mysite app/resources/css/*.css）。

export const skipLinkClass =
  'absolute left-4 -top-[100px] z-[100] px-4 py-3 rounded-sm bg-brand font-bold no-underline text-ink-on-brand visited:text-ink-on-brand focus:top-3';

export const imageClasses = {
  frame: 'w-full overflow-hidden',
  /** 有圖片時的底色（圖片載入前看到的漸層） */
  filled: 'bg-linear-135/srgb from-surface-raised to-surface-media',
  wide: 'aspect-video',
  square: 'aspect-square',
  auto: '',
  empty: 'bg-[repeating-linear-gradient(-45deg,var(--color-surface-raised)_0_14px,var(--color-surface-stripe)_14px_28px)]',
  img: 'size-full object-cover',
  imgBroken: 'invisible',
  /** 佔位與失效文字（display 由元件決定：grid 或 hidden） */
  label: 'absolute inset-0 place-items-center p-2 text-center text-sm font-bold tracking-label text-ink-tertiary',
  fallback: 'bg-surface-raised',
};

export const youtubeClasses = {
  figure: 'm-0',
  frame: 'relative aspect-video overflow-hidden rounded-lg border border-line bg-surface-player shadow-card',
  poster: 'h-full',
  posterPosition: 'absolute inset-0',
  posterImg: 'opacity-60',
  start:
    'group absolute inset-0 flex flex-col items-center justify-center gap-3 text-lg font-extrabold no-underline text-ink-primary visited:text-ink-primary bg-radial-[circle_at_center]/srgb from-surface-scrim-faint to-surface-scrim-strong focus-visible:rounded-[inherit] focus-visible:shadow-focus-inset',
  startIcon:
    'grid size-[84px] place-items-center rounded-full bg-brand text-ink-on-brand shadow-play-glow transition-transform duration-(--duration) group-hover:scale-[1.06] group-focus-visible:scale-[1.06]',
  startIconSvg: 'ml-[5px] size-10',
  startLabel: 'rounded-full bg-surface-scrim-soft px-3 py-[0.15rem]',
  iframe: 'absolute inset-0 size-full border-0',
  caption: 'mt-2 text-sm text-ink-tertiary',
  noscript: 'mt-2',
  unavailableFrame:
    'relative grid aspect-video place-items-center overflow-hidden rounded-lg border border-dashed border-state-warning bg-surface-card',
  state: 'max-w-player-state p-6 text-center',
  stateIcon: 'size-10 text-state-warning',
  stateTitle: 'mb-2 text-lg font-extrabold',
};

export const podcastClasses = {
  figure: 'm-0',
  panel:
    'grid gap-4 rounded-lg border border-line-audio bg-linear-135/srgb from-surface-audio from-0% to-surface-card to-58% p-4 shadow-card sm:grid-cols-[168px_minmax(0,1fr)] sm:items-center sm:p-6',
  panelBroken: 'grid gap-4 rounded-lg border border-dashed border-state-warning bg-surface-card p-4 sm:grid-cols-[168px_minmax(0,1fr)] sm:items-center sm:p-6',
  art: 'max-w-[168px] rounded-md',
  body: '',
  eyebrow: 'mb-1 flex items-center gap-[0.35em] text-sm font-extrabold tracking-label text-brand',
  title: 'mb-3 text-xl font-extrabold leading-tight [overflow-wrap:anywhere]',
  audio: 'block min-h-[54px] w-full [color-scheme:dark]',
  meta: 'mt-3 mb-0 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-secondary',
  download: 'inline-flex min-h-8 items-center',
  error: 'mt-2 mb-0 text-state-danger',
  unavailable: 'max-w-player-state pt-3 text-left',
  unavailableTitle: 'mb-2 text-lg font-extrabold',
};

export const errorViewClasses = {
  section: 'mx-auto max-w-state px-4 py-16 text-center',
  code: 'm-0 text-3xl font-extrabold text-brand',
  code503: 'm-0 text-3xl font-extrabold text-state-warning',
  title: '[overflow-wrap:anywhere]',
  message: 'text-lg',
  search: 'mx-auto my-4 flex max-w-state-search flex-wrap justify-center gap-2',
  searchInput:
    'min-h-11 w-full flex-[1_1_14rem] rounded-sm border border-line-strong bg-surface-page px-3 py-2 text-ink-primary',
  button:
    'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface-raised px-4 font-semibold no-underline text-ink-primary visited:text-ink-primary transition-[background,border-color] duration-(--duration) hover:border-ink-secondary',
  buttonPrimary:
    'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm border border-brand bg-brand px-4 font-semibold no-underline text-ink-on-brand visited:text-ink-on-brand transition-[background,border-color] duration-(--duration) hover:bg-brand-strong',
  actions: 'mt-6 flex flex-wrap justify-center gap-2',
  ref: 'text-sm text-ink-tertiary',
};

/** 網站資訊取不到時的內建靜態頁首頁尾。 */
export const staticShellClasses = {
  header: 'sticky top-0 z-50 border-b border-line bg-surface-card',
  headerInner: 'mx-auto flex min-h-16 w-full max-w-site flex-wrap items-center gap-4 px-4 md:px-6',
  brand: 'inline-flex items-center gap-2 text-lg font-extrabold tracking-brand no-underline text-ink-primary visited:text-ink-primary',
  main: 'min-h-[60vh] pt-8 pb-16',
  container: 'mx-auto w-full max-w-site px-4 md:px-6',
  footer: 'border-t border-line py-8 text-sm text-ink-tertiary',
  footerLinks: 'm-0 flex list-none flex-wrap gap-3 p-0',
  footerLink: 'inline-flex min-h-8 items-center text-ink-secondary visited:text-ink-secondary',
};
