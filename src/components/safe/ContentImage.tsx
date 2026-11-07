// 受保護：內容圖片（v1 §6.4；掛鉤 content_image.*）。比照 Blade components/image.blade.php 與 app.js。
// - 比例固定（避免版面跳動）；寬高由 API 提供；預設 loading="lazy"。
// - 沒有圖片時顯示佔位文字；載入失敗（含 hydrate 前就已失敗）時外框加 data-media-broken，隱藏破圖並顯示「圖片無法載入」。
// 外觀見 src/components/safe-styles.ts。
import { useEffect, useRef, useState } from 'react';
import type { ImageInfo } from '@/lib/content/types';
import { imageClasses } from '../safe-styles';

export interface ContentImageProps {
  image: ImageInfo | null;
  /** wide＝16:9、square＝1:1、auto＝不固定（由外層決定高度） */
  ratio?: 'wide' | 'square' | 'auto';
  /** 沒有圖片時的佔位文字；空字串時佔位對輔助科技隱藏。 */
  placeholder?: string;
  /** 首屏的圖片設 true（loading="eager"）。 */
  eager?: boolean;
  /** 定位方式；預設 relative。疊在其他元素上時傳 'absolute inset-0'。 */
  positionClass?: string;
  className?: string;
  imgClassName?: string;
}

export function ContentImage({
  image,
  ratio = 'wide',
  placeholder = '尚無封面',
  eager = false,
  positionClass = 'relative',
  className = '',
  imgClassName = '',
}: ContentImageProps) {
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // hydrate 之前就已載入失敗的圖片（error 事件已錯過）
    const img = imgRef.current;
    if (img !== null && img.complete && img.naturalWidth === 0 && img.getAttribute('src')) setBroken(true);
  }, []);

  const frame = [positionClass, imageClasses.frame, imageClasses[ratio], image === null ? imageClasses.empty : imageClasses.filled, className]
    .filter(Boolean)
    .join(' ');

  if (image === null) {
    return (
      <div className={frame} data-media-frame="">
        <span className={`grid ${imageClasses.label}`} aria-hidden={placeholder === '' ? true : undefined}>
          {placeholder}
        </span>
      </div>
    );
  }

  return (
    <div className={frame} data-media-frame="" {...(broken ? { 'data-media-broken': '' } : {})}>
      {/* 圖片最佳化關閉，內容圖一律一般 <img>（v1 §6.1） */}
      <img
        ref={imgRef}
        src={image.url}
        alt={image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        data-media-img=""
        className={[imageClasses.img, broken ? imageClasses.imgBroken : '', imgClassName].filter(Boolean).join(' ')}
        onError={() => setBroken(true)}
      />
      <span
        className={`${broken ? 'grid' : 'hidden'} ${imageClasses.label} ${imageClasses.fallback}`}
        aria-hidden="true"
      >
        圖片無法載入
      </span>
    </div>
  );
}
