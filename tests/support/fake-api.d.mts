// tests/support/fake-api.mjs 的型別宣告（給 TypeScript 測試使用）。
export interface FakeApi {
  port: number;
  log: Map<string, string[]>;
  close: () => Promise<void>;
}
export function startFakeApi(options?: { port?: number; mocksDir?: string }): Promise<FakeApi>;
