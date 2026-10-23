/**
 * 브라우저 로컬 저장 (이번 단계에서는 플레이어 이름만 저장한다).
 * 진도·관계도 등은 다음 작업에서 이 구조를 확장한다.
 */
const STORAGE_KEY = 'arabic-village:v1';
export const DEFAULT_PLAYER_NAME = '유학생';
export const MAX_NAME_LENGTH = 12;

export interface SaveData {
  playerName: string;
}

let current: SaveData = { playerName: DEFAULT_PLAYER_NAME };

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (typeof parsed.playerName !== 'string') return null;
    current = { playerName: normalizeName(parsed.playerName) };
    return current;
  } catch {
    return null; // 사생활 보호 모드 등에서 저장소를 쓸 수 없어도 게임은 계속된다.
  }
}

export function setPlayerName(name: string): void {
  current = { ...current, playerName: normalizeName(name) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // 저장 실패는 무시한다 (이번 세션 동안은 메모리 값으로 진행).
  }
}

export function getPlayerName(): string {
  return current.playerName;
}

export function normalizeName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  return Array.from(trimmed).slice(0, MAX_NAME_LENGTH).join('') || DEFAULT_PLAYER_NAME;
}
