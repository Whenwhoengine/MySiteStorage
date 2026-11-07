// 受保護設定檔：ESLint（v1 §6.6「lint 指令為 eslint .」、§6.8 第 4 步）。
// 把 AI_RULES.md 的硬規則盡量寫成自動檢查：
//   - dangerouslySetInnerHTML 全域禁用，只有 src/components/safe/SafeHtml.tsx 以註解放行一處（FE-03；CI 另計數）
//   - 其他會把字串當成 HTML 輸出的途徑一併禁用（FE-03）：innerHTML、outerHTML、insertAdjacentHTML、document.write／writeln、
//     createContextualFragment、DOMParser、parseFromString、setHTML／setHTMLUnsafe、parseHTML／parseHTMLUnsafe、
//     execCommand('insertHTML')、srcDoc、__html；以名稱、屬性鍵、計算屬性、字串、樣板字串哪一種寫法出現都算
//   - SafeHtml 只能以原名匯入、只寫成 <SafeHtml html={….contentHtml} />，讓 tests/ci/static-checks.mjs 找得到每個呼叫點（FE-03）
//   - fetch、XMLHttpRequest、WebSocket、EventSource、sendBeacon 只允許出現在 src/server/api-client.ts
//   - 不寫 cookie、localStorage、sessionStorage
//   - 不用 next/font/google、next/og、axios、React Router
// ESLint 9 已於 2026-08-06 停止支援，改用 10；eslint-plugin-react 尚未支援 10，所以以核心規則 no-restricted-syntax 取代 react/no-danger。
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const NETWORK_GLOBALS = [
  { name: 'fetch', message: '不呼叫任何網址；資料只經 src/server 取得（AI_RULES 第 2 條）。' },
  { name: 'XMLHttpRequest', message: '不呼叫任何網址（AI_RULES 第 2 條）。' },
  { name: 'WebSocket', message: '不呼叫任何網址（AI_RULES 第 2 條）。' },
  { name: 'EventSource', message: '不呼叫任何網址（AI_RULES 第 2 條）。' },
];

const STORAGE_GLOBALS = [
  { name: 'localStorage', message: '不寫 localStorage（AI_RULES 第 5 條）。' },
  { name: 'sessionStorage', message: '不寫 sessionStorage（AI_RULES 第 5 條）。' },
];

const RESTRICTED_SYNTAX = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: '不使用 dangerouslySetInnerHTML；正文一律用 <SafeHtml html={...} />（AI_RULES 第 3 條）。',
  },
  {
    selector: "Property[key.name='dangerouslySetInnerHTML']",
    message: '不使用 dangerouslySetInnerHTML；正文一律用 <SafeHtml html={...} />（AI_RULES 第 3 條）。',
  },
  {
    selector: "MemberExpression[property.name='cookie']",
    message: '不寫 cookie（AI_RULES 第 5 條）。',
  },
  {
    selector: "MemberExpression[property.name=/^(localStorage|sessionStorage|sendBeacon)$/]",
    message: '不寫瀏覽器儲存、不送出任何請求（AI_RULES 第 2、5 條）。',
  },
  {
    selector: "MemberExpression[property.name='fetch']",
    message: '不呼叫任何網址；資料只經 src/server 取得（AI_RULES 第 2 條）。',
  },
];

// ── FE-03：原始 HTML 輸出點 ──
// 名稱或字串（大小寫不拘）含下列任一片段，就視為原始 HTML 輸出點。
// 與 tests/ci/safe-html-checks.mjs 的 RAW_HTML_FRAGMENTS 必須一致（tests/unit/safe-html-checks.test.ts 會比對）。
const RAW_HTML_FRAGMENTS =
  'innerhtml|outerhtml|adjacenthtml|contextualfragment|domparser|parsefromstring|htmlunsafe|sethtml|parsehtml|inserthtml|srcdoc|dangerously|__html|writeln';
const RAW_HTML_MESSAGE =
  '不使用會把字串當成 HTML 輸出的 API（innerHTML、outerHTML、insertAdjacentHTML、document.write、createContextualFragment、DOMParser、setHTMLUnsafe、parseHTMLUnsafe、srcDoc、dangerouslySetInnerHTML 等）；正文一律用 <SafeHtml html={….contentHtml} />（FE-03、AI_RULES 第 3 條）。';
// 看起來是文件物件的名稱：document、ownerDocument、contentDocument、doc 等
const DOC_LIKE = '/doc(ument)?$/i';
// 同上但排除 document 本身（document.write 由 no-restricted-properties 負責，避免同一處報兩次）
const DOC_LIKE_EXCEPT_DOCUMENT = '/^(?!document$).*doc(ument)?$/i';

const RAW_HTML_SYNTAX = [
  // x.innerHTML、x.outerHTML += …、{ innerHTML: … }、new DOMParser()、el.insertAdjacentHTML(…)、Document.parseHTMLUnsafe(…)、
  // range.createContextualFragment(…)、document.writeln(…)、{ __html: … } 等。
  // 物件鍵 dangerouslySetInnerHTML 已由上面的 Property 規則回報，這裡排除以免重複。
  {
    selector: `Identifier[name=/${RAW_HTML_FRAGMENTS}/i]:not(Property[key.name='dangerouslySetInnerHTML'] > Identifier.key)`,
    message: RAW_HTML_MESSAGE,
  },
  // JSX 屬性 srcDoc／srcdoc、innerHTML 等（JSX 屬性 dangerouslySetInnerHTML 已由上面的 JSXAttribute 規則回報）
  {
    selector: `JSXIdentifier[name=/${RAW_HTML_FRAGMENTS}/i]:not(JSXAttribute[name.name='dangerouslySetInnerHTML'] > JSXIdentifier)`,
    message: RAW_HTML_MESSAGE,
  },
  // 字串寫法：x['innerHTML']、{ ['dangerouslySetInnerHTML']: … }、{ 'srcDoc': … }、execCommand('insertHTML')、
  // setAttribute('srcdoc', …)、Reflect.set(el, 'innerHTML', …)；跳脫寫法（'\u0069nnerHTML'）以解碼後的值比對
  { selector: `Literal[value=/${RAW_HTML_FRAGMENTS}/i]`, message: RAW_HTML_MESSAGE },
  { selector: `TemplateElement:matches([value.raw=/${RAW_HTML_FRAGMENTS}/i], [value.cooked=/${RAW_HTML_FRAGMENTS}/i])`, message: RAW_HTML_MESSAGE },
  // document 以外的文件物件：window.document.write、el.ownerDocument.write、iframe.contentDocument['write']、doc.write、
  // Document.prototype.write；TypeScript 的 x!、x as T、x satisfies T 包一層也算（object.expression）
  {
    selector: `MemberExpression:matches([computed=false][property.name='write'], [property.value='write']):matches([object.name=${DOC_LIKE_EXCEPT_DOCUMENT}], [object.property.name=${DOC_LIKE}], [object.property.value=${DOC_LIKE}], [object.property.name='prototype'][object.object.name=${DOC_LIKE}], [object.expression.name=${DOC_LIKE}], [object.expression.property.name=${DOC_LIKE}], [object.expression.property.value=${DOC_LIKE}])`,
    message: RAW_HTML_MESSAGE,
  },
  // 解構：const { write } = window.document、({ write } = doc)
  {
    selector: `:matches(VariableDeclarator:matches([init.name=${DOC_LIKE_EXCEPT_DOCUMENT}], [init.property.name=${DOC_LIKE}], [init.expression.name=${DOC_LIKE}], [init.expression.property.name=${DOC_LIKE}]) > ObjectPattern, AssignmentExpression:matches([right.name=${DOC_LIKE_EXCEPT_DOCUMENT}], [right.property.name=${DOC_LIKE}], [right.expression.name=${DOC_LIKE}], [right.expression.property.name=${DOC_LIKE}]) > ObjectPattern) > Property:matches([key.name='write'], [key.value='write'])`,
    message: RAW_HTML_MESSAGE,
  },
];

const RESTRICTED_PROPERTIES = [
  // document.write、document['write']、const { write } = document
  { object: 'document', property: 'write', message: RAW_HTML_MESSAGE },
];

// ── FE-03：SafeHtml 的用法 ──
// static-checks 以原名 SafeHtml 找出每個呼叫點並檢查 html 只接 contentHtml，所以不得改名、轉匯出或當成值傳遞。
// 本組規則不套用在 src/components/safe/SafeHtml.tsx（宣告處）。
const SAFE_HTML_MODULE = '/(^|\\/)safehtml(\\.[cm]?[jt]sx?)?$/i';
const SAFE_HTML_USAGE_MESSAGE =
  "SafeHtml 只能以 import { SafeHtml } from '@/components/safe/SafeHtml' 原名匯入，並只寫成 <SafeHtml html={….contentHtml} />；不得改名、預設或命名空間匯入、動態匯入、轉匯出、當成值傳遞或另行宣告同名物件（FE-03）。";
const SAFE_HTML_PROPS_MESSAGE =
  '<SafeHtml> 的 html 只能接 API 欄位 contentHtml（寫成 html={item.contentHtml}），也不得用 {...展開} 傳入屬性（FE-03）。';

const SAFE_HTML_USAGE_SYNTAX = [
  // 名稱 SafeHtml 在 import 以外不得以一般識別字出現（JSX 標籤 <SafeHtml> 是 JSXIdentifier，不受影響）：
  // const Html = SafeHtml、export { SafeHtml }、export default SafeHtml、createElement(SafeHtml, …)、SafeHtml({ … })、
  // mod.SafeHtml、function SafeHtml() {}、import SafeHtml from …、import * as SafeHtml from …
  { selector: "Identifier[name='SafeHtml']:not(ImportSpecifier > Identifier)", message: SAFE_HTML_USAGE_MESSAGE },
  // 從 SafeHtml 模組只能匯入 { SafeHtml } 原名：import { SafeHtml as Html }、import Html from、import * as NS from 都不行
  {
    selector: `ImportDeclaration[source.value=${SAFE_HTML_MODULE}] > :matches(ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier:not([imported.name='SafeHtml'][local.name='SafeHtml']))`,
    message: SAFE_HTML_USAGE_MESSAGE,
  },
  // 其他模組不得匯出或匯入成 SafeHtml：import { X as SafeHtml } from …、import { SafeHtml as Y } from './other'
  {
    selector: `ImportDeclaration:not([source.value=${SAFE_HTML_MODULE}]) > ImportSpecifier:matches([local.name='SafeHtml'], [imported.name='SafeHtml'], [imported.value='SafeHtml'])`,
    message: SAFE_HTML_USAGE_MESSAGE,
  },
  // 模組路徑只能出現在靜態 import 的來源：import('…/SafeHtml')、require、next/dynamic、export … from '…/SafeHtml' 都不行
  { selector: "Literal[value=/safehtml/i]:not(ImportDeclaration > Literal.source)", message: SAFE_HTML_USAGE_MESSAGE },
  { selector: 'TemplateElement:matches([value.raw=/safehtml/i], [value.cooked=/safehtml/i])', message: SAFE_HTML_USAGE_MESSAGE },
  { selector: ":matches(JSXMemberExpression, JSXNamespacedName) > JSXIdentifier[name='SafeHtml']", message: SAFE_HTML_USAGE_MESSAGE },
  { selector: "JSXOpeningElement[name.name='SafeHtml'] > JSXSpreadAttribute", message: SAFE_HTML_PROPS_MESSAGE },
  {
    selector:
      "JSXOpeningElement[name.name='SafeHtml'] > JSXAttribute[name.name='html']:not([value.type='JSXExpressionContainer'][value.expression.type='MemberExpression'][value.expression.computed=false][value.expression.optional=false][value.expression.property.name='contentHtml'][value.expression.object.type=/^(Identifier|MemberExpression|ThisExpression)$/])",
    message: SAFE_HTML_PROPS_MESSAGE,
  },
];

const ALL_RESTRICTED_SYNTAX = [...RESTRICTED_SYNTAX, ...RAW_HTML_SYNTAX, ...SAFE_HTML_USAGE_SYNTAX];

const RESTRICTED_IMPORTS = {
  paths: [
    { name: 'next/font/google', message: '不載入外部字型（v1 §6.1）。' },
    { name: 'next/og', message: '禁用功能（v1 §6.1）。' },
    { name: 'next/image', message: '圖片最佳化關閉，內容圖用 <ContentImage>（v1 §6.1）。' },
    { name: 'axios', message: '不呼叫任何網址（AI_RULES 第 2 條）。' },
    { name: 'react-router', message: '不使用 React Router（AI_RULES 技術）。' },
    { name: 'react-router-dom', message: '不使用 React Router（AI_RULES 技術）。' },
  ],
  patterns: [{ group: ['@radix-ui/*', '@/components/ui/*'], message: '不使用 shadcn/ui（AI_RULES 技術）。' }],
};

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'mocks/**',
      'public/**',
      'contracts/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
      'src/lib/content/api-contract.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 涵蓋所有可被 Next.js 或 Node.js 載入的 JS／TS 副檔名（.mts、.cts、.jsx、.cjs 也不能繞過下列規則）
    files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...STORAGE_GLOBALS],
      'no-restricted-syntax': ['error', ...ALL_RESTRICTED_SYNTAX],
      'no-restricted-properties': ['error', ...RESTRICTED_PROPERTIES],
      'no-restricted-imports': ['error', RESTRICTED_IMPORTS],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  {
    // 取資料的唯一出口可以用 fetch
    files: ['src/server/api-client.ts'],
    rules: {
      'no-restricted-globals': ['error', ...STORAGE_GLOBALS],
      'no-restricted-syntax': ['error', ...ALL_RESTRICTED_SYNTAX.filter((r) => !r.selector.includes("'fetch'"))],
    },
  },
  {
    // SafeHtml 的宣告處：不套用「SafeHtml 用法」規則；原始 HTML 規則照常套用，唯一的輸出點以行內註解放行（FE-03）
    files: ['src/components/safe/SafeHtml.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX, ...RAW_HTML_SYNTAX],
    },
  },
  {
    // 設計區（開放區）不得以 eslint-disable 等行內註解關掉規則：行內設定一律不生效，被關掉的違規照樣報錯。
    // 受保護區的行內放行（SafeHtml 的唯一輸出點等）由施工者負責，不受影響。
    files: ['src/views/**', 'src/components/**', 'src/styles/**', 'public/design/**'],
    ignores: ['src/components/safe/**'],
    linterOptions: { noInlineConfig: true },
  },
  {
    // .mjs 腳本在 Node.js 執行（TypeScript 檔由型別檢查負責未定義名稱）
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
      },
    },
  },
  {
    // E2E 的 page.evaluate 回呼在瀏覽器裡執行
    files: ['tests/e2e/**/*.mjs'],
    languageOptions: {
      globals: { window: 'readonly', document: 'readonly', getComputedStyle: 'readonly' },
    },
  },
  {
    // 測試與 CI 腳本在 Node.js 執行，可以用 fetch 打本機測試伺服器
    // （tests/** 不在 FE-03 範圍：E2E 的 page.evaluate 可能要直接操作 DOM；FE-03 的檢查對象是 src/** 的正式程式碼）
    files: ['tests/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', '*.config.{mjs,mts,cjs,cts,ts,js}', 'playwright.config.*'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-properties': 'off',
    },
  },
);
