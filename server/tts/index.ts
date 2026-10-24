import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { textHash } from '../../src/shared/hash';
import { config } from '../config';
import { ProviderError } from '../http';
import { allowDaily } from '../rateLimit';
import { azureProvider, openaiProvider } from './cloud';
import { espeakProvider } from './espeak';
import type { TtsProvider, TtsResult } from './types';

const ALL: Record<string, TtsProvider> = { azure: azureProvider, openai: openaiProvider, espeak: espeakProvider };

/** 무료 공급자 (로컬 espeak-ng). 나머지는 호출마다 과금된다 */
const isPaid = (p: TtsProvider) => p !== espeakProvider;

/** @param paid 유료 공급자도 쓸 수 있는지 (초대 코드) */
export async function availableTtsProviders(paid = true): Promise<TtsProvider[]> {
  const list = config.tts.order.map((id) => ALL[id]).filter((p): p is TtsProvider => !!p && (paid || !isPaid(p)));
  const ok = await Promise.all(list.map((p) => p.available()));
  return list.filter((_, i) => ok[i]);
}

/** 아랍어 문자·부호·숫자·기본 문장부호·공백만 허용 (다른 문자는 음성 공급자로 보내지 않는다) */
export function sanitizeTtsText(text: string): string | null {
  const t = text.normalize('NFC').replace(/[\u2026\u2026]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 400) return null;
  if (!/^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s.,!?:\u060C\u061B\u061F0-9-]+$/.test(t)) return null;
  if (!/[\u0621-\u064A]/.test(t)) return null;
  return t;
}

/**
 * 음성 합성 + 디스크 캐시. 같은 문장·같은 음성은 다시 만들지 않는다.
 * 캐시에는 학습용 문장 음성만 저장된다 (사용자 녹음은 저장하지 않는다).
 */
export async function synthesize(text: string, paid = true): Promise<TtsResult & { provider: string; cached: boolean }> {
  const providers = await availableTtsProviders(paid);
  if (providers.length === 0) throw new ProviderError('not_configured', '사용할 수 있는 서버 음성 공급자가 없습니다');
  let lastErr: unknown = null;
  for (const p of providers) {
    const file = path.join(config.tts.cacheDir, `${textHash(p.voiceKey + '|' + text)}.mp3`);
    try {
      const audio = new Uint8Array(await readFile(file));
      return { audio, contentType: 'audio/mpeg', provider: p.id, cached: true };
    } catch {
      // 캐시 없음
    }
    // 유료 공급자는 하루 상한 안에서만 새로 만든다 (넘으면 다음 공급자, 보통 espeak-ng)
    if (isPaid(p) && !allowDaily('tts', config.tts.dailyLimit)) {
      lastErr = new ProviderError('rate_limited', '오늘의 서버 음성 사용량을 모두 썼어요');
      continue;
    }
    try {
      const r = await p.synthesize(text);
      await mkdir(config.tts.cacheDir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, r.audio);
      await rename(tmp, file);
      return { ...r, provider: p.id, cached: false };
    } catch (e) {
      lastErr = e; // 다음 공급자로
    }
  }
  throw lastErr instanceof ProviderError ? lastErr : new ProviderError('provider_error', '음성 합성에 실패했습니다');
}
