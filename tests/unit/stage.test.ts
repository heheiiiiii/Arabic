import { describe, expect, it } from 'vitest';
import { getItem } from '../../src/learning/content';
import { clampStage, NEW_WORDS_ALLOWED, offStageWords, stageOf, stageVocabulary } from '../../src/learning/stage';
import { parseSave } from '../../src/game/state';
import { validateChatRequest } from '../../src/shared/conversation';

describe('아랍어 시험 단계', () => {
  it('단계는 1~5로 맞춘다', () => {
    expect([clampStage(0), clampStage(3.4), clampStage(9), clampStage('x')]).toEqual([1, 3, 5, 1]);
  });

  it('학습 항목의 단계: 단원 단계와 난이도 중 높은 쪽', () => {
    expect(stageOf(getItem('s.marhaban')!)).toBe(1);
    expect(stageOf(getItem('s.kayfa_haluka')!)).toBe(2); // 인사 단원이지만 난이도 2
    expect(stageOf(getItem('s.ma_ismuka')!)).toBe(2); // 자기소개 단원
  });

  it('높은 단계는 낮은 단계 어휘를 모두 포함하고, 새 단어 허용 수가 늘어난다', () => {
    const s1 = stageVocabulary(1);
    const s3 = stageVocabulary(3);
    expect(s3.items.length).toBeGreaterThan(s1.items.length);
    expect(s1.items.every((i) => s3.items.includes(i))).toBe(true);
    expect(NEW_WORDS_ALLOWED[1]).toBe(0);
    expect(NEW_WORDS_ALLOWED[5]).toBeGreaterThan(NEW_WORDS_ALLOWED[3]);
  });

  it('어휘 검사: 배운 표현은 통과, 목록 밖 단어는 일반 표기로 돌려준다', () => {
    expect(offStageWords('مَرْحَبًا! كَيْفَ الْحَالُ؟', 1)).toEqual([]);
    const off = offStageWords('ذَهَبْتُ إِلَى السُّوقِ.', 1);
    expect(off).toContain('ذهبت');
    // 부호 없는 문장(음성 인식 결과 등)도 같은 결과
    expect(offStageWords('مرحبا! كيف الحال؟', 1)).toEqual([]);
  });

  it('플레이어가 직접 한 말(이름 등)은 목록 밖이어도 허용한다', () => {
    expect(offStageWords('أَهْلًا يَا سَارَةُ', 1)).toContain('سارة');
    expect(offStageWords('أَهْلًا يَا سَارَةُ', 1, ['اسمي سارة'])).not.toContain('سارة');
  });

  it('저장 데이터: v4까지는 1단계(응시 전), v5는 단계를 읽고 범위를 맞춘다', () => {
    expect(parseSave({ version: 4, playerName: 'A' })!.data.exam).toEqual({ stage: 1, passedAt: null, attempts: 0 });
    expect(parseSave({ version: 5, playerName: 'A', exam: { stage: 3, passedAt: 5, attempts: 2 } })!.data.exam).toEqual({ stage: 3, passedAt: 5, attempts: 2 });
    expect(parseSave({ version: 5, playerName: 'A', exam: { stage: 99, attempts: -1 } })!.data.exam).toEqual({ stage: 5, passedAt: null, attempts: 0 });
  });

  it('대화 요청: 시험 단계를 검증해 1~5로 맞춘다', () => {
    const base = { npcId: 'layla', playerText: null, history: [], memory: { facts: [], topics: [], conversations: 1 }, addressGender: 'm' };
    const r = validateChatRequest({ ...base, learner: { examStage: 7 } });
    expect(typeof r).not.toBe('string');
    expect((r as Exclude<typeof r, string>).learner.examStage).toBe(5);
  });
});
