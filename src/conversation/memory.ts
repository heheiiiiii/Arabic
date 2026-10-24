import { looseNormalize } from '../learning/arabic';
import { ALL_ITEMS } from '../learning/content';
import { LIMITS, MEMORY_KINDS, type ChatRequest, type ChatTurn, type MemoryFact, type MemoryKind, type NpcReply } from '../shared/conversation';

/**
 * 주민별 기억과 관계 (게임 로직이 소유한다).
 * - AI는 "기억 후보"만 제안하고, 여기서 플레이어가 실제로 한 말에 근거가 있는지 확인한 것만 저장한다.
 * - 친밀도는 AI 응답과 무관하게 정해진 규칙으로만 오른다.
 * - 대화 전체가 아니라 최근 대화 몇 턴과 중요한 사실만 저장한다.
 */
export interface NpcMemoryRecord {
  facts: MemoryFact[];
  /** 최근 대화 (최대 LIMITS.historyTurns * 2 턴) */
  recent: ChatTurn[];
  /** 최근에 이야기한 주제 (최대 10개) */
  topics: string[];
  /** 대화를 연 횟수 */
  conversations: number;
  friendship: number;
  /** 친밀도 일일 상한 관리 */
  friendshipDay: string;
  friendshipToday: number;
  lastTalkedAt: number;
}

export const FRIENDSHIP_DAILY_CAP = 6;
export const FRIENDSHIP_LEVELS = [
  { min: 0, label: '처음 만난 사이' },
  { min: 5, label: '아는 사이' },
  { min: 15, label: '친한 이웃' },
  { min: 35, label: '좋은 친구' },
  { min: 70, label: '단짝' },
] as const;

const MAX_PER_KIND: Record<MemoryKind, number> = { name: 1, origin: 1, likes: 5, dislikes: 5, interest: 5, promise: 3, fact: 5 };

export function emptyNpcMemory(): NpcMemoryRecord {
  return { facts: [], recent: [], topics: [], conversations: 0, friendship: 0, friendshipDay: '', friendshipToday: 0, lastTalkedAt: 0 };
}

export function sanitizeNpcMemory(raw: unknown): NpcMemoryRecord {
  const out = emptyNpcMemory();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  if (Array.isArray(r.facts)) {
    for (const f of r.facts.slice(0, LIMITS.facts) as Record<string, unknown>[]) {
      if (f && MEMORY_KINDS.includes(f.kind as MemoryKind) && typeof f.value === 'string' && f.value.length <= 80) {
        out.facts.push({ kind: f.kind as MemoryKind, value: f.value, evidence: typeof f.evidence === 'string' ? f.evidence.slice(0, 300) : '', at: n(f.at) });
      }
    }
  }
  if (Array.isArray(r.recent)) {
    for (const t of r.recent.slice(-LIMITS.historyTurns * 2) as Record<string, unknown>[]) {
      if (t && (t.role === 'player' || t.role === 'npc') && typeof t.text === 'string') out.recent.push({ role: t.role, text: t.text.slice(0, 600) });
    }
  }
  if (Array.isArray(r.topics)) out.topics = (r.topics as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 10).map((t) => t.slice(0, 60));
  out.conversations = n(r.conversations);
  out.friendship = n(r.friendship);
  out.friendshipDay = typeof r.friendshipDay === 'string' ? r.friendshipDay.slice(0, 10) : '';
  out.friendshipToday = n(r.friendshipToday);
  out.lastTalkedAt = n(r.lastTalkedAt);
  return out;
}

export function friendshipLevel(points: number): { level: number; label: string; next: number | null } {
  let level = 0;
  FRIENDSHIP_LEVELS.forEach((l, i) => {
    if (points >= l.min) level = i;
  });
  const next = FRIENDSHIP_LEVELS[level + 1]?.min ?? null;
  return { level, label: FRIENDSHIP_LEVELS[level].label, next };
}

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);
const ARABIC_LETTER = /[\u0621-\u064A]/g;

/** 대화를 시작할 때 (하루 첫 대화면 친밀도 +1) */
export function startConversation(m: NpcMemoryRecord, now: number): number {
  m.conversations++;
  m.lastTalkedAt = now;
  return addFriendship(m, 1, now);
}

/**
 * 플레이어가 아랍어로 말했을 때만 친밀도를 올린다 (하루 상한 있음).
 * 틀린 문장, 힌트 사용, 인식 실패는 감점하지 않는다.
 */
export function rewardPlayerMessage(m: NpcMemoryRecord, playerText: string, now: number): number {
  const letters = playerText.match(ARABIC_LETTER)?.length ?? 0;
  if (letters < 2) return 0;
  return addFriendship(m, 1, now);
}

function addFriendship(m: NpcMemoryRecord, amount: number, now: number): number {
  const day = dayOf(now);
  if (m.friendshipDay !== day) {
    m.friendshipDay = day;
    m.friendshipToday = 0;
  }
  const gain = Math.max(0, Math.min(amount, FRIENDSHIP_DAILY_CAP - m.friendshipToday));
  m.friendship += gain;
  m.friendshipToday += gain;
  return gain;
}

export function recordTurn(m: NpcMemoryRecord, turn: ChatTurn): void {
  m.recent.push({ role: turn.role, text: turn.text.slice(0, 600) });
  if (m.recent.length > LIMITS.historyTurns * 2) m.recent.splice(0, m.recent.length - LIMITS.historyTurns * 2);
}

export function addTopic(m: NpcMemoryRecord, topic: string): void {
  const t = topic.trim().slice(0, 60);
  if (!t) return;
  m.topics = [t, ...m.topics.filter((x) => x !== t)].slice(0, 10);
}

/**
 * AI가 제안한 기억 후보 중, 근거(evidence)가 플레이어의 방금 한 말에 실제로 들어 있는 것만 저장한다.
 * @returns 저장된 사실
 */
export function acceptMemoryCandidates(m: NpcMemoryRecord, candidates: NpcReply['memoryCandidates'], playerText: string, now: number): MemoryFact[] {
  const said = looseNormalize(playerText);
  const accepted: MemoryFact[] = [];
  for (const c of candidates) {
    const evidence = looseNormalize(c.evidence);
    const value = c.value.trim().slice(0, 40);
    if (!value || evidence.length < 2 || !said.includes(evidence)) continue;
    // 값도 근거 안에 들어 있어야 한다 (아랍어 값인 경우). 한국어 요약 값은 근거 확인만 한다.
    if (/[\u0621-\u064A]/.test(value) && !said.includes(looseNormalize(value))) continue;
    const fact: MemoryFact = { kind: c.kind, value, evidence: c.evidence.slice(0, 300), at: now };
    const sameKind = m.facts.filter((f) => f.kind === c.kind);
    if (MAX_PER_KIND[c.kind] === 1) {
      m.facts = m.facts.filter((f) => f.kind !== c.kind);
    } else if (sameKind.some((f) => looseNormalize(f.value) === looseNormalize(value))) {
      continue;
    } else if (sameKind.length >= MAX_PER_KIND[c.kind]) {
      const oldest = sameKind.sort((a, b) => a.at - b.at)[0];
      m.facts = m.facts.filter((f) => f !== oldest);
    }
    m.facts.push(fact);
    accepted.push(fact);
  }
  if (m.facts.length > LIMITS.facts) m.facts.splice(0, m.facts.length - LIMITS.facts);
  return accepted;
}

export function forgetFact(m: NpcMemoryRecord, fact: MemoryFact): void {
  m.facts = m.facts.filter((f) => !(f.kind === fact.kind && f.value === fact.value && f.at === fact.at));
}

/** 서버로 보낼 기억 요약 */
export function memoryForRequest(m: NpcMemoryRecord): ChatRequest['memory'] {
  return { facts: m.facts.slice(-LIMITS.facts), topics: m.topics.slice(0, 8), conversations: m.conversations };
}

/**
 * 아랍어 문장 속에 들어 있는 학습 항목 찾기 (부호가 없어도 비교 가능).
 * 단어는 낱말 단위(정관사 الـ / 접속사 وَ 가 붙은 형태 포함), 문장은 문장 전체가 들어 있을 때만 인정한다.
 */
export function findContentItems(text: string): string[] {
  const norm = ` ${looseNormalize(text)} `;
  const tokens = new Set(norm.trim().split(' '));
  const hits: string[] = [];
  for (const item of ALL_ITEMS) {
    const key = looseNormalize(item.ar);
    if (!key || key.includes('\u2026')) continue;
    if (item.kind === 'sentence') {
      if (key.length >= 6 && norm.includes(` ${key} `)) hits.push(item.id);
    } else {
      // 탄윈 알리프·탄윈이 빠진 형태도 같은 단어로 본다 (예: شكرا)
      const bare = key.replace(/ا$/, '');
      const forms = [key, bare].filter((k) => k.length >= 2);
      if ([...tokens].some((t) => forms.some((f) => t === f || t === `ال${f}` || t === `و${f}` || t === `وال${f}` || t === `ب${f}`))) {
        hits.push(item.id);
      }
    }
  }
  return hits;
}
