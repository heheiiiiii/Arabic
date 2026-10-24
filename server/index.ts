/**
 * 운영용 서버: 빌드된 게임(dist/)과 /api/* 를 함께 제공한다.
 *   npm run build && npm start
 * HTTPS는 앞단(리버스 프록시·호스팅 플랫폼)에서 처리한다 (마이크 사용에 HTTPS 필요).
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { config } from './config';
import { nodeApiHandler } from './node';
import { chatProviderInfo } from './chat';

const DIST = path.resolve(process.env.STATIC_DIR ?? 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  try {
    if (req.url?.startsWith('/api/')) return await nodeApiHandler(req, res);
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(DIST)) {
      res.statusCode = 403;
      return res.end();
    }
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) file = path.join(DIST, 'index.html');
    res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
    if (file.includes(`${path.sep}assets${path.sep}`) || file.includes(`${path.sep}audio${path.sep}`)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end('server error');
  }
});

server.listen(config.port, () => {
  const chat = chatProviderInfo();
  console.log(`Arabic Village: http://localhost:${config.port}  (대화: ${chat.provider}${chat.model ? ' ' + chat.model : ''})`);
});
