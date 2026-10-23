import { ALL_ITEMS, getItem, itemsOfKind, UNITS, type ItemKind, type StudyItem, type Unit } from './content';
import { MAX_BOX, type ItemProgress, type LearningRecord } from './record';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** 단계별 다음 복습까지의 간격. 0단계는 배운 즉시 복습 대상이다. */
export const BOX_INTERVALS = [0, 10 * MIN, DAY, 3 * DAY, 7 * DAY, 21 * DAY];

/**
 * 익숙함 정도. "본 적 있음"과 "맞힌 적 있음"을 구분한다.
 * - new:        아직 배우지 않음
 * - seen:       책상에서 봤지만 복습에서 맞힌 적 없음
 * - practicing: 맞힌 적 있음 (간격 반복 1~2단계)
 * - familiar:   시간 간격을 두고 여러 번 맞힘 (3단계 이상, 최소 하루 이상 걸림)
 */
export type Familiarity = 'new' | 'seen' | 'practicing' | 'familiar';

export interface ItemStatus {
  familiarity: Familiarity;
  needsReview: boolean;
  progress: ItemProgress | null;
}

export interface UnitProgress {
  unit: Unit;
  studied: number;
  total: number;
}

export interface LearningStats {
  wordsStudied: number;
  wordsTotal: number;
  sentencesStudied: number;
  sentencesTotal: number;
  dueCount: number;
  familiarCount: number;
  /** 아직 다 배우지 않은 첫 단원 (모두 배웠으면 마지막 단원) */
  currentUnit: Unit;
  allStudied: boolean;
  units: UnitProgress[];
}

export interface AnswerResult {
  boxBefore: number;
  boxAfter: number;
  /** 복습 시점에 맞혀 단계가 올라갔는지 */
  advanced: boolean;
}

/**
 * 학습 진도 로직. 저장 형식(LearningRecord)을 직접 고치고, 바뀔 때마다 onChange(저장)를 부른다.
 * 시간은 now()로 주입해 테스트할 수 있게 한다.
 */
export class LearningProgress {
  constructor(
    private readonly record: LearningRecord,
    private readonly onChange: () => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  get(id: string): ItemProgress | null {
    return this.record.items[id] ?? null;
  }

  isStudied(id: string): boolean {
    return id in this.record.items;
  }

  /**
   * 학습 화면에서 항목을 봤을 때 호출한다.
   * 처음이면 새로 배운 항목으로 기록하고 true, 이미 배운 항목이면 시각만 갱신하고 false.
   */
  markStudied(id: string): boolean {
    if (!getItem(id)) return false;
    const t = this.now();
    const existing = this.record.items[id];
    if (existing) {
      existing.lastStudiedAt = t;
      this.onChange();
      return false;
    }
    this.record.items[id] = {
      firstStudiedAt: t,
      lastStudiedAt: t,
      attempts: 0,
      correct: 0,
      wrong: 0,
      lastResult: null,
      lastReviewedAt: null,
      box: 0,
      dueAt: t, // 배운 항목은 곧바로 복습 대상
    };
    this.onChange();
    return true;
  }

  /**
   * 복습 결과 기록. 틀려도 기록을 지우지 않고, 단계만 한 칸 내려 다시 복습하게 한다.
   * 아직 복습 시점이 아닌 항목을 맞히면 기록만 남기고 단계는 올리지 않는다 (몰아서 풀어 숙달로 처리되는 것 방지).
   */
  recordAnswer(id: string, correct: boolean): AnswerResult | null {
    const p = this.record.items[id];
    if (!p) return null;
    const t = this.now();
    const boxBefore = p.box;
    const due = p.dueAt <= t;
    p.attempts++;
    p.lastReviewedAt = t;
    p.lastResult = correct ? 'correct' : 'wrong';
    let advanced = false;
    if (correct) {
      p.correct++;
      if (due) {
        p.box = Math.min(MAX_BOX, p.box + 1);
        p.dueAt = t + BOX_INTERVALS[p.box];
        advanced = true;
      }
    } else {
      p.wrong++;
      p.box = Math.max(0, p.box - 1);
      p.dueAt = t;
    }
    this.onChange();
    return { boxBefore, boxAfter: p.box, advanced };
  }

  status(id: string): ItemStatus {
    const p = this.get(id);
    if (!p) return { familiarity: 'new', needsReview: false, progress: null };
    return { familiarity: familiarityOf(p), needsReview: this.needsReview(p), progress: p };
  }

  needsReview(p: ItemProgress): boolean {
    return p.dueAt <= this.now() || p.lastResult === 'wrong';
  }

  /** 지금 복습할 항목 (오래 기다린 것부터) */
  dueItems(): StudyItem[] {
    return ALL_ITEMS.filter((i) => {
      const p = this.get(i.id);
      return p !== null && this.needsReview(p);
    }).sort((a, b) => this.get(a.id)!.dueAt - this.get(b.id)!.dueAt);
  }

  studiedItems(kind?: ItemKind): StudyItem[] {
    return (kind ? itemsOfKind(kind) : ALL_ITEMS).filter((i) => this.isStudied(i.id));
  }

  /** 단어/문장 목록에서 처음으로 아직 배우지 않은 항목의 인덱스 (모두 배웠으면 0) */
  firstUnstudiedIndex(kind: ItemKind): number {
    const idx = itemsOfKind(kind).findIndex((i) => !this.isStudied(i.id));
    return idx === -1 ? 0 : idx;
  }

  getPosition(kind: ItemKind): number {
    return this.record.position[kind];
  }

  setPosition(kind: ItemKind, index: number): void {
    this.record.position[kind] = index;
    this.onChange();
  }

  stats(): LearningStats {
    const words = itemsOfKind('word');
    const sentences = itemsOfKind('sentence');
    const units = [...UNITS]
      .sort((a, b) => a.order - b.order)
      .map((unit) => {
        const items = ALL_ITEMS.filter((i) => i.unit === unit.id);
        return { unit, studied: items.filter((i) => this.isStudied(i.id)).length, total: items.length };
      });
    const current = units.find((u) => u.studied < u.total);
    return {
      wordsStudied: words.filter((i) => this.isStudied(i.id)).length,
      wordsTotal: words.length,
      sentencesStudied: sentences.filter((i) => this.isStudied(i.id)).length,
      sentencesTotal: sentences.length,
      dueCount: this.dueItems().length,
      familiarCount: ALL_ITEMS.filter((i) => this.status(i.id).familiarity === 'familiar').length,
      currentUnit: (current ?? units[units.length - 1]).unit,
      allStudied: !current,
      units,
    };
  }
}

export function familiarityOf(p: ItemProgress): Familiarity {
  if (p.correct === 0) return 'seen';
  return p.box >= 3 ? 'familiar' : 'practicing';
}
