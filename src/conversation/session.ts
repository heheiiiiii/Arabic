import { getLearnerProfile, learning } from '../learning';
import { getExamStage, getNpcRecord, getPlayerGender, persist } from '../game/state';
import type { ChatRequest, LearnerSummary, MemoryFact, NpcReply } from '../shared/conversation';
import { LIMITS } from '../shared/conversation';
import { practiceReply } from '../shared/practiceNpc';
import { CHAT_FAILURE_LABEL, getHealth, sendChat, type ChatFailure } from './client';
import { acceptMemoryCandidates, addTopic, findContentItems, memoryForRequest, recordTurn, rewardPlayerMessage, startConversation } from './memory';

/**
 * 한 주민과의 대화 진행 (UI와 분리된 상태 관리).
 * - 요청은 한 번에 하나만 (중복 전송 방지), 창을 닫으면 진행 중 요청을 취소한다.
 * - 친밀도·기억·학습 기록은 여기(게임 로직)에서만 바꾼다. AI 응답은 제안으로만 쓴다.
 */

export type ConversationMode = 'ai' | 'practice' | 'offline';

export type Entry =
  | { kind: 'npc'; reply: NpcReply; heardIds: string[]; fresh: boolean }
  | { kind: 'player'; text: string; viaVoice: boolean }
  | { kind: 'notice'; text: string; tone: 'info' | 'good' }
  | { kind: 'memory'; facts: MemoryFact[] }
  | { kind: 'error'; failure: ChatFailure; message: string; canPractice: boolean };

export interface SessionState {
  mode: ConversationMode | null;
  modeDetail: string;
  entries: Entry[];
  pending: boolean;
  /** 마지막 NPC 응답의 힌트 */
  hint: NpcReply['hint'] | null;
}

export function learnerSummary(): LearnerSummary {
  const p = getLearnerProfile();
  return {
    examStage: getExamStage(),
    unitTitleKo: p.currentUnit.titleKo,
    comfortable: p.comfortable.map((e) => e.ar).slice(0, 30),
    needsReview: p.needsReview.map((e) => e.ar).slice(0, 15),
    seenOnly: p.encountered.filter((e) => e.familiarity === 'seen').map((e) => e.ar).slice(0, 15),
    studiedCount: p.encountered.length,
  };
}

export class ConversationSession {
  readonly state: SessionState = { mode: null, modeDetail: '', entries: [], pending: false, hint: null };
  private controller: AbortController | null = null;
  private listeners = new Set<() => void>();
  /** 사용자가 AI 실패 후 "연습 모드로 계속"을 고른 경우 */
  private forcePractice = false;
  private lastRequest: { text: string | null; viaVoice: boolean } | null = null;

  constructor(
    readonly npcId: string,
    private readonly now: () => number = Date.now,
  ) {}

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private memory() {
    return getNpcRecord(this.npcId);
  }

  /** 대화창을 열 때: 모드를 정하고 첫 인사를 받는다 */
  async open(): Promise<void> {
    const h = await getHealth();
    if (!h.online) {
      this.state.mode = 'offline';
      this.state.modeDetail = '서버에 연결할 수 없어 브라우저 안의 연습 상대(모의)와 대화해요.';
    } else if (h.chat?.provider === 'anthropic') {
      this.state.mode = 'ai';
      this.state.modeDetail = `실제 AI (${h.chat.model ?? 'Claude'})`;
    } else if (h.access === 'required') {
      this.state.mode = 'practice';
      this.state.modeDetail = '초대 코드를 입력하지 않아 연습 상대(모의)와 대화해요. 대화 설정에서 초대 코드를 넣으면 실제 AI와 대화할 수 있어요.';
    } else {
      this.state.mode = 'practice';
      this.state.modeDetail = 'AI 키가 설정되지 않아 연습 상대(모의)와 대화해요. 정해진 표현만 알아들어요.';
    }
    const gain = startConversation(this.memory(), this.now());
    persist();
    if (gain > 0) this.notice(`💛 라일라와의 친밀도 +${gain} (오늘 첫 대화)`, 'good');
    await this.request(null, false);
  }

  /** 플레이어 발화 전송. 요청 중이면 무시한다 (중복 전송 방지). */
  async send(text: string, viaVoice = false): Promise<boolean> {
    const t = text.replace(/\s+/g, ' ').trim().slice(0, LIMITS.playerText);
    if (!t || this.state.pending) return false;
    this.state.entries.push({ kind: 'player', text: t, viaVoice });
    this.emit();
    await this.request(t, viaVoice);
    return true;
  }

  /** 실패한 요청 다시 시도 */
  async retry(): Promise<void> {
    if (!this.lastRequest || this.state.pending) return;
    this.state.entries = this.state.entries.filter((e) => e.kind !== 'error');
    await this.request(this.lastRequest.text, this.lastRequest.viaVoice);
  }

  /** AI가 실패했을 때 연습 상대로 전환 (명시적으로 사용자가 고른 경우에만) */
  async switchToPractice(): Promise<void> {
    this.forcePractice = true;
    this.state.mode = this.state.mode === 'offline' ? 'offline' : 'practice';
    this.state.modeDetail = '연습 상대(모의)와 대화 중이에요. 실제 AI가 아니에요.';
    await this.retry();
  }

  close(): void {
    this.controller?.abort();
    this.controller = null;
    this.state.pending = false;
  }

  private notice(text: string, tone: 'info' | 'good' = 'info') {
    this.state.entries.push({ kind: 'notice', text, tone });
    this.emit();
  }

  private buildRequest(playerText: string | null): ChatRequest {
    const m = this.memory();
    // 이번 플레이어 발화는 playerText로 따로 보내므로 history에서는 뺀다
    return {
      npcId: this.npcId,
      playerText,
      history: m.recent.slice(-LIMITS.historyTurns),
      memory: memoryForRequest(m),
      learner: learnerSummary(),
      addressGender: getPlayerGender(),
    };
  }

  private async request(playerText: string | null, viaVoice: boolean): Promise<void> {
    this.lastRequest = { text: playerText, viaVoice };
    this.controller?.abort();
    const ctrl = new AbortController();
    this.controller = ctrl;
    this.state.pending = true;
    this.emit();

    const req = this.buildRequest(playerText);
    let reply: NpcReply | null = null;
    if (this.state.mode === 'offline' || this.forcePractice) {
      await new Promise((r) => setTimeout(r, 250)); // 너무 즉각적이지 않게
      reply = practiceReply(req);
    } else {
      const r = await sendChat(req, ctrl.signal);
      if (ctrl.signal.aborted || this.controller !== ctrl) return; // 창을 닫았거나 새 요청이 들어옴
      if (r.ok) reply = r.reply;
      else if (r.failure === 'network') {
        // 서버에 닿지 못하면 오프라인 연습 모드로 바꾸되, 그 사실을 분명히 알린다
        this.state.mode = 'offline';
        this.state.modeDetail = '서버에 연결할 수 없어 브라우저 안의 연습 상대(모의)와 대화해요.';
        this.notice('📴 서버에 연결하지 못해 오프라인 연습 모드(모의)로 바꿨어요.');
        reply = practiceReply(req);
      } else if (r.failure !== 'cancelled') {
        this.state.pending = false;
        this.state.entries.push({ kind: 'error', failure: r.failure, message: `${CHAT_FAILURE_LABEL[r.failure]}${r.message ? ` — ${r.message}` : ''}`, canPractice: true });
        this.emit();
        return;
      }
    }
    if (!reply) return;
    this.state.pending = false;
    this.controller = null;
    this.applyReply(playerText, viaVoice, reply);
  }

  /** 응답을 게임 상태에 반영 (검증된 규칙으로만) */
  private applyReply(playerText: string | null, _viaVoice: boolean, reply: NpcReply): void {
    const m = this.memory();
    const now = this.now();
    if (playerText !== null) {
      recordTurn(m, { role: 'player', text: playerText });
      const gain = rewardPlayerMessage(m, playerText, now);
      if (gain > 0) this.notice(`💛 친밀도 +${gain} (아랍어로 말했어요)`, 'good');
      const facts = acceptMemoryCandidates(m, reply.memoryCandidates, playerText, now);
      if (facts.length) this.state.entries.push({ kind: 'memory', facts });
    }
    recordTurn(m, { role: 'npc', text: reply.reply.ar });
    if (reply.topic) addTopic(m, reply.topic);
    // 대화에서 들은 학습 표현 기록 (학습 완료로 처리하지 않는다)
    const heardIds = findContentItems(reply.reply.ar);
    const fresh = learning().recordHeard(heardIds);
    persist();
    this.state.hint = reply.hint;
    this.state.entries.push({ kind: 'npc', reply, heardIds, fresh: fresh.length > 0 });
    // 기록이 너무 길어지지 않게 화면 항목도 제한한다
    if (this.state.entries.length > 80) this.state.entries.splice(0, this.state.entries.length - 80);
    this.emit();
  }
}
