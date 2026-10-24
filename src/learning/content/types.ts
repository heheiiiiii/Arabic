/**
 * 학습 콘텐츠 데이터 구조.
 *
 * 표기 구분
 * - ar:    학습용 표기 (모음 부호를 문법에 맞게 모두 표시). 화면·음성의 기본값.
 * - plain: 일반 표기 (부호 없음). 생략하면 ar에서 부호만 제거해 자동으로 만든다.
 */

export type UnitId = 'greetings' | 'introductions' | 'origin' | 'daily';
export type ItemKind = 'word' | 'sentence';
/** 1 = 가장 쉬움 */
export type Difficulty = 1 | 2 | 3;

/** 성별에 따라 형태가 달라지는 표현일 때: 누구에게(addressee) 또는 누가(speaker) 말하는지 */
export interface GenderInfo {
  role: 'addressee' | 'speaker';
  gender: 'm' | 'f';
  /** 반대 성별 형태의 항목 ID */
  pairId?: string;
}

export interface StudyItem {
  /** 고유 ID. 단어는 'w.', 문장은 's.'로 시작한다. 저장 데이터의 키이므로 바꾸지 않는다. */
  id: string;
  kind: ItemKind;
  unit: UnitId;
  difficulty: Difficulty;
  /** 학습용 표기 (모음 부호 포함) */
  ar: string;
  /** 일반 표기 (선택). 없으면 자동 생성 */
  plain?: string;
  /** 로마자 전사 (학습자용 간이 표기) */
  translit: string;
  /** 한국어식 발음 보조 (근사치) */
  pron: string;
  /** 한국어 의미 */
  ko: string;
  /** 의미상 같은 것으로 인정할 다른 한국어 뜻 (향후 입력형 문제·AI 판정용) */
  acceptKo?: string[];
  /** 품사 등 짧은 문법 정보 */
  grammar?: string;
  /** 언제·어떻게 쓰는지 */
  usage?: string;
  /** 문장에 들어 있는 핵심 단어 항목 ID */
  keyWords?: string[];
  gender?: GenderInfo;
  /** 음성 출력에 사용할 원문 (없으면 ar) */
  tts?: string;
}

export interface Unit {
  id: UnitId;
  order: number;
  titleKo: string;
  titleAr: string;
  difficulty: Difficulty;
  goalKo: string;
}

/** 문맥에 맞는 표현 고르기 문제 (사람이 직접 고른 상황 + 정답 + 오답) */
export interface ContextQuestion {
  id: string;
  /** 상황 설명 (한국어) */
  situationKo: string;
  /** 상대가 한 말 (선택, 학습 항목 ID) */
  promptItemId?: string;
  answerId: string;
  distractorIds: string[];
  /** 정답 해설 (한국어). 아랍어는 항목 ID로 연결해 별도로 표시한다. */
  explanationKo: string;
}
