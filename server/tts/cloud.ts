import { config } from '../config';
import { fetchWithTimeout, ProviderError } from '../http';
import type { TtsProvider, TtsResult } from './types';

async function audioOrThrow(res: Response, name: string): Promise<TtsResult> {
  if (res.status === 429) throw new ProviderError('rate_limited', `${name} 사용량 제한`);
  if (res.status === 401 || res.status === 403) throw new ProviderError('not_configured', `${name} 인증 실패 (키 확인 필요)`);
  if (!res.ok) throw new ProviderError('provider_error', `${name} 오류 ${res.status}`);
  const audio = new Uint8Array(await res.arrayBuffer());
  if (audio.byteLength < 500) throw new ProviderError('invalid_response', `${name}가 빈 음성을 반환했습니다`);
  return { audio, contentType: res.headers.get('content-type')?.startsWith('audio/') ? res.headers.get('content-type')! : 'audio/mpeg' };
}

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

/**
 * Azure AI Speech (신경망 음성, 현대 표준 아랍어 ar-SA 음성 제공).
 * 필요: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (예: koreacentral). 이 환경에서는 키가 없어 실제 호출은 검증하지 못했다.
 */
export const azureProvider: TtsProvider = {
  id: 'azure',
  get voiceKey() {
    return `azure:${config.tts.azureVoice}`;
  },
  async available() {
    return !!(config.tts.azureKey && config.tts.azureRegion);
  },
  async synthesize(text: string) {
    const voice = config.tts.azureVoice;
    const ssml = `<speak version="1.0" xml:lang="ar-SA"><voice name="${xmlEscape(voice)}"><prosody rate="-10%">${xmlEscape(text)}</prosody></voice></speak>`;
    const res = await fetchWithTimeout(
      `https://${config.tts.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': config.tts.azureKey!,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'arabic-village',
        },
        body: ssml,
      },
      15_000,
    );
    return audioOrThrow(res, 'Azure Speech');
  },
};

/**
 * OpenAI 음성 합성 (/v1/audio/speech). 필요: OPENAI_API_KEY. 실제 호출은 키가 없어 검증하지 못했다.
 */
export const openaiProvider: TtsProvider = {
  id: 'openai',
  get voiceKey() {
    return `openai:${config.tts.openaiModel}:${config.tts.openaiVoice}`;
  },
  async available() {
    return !!config.tts.openaiKey;
  },
  async synthesize(text: string) {
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/audio/speech',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.tts.openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.tts.openaiModel,
          voice: config.tts.openaiVoice,
          input: text,
          response_format: 'mp3',
          instructions: 'Read this Modern Standard Arabic text clearly and a little slowly for a beginner, pronouncing every written vowel mark.',
        }),
      },
      20_000,
    );
    return audioOrThrow(res, 'OpenAI TTS');
  },
};
