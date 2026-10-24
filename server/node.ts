import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { handleApi } from './app';

/** Node http 요청 → Web Request → handleApi → Node 응답 */
export async function nodeApiHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // @ts-expect-error Node의 fetch는 스트리밍 본문에 duplex 지정이 필요하다
    duplex: 'half',
  });
  const ip = (req.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, '');
  const response = await handleApi(request, ip);
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}
