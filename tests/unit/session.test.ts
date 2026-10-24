import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { practiceReply } from '../../src/shared/practiceNpc';
import type { ChatRequest } from '../../src/shared/conversation';

/** fetch를 바꿔 끼워 서버 응답을 흉내 낸다 (모의) */
type Handler = (url: string, init?: RequestInit) => Promise<Response>;
let handler: Handler;
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
const health = (provider: 'anthropic' | 'practice') => json({ ok: true, chat: { provider, model: provider === 'anthropic' ? 'claude-opus-5-5' : undefined }, tts: { providers: [] }, stt: null });

async function freshSession() {
  vi.resetModules();
  const { ConversationSession } = await import('../../src/conversation/session');
  const state = await import('../../src/game/state');
  return { session: new ConversationSession('layla', () => Date.UTC(2026, 9, 24, 3)), state };
}

const aiReply = (req: ChatRequest) => ({ ...practiceReply(req), source: 'ai', provider: 'anthropic', model: 'claude-opus-5-5' });

beforeEach(() => {
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => handler(String(url), init));
});
afterEach(() => vi.unstubAllGlobals());

describe('대화 세션', () => {
  it('실제 AI 서버면 ai 모드로 열고, 응답을 게임 상태(기억·들은 표현)에 반영한다', async () => {
    handler = async (url, init) => (url.endsWith('/api/health') ? health('anthropic') : json(aiReply(JSON.parse(String(init!.body)))));
    const { session, state } = await freshSession();
    await session.open();
    expect(session.state.mode).toBe('ai');
    expect(session.state.entries.some((e) => e.kind === 'npc')).toBe(true);
    await session.send('اسمي سارة');
    const mem = state.getNpcRecord('layla');
    expect(mem.facts.map((f) => f.value)).toEqual(['سارة']);
    expect(mem.recent.filter((t) => t.role === 'player').map((t) => t.text)).toEqual(['اسمي سارة']);
    expect(mem.friendship).toBeGreaterThanOrEqual(2);
  });

  it('응답을 기다리는 중에는 다시 보내지 않는다 (중복 전송 방지)', async () => {
    let chatCalls = 0;
    let release!: () => void;
    handler = async (url, init) => {
      if (url.endsWith('/api/health')) return health('anthropic');
      chatCalls++;
      if (chatCalls === 2) await new Promise<void>((r) => (release = r));
      return json(aiReply(JSON.parse(String(init!.body))));
    };
    const { session } = await freshSession();
    await session.open();
    const first = session.send('مرحبا');
    await new Promise((r) => setTimeout(r, 10));
    expect(await session.send('مرحبا')).toBe(false);
    release();
    await first;
    expect(chatCalls).toBe(2);
  });

  it('서버 오류는 가짜 응답으로 바꾸지 않고 오류 항목을 남기며, 다시 시도할 수 있다', async () => {
    let fail = true;
    handler = async (url, init) => {
      if (url.endsWith('/api/health')) return health('anthropic');
      if (fail) return json({ error: { code: 'not_configured', message: 'ANTHROPIC_API_KEY' } }, 503);
      return json(aiReply(JSON.parse(String(init!.body))));
    };
    const { session } = await freshSession();
    await session.open();
    const err = session.state.entries.find((e) => e.kind === 'error');
    expect(err).toMatchObject({ kind: 'error', failure: 'not_configured' });
    expect(session.state.entries.some((e) => e.kind === 'npc')).toBe(false);
    fail = false;
    await session.retry();
    expect(session.state.entries.some((e) => e.kind === 'error')).toBe(false);
    expect(session.state.entries.some((e) => e.kind === 'npc')).toBe(true);
  });

  it('사용자가 고르면 연습 모드(모의)로 바꿔 계속한다', async () => {
    handler = async (url) => (url.endsWith('/api/health') ? health('anthropic') : json({ error: { code: 'rate_limited', message: '' } }, 429));
    const { session } = await freshSession();
    await session.open();
    await session.switchToPractice();
    expect(session.state.mode).toBe('practice');
    const npc = session.state.entries.find((e) => e.kind === 'npc');
    expect(npc && npc.kind === 'npc' && npc.reply.source).toBe('practice');
  });

  it('서버에 닿지 못하면 오프라인 연습 모드로 바꾸고 그 사실을 알린다', async () => {
    let healthy = true;
    handler = async (url, init) => {
      if (url.endsWith('/api/health')) return health('practice');
      if (!healthy) throw new TypeError('Failed to fetch');
      return json(practiceReply(JSON.parse(String(init!.body))));
    };
    const { session } = await freshSession();
    await session.open();
    expect(session.state.mode).toBe('practice');
    healthy = false;
    await session.send('مرحبا');
    expect(session.state.mode).toBe('offline');
    expect(session.state.entries.some((e) => e.kind === 'notice' && e.text.includes('오프라인'))).toBe(true);
  });

  it('대화창을 닫으면 진행 중 요청을 취소하고 응답을 반영하지 않는다', async () => {
    handler = async (url, init) => {
      if (url.endsWith('/api/health')) return health('anthropic');
      await new Promise((r) => setTimeout(r, 50));
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return json(aiReply(JSON.parse(String(init!.body))));
    };
    const { session, state } = await freshSession();
    const opening = session.open();
    await new Promise((r) => setTimeout(r, 10));
    session.close();
    await opening;
    expect(session.state.entries.some((e) => e.kind === 'npc')).toBe(false);
    expect(state.getNpcRecord('layla').recent).toEqual([]);
  });

  it('AI 응답 속 학습 표현은 "들음"으로만 기록하고 학습 완료로 처리하지 않는다', async () => {
    handler = async (url, init) => (url.endsWith('/api/health') ? health('anthropic') : json(aiReply(JSON.parse(String(init!.body)))));
    const { session } = await freshSession();
    const { learning } = await import('../../src/learning');
    await session.open();
    await session.send('مرحبا'); // 응답: أَهْلًا! كَيْفَ حَالُكَ؟ (성별을 고르기 전에는 남성형)
    expect(learning().heardCount('s.kayfa_haluka')).toBeGreaterThan(0);
    expect(learning().isStudied('s.kayfa_haluka')).toBe(false);
    expect(learning().heardNotStudied().map((i) => i.id)).toContain('s.kayfa_haluka');
  });
});
