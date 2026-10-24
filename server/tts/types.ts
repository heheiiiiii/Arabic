export interface TtsResult {
  audio: Uint8Array;
  contentType: string;
}

/** TTS 공급자 어댑터. 새 공급자는 이 인터페이스만 구현해 tts/index.ts 목록에 추가하면 된다. */
export interface TtsProvider {
  readonly id: string;
  /** 키·실행 파일 등 필요한 설정이 갖춰졌는지 */
  available(): Promise<boolean>;
  /** 캐시 키에 들어갈 음성 설정 (음성이 바뀌면 캐시도 새로 만든다) */
  readonly voiceKey: string;
  synthesize(text: string): Promise<TtsResult>;
}
