// 受保護：第一個 Tab 停點「跳到主要內容」，焦點落到 #main（v1 §6.4；掛鉤 layout.skip-link）。
// 文字必須完全等於「跳到主要內容」。外觀見 src/components/safe-styles.ts。
import { skipLinkClass } from '../safe-styles';

export function SkipLink() {
  return (
    <a className={skipLinkClass} href="#main" data-skip-link="">
      跳到主要內容
    </a>
  );
}
