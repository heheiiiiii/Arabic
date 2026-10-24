/**
 * 서버 설정 (환경 변수). 비밀 키는 이 모듈과 공급자 어댑터 안에서만 읽고, 응답·로그로 내보내지 않는다.
 *
 * 주의: 개발 도구가 설정한 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN 같은 변수를 실수로 쓰지 않도록,
 * 이 게임 전용 이름(아래)만 읽는다.
 */
const env = (k: string) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};
const num = (k: string, d: number) => {
  const v = Number(env(k));
  return Number.isFinite(v) && v > 0 ? v : d;
};

export const config = {
  port: num('PORT', 8787),
  /** 다른 출처(도메인)에서 API를 부를 수 있게 허용할 목록 (쉼표 구분). 비우면 같은 출처만 */
  allowedOrigins: (env('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),

  chat: {
    anthropicKey: env('ANTHROPIC_API_KEY'),
    anthropicBaseUrl: env('VILLAGE_ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com',
    model: env('AI_MODEL') ?? 'claude-opus-5-5',
    effort: (env('AI_EFFORT') ?? 'low') as 'low' | 'medium' | 'high',
    timeoutMs: num('AI_TIMEOUT_MS', 30_000),
    /** 하루 전체 AI 요청 상한 (비용 보호) */
    dailyLimit: num('AI_DAILY_LIMIT', 500),
  },

  tts: {
    /** 사용할 공급자 순서. 설정된(키가 있는) 것만 실제로 쓴다. */
    order: (env('TTS_PROVIDERS') ?? 'azure,openai,espeak').split(',').map((s) => s.trim()),
    azureKey: env('AZURE_SPEECH_KEY'),
    azureRegion: env('AZURE_SPEECH_REGION'),
    azureVoice: env('AZURE_TTS_VOICE') ?? 'ar-SA-HamedNeural',
    openaiKey: env('OPENAI_API_KEY'),
    openaiModel: env('OPENAI_TTS_MODEL') ?? 'gpt-4o-mini-tts',
    openaiVoice: env('OPENAI_TTS_VOICE') ?? 'alloy',
    espeakVoice: env('ESPEAK_VOICE') ?? 'ar',
    cacheDir: env('TTS_CACHE_DIR') ?? '.cache/tts',
  },

  stt: {
    /** OpenAI 호환 음성 인식 (OpenAI 또는 같은 API를 제공하는 자체 서버) */
    apiKey: env('STT_API_KEY') ?? env('OPENAI_API_KEY'),
    baseUrl: env('STT_BASE_URL') ?? 'https://api.openai.com/v1',
    model: env('STT_MODEL') ?? 'whisper-1',
    timeoutMs: num('STT_TIMEOUT_MS', 20_000),
  },
};
