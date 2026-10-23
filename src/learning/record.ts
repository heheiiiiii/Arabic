/**
 * 학습 기록의 저장 형식. 브라우저 저장 데이터(SaveData.learning)에 그대로 들어간다.
 * 필드를 바꿀 때는 game/state.ts의 SAVE_VERSION과 마이그레이션을 함께 수정한다.
 */

export interface ItemProgress {
  /** 처음 학습(책상에서 열람)한 시각 (ms) */
  firstStudiedAt: number;
  /** 마지막으로 학습 화면에서 본 시각 */
  lastStudiedAt: number;
  /** 복습 문제 시도 횟수 / 정답 / 오답 */
  attempts: number;
  correct: number;
  wrong: number;
  lastResult: 'correct' | 'wrong' | null;
  lastReviewedAt: number | null;
  /** 간격 반복 단계 (0~MAX_BOX). 정답을 "복습 시점에" 맞혀야 올라간다. */
  box: number;
  /** 다음 복습 시각. 이 시각이 지나면 복습할 항목이 된다. */
  dueAt: number;
}

export interface LearningRecord {
  items: Record<string, ItemProgress>;
  /** 마지막으로 보던 위치 (단어/문장 목록의 인덱스) */
  position: { word: number; sentence: number };
}

export const MAX_BOX = 5;

export function emptyLearningRecord(): LearningRecord {
  return { items: {}, position: { word: 0, sentence: 0 } };
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** 저장소에서 읽은 알 수 없는 값을 안전한 학습 기록으로 바꾼다 (잘못된 항목은 버린다). */
export function sanitizeLearningRecord(raw: unknown): LearningRecord {
  const out = emptyLearningRecord();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;

  const pos = r.position as Record<string, unknown> | undefined;
  if (pos && typeof pos === 'object') {
    out.position.word = Math.max(0, Math.floor(num(pos.word, 0)));
    out.position.sentence = Math.max(0, Math.floor(num(pos.sentence, 0)));
  }

  const items = r.items;
  if (items && typeof items === 'object') {
    for (const [id, value] of Object.entries(items as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      const first = num(v.firstStudiedAt, NaN);
      if (!Number.isFinite(first)) continue;
      const lastResult = v.lastResult === 'correct' || v.lastResult === 'wrong' ? v.lastResult : null;
      out.items[id] = {
        firstStudiedAt: first,
        lastStudiedAt: num(v.lastStudiedAt, first),
        attempts: Math.max(0, Math.floor(num(v.attempts, 0))),
        correct: Math.max(0, Math.floor(num(v.correct, 0))),
        wrong: Math.max(0, Math.floor(num(v.wrong, 0))),
        lastResult,
        lastReviewedAt: v.lastReviewedAt === null ? null : num(v.lastReviewedAt, NaN) || null,
        box: Math.min(MAX_BOX, Math.max(0, Math.floor(num(v.box, 0)))),
        dueAt: num(v.dueAt, first),
      };
    }
  }
  return out;
}
