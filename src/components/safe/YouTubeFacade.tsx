// 受保護：YouTube 播放（v1 §6.4；掛鉤 youtube_player.*）。比照 Blade components/youtube-player.blade.php 與 app.js。
// - 伺服器只輸出 <a data-youtube-start href="https://www.youtube.com/watch?v=…">、海報與 data-embed-src；不輸出 iframe。
// - 左鍵且沒有修飾鍵的點擊才攔下，建立 youtube-nocookie.com 的 iframe；沒有 JavaScript 時是一般連結。
// - 影片 ID 不合法時顯示失效狀態，不輸出 data-youtube-player 與 data-embed-src。
// 外觀見 src/components/safe-styles.ts。
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { ImageInfo, VideoInfo } from '@/lib/content/types';
import { formatDuration, isoDuration } from '@/lib/format';
import { Icon } from '../Icon';
import { youtubeClasses } from '../safe-styles';
import { ContentImage } from './ContentImage';

const EMBED_PREFIX = 'https://www.youtube-nocookie.com/embed/';
const EMBED_PATTERN = /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?autoplay=1&rel=0$/;
const WATCH_PATTERN = /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/;

export interface YouTubeFacadeProps {
  video: VideoInfo | null;
  title: string;
  poster: ImageInfo | null;
  className?: string;
}

export function YouTubeFacade({ video, title, poster, className = '' }: YouTubeFacadeProps) {
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (playing) iframeRef.current?.focus();
  }, [playing]);

  const embedUrl = video?.embedUrl ?? null;
  const watchUrl = video?.watchUrl ?? null;
  const valid =
    video !== null &&
    video.youtubeId !== null &&
    embedUrl !== null &&
    watchUrl !== null &&
    EMBED_PATTERN.test(embedUrl) &&
    WATCH_PATTERN.test(watchUrl);

  if (!valid) {
    return (
      <figure className={`${youtubeClasses.figure} ${className}`.trim()}>
        <div className={youtubeClasses.unavailableFrame} role="note" data-youtube-unavailable="">
          <div className={youtubeClasses.state}>
            <Icon name="alert" sizeClass={youtubeClasses.stateIcon} />
            <p className={youtubeClasses.stateTitle}>影片目前無法播放</p>
            <p>影片識別碼缺少或格式不正確，因此不嵌入播放器；下方仍可閱讀完整說明。</p>
          </div>
        </div>
      </figure>
    );
  }

  const duration = formatDuration(video.durationSeconds);
  const durationIso = isoDuration(video.durationSeconds);

  const onStart = (event: MouseEvent<HTMLAnchorElement>) => {
    // 保留以新分頁開啟等修飾鍵行為
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!embedUrl.startsWith(EMBED_PREFIX)) return;
    event.preventDefault();
    setPlaying(true);
  };

  return (
    <figure
      className={`${youtubeClasses.figure} ${className}`.trim()}
      data-youtube-player=""
      data-embed-src={embedUrl}
      data-title={title}
    >
      <div className={youtubeClasses.frame}>
        {playing ? (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={`YouTube 影片播放器：${title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className={youtubeClasses.iframe}
          />
        ) : (
          <>
            <ContentImage
              image={poster}
              ratio="auto"
              placeholder=""
              eager
              positionClass={youtubeClasses.posterPosition}
              className={youtubeClasses.poster}
              imgClassName={youtubeClasses.posterImg}
            />
            <a
              className={youtubeClasses.start}
              href={watchUrl}
              data-youtube-start=""
              rel="noopener noreferrer"
              onClick={onStart}
            >
              <span className={youtubeClasses.startIcon} aria-hidden="true">
                <Icon name="play" sizeClass={youtubeClasses.startIconSvg} />
              </span>
              <span className={youtubeClasses.startLabel}>
                播放影片<span className="visually-hidden">：{title}</span>
              </span>
            </a>
          </>
        )}
      </div>
      <figcaption className={youtubeClasses.caption}>
        點擊播放後才會連線到 YouTube（youtube-nocookie.com）並載入播放器。{' '}
        {duration !== null && durationIso !== null ? (
          <>
            片長 <time dateTime={durationIso}>{duration}</time>。{' '}
          </>
        ) : null}
        <a href={watchUrl} rel="noopener noreferrer">
          在 YouTube 開啟
          <Icon name="external" inline />
        </a>
      </figcaption>
      <noscript>
        <p className={youtubeClasses.noscript}>
          瀏覽器未啟用 JavaScript，無法在本頁嵌入播放；請
          <a href={watchUrl} rel="noopener noreferrer">
            在 YouTube 觀看這部影片
          </a>
          。
        </p>
      </noscript>
    </figure>
  );
}
