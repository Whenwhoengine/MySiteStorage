#!/usr/bin/env node
// 受保護（tests/**）：原始碼的靜態檢查（v1 §6.8 第 3、5、11 步；定案執行書 M-07、M-14；FE-03、FE-04）。
// 用法：node tests/ci/static-checks.mjs（exit 0 全過；30 有失敗）
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSafeHtmlSource } from './safe-html-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'test-results', 'playwright-report', 'coverage', '.dyad', '.mydyad']);
const failures = [];
const fail = (id, message) => failures.push(`[${id}] ${message}`);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const all = walk(ROOT).map(rel);
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
/** 去掉註解（說明文字裡提到禁用功能的名稱不算違規）；保留 https:// 這類網址。 */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const readCode = (file) => stripComments(read(file));
// eslint.config.mjs 列出禁用名稱是為了禁止它們，不掃描
// 涵蓋 .ts、.tsx、.mts、.cts、.js、.jsx、.mjs、.cjs（.mts／.cts 原本漏掉，可用來繞過檢查）
const code = all.filter(
  (f) => /\.[cm]?[jt]sx?$/.test(f) && !f.startsWith('tests/') && !f.startsWith('mocks/') && !f.startsWith('contracts/') && f !== 'eslint.config.mjs',
);
const srcCode = code.filter((f) => f.startsWith('src/'));

// ── FE-04 禁用功能 ──
for (const dir of ['app', 'src/app']) if (existsSync(path.join(ROOT, dir))) fail('FE-04', `不得有 ${dir}/ 目錄（只用 Pages Router）`);
for (const f of all) {
  const base = path.posix.basename(f);
  if (/^(proxy|middleware)\.(t|j)sx?$|^(proxy|middleware)\.m?js$/.test(base) && (f === base || f === `src/${base}`)) fail('FE-04', `不得有 ${f}`);
  if (/^tailwind\.config\./.test(base)) fail('FE-04', `不得有 ${f}（Tailwind v4 用 CSS 設定）`);
}
const forbiddenPatterns = [
  [/['"]next\/og['"]/, 'next/og'],
  [/['"]use server['"]/, "'use server'（Server Actions）"],
  [/['"]use cache['"]/, "'use cache'"],
  [/cacheComponents/, 'cacheComponents'],
  [/runtime\s*[:=]\s*['"](experimental-)?edge['"]/, 'Edge 執行環境'],
  [/next\/font\/google/, 'next/font/google'],
  [/\bshallow\b/, 'shallow 路由'],
];
for (const f of code) {
  const text = readCode(f);
  for (const [re, label] of forbiddenPatterns) if (re.test(text)) fail('FE-04', `${f} 出現 ${label}`);
}
if (/\brewrites\b|\bredirects\b/.test(read('next.config.mjs'))) fail('FE-04', 'next.config.mjs 不得設定 rewrites／redirects');
const apiRoutes = all.filter((f) => f.startsWith('src/pages/api/'));
for (const f of apiRoutes) if (f !== 'src/pages/api/healthz.ts') fail('FE-04', `src/pages/api/ 只允許健康檢查：${f}`);
for (const f of all.filter((x) => x.endsWith('.css'))) {
  if (/@tailwind\s+(base|components|utilities)/.test(read(f))) fail('FE-04', `${f} 使用 v3 的 @tailwind 指令`);
}
const globals = existsSync(path.join(ROOT, 'src/styles/globals.css')) ? read('src/styles/globals.css') : '';
if (globals.split(/\r?\n/, 1)[0] !== '@import "tailwindcss";') fail('FE-04', 'src/styles/globals.css 第一行必須是 @import "tailwindcss";');
if (!existsSync(path.join(ROOT, 'postcss.config.mjs')) || !/'@tailwindcss\/postcss'/.test(read('postcss.config.mjs'))) {
  fail('FE-04', 'postcss.config.mjs 必須只載入 @tailwindcss/postcss');
}

// ── FE-03 SafeHtml 唯一 ──
const dangerous = srcCode.filter((f) => /dangerouslySetInnerHTML/.test(readCode(f)));
const dangerousCount = srcCode.reduce((n, f) => n + (readCode(f).match(/dangerouslySetInnerHTML\s*=/g) ?? []).length, 0);
if (dangerous.length !== 1 || dangerous[0] !== 'src/components/safe/SafeHtml.tsx' || dangerousCount !== 1) {
  fail('FE-03', `dangerouslySetInnerHTML 只能在 src/components/safe/SafeHtml.tsx 出現一處（實際：${dangerous.join('、') || '無'}，${dangerousCount} 處）`);
}
// 呼叫端只傳入 API 的 *_html 欄位（畫面 props 為 contentHtml）
for (const f of srcCode) {
  for (const m of readCode(f).matchAll(/<SafeHtml\b([^>]*)\/?>/g)) {
    const attr = /html=\{([^}]+)\}/.exec(m[1]);
    if (!attr || !/^[\w.]*\.contentHtml$/.test(attr[1].trim())) fail('FE-03', `${f}：<SafeHtml> 只能接 contentHtml（實際：${attr ? attr[1] : '無 html 屬性'}）`);
  }
}
// 語法樹檢查（上面的文字比對仍保留）：其他原始 HTML 輸出點（innerHTML、outerHTML、insertAdjacentHTML、document.write、
// createContextualFragment、DOMParser、setHTMLUnsafe、srcDoc 等）、SafeHtml 改名／轉匯出／當成值、html 只接 contentHtml、
// contentHtml 只由 src/server/** 產生。規則細節見 tests/ci/safe-html-checks.mjs。
for (const f of srcCode) for (const problem of checkSafeHtmlSource(f, read(f))) fail('FE-03', problem);

// ── 網路與儲存（AI_RULES 第 2、5 條；ESLint 之外再查一次） ──
for (const f of srcCode) {
  const text = readCode(f);
  if (f !== 'src/server/api-client.ts' && /\bfetch\s*\(/.test(text)) fail('RULE-2', `${f} 出現 fetch（只允許 src/server/api-client.ts）`);
  if (/XMLHttpRequest|new\s+WebSocket|EventSource|sendBeacon|\baxios\b/.test(text)) fail('RULE-2', `${f} 出現網路請求 API`);
  if (/document\.cookie|localStorage|sessionStorage/.test(text)) fail('RULE-5', `${f} 寫 cookie 或瀏覽器儲存`);
  if (/data-dyad-(id|name)/.test(text)) fail('FE-09', `${f} 不得寫死 data-dyad-*`);
  for (const m of text.matchAll(/['"`](https?:\/\/[^'"`\s]*)/g)) {
    const url = m[1];
    const allowed = ['https://www.youtube.com/watch', 'https://www.youtube-nocookie.com/embed/', 'http://localhost', 'http://mock.invalid'];
    if (!allowed.some((a) => url.startsWith(a))) fail('RULE-2', `${f} 出現外部網址 ${url}（只允許 YouTube 播放相關）`);
  }
}

// ── AGENTS.md 與 AI_RULES.md 一致（v1 §6.8 第 11 步） ──
if (!existsSync(path.join(ROOT, 'AI_RULES.md')) || !existsSync(path.join(ROOT, 'AGENTS.md'))) fail('RULES', '缺 AI_RULES.md 或 AGENTS.md');
else if (read('AI_RULES.md') !== read('AGENTS.md')) fail('RULES', 'AGENTS.md 與 AI_RULES.md 內容不一致');

// ── 契約副本雜湊（v1 §6.8 第 5 步） ──
const source = JSON.parse(read('contracts/SOURCE.json'));
for (const { path: file, sha256: hash } of source.files) {
  const actual = createHash('sha256').update(readFileSync(path.join(ROOT, file))).digest('hex');
  if (actual !== hash) fail('CONTRACT', `${file} 與 contracts/SOURCE.json 記錄的雜湊不同`);
}

if (failures.length > 0) {
  console.error(`靜態檢查失敗（${failures.length} 項）：`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(30);
}
console.log(`靜態檢查通過：FE-03、FE-04、AI_RULES 第 2／5 條、AGENTS.md 一致、契約副本雜湊（檢查 ${all.length} 個檔案）`);
