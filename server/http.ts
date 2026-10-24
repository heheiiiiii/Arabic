import type { ApiError } from '../src/shared/conversation';

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function apiError(status: number, code: string, message: string, headers: Record<string, string> = {}): Response {
  const body: ApiError = { error: { code, message } };
  return json(body, status, headers);
}

/** 본문을 최대 크기까지만 읽는다 (넘으면 null) */
export async function readLimited(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > maxBytes) return null;
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/** fetch에 시간 제한을 건다 */
export async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export class ProviderError extends Error {
  constructor(
    public readonly code: 'not_configured' | 'provider_error' | 'timeout' | 'rate_limited' | 'invalid_response' | 'bad_request',
    message: string,
  ) {
    super(message);
  }
}

export function statusOf(code: ProviderError['code']): number {
  return { not_configured: 503, provider_error: 502, timeout: 504, rate_limited: 429, invalid_response: 502, bad_request: 400 }[code];
}
