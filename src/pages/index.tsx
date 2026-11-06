// 受保護（src/pages/**）：首頁。只做接線——取資料函式＋畫面元件（v1 §6.2）。
import { homeProps } from '@/server/pages/home';
import HomeView from '@/views/HomeView';

export const getServerSideProps = homeProps;
export default HomeView;
