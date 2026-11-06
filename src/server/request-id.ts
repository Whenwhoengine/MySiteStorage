// 受保護（src/server/**）：請求編號。gateway 以 X-Request-Id（$request_id，32 位十六進位）轉來；
// 只在格式正確時沿用（同 Laravel AssignRequestId），否則自行產生同格式的編號。
import { randomBytes } from 'node:crypto';

export const REQUEST_ID_PATTERN = /^[a-f0-9]{32}$/;

export function newRequestId(): string {
  return randomBytes(16).toString('hex');
}

export function requestIdFrom(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value) ? value : newRequestId();
}
