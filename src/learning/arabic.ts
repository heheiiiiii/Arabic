/**
 * 아랍어 문자열 도우미.
 *
 * 원칙
 * - 아랍어 문자열을 뒤집거나 글자 순서를 재배열하지 않는다 (표시 방향은 HTML의 dir/CSS로만 처리).
 * - 데이터 원문에 Unicode 정규화를 적용하지 않는다. NFC는 부호를 지우지는 않지만
 *   샷다와 모음의 저장 순서를 바꿀 수 있으므로, 원문은 입력한 그대로 둔다.
 * - 모음 부호 제거는 "일반 표기" 생성과 답안 비교용으로만 쓴다.
 * - 소스 코드에서 결합 부호는 반드시 \u 이스케이프로 적는다 (눈에 보이지 않는 문자 방지).
 */

/** 탄윈·모음·샷다·수쿤 (U+064B–U+0652) */
const HARAKAT_RE = /[\u064B-\u0652]/;
/** 일반 표기에서 빠지는 부호: 하라카트 + 단검 알리프(U+0670) + 타트윌(U+0640) */
const STRIP_RE = /[\u064B-\u0652\u0670\u0640]/g;

const FATHATAN = '\u064B';
const DAMMATAN = '\u064C';
const KASRATAN = '\u064D';
const DAMMA = '\u064F';
const KASRA = '\u0650';
const SHADDA = '\u0651';
const DAGGER_ALIF = '\u0670';

/** 아랍 문자(기본 글자) 여부: U+0621–U+064A */
export function isArabicLetter(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c >= 0x0621 && c <= 0x064a;
}

export function isDiacritic(ch: string): boolean {
  return HARAKAT_RE.test(ch) || ch === DAGGER_ALIF;
}

export function hasHarakat(text: string): boolean {
  return HARAKAT_RE.test(text);
}

/** 모음 부호(결합 문자)의 개수 */
export function countDiacritics(text: string): number {
  return Array.from(text).filter(isDiacritic).length;
}

/** 학습용 표기 → 일반 표기 (모음 부호만 제거, 글자는 그대로). */
export function stripHarakat(text: string): string {
  return text.replace(STRIP_RE, '');
}

/** 답안 비교용 키: 부호·문장부호·공백·함자 자리 차이를 무시한다. */
export function comparisonKey(text: string): string {
  return stripHarakat(text)
    .replace(/[\u061F\u060C\u061B.!?,:"'«»\s]/g, '')
    .replace(/[\u0623\u0625\u0622]/g, '\u0627');
}

/**
 * 느슨한 정규화: 부호 제거 + 함자 자리 통일 + 문장부호 제거. 단어 사이 공백은 하나로 남긴다.
 * (음성 인식 결과처럼 부호가 없는 문장을 단어 단위로 비교할 때 사용)
 */
export function looseNormalize(text: string): string {
  return stripHarakat(text)
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')
    .replace(/[\u0649]/g, '\u064A')
    .replace(/[\u061F\u060C\u061B.!?,:"'«»()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 끝의 문장부호를 뗀 형태 (대사 속에 학습 문장이 들어 있는지 확인할 때 사용). */
export function trimPunctuation(text: string): string {
  return text.replace(/[\s.!?\u060C\u061F\u061B:]+$/u, '');
}

export interface DiacriticIssue {
  index: number;
  message: string;
}

interface LetterCluster {
  letter: string;
  marks: string[];
  index: number;
}

/**
 * 학습용 표기의 형식 검사. 문법 검사가 아니라 "부호를 잘못 찍은 흔적"을 찾는다.
 * - 부호는 아랍 글자 뒤에만 온다.
 * - 한 글자에 모음/수쿤/탄윈은 하나만 (샷다는 추가로 하나 가능).
 * - 탄윈은 단어 끝에만 온다 (파트하탄 + 끝 알리프/알리프 막수라는 허용).
 * - 부호가 없는 글자는 장모음 글자, 정관사 al-의 \u0644, 연결 알리프 등 정해진 경우에만 허용한다.
 */
export function findDiacriticIssues(text: string): DiacriticIssue[] {
  const issues: DiacriticIssue[] = [];
  const clusters: (LetterCluster | null)[] = []; // null = 글자가 아닌 것(공백, 문장부호)

  Array.from(text).forEach((ch, i) => {
    if (isDiacritic(ch)) {
      const last = clusters[clusters.length - 1];
      if (!last) issues.push({ index: i, message: '부호가 글자 없이 단독으로 쓰였습니다' });
      else last.marks.push(ch);
    } else if (isArabicLetter(ch)) {
      clusters.push({ letter: ch, marks: [], index: i });
    } else {
      clusters.push(null);
    }
  });

  const at = (k: number) => clusters[k] ?? null;
  const isWordStart = (k: number) => at(k - 1) === null;
  const isWordEnd = (k: number) => at(k + 1) === null;

  const bareAllowed = (k: number): boolean => {
    const c = at(k)!;
    const prev = at(k - 1);
    const prevVowel = prev?.marks.find((m) => m !== SHADDA);
    if (c.letter === '\u0627' || c.letter === '\u0649') return true; // \u0627 \u0649
    if (c.letter === '\u0648' && prevVowel === DAMMA) return true; // ū
    if (c.letter === '\u064A' && prevVowel === KASRA) return true; // ī
    // 정관사 al-의 \u0644 (태양 문자 앞에서는 부호 없이 씀): 단어 첫 \u0627 바로 뒤
    if (c.letter === '\u0644' && prev?.letter === '\u0627' && isWordStart(k - 1) && !isWordEnd(k)) return true;
    return false;
  };

  clusters.forEach((c, k) => {
    if (!c) return;
    const vowels = c.marks.filter((m) => m !== SHADDA && m !== DAGGER_ALIF);
    if (vowels.length > 1) issues.push({ index: c.index, message: `"${c.letter}"에 모음 부호가 ${vowels.length}개 있습니다` });
    if (c.marks.filter((m) => m === SHADDA).length > 1) issues.push({ index: c.index, message: `"${c.letter}"에 샷다가 중복되었습니다` });

    const tanwin = vowels.find((m) => m === FATHATAN || m === DAMMATAN || m === KASRATAN);
    if (tanwin && !isWordEnd(k)) {
      const next = at(k + 1);
      const okAlif = tanwin === FATHATAN && next && (next.letter === '\u0627' || next.letter === '\u0649') && isWordEnd(k + 1);
      if (!okAlif) issues.push({ index: c.index, message: '탄윈이 단어 끝이 아닌 곳에 있습니다' });
    }
    if (c.marks.length === 0 && !bareAllowed(k)) {
      issues.push({ index: c.index, message: `"${c.letter}"에 모음 부호가 없습니다` });
    }
  });

  return issues;
}
