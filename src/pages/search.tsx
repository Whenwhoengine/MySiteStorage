// 受保護（src/pages/**）：搜尋。只做接線——取資料函式＋畫面元件（v1 §6.2）。
import { searchProps } from '@/server/pages/search';
import SearchView from '@/views/SearchView';

export const getServerSideProps = searchProps;
export default SearchView;
