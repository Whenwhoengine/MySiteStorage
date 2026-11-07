// 受保護（src/**）：伺服器啟動時檢查設定與正式守門（v1 §4.4、FE-09）。
// DEPLOY_ENVIRONMENT 為 staging／production 而資料模式不是 api、或 api 模式缺必要設定時，啟動即失敗退出。
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { readConfig, ConfigError } = await import('./server/config');
  try {
    readConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`[mysite] 設定錯誤，停止啟動：${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}
