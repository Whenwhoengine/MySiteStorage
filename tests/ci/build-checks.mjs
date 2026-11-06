#!/usr/bin/env node
// 受保護（tests/**）：正式建置產物檢查（v1 §6.8 第 7 步；定案執行書 M-14；FE-02、FE-09 的 .next 部分）。
// 先執行 npm run build，再執行本檔。用法：node tests/ci/build-checks.mjs（exit 0 全過；20 缺建置產物；30 有失敗）
//   FE-02：除 Next.js 內建錯誤頁外全部動態渲染（沒有預先產生的頁面）
//   FE-09：.next/ 全文沒有假資料哨兵字串、沒有 data-dyad-id／data-dyad-name；standalone 不含 mocks/、public/mock-media/、tests/
//   開發模式提示「目前資料：」不得出現在正式產物
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NEXT = path.join(ROOT, '.next');
const SENTINEL = JSON.parse(readFileSync(path.join(ROOT, 'mocks/manifest.json'), 'utf8')).sentinel;
const failures = [];
const fail = (id, message) => failures.push(`[${id}] ${message}`);

if (!existsSync(path.join(NEXT, 'BUILD_ID'))) {
  console.error('找不到 .next/BUILD_ID：請先執行 npm run build');
  process.exit(20);
}

// ── FE-02 ──
const prerender = JSON.parse(readFileSync(path.join(NEXT, 'prerender-manifest.json'), 'utf8'));
const prerendered = Object.keys(prerender.routes ?? {});
if (prerendered.length > 0) fail('FE-02', `有預先產生的頁面：${prerendered.join('、')}`);
const pagesDir = path.join(NEXT, 'server', 'pages');
const staticHtml = existsSync(pagesDir) ? readdirSync(pagesDir, { recursive: true }).filter((f) => String(f).endsWith('.html')) : [];
if (staticHtml.length > 0) fail('FE-02', `有靜態 HTML 頁面：${staticHtml.join('、')}`);

// ── FE-09（.next 部分）與開發模式提示 ──
const needles = [
  ['FE-09', SENTINEL, '假資料哨兵字串'],
  ['FE-09', 'data-dyad-id', 'data-dyad-id'],
  ['FE-09', 'data-dyad-name', 'data-dyad-name'],
  ['DEV', '目前資料：', '開發模式資料來源提示'],
];
let scanned = 0;
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const relative = path.relative(ROOT, full).split(path.sep).join('/');
    // .next/dev 是 next dev 的輸出（Next.js 16 與正式建置分開），不是正式產物；建置快取 .next/cache 一併掃描
    if (relative === '.next/dev') continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      scan(full);
      continue;
    }
    const buf = readFileSync(full);
    scanned += 1;
    for (const [id, needle, label] of needles) {
      if (buf.includes(Buffer.from(needle, 'utf8'))) fail(id, `${relative} 含${label}`);
    }
  }
}
scan(NEXT);

// ── standalone 不帶假資料與測試 ──
const standalone = path.join(NEXT, 'standalone');
if (existsSync(standalone)) {
  for (const forbidden of ['mocks', 'public/mock-media', 'tests', 'contracts']) {
    if (existsSync(path.join(standalone, forbidden))) fail('FE-09', `.next/standalone/${forbidden} 不得存在`);
  }
} else {
  fail('BUILD', '找不到 .next/standalone（next.config 的 output: standalone）');
}

if (failures.length > 0) {
  console.error(`建置產物檢查失敗（${failures.length} 項）：`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(30);
}
console.log(`建置產物檢查通過：FE-02（無預先產生頁面）、FE-09（掃描 ${scanned} 個檔案，無哨兵字串與 data-dyad-*）、無開發模式提示、standalone 不含假資料`);
