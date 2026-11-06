// 受保護（src/pages/**）：標籤。只做接線——取資料函式＋畫面元件（v1 §6.2）。
import { tagProps } from '@/server/pages/taxonomy';
import TaxonomyView from '@/views/TaxonomyView';

export const getServerSideProps = tagProps;
export default TaxonomyView;
