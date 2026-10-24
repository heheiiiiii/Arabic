import { ALL_ITEMS, plainOf, type ItemKind, type Unit, type UnitId } from './content';
import type { Familiarity, LearningProgress } from './progress';

/**
 * 학습자 프로필: 다음 단계의 AI 주민 회화가 그대로 사용할 요약 정보.
 * (예: 주민 대사의 어휘를 "familiar/practicing" 표현 위주로 고르고, needsReview 표현을 자연스럽게 다시 써 주기)
 *
 * 주의: seen은 "학습 화면에서 봤다"는 뜻일 뿐 숙달이 아니다. 맞힌 기록(correct)과 단계(familiarity)를 함께 본다.
 */
export interface LearnerExpression {
  id: string;
  kind: ItemKind;
  unit: UnitId;
  ar: string;
  plain: string;
  ko: string;
  familiarity: Exclude<Familiarity, 'new'>;
  needsReview: boolean;
  correct: number;
  wrong: number;
}

export interface LearnerProfile {
  /** 현재 학습 중인 단원과 그 난이도 */
  currentUnit: Pick<Unit, 'id' | 'titleKo' | 'difficulty'>;
  /** 배운 항목들의 최고 난이도 (아직 없으면 1) */
  level: number;
  counts: Record<Exclude<Familiarity, 'new'>, number> & { needsReview: number };
  /** 학습자가 접한 모든 표현 */
  encountered: LearnerExpression[];
  /** 복습 문제를 한 번 이상 푼 표현 */
  reviewed: LearnerExpression[];
  /** 상대적으로 익숙한 표현 (맞힌 적 있음: practicing + familiar) */
  comfortable: LearnerExpression[];
  /** 복습이 필요한 표현 */
  needsReview: LearnerExpression[];
  /** 대화에서 들었지만 책상에서 아직 배우지 않은 표현 */
  heardNotStudied: { id: string; ar: string; ko: string }[];
}

export function buildLearnerProfile(progress: LearningProgress): LearnerProfile {
  const stats = progress.stats();
  const encountered: LearnerExpression[] = [];
  for (const item of ALL_ITEMS) {
    const s = progress.status(item.id);
    if (!s.progress || s.familiarity === 'new') continue;
    encountered.push({
      id: item.id,
      kind: item.kind,
      unit: item.unit,
      ar: item.ar,
      plain: plainOf(item),
      ko: item.ko,
      familiarity: s.familiarity,
      needsReview: s.needsReview,
      correct: s.progress.correct,
      wrong: s.progress.wrong,
    });
  }
  const level = Math.max(1, ...ALL_ITEMS.filter((i) => progress.isStudied(i.id)).map((i) => i.difficulty));
  return {
    currentUnit: { id: stats.currentUnit.id, titleKo: stats.currentUnit.titleKo, difficulty: stats.currentUnit.difficulty },
    level,
    counts: {
      seen: encountered.filter((e) => e.familiarity === 'seen').length,
      practicing: encountered.filter((e) => e.familiarity === 'practicing').length,
      familiar: encountered.filter((e) => e.familiarity === 'familiar').length,
      needsReview: encountered.filter((e) => e.needsReview).length,
    },
    encountered,
    reviewed: encountered.filter((e) => e.correct + e.wrong > 0),
    comfortable: encountered.filter((e) => e.familiarity !== 'seen'),
    needsReview: encountered.filter((e) => e.needsReview),
    heardNotStudied: progress.heardNotStudied().map((i) => ({ id: i.id, ar: i.ar, ko: i.ko })),
  };
}
