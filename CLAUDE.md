# MySiteStorage：施工者須知

> 只適用施工者（Claude Code 雲端或本機會話）。其他 AI（MyDyad 的建置模式、代理模式）一律依 `AI_RULES.md`。

## 依據
- mysite `docs/MySiteReact前端專案定案執行.md`（優先）、`MySiteReact前端專案v2.md`、`MySiteReact前端專案v1.md`。
- 契約與掛鉤清單的正本在 mysite；本儲存庫 `contracts/` 只放副本（見 `contracts/SOURCE.json`）。

## 分工
- 設計區（`src/views/`、`src/components/` 除 `safe/`、`src/styles/`、`public/design/`）屬委託人的設計；委託人沒有要求時不改。
- 其他全部是受保護區，只有施工者改；改受保護區要同步契約、型別、假資料與測試。
- 不推 main、不合併 PR、不刪分支、不自動發布。改到受保護檔的 PR 由委託人看過清單後合併。
- 把 main 的更新帶回設計分支：合併進 main 後，以一般推送把 main 合併進 `design/work`（不改寫歷史）。

## 受保護路徑宣告區塊（定案執行書 §4.2、§5.2）
施工者分支（分支名不是 `design/` 開頭）的 PR，只要改到受保護路徑，PR 說明就必須有下列區塊，逐行列出**本次改動的每一個受保護檔案**
（以 GitHub 回報的檔案路徑為準；改名時舊路徑與新路徑都要列）。與實際清單完全一致才通過，多列或少列都失敗：

```text
<!-- protected-change:begin -->
- package.json
- src/server/api-client.ts
<!-- protected-change:end -->
```

- 每行以 `- ` 開頭，後面是從儲存庫根目錄起算的路徑，不加引號或反引號。
- 沒改到受保護路徑時不需要這個區塊（有也必須是空的）。
- 開放區只有：`src/views/**`、`src/components/**`（`src/components/safe/**` 除外）、`src/styles/**`、`public/design/**`。其他一律受保護。
- 守門工作流程 `.github/workflows/protected-paths.yml`（工作名稱 `protected-paths`，判定邏輯 `tests/ci/protected-paths.mjs`）以 `pull_request_target` 觸發，
  只取 main 上的判定腳本、不取 PR 的內容、不用秘密；PR 欄位一律在執行時讀成檔案或變數，不在 `run:` 裡展開 `${{ }}`。
  委託人在本儲存庫建立事件政策之前不會觸發（BLK-REACT-POLICY-01），在那之前由主 CI 的模擬（`tests/ci/guard-workflow-sim.mjs`）與委託人核對。
  改了守門工作流程或判定腳本，要同步更新模擬與單元測試。

## 指令與環境
- Node.js 26 線、npm 11.20.0（Node.js 26.13.0 內附）。鎖定檔只在 Linux 產生。
- `.npmrc` 有 `save=false`：一般的 `npm install` 不會改寫 `package.json` 與鎖定檔。新增或升級套件一律明寫
  `npm install <套件>@<確切版本> --save`（開發用加 `--save-dev`），版本先查 npm registry 與官方公告，寫進 PR 說明。
- 驗證順序（CI 相同）：`npm ci` → `npm run check:static` → `npm run lint` → `npm run typecheck` → `npm test`
  → `node tests/ci/guard-workflow-sim.mjs` → `npm run build` → `npm run check:build` → `node tests/ci/dev-check.mjs` → `npm run test:e2e`。
- 零啟動自改寫封條（FE-19）：改了相依套件、`next.config.mjs` 或 `tsconfig.json` 之後，先跑一次 `npm run build` 與 `node tests/ci/dev-check.mjs`；
  Next.js 若補寫了 `tsconfig.json`，把結果提交定型。`next-env.d.ts` 在 `.gitignore`，不提交。
- `next.config.mjs` 的 `agentRules: false` 不可移除：Next.js 16.4 的 `next dev` 偵測到 AI 代理時會自動改寫 `AGENTS.md`。

## 更新契約與假資料
1. 契約或掛鉤清單：從 mysite 複製 `app/resources/contracts/public-api-v1.openapi.json`、`app/resources/contracts/public-api-v1/samples/`、
   `tests/e2e/dom-hooks.json` 到 `contracts/`，更新 `contracts/SOURCE.json`（來源提交與每個檔的 SHA-256），
   再跑 `npm run contract:types` 重新產生 `src/lib/content/api-contract.d.ts`，同步 `src/server/schemas.ts`。
2. 假資料：取 mysite CI 在 testing 環境的 `mock-export` 產出（證據檔 `.runtime/results/mock-export/<run>/`），
   整個 `mocks/` 與 `public/mock-media/` 原樣覆蓋，核對 manifest 雜湊；不得手改 JSON 放進真實稿件。
3. 數值類（逾時、埠、網段、資源上限、重試）不自行定值，依 D13 附出處與算式呈報委託人裁定。

## 不做的事
- 不建立 `app/`、`src/app/`、`proxy.ts`、`middleware.ts`、`tailwind.config.*`；不用 `next/og`、`next/font/google`、`next/image`、Server Actions、`use cache`、Edge 執行環境。
- 不建立靜態的 `404.tsx`、`500.tsx`（錯誤頁要即時版面與請求編號）。
- 除 `src/server/api-client.ts` 外不呼叫任何網址；不寫 cookie 或瀏覽器儲存。
