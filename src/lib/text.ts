// 受保護（src/lib/**）：文字處理小工具。

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

/** PHP mb_strimwidth($text, 0, $width, '…') 的對應：全形字寬 2，超過時截斷並加「…」（「…」算寬 1）。 */
export function strimWidth(text: string, width: number): string {
  const chars = [...text];
  const w = (c: string) => (WIDE.test(c) ? 2 : 1);
  const total = chars.reduce((sum, c) => sum + w(c), 0);
  if (total <= width) return text;
  let out = '';
  let used = 0;
  for (const c of chars) {
    if (used + w(c) > width - 1) break;
    out += c;
    used += w(c);
  }
  return `${out}…`;
}

/** Str::limit($text, $limit, '…') 的對應：超過字數時截斷並加「…」。 */
export function limitChars(text: string, limit: number): string {
  const chars = [...text];
  return chars.length <= limit ? text : `${chars.slice(0, limit).join('').trimEnd()}…`;
}

/** 搜尋字詞正規化：連續空白合併為一個、去頭尾空白（比照 PublicContentInput::search）。 */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/gu, ' ').trim();
}
