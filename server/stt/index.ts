import { LIMITS } from '../../src/shared/conversation';
import { config } from '../config';
import { fetchWithTimeout, ProviderError } from '../http';

/** 허용하는 녹음 형식 (브라우저 MediaRecorder가 만드는 형식) */
export const ALLOWED_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac'];

export interface SttProviderInfo {
  id: string;
  model: string;
  /** 외부로 음성이 전송되는지 (사용자에게 알리기 위함) */
  external: boolean;
  host: string;
}

/** OpenAI 호환 음성 인식 공급자가 설정되어 있으면 그 정보 */
export function sttProvider(): SttProviderInfo | null {
  if (!config.stt.apiKey) return null;
  const host = new URL(config.stt.baseUrl).host;
  return { id: host === 'api.openai.com' ? 'openai' : 'openai-compatible', model: config.stt.model, external: true, host };
}

const EXT: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/aac': 'aac' };

/**
 * 녹음 → 아랍어 텍스트. 원본 음성은 메모리에서만 다루고 디스크에 저장하지 않는다.
 * 언어를 ar로 지정해 다른 언어로 오인식되는 것을 줄인다.
 */
export async function transcribe(audio: Uint8Array, mime: string): Promise<{ text: string; provider: string }> {
  const p = sttProvider();
  if (!p) throw new ProviderError('not_configured', '서버 음성 인식이 설정되지 않았습니다 (STT_API_KEY 또는 OPENAI_API_KEY 필요)');
  if (audio.byteLength > LIMITS.sttBytes) throw new ProviderError('bad_request', '녹음 파일이 너무 큽니다');
  const base = mime.split(';')[0].trim();
  if (!ALLOWED_AUDIO.includes(base)) throw new ProviderError('bad_request', `지원하지 않는 녹음 형식입니다: ${base}`);

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: base }), `speech.${EXT[base]}`);
  form.append('model', config.stt.model);
  form.append('language', 'ar');
  form.append('response_format', 'json');
  // 학습용 짧은 발화이므로 인식 힌트로 상황을 알려 준다.
  form.append('prompt', 'محادثة بسيطة باللغة العربية الفصحى بين متعلم وجارته في قرية.');

  let res: Response;
  try {
    res = await fetchWithTimeout(`${config.stt.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${config.stt.apiKey}` }, body: form }, config.stt.timeoutMs);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ProviderError('timeout', '음성 인식 시간이 초과되었습니다');
    throw new ProviderError('provider_error', '음성 인식 서버에 연결하지 못했습니다');
  }
  if (res.status === 429) throw new ProviderError('rate_limited', '음성 인식 사용량 제한에 걸렸습니다');
  if (res.status === 401 || res.status === 403) throw new ProviderError('not_configured', '음성 인식 키가 올바르지 않습니다');
  if (!res.ok) throw new ProviderError('provider_error', `음성 인식 오류 ${res.status}`);
  const data = (await res.json().catch(() => null)) as { text?: unknown } | null;
  if (!data || typeof data.text !== 'string') throw new ProviderError('invalid_response', '음성 인식 응답 형식이 올바르지 않습니다');
  return { text: data.text.trim(), provider: p.id };
}
