// tests/ci/safe-html-checks.mjs 的型別宣告（給 TypeScript 測試使用；tsconfig 的 allowJs 為 false）。
export const SAFE_HTML_FILE: string;
export const RAW_HTML_FRAGMENTS: RegExp;
/** 依副檔名決定的 TypeScript ScriptKind 數值。 */
export function scriptKindOf(file: string): number;
export function isSafeHtmlModule(specifier: string): boolean;
/** 回傳違規說明（含「路徑:行號」）；空陣列表示通過。 */
export function checkSafeHtmlSource(file: string, text: string): string[];
