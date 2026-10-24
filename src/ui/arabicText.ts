import { speech, SPEECH_MESSAGES, type SpeakResult } from '../audio/speech';
import { getSettings, updateSettings } from '../game/state';
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

export function isSlowMode(): boolean {
  return getSettings().slow;
}

export function setSlowMode(on: boolean): void {
  updateSettings({ slow: on });
}

// 재생 상태가 바뀌면 화면의 모든 듣기 버튼 표시를 갱신한다 (버튼별 구독이 없어 메모리 누수가 없다).
speech.subscribe((key, state) => {
  document.querySelectorAll<HTMLElement>('[data-speech-key]').forEach((b) => {
    const mine = b.dataset.speechKey === key;
    b.classList.toggle('is-loading', mine && state === 'loading');
    b.classList.toggle('is-playing', mine && state === 'playing');
    b.setAttribute('aria-pressed', String(mine));
    const label = b.querySelector('.btn-listen__state');
    if (label) label.textContent = mine ? (state === 'loading' ? '준비 중…' : '정지') : '';
  });
});

let keySeq = 0;

export function newSpeechKey(): string {
  return `sp${++keySeq}`;
}

/** 재생 실패를 알린다 (멈춤은 알리지 않음) */
export function reportSpeech(result: SpeakResult): void {
  if (!result.ok && result.reason !== 'stopped') showToast(SPEECH_MESSAGES[result.reason], 3600);
}

/** 아랍어 원문을 읽어 주는 버튼. 재생 중에 다시 누르면 멈춘다. texts가 여러 개면 순서대로 읽는다. */
export function listenButton(text: string | string[], opts: { label?: string; small?: boolean; title?: string } = {}): HTMLButtonElement {
  const key = newSpeechKey();
  const texts = Array.isArray(text) ? text : [text];
  const btn = el(
    'button',
    {
      type: 'button',
      class: `btn btn-listen${opts.small ? ' btn-listen--small' : ''}`,
      'data-speech-key': key,
      'aria-pressed': 'false',
      'aria-label': opts.title ?? '아랍어 발음 듣기',
      title: opts.title ?? '아랍어 발음 듣기 (다시 누르면 정지)',
    },
    el('span', { class: 'btn-listen__icon', 'aria-hidden': 'true' }, '🔊'),
    ...(opts.label ? [el('span', {}, opts.label)] : []),
    el('span', { class: 'btn-listen__state' }),
  );
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    reportSpeech(await speech.speakSequence(texts, key));
  });
  return btn;
}
