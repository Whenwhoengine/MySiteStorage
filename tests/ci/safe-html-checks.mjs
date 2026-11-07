// 受保護（tests/**）：FE-03「SafeHtml 是唯一的 HTML 輸出點」的語法樹檢查，由 tests/ci/static-checks.mjs 對 src/** 逐檔呼叫。
// 依據：定案執行書驗收項 FE-03（dangerouslySetInnerHTML 全專案只能在 src/components/safe/SafeHtml.tsx 出現一次；
//       呼叫端只能傳入 API 的 *_html 欄位，畫面 props 為 contentHtml）；AI_RULES.md 第 3 條。
//
// ── 為什麼用語法樹，而不是只用正規表示式 ──
// static-checks.mjs 原本以正規表示式去掉註解後比對文字；字串裡放 '/*'、'//' 就能讓後面的程式碼被當成註解而躲過比對，
// 改名匯入（import { SafeHtml as Html }）也能躲過 <SafeHtml 的比對。這裡改用 TypeScript 解析器（devDependencies 既有的
// typescript，不新增相依套件）取得語法樹：註解不會變成節點，跳脫寫法（'\u0069nnerHTML'）以解碼後的值比對。
// 原本的正規表示式檢查仍保留在 static-checks.mjs，兩者都要通過。
//
// ── 本檔負責的判定（checkSafeHtmlSource 回傳違規說明陣列，空陣列表示通過）──
// 1. 原始 HTML 輸出點：識別字、私有名稱、字串、樣板字串、正規表示式字面值，只要（大小寫不拘）含 RAW_HTML_FRAGMENTS
//    任一片段就算違規。涵蓋 innerHTML／outerHTML（含 +=、Object.assign、Reflect.set）、insertAdjacentHTML、
//    document.writeln、createContextualFragment、DOMParser、parseFromString、setHTML／setHTMLUnsafe、
//    parseHTML／parseHTMLUnsafe、execCommand('insertHTML')、srcDoc、dangerouslySetInnerHTML（JSX 屬性、物件鍵、
//    計算屬性、字串、'dangerously' + '…' 拆字）、__html。
//    SafeHtml.tsx 本身只允許 dangerouslySetInnerHTML 與 __html 各一次（唯一那一行），其他一樣違規。
// 2. document.write：對看起來是文件物件的值（document、ownerDocument、contentDocument、doc、Document.prototype，
//    含 x!、x as T 包裝）取 write，或從這類值解構出 write。
// 3. SafeHtml 的用法（SafeHtml.tsx 以外）：
//    a. 從 SafeHtml 模組只能寫 import { SafeHtml } from '…'（原名）；預設匯入、命名空間匯入、改名匯入都違規。
//    b. 其他模組不得匯入成 SafeHtml，也不得匯入名為 SafeHtml 的匯出。
//    c. 不得轉匯出 SafeHtml 模組（export … from、export *）。
//    d. 模組路徑（含 safehtml 字樣的字串）只能出現在靜態 import 的來源：import()、require、next/dynamic 都違規。
//    e. 名稱 SafeHtml 只能出現在上述 import 與 JSX 標籤 <SafeHtml>／</SafeHtml>；當成值、轉匯出、另行宣告都違規。
//    f. 每個 <SafeHtml>：不得有 {...展開}；html 屬性恰好一個，值必須是 識別字(.識別字)*.contentHtml
//       （不接受 ?.、[]、呼叫、括號，與原本正規表示式 ^[\w.]*\.contentHtml$ 同等嚴格）。
//    g. 用了 <SafeHtml> 就必須有 a 的匯入（確保標籤指的是真正的 SafeHtml）。
// 4. contentHtml 只能由 src/server/** 從 API 的 content_html 轉出：其他地方不得以物件鍵、類別欄位、指定運算建立或改寫，
//    也不得出現內容恰為 'contentHtml' 的字串（防止 const fake = { contentHtml: '<img onerror=…>' } 冒充 API 欄位）。
//    型別宣告（interface／type 的屬性）與讀取不受影響。
// 5. 解析失敗（語法錯誤）一律判違規：無法保證檢查完整時不放行。
//
// ── 已知限制（靜態檢查無法完全防堵，須靠審查）──
// 執行期才組出的名稱（'inner' + 'HTML'、陣列 join、編碼後解碼）、把 document 指給名稱不像文件物件的變數再呼叫 write。
import path from 'node:path';
import ts from 'typescript';

export const SAFE_HTML_FILE = 'src/components/safe/SafeHtml.tsx';
// 與 eslint.config.mjs 的 RAW_HTML_FRAGMENTS 必須一致（tests/unit/safe-html-checks.test.ts 會比對）
export const RAW_HTML_FRAGMENTS =
  /innerhtml|outerhtml|adjacenthtml|contextualfragment|domparser|parsefromstring|htmlunsafe|sethtml|parsehtml|inserthtml|srcdoc|dangerously|__html|writeln/i;
// SafeHtml.tsx 唯一那一行 dangerouslySetInnerHTML={{ __html: html }} 用到的名稱與允許次數
const SAFE_HTML_FILE_ALLOWANCE = new Map([
  ['dangerouslySetInnerHTML', 1],
  ['__html', 1],
]);
const DOC_LIKE = /doc(ument)?$/i;
const CONTENT_HTML_PRODUCER_PREFIX = 'src/server/';
const SAFE_HTML_IMPORT = "import { SafeHtml } from '@/components/safe/SafeHtml'";

/** 依副檔名決定解析方式（.ts 類不解析 JSX，與 TypeScript 相同）。 */
export function scriptKindOf(file) {
  switch (path.posix.extname(file).toLowerCase()) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

/** 模組路徑的最後一段（去掉副檔名、不分大小寫）是 safehtml，就視為 SafeHtml 模組（@/、相對路徑、其他別名都算）。 */
export function isSafeHtmlModule(specifier) {
  const last = String(specifier).split(/[\\/]/).pop() ?? '';
  return last.replace(/\.[cm]?[jt]sx?$/i, '').toLowerCase() === 'safehtml';
}

const short = (text) => (text.length > 60 ? `${text.slice(0, 57)}…` : text);

/** 去掉 (x)、x!、x as T、x satisfies T、<T>x 這類不改變值的包裝。 */
function unwrap(node) {
  let n = node;
  while (ts.isParenthesizedExpression(n) || ts.isNonNullExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isTypeAssertionExpression(n)) {
    n = n.expression;
  }
  return n;
}

/** 看起來是文件物件：document、window.document、el.ownerDocument、iframe.contentDocument、doc、Document.prototype。 */
function isDocLike(node) {
  const n = unwrap(node);
  if (ts.isIdentifier(n)) return DOC_LIKE.test(n.text);
  if (ts.isPropertyAccessExpression(n)) return DOC_LIKE.test(n.name.text) || (n.name.text === 'prototype' && isDocLike(n.expression));
  if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression)) return DOC_LIKE.test(n.argumentExpression.text);
  return false;
}

/** 屬性名稱的文字（識別字、字串、計算屬性裡的字串）；取不到時回傳 null。 */
function propertyNameText(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(unwrap(name.expression))) return unwrap(name.expression).text;
  return null;
}

/** 識別字(.識別字)*：不含 ?.、[]、呼叫、括號。 */
function isPlainChain(node) {
  if (ts.isIdentifier(node) || node.kind === ts.SyntaxKind.ThisKeyword) return true;
  return ts.isPropertyAccessExpression(node) && !node.questionDotToken && ts.isIdentifier(node.name) && isPlainChain(node.expression);
}

const isContentHtmlAccess = (node) =>
  !!node && ts.isPropertyAccessExpression(node) && !node.questionDotToken && ts.isIdentifier(node.name) && node.name.text === 'contentHtml' && isPlainChain(node.expression);

const isAssignmentOperator = (kind) => kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

/**
 * 檢查一個原始碼檔。
 * @param {string} file 從儲存庫根目錄起算、以 / 分隔的路徑（例如 src/views/EntryView.tsx）
 * @param {string} text 檔案內容
 * @returns {string[]} 違規說明（含「路徑:行號」）；空陣列表示通過
 */
export function checkSafeHtmlSource(file, text) {
  const problems = [];
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindOf(file));
  const loc = (node) => `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
  const report = (node, message) => problems.push(`${loc(node)} ${message}`);

  const diagnostics = sf.parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    const first = diagnostics[0];
    const line = sf.getLineAndCharacterOfPosition(first.start ?? 0).line + 1;
    problems.push(`${file}:${line} 有語法錯誤，無法完整檢查 FE-03（${ts.flattenDiagnosticMessageText(first.messageText, ' ')}）`);
  }

  const isDeclarationFile = file === SAFE_HTML_FILE;
  const mayProduceContentHtml = file.startsWith(CONTENT_HTML_PRODUCER_PREFIX);
  const allowanceUsed = new Map();
  let hasSafeHtmlImport = false;
  const safeHtmlTags = [];

  const checkRawHtmlText = (node, ...texts) => {
    const hit = texts.find((t) => typeof t === 'string' && RAW_HTML_FRAGMENTS.test(t));
    if (hit === undefined) return;
    if (isDeclarationFile && SAFE_HTML_FILE_ALLOWANCE.has(hit)) {
      const used = (allowanceUsed.get(hit) ?? 0) + 1;
      allowanceUsed.set(hit, used);
      if (used <= SAFE_HTML_FILE_ALLOWANCE.get(hit)) return;
      report(node, `「${hit}」超出唯一輸出點的允許次數（${SAFE_HTML_FILE} 只能有一處 dangerouslySetInnerHTML={{ __html: html }}）`);
      return;
    }
    report(node, `出現會把字串當成 HTML 輸出的名稱或字串「${short(hit)}」；只有 ${SAFE_HTML_FILE} 能輸出 HTML，正文一律用 <SafeHtml html={….contentHtml} />`);
  };

  const checkSafeHtmlText = (node, ...texts) => {
    const hit = texts.find((t) => typeof t === 'string' && /safehtml/i.test(t));
    if (hit === undefined || isDeclarationFile) return;
    const parent = node.parent;
    // 靜態 import 的來源可以；轉匯出另由 ExportDeclaration 回報
    if (parent && (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node) return;
    report(node, `SafeHtml 的模組路徑或名稱只能出現在靜態 import（實際：「${short(hit)}」）；不得動態匯入、require 或當成字串使用`);
  };

  const checkContentHtmlString = (node, value) => {
    if (!mayProduceContentHtml && value === 'contentHtml') {
      report(node, "不得出現字串 'contentHtml'；contentHtml 只能由 src/server/** 從 API 的 content_html 轉出");
    }
  };

  const checkImport = (node) => {
    const clause = node.importClause;
    if (!clause || !ts.isStringLiteralLike(node.moduleSpecifier)) return;
    const fromSafeHtml = isSafeHtmlModule(node.moduleSpecifier.text);
    if (fromSafeHtml) {
      if (clause.name) report(clause.name, `SafeHtml 不得以預設匯入（只能 ${SAFE_HTML_IMPORT}）`);
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) report(bindings, `SafeHtml 模組不得以命名空間匯入（只能 ${SAFE_HTML_IMPORT}）`);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const imported = (element.propertyName ?? element.name).text;
          if (imported === 'SafeHtml' && element.name.text === 'SafeHtml') hasSafeHtmlImport = true;
          else report(element, `SafeHtml 只能原名匯入（只能 ${SAFE_HTML_IMPORT}；實際：${short(element.getText(sf))}）`);
        }
      }
      return;
    }
    const names = [];
    if (clause.name) names.push([clause.name, clause.name.text]);
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) names.push([bindings, bindings.name.text]);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        names.push([element, element.name.text]);
        if (element.propertyName) names.push([element, element.propertyName.text]);
      }
    }
    for (const [at, name] of names) {
      if (name === 'SafeHtml') report(at, `名稱 SafeHtml 只能指 ${SAFE_HTML_FILE}（只能 ${SAFE_HTML_IMPORT}；實際來源：${short(node.moduleSpecifier.text)}）`);
    }
  };

  const checkSafeHtmlTag = (node) => {
    safeHtmlTags.push(node);
    let htmlCount = 0;
    for (const attribute of node.attributes.properties) {
      if (ts.isJsxSpreadAttribute(attribute)) {
        report(attribute, '<SafeHtml> 不得使用 {...展開} 傳入屬性；html 只能明寫為 html={….contentHtml}');
        continue;
      }
      if (attribute.name.getText(sf) !== 'html') continue;
      htmlCount += 1;
      const init = attribute.initializer;
      const expression = init && ts.isJsxExpression(init) ? init.expression : undefined;
      if (!isContentHtmlAccess(expression)) {
        report(attribute, `<SafeHtml> 的 html 只能接 API 欄位 contentHtml（寫成 html={item.contentHtml}；實際：${short(init ? init.getText(sf) : '無值')}）`);
      }
    }
    if (htmlCount !== 1) report(node, `<SafeHtml> 必須恰好有一個 html 屬性（實際：${htmlCount} 個）`);
  };

  const checkWrite = (node) => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'write' && isDocLike(node.expression)) {
      report(node, '出現 document.write（或其他文件物件的 write）；不得輸出原始 HTML');
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === 'write' &&
      isDocLike(node.expression)
    ) {
      report(node, '出現 document["write"]（或其他文件物件的 write）；不得輸出原始 HTML');
    }
    // const { write } = document／({ write } = doc)
    const destructures = (pattern, source) => {
      if (!source || !isDocLike(source)) return;
      for (const element of pattern.elements ?? pattern.properties ?? []) {
        const name = ts.isBindingElement(element) ? propertyNameText(element.propertyName ?? element.name) : propertyNameText(element.name);
        if (name === 'write') report(element, '從文件物件解構出 write；不得輸出原始 HTML');
      }
    };
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) destructures(node.name, node.initializer);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isObjectLiteralExpression(unwrap(node.left))) {
      destructures(unwrap(node.left), node.right);
    }
  };

  const checkContentHtmlProduction = (node) => {
    if (mayProduceContentHtml) return;
    const message = 'contentHtml 只能由 src/server/** 從 API 的 content_html 轉出；畫面不得自行建立或改寫';
    if (
      (ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)) &&
      propertyNameText(node.name) === 'contentHtml'
    ) {
      report(node, `${message}（實際：${short(node.getText(sf))}）`);
    }
    if (ts.isBinaryExpression(node) && isAssignmentOperator(node.operatorToken.kind)) {
      const left = unwrap(node.left);
      if (ts.isPropertyAccessExpression(left) && left.name.text === 'contentHtml') report(node, `${message}（實際：${short(node.getText(sf))}）`);
    }
  };

  const visit = (node) => {
    // 1. 原始 HTML 名稱與字串（註解不是節點，不會被檢查）
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) checkRawHtmlText(node, node.text);
    else if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node) || ts.isRegularExpressionLiteral(node)) {
      checkRawHtmlText(node, node.text, node.rawText);
      checkSafeHtmlText(node, node.text, node.rawText);
      checkContentHtmlString(node, node.text);
    }
    // 2. document.write
    checkWrite(node);
    // 3. SafeHtml 的用法
    if (!isDeclarationFile) {
      if (ts.isImportDeclaration(node)) checkImport(node);
      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier) && isSafeHtmlModule(node.moduleSpecifier.text)) {
        report(node, '不得轉匯出 SafeHtml 模組（呼叫端必須直接從 @/components/safe/SafeHtml 匯入）');
      }
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName) && node.tagName.text === 'SafeHtml') {
        checkSafeHtmlTag(node);
      }
      if (ts.isIdentifier(node) && node.text === 'SafeHtml') {
        const parent = node.parent;
        const isTag = (ts.isJsxOpeningElement(parent) || ts.isJsxSelfClosingElement(parent) || ts.isJsxClosingElement(parent)) && parent.tagName === node;
        // import 的各種寫法由 checkImport 判定，這裡不重複回報
        const isImportBinding = ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent);
        if (!isTag && !isImportBinding) report(node, 'SafeHtml 只能寫成 JSX 標籤 <SafeHtml html={….contentHtml} />；不得改名、當成值傳遞、轉匯出或另行宣告同名物件');
      }
    }
    // 4. contentHtml 只由 src/server/** 產生
    checkContentHtmlProduction(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!isDeclarationFile && safeHtmlTags.length > 0 && !hasSafeHtmlImport) {
    report(safeHtmlTags[0], `使用 <SafeHtml> 卻沒有以 ${SAFE_HTML_IMPORT} 匯入`);
  }
  return problems;
}
