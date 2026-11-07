// 受保護：Podcast 播放（v1 §6.4、定案 M-09；掛鉤 audio_player.*）。比照 Blade components/audio-player.blade.php 與 app.js。
// - 伺服器輸出的 HTML 就帶 <audio controls preload="none"> 與 <source src>（或 <audio src>），不延到瀏覽器端才設定。
// - 片長是播放器內第一個 <time>；下載連結與音訊來源完全相同。
// - 音訊或 <source> 載入失敗（error 事件不冒泡，以捕獲階段監聽）時顯示 [data-audio-error]，下載連結與簡介保留。
// - 音訊來源缺少或不在允許清單時（audioUrl 為 null）不輸出 <audio>，顯示失效說明。
// 外觀見 src/components/safe-styles.ts。
import { useEffect, useRef, useState } from 'react';
import type { ImageInfo, PodcastInfo } from '@/lib/content/types';
import { formatDuration, formatDurationSpoken, isoDuration } from '@/lib/format';
import { Icon } from '../Icon';
import { podcastClasses } from '../safe-styles';
import { ContentImage } from './ContentImage';

const MIME_LABEL: Record<string, string> = {
  'audio/mpeg': 'MP3',
  'audio/mp3': 'MP3',
  'audio/mp4': 'AAC／M4A',
  'audio/x-m4a': 'AAC／M4A',
  'audio/aac': 'AAC／M4A',
  'audio/ogg': 'Ogg',
  'audio/opus': 'Ogg',
  'audio/wav': 'WAV',
  'audio/x-wav': 'WAV',
  'audio/wave': 'WAV',
  'audio/webm': 'WebM',
  'audio/flac': 'FLAC',
};

export interface PodcastPlayerProps {
  podcast: PodcastInfo | null;
  title: string;
  cover: ImageInfo | null;
  className?: string;
}

export function PodcastPlayer({ podcast, title, cover, className = '' }: PodcastPlayerProps) {
  const [broken, setBroken] = useState(false);
  const figureRef = useRef<HTMLElement>(null);
  const src = podcast?.audioUrl ?? null;
  const mime = podcast?.audioMime ?? null;

  useEffect(() => {
    const figure = figureRef.current;
    if (figure === null || src === null) return;
    const onError = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLAudioElement || target instanceof HTMLSourceElement) setBroken(true);
    };
    figure.addEventListener('error', onError, true);
    // hydrate 之前就已失敗
    const audio = figure.querySelector('audio');
    if (audio?.error) setBroken(true);
    return () => figure.removeEventListener('error', onError, true);
  }, [src]);

  const duration = formatDuration(podcast?.durationSeconds);
  const durationSpoken = formatDurationSpoken(podcast?.durationSeconds);
  const durationIso = isoDuration(podcast?.durationSeconds);
  const mimeLabel = mime === null ? undefined : MIME_LABEL[mime];

  return (
    <figure ref={figureRef} className={`${podcastClasses.figure} ${className}`.trim()} data-audio-player="">
      <div className={src === null || broken ? podcastClasses.panelBroken : podcastClasses.panel}>
        <ContentImage image={cover} ratio="square" placeholder="Podcast" eager className={podcastClasses.art} />
        <div className={podcastClasses.body}>
          <p className={podcastClasses.eyebrow}>
            <Icon name="podcast" />
            Podcast
          </p>
          <p className={podcastClasses.title}>{title}</p>
          {src !== null ? (
            <>
              <audio
                className={podcastClasses.audio}
                controls
                preload="none"
                aria-label={`收聽：${title}`}
                src={mime === null ? src : undefined}
              >
                {mime !== null ? <source src={src} type={mime} /> : null}
                <p>
                  您的瀏覽器不支援內嵌音訊播放，請
                  <a href={src} download>
                    下載音訊檔
                  </a>
                  收聽。
                </p>
              </audio>
              <p className={podcastClasses.meta}>
                {duration !== null && durationIso !== null ? (
                  <span>
                    片長{' '}
                    <time dateTime={durationIso} data-audio-duration="">
                      <span aria-hidden="true">{duration}</span>
                      <span className="visually-hidden">{durationSpoken}</span>
                    </time>
                  </span>
                ) : null}
                <a className={podcastClasses.download} href={src} download data-audio-download="">
                  <Icon name="download" inline />
                  下載音訊{mimeLabel !== undefined ? `（${mimeLabel}）` : ''}
                </a>
              </p>
              <p className={podcastClasses.error} data-audio-error="" hidden={!broken}>
                這個音訊目前無法播放。您可以改用上方的下載連結，或閱讀下方的節目簡介。
              </p>
            </>
          ) : (
            <div className={podcastClasses.unavailable} role="note" data-audio-unavailable="">
              <p className={podcastClasses.unavailableTitle}>音訊目前無法播放</p>
              <p>音訊來源缺少或不在允許清單內，因此不提供播放；下方保留完整節目簡介。</p>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}
