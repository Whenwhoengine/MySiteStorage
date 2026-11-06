// 正式守門（v1 §4.4；FE-09 守門部分）：staging／production 以假資料模式啟動必須失敗。
import { describe, expect, it } from 'vitest';
import { ConfigError, readConfig } from '@/server/config';

const API = {
  MYSITE_DATA_MODE: 'api',
  MYSITE_API_ORIGIN: 'http://api.internal.test:8080',
  MYSITE_API_TIMEOUT_MS: '1500',
  MYSITE_PUBLIC_ORIGIN: 'https://www.example.test',
};

describe('readConfig', () => {
  it('未設定時是假資料模式', () => {
    const config = readConfig({});
    expect(config.mode).toBe('mock');
    expect(config.publicOrigin).toBe('http://localhost');
    expect(config.siteName).toBe('mysite');
  });

  it.each(['staging', 'production'])('DEPLOY_ENVIRONMENT=%s 時假資料模式啟動失敗', (env) => {
    expect(() => readConfig({ DEPLOY_ENVIRONMENT: env })).toThrow(ConfigError);
    expect(() => readConfig({ DEPLOY_ENVIRONMENT: env, MYSITE_DATA_MODE: 'mock' })).toThrow(ConfigError);
  });

  it.each(['staging', 'production'])('DEPLOY_ENVIRONMENT=%s 時真資料模式可以啟動', (env) => {
    expect(readConfig({ ...API, DEPLOY_ENVIRONMENT: env }).mode).toBe('api');
  });

  it('不認得的資料模式一律拒絕', () => {
    expect(() => readConfig({ MYSITE_DATA_MODE: 'real' })).toThrow(ConfigError);
  });

  it('api 模式缺必要設定時拒絕（逾時不給預設值，依 D13c 裁定）', () => {
    expect(() => readConfig({ ...API, MYSITE_API_ORIGIN: '' })).toThrow(ConfigError);
    expect(() => readConfig({ ...API, MYSITE_API_TIMEOUT_MS: '' })).toThrow(ConfigError);
    expect(() => readConfig({ ...API, MYSITE_API_TIMEOUT_MS: '0' })).toThrow(ConfigError);
    expect(() => readConfig({ ...API, MYSITE_API_TIMEOUT_MS: '1.5' })).toThrow(ConfigError);
    expect(() => readConfig({ ...API, MYSITE_PUBLIC_ORIGIN: '' })).toThrow(ConfigError);
  });

  it('API 與主站網址只能是來源（不含路徑、查詢字串、帳號密碼）', () => {
    expect(() => readConfig({ ...API, MYSITE_API_ORIGIN: 'http://api.test/api/v1' })).toThrow(ConfigError);
    expect(() => readConfig({ ...API, MYSITE_API_ORIGIN: 'http://u:p@api.test' })).toThrow(ConfigError);
    expect(() => readConfig({ ...API, MYSITE_API_ORIGIN: 'ftp://api.test' })).toThrow(ConfigError);
    expect(() => readConfig({ ...API, MYSITE_PUBLIC_ORIGIN: 'https://www.example.test/?x=1' })).toThrow(ConfigError);
    expect(readConfig(API).apiOrigin).toBe('http://api.internal.test:8080');
  });
});
