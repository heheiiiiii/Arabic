import { CONTEXT_QUESTIONS, getItem, itemsOfKind, requireItem, type ContextQuestion, type StudyItem } from './content';
import type { LearningProgress } from './progress';

export type QuestionType = 'ar-to-ko' | 'ko-to-ar' | 'sentence-meaning' | 'context';

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  'ar-to-ko': '아랍어 → 뜻 고르기',
  'ko-to-ar': '뜻 → 아랍어 고르기',
  'sentence-meaning': '문장의 의미',
  context: '상황에 맞는 표현',
};

export interface Choice {
  itemId: string;
  text: string;
  lang: 'ar' | 'ko';
}

export interface Question {
  type: QuestionType;
  /** 정답 항목 (결과를 기록할 대상) */
  itemId: string;
  /** 질문 본문 */
  prompt: { lang: 'ar' | 'ko'; text: string };
  /** 문맥 문제의 상황 설명과 상대가 한 말 */
  situationKo?: string;
  promptItemId?: string;
  choices: Choice[];
  answerIndex: number;
  /** 문맥 문제의 해설 (그 밖의 문제는 정답 항목의 정보로 해설한다) */
  explanationKo?: string;
}

export type Rng = () => number;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 오답 보기 고르기: 정답과 표기가 다른 항목 중에서, 같은 단원 → 배운 항목 → 나머지 순으로 섞어 고른다.
 */
function pickDistractors(
  answer: StudyItem,
  pool: readonly StudyItem[],
  textOf: (i: StudyItem) => string,
  count: number,
  progress: LearningProgress,
  rng: Rng,
): StudyItem[] {
  const seen = new Set([textOf(answer)]);
  const candidates = pool.filter((i) => i.id !== answer.id);
  const groups = [
    candidates.filter((i) => i.unit === answer.unit),
    candidates.filter((i) => i.unit !== answer.unit && progress.isStudied(i.id)),
    candidates.filter((i) => i.unit !== answer.unit && !progress.isStudied(i.id)),
  ];
  const out: StudyItem[] = [];
  for (const g of groups) {
    for (const i of shuffle(g, rng)) {
      if (out.length >= count) return out;
      if (seen.has(textOf(i))) continue;
      seen.add(textOf(i));
      out.push(i);
    }
  }
  return out;
}

function finish(q: Omit<Question, 'choices' | 'answerIndex'>, answer: Choice, others: Choice[], rng: Rng): Question {
  const choices = shuffle([answer, ...others], rng);
  return { ...q, choices, answerIndex: choices.indexOf(answer) };
}

const arChoice = (i: StudyItem): Choice => ({ itemId: i.id, text: i.ar, lang: 'ar' });
const koChoice = (i: StudyItem): Choice => ({ itemId: i.id, text: i.ko, lang: 'ko' });

export function makeItemQuestion(type: Exclude<QuestionType, 'context'>, item: StudyItem, progress: LearningProgress, rng: Rng = Math.random): Question {
  const pool = itemsOfKind(item.kind);
  if (type === 'ko-to-ar') {
    const others = pickDistractors(item, pool, (i) => i.ar, 3, progress, rng).map(arChoice);
    return finish({ type, itemId: item.id, prompt: { lang: 'ko', text: item.ko } }, arChoice(item), others, rng);
  }
  const others = pickDistractors(item, pool, (i) => i.ko, 3, progress, rng).map(koChoice);
  return finish({ type, itemId: item.id, prompt: { lang: 'ar', text: item.ar } }, koChoice(item), others, rng);
}

export function makeContextQuestion(cq: ContextQuestion, rng: Rng = Math.random): Question {
  const answer = arChoice(requireItem(cq.answerId));
  const others = cq.distractorIds.map((id) => arChoice(requireItem(id)));
  return finish(
    {
      type: 'context',
      itemId: cq.answerId,
      prompt: { lang: 'ko', text: cq.situationKo },
      situationKo: cq.situationKo,
      promptItemId: cq.promptItemId,
      explanationKo: cq.explanationKo,
    },
    answer,
    others,
    rng,
  );
}

/** 이 항목으로 낼 수 있는 문제 유형 */
function applicableTypes(item: StudyItem): QuestionType[] {
  const types: QuestionType[] = item.kind === 'word' ? ['ar-to-ko', 'ko-to-ar'] : ['sentence-meaning', 'ko-to-ar'];
  if (CONTEXT_QUESTIONS.some((c) => c.answerId === item.id)) types.push('context');
  return types;
}

/**
 * 복습 세트 만들기.
 * - 복습할 항목(due)을 먼저, 그다음 오래전에 복습한 항목 순서로 고른다.
 * - 한 세트 안에서는 같은 항목을 반복하지 않는다 (배운 항목이 적으면 세트가 짧아진다).
 * - 문제 유형은 세트 안에서 가장 적게 나온 유형을 우선해 골고루 섞는다.
 */
export function buildReviewSet(progress: LearningProgress, size = 8, rng: Rng = Math.random, avoidIds: string[] = []): Question[] {
  const studied = progress.studiedItems();
  if (studied.length === 0) return [];

  // 복습 대상 안에서는 순서를 섞고, 최근에 틀린 것 → 단계가 낮은 것 순으로 먼저 낸다.
  // (복습 시각 순으로만 정렬하면 한꺼번에 배운 단어만 연달아 나와 문제 유형이 섞이지 않는다)
  const weakness = (id: string) => {
    const r = progress.get(id)!;
    return (r.lastResult === 'wrong' ? 0 : 10) + r.box;
  };
  const due = shuffle(progress.dueItems(), rng).sort((a, b) => weakness(a.id) - weakness(b.id));
  const dueIds = new Set(due.map((i) => i.id));
  const rest = shuffle(studied.filter((i) => !dueIds.has(i.id)), rng).sort(
    (a, b) => (progress.get(a.id)!.lastReviewedAt ?? 0) - (progress.get(b.id)!.lastReviewedAt ?? 0),
  );
  // 바로 직전 세트에 나온 항목은 가능하면 뒤로 미룬다.
  const avoid = new Set(avoidIds);
  const ordered = [...due, ...rest];
  const targets = [...ordered.filter((i) => !avoid.has(i.id)), ...ordered.filter((i) => avoid.has(i.id))].slice(0, size);

  const typeCount: Record<QuestionType, number> = { 'ar-to-ko': 0, 'ko-to-ar': 0, 'sentence-meaning': 0, context: 0 };
  const questions = targets.map((item) => {
    const types = shuffle(applicableTypes(item), rng).sort((a, b) => typeCount[a] - typeCount[b]);
    const type = types[0];
    typeCount[type]++;
    if (type === 'context') {
      const options = CONTEXT_QUESTIONS.filter((c) => c.answerId === item.id);
      return makeContextQuestion(options[Math.floor(rng() * options.length)], rng);
    }
    return makeItemQuestion(type, item, progress, rng);
  });
  return shuffle(questions, rng);
}

/** 정답 항목 정보 (해설 표시용) */
export function answerItem(q: Question): StudyItem {
  return getItem(q.itemId)!;
}
