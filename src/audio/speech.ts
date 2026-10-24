import { getSettings } from '../game/state';
import { prebuiltAudioPath } from '../shared/hash';

/**
 * 아랍어 음성 출력.
 *
 * 엔진 (설정 ttsEngine)
 * - browser: 브라우저 Web Speech API(speechSynthesis)의 아랍어 음성. 기기에 아랍어 음성이 있어야 한다.
 * - audio:   오디오 파일 재생. ① 빌드 때 미리 만든 학습 문장 MP3(public/audio/tts) → ② 서버 /api/tts
 * - auto:    아랍어 음성이 있으면 browser, 없거나 실패하면 audio로 자동 전환
 *
 * 한 번에 하나만 재생한다. 같은 버튼(key)을 재생 중에 다시 누르면 멈춘다.
 * "함수를 호출했다"가 아니라 실제 재생이 시작됐을 때만 ok를 돌려준다.
 */

export type FailReason = 'unsupported' | 'no-voice' | 'error' | 'stopped' | 'blocked';
export type SpeakResult = { ok: true; engine: 'browser' | 'audio'; source?: string } | { ok: false; reason: FailReason };

export interface VoiceInfo {
  supported: boolean;
  /** 사용할 브라우저 아랍어 음성 (없으면 null) */
  voice: { name: string; lang: string; local: boolean } | null;
  /** 기기에 있는 전체 음성 수 (0이면 목록을 알 수 없는 환경) */
  totalVoices: number;
}

export const SPEECH_MESSAGES: Record<Exclude<FailReason, 'stopped'>, string> = {
  unsupported: '이 브라우저에서는 음성을 재생할 수 없어요. 글자와 발음 표기로 계속할 수 있어요.',
  'no-voice': '아랍어 음성을 찾지 못했어요. (기기에 아랍어 음성이 없고 음성 서버에도 연결하지 못함) 글자와 발음 표기로 계속할 수 있어요.',
  error: '음성을 재생하지 못했어요. 잠시 후 다시 눌러 보세요.',
  blocked: '브라우저가 자동 재생을 막았어요. 🔊 버튼을 직접 눌러 주세요.',
};

/** 학습용 속도 */
export const RATE_NORMAL = 0.9;
export const RATE_SLOW = 0.65;
const AUDIO_RATE_SLOW = 0.75;

export type PlayState = 'loading' | 'playing';
type Listener = (key: string | null, state: PlayState | null) => void;

interface Playback {
  /** 재생 시작 여부 */
  started: Promise<SpeakResult>;
  /** 재생이 끝나거나 멈추면 끝남 */
  done: Promise<void>;
}

const hasWindow = () => typeof window !== 'undefined';

class Speech {
  private playingKey: string | null = null;
  private state: PlayState | null = null;
  private listeners = new Set<Listener>();
  private voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;
  /** 재생 시도마다 증가. 이전 시도의 늦은 콜백을 무시한다. */
  private token = 0;
  private audioEl: HTMLAudioElement | null = null;
  private urlCache = new Map<string, string>();
  /** 마지막으로 성공한 엔진 (진단 표시용) */
  lastEngine: string | null = null;

  get browserSupported(): boolean {
    return hasWindow() && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  get audioSupported(): boolean {
    return typeof Audio !== 'undefined' && typeof fetch !== 'undefined';
  }

  get supported(): boolean {
    return this.browserSupported || this.audioSupported;
  }

  get currentKey(): string | null {
    return this.playingKey;
  }

  get currentState(): PlayState | null {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(key: string | null, state: PlayState | null): void {
    this.playingKey = key;
    this.state = state;
    for (const fn of this.listeners) fn(key, state);
  }

  // ── 브라우저 음성 ─────────────────────────────────────

  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.browserSupported) return Promise.resolve([]);
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
        if (v.length === 0) this.voicesPromise = null;
        return v;
      });
    }
    return this.voicesPromise;
  }

  /** 표준 아랍어에 가까운 음성: ar-SA → 그 밖의 ar-* */
  private pickArabic(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    const norm = (v: SpeechSynthesisVoice) => (v.lang ?? '').toLowerCase().replace('_', '-');
    const ar = voices.filter((v) => norm(v).startsWith('ar'));
    return ar.find((v) => norm(v) === 'ar-sa') ?? ar[0] ?? null;
  }

  async info(): Promise<VoiceInfo> {
    if (!this.browserSupported) return { supported: false, voice: null, totalVoices: 0 };
    const voices = await this.loadVoices();
    const v = this.pickArabic(voices);
    return { supported: true, voice: v ? { name: v.name, lang: v.lang, local: v.localService } : null, totalVoices: voices.length };
  }

  private playBrowser(text: string, rate: number, voice: SpeechSynthesisVoice | null, myToken: number): Playback {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = voice?.lang ?? 'ar-SA';
    if (voice) {
      try {
        utter.voice = voice;
      } catch {
        // 일부 환경은 음성 객체 지정을 거부한다 → 언어 코드만으로 시도
      }
    }
    utter.rate = rate;
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => (resolveDone = r));
    const started = new Promise<SpeakResult>((resolve) => {
      let settled = false;
      const settle = (r: SpeakResult) => {
        if (!settled) {
          settled = true;
          resolve(r);
        }
      };
      utter.onstart = () => settle({ ok: true, engine: 'browser' });
      utter.onend = () => {
        settle({ ok: false, reason: 'error' }); // 시작 없이 끝난 경우
        resolveDone();
      };
      utter.onerror = (e) => {
        const interrupted = e.error === 'interrupted' || e.error === 'canceled';
        settle({ ok: false, reason: interrupted ? 'stopped' : voice ? 'error' : 'no-voice' });
        resolveDone();
      };
      // 아무 반응이 없으면 실패로 본다 (음성이 없는 환경에서 흔함)
      setTimeout(() => {
        if (!settled && myToken === this.token) {
          speechSynthesis.cancel();
          settle({ ok: false, reason: voice ? 'error' : 'no-voice' });
          resolveDone();
        }
      }, 4000);
      speechSynthesis.speak(utter);
    });
    return { started, done };
  }

  // ── 오디오 파일 ─────────────────────────────────────

  /** 미리 만든 파일 → 서버 순서로 MP3를 찾는다. 없으면 null */
  private async fetchAudio(text: string, myToken: number): Promise<{ url: string; source: string } | null> {
    const cached = this.urlCache.get(text);
    if (cached) return { url: cached, source: 'cache' };
    const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
    const candidates = [
      { url: `${base}${prebuiltAudioPath(text)}`, source: 'prebuilt' },
      { url: `${base}api/tts?text=${encodeURIComponent(text)}`, source: 'server' },
    ];
    for (const c of candidates) {
      if (myToken !== this.token) return null;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15_000);
        const res = await fetch(c.url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
        if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('audio/')) continue;
        const blob = await res.blob();
        if (blob.size < 500) continue;
        const url = URL.createObjectURL(blob);
        this.urlCache.set(text, url);
        if (this.urlCache.size > 60) {
          const [k, v] = this.urlCache.entries().next().value as [string, string];
          URL.revokeObjectURL(v);
          this.urlCache.delete(k);
        }
        return { url, source: c.source };
      } catch {
        // 다음 후보
      }
    }
    return null;
  }

  private async playAudio(text: string, slow: boolean, myToken: number): Promise<Playback | { ok: false; reason: FailReason }> {
    const found = await this.fetchAudio(text, myToken);
    if (myToken !== this.token) return { ok: false, reason: 'stopped' };
    if (!found) return { ok: false, reason: 'no-voice' };
    const el = new Audio(found.url);
    el.playbackRate = slow ? AUDIO_RATE_SLOW : 1;
    (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    this.audioEl = el;
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => (resolveDone = r));
    el.onended = () => resolveDone();
    el.onerror = () => resolveDone();
    el.onpause = () => resolveDone();
    const started = el.play().then(
      (): SpeakResult => ({ ok: true, engine: 'audio', source: found.source }),
      (e: Error): SpeakResult => {
        resolveDone();
        return { ok: false, reason: e?.name === 'NotAllowedError' ? 'blocked' : e?.name === 'AbortError' ? 'stopped' : 'error' };
      },
    );
    return { started, done };
  }

  // ── 공개 API ─────────────────────────────────────

  /** 한 문장 재생 (재생이 시작되면 ok) */
  speak(text: string, key: string): Promise<SpeakResult> {
    return this.speakSequence([text], key);
  }

  /**
   * 여러 문장을 화면 순서대로 차례로 재생한다. 시작 결과(첫 문장)를 돌려준다.
   * 같은 key가 재생(또는 준비) 중이면 멈춘다.
   */
  speakSequence(texts: string[], key: string): Promise<SpeakResult> {
    if (!this.supported) return Promise.resolve({ ok: false, reason: 'unsupported' });
    if (this.playingKey === key) {
      this.stop();
      return Promise.resolve({ ok: false, reason: 'stopped' });
    }
    this.stop();
    const myToken = ++this.token;
    this.setState(key, 'loading');
    let resolveFirst!: (r: SpeakResult) => void;
    const first = new Promise<SpeakResult>((r) => (resolveFirst = r));
    let reported = false;
    const report = (r: SpeakResult) => {
      if (!reported) {
        reported = true;
        resolveFirst(r);
      }
    };
    void (async () => {
      try {
        for (const text of texts.filter((t) => t.trim())) {
          const r = await this.playOne(text, myToken);
          if (myToken !== this.token) return report({ ok: false, reason: 'stopped' });
          report(r.result);
          if (!r.result.ok || !r.done) break;
          this.setState(key, 'playing');
          await r.done;
          if (myToken !== this.token) return;
        }
        report({ ok: false, reason: 'error' });
        if (myToken === this.token) this.setState(null, null);
      } catch {
        report({ ok: false, reason: 'error' });
        if (myToken === this.token) this.setState(null, null);
      }
    })();
    return first;
  }

  private async playOne(text: string, myToken: number): Promise<{ result: SpeakResult; done: Promise<void> | null }> {
    const s = getSettings();
    const voices = s.ttsEngine !== 'audio' ? await this.loadVoices() : [];
    const voice = this.pickArabic(voices);
    const order: ('browser' | 'audio')[] =
      s.ttsEngine === 'browser' ? ['browser'] : s.ttsEngine === 'audio' ? ['audio'] : voice ? ['browser', 'audio'] : ['audio', 'browser'];

    let last: SpeakResult = { ok: false, reason: 'no-voice' };
    for (const engine of order) {
      if (myToken !== this.token) return { result: { ok: false, reason: 'stopped' }, done: null };
      if (engine === 'browser') {
        if (!this.browserSupported) continue;
        // 음성 목록이 있는데 아랍어가 없으면 다른 언어 음성으로 엉뚱하게 읽지 않도록 건너뛴다.
        if (voices.length > 0 && !voice) continue;
        const pb = this.playBrowser(text, s.slow ? RATE_SLOW : RATE_NORMAL, voice, myToken);
        const r = await pb.started;
        if (r.ok) {
          this.lastEngine = `browser:${voice?.name ?? 'ar-SA'}`;
          return { result: r, done: pb.done };
        }
        last = r;
        if (r.reason === 'stopped') return { result: r, done: null };
      } else {
        if (!this.audioSupported) continue;
        const pb = await this.playAudio(text, s.slow, myToken);
        if ('ok' in pb) {
          last = pb;
          if (pb.reason === 'stopped') return { result: pb, done: null };
          continue;
        }
        const r = await pb.started;
        if (r.ok) {
          this.lastEngine = `audio:${r.source}`;
          return { result: r, done: pb.done };
        }
        last = r;
        if (r.reason === 'stopped' || r.reason === 'blocked') return { result: r, done: null };
      }
    }
    return { result: last, done: null };
  }

  /** 재생 중인 음성을 멈춘다 (화면을 닫거나 다른 항목으로 넘어갈 때) */
  stop(): void {
    this.token++;
    if (this.browserSupported) speechSynthesis.cancel();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl = null;
    }
    if (this.playingKey !== null) this.setState(null, null);
  }
}

export const speech = new Speech();
