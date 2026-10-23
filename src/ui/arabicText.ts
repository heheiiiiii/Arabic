import { RATE_NORMAL, RATE_SLOW, speech, SPEECH_MESSAGES } from '../audio/speech';
import { el } from './dom';
import { showToast } from './toast';

/**
 * 아랍어가 섞인 한국어 설명을 안전하게 표시한다.
 * 아랍어 구간만 찾아 <bdi dir="rtl">로 감싼다. 글자 순서는 바꾸지 않고, 경계에서 나누기만 한다.
 */
const ARABIC_RUN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+(?:[ \u060C\u061F]+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+)*/g;

export function mixedText(text: string, className = ''): HTMLElement {
  const p = el('p', { class: `mixed ${className}`.trim(), lang: 'ko', dir: 'ltr' });
  let last = 0;
  for (const m of text.matchAll(ARABIC_RUN)) {
    const start = m.index ?? 0;
    if (start > last) p.append(text.slice(last, start));
    p.append(el('bdi', { lang: 'ar', dir: 'rtl', class: 'ar-inline' }, m[0]));
    last = start + m[0].length;
  }
  if (last < text.length) p.append(text.slice(last));
  return p;
}

// ── 듣기 버튼 ─────────────────────────────────────────

let slowMode = false;

export function isSlowMode(): boolean {
  return slowMode;
}

export function setSlowMode(on: boolean): void {
  slowMode = on;
}

// 재생 상태가 바뀌면 화면의 모든 듣기 버튼 표시를 갱신한다 (버튼별 구독이 없어 메모리 누수가 없다).
speech.subscribe((key) => {
  document.querySelectorAll<HTMLButtonElement>('[data-speech-key]').forEach((b) => {
    const playing = b.dataset.speechKey === key;
    b.classList.toggle('is-playing', playing);
    b.setAttribute('aria-pressed', String(playing));
  });
});

let keySeq = 0;

/** 아랍어 원문을 읽어 주는 버튼. 재생 중에 다시 누르면 멈춘다. */
export function listenButton(text: string, opts: { label?: string; small?: boolean; title?: string } = {}): HTMLButtonElement {
  const key = `sp${++keySeq}`;
  const btn = el(
    'button',
    {
      type: 'button',
      class: `btn btn-listen${opts.small ? ' btn-listen--small' : ''}`,
      'data-speech-key': key,
      'aria-pressed': 'false',
      'aria-label': opts.title ?? '아랍어 발음 듣기',
      title: opts.title ?? '아랍어 발음 듣기',
    },
    el('span', { class: 'btn-listen__icon', 'aria-hidden': 'true' }, '🔊'),
    ...(opts.label ? [el('span', {}, opts.label)] : []),
  );
  btn.addEventListener('click', async () => {
    const result = await speech.speak(text, key, slowMode ? RATE_SLOW : RATE_NORMAL);
    if (!result.ok && result.reason !== 'stopped') showToast(SPEECH_MESSAGES[result.reason], 3200);
  });
  return btn;
}
