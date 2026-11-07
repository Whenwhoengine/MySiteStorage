// 受保護（src/pages/**）：影片。只做接線——取資料函式＋畫面元件（v1 §6.2）。
import { videoProps } from '@/server/pages/entry';
import EntryView from '@/views/EntryView';

export const getServerSideProps = videoProps;
export default EntryView;
