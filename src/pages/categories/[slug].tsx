// 受保護（src/pages/**）：分類。只做接線——取資料函式＋畫面元件（v1 §6.2）。
import { categoryProps } from '@/server/pages/taxonomy';
import TaxonomyView from '@/views/TaxonomyView';

export const getServerSideProps = categoryProps;
export default TaxonomyView;
