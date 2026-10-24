import { describe, expect, it } from 'vitest';
import { comparisonKey, findDiacriticIssues, looseNormalize, stripHarakat } from '../../src/learning/arabic';
import { practiceReply } from '../../src/shared/practiceNpc';
import { LIMITS, parseNpcReply, validateChatRequest, type ChatRequest, type NpcReply } from '../../src/shared/conversation';
import { acceptMemoryCandidates, emptyNpcMemory, findContentItems, FRIENDSHIP_DAILY_CAP, recordTurn, rewardPlayerMessage, startConversation } from '../../src/conversation/memory';
import { splitSentences } from '../../src/shared/sentences';

const baseReq = (over: Partial<ChatRequest> = {}): ChatRequest => ({
  npcId: 'layla',
  playerText: null,
  history: [],
  memory: { facts: [], topics: [], conversations: 0 },
  learner: { examStage: 1, unitTitleKo: '', comfortable: [], needsReview: [], seenOnly: [], studiedCount: 0 },
  addressGender: 'm',
  ...over,
});

/** 응답 속 모든 아랍어 문장 */
const arabicOf = (r: NpcReply) => [r.reply.ar, r.hint.model.ar, ...r.hint.alternatives, ...r.hint.words.map((w) => w.ar)].filter((t) => !t.includes('…'));

describe('하라카트 비교 (음성 인식 결과처럼 부호가 없어도)', () => {
  it('부호 유무·함자 자리·문장부호 차이를 무시하고 비교한다', () => {
    expect(comparisonKey('أَنَا بِخَيْرٍ، شُكْرًا.')).toBe(comparisonKey('انا بخير شكرا'));
    expect(looseNormalize('كَيْفَ الْحَالُ؟')).toBe('كيف الحال');
    expect(looseNormalize('إِلَى اللِّقَاءِ')).toBe(looseNormalize('الي اللقاء'));
    expect(stripHarakat('مَرْحَبًا')).toBe('مرحبا');
  });

  it('문장 나누기는 글자를 바꾸지 않고 순서를 유지한다', () => {
    const t = 'تَشَرَّفْنَا. كَيْفَ الْحَالُ؟ أَهْلًا!';
    const parts = splitSentences(t);
    expect(parts).toEqual(['تَشَرَّفْنَا.', 'كَيْفَ الْحَالُ؟', 'أَهْلًا!']);
    expect(parts.join(' ')).toBe(t);
  });
});

describe('연습 상대 (모의 NPC)', () => {
  it('항상 source=practice로 표시되고, 첫 인사를 한다', () => {
    const r = practiceReply(baseReq());
    expect(r.source).toBe('practice');
    expect(r.reply.ar).toContain('مَرْحَبًا');
    expect(r.hint.model.ar).toBeTruthy();
  });

  it('부호 없는 입력(음성 인식 결과 등)을 알아듣고 다음 주제를 묻는다', () => {
    const r = practiceReply(baseReq({ playerText: 'مرحبا' }));
    expect(r.understood).toBe(true);
    expect(r.reply.ar).toContain('كَيْفَ حَالُكَ؟');
    const r2 = practiceReply(baseReq({ playerText: 'السلام عليكم' }));
    expect(r2.reply.ar).toContain('وَعَلَيْكُمُ السَّلَامُ');
  });

  it('이름을 말하면 근거와 함께 기억 후보를 낸다', () => {
    const r = practiceReply(baseReq({ playerText: 'اسمي سارة' }));
    expect(r.memoryCandidates).toEqual([{ kind: 'name', value: 'سارة', evidence: 'اسمي سارة' }]);
  });

  it('플레이어 성별에 맞는 형태로 묻는다', () => {
    const first = (g: 'm' | 'f') => practiceReply(baseReq({ playerText: 'مرحبا', addressGender: g }));
    expect(first('m').reply.ar).toContain('كَيْفَ حَالُكَ؟');
    expect(first('f').reply.ar).toContain('كَيْفَ حَالُكِ؟');
    const asked = [{ role: 'npc' as const, text: 'كَيْفَ حَالُكَ؟' }];
    const m = practiceReply(baseReq({ playerText: 'انا بخير', history: asked, addressGender: 'm' }));
    const f = practiceReply(baseReq({ playerText: 'انا بخير', history: asked, addressGender: 'f' }));
    expect(m.reply.ar).toContain('مَا اسْمُكَ؟');
    expect(f.reply.ar).toContain('مَا اسْمُكِ؟');
  });

  it('플레이어가 자기를 말하는 예시도 성별에 맞춘다', () => {
    const history = [{ role: 'npc' as const, text: 'كَيْفَ حَالُكَ؟' }, { role: 'player' as const, text: 'اسمي سارة' }, { role: 'npc' as const, text: 'اِسْمِي لَيْلَى. مَا اسْمُكَ؟' }];
    const m = practiceReply(baseReq({ playerText: 'اسمي سامي', history, addressGender: 'm' }));
    const f = practiceReply(baseReq({ playerText: 'اسمي سارة', history, addressGender: 'f' }));
    expect(m.reply.ar).toContain('مِنْ أَيْنَ أَنْتَ؟');
    expect(m.hint.alternatives).toContain('أَنَا كُورِيٌّ.');
    expect(f.reply.ar).toContain('مِنْ أَيْنَ أَنْتِ؟');
    expect(f.hint.alternatives).toContain('أَنَا كُورِيَّةٌ.');
  });

  it('대화 중에 성별을 바꿔도 이미 물은 주제를 다시 묻지 않는다', () => {
    const history = [{ role: 'npc' as const, text: 'مَرْحَبًا! كَيْفَ حَالُكَ؟' }];
    const r = practiceReply(baseReq({ playerText: 'انا بخير', history, addressGender: 'f' }));
    expect(r.reply.ar).not.toContain('حَالُكِ');
    expect(r.reply.ar).toContain('مَا اسْمُكِ؟');
  });

  it('알아듣지 못하면 벌점 없이 되묻고 힌트를 준다 (한국어 입력 포함)', () => {
    for (const t of ['안녕하세요', 'زززز ققق']) {
      const r = practiceReply(baseReq({ playerText: t, history: [{ role: 'npc', text: 'كَيْفَ الْحَالُ؟' }] }));
      expect(r.understood).toBe(false);
      expect(r.hint.model.ar).toBeTruthy();
    }
  });

  it('연습 상대가 말하는 모든 아랍어 문장이 모음 부호 형식 검사를 통과한다', () => {
    const inputs = [null, 'مرحبا', 'السلام عليكم', 'صباح الخير', 'مساء الخير', 'كيف الحال', 'انا بخير', 'اسمي سارة', 'انا من كوريا', 'احب الشاي', 'شكرا', 'نعم', 'مع السلامة', 'xyz'];
    const problems: string[] = [];
    for (const g of ['m', 'f'] as const) {
      const history: ChatRequest['history'] = [];
      for (let step = 0; step < 6; step++) {
        for (const t of inputs) {
          const r = practiceReply(baseReq({ playerText: t, history: [...history], addressGender: g }));
          for (const s of arabicOf(r)) for (const i of findDiacriticIssues(s)) problems.push(`${s}: ${i.message}`);
        }
        const r = practiceReply(baseReq({ playerText: 'نعم', history: [...history], addressGender: g }));
        history.push({ role: 'player', text: 'نعم' }, { role: 'npc', text: r.reply.ar });
      }
    }
    expect([...new Set(problems)]).toEqual([]);
  });
});

describe('응답·요청 검증', () => {
  const good = practiceReply(baseReq());

  it('올바른 응답은 통과하고, 필수 필드가 빠지면 거부한다', () => {
    expect(parseNpcReply(JSON.parse(JSON.stringify(good)))).not.toBeNull();
    expect(parseNpcReply({ ...good, reply: { ko: '안녕' } })).toBeNull();
    expect(parseNpcReply({ ...good, source: 'hacker' })).toBeNull();
    expect(parseNpcReply('not json')).toBeNull();
    const extra = parseNpcReply({ ...good, friendship: 999, reward: 'gold' }) as unknown as Record<string, unknown>;
    expect(extra.friendship).toBeUndefined(); // AI가 게임 상태 필드를 넣어도 버린다
  });

  it('잘못된 기억 후보 종류는 버린다', () => {
    const r = parseNpcReply({ ...good, memoryCandidates: [{ kind: 'friendship', value: '100', evidence: 'x' }, { kind: 'name', value: 'سارة', evidence: 'اسمي سارة' }] });
    expect(r!.memoryCandidates).toEqual([{ kind: 'name', value: 'سارة', evidence: 'اسمي سارة' }]);
  });

  it('요청 크기와 형식을 제한한다', () => {
    expect(typeof validateChatRequest({ ...baseReq(), playerText: 'ا'.repeat(LIMITS.playerText + 1) })).toBe('string');
    expect(typeof validateChatRequest({ ...baseReq(), npcId: '../etc' })).toBe('string');
    expect(typeof validateChatRequest({ ...baseReq(), playerText: '   ' })).toBe('string');
    expect(typeof validateChatRequest({ npcId: 'layla' })).toBe('string');
    expect(typeof validateChatRequest({ ...baseReq(), addressGender: 'unspecified' })).toBe('string');
    expect(validateChatRequest({ ...baseReq(), addressGender: 'f' })).toMatchObject({ addressGender: 'f' });
    expect(validateChatRequest(baseReq({ playerText: 'مرحبا' }))).toMatchObject({ playerText: 'مرحبا' });
  });
});

describe('주민 기억과 친밀도 (게임 로직)', () => {
  it('플레이어가 실제로 한 말에 근거가 있는 기억만 저장한다', () => {
    const m = emptyNpcMemory();
    const saved = acceptMemoryCandidates(
      m,
      [
        { kind: 'name', value: 'سارة', evidence: 'اسمي سارة' },
        { kind: 'likes', value: 'القهوة', evidence: 'أحب القهوة' }, // 플레이어가 말하지 않음
        { kind: 'origin', value: 'كوريا', evidence: 'اسمي سارة' }, // 근거에 값이 없음
      ],
      'مَرْحَبًا، اِسْمِي سَارَة',
      1,
    );
    expect(saved.map((f) => f.kind)).toEqual(['name']);
    expect(m.facts).toHaveLength(1);
  });

  it('이름처럼 하나뿐인 정보는 새 값으로 바꾸고, 목록형은 중복 없이 상한을 지킨다', () => {
    const m = emptyNpcMemory();
    acceptMemoryCandidates(m, [{ kind: 'name', value: 'سارة', evidence: 'اسمي سارة' }], 'اسمي سارة', 1);
    acceptMemoryCandidates(m, [{ kind: 'name', value: 'منى', evidence: 'اسمي منى' }], 'اسمي منى', 2);
    expect(m.facts.filter((f) => f.kind === 'name').map((f) => f.value)).toEqual(['منى']);
    for (let i = 0; i < 8; i++) acceptMemoryCandidates(m, [{ kind: 'likes', value: `ش${i}`, evidence: `احب ش${i}` }], `احب ش${i}`, 10 + i);
    acceptMemoryCandidates(m, [{ kind: 'likes', value: 'ش7', evidence: 'احب ش7' }], 'احب ش7', 30);
    expect(m.facts.filter((f) => f.kind === 'likes')).toHaveLength(5);
  });

  it('친밀도는 아랍어로 말할 때만, 하루 상한까지만 오른다 (실수·힌트로 깎이지 않음)', () => {
    const m = emptyNpcMemory();
    const day = Date.UTC(2026, 9, 24, 3);
    expect(startConversation(m, day)).toBe(1);
    expect(rewardPlayerMessage(m, '안녕하세요', day)).toBe(0);
    let total = 1;
    for (let i = 0; i < 10; i++) total += rewardPlayerMessage(m, 'مرحبا', day);
    expect(total).toBe(FRIENDSHIP_DAILY_CAP);
    expect(m.friendship).toBe(FRIENDSHIP_DAILY_CAP);
    expect(rewardPlayerMessage(m, 'مرحبا', day + 24 * 3600_000)).toBe(1); // 다음 날
  });

  it('최근 대화만 일정 길이로 저장한다', () => {
    const m = emptyNpcMemory();
    for (let i = 0; i < 60; i++) recordTurn(m, { role: i % 2 ? 'npc' : 'player', text: `t${i}` });
    expect(m.recent.length).toBe(LIMITS.historyTurns * 2);
    expect(m.recent.at(-1)!.text).toBe('t59');
  });

  it('대화 문장 속 학습 항목을 찾는다 (부호가 없어도, 정관사·접속사가 붙어도)', () => {
    expect(findContentItems('تَشَرَّفْنَا. كَيْفَ الْحَالُ؟')).toEqual(expect.arrayContaining(['s.tasharrafna', 's.kayfa_hal', 'w.kayfa']));
    expect(findContentItems('انا احب القهوة')).toEqual(expect.arrayContaining(['w.ana', 'w.uhibbu', 'w.qahwa']));
    expect(findContentItems('شكرا')).toContain('w.shukran');
    expect(findContentItems('xyz')).toEqual([]);
  });
});
