// 受保護（src/pages/**）：容器健康檢查（v1 §4.6）。不依賴 Laravel，避免後端暫停時前端被誤判失效而重啟。
// 不經 gateway 對外（gateway 對 /api/ 一律回 404）。src/pages/api/ 底下只允許這一條路由（CI 檢查）。
import type { NextApiRequest, NextApiResponse } from 'next';

export default function healthz(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({ status: 'method_not_allowed' });
    return;
  }
  res.status(200).json({ status: 'ok' });
}
