/**
 * NPC 회화 API의 요청·응답 형식 (서버와 브라우저가 함께 사용).
 *
 * 원칙: AI 응답은 "제안"일 뿐이다. 친밀도·퀘스트·보상·학습 기록 같은 게임 상태는
 * 이 응답을 받은 클라이언트의 게임 로직이 검증한 뒤에만 바꾼다.
 */

export const LIMITS = {
  /** 플레이어 한 번 발화 최대 길이 (문자) */
  playerText: 300,
  /** 서버로 보내는 최근 대화 턴 수 */
  historyTurns: 12,
  /** 기억 사실 최대 개수 */
  facts: 20,
  /** 요청 본문 최대 크기 (바이트) */
  chatBody: 24_000,
  /** TTS 한 번에 읽을 최대 길이 */
  ttsText: 400,
  /** STT 업로드 최대 크기 (바이트) */
  sttBytes: 2_000_000,
  /** 녹음 최대 길이 (초) */
  recordSeconds: 15,
} as const;

/** 플레이어의 성별. 주민이 플레이어를 부를 때(أَنْتَ/أَنْتِ)와 플레이어가 자기를 말할 때(طَالِبٌ/طَالِبَةٌ) 쓴다. */
export type Gender = 'm' | 'f';
export const isGender = (v: unknown): v is Gender => v === 'm' || v === 'f';

export interface ChatTurn {
  role: 'player' | 'npc';
  /** 아랍어(또는 플레이어가 입력한 그대로의) 문장 */
  text: string;
}

export type MemoryKind = 'name' | 'origin' | 'likes' | 'dislikes' | 'interest' | 'promise' | 'fact';
export const MEMORY_KINDS: readonly MemoryKind[] = ['name', 'origin', 'likes', 'dislikes', 'interest', 'promise', 'fact'];

export interface MemoryFact {
  kind: MemoryKind;
  /** 짧은 요약 (한국어 또는 아랍어) */
  value: string;
  /** 플레이어가 실제로 한 말에서 인용한 근거 */
  evidence: string;
  at: number;
}

/** AI에 전달하는 학습자 요약 (learning/profile.ts의 LearnerProfile에서 만든다) */
export interface LearnerSummary {
  level: number;
  unitTitleKo: string;
  /** 맞힌 적 있는 표현 (학습용 표기) */
  comfortable: string[];
  /** 복습이 필요한 표현 */
  needsReview: string[];
  /** 본 적만 있는 표현 */
  seenOnly: string[];
  /** 지금까지 배운 항목 수 */
  studiedCount: number;
}

export interface ChatRequest {
  npcId: string;
  /** null이면 대화를 여는 첫 인사를 요청한다 */
  playerText: string | null;
  history: ChatTurn[];
  /** conversations: 지금 연 대화를 포함한 누적 대화 횟수 */
  memory: { facts: MemoryFact[]; topics: string[]; conversations: number };
  learner: LearnerSummary;
  /** 플레이어의 성별 (주민이 이 성별로 플레이어를 부른다) */
  addressGender: Gender;
}

export interface ArabicLine {
  /** 학습용 표기 (모음 부호 포함) */
  ar: string;
  ko: string;
  /** 로마자 발음 (선택) */
  translit?: string;
}

export interface NpcReply {
  /** 'ai' = 실제 AI 공급자, 'practice' = 규칙 기반 연습 상대(모의) */
  source: 'ai' | 'practice';
  provider: string;
  model?: string;
  reply: ArabicLine;
  /** 플레이어의 말을 이해했는지 (못 했으면 reply가 되묻는 말) */
  understood: boolean;
  correction: { playerSaid: string; better: ArabicLine; explanationKo: string } | null;
  hint: {
    words: ArabicLine[];
    contextKo: string;
    model: ArabicLine;
    alternatives: string[];
  };
  memoryCandidates: { kind: MemoryKind; value: string; evidence: string }[];
  /** 지금 이야기한 주제 (짧은 한국어) */
  topic: string;
  /** 서버 자동 검사에서 모음 부호가 의심되는 문장 (있으면 UI에 경고) */
  diacriticsWarning?: string[];
}

export type ChatErrorCode = 'bad_request' | 'rate_limited' | 'not_configured' | 'provider_error' | 'invalid_response' | 'timeout' | 'network';

export interface ApiError {
  error: { code: ChatErrorCode | string; message: string };
}

// ── 검증 ─────────────────────────────────────────────

const isStr = (v: unknown, max = 600): v is string => typeof v === 'string' && v.length <= max;

function line(v: unknown, requireAr = true): ArabicLine | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.ar) || !isStr(o.ko)) return null;
  if (requireAr && o.ar.trim() === '') return null;
  const out: ArabicLine = { ar: o.ar.trim(), ko: o.ko.trim() };
  if (isStr(o.translit) && o.translit.trim()) out.translit = o.translit.trim();
  return out;
}

/**
 * 알 수 없는 JSON을 NpcReply 본문으로 검증한다. 필수 필드가 없거나 형식이 틀리면 null.
 * (source/provider/model은 호출한 쪽이 채운다)
 */
export function parseReplyBody(raw: unknown): Omit<NpcReply, 'source' | 'provider' | 'model'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const reply = line(o.reply);
  if (!reply) return null;
  const h = (o.hint ?? {}) as Record<string, unknown>;
  const model = line(h.model);
  if (!model) return null;
  const words = Array.isArray(h.words) ? h.words.map((w) => line(w)).filter((w): w is ArabicLine => !!w).slice(0, 6) : [];
  const alternatives = Array.isArray(h.alternatives) ? h.alternatives.filter((a): a is string => isStr(a, 200)).slice(0, 4) : [];

  let correction: NpcReply['correction'] = null;
  if (o.correction && typeof o.correction === 'object') {
    const c = o.correction as Record<string, unknown>;
    const better = line(c.better);
    if (better && isStr(c.playerSaid) && isStr(c.explanationKo)) correction = { playerSaid: c.playerSaid, better, explanationKo: c.explanationKo };
  }

  const memoryCandidates = Array.isArray(o.memoryCandidates)
    ? o.memoryCandidates
        .map((m) => m as Record<string, unknown>)
        .filter((m) => m && MEMORY_KINDS.includes(m.kind as MemoryKind) && isStr(m.value, 80) && isStr(m.evidence, 300) && m.value.trim() && m.evidence.trim())
        .map((m) => ({ kind: m.kind as MemoryKind, value: (m.value as string).trim(), evidence: (m.evidence as string).trim() }))
        .slice(0, 4)
    : [];

  return {
    reply,
    understood: o.understood !== false,
    correction,
    hint: { words, contextKo: isStr(h.contextKo) ? h.contextKo : '', model, alternatives },
    memoryCandidates,
    topic: isStr(o.topic, 60) ? o.topic : '',
  };
}

/** 클라이언트가 서버 응답 전체를 검증할 때 사용 */
export function parseNpcReply(raw: unknown): NpcReply | null {
  const body = parseReplyBody(raw);
  if (!body) return null;
  const o = raw as Record<string, unknown>;
  if (o.source !== 'ai' && o.source !== 'practice') return null;
  const warn = Array.isArray(o.diacriticsWarning) ? o.diacriticsWarning.filter((w): w is string => typeof w === 'string').slice(0, 5) : undefined;
  return {
    ...body,
    source: o.source,
    provider: isStr(o.provider, 60) ? o.provider : 'unknown',
    ...(isStr(o.model, 80) ? { model: o.model } : {}),
    ...(warn && warn.length ? { diacriticsWarning: warn } : {}),
  };
}

/** 요청 검증 (서버). 잘못되면 오류 메시지 문자열 */
export function validateChatRequest(raw: unknown): ChatRequest | string {
  if (!raw || typeof raw !== 'object') return '요청 형식이 올바르지 않습니다';
  const o = raw as Record<string, unknown>;
  if (!isStr(o.npcId, 40) || !/^[a-z0-9_-]+$/.test(o.npcId)) return 'npcId가 올바르지 않습니다';
  if (!('playerText' in o)) return 'playerText가 필요합니다 (대화 시작은 null)';
  if (o.playerText !== null && !isStr(o.playerText, LIMITS.playerText)) return `플레이어 문장은 ${LIMITS.playerText}자 이하여야 합니다`;
  if (typeof o.playerText === 'string' && o.playerText.trim() === '') return '빈 문장은 보낼 수 없습니다';
  if (!Array.isArray(o.history) || o.history.length > LIMITS.historyTurns * 2) return 'history가 올바르지 않습니다';
  const history: ChatTurn[] = [];
  for (const t of o.history) {
    const tt = t as Record<string, unknown>;
    if (!tt || (tt.role !== 'player' && tt.role !== 'npc') || !isStr(tt.text, 600)) return 'history 항목이 올바르지 않습니다';
    history.push({ role: tt.role, text: tt.text });
  }
  const mem = (o.memory ?? {}) as Record<string, unknown>;
  const facts = Array.isArray(mem.facts)
    ? (mem.facts as Record<string, unknown>[])
        .filter((f) => f && MEMORY_KINDS.includes(f.kind as MemoryKind) && isStr(f.value, 80))
        .slice(0, LIMITS.facts)
        .map((f) => ({ kind: f.kind as MemoryKind, value: f.value as string, evidence: isStr(f.evidence, 300) ? f.evidence : '', at: typeof f.at === 'number' ? f.at : 0 }))
    : [];
  const topics = Array.isArray(mem.topics) ? (mem.topics as unknown[]).filter((t): t is string => isStr(t, 60)).slice(0, 12) : [];
  const l = (o.learner ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => isStr(x, 200)).slice(0, 40) : []);
  if (!isGender(o.addressGender)) return 'addressGender는 m 또는 f여야 합니다';
  const learner: LearnerSummary = {
    level: typeof l.level === 'number' ? Math.min(3, Math.max(1, Math.round(l.level))) : 1,
    unitTitleKo: isStr(l.unitTitleKo, 40) ? l.unitTitleKo : '',
    comfortable: arr(l.comfortable),
    needsReview: arr(l.needsReview),
    seenOnly: arr(l.seenOnly),
    studiedCount: typeof l.studiedCount === 'number' ? Math.max(0, Math.round(l.studiedCount)) : 0,
  };
  return {
    npcId: o.npcId,
    playerText: typeof o.playerText === 'string' ? o.playerText.trim() : null,
    history,
    memory: { facts, topics, conversations: typeof mem.conversations === 'number' ? mem.conversations : 0 },
    learner,
    addressGender: o.addressGender,
  };
}
