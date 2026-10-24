/** 플레이어 설정 (저장 데이터에 함께 저장). 성별·외형은 state.ts의 PlayerProfile에 있다. */
export interface Settings {
  /** 음성 출력: auto = 브라우저 아랍어 음성 → 미리 만든 음성 → 서버 음성 순서로 시도 */
  ttsEngine: 'auto' | 'browser' | 'audio';
  /** 느린 속도로 듣기 */
  slow: boolean;
  /** 주민 대사를 자동으로 읽어 주기 */
  autoplay: boolean;
  /** 음성 입력: auto = 서버 인식이 있으면 서버, 없으면 브라우저 인식 */
  sttEngine: 'auto' | 'browser' | 'server' | 'off';
  /** 녹음을 외부 음성 인식 서비스로 보내는 데 동의했는지 */
  sttConsent: boolean;
}

export function defaultSettings(): Settings {
  return { ttsEngine: 'auto', slow: false, autoplay: true, sttEngine: 'auto', sttConsent: false };
}

export function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const oneOf = <T extends string>(v: unknown, xs: readonly T[], fb: T): T => (xs.includes(v as T) ? (v as T) : fb);
  return {
    ttsEngine: oneOf(r.ttsEngine, ['auto', 'browser', 'audio'] as const, d.ttsEngine),
    slow: typeof r.slow === 'boolean' ? r.slow : d.slow,
    autoplay: typeof r.autoplay === 'boolean' ? r.autoplay : d.autoplay,
    sttEngine: oneOf(r.sttEngine, ['auto', 'browser', 'server', 'off'] as const, d.sttEngine),
    sttConsent: r.sttConsent === true,
  };
}
