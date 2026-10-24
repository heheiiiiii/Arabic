import { stripHarakat } from '../arabic';
import { CONTEXT_QUESTIONS } from './contexts';
import { SENTENCES } from './sentences';
import type { ItemKind, StudyItem, Unit, UnitId } from './types';
import { UNITS } from './units';
import { WORDS } from './words';

export type { ContextQuestion, GenderInfo, ItemKind, StudyItem, Unit, UnitId } from './types';
export { CONTEXT_QUESTIONS, UNITS };

const unitOrder = (u: UnitId) => UNITS.find((x) => x.id === u)!.order;
const byUnit = (a: StudyItem, b: StudyItem) => unitOrder(a.unit) - unitOrder(b.unit);

/** 학습 순서대로 정렬한 단어·문장 (단원 순서, 단원 안에서는 데이터에 적은 순서) */
export const WORD_LIST: readonly StudyItem[] = [...WORDS].sort(byUnit);
export const SENTENCE_LIST: readonly StudyItem[] = [...SENTENCES].sort(byUnit);
export const ALL_ITEMS: readonly StudyItem[] = [...WORD_LIST, ...SENTENCE_LIST];

const ITEM_MAP = new Map(ALL_ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): StudyItem | undefined {
  return ITEM_MAP.get(id);
}

export function requireItem(id: string): StudyItem {
  const item = ITEM_MAP.get(id);
  if (!item) throw new Error(`학습 항목을 찾을 수 없습니다: ${id}`);
  return item;
}

export function itemsOfKind(kind: ItemKind): readonly StudyItem[] {
  return kind === 'word' ? WORD_LIST : SENTENCE_LIST;
}

export function getUnit(id: UnitId): Unit {
  return UNITS.find((u) => u.id === id)!;
}

/** 일반 표기 (데이터에 없으면 모음 부호만 제거해 만든다) */
export function plainOf(item: StudyItem): string {
  return item.plain ?? stripHarakat(item.ar);
}

/** 음성 출력용 원문 */
export function ttsOf(item: StudyItem): string {
  return item.tts ?? item.ar;
}

/** 이 단어가 핵심 단어로 들어 있는 문장들 */
export function sentencesUsingWord(wordId: string): StudyItem[] {
  return SENTENCE_LIST.filter((s) => s.keyWords?.includes(wordId));
}
