import { speech } from '../../audio/speech';
import { getItem, plainOf, requireItem } from '../../learning/content';
import { answerItem, buildReviewSet, QUESTION_TYPE_LABEL, type Question } from '../../learning/review';
import { el, korean } from '../dom';
import { listenButton, mixedText } from '../arabicText';
import { button, type StudyContext } from './common';

const SET_SIZE = 8;

interface Result {
  question: Question;
  correct: boolean;
}

/**
 * 배운 내용 복습하기 (객관식).
 * 틀려도 벌점이나 기록 초기화 없이, 정답과 설명을 보여 주고 나중에 다시 나오게 한다.
 */
export function renderReview(root: HTMLElement, ctx: StudyContext, previousIds: string[] = []): void {
  const { progress } = ctx;
  speech.stop();

  if (progress.studiedItems().length === 0) {
    ctx.setKeyHandler(null);
    root.replaceChildren(
      el(
        'section',
        { class: 'review review--empty' },
        el('p', { class: 'empty-icon', 'aria-hidden': 'true' }, '📭'),
        korean('아직 배운 표현이 없어요.', 'ko empty-title'),
        korean('단어나 문장을 먼저 배우면, 여기에서 문제로 복습할 수 있어요.', 'ko muted'),
        el(
          'div',
          { class: 'lesson__nav' },
          button('새 단어 배우기', () => ctx.openLesson('word'), 'btn btn--primary'),
          button('메뉴로', () => ctx.goMenu(), 'btn btn--ghost'),
        ),
      ),
    );
    return;
  }

  const questions = buildReviewSet(progress, SET_SIZE, Math.random, previousIds);
  const results: Result[] = [];
  let index = 0;

  const showQuestion = () => {
    speech.stop();
    const q = questions[index];
    let answered = false;

    const choiceButtons = q.choices.map((c, i) => {
      const b = el(
        'button',
        { type: 'button', class: `choice choice--${c.lang}`, 'data-index': String(i), 'data-item-id': c.itemId },
        el('span', { class: 'choice__num', 'aria-hidden': 'true' }, String(i + 1)),
        c.lang === 'ar'
          ? el('span', { class: 'choice__text ar', lang: 'ar', dir: 'rtl' }, c.text)
          : el('span', { class: 'choice__text ko', lang: 'ko', dir: 'ltr' }, c.text),
      );
      b.addEventListener('click', () => choose(i));
      return b;
    });

    const feedback = el('div', { class: 'feedback', 'aria-live': 'polite' });
    const nextBtn = button(index === questions.length - 1 ? '결과 보기' : '다음 문제 ▶', () => advance(), 'btn btn--primary', { 'data-role': 'next' });
    nextBtn.hidden = true;

    const choose = (i: number) => {
      if (answered) return;
      answered = true;
      const correct = i === q.answerIndex;
      progress.recordAnswer(q.itemId, correct);
      results.push({ question: q, correct });
      ctx.refreshStats();
      choiceButtons.forEach((b, j) => {
        b.disabled = true;
        if (j === q.answerIndex) b.classList.add('is-correct');
        else if (j === i) b.classList.add('is-wrong');
      });
      feedback.replaceChildren(...renderFeedback(q, correct));
      nextBtn.hidden = false;
      nextBtn.focus({ preventScroll: true });
    };

    const advance = () => {
      index++;
      if (index < questions.length) showQuestion();
      else showSummary();
    };

    ctx.setKeyHandler((e) => {
      const n = Number(e.key);
      if (!answered && n >= 1 && n <= q.choices.length) return choose(n - 1), true;
      return false;
    });

    root.replaceChildren(
      el(
        'section',
        { class: 'review', 'aria-label': '복습 문제', 'data-question-type': q.type, 'data-question-item': q.itemId },
        el(
          'div',
          { class: 'lesson__head' },
          el('span', { class: 'chip chip--unit' }, QUESTION_TYPE_LABEL[q.type]),
          el('span', { class: 'lesson__counter' }, `문제 ${index + 1} / ${questions.length}`),
        ),
        renderPrompt(q),
        el('div', { class: `choices choices--${q.choices[0].lang}`, role: 'group', 'aria-label': '보기' }, ...choiceButtons),
        feedback,
        el('div', { class: 'lesson__nav' }, button('그만하기', () => ctx.goMenu(), 'btn btn--ghost'), nextBtn),
      ),
    );
    choiceButtons[0]?.focus({ preventScroll: true });
  };

  const showSummary = () => {
    speech.stop();
    ctx.setKeyHandler(null);
    const right = results.filter((r) => r.correct).length;
    const missed = results.filter((r) => !r.correct).map((r) => answerItem(r.question));
    const message =
      right === results.length ? '모두 맞혔어요! 훌륭해요 🎉' : right >= results.length / 2 ? '잘했어요! 틀린 표현은 다음 복습에 다시 나와요.' : '괜찮아요. 자주 보면 금방 익숙해져요.';
    const again = button('다시 풀기', () => renderReview(root, ctx, questions.map((q) => q.itemId)), 'btn btn--primary', { 'data-role': 'again' });
    root.replaceChildren(
      el(
        'section',
        { class: 'review review--summary' },
        el('p', { class: 'summary__score' }, `${results.length}문제 중 ${right}문제 정답`),
        korean(message, 'ko summary__msg'),
        ...(missed.length
          ? [
              el('h3', { class: 'related__title' }, '다시 볼 표현'),
              el(
                'ul',
                { class: 'related__list' },
                ...missed.map((it) =>
                  el(
                    'li',
                    { class: 'related__row' },
                    listenButton(it.tts ?? it.ar, { small: true }),
                    el('div', { class: 'related__text' }, el('p', { class: 'ar ar--row', lang: 'ar', dir: 'rtl' }, it.ar), korean(it.ko, 'ko ko--row')),
                  ),
                ),
              ),
            ]
          : []),
        el('div', { class: 'lesson__nav' }, button('메뉴로', () => ctx.goMenu(), 'btn btn--ghost'), again),
      ),
    );
    again.focus({ preventScroll: true });
  };

  showQuestion();
}

function renderPrompt(q: Question): HTMLElement {
  if (q.type === 'context') {
    const parts: HTMLElement[] = [korean(q.situationKo ?? '', 'ko prompt__situation')];
    if (q.promptItemId) {
      const said = requireItem(q.promptItemId);
      parts.push(
        el(
          'div',
          { class: 'speech-bubble' },
          el('p', { class: 'ar ar--bubble', lang: 'ar', dir: 'rtl' }, said.ar),
          listenButton(said.tts ?? said.ar, { small: true }),
        ),
      );
    }
    return el('div', { class: 'prompt' }, ...parts);
  }
  if (q.prompt.lang === 'ar') {
    return el(
      'div',
      { class: 'prompt' },
      korean('다음 표현의 뜻은 무엇일까요?', 'ko prompt__ask'),
      el(
        'div',
        { class: 'hero' },
        el('p', { class: `ar ar--hero ${getItem(q.itemId)?.kind === 'sentence' ? 'ar--hero-sentence' : 'ar--hero-word'}`, lang: 'ar', dir: 'rtl' }, q.prompt.text),
        listenButton(q.prompt.text, { label: '듣기' }),
      ),
    );
  }
  return el('div', { class: 'prompt' }, korean('이 뜻에 맞는 아랍어 표현을 고르세요.', 'ko prompt__ask'), korean(q.prompt.text, 'ko prompt__ko'));
}

function renderFeedback(q: Question, correct: boolean): HTMLElement[] {
  const item = answerItem(q);
  const out: HTMLElement[] = [
    el('p', { class: `feedback__title ${correct ? 'is-correct' : 'is-wrong'}` }, correct ? '정답이에요! 👏' : '아쉬워요. 정답을 확인해 볼까요?'),
    el(
      'div',
      { class: 'feedback__answer' },
      listenButton(item.tts ?? item.ar, { small: true }),
      el(
        'div',
        { class: 'related__text' },
        el('p', { class: 'ar ar--row', lang: 'ar', dir: 'rtl' }, item.ar),
        korean(`${item.ko}  ·  ${item.translit}`, 'ko ko--row'),
        el('p', { class: 'muted small' }, '부호 없는 표기: ', el('bdi', { lang: 'ar', dir: 'rtl', class: 'ar-inline' }, plainOf(item))),
      ),
    ),
  ];
  const explanation = q.explanationKo ?? item.usage ?? item.grammar;
  if (explanation) out.push(mixedText(`💡 ${explanation}`, 'feedback__explain'));
  return out;
}
