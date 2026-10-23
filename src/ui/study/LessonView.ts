import { getItem, itemsOfKind, sentencesUsingWord, type ItemKind, type StudyItem } from '../../learning/content';
import { speech } from '../../audio/speech';
import { el, korean } from '../dom';
import { listenButton } from '../arabicText';
import { arabicHero, button, KIND_LABEL, notes, readingInfo, statusChip, unitChip, type StudyContext } from './common';

/**
 * 새 단어 / 새 문장 배우기. 한 번에 한 항목에 집중한다.
 * 항목을 화면에 띄우면 "학습함"으로 기록된다 (이미 배운 항목은 새로 배운 것으로 세지 않는다).
 */
export function renderLesson(root: HTMLElement, ctx: StudyContext, kind: ItemKind): void {
  const list = itemsOfKind(kind);
  const { progress } = ctx;
  // 이어서 배우기: 아직 안 배운 항목이 있으면 그곳부터, 모두 배웠으면 마지막으로 보던 곳부터
  const allStudied = list.every((i) => progress.isStudied(i.id));
  let index = allStudied ? Math.min(progress.getPosition(kind), list.length - 1) : progress.firstUnstudiedIndex(kind);

  const show = () => {
    speech.stop(); // 다른 항목으로 넘어가면 이전 음성을 멈춘다
    const item = list[index];
    const isNew = progress.markStudied(item.id);
    progress.setPosition(kind, index);
    ctx.refreshStats();

    const head = el(
      'div',
      { class: 'lesson__head' },
      unitChip(item),
      statusChip(progress, item.id),
      el('span', { class: 'lesson__counter' }, `${KIND_LABEL[kind]} ${index + 1} / ${list.length}`),
    );
    const banner = isNew ? el('p', { class: 'new-banner', role: 'status' }, `✨ 새 ${KIND_LABEL[kind]}를 배웠어요!`) : null;

    const body = el(
      'div',
      { class: 'lesson__body' },
      arabicHero(item, kind),
      korean(item.ko, `ko ko--meaning`),
      readingInfo(item),
    );
    const n = notes(item);
    if (n) body.append(n);
    body.append(kind === 'word' ? examplesFor(item) : keyWordsOf(item, ctx));

    const prev = button('◀ 이전', () => go(-1), 'btn', { 'data-nav': 'prev' });
    const next = button(index === list.length - 1 ? '처음으로 ↺' : '다음 ▶', () => go(1), 'btn btn--primary', { 'data-nav': 'next' });
    prev.disabled = index === 0;
    const nav = el('div', { class: 'lesson__nav' }, prev, button('메뉴로', () => ctx.goMenu(), 'btn btn--ghost'), next);

    root.replaceChildren(
      el('section', { class: 'lesson', 'aria-label': `${KIND_LABEL[kind]} 배우기` }, head, ...(banner ? [banner] : []), body, nav),
    );
    next.focus({ preventScroll: true });
  };

  // 마지막 항목에서 "다음"은 처음으로 돌아가고, 첫 항목에서 "이전"은 막는다.
  const go = (delta: 1 | -1) => {
    index = delta > 0 ? (index + 1) % list.length : Math.max(0, index - 1);
    show();
  };

  ctx.setKeyHandler((e) => {
    if (e.key === 'ArrowRight') return go(1), true;
    if (e.key === 'ArrowLeft' && index > 0) return go(-1), true;
    return false;
  });
  show();
}

/** 단어가 들어 있는 예문 (최대 2개) */
function examplesFor(word: StudyItem): HTMLElement {
  const examples = sentencesUsingWord(word.id).slice(0, 2);
  if (examples.length === 0) return el('div');
  return el(
    'div',
    { class: 'related' },
    el('h3', { class: 'related__title' }, '이 단어가 들어간 문장'),
    el(
      'ul',
      { class: 'related__list' },
      ...examples.map((s) =>
        el(
          'li',
          { class: 'related__row' },
          listenButton(s.tts ?? s.ar, { small: true, title: `${s.ko} 듣기` }),
          el('div', { class: 'related__text' }, el('p', { class: 'ar ar--row', lang: 'ar', dir: 'rtl' }, s.ar), korean(s.ko, 'ko ko--row')),
        ),
      ),
    ),
  );
}

/** 문장의 핵심 단어 (각각 듣기 가능, 배운 단어는 ✓ 표시) */
function keyWordsOf(sentence: StudyItem, ctx: StudyContext): HTMLElement {
  const words = (sentence.keyWords ?? []).map((id) => getItem(id)).filter((w): w is StudyItem => !!w);
  if (words.length === 0) return el('div');
  return el(
    'div',
    { class: 'related' },
    el('h3', { class: 'related__title' }, '핵심 단어'),
    el(
      'ul',
      { class: 'related__list' },
      ...words.map((w) =>
        el(
          'li',
          { class: 'related__row', 'data-word-id': w.id },
          listenButton(w.tts ?? w.ar, { small: true, title: `${w.ko} 듣기` }),
          el(
            'div',
            { class: 'related__text related__text--word' },
            el('p', { class: 'ar ar--row', lang: 'ar', dir: 'rtl' }, w.ar),
            korean(`${w.ko}${ctx.progress.isStudied(w.id) ? '  ✓' : ''}`, 'ko ko--row'),
          ),
        ),
      ),
    ),
    el('p', { class: 'muted small' }, '문장 속에서는 격이나 소유 어미 때문에 끝모양이 사전형과 다를 수 있어요.'),
  );
}
