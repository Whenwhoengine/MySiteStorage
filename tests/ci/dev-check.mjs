#!/usr/bin/env node
// 受保護（tests/**）：開發模式實測（v1 F3 第 4 步元件標記器實測；定案執行書 M-11③ 零啟動自改寫封條 FE-19）。
// 先執行 npm run build，再執行本檔。用法：node tests/ci/dev-check.mjs（exit 0 全過；30 有失敗）
//   1. 正式建置之後，工作樹零變動（git status --porcelain 為空）
//   2. 以 npm run dev（next dev --webpack -H localhost，比照 MyDyad 在後面接 --port）短暫啟動到就緒，打幾頁：
//      - 畫面元素帶 data-dyad-id（MyDyad 元件標記器在 webpack 開發模式可用）
//      - 開發模式顯示「目前資料：示例資料」
//      - 只綁本機迴路位址：用本機的非迴路 IPv4 位址連不上
//   3. 停止後，工作樹仍零變動
import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const failures = [];
const fail = (id, message) => failures.push(`[${id}] ${message}`);
const porcelain = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' }).trim();

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

const before = porcelain();
if (before !== '') fail('FE-19', `正式建置後工作樹有變動：\n${before}`);

const port = await freePort();
const child = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
  cwd: ROOT,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', MYSITE_DATA_MODE: '', DEPLOY_ENVIRONMENT: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
let output = '';
child.stdout.on('data', (d) => (output += d));
child.stderr.on('data', (d) => (output += d));

const base = `http://localhost:${port}`;
const started = Date.now();
let ready = false;
// 等候上限：首次編譯需要時間；這是測試等候，不是產品設定值
while (Date.now() - started < 180_000) {
  try {
    const res = await fetch(`${base}/api/healthz`);
    if (res.ok) {
      ready = true;
      break;
    }
  } catch {
    // 尚未就緒
  }
  await new Promise((r) => setTimeout(r, 1000));
}

try {
  if (!ready) {
    fail('DEV', `next dev 未就緒：\n${output.slice(-2000)}`);
  } else {
    if (!/https?:\/\/localhost:\d+/.test(output)) fail('DEV', 'next dev 輸出沒有 http://localhost:<埠>（MyDyad 靠它啟動預覽代理）');
    const home = await (await fetch(`${base}/`)).text();
    if (!home.includes('data-dyad-id=')) fail('TAGGER', '開發模式的畫面沒有 data-dyad-id（元件標記器沒有作用）');
    if (!home.includes('目前資料：示例資料')) fail('DEV', '開發模式沒有顯示「目前資料：示例資料」');
    const article = await fetch(`${base}/articles/sample-gutenberg-blocks`);
    if (article.status !== 200) fail('DEV', `開發模式文章頁回 ${article.status}`);
    const external = Object.values(os.networkInterfaces())
      .flat()
      .find((i) => i && i.family === 'IPv4' && !i.internal);
    if (external && (await canConnect(external.address, port))) {
      fail('DEV', `next dev 可以從 ${external.address} 連線（必須只綁本機迴路位址）`);
    }
  }
} finally {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // 已結束
  }
  await new Promise((r) => setTimeout(r, 2000));
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // 已結束
  }
}

const after = porcelain();
if (after !== '') fail('FE-19', `短暫啟動 next dev 後工作樹有變動：\n${after}`);

if (failures.length > 0) {
  console.error(`開發模式實測失敗（${failures.length} 項）：`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(30);
}
console.log('開發模式實測通過：元件標記器作用（data-dyad-id）、資料來源提示、只綁本機迴路位址、建置與 next dev 之後工作樹零變動（FE-19）');
