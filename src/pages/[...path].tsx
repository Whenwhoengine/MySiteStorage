// 受保護（src/pages/**）：根層萬用路由——不存在的路徑一律 404（完整版面；段數過深時用內建靜態頁首頁尾）。
// Next.js 的路由優先序是「固定路徑 > 動態 > 萬用」，不會蓋掉其他頁（v1 §4.3 第 4 步）。
import { catchAllProps } from '@/server/pages/catch-all';

export const getServerSideProps = catchAllProps;

export default function NotFound() {
  // 畫面由 _app 依 pageProps.error 畫 ErrorView
  return null;
}
