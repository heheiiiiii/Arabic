import { getLearningRecord, persist } from '../game/state';
import { LearningProgress } from './progress';
import { buildLearnerProfile, type LearnerProfile } from './profile';

export { LearningProgress } from './progress';
export type { Familiarity, ItemStatus, LearningStats } from './progress';
export type { LearnerExpression, LearnerProfile } from './profile';

let instance: LearningProgress | null = null;

/** 게임 저장 데이터에 연결된 학습 진도. loadSave() 이후에 사용한다. */
export function learning(): LearningProgress {
  if (!instance) instance = new LearningProgress(getLearningRecord(), persist);
  return instance;
}

/** 다음 단계(AI 회화)용: 현재 학습자 프로필 */
export function getLearnerProfile(): LearnerProfile {
  return buildLearnerProfile(learning());
}
