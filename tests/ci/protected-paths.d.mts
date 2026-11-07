// tests/ci/protected-paths.mjs 的型別宣告（給 TypeScript 測試使用；tsconfig 的 allowJs 為 false）。
export type PathKind = 'open' | 'protected';
export type PrKind = 'fork' | 'design' | 'builder' | 'invalid';
export type EvaluateReason =
  | 'pass'
  | 'invalid-input'
  | 'list-incomplete'
  | 'fork-protected'
  | 'design-protected'
  | 'declaration-invalid'
  | 'declaration-missing'
  | 'declaration-mismatch'
  | 'declaration-not-empty';

export const OPEN: 'open';
export const PROTECTED: 'protected';
export const OPEN_PREFIXES: readonly string[];
export const DECLARATION_BEGIN: string;
export const DECLARATION_END: string;

export function explainPath(filePath: string): { kind: PathKind; reason: string | null };
export function classifyPath(filePath: string): PathKind;

export interface Declaration {
  valid: boolean;
  paths: string[];
  errors: string[];
}
export function parseDeclaration(body: string | null | undefined): Declaration | null;

/** GitHub「列出 PR 變更檔」API 的項目（只用到這三個欄位）。 */
export interface PrFile {
  filename: string;
  status: string;
  previous_filename?: string | null;
}
export interface EvaluateInput {
  isFork: boolean;
  headRef: string;
  files: PrFile[];
  body: string | null | undefined;
  listComplete: boolean;
}
export interface EvaluateResult {
  ok: boolean;
  kind: PrKind;
  reason: EvaluateReason;
  protectedFiles: string[];
  missing: string[];
  extra: string[];
  message: string;
  restoreCommands: string[];
}
export function evaluate(input: EvaluateInput): EvaluateResult;
