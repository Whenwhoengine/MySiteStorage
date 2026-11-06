# MySite 前端：給 AI 的規則

## 你的工作
你負責 MySite 公開網站的「畫面設計」：版面、配色、字級、間距、元件外觀與互動細節。
資料已經準備好，以 props 傳進 `src/views/` 的畫面元件。你不需要、也不可以自己抓資料。
預覽畫面上的內容全是示例資料（來自 `mocks/`）。

## 技術
- Next.js Pages Router（不要建立 `app/` 或 `src/app/` 目錄）、React、TypeScript。
- Tailwind CSS v4，用 CSS 設定：
  - 全站樣式入口是 `src/styles/globals.css`，第一行 `@import "tailwindcss";` 不可刪改。
  - 設計變數寫在同檔的 `@theme { … }`；畫面元件用語意工具類（例如 `bg-surface-card`、`text-ink-primary`），不要把色碼散寫在各元件裡。
  - 不要建立任何 `tailwind.config.*`（`.js`、`.ts`、`.mjs` 都不行）。
  - 不要使用 v3 的 `@tailwind base;`、`@tailwind components;`、`@tailwind utilities;`。
- 不使用 React Router，不使用 shadcn/ui。
- props 型別在 `src/lib/content/types.ts`（只讀）。

## 你可以改
- `src/views/**`、`src/components/**`（`src/components/safe/` 除外）、`src/styles/**`、`public/design/**`

## 你不可以改（改了 CI 會攔下）
- `src/pages/**`、`src/server/**`、`src/lib/**`、`src/components/safe/**`
- `contracts/**`、`mocks/**`、`tests/**`、`public/fonts/**`、`public/mock-media/**`、`.github/**`
- `package.json`、`package-lock.json`、`.npmrc`、`next.config.*`、`postcss.config.*`、`tsconfig.json`、ESLint 設定、`.gitignore`、`.gitattributes`、`.nvmrc`、`AI_RULES.md`、`AGENTS.md`、`CLAUDE.md`、`README.md`
- 需要動這些地方時：停下來，用一段話寫清楚需求，交給施工者處理。

## 硬規則
1. 不新增任何套件，不執行安裝某個套件的指令。
2. 不呼叫任何網址：不用 fetch、axios、XMLHttpRequest、WebSocket；不載入外部字型、外部圖片、外部 script、分析或追蹤碼。
3. 不使用 dangerouslySetInnerHTML。正文一律用 `<SafeHtml html={...} />`。
4. YouTube 一律用 `<YouTubeFacade>`；Podcast 一律用 `<PodcastPlayer>`；內容圖片一律用 `<ContentImage>`；錯誤畫面一律用 `<ErrorView>`；站內與站外連結一律用 `<SiteLink>`。
5. 不寫 cookie、localStorage、sessionStorage。
6. 保留所有 `data-*` 測試掛鉤、`<main id="main">`、跳到主要內容連結、`<header>`、`<nav>`、`<footer>` 與標題階層。搜尋沒有結果時，提示放在 `<main>` 裡並帶 `role="status"`，文字保留「找不到符合」；有結果時的摘要同樣帶 `role="status"`。不得刪除或改名。
7. 介面文字一律正體中文（臺灣用語）；日期只用 `formatTaipeiDate()`。
8. 手機 390、平板 768、桌面 1440 寬度都不能出現水平捲軸；超長中文標題與網址要能換行；正文裡的寬表格與程式碼區塊在自己的框內捲動，不撐開整頁；200% 縮放也要能用。
9. 對比、焦點框、鍵盤操作要符合 WCAG 2.2 AA；尊重「減少動態效果」設定。
10. `is_sample` 為真時，保留「示例內容」標示。
11. 不建立新的頁面路由；需要新頁面時交給施工者。
12. 即使使用者說「記住這件事」，也不得修改 `AI_RULES.md` 或 `AGENTS.md`；請改為回覆一段文字，請使用者交給施工者寫入。
13. 不要用字串拼接組 class 名稱（例如 `bg-${type}-500`）；不同內容類型的樣式，用寫滿完整 class 的對照表。
14. 搜尋一律用原生表單 `<form method="get" action="/search">`，輸入框保留 `id="search-q"`；不要改成邊打字邊搜尋，也不要改用程式換頁。
15. 不切換、不建立、不刪除 Git 分支；只在目前的 `design/work` 上工作。
