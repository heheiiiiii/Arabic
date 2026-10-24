import { LIMITS, validateChatRequest } from '../src/shared/conversation';
import { accessCookie, accessState, checkCode, hasAccess } from './access';
import { npcReply, chatProviderInfo } from './chat';
import { config } from './config';
import { apiError, json, ProviderError, readLimited, statusOf } from './http';
import { allow, allowDaily } from './rateLimit';
import { sttProvider, transcribe } from './stt';
import { availableTtsProviders, sanitizeTtsText, synthesize } from './tts';

/** 초대 코드 시도 상한 (IP별 분당) */
const ACCESS_PER_MINUTE = 10;

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  if (origin && config.allowedOrigins.includes(origin)) {
    return { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  }
  return {};
}

function withHeaders(res: Response, headers: Record<string, string>): Response {
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

function fail(e: unknown): Response {
  if (e instanceof ProviderError) return apiError(statusOf(e.code), e.code, e.message);
  console.error('[api] unexpected error', e instanceof Error ? e.message : e);
  return apiError(500, 'server_error', '서버 오류가 발생했습니다');
}

/**
 * /api/* 요청 처리. 개발(Vite 미들웨어)과 운영(server/index.ts)에서 같은 함수를 쓴다.
 * @param ip 사용량 제한용 클라이언트 주소
 */
export async function handleApi(req: Request, ip: string): Promise<Response> {
  const url = new URL(req.url);
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  return withHeaders(await route(req, url, ip), h);
}

async function route(req: Request, url: URL, ip: string): Promise<Response> {
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') {
      const paid = hasAccess(req);
      const tts = await availableTtsProviders(paid);
      const stt = paid ? sttProvider() : null;
      return json({
        ok: true,
        access: accessState(req),
        chat: chatProviderInfo(paid),
        tts: { providers: tts.map((p) => p.id) },
        stt: stt ? { provider: stt.id, model: stt.model, external: stt.external, host: stt.host } : null,
        limits: { playerText: LIMITS.playerText, recordSeconds: LIMITS.recordSeconds, sttBytes: LIMITS.sttBytes },
      });
    }

    if (url.pathname === '/api/access' && req.method === 'POST') {
      if (!allow(`access:${ip}`, ACCESS_PER_MINUTE)) return apiError(429, 'rate_limited', '시도가 너무 많아요. 잠시 후 다시 해 주세요.');
      const raw = await readLimited(req, 1000);
      let code = '';
      try {
        code = String((JSON.parse(new TextDecoder().decode(raw ?? new Uint8Array())) as { code?: unknown }).code ?? '').trim();
      } catch {
        return apiError(400, 'bad_request', 'JSON 형식이 올바르지 않습니다');
      }
      if (!code || code.length > 200 || !checkCode(code)) return apiError(403, 'forbidden', '초대 코드가 맞지 않아요');
      return json({ ok: true, access: 'granted' }, 200, { 'set-cookie': accessCookie(req) });
    }

    if (url.pathname === '/api/tts' && req.method === 'GET') {
      if (!allow(`tts:${ip}`, config.perMinute.tts)) return apiError(429, 'rate_limited', '음성 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
      const text = sanitizeTtsText(url.searchParams.get('text') ?? '');
      if (!text) return apiError(400, 'bad_request', '아랍어 문장(400자 이하)만 읽을 수 있습니다');
      const r = await synthesize(text, hasAccess(req));
      return new Response(new Uint8Array(r.audio), {
        status: 200,
        headers: { 'content-type': r.contentType, 'cache-control': 'public, max-age=604800', 'x-tts-provider': r.provider, 'x-tts-cache': r.cached ? 'hit' : 'miss' },
      });
    }

    if (url.pathname === '/api/stt' && req.method === 'POST') {
      if (!allow(`stt:${ip}`, config.perMinute.stt)) return apiError(429, 'rate_limited', '음성 인식 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
      if (!hasAccess(req)) return apiError(403, 'forbidden', '서버 음성 인식은 초대 코드를 입력한 뒤에 쓸 수 있어요');
      const body = await readLimited(req, LIMITS.sttBytes);
      if (!body) return apiError(413, 'bad_request', '녹음 파일이 너무 큽니다');
      if (body.byteLength < 800) return apiError(400, 'bad_request', '녹음이 너무 짧습니다');
      if (sttProvider() && !allowDaily('stt', config.stt.dailyLimit)) return apiError(429, 'rate_limited', '오늘의 서버 음성 인식 사용량을 모두 썼어요. 키보드나 브라우저 인식을 써 주세요.');
      const r = await transcribe(body, req.headers.get('content-type') ?? '');
      return json(r);
    }

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      if (!allow(`chat:${ip}`, config.perMinute.chat)) return apiError(429, 'rate_limited', '대화 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
      const raw = await readLimited(req, LIMITS.chatBody);
      if (!raw) return apiError(413, 'bad_request', '요청이 너무 큽니다');
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(raw));
      } catch {
        return apiError(400, 'bad_request', 'JSON 형식이 올바르지 않습니다');
      }
      const chatReq = validateChatRequest(parsed);
      if (typeof chatReq === 'string') return apiError(400, 'bad_request', chatReq);
      return json(await npcReply(chatReq, hasAccess(req)));
    }

    return apiError(404, 'not_found', '알 수 없는 API입니다');
  } catch (e) {
    return fail(e);
  }
}
