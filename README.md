# MySiteStorage

MySite 公開網站的前端：Next.js Pages Router（伺服器渲染，不是單頁應用）、React、TypeScript、Tailwind CSS v4。
內容由 mysite 的 Laravel 公開唯讀 API 提供；設計預覽時用 `mocks/` 的示例資料。

> 這份說明給人看。給 AI 的規則在 `AI_RULES.md`（與 `AGENTS.md` 內容相同）；施工者須知在 `CLAUDE.md`。

## 狀態卡

```text
[ ] 1. 設計已存　　　design/work 提交：尚未執行（骨架 PR 合併、守門啟用後才開始設計）
[ ] 2. 設計已合併　　MySiteStorage main 的 PR：尚未執行
[ ] 3. 整合已驗證　　mysite 鎖定提交的 PR 與四個矩陣組合 CI：尚未執行（F6）
[ ] 4. staging 已確認　外部 HTTPS 與影音實測：尚未執行
[ ] 5. 正式已發布　　release 序號與外部冒煙測試：尚未執行
```

「前端 PR 已合併」只到第 2 格，不代表正式站已更新。

## 施工依據

mysite 儲存庫 `docs/` 內三份文件，衝突時依序為準：
1. `MySiteReact前端專案定案執行.md`
2. `MySiteReact前端專案v2.md`（委託人 D1～D17 裁定）
3. `MySiteReact前端專案v1.md`（完整正文）

## 誰可以改哪裡

| 區域 | 誰改 |
|---|---|
| `src/views/`、`src/components/`（`safe/` 除外）、`src/styles/`、`public/design/` | 設計（MyDyad）可以改 |
| 其他全部（頁面接線、資料層、受保護元件、契約、假資料、測試、設定檔、鎖定檔、規則文件） | 只有施工者能改；設計分支改到會被 CI 攔下 |

受保護元件的外觀集中在 `src/components/safe-styles.ts`（開放區），設計可以直接改那裡的工具類。

## 用 MyDyad 設計（委託人）

完整步驟見 mysite `docs/MySiteReact前端專案v1.md` §8 與定案執行書 §9。重點：

1. 第一次（F4，本機 Claude Code 陪同）：匯入這個資料夾時**取消勾選「複製到 dyad-apps 資料夾」**，安裝命令與啟動命令都留空；GitHub 面板連到本儲存庫、分支選 `design/work`。
2. 每次設計：開 MyDyadOne → 開 MyDyad → 選這個 app → 先按一次「同步到 GitHub」→ 用對話描述要改什麼（也可以用「選取元件」點畫面上的元素）。
3. 預覽左下角會顯示「目前資料：示例資料」，只在預覽出現，正式網站不會有。
4. 滿意後按「同步到 GitHub」。**畫面出現「強制推送」「安全強制推送」「變基並同步」「中止變基」「繼續變基」時一律不要按**，交給本機 Claude Code。
5. 到 GitHub 按「Compare & pull request」→「Create pull request」，等 CI。綠燈才按「Merge pull request」，合併後不要按「Delete branch」。
6. 收工一律關閉 MyDyad（只切換 app，預覽還會在背景跑）。

### 常見紅燈

| 紅燈說明 | 怎麼辦 |
|---|---|
| 這個檔案受保護 | 把 PR 網址交給本機 Claude Code，照 CI 留言附的還原指令處理 |
| 鎖定檔不一致 | 交施工者在 Linux 重新產生 |
| 型別檢查、ESLint 或建置失敗 | 把錯誤貼回 MyDyad 請它修，或交施工者 |
| 水平溢位、無障礙問題 | 看 CI 截圖，請 MyDyad 修那個寬度 |
| 缺少測試掛鉤 | 改版時刪掉了 `data-*` 屬性，請 MyDyad 補回 |
| 禁用功能 | 出現 App Router、外部字型、外部網址、`tailwind.config.*` 等，請 MyDyad 移除 |

## MyDyad 元件標記器（F3 實測結果）

`@dyad-sh/nextjs-webpack-component-tagger` 0.8.0 在 Next.js 16.4.5 的 webpack 開發模式**可用**：開發模式的畫面元素帶 `data-dyad-id`，
所以 `dev`、`build` 都用 webpack（`--webpack`），MyDyad 可以用「選取元件」。正式建置不含 `data-dyad-id`（CI 檢查）。
實測方式：`node tests/ci/dev-check.mjs`。

## 資料模式與環境變數

| 變數 | 說明 |
|---|---|
| `MYSITE_DATA_MODE` | 未設或 `mock`：讀 `mocks/` 示例資料（MyDyad 預覽、前端 CI）。`api`：呼叫 Laravel 公開 API |
| `MYSITE_API_ORIGIN` | `api` 模式必填：API 的來源（只能是協定＋主機＋埠） |
| `MYSITE_API_TIMEOUT_MS` | `api` 模式必填：每次呼叫 API 的逾時（毫秒）。正式值 `50000`（D13c 已定值，算式見 mysite `docs/MySiteReact施工紀錄/D13c逾時試算.md` 第 9 節），由部署設定傳入；程式不給預設值 |
| `MYSITE_PUBLIC_ORIGIN` | 主站公開網址，組 canonical 與 `og:url`；`api` 模式必填 |
| `MYSITE_SITE_NAME` | 網站資訊取不到時的內建站名（預設 `mysite`） |
| `DEPLOY_ENVIRONMENT` | `staging`／`production` 時必須是 `api` 模式，否則啟動即失敗 |

本專案不需要任何秘密；`.env`、`.env.*` 一律不進 Git。用 staging 真資料預覽的方法見定案執行書 §9.4。

## 指令

| 指令 | 用途 |
|---|---|
| `npm ci` | 依鎖定檔安裝（CI） |
| `npm run dev` | 開發預覽：`next dev --webpack -H localhost`（只綁本機迴路位址；任何情況都不得移除 `-H localhost`） |
| `npm run build` | 正式建置（webpack） |
| `npm run lint`、`npm run typecheck`、`npm test` | ESLint、型別檢查（先 `next typegen`）、快速單元測試 |
| `npm run check:static` | 禁用功能、`SafeHtml` 唯一、`AGENTS.md` 一致、契約副本雜湊 |
| `npm run check:build` | 建置後：全部動態渲染、無假資料哨兵、無 `data-dyad-*` |
| `node tests/ci/dev-check.mjs` | 建置後：元件標記器、只綁本機、零啟動自改寫（FE-19） |
| `node tests/ci/guard-workflow-sim.mjs` | 以假的 GitHub API 模擬受保護路徑守門工作流程（需要 bash 與 jq） |
| `npm run test:e2e` | 瀏覽器測試（三種寬度、無障礙、掛鉤、錯誤頁；需先建置） |

## 版本（2026-11-06 查 npm registry）

Next.js 16.4.5、React 19.3.1、Tailwind CSS 4.3.5、zod 4.6.7、TypeScript 5.9.3、ESLint 10.14.0、Playwright 1.63.0（與 mysite 相同）。
Node.js：CI 與正式用 26 線（`.nvmrc`，與 mysite `NODE_VERSION` 同主版本）；`engines` 同時容許委託人電腦的 24 線（D11）。
套件管理器 npm（`packageManager: npm@11.20.0`，Node.js 26.13.0 內附版本）；鎖定檔只在 Linux 產生。

## 分支規則

- `main`：受保護，只能經 PR 以合併提交合併；管理員也不得繞過。
- `design/work`：委託人用 MyDyad 設計的長期分支，合併後不要刪除。
- 施工者分支（`claude/…`）：改到受保護檔案時，PR 說明要有宣告區塊（格式見 `CLAUDE.md`）。
- 受保護路徑守門（`.github/workflows/protected-paths.yml`，檢查名稱 `protected-paths`）：每個對 main 的 PR 開啟、推送、重新開啟、修改說明時都會判定，結果寫成 PR 上的檢查與一則反覆更新的留言。它用 `pull_request_target` 觸發，必須先在本儲存庫建立只允許這支檔案使用 `pull_request_target` 的 Actions 事件政策才會執行。
