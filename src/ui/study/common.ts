import type { LearningProgress } from '../../learning';
import type { ItemKind, StudyItem } from '../../learning/content';
import { getUnit, plainOf } from '../../learning/content';
import { el } from '../dom';
import { listenButton, mixedText } from '../arabicText';

/** 공부 화면들이 공유하는 상태와 이동 함수 */
export interface StudyContext {
  progress: LearningProgress;
  goMenu(): void;
  openLesson(kind: ItemKind): void;
  openReview(): void;
  /** 위쪽 학습 현황 막대를 다시 그린다 */
  refreshStats(): void;
  /** 이 화면에서만 쓰는 키보드 처리 (화면이 바뀌면 자동 해제) */
  setKeyHandler(fn: ((e: KeyboardEvent) => boolean) | null): void;
}

export const KIND_LABEL: Record<ItemKind, string> = { word: '단어', sentence: '문장' };

export function unitChip(item: StudyItem): HTMLElement {
  const u = getUnit(item.unit);
  return el('span', { class: 'chip chip--unit' }, `${u.order}단원 · ${u.titleKo}`);
}

const STATUS_LABEL = {
  new: { text: '처음 보는 표현', cls: 'chip--new' },
  seen: { text: '학습함', cls: 'chip--seen' },
  practicing: { text: '연습 중', cls: 'chip--practicing' },
  familiar: { text: '익숙함 ⭐', cls: 'chip--familiar' },
} as const;

export function statusChip(progress: LearningProgress, id: string): HTMLElement {
  const s = progress.status(id);
  const label = STATUS_LABEL[s.familiarity];
  const wrap = el('span', { class: 'chip-group' }, el('span', { class: `chip ${label.cls}` }, label.text));
  if (s.needsReview) wrap.append(el('span', { class: 'chip chip--due' }, '복습 필요'));
  return wrap;
}

/** 큰 아랍어 + 듣기 버튼 */
export function arabicHero(item: StudyItem, size: 'word' | 'sentence'): HTMLElement {
  return el(
    'div',
    { class: 'hero' },
    el('p', { class: `ar ar--hero ar--hero-${size}`, lang: 'ar', dir: 'rtl', 'data-item-id': item.id }, item.ar),
    listenButton(item.tts ?? item.ar, { label: '듣기', title: `${item.ko} 발음 듣기` }),
  );
}

/** 일반 표기 · 로마자 · 한국어식 발음 */
export function readingInfo(item: StudyItem): HTMLElement {
  return el(
    'dl',
    { class: 'reading' },
    el('dt', {}, '발음'),
    el('dd', {}, el('span', { class: 'translit', lang: 'ar-Latn', dir: 'ltr' }, item.translit), el('span', { class: 'pron' }, ` [${item.pron}]`)),
    el('dt', {}, '부호 없는 표기'),
    el('dd', {}, el('bdi', { class: 'ar-inline ar-plain', lang: 'ar', dir: 'rtl' }, plainOf(item))),
  );
}

export function notes(item: StudyItem): HTMLElement | null {
  const parts: HTMLElement[] = [];
  if (item.gender) {
    const who = item.gender.role === 'addressee' ? '말하는 상대' : '말하는 사람';
    const g = item.gender.gender === 'm' ? '남성' : '여성';
    parts.push(el('p', { class: 'note-line note-line--gender' }, `👥 ${who}이(가) ${g}일 때 쓰는 형태예요.`));
  }
  if (item.grammar) parts.push(mixedText(`📐 ${item.grammar}`, 'note-line'));
  if (item.usage) parts.push(mixedText(`💬 ${item.usage}`, 'note-line'));
  return parts.length ? el('div', { class: 'notes' }, ...parts) : null;
}

export function button(label: string, onClick: () => void, cls = 'btn', attrs: Record<string, string> = {}): HTMLButtonElement {
  const b = el('button', { type: 'button', class: cls, ...attrs }, label);
  b.addEventListener('click', onClick);
  return b;
}
