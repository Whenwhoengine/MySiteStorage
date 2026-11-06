// 受保護（tests/**）：測試用的假 Laravel 公開 API（v1 FE-05：以假伺服器模擬連線被拒、逾時、非 JSON、格式不符）。
// 一般請求照 mocks/manifest.json 的 api_path 回假資料；下列 slug 模擬各種失敗：
//   fe-404（契約錯誤格式 404）、fe-404-html（非 JSON 的 404）、fe-503、fe-500、fe-429、fe-nonjson、fe-schema（缺欄位）、
//   fe-extra（多欄位）、fe-timeout（不回應）、fe-redirect（302）、fe-reset（直接斷線）
// /api/v1/site 的行為由請求編號（X-Request-Id）前 4 碼決定，讓平行的測試互不干擾：
//   dead → 503；beef → 非 JSON；cafe → 不回應；其他 → 正常
// GET /__log?rid=<請求編號> 回傳這個編號打過的 API 路徑（檢查「不呼叫任何 API」）。
// 用法：node tests/support/fake-api.mjs --port=<埠>（埠由呼叫端取得的空閒埠決定）
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadMocks(mocksDir) {
  const manifest = JSON.parse(readFileSync(path.join(mocksDir, 'manifest.json'), 'utf8'));
  const byPath = new Map();
  for (const kind of ['edge', 'export']) {
    for (const f of manifest.files) if (f.kind === kind) byPath.set(f.api_path, f.file);
  }
  const read = (file) => readFileSync(path.join(mocksDir, path.relative('mocks', file)), 'utf8');
  return { manifest, byPath, read };
}

function json(res, status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(text);
}

function apiError(res, status, code, message, rid) {
  json(res, status, { error: code, message, request_id: rid });
}

export function startFakeApi({ port = 0, mocksDir = path.join(ROOT, 'mocks') } = {}) {
  const mocks = loadMocks(mocksDir);
  const log = new Map();
  const sockets = new Set();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake.invalid');
    const header = req.headers['x-request-id'];
    const rid = typeof header === 'string' && /^[a-f0-9]{32}$/.test(header) ? header : '0'.repeat(32);

    if (url.pathname === '/__log') {
      json(res, 200, { paths: log.get(url.searchParams.get('rid') ?? '') ?? [] });
      return;
    }
    if (!log.has(rid)) log.set(rid, []);
    log.get(rid).push(`${url.pathname}${url.search}`);

    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }

    if (url.pathname === '/api/v1/site') {
      const mode = rid.slice(0, 4);
      if (mode === 'dead') return apiError(res, 503, 'HTTP_503', '服務暫時無法使用，請稍後再試。', rid);
      if (mode === 'beef') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>not json</html>');
        return;
      }
      if (mode === 'cafe') return; // 不回應，讓呼叫端逾時
    }

    const slug = url.pathname.split('/').pop() ?? '';
    switch (slug) {
      case 'fe-404':
        return apiError(res, 404, 'CONTENT_NOT_FOUND', '找不到這個內容。', rid);
      case 'fe-404-html':
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<html>404</html>');
        return;
      case 'fe-503':
        return apiError(res, 503, 'CONTENT_UPSTREAM_UNAVAILABLE', '內容暫時無法讀取，請稍後再試。', rid);
      case 'fe-500':
        return apiError(res, 500, 'HTTP_500', '系統發生錯誤，請稍後再試。', rid);
      case 'fe-429':
        return apiError(res, 429, 'RATE_LIMITED', '操作過於頻繁，請稍後再試。', rid);
      case 'fe-nonjson':
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>maintenance</html>');
        return;
      case 'fe-schema':
        return json(res, 200, { data: { title: '缺欄位' }, seo: {} });
      case 'fe-extra': {
        const body = JSON.parse(mocks.read(mocks.byPath.get('/api/v1/articles/sample-gutenberg-blocks')));
        body.data.internal_id = 42;
        return json(res, 200, body);
      }
      case 'fe-timeout':
        return; // 不回應
      case 'fe-redirect':
        res.writeHead(302, { Location: 'http://evil.invalid/api/v1/articles/x' });
        res.end();
        return;
      case 'fe-reset':
        req.socket.destroy();
        return;
      default:
        break;
    }

    if (url.pathname === '/api/v1/search') {
      const q = (url.searchParams.get('q') ?? '').replace(/\s+/gu, ' ').trim();
      const type = (url.searchParams.get('type') ?? '').trim();
      if (type !== '' && !['post', 'video', 'podcast', 'page'].includes(type)) {
        return apiError(res, 422, 'SEARCH_INVALID', '內容類型不正確，請重新選擇。', rid);
      }
      if ([...q].length > 100) return apiError(res, 422, 'SEARCH_INVALID', '搜尋字詞最多 100 個字，請縮短後再試。', rid);
      if (q === '') return json(res, 200, mocks.read(mocks.byPath.get('/api/v1/search')));
      const key = `/api/v1/search?q=${encodeURIComponent(q)}`;
      if (mocks.byPath.has(key)) return json(res, 200, mocks.read(mocks.byPath.get(key)));
      const empty = JSON.parse(mocks.read(mocks.byPath.get('/api/v1/search')));
      empty.data = { q, type: type === '' ? null : type, searched: true, items: [] };
      empty.meta = { page: 1, per_page: 12, total: 0, total_pages: 0 };
      empty.seo.title = `搜尋「${q}」`;
      return json(res, 200, empty);
    }

    const key = `${url.pathname}${url.search}`;
    const file = mocks.byPath.get(key);
    if (file === undefined) return apiError(res, 404, 'CONTENT_NOT_FOUND', '找不到這個內容。', rid);
    return json(res, 200, mocks.read(file));
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        port: typeof address === 'object' && address !== null ? address.port : port,
        log,
        close: () =>
          new Promise((done) => {
            for (const s of sockets) s.destroy();
            server.close(() => done());
          }),
      });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.find((a) => a.startsWith('--port='));
  const port = arg ? Number(arg.slice('--port='.length)) : 0;
  startFakeApi({ port }).then(({ port: actual }) => {
    console.log(`fake-api listening on 127.0.0.1:${actual}`);
  });
}
