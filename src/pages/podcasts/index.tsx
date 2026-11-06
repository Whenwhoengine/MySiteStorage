// 受保護（src/pages/**）：Podcast 列表。只做接線——取資料函式＋畫面元件（v1 §6.2）。
import { podcastsProps } from '@/server/pages/collection';
import CollectionView from '@/views/CollectionView';

export const getServerSideProps = podcastsProps;
export default CollectionView;
