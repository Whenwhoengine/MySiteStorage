#!/usr/bin/env node
// 受保護（tests/**）：受保護路徑守門的判定邏輯。
// 依據：mysite docs/MySiteReact前端專案定案執行.md §4.2（三類判定、補強、殘餘風險）、§5.2（守門定案規格 1～9 項）、
//       §7 FE-11（正反案例）；本儲存庫 CLAUDE.md「受保護路徑宣告區塊」；AI_RULES.md「你可以改／你不可以改」。
//
// ── 為什麼現在只有腳本、沒有工作流程 ──
// GitHub 自 2026-12-02 起，對沒有適用事件政策的公開儲存庫預設阻擋 pull_request_target（§5.2 第 7 項、R25）。
// 委託人尚未在本儲存庫建立事件政策（BLK-REACT-POLICY-01），所以先把判定做成可獨立測試的純函式與命令列。
// 日後的守門工作流程只負責：用 GitHub API 讀資料、存檔、呼叫本檔、依結果寫檢查結果與留言。
// 本檔不連網、不讀 git、不執行 PR 的任何內容；工作流程必須從 main 取本檔，不得取 PR 分支的版本。
//
// ── 本檔負責的判定 ──
// 1. classifyPath(path)：回傳 'open'（開放）或 'protected'（受保護）。
//    開放區只有 src/views/**、src/components/**（src/components/safe/** 除外）、src/styles/**、public/design/**，
//    比對區分大小寫；其他一律受保護。為了防止繞過，下列情況即使在開放區內也當受保護：
//    a. 怪路徑：空字串、以斜線開頭或結尾、連續斜線、. 或 .. 路徑段、反斜線、Windows 不允許的字元（< > : " | ? *）、
//       控制字元或看不見的字元（含雙向文字控制字元）、路徑段以句點或空白結尾（Windows 會自動去掉）、
//       Windows 保留的裝置名稱（CON、NUL、COM1 等）。GitHub 正常不會回報這類路徑，出現就一律當受保護。
//    b. src/components/ 下第一層名稱經 NFKC 正規化後不分大小寫等於 safe（例如 Safe/、SAFE/、全形ｓａｆｅ/）：
//       在委託人的 Windows（不分大小寫）上會與 safe/ 撞在一起。src/components/safe-styles.ts 這類名稱仍是開放。
//    c. 以點開頭的檔案或資料夾（.gitattributes、.gitignore、.eslintrc、.claude/ 等工具設定）與工具設定、AI 規則檔名
//       （eslint.config.*、package.json、tsconfig*.json、next／postcss／tailwind／babel／vite／vitest／playwright 的
//       設定檔、AGENTS.md、CLAUDE.md、AI_RULES.md），不分大小寫。理由：ESLint 10 從被檢查檔案所在的資料夾往上找設定檔，
//       子資料夾的 .gitattributes 會改變同一子樹（含 src/components/safe/）取出時的內容，Claude Code 會讀子資料夾的
//       CLAUDE.md；放在開放區一樣會影響受保護的部分。
// 2. parseDeclaration(body)：解析 PR 說明裡的宣告區塊（格式見 CLAUDE.md）。
//    - 沒有任何宣告標記 → null（區塊不存在）。
//    - 否則回傳 { valid, paths, errors }；valid 為 false 時一律判失敗。格式規則：
//      開始標記 <!-- protected-change:begin --> 與結束標記 <!-- protected-change:end --> 各單獨一行、各只能一個、
//      開始在前（標記行前後空白可容許）；看起來像標記但寫法不對的行算格式錯誤；
//      區塊內每行必須是「- 」加上從儲存庫根目錄起算的路徑（「-」後面恰好一個空白），不加引號或反引號，不得重複；
//      行尾空白與空白行可容許；路徑不做任何正規化，比對時逐字相等。
// 3. evaluate({ isFork, headRef, files, body, listComplete })：
//    回傳 { ok, kind, reason, protectedFiles, missing, extra, message, restoreCommands }。
//    - kind：'fork'（他人 fork）、'design'（分支名以 design/ 開頭，不分大小寫，也接受 refs/heads/ 前綴）、
//      'builder'（本儲存庫其他分支，即施工者）、'invalid'（輸入格式不對，無法分類）。
//    - reason：'pass'、'invalid-input'、'list-incomplete'、'fork-protected'、'design-protected'、
//      'declaration-invalid'、'declaration-missing'、'declaration-mismatch'、'declaration-not-empty'。
//    - files 是 GitHub「列出 PR 變更檔」API 的項目（filename、status、previous_filename）。
//      status 為 renamed 時舊路徑與新路徑都檢查（從開放區移出、或從受保護區移入開放區，都算動到受保護路徑），
//      宣告時兩個路徑都要列。copied 的來源檔沒有被修改，只檢查新路徑。
//    - 判定順序：輸入格式不對 → 失敗；listComplete 不是 true → 失敗；之後依三類：
//      fork 改到受保護路徑一律失敗；design 改到受保護路徑一律失敗（宣告區塊不放行）並附還原指令；
//      builder 改到受保護路徑必須有宣告且與實際清單逐一完全相等（多列、少列都失敗），沒改到受保護路徑時不需要宣告，
//      有宣告就必須是空的；宣告區塊格式不對一律失敗。
//    - message 是給委託人看的正體中文 Markdown，可直接當 PR 留言：所有來自 PR 的字串（檔名、宣告內容）只出現在
//      程式碼區塊內（圍欄長度比內容裡最長的連續反引號更長），不會變成 @提及、連結或 HTML。
//
// ── 還原指令（只有 design 分支失敗時產生）──
// 給委託人的本機 Claude Code 在專案資料夾、design/work 分支上，以 Git Bash（POSIX shell）語法依序執行：
//   git fetch origin main
//   修改 modified／變更 changed（權限或型態）／刪除 removed／未變更 unchanged：
//     git --literal-pathspecs checkout "$(git merge-base origin/main HEAD)" -- '<路徑>'
//   新增 added／複製 copied（新路徑在合併基準不存在）：
//     git --literal-pathspecs rm -- '<路徑>'
//   改名 renamed（任一側受保護就整筆復原）：
//     git --literal-pathspecs checkout "$(git merge-base origin/main HEAD)" -- '<舊路徑>'
//     git --literal-pathspecs rm -- '<新路徑>'
// 設計理由：
//   - 以合併基準（main 與目前分支的共同祖先）而不是 origin/main 取回：GitHub 的 PR 差異是以合併基準計算；
//     若 main 之後又改過同一檔、而 design/work 還沒合併最新 main，從 origin/main 取回會讓差異仍在、守門一直失敗。
//     以合併基準取回後，合併時 main 的較新版本仍會保留。design/work 已同步 main 時兩者結果相同。
//   - --literal-pathspecs：Next.js 動態路由檔名含 [ ]（例如 [slug].tsx），git 預設把路徑當萬用字元比對，
//     找不到同名檔時可能誤中其他檔（git rm 尤其危險）。
//   - 新增的檔案用 git rm 而不是 git rm --cached：--cached 會把檔案留在資料夾裡，MyDyad 下次自動存版又會把它提交回去。
//     檔案內容仍保存在 PR 先前的提交裡；檔案在本機另有未提交的修改時 git rm 會拒絕執行，不會默默丟掉。
//   - 路徑一律用單引號包住（內含單引號以 '\'' 跳脫）並放在 -- 之後。怪路徑（見 1a）不產生指令，請交給施工者。
//
// ── 不在本檔範圍（FE-11 中屬工作流程與 GitHub 設定層的案例）──
//   ⑧ 只改 PR 說明 → 重新判定：工作流程觸發加 edited（§5.2 第 1 項）。負責：施工者撰寫守門工作流程。
//   ⑨ 結果對應 PR 最新提交、舊提交的結果不算：工作流程把檢查結果寫在 head 提交上；main 分支保護把守門列為必要檢查、
//      指定預期來源為 GitHub Actions（§5.2 第 6 項）。負責：施工者撰寫工作流程；分支保護由委託人親手設定
//      （或當次明確授權本機 Claude Code 代設），施工者讀回確認（F3 第 3 步）。
//   ⑪ 事件政策讀回正確、Policy insights 沒有守門被阻擋的紀錄：委託人設定（或當次授權本機 Claude Code 代設），
//      施工者讀回確認（F3 第 1 步、§5.2 第 7 項）。
//   另外：②的「無法合併」靠分支保護；③的「守門仍執行」靠 pull_request_target 執行 main 上的定義；
//   ⑥的「出現清單留言」由工作流程以本檔的 message 反覆更新同一則留言（§5.2 第 4 項）。本檔只產生判定與文字。
//
// ── 給日後工作流程的輸入約定 ──
//   - 檔案清單：GET /repos/{owner}/{repo}/pulls/{number}/files 以 per_page=100 分頁讀完，合併成一個陣列存檔
//     （也接受 gh api --paginate --slurp 產生的「陣列的陣列」）。GitHub REST API 文件寫明此 API 最多回 3000 筆；
//     任何一頁失敗、或讀到的筆數與 PR 物件的 changed_files 不同，就加 --incomplete。
//   - fork：head.repo 為 null（fork 已刪除）或 head.repo.full_name 與 base.repo.full_name 不同，就加 --fork。
//   - 分支名、PR 說明、檔名一律經 env: 傳入，不在 run: 裡直接展開 ${{ }}（§5.2 第 5 項）：
//     分支名寫成 --head-ref="$HEAD_REF"（一定用等號與雙引號），PR 說明與檔案清單寫成檔案再傳路徑。
//   - 標準輸出只有 JSON，來自 PR 的字串都在 JSON 字串值裡，不會出現在行首，不會被當成 Actions 的 :: 工作流程指令；
//     工作流程若要另外把 message 印到記錄，須自行處理。
//
// 命令列：node tests/ci/protected-paths.mjs --files=<json檔> --body=<文字檔> --head-ref=<分支> [--fork] [--incomplete]
// exit code（mysite 執行契約）：0 通過；30 未通過；10 參數錯，或輸入檔讀不到、不是 JSON。
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const OPEN = 'open';
export const PROTECTED = 'protected';

/** 開放區（AI_RULES.md「你可以改」）。比對區分大小寫；不在這裡的一律受保護。 */
export const OPEN_PREFIXES = Object.freeze(['src/views/', 'src/components/', 'src/styles/', 'public/design/']);

export const DECLARATION_BEGIN = '<!-- protected-change:begin -->';
export const DECLARATION_END = '<!-- protected-change:end -->';

const KNOWN_STATUSES = new Set(['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged']);
const STATUS_LABELS = {
  added: '新增',
  removed: '刪除',
  modified: '修改',
  changed: '變更（權限或型態）',
  unchanged: '未變更',
  copied: '複製（新路徑）',
};

const RESTORE_BASE = '"$(git merge-base origin/main HEAD)"';
const FETCH_MAIN = 'git fetch origin main';

// ── 路徑分類 ──

const INVISIBLE_OR_CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const WINDOWS_FORBIDDEN = /[<>:"|?*\\]/;
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/i;
const SENSITIVE_NAMES = [
  /^eslint\.config\./i,
  /^(package|package-lock)\.json$/i,
  /^[tj]sconfig(\..*)?\.json$/i,
  /^(next|postcss|tailwind|babel|vite|vitest|playwright)\.config\./i,
  /^(agents|claude|claude\.local|ai_rules)\.md$/i,
];

/** 怪路徑的原因；正常路徑回傳 null。 */
function oddPathReason(filePath) {
  if (typeof filePath !== 'string' || filePath === '') return '路徑是空的';
  if (INVISIBLE_OR_CONTROL.test(filePath)) return '含控制字元或看不見的字元';
  if (WINDOWS_FORBIDDEN.test(filePath)) return '含反斜線或 Windows 不允許的字元';
  if (filePath.startsWith('/')) return '以斜線開頭';
  for (const segment of filePath.split('/')) {
    if (segment === '') return '有空的路徑段（連續斜線或以斜線結尾）';
    if (segment === '.' || segment === '..') return '含 . 或 .. 路徑段';
    if (/[. ]$/.test(segment)) return '路徑段以句點或空白結尾（Windows 會自動去掉）';
    if (WINDOWS_DEVICE.test(segment.split('.')[0])) return '使用 Windows 保留的裝置名稱';
  }
  return null;
}

function isSafeName(name) {
  const normalized = name.normalize('NFKC');
  return normalized.toLowerCase() === 'safe' || normalized.toUpperCase() === 'SAFE';
}

function isSensitiveSegment(segment) {
  return segment.startsWith('.') || SENSITIVE_NAMES.some((re) => re.test(segment));
}

/**
 * 判斷一個路徑屬於開放區或受保護區，並附上原因（給留言用）。
 * @param {string} filePath
 * @returns {{ kind: 'open' | 'protected', reason: string | null }}
 */
export function explainPath(filePath) {
  const odd = oddPathReason(filePath);
  if (odd !== null) return { kind: PROTECTED, reason: `怪路徑：${odd}` };
  const prefix = OPEN_PREFIXES.find((p) => filePath.startsWith(p));
  if (prefix === undefined) return { kind: PROTECTED, reason: null };
  const segments = filePath.split('/');
  if (prefix === 'src/components/' && isSafeName(segments[2])) {
    return { kind: PROTECTED, reason: 'src/components/safe（大小寫或全形寫法不同也算）' };
  }
  if (segments.slice(2).some(isSensitiveSegment)) {
    return { kind: PROTECTED, reason: '工具設定或 AI 規則檔（放在開放區內也受保護）' };
  }
  return { kind: OPEN, reason: null };
}

/**
 * @param {string} filePath 從儲存庫根目錄起算的路徑（GitHub 回報的寫法）
 * @returns {'open' | 'protected'}
 */
export function classifyPath(filePath) {
  return explainPath(filePath).kind;
}

// ── 宣告區塊 ──

/**
 * 解析 PR 說明中的受保護路徑宣告區塊。
 * @param {string | null | undefined} body
 * @returns {{ valid: boolean, paths: string[], errors: string[] } | null} 區塊不存在時回傳 null
 */
export function parseDeclaration(body) {
  if (body === null || body === undefined) return null;
  if (typeof body !== 'string') return { valid: false, paths: [], errors: ['PR 說明不是文字'] };
  const lines = body.split(/\r\n|\r|\n/);
  const begins = [];
  const ends = [];
  const errors = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === DECLARATION_BEGIN) begins.push(index);
    else if (trimmed === DECLARATION_END) ends.push(index);
    else if (/protected-change\s*:\s*(begin|end)/i.test(line)) {
      errors.push(`第 ${index + 1} 行像是宣告標記但寫法不對：標記必須單獨一行，寫成 ${DECLARATION_BEGIN} 或 ${DECLARATION_END}`);
    }
  });
  if (begins.length === 0 && ends.length === 0 && errors.length === 0) return null;
  if (begins.length !== 1 || ends.length !== 1) {
    errors.push(`開始標記與結束標記必須各一個（實際：開始 ${begins.length} 個、結束 ${ends.length} 個）`);
  } else if (begins[0] > ends[0]) {
    errors.push('結束標記出現在開始標記之前');
  }
  if (errors.length > 0) return { valid: false, paths: [], errors };

  const paths = [];
  const seen = new Set();
  for (let index = begins[0] + 1; index < ends[0]; index += 1) {
    const line = lines[index].replace(/[ \t]+$/, '');
    const lineNo = index + 1;
    if (line === '') continue;
    const match = /^- (.*)$/.exec(line);
    if (match === null) {
      errors.push(`第 ${lineNo} 行格式不對：每行必須以「- 」開頭，後面接從儲存庫根目錄起算的路徑`);
      continue;
    }
    const entry = match[1];
    if (entry === '' || /^\s/.test(entry)) {
      errors.push(`第 ${lineNo} 行格式不對：「- 」後面必須直接接路徑（只能有一個空白）`);
      continue;
    }
    if (/^[`'"]|[`'"]$/.test(entry)) {
      errors.push(`第 ${lineNo} 行格式不對：路徑不要加引號或反引號`);
      continue;
    }
    if (seen.has(entry)) {
      errors.push(`第 ${lineNo} 行重複列出同一個路徑`);
      continue;
    }
    seen.add(entry);
    paths.push(entry);
  }
  return { valid: errors.length === 0, paths, errors };
}

// ── 判定 ──

const uniqueSorted = (items) => [...new Set(items)].sort();

function classifyPr(isFork, headRef) {
  if (isFork) return 'fork';
  if (/^(refs\/heads\/)?design\//i.test(headRef)) return 'design';
  return 'builder';
}

function readFiles(files) {
  const errors = [];
  const changes = [];
  if (!Array.isArray(files)) return { changes, errors: ['files（變更檔清單）必須是陣列'] };
  files.forEach((item, index) => {
    const no = index + 1;
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`變更檔清單第 ${no} 筆不是物件`);
      return;
    }
    const { filename, status, previous_filename: previous } = item;
    if (typeof filename !== 'string' || filename === '') {
      errors.push(`變更檔清單第 ${no} 筆缺少 filename`);
      return;
    }
    if (typeof status !== 'string' || !KNOWN_STATUSES.has(status)) {
      errors.push(`變更檔清單第 ${no} 筆的 status 不認得`);
      return;
    }
    if (status === 'renamed' && (typeof previous !== 'string' || previous === '')) {
      errors.push(`變更檔清單第 ${no} 筆是改名，卻缺少 previous_filename`);
      return;
    }
    changes.push({ filename, status, previous: status === 'renamed' ? previous : null });
  });
  return { changes, errors };
}

/** 一筆變更涉及的路徑與標籤（改名時舊、新路徑各一筆）。 */
function touchedPaths(change) {
  if (change.status === 'renamed') {
    return [
      { path: change.previous, label: '改名（舊路徑）' },
      { path: change.filename, label: '改名（新路徑）' },
    ];
  }
  return [{ path: change.filename, label: STATUS_LABELS[change.status] }];
}

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const checkoutCommand = (filePath) => `git --literal-pathspecs checkout ${RESTORE_BASE} -- ${shellQuote(filePath)}`;
const removeCommand = (filePath) => `git --literal-pathspecs rm -- ${shellQuote(filePath)}`;

function buildRestore(changes) {
  const commands = [];
  const manual = [];
  const add = (command) => {
    if (!commands.includes(command)) commands.push(command);
  };
  for (const change of changes) {
    const paths = touchedPaths(change).map((t) => t.path);
    if (!paths.some((p) => classifyPath(p) === PROTECTED)) continue;
    if (paths.some((p) => oddPathReason(p) !== null)) {
      manual.push(...paths);
      continue;
    }
    if (change.status === 'renamed') {
      add(checkoutCommand(change.previous));
      add(removeCommand(change.filename));
    } else if (change.status === 'added' || change.status === 'copied') {
      add(removeCommand(change.filename));
    } else {
      add(checkoutCommand(change.filename));
    }
  }
  return { commands: commands.length > 0 ? [FETCH_MAIN, ...commands] : [], manual: uniqueSorted(manual) };
}

// ── 訊息（Markdown；來自 PR 的字串只放在程式碼區塊內）──

function codeBlock(lines) {
  const text = lines.join('\n');
  const longest = Math.max(0, ...Array.from(text.matchAll(/`+/g), (m) => m[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}text\n${text}\n${fence}`;
}

function listing(entries) {
  return codeBlock(
    entries.map(({ path: p, label }) => {
      const { reason } = explainPath(p);
      return reason === null ? `${label}：${p}` : `${label}：${p}（${reason}）`;
    }),
  );
}

const declarationTemplate = (paths) => codeBlock([DECLARATION_BEGIN, ...paths.map((p) => `- ${p}`), DECLARATION_END]);
const pass = (...parts) => ['### 受保護路徑守門：通過', ...parts].join('\n\n');
const fail = (...parts) => ['### 受保護路徑守門：未通過', ...parts].join('\n\n');
const OPEN_ZONE_TEXT = '開放區只有 src/views/、src/components/（safe/ 除外）、src/styles/、public/design/，其他一律受保護。';

/**
 * 依定案 §4.2 三類判定一個 PR。
 * @param {{ isFork: boolean, headRef: string, files: Array<{ filename: string, status: string, previous_filename?: string | null }>, body: string | null | undefined, listComplete: boolean }} input
 */
export function evaluate(input) {
  const { isFork, headRef, files, body, listComplete } = input ?? {};
  const result = (fields) => ({ protectedFiles: [], missing: [], extra: [], restoreCommands: [], ...fields });

  const inputErrors = [];
  if (typeof isFork !== 'boolean') inputErrors.push('isFork（是否來自 fork）必須是 true 或 false');
  if (typeof headRef !== 'string' || headRef === '') inputErrors.push('headRef（來源分支名）必須是非空字串');
  if (body !== null && body !== undefined && typeof body !== 'string') inputErrors.push('body（PR 說明）必須是文字或 null');
  const kind = inputErrors.length === 0 ? classifyPr(isFork, headRef) : 'invalid';
  const { changes, errors: fileErrors } = readFiles(files);
  inputErrors.push(...fileErrors);
  if (inputErrors.length > 0) {
    return result({
      ok: false,
      kind,
      reason: 'invalid-input',
      message: fail(
        '守門收到的資料不完整或格式不對，為了安全一律判定未通過。這通常是守門工作流程本身的問題，不是設計造成的；請交給施工者。',
        codeBlock(inputErrors),
      ),
    });
  }

  const touched = changes.flatMap(touchedPaths);
  const protectedTouched = touched.filter((t) => classifyPath(t.path) === PROTECTED);
  const protectedFiles = uniqueSorted(protectedTouched.map((t) => t.path));

  if (listComplete !== true) {
    return result({
      ok: false,
      kind,
      reason: 'list-incomplete',
      protectedFiles,
      message: fail(
        '沒有從 GitHub 完整讀到這個 PR 的變更檔清單（分頁沒讀完、筆數對不上，或檔案數超過 GitHub 一次能列出的上限），為了安全一律判定未通過。請重新執行這項檢查；一直失敗就交給施工者。',
      ),
    });
  }

  if (kind === 'fork') {
    if (protectedFiles.length === 0) {
      return result({ ok: true, kind, reason: 'pass', message: pass('這個 PR 來自其他人 fork 的儲存庫，沒有改到受保護路徑。') });
    }
    return result({
      ok: false,
      kind,
      reason: 'fork-protected',
      protectedFiles,
      message: fail(
        `這個 PR 來自其他人 fork 的儲存庫，改到了 ${protectedFiles.length} 個受保護的檔案。來自 fork 的 PR 改到受保護路徑一律不接受，PR 說明裡有宣告也一樣。${OPEN_ZONE_TEXT}`,
        listing(protectedTouched),
      ),
    });
  }

  if (kind === 'design') {
    if (protectedFiles.length === 0) {
      return result({ ok: true, kind, reason: 'pass', message: pass('設計分支只改了開放區的檔案，沒有改到受保護路徑。') });
    }
    const { commands, manual } = buildRestore(changes);
    const parts = [
      '**這個檔案受保護，請交給施工者。**',
      `設計分支（名稱以 design/ 開頭）只能改畫面設計的檔案。${OPEN_ZONE_TEXT}這個 PR 改到了下列 ${protectedFiles.length} 個受保護的檔案：`,
      listing(protectedTouched),
    ];
    if (commands.length > 0) {
      parts.push(
        '**怎麼還原**：把這個 PR 的網址交給本機 Claude Code，請它在 MySiteStorage 專案資料夾、design/work 分支上，用 Git Bash 依序執行下列指令，然後提交並推送（或在 MyDyad 按「同步到 GitHub」）。推送後守門會自動重新判定。',
        codeBlock(commands),
        '「修改／變更／刪除」與改名前的檔案會改回這個分支與 main 最近共同的版本；「新增／複製」與改名後的檔案會從分支移除，內容仍保存在這個 PR 先前的提交裡，需要時請施工者取回。',
      );
    }
    if (manual.length > 0) {
      parts.push('下列檔名含特殊字元，無法安全產生還原指令，請交給施工者處理：', codeBlock(manual));
    }
    if (parseDeclaration(body) !== null) parts.push('設計分支的 PR 說明即使寫了受保護路徑宣告區塊，也不會放行。');
    parts.push('如果真的需要改這些檔案：請停下來，用一段話寫清楚需求，交給施工者處理。');
    return result({ ok: false, kind, reason: 'design-protected', protectedFiles, restoreCommands: commands, message: fail(...parts) });
  }

  // builder：本儲存庫的施工者分支
  const declaration = parseDeclaration(body);
  if (declaration !== null && !declaration.valid) {
    return result({
      ok: false,
      kind,
      reason: 'declaration-invalid',
      protectedFiles,
      message: fail(
        'PR 說明裡的受保護路徑宣告區塊格式不對（格式見 CLAUDE.md「受保護路徑宣告區塊」）：',
        codeBlock(declaration.errors),
        protectedFiles.length > 0 ? '依實際變更，正確的宣告區塊應為：' : '這個 PR 沒有改到受保護路徑，宣告區塊必須是空的或整段刪除：',
        declarationTemplate(protectedFiles),
      ),
    });
  }

  if (protectedFiles.length === 0) {
    if (declaration === null || declaration.paths.length === 0) {
      return result({ ok: true, kind, reason: 'pass', message: pass('這個 PR 沒有改到受保護路徑。') });
    }
    const extra = uniqueSorted(declaration.paths);
    return result({
      ok: false,
      kind,
      reason: 'declaration-not-empty',
      extra,
      message: fail('這個 PR 沒有改到受保護路徑，宣告區塊必須是空的或整段刪除。宣告裡多列了：', codeBlock(extra)),
    });
  }

  if (declaration === null) {
    return result({
      ok: false,
      kind,
      reason: 'declaration-missing',
      protectedFiles,
      missing: protectedFiles,
      message: fail(
        `這個 PR 改到 ${protectedFiles.length} 個受保護的檔案，但 PR 說明裡沒有受保護路徑宣告區塊。施工者分支改到受保護路徑時，必須在 PR 說明逐行列出每一個受保護檔案。實際改到的受保護檔案：`,
        listing(protectedTouched),
        '請把下列區塊貼進 PR 說明（必須與實際清單完全一致）：',
        declarationTemplate(protectedFiles),
      ),
    });
  }

  const declared = new Set(declaration.paths);
  const actual = new Set(protectedFiles);
  const missing = protectedFiles.filter((p) => !declared.has(p));
  const extra = uniqueSorted(declaration.paths.filter((p) => !actual.has(p)));
  if (missing.length > 0 || extra.length > 0) {
    const parts = ['PR 說明的受保護路徑宣告與實際清單不一致（多列、少列都不行；改名時舊路徑與新路徑都要列）。'];
    if (missing.length > 0) parts.push('改到了、但沒有宣告：', codeBlock(missing));
    if (extra.length > 0) parts.push('宣告了、但這個 PR 沒有改到（或不是受保護路徑）：', codeBlock(extra));
    parts.push('依實際變更，正確的宣告區塊應為：', declarationTemplate(protectedFiles));
    return result({ ok: false, kind, reason: 'declaration-mismatch', protectedFiles, missing, extra, message: fail(...parts) });
  }

  return result({
    ok: true,
    kind,
    reason: 'pass',
    protectedFiles,
    message: [
      '### 合併前請核對',
      `受保護路徑守門：通過。這個 PR 改到下列 ${protectedFiles.length} 個受保護的檔案，PR 說明的宣告與實際清單一致。請確認每一項都是你同意施工者修改的，再按合併。`,
      listing(protectedTouched),
    ].join('\n\n'),
  });
}

// ── 命令列 ──

const USAGE = `用法：node tests/ci/protected-paths.mjs --files=<json檔> --body=<文字檔> --head-ref=<分支> [--fork] [--incomplete]
  --files       GitHub「列出 PR 變更檔」API 的結果（JSON 陣列；也接受分頁的陣列的陣列）
  --body        PR 說明的文字檔（說明是空的就給空檔案）
  --head-ref    PR 的來源分支名（工作流程請寫成 --head-ref="$HEAD_REF"，值經 env: 傳入）
  --fork        PR 來自其他人 fork 的儲存庫
  --incomplete  變更檔清單沒有完整讀到（分頁失敗、筆數與 changed_files 不符）
結果以 JSON 印在標準輸出。exit code：0 通過；30 未通過；10 參數錯，或輸入檔讀不到、不是 JSON。`;

const BOM = String.fromCodePoint(0xfeff);
const readText = (file) => {
  const text = readFileSync(file, 'utf8');
  return text.startsWith(BOM) ? text.slice(BOM.length) : text;
};

function main(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        files: { type: 'string' },
        body: { type: 'string' },
        'head-ref': { type: 'string' },
        fork: { type: 'boolean' },
        incomplete: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    process.stderr.write(`參數錯誤：${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
    return 10;
  }
  if (values.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const absent = ['files', 'body', 'head-ref'].filter((key) => typeof values[key] !== 'string' || values[key] === '');
  if (absent.length > 0) {
    process.stderr.write(`參數錯誤：缺少 ${absent.map((key) => `--${key}`).join('、')}\n${USAGE}\n`);
    return 10;
  }
  let files;
  let body;
  try {
    files = JSON.parse(readText(values.files));
  } catch {
    process.stderr.write('參數錯誤：--files 指定的檔案讀不到或不是 JSON\n');
    return 10;
  }
  try {
    body = readText(values.body);
  } catch {
    process.stderr.write('參數錯誤：--body 指定的檔案讀不到\n');
    return 10;
  }
  if (Array.isArray(files) && files.length > 0 && files.every(Array.isArray)) files = files.flat();
  const result = evaluate({
    isFork: values.fork === true,
    headRef: values['head-ref'],
    files,
    body,
    listComplete: values.incomplete !== true,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 30;
}

const invokedDirectly = (() => {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) process.exitCode = main(process.argv.slice(2));
