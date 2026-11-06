// 受保護設定檔：ESLint（v1 §6.6「lint 指令為 eslint .」、§6.8 第 4 步）。
// 把 AI_RULES.md 的硬規則盡量寫成自動檢查：
//   - dangerouslySetInnerHTML 全域禁用，只有 src/components/safe/SafeHtml.tsx 以註解放行一處（FE-03；CI 另計數）
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
    files: ['**/*.{ts,tsx,mjs,js}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS, ...STORAGE_GLOBALS],
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
      'no-restricted-imports': ['error', RESTRICTED_IMPORTS],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  {
    // 取資料的唯一出口可以用 fetch
    files: ['src/server/api-client.ts'],
    rules: {
      'no-restricted-globals': ['error', ...STORAGE_GLOBALS],
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX.filter((r) => !r.selector.includes("'fetch'"))],
    },
  },
  {
    // 測試與 CI 腳本在 Node.js 執行，可以用 fetch 打本機測試伺服器
    files: ['tests/**/*.{ts,tsx,mjs,js}', '*.config.{mjs,ts,js}', 'playwright.config.*'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
