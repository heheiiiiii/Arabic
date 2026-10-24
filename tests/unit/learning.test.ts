import { describe, expect, it } from 'vitest';
import { ALL_ITEMS, CONTEXT_QUESTIONS, getItem, SENTENCE_LIST, WORD_LIST } from '../../src/learning/content';
import { BOX_INTERVALS, LearningProgress } from '../../src/learning/progress';
import { buildLearnerProfile } from '../../src/learning/profile';
import { emptyLearningRecord, sanitizeLearningRecord } from '../../src/learning/record';
import { buildReviewSet, makeContextQuestion, makeItemQuestion, shuffle } from '../../src/learning/review';
import { parseSave, SAVE_VERSION } from '../../src/game/state';
import { defaultSettings } from '../../src/game/settings';

/** 시드 고정 난수 */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function setup(start = 1_000_000) {
  let t = start;
  let saves = 0;
  const record = emptyLearningRecord();
  const p = new LearningProgress(record, () => saves++, () => t);
  return { p, record, advance: (ms: number) => (t += ms), saves: () => saves };
}

describe('학습 진도', () => {
  it('처음 본 항목만 새로 배운 것으로 기록하고, 다시 보면 시각만 갱신한다', () => {
    const { p, record, advance } = setup();
    expect(p.markStudied('w.marhaban')).toBe(true);
    const first = record.items['w.marhaban'].firstStudiedAt;
    advance(5000);
    expect(p.markStudied('w.marhaban')).toBe(false);
    expect(record.items['w.marhaban'].firstStudiedAt).toBe(first);
    expect(record.items['w.marhaban'].lastStudiedAt).toBe(first + 5000);
    expect(p.stats().wordsStudied).toBe(1);
    expect(p.markStudied('없는-ID')).toBe(false);
  });

  it('배운 항목은 바로 복습 대상이 되고, 본 것과 맞힌 것을 구분한다', () => {
    const { p } = setup();
    p.markStudied('w.bayt');
    expect(p.status('w.bayt')).toMatchObject({ familiarity: 'seen', needsReview: true });
    expect(p.stats().dueCount).toBe(1);
    p.recordAnswer('w.bayt', true);
    expect(p.status('w.bayt')).toMatchObject({ familiarity: 'practicing', needsReview: false });
    expect(p.stats().dueCount).toBe(0);
  });

  it('복습 시점 전에 맞히면 단계가 오르지 않는다 (몰아서 풀어도 숙달로 처리되지 않음)', () => {
    const { p, advance } = setup();
    p.markStudied('w.bayt');
    expect(p.recordAnswer('w.bayt', true)).toMatchObject({ boxAfter: 1, advanced: true });
    for (let i = 0; i < 5; i++) expect(p.recordAnswer('w.bayt', true)!.advanced).toBe(false);
    expect(p.get('w.bayt')!.box).toBe(1);
    expect(p.get('w.bayt')!.correct).toBe(6);
    advance(BOX_INTERVALS[1]);
    expect(p.recordAnswer('w.bayt', true)!.boxAfter).toBe(2);
    advance(BOX_INTERVALS[2]);
    p.recordAnswer('w.bayt', true);
    expect(p.status('w.bayt').familiarity).toBe('familiar');
  });

  it('틀려도 기록을 지우지 않고 한 단계만 내려 다시 복습하게 한다', () => {
    const { p, advance } = setup();
    p.markStudied('w.bayt');
    p.recordAnswer('w.bayt', true);
    advance(BOX_INTERVALS[1]);
    p.recordAnswer('w.bayt', true); // box 2
    p.recordAnswer('w.bayt', false);
    const rec = p.get('w.bayt')!;
    expect(rec).toMatchObject({ box: 1, correct: 2, wrong: 1, attempts: 3, lastResult: 'wrong' });
    expect(p.status('w.bayt').needsReview).toBe(true);
    expect(rec.firstStudiedAt).toBeGreaterThan(0);
  });

  it('현재 단원은 아직 다 배우지 않은 첫 단원이다', () => {
    const { p } = setup();
    expect(p.stats().currentUnit.id).toBe('greetings');
    for (const i of ALL_ITEMS.filter((x) => x.unit === 'greetings')) p.markStudied(i.id);
    expect(p.stats().currentUnit.id).toBe('introductions');
    for (const i of ALL_ITEMS) p.markStudied(i.id);
    expect(p.stats().allStudied).toBe(true);
  });

  it('변경될 때마다 저장 콜백을 부른다', () => {
    const { p, saves } = setup();
    p.markStudied('w.bayt');
    p.recordAnswer('w.bayt', true);
    p.setPosition('word', 3);
    expect(saves()).toBe(3);
  });
});

describe('복습 문제', () => {
  function studiedAll(seed = 1) {
    const { p } = setup();
    for (const i of ALL_ITEMS) p.markStudied(i.id);
    return { p, rng: seeded(seed) };
  }

  it('보기에 정답이 정확히 하나 있고, 보기 텍스트가 겹치지 않는다', () => {
    const { p, rng } = studiedAll();
    for (const item of ALL_ITEMS) {
      for (const type of ['ar-to-ko', 'ko-to-ar'] as const) {
        const q = makeItemQuestion(type, item, p, rng);
        expect(q.choices).toHaveLength(4);
        expect(q.choices[q.answerIndex].itemId).toBe(item.id);
        expect(q.choices.filter((c) => c.itemId === item.id)).toHaveLength(1);
        expect(new Set(q.choices.map((c) => c.text)).size).toBe(4);
        expect(new Set(q.choices.map((c) => getItem(c.itemId)!.kind)).size).toBe(1); // 단어는 단어끼리, 문장은 문장끼리
      }
    }
    for (const cq of CONTEXT_QUESTIONS) {
      const q = makeContextQuestion(cq, rng);
      expect(q.choices[q.answerIndex].itemId).toBe(cq.answerId);
    }
  });

  it('정답 위치가 고르게 섞인다', () => {
    const { p, rng } = studiedAll(7);
    const counts = [0, 0, 0, 0];
    const N = 4000;
    for (let k = 0; k < N; k++) counts[makeItemQuestion('ar-to-ko', WORD_LIST[k % WORD_LIST.length], p, rng).answerIndex]++;
    for (const c of counts) expect(Math.abs(c / N - 0.25)).toBeLessThan(0.03);
  });

  it('한 세트에서 같은 항목이 반복되지 않고, 여러 유형이 섞인다', () => {
    const { p, rng } = studiedAll(3);
    const set = buildReviewSet(p, 8, rng);
    expect(set).toHaveLength(8);
    expect(new Set(set.map((q) => q.itemId)).size).toBe(8);
    expect(new Set(set.map((q) => q.type)).size).toBeGreaterThanOrEqual(3);
  });

  it('네 가지 유형이 모두 출제된다', () => {
    const { p, rng } = studiedAll(11);
    const types = new Set<string>();
    for (let k = 0; k < 20; k++) for (const q of buildReviewSet(p, 8, rng)) types.add(q.type);
    expect([...types].sort()).toEqual(['ar-to-ko', 'context', 'ko-to-ar', 'sentence-meaning']);
  });

  it('복습할 항목을 먼저 내고, 직전 세트의 항목은 가능하면 피한다', () => {
    const { p, rng } = studiedAll(5);
    for (const i of ALL_ITEMS) p.recordAnswer(i.id, true); // 모두 복습 완료 → due 없음
    p.recordAnswer('s.sabah_nur', false); // 이것만 복습 필요
    const set = buildReviewSet(p, 8, rng);
    expect(set.map((q) => q.itemId)).toContain('s.sabah_nur');
    const next = buildReviewSet(p, 8, rng, set.map((q) => q.itemId));
    const overlap = next.filter((q) => set.some((s) => s.itemId === q.itemId));
    expect(overlap.length).toBe(0);
  });

  it('배운 것이 없으면 문제를 만들지 않고, 적으면 세트가 짧아진다', () => {
    const { p } = setup();
    expect(buildReviewSet(p, 8)).toEqual([]);
    p.markStudied('w.marhaban');
    p.markStudied('w.shukran');
    const set = buildReviewSet(p, 8, seeded(2));
    expect(set).toHaveLength(2);
  });

  it('문맥 문제는 정답 항목을 배운 경우에만 나온다', () => {
    const { p } = setup();
    for (const w of WORD_LIST) p.markStudied(w.id); // 단어만 배움
    for (let k = 0; k < 10; k++) {
      for (const q of buildReviewSet(p, 8, seeded(k))) {
        if (q.type === 'context') expect(p.isStudied(q.itemId)).toBe(true);
      }
    }
  });

  it('shuffle은 원소를 잃거나 바꾸지 않는다', () => {
    const arr = SENTENCE_LIST.map((s) => s.id);
    expect(shuffle(arr, seeded(9)).sort()).toEqual([...arr].sort());
  });
});

describe('저장 데이터 버전 관리', () => {
  it('1단계 저장 데이터(이름만)를 현재 형식으로 옮긴다', () => {
    const r = parseSave({ playerName: '  민지  ' })!;
    expect(r.data).toEqual({ version: SAVE_VERSION, playerName: '민지', player: { gender: null, appearance: { hairStyle: 'short', eyes: 'dot' } }, exam: { stage: 1, passedAt: null, attempts: 0 }, learning: emptyLearningRecord(), npcs: {}, settings: defaultSettings() });
    expect(r.fromFuture).toBe(false);
  });

  it('잘못된 학습 기록 항목만 버리고 나머지는 유지한다', () => {
    const r = parseSave({
      version: 2,
      playerName: 'A',
      learning: {
        items: {
          'w.bayt': { firstStudiedAt: 10, lastStudiedAt: 20, attempts: 2, correct: 1, wrong: 1, lastResult: 'wrong', lastReviewedAt: 30, box: 99, dueAt: 30 },
          broken: { firstStudiedAt: 'x' },
          alsoBroken: 5,
        },
        position: { word: 3, sentence: -2 },
      },
    })!;
    expect(Object.keys(r.data.learning.items)).toEqual(['w.bayt']);
    expect(r.data.learning.items['w.bayt'].box).toBe(5); // 범위 보정
    expect(r.data.learning.position).toEqual({ word: 3, sentence: 0 });
  });

  it('2단계 저장 데이터(학습 기록 포함)를 최신 형식으로 옮기며 진도를 유지한다', () => {
    const r = parseSave({ version: 2, playerName: 'A', learning: { items: { 'w.bayt': { firstStudiedAt: 5, box: 2, dueAt: 9, correct: 1 } }, position: { word: 2, sentence: 1 } } })!;
    expect(r.data.version).toBe(SAVE_VERSION);
    expect(r.data.learning.items['w.bayt'].box).toBe(2);
    expect(r.data.learning.heard).toEqual({});
    expect(r.data.learning.saved).toEqual([]);
    expect(r.data.npcs).toEqual({});
  });

  it('3단계 주민 기억·설정을 검증하며 복원한다', () => {
    const r = parseSave({
      version: 3,
      playerName: 'A',
      learning: {},
      npcs: { layla: { facts: [{ kind: 'name', value: 'سارة', evidence: 'اسمي سارة', at: 1 }, { kind: 'hack', value: 'x' }], friendship: 7, recent: [{ role: 'npc', text: 'مَرْحَبًا' }, { role: 'evil', text: 'x' }] }, 'BAD ID!': {} },
      settings: { ttsEngine: 'audio', slow: true, addressGender: 'f', sttEngine: 'nope' },
    })!;
    expect(Object.keys(r.data.npcs)).toEqual(['layla']);
    expect(r.data.npcs.layla.facts).toHaveLength(1);
    expect(r.data.npcs.layla.recent).toHaveLength(1);
    expect(r.data.npcs.layla.friendship).toBe(7);
    expect(r.data.settings).toEqual({ ttsEngine: 'audio', slow: true, autoplay: true, sttEngine: 'auto', sttConsent: false });
    // 3단계까지는 성별이 대화 설정에 있었다 → 플레이어 정보로 옮긴다
    expect(r.data.player).toEqual({ gender: 'f', appearance: { hairStyle: 'short', eyes: 'dot' } });
  });

  it('3단계에서 성별을 지정하지 않았으면 첫 화면에서 다시 고르게 한다', () => {
    const r = parseSave({ version: 3, playerName: 'A', settings: { addressGender: 'unspecified' } })!;
    expect(r.data.player.gender).toBeNull();
    expect(parseSave({ playerName: 'A' })!.data.player.gender).toBeNull();
  });

  it('플레이어 성별·외형을 검증하며 복원한다', () => {
    const ok = parseSave({ version: 4, playerName: 'A', player: { gender: 'm', appearance: { hairStyle: 'curly', eyes: 'lashes' } } })!;
    expect(ok.data.player).toEqual({ gender: 'm', appearance: { hairStyle: 'curly', eyes: 'lashes' } });
    const bad = parseSave({ version: 4, playerName: 'A', player: { gender: 'x', appearance: { hairStyle: 'mohawk' } } })!;
    expect(bad.data.player).toEqual({ gender: null, appearance: { hairStyle: 'short', eyes: 'dot' } });
  });

  it('미래 버전 데이터는 읽되 덮어쓰지 않도록 표시한다', () => {
    expect(parseSave({ version: 99, playerName: 'B' })!.fromFuture).toBe(true);
    expect(parseSave(null)).toBeNull();
    expect(parseSave({ version: 2 })).toBeNull();
  });

  it('저장 → 복원 왕복 후에도 진도가 같다', () => {
    const { p, record } = setup();
    p.markStudied('w.bayt');
    p.recordAnswer('w.bayt', false);
    const restored = sanitizeLearningRecord(JSON.parse(JSON.stringify(record)));
    expect(restored).toEqual(record);
  });
});

describe('학습자 프로필 (AI 회화용)', () => {
  it('본 표현, 복습한 표현, 익숙한 표현, 복습 필요 표현을 구분한다', () => {
    const { p, advance } = setup();
    p.markStudied('w.marhaban'); // 보기만 함
    p.markStudied('w.shukran');
    p.recordAnswer('w.shukran', true); // 맞힘
    p.markStudied('w.bayt');
    p.recordAnswer('w.bayt', false); // 틀림
    advance(1);
    const prof = buildLearnerProfile(p);
    const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();
    expect(ids(prof.encountered)).toEqual(['w.bayt', 'w.marhaban', 'w.shukran']);
    expect(ids(prof.reviewed)).toEqual(['w.bayt', 'w.shukran']);
    expect(ids(prof.comfortable)).toEqual(['w.shukran']);
    expect(ids(prof.needsReview)).toEqual(['w.bayt', 'w.marhaban']);
    expect(prof.encountered.find((e) => e.id === 'w.marhaban')!.familiarity).toBe('seen');
    expect(prof.currentUnit.id).toBe('greetings');
    expect(prof.level).toBe(1);
    expect(prof.encountered[0].plain).not.toMatch(/[\u064B-\u0652]/);
  });
});
