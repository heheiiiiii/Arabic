import { el, korean } from '../dom';
import { listenButton } from '../arabicText';
import { splitSentences } from '../../shared/sentences';
import { button, type StudyContext } from './common';

/**
 * 대화에서 만난 표현.
 * - 대화에서 들었지만 아직 책상에서 배우지 않은 학습 항목 → 바로 배우기 (들었다고 학습 완료로 치지 않는다)
 * - 플레이어가 직접 저장한 대화 문장 (AI 문장은 검수 전이라는 표시와 함께)
 */
export function renderPhrases(root: HTMLElement, ctx: StudyContext): void {
  const { progress } = ctx;
  ctx.setKeyHandler(null);
  const heard = progress.heardNotStudied();
  const saved = progress.savedPhrases();

  const heardList = heard.length
    ? el(
        'ul',
        { class: 'related__list phrase-list' },
        ...heard.map((it) =>
          el(
            'li',
            { class: 'related__row', 'data-item-id': it.id },
            listenButton(it.tts ?? it.ar, { small: true }),
            el(
              'div',
              { class: 'related__text' },
              el('p', { class: 'ar ar--row', lang: 'ar', dir: 'rtl' }, it.ar),
              korean(`${it.ko}  ·  대화에서 ${progress.heardCount(it.id)}번 들음`, 'ko ko--row'),
            ),
            button('배우기', () => ctx.openLesson(it.kind, it.id), 'btn btn--tiny btn--primary', { 'data-role': 'learn-heard' }),
          ),
        ),
      )
    : korean('대화에서 새로 들은 학습 표현이 아직 없어요.', 'ko muted');

  const savedList = saved.length
    ? el(
        'ul',
        { class: 'related__list phrase-list' },
        ...saved.map((p) =>
          el(
            'li',
            { class: 'related__row' },
            listenButton(splitSentences(p.ar), { small: true }),
            el(
              'div',
              { class: 'related__text' },
              el('p', { class: 'ar ar--row', lang: 'ar', dir: 'rtl' }, p.ar),
              korean(p.ko + (p.translit ? `  ·  ${p.translit}` : ''), 'ko ko--row'),
              el(
                'p',
                { class: 'muted small' },
                p.source === 'ai' ? (p.uncertain ? '⚠ AI 문장 · 모음 부호 자동 검사에서 의심 부분 있음' : 'AI 문장 · 자동 검사만 거침 (원어민 검수 전)') : '연습 상대 문장 · 학습 콘텐츠에서 가져옴',
              ),
            ),
            button('지우기', () => {
              progress.removePhrase(p.ar);
              renderPhrases(root, ctx);
              ctx.refreshStats();
            }, 'btn btn--tiny btn--ghost'),
          ),
        ),
      )
    : korean('대화 중 📌 버튼으로 표현을 저장하면 여기에서 다시 들을 수 있어요.', 'ko muted');

  root.replaceChildren(
    el(
      'section',
      { class: 'lesson', 'aria-label': '대화에서 만난 표현' },
      el('h3', { class: 'related__title' }, '💬 대화에서 들은 새 표현'),
      korean('들어 본 것만으로는 배운 것으로 치지 않아요. "배우기"를 눌러 책상에서 익혀 보세요.', 'ko muted small'),
      heardList,
      el('h3', { class: 'related__title' }, '📌 저장한 표현'),
      savedList,
      el('div', { class: 'lesson__nav' }, button('메뉴로', () => ctx.goMenu(), 'btn btn--ghost')),
    ),
  );
}
