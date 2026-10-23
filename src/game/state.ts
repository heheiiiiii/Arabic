import { emptyLearningRecord, sanitizeLearningRecord, type LearningRecord } from '../learning/record';

/**
 * 브라우저 로컬 저장.
 * - version 1 (1단계): { playerName }  ← version 필드 없음
 * - version 2 (현재):  { version, playerName, learning }
 * 키 이름은 1단계와 같게 유지해 기존 이름이 사라지지 않게 한다.
 */
const STORAGE_KEY = 'arabic-village:v1';
export const SAVE_VERSION = 2;
export const DEFAULT_PLAYER_NAME = '유학생';
export const MAX_NAME_LENGTH = 12;

export interface SaveData {
  version: typeof SAVE_VERSION;
  playerName: string;
  learning: LearningRecord;
}

let current: SaveData = { version: SAVE_VERSION, playerName: DEFAULT_PLAYER_NAME, learning: emptyLearningRecord() };
/** 더 새로운 버전의 저장 데이터를 읽은 경우, 덮어써서 손상시키지 않도록 저장을 멈춘다. */
let readOnly = false;

/**
 * 저장소의 원본 값을 현재 형식으로 변환한다 (순수 함수, 테스트용으로 공개).
 * 알 수 없는 값은 기본값으로 대체하고, 학습 기록 중 잘못된 항목만 버린다.
 */
export function parseSave(raw: unknown): { data: SaveData; fromFuture: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.playerName !== 'string') return null;
  const version = typeof r.version === 'number' ? r.version : 1;
  const data: SaveData = {
    version: SAVE_VERSION,
    playerName: normalizeName(r.playerName),
    // v1에는 학습 기록이 없다 → 빈 기록으로 시작
    learning: version >= 2 ? sanitizeLearningRecord(r.learning) : emptyLearningRecord(),
  };
  return { data, fromFuture: version > SAVE_VERSION };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseSave(JSON.parse(raw));
    if (!parsed) return null;
    current = parsed.data;
    readOnly = parsed.fromFuture;
    return current;
  } catch {
    return null; // 사생활 보호 모드 등에서 저장소를 쓸 수 없어도 게임은 계속된다.
  }
}

/** 현재 상태를 저장한다. 실패해도 이번 세션 동안은 메모리 값으로 진행한다. */
export function persist(): void {
  if (readOnly) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // 저장 실패는 무시한다.
  }
}

export function setPlayerName(name: string): void {
  current = { ...current, playerName: normalizeName(name) };
  persist();
}

export function getPlayerName(): string {
  return current.playerName;
}

/** 학습 기록 (같은 객체를 수정한 뒤 persist()를 호출한다) */
export function getLearningRecord(): LearningRecord {
  return current.learning;
}

export function normalizeName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  return Array.from(trimmed).slice(0, MAX_NAME_LENGTH).join('') || DEFAULT_PLAYER_NAME;
}
