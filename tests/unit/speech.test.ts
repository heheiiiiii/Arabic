import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeUtter {
  text: string;
  lang: string;
  voice: unknown;
  rate: number;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (e: { error: string }) => void;
}

/** 브라우저 speechSynthesis 흉내: speak하면 곧 onstart, cancel하면 재생 중인 발화에 'interrupted' 오류 */
function installFake(voices: { name: string; lang: string; localService?: boolean }[], mode: 'ok' | 'fail' = 'ok') {
  const log: string[] = [];
  let active: FakeUtter | null = null;
  const synth = {
    getVoices: () => voices,
    addEventListener: () => {},
    removeEventListener: () => {},
    speak(u: FakeUtter) {
      log.push(`speak:${u.text}`);
      if (active) log.push('OVERLAP');
      active = u;
      setTimeout(() => {
        if (active !== u) return;
        if (mode === 'fail') {
          active = null;
          u.onerror?.({ error: 'synthesis-failed' });
        } else u.onstart?.();
      }, 0);
    },
    cancel() {
      log.push('cancel');
      const u = active;
      active = null;
      u?.onerror?.({ error: 'interrupted' });
    },
    finish() {
      const u = active;
      active = null;
      u?.onend?.();
    },
  };
  const g = globalThis as Record<string, unknown>;
  g.window = globalThis;
  g.speechSynthesis = synth;
  g.SpeechSynthesisUtterance = class {
    lang = '';
    voice: unknown = null;
    rate = 1;
    constructor(public text: string) {}
  };
  return { log, synth };
}

async function loadSpeech() {
  vi.resetModules();
  return (await import('../../src/audio/speech')).speech;
}

describe('음성 출력', () => {
  beforeEach(() => {
    const g = globalThis as Record<string, unknown>;
    delete g.speechSynthesis;
    delete g.SpeechSynthesisUtterance;
  });

  it('API가 없으면 unsupported', async () => {
    (globalThis as Record<string, unknown>).window = globalThis;
    const speech = await loadSpeech();
    expect(await speech.speak('مَرْحَبًا', 'a')).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('아랍어 음성이 없으면 다른 언어 음성으로 읽지 않고 no-voice', async () => {
    const { log } = installFake([{ name: 'English', lang: 'en-US' }]);
    const speech = await loadSpeech();
    expect(await speech.speak('مَرْحَبًا', 'a')).toEqual({ ok: false, reason: 'no-voice' });
    expect(log.filter((l) => l.startsWith('speak'))).toEqual([]);
  });

  it('아랍어 음성(ar-SA 우선)으로 원문 그대로 읽는다', async () => {
    const { log } = installFake([
      { name: 'Egypt', lang: 'ar-EG' },
      { name: 'Saudi', lang: 'ar-SA' },
    ]);
    const speech = await loadSpeech();
    const info = await speech.info();
    expect(info.voice?.lang).toBe('ar-SA');
    expect(await speech.speak('كَيْفَ الْحَالُ؟', 'a')).toEqual({ ok: true, engine: 'browser' });
    expect(log).toContain('speak:كَيْفَ الْحَالُ؟');
    expect(speech.currentKey).toBe('a');
  });

  it('같은 버튼을 다시 누르면 멈추고, 다른 버튼을 누르면 이전 음성을 끊고 재생한다 (겹치지 않음)', async () => {
    const { log } = installFake([{ name: 'Saudi', lang: 'ar-SA' }]);
    const speech = await loadSpeech();
    await speech.speak('مَرْحَبًا', 'a');
    expect(await speech.speak('مَرْحَبًا', 'a')).toEqual({ ok: false, reason: 'stopped' });
    expect(speech.currentKey).toBeNull();
    await speech.speak('شُكْرًا', 'b');
    await speech.speak('عَفْوًا', 'c');
    expect(speech.currentKey).toBe('c');
    expect(log).not.toContain('OVERLAP');
  });

  it('stop()은 재생 상태를 지우고 구독자에게 알린다', async () => {
    installFake([{ name: 'Saudi', lang: 'ar-SA' }]);
    const speech = await loadSpeech();
    const seen: string[] = [];
    speech.subscribe((k, st) => seen.push(`${k}:${st}`));
    await speech.speak('مَرْحَبًا', 'a');
    await new Promise((r) => setTimeout(r, 0));
    speech.stop();
    expect(seen).toEqual(['a:loading', 'a:playing', 'null:null']);
    expect(speech.currentKey).toBeNull();
  });

  it('재생이 실패하면 error를 돌려준다', async () => {
    installFake([{ name: 'Saudi', lang: 'ar-SA' }], 'fail');
    const speech = await loadSpeech();
    expect(await speech.speak('مَرْحَبًا', 'a')).toEqual({ ok: false, reason: 'error' });
    expect(speech.currentKey).toBeNull();
  });

  it('재생이 끝나면 재생 상태가 풀린다', async () => {
    const { synth } = installFake([{ name: 'Saudi', lang: 'ar-SA' }]);
    const speech = await loadSpeech();
    await speech.speak('مَرْحَبًا', 'a');
    await new Promise((r) => setTimeout(r, 0));
    expect(speech.currentKey).toBe('a');
    synth.finish();
    await new Promise((r) => setTimeout(r, 0));
    expect(speech.currentKey).toBeNull();
  });
});
