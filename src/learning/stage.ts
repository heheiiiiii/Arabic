import { looseNormalize } from './arabic';
import { ALL_ITEMS, type StudyItem, type UnitId } from './content';

/**
 * 아랍어 시험 단계. 모든 주민의 대화 수준은 이 단계 하나만 따른다
 * (책상 학습 진도는 단계 안에서 어떤 표현을 다시 쓸지 고르는 데만 쓴다).
 *
 * 시험 기능이 아직 없어 단계 수는 임시로 5단계로 둔다.
 */
export const EXAM_STAGES = 5;
export type ExamStage = 1 | 2 | 3 | 4 | 5;

export function clampStage(n: unknown): ExamStage {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 1;
  return Math.min(EXAM_STAGES, Math.max(1, v)) as ExamStage;
}

/** 단원이 처음 쓰이는 단계 (인사 → 1, 자기소개·출신 → 2, 마을 생활 → 3) */
const UNIT_STAGE: Record<UnitId, ExamStage> = { greetings: 1, introductions: 2, origin: 2, daily: 3 };

/** 학습 항목이 속한 단계: 단원 단계와 난이도 중 높은 쪽 */
export function stageOf(item: StudyItem): ExamStage {
  return clampStage(Math.max(UNIT_STAGE[item.unit], item.difficulty));
}

/** 단계마다 한 번의 대답에서 허용하는 새 단어 수 (어휘 목록 밖 단어) */
export const NEW_WORDS_ALLOWED: Record<ExamStage, number> = { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 };

/** 단계별로 새로 쓸 수 있게 되는 기능어 (대명사·전치사·의문사·접속사·숫자 등) */
const FUNCTION_WORDS: Record<ExamStage, string[]> = {
  1: [
    'أَنَا', 'أَنْتَ', 'أَنْتِ', 'هُوَ', 'هِيَ', 'نَحْنُ', 'نَعَمْ', 'لَا', 'وَ', 'يَا',
    'وَاحِدٌ', 'اِثْنَانِ', 'ثَلَاثَةٌ', 'أَرْبَعَةٌ', 'خَمْسَةٌ', 'سِتَّةٌ', 'سَبْعَةٌ', 'ثَمَانِيَةٌ', 'تِسْعَةٌ', 'عَشَرَةٌ',
  ],
  2: ['مَا', 'مَاذَا', 'أَيْنَ', 'مَنْ', 'هَلْ', 'كَيْفَ', 'فِي', 'مِنْ', 'إِلَى', 'عَلَى', 'مَعَ', 'هٰذَا', 'هٰذِهِ', 'هُنَا', 'أَيْضًا', 'جِدًّا'],
  3: ['لٰكِنْ', 'ثُمَّ', 'أَوْ', 'عِنْدَ', 'الْيَوْمَ', 'أَمْسِ', 'الْآنَ', 'كُلَّ', 'كَثِيرًا', 'قَلِيلًا', 'مَتَى', 'كَمْ'],
  4: ['سَوْفَ', 'لِأَنَّ', 'أَكْثَرُ', 'غَدًا', 'رُبَّمَا', 'يَجِبُ', 'أَنْ'],
  5: ['الَّذِي', 'الَّتِي', 'إِذَا', 'لَوْ', 'حَتَّى', 'عِنْدَمَا', 'بَيْنَمَا'],
};

/** 이 단계까지 쓸 수 있는 학습 항목과 기능어 (학습용 표기) */
export function stageVocabulary(stage: ExamStage): { items: StudyItem[]; functionWords: string[] } {
  const items = ALL_ITEMS.filter((i) => stageOf(i) <= stage);
  const functionWords: string[] = [];
  for (let s = 1; s <= stage; s++) functionWords.push(...FUNCTION_WORDS[s as ExamStage]);
  return { items, functionWords };
}

// ── 어휘 검사 ─────────────────────────────────────────

/** 앞에 붙는 접속사·전치사·관사 (긴 것부터) */
const PREFIXES = ['وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك', 'س'];
/** 뒤에 붙는 대명사 접미사 (긴 것부터) */
const SUFFIXES = ['كما', 'هما', 'كم', 'كن', 'هم', 'هن', 'ها', 'نا', 'ني', 'ه', 'ك', 'ي'];

/** 단어 하나의 비교용 형태들: 원형, 접두사·접미사를 뗀 형태 */
function variants(word: string): string[] {
  const out = new Set([word]);
  for (const p of PREFIXES) {
    if (word.startsWith(p) && word.length - p.length >= 2) out.add(word.slice(p.length));
  }
  for (const w of [...out]) {
    for (const s of SUFFIXES) {
      if (w.endsWith(s) && w.length - s.length >= 2) out.add(w.slice(0, -s.length));
    }
    // 타 마르부타(ة)가 접미사 앞에서 ت가 되는 경우
    if (w.endsWith('ت')) out.add(`${w.slice(0, -1)}ة`);
  }
  return [...out];
}

const words = (text: string) => looseNormalize(text).split(' ').filter((w) => /[ء-ي]/.test(w) && w.length >= 2);

const lexiconCache = new Map<ExamStage, Set<string>>();

function lexicon(stage: ExamStage): Set<string> {
  let set = lexiconCache.get(stage);
  if (!set) {
    const { items, functionWords } = stageVocabulary(stage);
    set = new Set<string>();
    for (const text of [...items.map((i) => i.ar), ...functionWords]) {
      for (const w of words(text)) for (const v of variants(w)) set.add(v);
    }
    lexiconCache.set(stage, set);
  }
  return set;
}

/**
 * 문장에서 이 단계 어휘 목록 밖의 단어를 찾는다 (일반 표기로 돌려준다).
 * 접두사·접미사만 떼어 보는 근사 검사라, 활용형은 목록 밖으로 잡힐 수 있다.
 * @param allowed 플레이어가 직접 쓴 말 등, 목록 밖이어도 허용할 문장들 (이름 등)
 */
export function offStageWords(text: string, stage: ExamStage, allowed: string[] = []): string[] {
  const lex = lexicon(stage);
  const extra = new Set(allowed.flatMap(words));
  const out: string[] = [];
  for (const w of words(text)) {
    if (extra.has(w) || out.includes(w)) continue;
    if (!variants(w).some((v) => lex.has(v))) out.push(w);
  }
  return out;
}
