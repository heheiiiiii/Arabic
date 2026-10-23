/**
 * 브라우저 음성 출력 (Web Speech API, speechSynthesis).
 * - API 키가 필요 없지만, 아랍어 음성의 유무와 품질은 기기·브라우저마다 다르다.
 * - 한 번에 한 문장만 재생한다 (새로 재생하면 이전 음성을 멈춘다).
 * - 같은 버튼(key)을 재생 중에 다시 누르면 멈춘다.
 */

export type SpeakResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'no-voice' | 'error' | 'stopped' };

export interface VoiceInfo {
  supported: boolean;
  /** 사용할 아랍어 음성 (없으면 null) */
  voice: { name: string; lang: string; local: boolean } | null;
  /** 기기에 있는 전체 음성 수 (0이면 목록을 알 수 없는 환경) */
  totalVoices: number;
}

export const SPEECH_MESSAGES: Record<Exclude<SpeakResult, { ok: true }>['reason'], string> = {
  unsupported: '이 브라우저는 음성 출력을 지원하지 않아요.',
  'no-voice': '이 기기에는 아랍어 음성이 없어요. 기기 설정에서 아랍어 음성을 추가하면 들을 수 있어요.',
  error: '음성을 재생하지 못했어요. 잠시 후 다시 눌러 보세요.',
  stopped: '',
};

/** 학습용 기본 속도 (조금 천천히) */
export const RATE_NORMAL = 0.85;
export const RATE_SLOW = 0.6;

type Listener = (playingKey: string | null) => void;

class Speech {
  private playingKey: string | null = null;
  private listeners = new Set<Listener>();
  private voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;
  /** 재생 시도마다 증가. 이전 시도의 늦은 콜백을 무시하는 데 쓴다. */
  private token = 0;

  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  get currentKey(): string | null {
    return this.playingKey;
  }

  /** 재생 상태 변화를 구독한다. 반환값을 호출하면 구독 해제. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setPlaying(key: string | null): void {
    this.playingKey = key;
    for (const fn of this.listeners) fn(key);
  }

  /** 음성 목록은 비동기로 채워지는 브라우저가 많아 잠시 기다린다. */
  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.supported) return Promise.resolve([]);
    const now = speechSynthesis.getVoices();
    if (now.length > 0) return Promise.resolve(now);
    if (!this.voicesPromise) {
      this.voicesPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
        const done = () => {
          speechSynthesis.removeEventListener('voiceschanged', done);
          resolve(speechSynthesis.getVoices());
        };
        speechSynthesis.addEventListener('voiceschanged', done);
        setTimeout(done, 1500);
      }).then((v) => {
        if (v.length === 0) this.voicesPromise = null; // 다음에 다시 시도
        return v;
      });
    }
    return this.voicesPromise;
  }

  /** 표준 아랍어에 가까운 음성을 고른다: ar-SA → 그 밖의 ar-* 순서. */
  private pickArabic(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    const ar = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('ar'));
    return ar.find((v) => v.lang.toLowerCase().replace('_', '-') === 'ar-sa') ?? ar[0] ?? null;
  }

  async info(): Promise<VoiceInfo> {
    if (!this.supported) return { supported: false, voice: null, totalVoices: 0 };
    const voices = await this.loadVoices();
    const v = this.pickArabic(voices);
    return { supported: true, voice: v ? { name: v.name, lang: v.lang, local: v.localService } : null, totalVoices: voices.length };
  }

  /**
   * text를 읽는다. 재생이 "시작되면" ok, 시작하지 못하면 이유를 돌려준다.
   * key: 버튼 식별자. 같은 key가 재생 중이면 멈추고 { ok: false, reason: 'stopped' }.
   */
  async speak(text: string, key: string, rate = RATE_NORMAL): Promise<SpeakResult> {
    try {
      return await this.speakUnsafe(text, key, rate);
    } catch {
      // 브라우저마다 Web Speech 구현이 달라 예외가 날 수 있다. 버튼이 멈추지 않도록 실패로 처리한다.
      if (this.playingKey !== null) this.setPlaying(null);
      return { ok: false, reason: 'error' };
    }
  }

  private async speakUnsafe(text: string, key: string, rate: number): Promise<SpeakResult> {
    if (!this.supported) return { ok: false, reason: 'unsupported' };
    if (this.playingKey === key) {
      this.stop();
      return { ok: false, reason: 'stopped' };
    }
    this.stop();
    const myToken = ++this.token;

    const voices = await this.loadVoices();
    if (myToken !== this.token) return { ok: false, reason: 'stopped' }; // 기다리는 동안 다른 요청이 들어옴
    const voice = this.pickArabic(voices);
    // 음성 목록이 있는데 아랍어가 없으면, 영어 음성으로 엉뚱하게 읽지 않도록 재생하지 않는다.
    if (voices.length > 0 && !voice) return { ok: false, reason: 'no-voice' };

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = voice?.lang ?? 'ar-SA';
    if (voice) utter.voice = voice;
    utter.rate = rate;

    return new Promise<SpeakResult>((resolve) => {
      let settled = false;
      const settle = (r: SpeakResult) => {
        if (!settled) {
          settled = true;
          resolve(r);
        }
      };
      utter.onstart = () => {
        if (myToken !== this.token) return;
        this.setPlaying(key);
        settle({ ok: true });
      };
      utter.onend = () => {
        if (myToken === this.token) this.setPlaying(null);
        settle({ ok: false, reason: 'error' }); // 시작 전에 끝나는 경우
      };
      utter.onerror = (e) => {
        if (myToken === this.token) this.setPlaying(null);
        const interrupted = e.error === 'interrupted' || e.error === 'canceled';
        settle({ ok: false, reason: interrupted ? 'stopped' : voice ? 'error' : 'no-voice' });
      };
      // 음성 목록이 비어 있는 환경에서 아무 반응이 없으면 실패로 본다.
      setTimeout(() => {
        if (!settled && myToken === this.token) {
          speechSynthesis.cancel();
          settle({ ok: false, reason: voice ? 'error' : 'no-voice' });
        }
      }, 4000);
      speechSynthesis.speak(utter);
    });
  }

  /** 재생 중인 음성을 멈춘다 (화면을 닫거나 다른 항목으로 넘어갈 때). */
  stop(): void {
    this.token++;
    if (this.supported) speechSynthesis.cancel();
    if (this.playingKey !== null) this.setPlaying(null);
  }
}

export const speech = new Speech();
