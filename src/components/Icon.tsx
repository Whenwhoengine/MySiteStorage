// 開放區：內嵌 SVG 圖示（不載入外部圖示字型）；裝飾用，對輔助科技隱藏。圖形比照 Blade components/icon.blade.php。

export type IconName =
  | 'play'
  | 'video'
  | 'podcast'
  | 'post'
  | 'page'
  | 'search'
  | 'menu'
  | 'rss'
  | 'arrow'
  | 'external'
  | 'download'
  | 'alert';

function Paths({ name }: { name: IconName }) {
  switch (name) {
    case 'play':
    case 'video':
      return <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />;
    case 'podcast':
      return (
        <>
          <path d="M12 3a5 5 0 0 0-5 5v4a5 5 0 0 0 10 0V8a5 5 0 0 0-5-5z" />
          <path d="M5 11v1a7 7 0 0 0 14 0v-1" />
          <path d="M12 19v2" />
        </>
      );
    case 'post':
    case 'page':
      return (
        <>
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5" />
          <path d="M10 13h6M10 17h6" />
        </>
      );
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2" />
        </>
      );
    case 'menu':
      return <path d="M4 7h16M4 12h16M4 17h16" />;
    case 'rss':
      return (
        <>
          <path d="M5 5a14 14 0 0 1 14 14" />
          <path d="M5 11a8 8 0 0 1 8 8" />
          <circle cx="6" cy="18" r="1.5" fill="currentColor" />
        </>
      );
    case 'arrow':
      return <path d="M5 12h14M13 6l6 6-6 6" />;
    case 'external':
      return (
        <>
          <path d="M14 4h6v6" />
          <path d="M20 4 10 14" />
          <path d="M19 14v6H4V5h6" />
        </>
      );
    case 'download':
      return (
        <>
          <path d="M12 4v11" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 20h14" />
        </>
      );
    case 'alert':
      return (
        <>
          <path d="M12 4 2.5 20h19z" />
          <path d="M12 10v4" />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" />
        </>
      );
  }
}

/**
 * 一般圖示：1.15em 見方；inline 版本 0.95em 並在左邊留一點間距（比照 .icon、.icon--inline）。
 * Tailwind 的基礎樣式把 svg 設成 block，這裡固定為 inline-block，才能跟文字排在同一行。
 */
export function Icon({
  name,
  inline = false,
  className = '',
  sizeClass,
}: {
  name: IconName;
  inline?: boolean;
  className?: string;
  /** 取代預設尺寸的工具類（例如 size-10）；不給時用預設尺寸。 */
  sizeClass?: string;
}) {
  const size = sizeClass ?? (inline ? 'ml-[0.3em] size-[0.95em]' : 'size-[1.15em]');
  return (
    <svg
      className={`inline-block ${size} flex-none align-[-0.18em] ${className}`.trim()}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Paths name={name} />
    </svg>
  );
}
