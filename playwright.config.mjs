// 受保護設定檔：假資料 E2E（v1 §6.8 第 8、9 步），對正式建置（npm run build 之後）執行。
// 啟動三個伺服器（埠都由作業系統配給空閒埠，不寫死）：
//   mock：假資料模式（MYSITE_DATA_MODE 未設），大部分測試用
//   fake-api：tests/support/fake-api.mjs，模擬 Laravel 公開 API 的正常與失敗情境
//   live：真資料模式，連 fake-api；測錯誤頁、§4.9 對照表、站內換頁遇到錯誤
import { execFileSync } from 'node:child_process';
import { defineConfig, devices } from '@playwright/test';

function freePort() {
  const script =
    "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close();});";
  return execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim();
}

// 主程序算一次，工作行程繼承環境變數，所以各行程看到同一組埠
process.env.E2E_MOCK_PORT ??= freePort();
process.env.E2E_API_PORT ??= freePort();
process.env.E2E_LIVE_PORT ??= freePort();

const MOCK = `http://localhost:${process.env.E2E_MOCK_PORT}`;
const LIVE = `http://localhost:${process.env.E2E_LIVE_PORT}`;
process.env.E2E_MOCK_BASE = MOCK;
process.env.E2E_LIVE_BASE = LIVE;
process.env.E2E_API_BASE = `http://127.0.0.1:${process.env.E2E_API_PORT}`;

// 測試專用的 API 逾時（不是正式值；正式值依 D13c 裁定）
const TEST_API_TIMEOUT_MS = '1500';
const common = { NEXT_TELEMETRY_DISABLED: '1', DEPLOY_ENVIRONMENT: '' };

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/artifacts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: MOCK,
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    trace: 'off',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: `npx next start -p ${process.env.E2E_MOCK_PORT}`,
      url: `${MOCK}/api/healthz`,
      reuseExistingServer: false,
      env: { ...common, MYSITE_DATA_MODE: '', MYSITE_PUBLIC_ORIGIN: MOCK },
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `node tests/support/fake-api.mjs --port=${process.env.E2E_API_PORT}`,
      url: `http://127.0.0.1:${process.env.E2E_API_PORT}/__log`,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx next start -p ${process.env.E2E_LIVE_PORT}`,
      url: `${LIVE}/api/healthz`,
      reuseExistingServer: false,
      env: {
        ...common,
        MYSITE_DATA_MODE: 'api',
        MYSITE_API_ORIGIN: `http://127.0.0.1:${process.env.E2E_API_PORT}`,
        MYSITE_API_TIMEOUT_MS: TEST_API_TIMEOUT_MS,
        MYSITE_PUBLIC_ORIGIN: 'https://www.example.test',
        MYSITE_SITE_NAME: '內建站名',
      },
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
