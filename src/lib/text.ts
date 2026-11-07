// 受保護（src/lib/**）：文字處理小工具。凡是「比照 PHP／Laravel」的函式，結果必須與 mysite（PHP 8.5.12）逐字相同。

// PHP 8.5 mbstring 的字寬表：mb_strwidth 只有寬 1 與寬 2 兩種，寬 2 的是 Unicode East Asian Width 為 W、F 的碼位
// （php-src ext/mbstring/libmbfl/mbfl/eaw_table.h）。下列區間（起、迄成對，共 123 段）是在 php:8.5.12 映像
// （infra/versions.env 的 PHP_FPM_IMAGE_REF）對 U+0000～U+10FFFF 逐一呼叫 mb_strwidth(mb_chr($cp)) 實測列出；
// 其餘碼位（含組合字元、零寬字元、代理碼位）一律寬 1，與 PHP 相同。PHP 升級時要重新實測並更新。
const WIDE_RANGES: readonly number[] = [
  0x1100, 0x115f, 0x231a, 0x231b, 0x2329, 0x232a, 0x23e9, 0x23ec, 0x23f0, 0x23f0, 0x23f3, 0x23f3,
  0x25fd, 0x25fe, 0x2614, 0x2615, 0x2630, 0x2637, 0x2648, 0x2653, 0x267f, 0x267f, 0x268a, 0x268f,
  0x2693, 0x2693, 0x26a1, 0x26a1, 0x26aa, 0x26ab, 0x26bd, 0x26be, 0x26c4, 0x26c5, 0x26ce, 0x26ce,
  0x26d4, 0x26d4, 0x26ea, 0x26ea, 0x26f2, 0x26f3, 0x26f5, 0x26f5, 0x26fa, 0x26fa, 0x26fd, 0x26fd,
  0x2705, 0x2705, 0x270a, 0x270b, 0x2728, 0x2728, 0x274c, 0x274c, 0x274e, 0x274e, 0x2753, 0x2755,
  0x2757, 0x2757, 0x2795, 0x2797, 0x27b0, 0x27b0, 0x27bf, 0x27bf, 0x2b1b, 0x2b1c, 0x2b50, 0x2b50,
  0x2b55, 0x2b55, 0x2e80, 0x2e99, 0x2e9b, 0x2ef3, 0x2f00, 0x2fd5, 0x2ff0, 0x303e, 0x3041, 0x3096,
  0x3099, 0x30ff, 0x3105, 0x312f, 0x3131, 0x318e, 0x3190, 0x31e5, 0x31ef, 0x321e, 0x3220, 0x3247,
  0x3250, 0xa48c, 0xa490, 0xa4c6, 0xa960, 0xa97c, 0xac00, 0xd7a3, 0xf900, 0xfaff, 0xfe10, 0xfe19,
  0xfe30, 0xfe52, 0xfe54, 0xfe66, 0xfe68, 0xfe6b, 0xff01, 0xff60, 0xffe0, 0xffe6, 0x16fe0, 0x16fe4,
  0x16ff0, 0x16ff6, 0x17000, 0x18cd5, 0x18cff, 0x18d1e, 0x18d80, 0x18df2, 0x1aff0, 0x1aff3, 0x1aff5, 0x1affb,
  0x1affd, 0x1affe, 0x1b000, 0x1b122, 0x1b132, 0x1b132, 0x1b150, 0x1b152, 0x1b155, 0x1b155, 0x1b164, 0x1b167,
  0x1b170, 0x1b2fb, 0x1d300, 0x1d356, 0x1d360, 0x1d376, 0x1f004, 0x1f004, 0x1f0cf, 0x1f0cf, 0x1f18e, 0x1f18e,
  0x1f191, 0x1f19a, 0x1f200, 0x1f202, 0x1f210, 0x1f23b, 0x1f240, 0x1f248, 0x1f250, 0x1f251, 0x1f260, 0x1f265,
  0x1f300, 0x1f320, 0x1f32d, 0x1f335, 0x1f337, 0x1f37c, 0x1f37e, 0x1f393, 0x1f3a0, 0x1f3ca, 0x1f3cf, 0x1f3d3,
  0x1f3e0, 0x1f3f0, 0x1f3f4, 0x1f3f4, 0x1f3f8, 0x1f43e, 0x1f440, 0x1f440, 0x1f442, 0x1f4fc, 0x1f4ff, 0x1f53d,
  0x1f54b, 0x1f54e, 0x1f550, 0x1f567, 0x1f57a, 0x1f57a, 0x1f595, 0x1f596, 0x1f5a4, 0x1f5a4, 0x1f5fb, 0x1f64f,
  0x1f680, 0x1f6c5, 0x1f6cc, 0x1f6cc, 0x1f6d0, 0x1f6d2, 0x1f6d5, 0x1f6d8, 0x1f6dc, 0x1f6df, 0x1f6eb, 0x1f6ec,
  0x1f6f4, 0x1f6fc, 0x1f7e0, 0x1f7eb, 0x1f7f0, 0x1f7f0, 0x1f90c, 0x1f93a, 0x1f93c, 0x1f945, 0x1f947, 0x1f9ff,
  0x1fa70, 0x1fa7c, 0x1fa80, 0x1fa8a, 0x1fa8e, 0x1fac6, 0x1fac8, 0x1fac8, 0x1facd, 0x1fadc, 0x1fadf, 0x1faea,
  0x1faef, 0x1faf8, 0x20000, 0x2fffd, 0x30000, 0x3fffd,
];

/** 單一碼位在 PHP mb_strwidth 的寬度（1 或 2）。 */
export function charWidth(codePoint: number): 1 | 2 {
  let lo = 0;
  let hi = WIDE_RANGES.length / 2 - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (codePoint < WIDE_RANGES[mid * 2]!) hi = mid - 1;
    else if (codePoint > WIDE_RANGES[mid * 2 + 1]!) lo = mid + 1;
    else return 2;
  }
  return 1;
}

function widthOf(char: string): 1 | 2 {
  return charWidth(char.codePointAt(0) ?? 0);
}

/** PHP mb_strwidth($text, 'UTF-8')。 */
export function strWidth(text: string): number {
  let total = 0;
  for (const c of text) total += widthOf(c);
  return total;
}

/**
 * PHP mb_strimwidth($text, 0, $width, $marker, 'UTF-8')（PHP 8.5 語意，width ≥ 0）：
 * 整段寬度不超過 width 時原樣回傳；否則取「寬度不超過 width − 標記寬度」的最長開頭再接上標記；
 * width 不大於標記寬度時只回傳標記。
 */
export function strimWidth(text: string, width: number, marker = '…'): string {
  if (strWidth(text) <= width) return text;
  const markerWidth = strWidth(marker);
  if (width <= markerWidth) return marker;
  const budget = width - markerWidth;
  let out = '';
  let used = 0;
  for (const c of text) {
    const w = widthOf(c);
    if (used + w > budget) break;
    out += c;
    used += w;
  }
  return `${out}${marker}`;
}

/** PHP rtrim($text)（不帶第二參數）：只去掉結尾的半形空白、\t、\n、\r、\0、\x0B，全形空白等其他空白一律保留。 */
export function phpRtrim(text: string): string {
  // eslint-disable-next-line no-control-regex -- 刻意比對 PHP trim 預設字元中的 \x0B
  return text.replace(/[ \t\n\r\0\x0B]+$/, '');
}

/**
 * Laravel Str::limit($text, $limit, $end)（不保留整字）：以字寬計（mb_strwidth，全形寬 2），
 * 寬度不超過 limit 時原樣回傳；否則 rtrim(mb_strimwidth($text, 0, $limit, '')) 後接 end（end 不計入 limit）。
 * 出處：mysite app/vendor/laravel/framework/src/Illuminate/Support/Str.php limit()。
 */
export function strLimit(text: string, limit: number, end = '...'): string {
  if (strWidth(text) <= limit) return text;
  return `${phpRtrim(strimWidth(text, limit, ''))}${end}`;
}

/**
 * 麵包屑標題：比照 content/show.blade.php 的 Str::limit($item->title, 40, '…')。
 * 名稱沿用既有呼叫端（src/views/EntryView.tsx）；計算以字寬為準，不是字數。
 */
export function limitChars(text: string, limit: number): string {
  return strLimit(text, limit, '…');
}

/** 搜尋字詞正規化：連續空白合併為一個、去頭尾空白（比照 PublicContentInput::search）。 */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/gu, ' ').trim();
}

// C 語言 isspace（"C" 語系）：空白、\t、\n、\v、\f、\r
const C_SPACE = /^[ \t\n\v\f\r]$/;

function isCaseChar(char: string | undefined, lower: string): boolean {
  return char === lower || char === lower.toUpperCase();
}

/**
 * PHP strip_tags($html)（不帶允許標籤）的逐字移植：php-src ext/standard/string.c 的 php_strip_tags_ex 狀態機
 * （0 一般文字、1 標籤內、2 <? 處理指令、3 <! 宣告、4 <!-- 註解）。所有判斷字元都是 ASCII，
 * 以 UTF-16 單位逐一處理與 PHP 以位元組處理結果相同。
 */
export function stripTags(html: string): string {
  let out = '';
  let state = 0;
  let depth = 0;
  let inQ = '';
  let lc = '';
  let br = 0;
  let isXml = false;
  for (let p = 0; p < html.length; p++) {
    const c = html[p]!;
    const prev = (n: number) => (p >= n ? html[p - n] : undefined);
    if (state === 0) {
      if (c === '\0') continue;
      if (c === '<') {
        if (inQ !== '') continue;
        if (C_SPACE.test(html[p + 1] ?? '')) {
          out += c;
          continue;
        }
        lc = '<';
        state = 1;
        continue;
      }
      if (c === '>') {
        if (depth > 0) depth--;
        else if (inQ === '') out += c;
        continue;
      }
      out += c;
    } else if (state === 1) {
      if (c === '<') {
        if (inQ === '' && !C_SPACE.test(html[p + 1] ?? '')) depth++;
      } else if (c === '>') {
        if (depth > 0) depth--;
        else if (inQ === '') {
          lc = '>';
          if (!(isXml && prev(1) === '-')) {
            inQ = '';
            state = 0;
            isXml = false;
          }
        }
      } else if (c === '"' || c === "'") {
        if (p !== 0 && (inQ === '' || c === inQ)) inQ = inQ === '' ? c : '';
      } else if (c === '!') {
        if (prev(1) === '<') {
          state = 3;
          lc = c;
        }
      } else if (c === '?') {
        if (prev(1) === '<') {
          br = 0;
          state = 2;
        }
      }
    } else if (state === 2) {
      if (c === '(') {
        if (lc !== '"' && lc !== "'") {
          lc = '(';
          br++;
        }
      } else if (c === ')') {
        if (lc !== '"' && lc !== "'") {
          lc = ')';
          br--;
        }
      } else if (c === '>') {
        if (depth > 0) depth--;
        else if (inQ === '' && br === 0 && lc !== '"' && prev(1) === '?') {
          inQ = '';
          state = 0;
        }
      } else if (c === '"' || c === "'") {
        if (p >= 1 && prev(1) !== '\\') {
          if (lc === c) lc = '';
          else if (lc !== '\\') lc = c;
          if (inQ === '' || c === inQ) inQ = inQ === '' ? c : '';
        }
      } else if (c === 'l' || c === 'L') {
        // <?xml 不是 PHP 程式碼，回到標籤狀態
        if (p > 4 && isCaseChar(prev(1), 'm') && isCaseChar(prev(2), 'x') && prev(3) === '?' && prev(4) === '<') {
          state = 1;
          isXml = true;
        }
      }
    } else if (state === 3) {
      if (c === '>') {
        if (depth > 0) depth--;
        else if (inQ === '') state = 0;
      } else if (c === '"' || c === "'") {
        if (p !== 0 && prev(1) !== '\\' && (inQ === '' || c === inQ)) inQ = inQ === '' ? c : '';
      } else if (c === '-') {
        if (prev(1) === '-' && prev(2) === '!') state = 4;
      } else if (c === 'e' || c === 'E') {
        // <!DOCTYPE 當成一般標籤
        if (
          p > 6 &&
          isCaseChar(prev(1), 'p') &&
          isCaseChar(prev(2), 'y') &&
          isCaseChar(prev(3), 't') &&
          isCaseChar(prev(4), 'c') &&
          isCaseChar(prev(5), 'o') &&
          isCaseChar(prev(6), 'd')
        ) {
          state = 1;
        }
      }
    } else if (c === '>' && inQ === '' && prev(1) === '-' && prev(2) === '-') {
      // 狀態 4（註解）：遇到 --> 才結束
      state = 0;
    }
  }
  return out;
}

/**
 * 正文是否為空：比照 SafeContent::isEmpty（mysite app/app/Support/Html/SafeContent.php）——
 * trim(strip_tags($html)) === '' 且原文不含 "<img"。trim 只去半形空白類（同 phpRtrim），不去 &nbsp; 或全形空白。
 */
export function isEmptyHtml(html: string): boolean {
  // eslint-disable-next-line no-control-regex -- 刻意比對 PHP trim 預設字元中的 \x0B
  return /^[ \t\n\r\0\x0B]*$/.test(stripTags(html)) && !html.includes('<img');
}
