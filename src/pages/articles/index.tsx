// 受保護（src/pages/**）：文章列表。只做接線——取資料函式＋畫面元件（v1 §6.2）。
import { articlesProps } from '@/server/pages/collection';
import CollectionView from '@/views/CollectionView';

export const getServerSideProps = articlesProps;
export default CollectionView;
