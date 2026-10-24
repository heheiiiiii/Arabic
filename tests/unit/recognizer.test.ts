import { afterEach, describe, expect, it, vi } from 'vitest';

/** 브라우저 SpeechRecognition 흉내 (모의) */
function installRecognition(script: (rec: FakeRec) => void) {
  class FakeRec {
    lang = '';
    interimResults = false;
    continuous = false;
    maxAlternatives = 1;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    onstart: (() => void) | null = null;
    start() {
      setTimeout(() => {
        this.onstart?.();
        script(this);
      }, 0);
    }
    stop() {
      setTimeout(() => this.onend?.(), 0);
    }
    abort() {
      this.onerror?.({ error: 'aborted' });
      setTimeout(() => this.onend?.(), 0);
    }
    say(text: string, isFinal = true) {
      const r = Object.assign([{ transcript: text }], { isFinal });
      this.onresult?.({ resultIndex: 0, results: [r] });
    }
  }
  type FakeRec = InstanceType<typeof FakeRec>;
  vi.stubGlobal('window', { isSecureContext: true, webkitSpeechRecognition: FakeRec });
  return FakeRec;
}

const cb = () => ({ states: [] as string[], onState(s: string) { this.states.push(s); } });

afterEach(() => vi.unstubAllGlobals());

describe('음성 입력 (브라우저 인식, 모의)', () => {
  it('ar-SA로 인식하고 결과 텍스트를 돌려준다', async () => {
    let lang = '';
    installRecognition((rec) => {
      lang = rec.lang;
      rec.say('مرحبا');
      rec.stop();
    });
    const { VoiceInput } = await import('../../src/audio/recognizer');
    const c = cb();
    const r = await new VoiceInput().start('browser', c);
    expect(r).toEqual({ ok: true, text: 'مرحبا', engine: 'browser' });
    expect(lang).toBe('ar-SA');
    expect(c.states).toEqual(['requesting', 'listening', 'idle']);
  });

  it('권한 거부·무음·빈 결과·취소를 구분한다', async () => {
    const { VoiceInput } = await import('../../src/audio/recognizer');
    installRecognition((rec) => {
      rec.onerror?.({ error: 'not-allowed' });
      rec.stop();
    });
    expect(await new VoiceInput().start('browser', cb())).toEqual({ ok: false, reason: 'permission' });
    installRecognition((rec) => {
      rec.onerror?.({ error: 'no-speech' });
      rec.stop();
    });
    expect(await new VoiceInput().start('browser', cb())).toEqual({ ok: false, reason: 'no-speech' });
    installRecognition((rec) => rec.stop());
    expect(await new VoiceInput().start('browser', cb())).toEqual({ ok: false, reason: 'no-speech' });
    installRecognition(() => {});
    const vi2 = new VoiceInput();
    const p = vi2.start('browser', cb());
    await new Promise((r) => setTimeout(r, 5));
    vi2.cancel();
    expect(await p).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('HTTPS가 아닌 주소에서는 마이크를 쓰지 않는다', async () => {
    vi.stubGlobal('window', { isSecureContext: false });
    const { VoiceInput } = await import('../../src/audio/recognizer');
    expect(await new VoiceInput().start('server', cb())).toEqual({ ok: false, reason: 'insecure' });
  });

  it('서버 녹음 모드: 마이크 권한 거부를 알린다', async () => {
    vi.stubGlobal('window', { isSecureContext: true });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })) } });
    vi.stubGlobal('MediaRecorder', class {});
    const { VoiceInput } = await import('../../src/audio/recognizer');
    expect(await new VoiceInput().start('server', cb())).toEqual({ ok: false, reason: 'permission' });
  });
});
