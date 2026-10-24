import { describe, expect, it } from 'vitest';
import { countDiacritics, findDiacriticIssues, hasHarakat, isArabicLetter, stripHarakat } from '../../src/learning/arabic';
import { ALL_ITEMS, CONTEXT_QUESTIONS, getItem, plainOf, SENTENCE_LIST, UNITS, WORD_LIST } from '../../src/learning/content';
import { LAYLA } from '../../src/data/dialogue';

/** 한국어 설명 속 아랍어 구간 (글자 3개 이상, 타트윌 없는 것만 = 단편 표기 예시 제외) */
function arabicRuns(text: string): string[] {
  // "اسْم + ـُكَ"처럼 어미 앞에 쓴 어간(끝 부호 없음)은 형태소 분해 표기이므로 제외한다.
  text = text.replace(/[^\s(]+\s*\+/g, '+');
  const runs = text.match(/[\u0621-\u0652\u0670\u0640]+(?:\s+[\u0621-\u0652\u0670\u0640]+)*/g) ?? [];
  return runs.filter((r) => !r.includes('\u0640') && Array.from(r).filter(isArabicLetter).length >= 3);
}

describe('학습 콘텐츠 무결성', () => {
  it('ID가 고유하고 접두어 규칙을 지킨다', () => {
    const ids = ALL_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of ALL_ITEMS) expect(i.id.startsWith(i.kind === 'word' ? 'w.' : 's.')).toBe(true);
  });

  it('모든 항목이 존재하는 단원에 속하고, 단원마다 단어와 문장이 있다', () => {
    for (const u of UNITS) {
      expect(WORD_LIST.some((w) => w.unit === u.id)).toBe(true);
      expect(SENTENCE_LIST.some((s) => s.unit === u.id)).toBe(true);
    }
  });

  it('필수 필드가 비어 있지 않다', () => {
    for (const i of ALL_ITEMS) {
      expect(i.ar.trim(), i.id).not.toBe('');
      expect(i.ko.trim(), i.id).not.toBe('');
      expect(i.translit.trim(), i.id).not.toBe('');
      expect(i.pron.trim(), i.id).not.toBe('');
    }
  });

  it('한국어 뜻이 같은 종류 안에서 겹치지 않는다 (객관식 보기 구분)', () => {
    for (const list of [WORD_LIST, SENTENCE_LIST]) {
      const kos = list.map((i) => i.ko);
      expect(new Set(kos).size).toBe(kos.length);
    }
  });

  it('아랍어 표기가 서로 겹치지 않는다', () => {
    const ars = ALL_ITEMS.map((i) => `${i.kind}:${i.ar}`);
    expect(new Set(ars).size).toBe(ars.length);
  });

  it('문장의 핵심 단어·성별 짝 참조가 모두 존재한다', () => {
    for (const s of ALL_ITEMS) {
      for (const k of s.keyWords ?? []) expect(getItem(k)?.kind, `${s.id} → ${k}`).toBe('word');
      if (s.gender?.pairId) {
        const pair = getItem(s.gender.pairId);
        expect(pair, s.id).toBeDefined();
        expect(pair!.gender?.pairId).toBe(s.id);
        expect(pair!.gender?.gender).not.toBe(s.gender.gender);
      }
    }
  });

  it('문맥 문제의 정답·오답·질문 항목이 존재하고 서로 다르다', () => {
    for (const q of CONTEXT_QUESTIONS) {
      const ids = [q.answerId, ...q.distractorIds];
      for (const id of [...ids, ...(q.promptItemId ? [q.promptItemId] : [])]) expect(getItem(id), `${q.id}: ${id}`).toBeDefined();
      expect(new Set(ids).size).toBe(ids.length);
      expect(q.distractorIds.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('모음 부호 표기', () => {
  it('모든 학습용 표기에 모음 부호가 있고, 형식 검사를 통과한다', () => {
    const problems: string[] = [];
    for (const i of ALL_ITEMS) {
      if (!hasHarakat(i.ar)) problems.push(`${i.id}: 부호 없음`);
      for (const issue of findDiacriticIssues(i.ar)) problems.push(`${i.id} "${i.ar}" @${issue.index}: ${issue.message}`);
    }
    expect(problems).toEqual([]);
  });

  it('설명·해설 속 아랍어도 형식 검사를 통과한다', () => {
    const problems: string[] = [];
    const texts: [string, string][] = [];
    for (const i of ALL_ITEMS) for (const t of [i.grammar, i.usage]) if (t) texts.push([i.id, t]);
    for (const q of CONTEXT_QUESTIONS) texts.push([q.id, q.explanationKo]);
    for (const u of UNITS) texts.push([u.id, u.titleAr]);
    for (const [id, t] of texts) {
      for (const run of arabicRuns(t)) {
        for (const issue of findDiacriticIssues(run)) problems.push(`${id} "${run}": ${issue.message}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('일반 표기는 부호만 빠지고 글자는 그대로다', () => {
    for (const i of ALL_ITEMS) {
      const plain = plainOf(i);
      expect(hasHarakat(plain), i.id).toBe(false);
      const letters = (s: string) => Array.from(s).filter((c) => !/[\u064B-\u0652\u0670\u0640]/.test(c)).join('');
      expect(letters(plain), i.id).toBe(letters(i.ar));
    }
  });

  it('NFC/NFD 정규화가 모음 부호를 지우지 않는다 (개수 보존)', () => {
    for (const i of ALL_ITEMS) {
      expect(countDiacritics(i.ar.normalize('NFC')), i.id).toBe(countDiacritics(i.ar));
      expect(countDiacritics(i.ar.normalize('NFD')), i.id).toBe(countDiacritics(i.ar));
    }
  });

  it('보이지 않는 방향 제어 문자나 타트윌이 데이터에 섞이지 않았다', () => {
    for (const i of ALL_ITEMS) expect(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\u0640]/.test(i.ar), i.id).toBe(false);
  });

  it('검사기가 실제 오류를 잡아낸다', () => {
    expect(findDiacriticIssues('مَرْحَبًا')).toEqual([]);
    expect(findDiacriticIssues('مرحبا').length).toBeGreaterThan(0); // 부호 없음
    expect(findDiacriticIssues('مَرَْحَبًا').length).toBeGreaterThan(0); // 한 글자에 모음 2개
    expect(findDiacriticIssues('مٌرْحَبًا').length).toBeGreaterThan(0); // 단어 중간 탄윈
    expect(findDiacriticIssues('\u064E').length).toBeGreaterThan(0); // 단독 부호
    expect(stripHarakat('كَيْفَ الْحَالُ؟')).toBe('كيف الحال؟');
  });
});

describe('주민 대화와 학습 데이터 연결', () => {
  it('대사가 참조하는 학습 항목이 존재하고, 대사 안에 그 표현이 그대로 들어 있다', () => {
    for (const line of [...LAYLA.greeting('m'), ...LAYLA.greeting('f')]) {
      expect(hasHarakat(line.ar)).toBe(true);
      expect(findDiacriticIssues(line.ar)).toEqual([]);
      for (const ref of line.refs ?? []) {
        const item = getItem(ref);
        expect(item, ref).toBeDefined();
        expect(line.ar.includes(item!.ar.replace(/[.!\u061F?\u060C]+$/u, '')), `${ref} in ${line.ar}`).toBe(true);
      }
    }
  });
});
