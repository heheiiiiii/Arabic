import { emptyLearningRecord, sanitizeLearningRecord, type LearningRecord } from '../learning/record';
import { emptyNpcMemory, sanitizeNpcMemory, type NpcMemoryRecord } from '../conversation/memory';
import { defaultSettings, sanitizeSettings, type Settings } from './settings';
import { DEFAULT_APPEARANCE, EYE_STYLES, HAIR_STYLES, type Appearance } from './art/person';
import { isGender, type Gender } from '../shared/conversation';

/**
 * 브라우저 로컬 저장.
 * - version 1 (1단계): { playerName }  ← version 필드 없음
 * - version 2 (2단계): { version, playerName, learning }
 * - version 3 (3단계): { version, playerName, learning, npcs, settings }  ← settings.addressGender: 'm' | 'f' | 'unspecified'
 * - version 4 (현재):  { version, playerName, player, learning, npcs, settings }
 * 키 이름은 1단계와 같게 유지해 기존 데이터가 사라지지 않게 한다.
 * 학습 진도(learning)와 주민 관계·기억(npcs)은 서로 다른 필드로 분리한다.
 */
const STORAGE_KEY = 'arabic-village:v1';
export const SAVE_VERSION = 4;
export const DEFAULT_PLAYER_NAME = '유학생';
export const MAX_NAME_LENGTH = 12;

/** 첫 화면에서 고르는 플레이어 정보. gender가 null이면 아직 고르지 않은 것(첫 화면에서 반드시 고른다). */
export interface PlayerProfile {
  gender: Gender | null;
  appearance: Appearance;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  playerName: string;
  player: PlayerProfile;
  learning: LearningRecord;
  npcs: Record<string, NpcMemoryRecord>;
  settings: Settings;
}

const fresh = (): SaveData => ({
  version: SAVE_VERSION,
  playerName: DEFAULT_PLAYER_NAME,
  player: { gender: null, appearance: { ...DEFAULT_APPEARANCE } },
  learning: emptyLearningRecord(),
  npcs: {},
  settings: defaultSettings(),
});

let current: SaveData = fresh();
/** 더 새로운 버전의 저장 데이터를 읽은 경우, 덮어써서 손상시키지 않도록 저장을 멈춘다. */
let readOnly = false;

/**
 * 저장소의 원본 값을 현재 형식으로 변환한다 (순수 함수, 테스트용으로 공개).
 * 알 수 없는 값은 기본값으로 대체하고, 잘못된 항목만 버린다.
 */
export function parseSave(raw: unknown): { data: SaveData; fromFuture: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.playerName !== 'string') return null;
  const version = typeof r.version === 'number' ? r.version : 1;
  const npcs: Record<string, NpcMemoryRecord> = {};
  if (version >= 3 && r.npcs && typeof r.npcs === 'object') {
    for (const [id, v] of Object.entries(r.npcs as Record<string, unknown>)) {
      if (/^[a-z0-9_-]{1,40}$/.test(id)) npcs[id] = sanitizeNpcMemory(v);
    }
  }
  const data: SaveData = {
    version: SAVE_VERSION,
    playerName: normalizeName(r.playerName),
    // v3까지는 성별이 대화 설정에 있었다. '지정 안 함'이었으면 첫 화면에서 다시 고른다.
    player: version >= 4 ? sanitizeProfile(r.player) : { gender: legacyGender(r.settings), appearance: { ...DEFAULT_APPEARANCE } },
    // v1에는 학습 기록이 없다 → 빈 기록으로 시작
    learning: version >= 2 ? sanitizeLearningRecord(r.learning) : emptyLearningRecord(),
    npcs,
    settings: version >= 3 ? sanitizeSettings(r.settings) : defaultSettings(),
  };
  return { data, fromFuture: version > SAVE_VERSION };
}

export function sanitizeProfile(raw: unknown): PlayerProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const a = (r.appearance && typeof r.appearance === 'object' ? r.appearance : {}) as Record<string, unknown>;
  const hair = HAIR_STYLES.find((h) => h.id === a.hairStyle)?.id ?? DEFAULT_APPEARANCE.hairStyle;
  const eyes = EYE_STYLES.find((e) => e.id === a.eyes)?.id ?? DEFAULT_APPEARANCE.eyes;
  return { gender: isGender(r.gender) ? r.gender : null, appearance: { hairStyle: hair, eyes } };
}

function legacyGender(settings: unknown): Gender | null {
  const g = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).addressGender : undefined;
  return isGender(g) ? g : null;
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

export function getPlayerProfile(): PlayerProfile {
  return current.player;
}

/** 첫 화면을 거친 뒤에는 항상 남/여 중 하나다. (그 전에 부르면 남성형을 쓴다) */
export function getPlayerGender(): Gender {
  return current.player.gender ?? 'm';
}

export function setPlayerProfile(p: { gender: Gender; appearance: Appearance }): void {
  current = { ...current, player: sanitizeProfile(p) };
  persist();
}

export function setPlayerGender(gender: Gender): void {
  setPlayerProfile({ gender, appearance: current.player.appearance });
}

/** 학습 기록 (같은 객체를 수정한 뒤 persist()를 호출한다) */
export function getLearningRecord(): LearningRecord {
  return current.learning;
}

/** 주민별 기억·관계 (없으면 새로 만든다) */
export function getNpcRecord(npcId: string): NpcMemoryRecord {
  current.npcs[npcId] ??= emptyNpcMemory();
  return current.npcs[npcId];
}

export function resetNpcRecord(npcId: string): void {
  current.npcs[npcId] = emptyNpcMemory();
  persist();
}

export function getSettings(): Settings {
  return current.settings;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  current.settings = sanitizeSettings({ ...current.settings, ...patch });
  persist();
  return current.settings;
}

export function normalizeName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  return Array.from(trimmed).slice(0, MAX_NAME_LENGTH).join('') || DEFAULT_PLAYER_NAME;
}
