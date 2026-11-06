// 受保護（src/server/**）：伺服器端設定與正式守門（v1 §4.4、§6.3）。
// 只在伺服器端執行；瀏覽器端不得匯入本檔（ESLint 阻擋 src/server 以外匯入 fetch 等，這裡不放秘密）。
//
// 環境變數（名稱由施工者定稿，刻意不沿用 Laravel 的 CONTENT_API_BASE_URL，v1 §6.3）：
//   MYSITE_DATA_MODE        mock（預設，讀 mocks/）或 api（呼叫 Laravel 公開 API）
//   MYSITE_API_ORIGIN       api 模式必填：Laravel 公開 API 的來源，例如 http://<內部別名>:<埠>（只能是來源，不含路徑）
//   MYSITE_API_TIMEOUT_MS   api 模式必填：每次呼叫 API 的逾時（毫秒）。數值待委託人依 D13c 裁定，程式不給預設值
//   MYSITE_PUBLIC_ORIGIN    主站公開網址（組 canonical、og:url）；api 模式必填，mock 模式未設時用 http://localhost
//   MYSITE_SITE_NAME        網站資訊取不到時的內建站名；未設時為 mysite（同 Laravel config mysite.site_name 預設）
//   DEPLOY_ENVIRONMENT      mysite 既有的部署環境變數；staging／production 時必須是 api 模式，否則啟動失敗

export type DataMode = 'mock' | 'api';

export interface ServerConfig {
  mode: DataMode;
  apiOrigin: string | null;
  timeoutMs: number | null;
  publicOrigin: string;
  siteName: string;
  deployEnvironment: string | null;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const GUARDED_ENVIRONMENTS = new Set(['staging', 'production']);

function originOf(raw: string, name: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`${name} 不是合法網址`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigError(`${name} 只能是 http 或 https`);
  }
  if (url.username !== '' || url.password !== '') {
    throw new ConfigError(`${name} 不得含帳號密碼`);
  }
  if ((url.pathname !== '/' && url.pathname !== '') || url.search !== '' || url.hash !== '') {
    throw new ConfigError(`${name} 只能是來源（協定＋主機＋埠），不得含路徑或查詢字串`);
  }
  return url.origin;
}

export function readConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const rawMode = (env.MYSITE_DATA_MODE ?? '').trim();
  if (rawMode !== '' && rawMode !== 'mock' && rawMode !== 'api') {
    throw new ConfigError('MYSITE_DATA_MODE 只能是 mock 或 api');
  }
  const mode: DataMode = rawMode === 'api' ? 'api' : 'mock';
  const deployEnvironment = (env.DEPLOY_ENVIRONMENT ?? '').trim() || null;

  // 正式守門：staging／production 一律要真資料（v1 §4.4；FE-09）
  if (deployEnvironment !== null && GUARDED_ENVIRONMENTS.has(deployEnvironment) && mode !== 'api') {
    throw new ConfigError(`DEPLOY_ENVIRONMENT=${deployEnvironment} 時資料模式必須是 api（目前是 ${mode}）`);
  }

  const siteName = (env.MYSITE_SITE_NAME ?? '').trim() || 'mysite';

  if (mode === 'mock') {
    const rawPublic = (env.MYSITE_PUBLIC_ORIGIN ?? '').trim();
    return {
      mode,
      apiOrigin: null,
      timeoutMs: null,
      publicOrigin: rawPublic === '' ? 'http://localhost' : originOf(rawPublic, 'MYSITE_PUBLIC_ORIGIN'),
      siteName,
      deployEnvironment,
    };
  }

  const rawApi = (env.MYSITE_API_ORIGIN ?? '').trim();
  if (rawApi === '') throw new ConfigError('api 模式必須設定 MYSITE_API_ORIGIN');
  const rawTimeout = (env.MYSITE_API_TIMEOUT_MS ?? '').trim();
  if (!/^[1-9]\d*$/.test(rawTimeout) || !Number.isSafeInteger(Number(rawTimeout))) {
    throw new ConfigError('api 模式必須設定 MYSITE_API_TIMEOUT_MS（正整數毫秒；數值依 D13c 裁定）');
  }
  const rawPublic = (env.MYSITE_PUBLIC_ORIGIN ?? '').trim();
  if (rawPublic === '') throw new ConfigError('api 模式必須設定 MYSITE_PUBLIC_ORIGIN');

  return {
    mode,
    apiOrigin: originOf(rawApi, 'MYSITE_API_ORIGIN'),
    timeoutMs: Number(rawTimeout),
    publicOrigin: originOf(rawPublic, 'MYSITE_PUBLIC_ORIGIN'),
    siteName,
    deployEnvironment,
  };
}

let cached: ServerConfig | null = null;

/** 讀一次後沿用（環境變數在行程生命週期內不變）。設定不合法時丟出 ConfigError。 */
export function serverConfig(): ServerConfig {
  cached ??= readConfig();
  return cached;
}
