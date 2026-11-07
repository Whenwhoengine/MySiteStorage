// 開放區：內容型別標示（.type-chip）。可以是純文字或連到列表頁。
import { SiteLink } from '@/components/safe/SiteLink';
import type { ContentType } from '@/lib/content/types';
import { TYPE_LABEL } from '@/lib/paths';
import { Icon } from './Icon';
import { typeChipColor } from './ui';

const base = 'inline-flex items-center gap-[0.3em] text-xs font-bold tracking-chip no-underline';

export function TypeChip({ type, href }: { type: ContentType; href?: string }) {
  const className = `${base} ${typeChipColor[type]}`;
  const content = (
    <>
      <Icon name={type} />
      {TYPE_LABEL[type]}
    </>
  );
  return href === undefined ? (
    <span className={className}>{content}</span>
  ) : (
    <SiteLink className={`${className} hover:underline`} href={href}>
      {content}
    </SiteLink>
  );
}
