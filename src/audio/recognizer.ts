import { LIMITS } from '../shared/conversation';

/**
 * 아랍어 음성 입력.
 * - browser: Web Speech API SpeechRecognition (lang=ar-SA). Chrome 계열에서는 음성이 브라우저 공급자(Google) 서버로 전송된다.
 * - server:  MediaRecorder로 녹음해 /api/stt 로 보낸다 (서버에 설정된 음성 인식 공급자 사용). 녹음 파일은 저장하지 않는다.
 * 인식 결과는 바로 보내지 않고 입력창에 넣어 플레이어가 확인·수정하게 한다.
 */

export type SttEngine = 'browser' | 'server';
export type SttState = 'requesting' | 'listening' | 'processing' | 'idle';
export type SttFailReason = 'unsupported' | 'insecure' | 'permission' | 'no-device' | 'no-speech' | 'too-short' | 'network' | 'timeout' | 'server' | 'not-configured' | 'rate-limited' | 'cancelled';
export type SttResult = { ok: true; text: string; engine: SttEngine } | { ok: false; reason: SttFailReason };

export const STT_MESSAGES: Record<Exclude<SttFailReason, 'cancelled'>, string> = {
  unsupported: '이 브라우저는 음성 입력을 지원하지 않아요. 키보드로 입력해 주세요.',
  insecure: '마이크는 HTTPS 또는 localhost 주소에서만 쓸 수 있어요.',
  permission: '마이크 권한이 거부되었어요. 주소창의 마이크 설정에서 허용하거나, 키보드로 입력해 주세요.',
  'no-device': '마이크를 찾지 못했어요. 연결을 확인하거나 키보드로 입력해 주세요.',
  'no-speech': '목소리가 들리지 않았어요. 마이크에 조금 더 가까이 대고 다시 말해 볼까요?',
  'too-short': '너무 짧게 녹음됐어요. 버튼을 누르고 말한 뒤 다시 눌러 주세요.',
  network: '네트워크 문제로 음성을 인식하지 못했어요. 다시 시도하거나 키보드로 입력해 주세요.',
  timeout: '음성 인식이 너무 오래 걸려 취소했어요. 다시 시도해 주세요.',
  server: '음성을 인식하지 못했어요. 다시 말해 보거나 키보드로 입력해 주세요.',
  'not-configured': '서버 음성 인식이 설정되지 않았어요. 키보드로 입력하거나 브라우저 인식을 사용해 주세요.',
  'rate-limited': '음성 인식 요청이 많아 잠시 쉬어야 해요. 조금 뒤에 다시 시도해 주세요.',
};

interface Callbacks {
  onState(state: SttState): void;
  /** 입력 음량 0~1 (서버 녹음 모드) */
  onLevel?(level: number): void;
  /** 중간 인식 결과 (브라우저 모드) */
  onInterim?(text: string): void;
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function recognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  return ((w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined) ?? null;
}

export function browserSttSupported(): boolean {
  return typeof window !== 'undefined' && recognitionCtor() !== null;
}

export function recorderSupported(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

function pickMime(): string {
  const prefs = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return prefs.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '';
}

/** 최소 녹음 길이(ms)와 무음 판정 기준 (RMS 최대값) */
const MIN_MS = 600;
const SILENCE_RMS = 0.012;

export class VoiceInput {
  private stopFn: (() => void) | null = null;
  private cancelFn: (() => void) | null = null;

  get active(): boolean {
    return this.stopFn !== null;
  }

  /** 말하기 시작. 결과(또는 실패)가 나오면 끝난다. 완료하려면 stop(), 취소하려면 cancel() */
  start(engine: SttEngine, cb: Callbacks, apiBase = '/'): Promise<SttResult> {
    if (typeof window !== 'undefined' && !window.isSecureContext) return Promise.resolve({ ok: false, reason: 'insecure' });
    return engine === 'browser' ? this.startBrowser(cb) : this.startServer(cb, apiBase);
  }

  /** 녹음을 끝내고 인식 결과를 기다린다 */
  stop(): void {
    this.stopFn?.();
  }

  cancel(): void {
    this.cancelFn?.();
  }

  private finish(): void {
    this.stopFn = null;
    this.cancelFn = null;
  }

  private startBrowser(cb: Callbacks): Promise<SttResult> {
    const Ctor = recognitionCtor();
    if (!Ctor) return Promise.resolve({ ok: false, reason: 'unsupported' });
    return new Promise<SttResult>((resolve) => {
      const rec = new Ctor();
      rec.lang = 'ar-SA';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let finalText = '';
      let interim = '';
      let failed: SttFailReason | null = null;
      let cancelled = false;
      cb.onState('requesting');
      let started = false;
      rec.onstart = () => {
        started = true;
        cb.onState('listening');
      };
      rec.onresult = (e) => {
        interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        cb.onInterim?.((finalText + interim).trim());
      };
      rec.onerror = (e) => {
        failed =
          e.error === 'not-allowed' || e.error === 'service-not-allowed'
            ? 'permission'
            : e.error === 'no-speech'
              ? 'no-speech'
              : e.error === 'audio-capture'
                ? 'no-device'
                : e.error === 'network'
                  ? 'network'
                  : e.error === 'aborted'
                    ? 'cancelled'
                    : e.error === 'language-not-supported'
                      ? 'unsupported'
                      : 'server';
      };
      let done = false;
      const settle = () => {
        if (done) return;
        done = true;
        clearTimeout(startWatch);
        clearTimeout(maxWatch);
        this.finish();
        cb.onState('idle');
        const text = (finalText || interim).trim();
        if (cancelled) resolve({ ok: false, reason: 'cancelled' });
        else if (text) resolve({ ok: true, text, engine: 'browser' });
        else resolve({ ok: false, reason: failed ?? 'no-speech' });
      };
      rec.onend = settle;
      // 인식 서비스가 시작하지도 끝나지도 않는 브라우저가 있다 → 감시 타이머로 무한 대기를 막는다
      const giveUp = (reason: SttFailReason) => {
        failed ??= reason;
        try {
          rec.abort();
        } catch {
          // 무시
        }
        setTimeout(settle, 800); // onend가 오지 않아도 끝낸다
      };
      const startWatch = setTimeout(() => !started && giveUp('network'), 6000);
      const maxWatch = setTimeout(() => giveUp('timeout'), (LIMITS.recordSeconds + 8) * 1000);
      this.stopFn = () => rec.stop();
      this.cancelFn = () => {
        cancelled = true;
        giveUp('network');
      };
      try {
        rec.start();
      } catch {
        failed = 'unsupported';
        settle();
      }
    });
  }

  private async startServer(cb: Callbacks, apiBase: string): Promise<SttResult> {
    if (!recorderSupported()) return { ok: false, reason: 'unsupported' };
    cb.onState('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (e) {
      cb.onState('idle');
      const name = (e as Error)?.name;
      return { ok: false, reason: name === 'NotAllowedError' || name === 'SecurityError' ? 'permission' : name === 'NotFoundError' ? 'no-device' : 'unsupported' };
    }

    const mime = pickMime();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    let peak = 0;
    let ctx: AudioContext | null = null;
    let raf = 0;
    try {
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        peak = Math.max(peak, rms);
        cb.onLevel?.(Math.min(1, rms * 8));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      peak = 1; // 음량 측정을 못 하면 무음 판정을 하지 않는다
    }

    const cleanup = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
      this.finish();
    };

    const startedAt = performance.now();
    let cancelled = false;
    const stopped = new Promise<void>((resolve) => {
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => resolve();
    });
    const autoStop = setTimeout(() => recorder.state === 'recording' && recorder.stop(), LIMITS.recordSeconds * 1000);
    this.stopFn = () => recorder.state === 'recording' && recorder.stop();
    const abort = new AbortController();
    this.cancelFn = () => {
      cancelled = true;
      abort.abort();
      if (recorder.state === 'recording') recorder.stop();
    };
    recorder.start(250);
    cb.onState('listening');
    await stopped;
    clearTimeout(autoStop);
    const durationMs = performance.now() - startedAt;
    cleanup();

    if (cancelled) {
      cb.onState('idle');
      return { ok: false, reason: 'cancelled' };
    }
    if (durationMs < MIN_MS) {
      cb.onState('idle');
      return { ok: false, reason: 'too-short' };
    }
    if (peak < SILENCE_RMS) {
      cb.onState('idle');
      return { ok: false, reason: 'no-speech' };
    }
    const blob = new Blob(chunks, { type: (recorder.mimeType || mime || 'audio/webm').split(';')[0] });
    if (blob.size > LIMITS.sttBytes) {
      cb.onState('idle');
      return { ok: false, reason: 'server' };
    }

    cb.onState('processing');
    // 처리 중에도 취소할 수 있게 한다
    this.cancelFn = () => {
      cancelled = true;
      abort.abort();
    };
    const timer = setTimeout(() => abort.abort(), 25_000);
    try {
      const res = await fetch(`${apiBase}api/stt`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob, signal: abort.signal });
      if (res.status === 429) return { ok: false, reason: 'rate-limited' };
      if (res.status === 503) return { ok: false, reason: 'not-configured' };
      if (res.status === 504) return { ok: false, reason: 'timeout' };
      if (!res.ok) return { ok: false, reason: 'server' };
      const data = (await res.json()) as { text?: unknown };
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      return text ? { ok: true, text, engine: 'server' } : { ok: false, reason: 'no-speech' };
    } catch {
      if (cancelled) return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: abort.signal.aborted ? 'timeout' : 'network' };
    } finally {
      clearTimeout(timer);
      this.finish();
      cb.onState('idle');
    }
  }
}
