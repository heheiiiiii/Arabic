import { findDiacriticIssues, looseNormalize } from '../../src/learning/arabic';
import type { NpcReply } from '../../src/shared/conversation';

/** 문장 속 아랍어 구간 중 형식 검사에 걸리는 것 (이름처럼 부호 없는 짧은 단어 하나는 넘어간다) */
export function suspiciousArabic(text: string): boolean {
  const runs = text.match(/[\u0621-\u0652\u0670]+(?:[ \u060C\u061F]+[\u0621-\u0652\u0670]+)*/g) ?? [];
  return runs.some((run) => {
    const words = run.split(/[ \u060C\u061F]+/).filter(Boolean);
    const issues = findDiacriticIssues(run);
    // 부호가 하나도 없는 한 단어(사람 이름 등)는 검사 대상에서 뺀다
    const bareSingles = words.filter((w) => !/[\u064B-\u0652]/.test(w)).length;
    return issues.length > 0 && !(words.length === bareSingles && words.length <= 1);
  });
}

/** 검사 대상 문장들 (경로, 문장) */
export function arabicFields(r: Pick<NpcReply, 'reply' | 'hint' | 'correction'>): { path: string; text: string }[] {
  const out = [{ path: 'reply', text: r.reply.ar }, { path: 'hint.model', text: r.hint.model.ar }];
  r.hint.alternatives.forEach((a, i) => out.push({ path: `hint.alternatives.${i}`, text: a }));
  r.hint.words.forEach((w, i) => out.push({ path: `hint.words.${i}`, text: w.ar }));
  if (r.correction) out.push({ path: 'correction.better', text: r.correction.better.ar });
  return out;
}

/** 교정 결과가 원문과 같은 글자인지 (모음 부호만 바뀌었는지) */
export function sameLetters(a: string, b: string): boolean {
  return looseNormalize(a) === looseNormalize(b);
}
