import { parseNpcReply, type ChatRequest, type NpcReply } from '../shared/conversation';

/** 서버 상태 (/api/health). 서버가 없으면 online=false (정적 배포·오프라인) */
export interface ServerHealth {
  online: boolean;
  chat: { provider: 'anthropic' | 'practice'; model?: string } | null;
  tts: string[];
  stt: { provider: string; model: string; external: boolean; host: string } | null;
}

const OFFLINE: ServerHealth = { online: false, chat: null, tts: [], stt: null };
let healthPromise: Promise<ServerHealth> | null = null;

export function apiBase(): string {
  return (import.meta.env?.BASE_URL as string | undefined) ?? '/';
}

/** 서버 기능 확인 (한 번만, 실패하면 다음에 다시 확인) */
export function getHealth(force = false): Promise<ServerHealth> {
  if (force) healthPromise = null;
  healthPromise ??= (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${apiBase()}api/health`, { signal: ctrl.signal }).finally(() => clearTimeout(t));
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return OFFLINE;
      const d = (await res.json()) as Partial<ServerHealth> & { tts?: { providers?: string[] } };
      return {
        online: true,
        chat: d.chat ?? null,
        tts: (d.tts as { providers?: string[] } | undefined)?.providers ?? [],
        stt: (d.stt as ServerHealth['stt']) ?? null,
      };
    } catch {
      return OFFLINE;
    }
  })().then((h) => {
    if (!h.online) healthPromise = null;
    return h;
  });
  return healthPromise;
}

export type ChatFailure =
  | 'network' // 서버에 닿지 못함
  | 'timeout'
  | 'rate_limited'
  | 'not_configured'
  | 'provider_error'
  | 'invalid_response'
  | 'bad_request'
  | 'cancelled';

export type ChatResult = { ok: true; reply: NpcReply } | { ok: false; failure: ChatFailure; message: string };

export const CHAT_FAILURE_LABEL: Record<Exclude<ChatFailure, 'cancelled'>, string> = {
  network: '서버에 연결하지 못했어요 (네트워크 오류)',
  timeout: '응답이 너무 오래 걸려 취소했어요 (시간 초과)',
  rate_limited: '요청이 너무 많아요 (사용량 제한)',
  not_configured: 'AI 설정이 필요해요 (API 키 없음 또는 잘못됨)',
  provider_error: 'AI 서비스에서 오류가 났어요 (서버 오류)',
  invalid_response: 'AI 응답 형식이 올바르지 않았어요 (잘못된 응답)',
  bad_request: '요청 내용이 올바르지 않아요',
};

export const CHAT_TIMEOUT_MS = 45_000;

/** 대화 요청. signal로 취소할 수 있고, 시간 제한이 있다. */
export async function sendChat(req: ChatRequest, signal: AbortSignal): Promise<ChatResult> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, CHAT_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    if (!res.ok) {
      const code = data?.error?.code as ChatFailure | undefined;
      const failure: ChatFailure =
        res.status === 429 ? 'rate_limited' : res.status === 503 ? 'not_configured' : res.status === 504 ? 'timeout' : res.status === 400 || res.status === 413 ? 'bad_request' : code === 'invalid_response' ? 'invalid_response' : 'provider_error';
      return { ok: false, failure, message: data?.error?.message ?? `HTTP ${res.status}` };
    }
    const reply = parseNpcReply(data);
    if (!reply) return { ok: false, failure: 'invalid_response', message: '응답 형식 검증 실패' };
    return { ok: true, reply };
  } catch {
    if (signal.aborted) return { ok: false, failure: 'cancelled', message: '' };
    if (timedOut) return { ok: false, failure: 'timeout', message: '' };
    return { ok: false, failure: 'network', message: '' };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
