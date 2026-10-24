import { createServer, type IncomingMessage, type Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { execSync } from 'node:child_process';

/** 테스트용 로컬 HTTP 서버 (외부 API를 흉내 내는 "모의 서버") */
async function mockServer(handler: (req: IncomingMessage, body: Buffer) => { status: number; body: unknown; headers?: Record<string, string>; delayMs?: number }) {
  const seen: { url: string; headers: IncomingMessage['headers']; body: Buffer }[] = [];
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      seen.push({ url: req.url ?? '', headers: req.headers, body });
      const r = handler(req, body);
      setTimeout(() => {
        res.writeHead(r.status, { 'content-type': 'application/json', ...(r.headers ?? {}) });
        res.end(typeof r.body === 'string' ? r.body : JSON.stringify(r.body));
      }, r.delayMs ?? 0);
    });
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, seen, close: () => new Promise<void>((ok) => server.close(() => ok())) };
}

const ENV_KEYS = ['ANTHROPIC_API_KEY', 'VILLAGE_ANTHROPIC_BASE_URL', 'AI_TIMEOUT_MS', 'AI_DAILY_LIMIT', 'STT_API_KEY', 'STT_BASE_URL', 'STT_DAILY_LIMIT', 'OPENAI_API_KEY', 'AZURE_SPEECH_KEY', 'TTS_PROVIDERS', 'TTS_CACHE_DIR', 'ACCESS_CODE', 'CHAT_PER_MINUTE'];

async function loadApp(env: Record<string, string> = {}) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, { TTS_CACHE_DIR: '.cache/test-tts', ...env });
  vi.resetModules();
  const app = await import('../../server/app');
  const rl = await import('../../server/rateLimit');
  rl.resetRateLimits();
  return app;
}

const chatBody = (playerText: string | null) => ({
  npcId: 'layla',
  playerText,
  history: [],
  memory: { facts: [], topics: [], conversations: 0 },
  learner: { level: 1, unitTitleKo: '인사', comfortable: ['مَرْحَبًا'], needsReview: [], seenOnly: [], studiedCount: 1 },
  addressGender: 'm',
});
const post = (path: string, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new Request(`http://localhost${path}`, { method: 'POST', headers, body: typeof body === 'string' || body instanceof Uint8Array ? (body as BodyInit) : JSON.stringify(body) });

const hasEspeak = (() => {
  try {
    execSync('espeak-ng --version && ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('API 서버 (키 없음 → 연습 모드)', () => {
  it('health: 실제 AI가 아니라 practice로 보고한다', async () => {
    const { handleApi } = await loadApp();
    const res = await handleApi(new Request('http://localhost/api/health'), '1.1.1.1');
    const d = await res.json();
    expect(d.chat.provider).toBe('practice');
    expect(d.stt).toBeNull();
    expect(JSON.stringify(d)).not.toMatch(/key/i);
  });

  it('chat: 연습 상대 응답에 source=practice가 붙는다', async () => {
    const { handleApi } = await loadApp();
    const res = await handleApi(post('/api/chat', chatBody('مرحبا')), '1.1.1.1');
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe('practice');
  });

  it('잘못된 요청·너무 큰 요청·사용량 초과를 구분한다', async () => {
    const { handleApi } = await loadApp();
    expect((await handleApi(post('/api/chat', '{not json'), '2.2.2.2')).status).toBe(400);
    expect((await handleApi(post('/api/chat', { npcId: 'nobody', playerText: null, history: [] }), '2.2.2.2')).status).toBe(400);
    expect((await handleApi(post('/api/chat', 'x'.repeat(30_000)), '2.2.2.2')).status).toBe(413);
    let last = 0;
    for (let i = 0; i < 65; i++) last = (await handleApi(post('/api/chat', chatBody('مرحبا')), '3.3.3.3')).status;
    expect(last).toBe(429);
  });

  it('분당 상한은 기본 60회이고 환경 변수로 바꿀 수 있다 (프록시 뒤에서 여러 사용자가 한 IP를 나눠 씀)', async () => {
    const { handleApi } = await loadApp();
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) statuses.push((await handleApi(post('/api/chat', chatBody('مرحبا')), '3.3.3.4')).status);
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses[60]).toBe(429);

    const small = await loadApp({ CHAT_PER_MINUTE: '3' });
    const r: number[] = [];
    for (let i = 0; i < 4; i++) r.push((await small.handleApi(post('/api/chat', chatBody('مرحبا')), '3.3.3.5')).status);
    expect(r).toEqual([200, 200, 200, 429]);
  });

  it('stt: 설정이 없으면 503 not_configured', async () => {
    const { handleApi } = await loadApp();
    const res = await handleApi(post('/api/stt', new Uint8Array(4000), { 'content-type': 'audio/webm' }), '1.1.1.1');
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('not_configured');
  });

  it('tts: 아랍어가 아닌 문장은 거부한다', async () => {
    const { handleApi } = await loadApp();
    const res = await handleApi(new Request('http://localhost/api/tts?text=hello'), '1.1.1.1');
    expect(res.status).toBe(400);
  });

  it.skipIf(!hasEspeak)('tts: espeak-ng로 실제 아랍어 MP3를 만들고 캐시한다 (실제 음성 생성)', async () => {
    const { handleApi } = await loadApp({ TTS_PROVIDERS: 'espeak' });
    const url = `http://localhost/api/tts?text=${encodeURIComponent('أَهْلًا وَسَهْلًا فِي قَرْيَتِنَا!')}`;
    const r1 = await handleApi(new Request(url), '9.9.9.9');
    expect(r1.status).toBe(200);
    expect(r1.headers.get('content-type')).toBe('audio/mpeg');
    const bytes = new Uint8Array(await r1.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(5000);
    // MP3 프레임 동기 비트 또는 ID3 헤더
    expect((bytes[0] === 0x49 && bytes[1] === 0x44) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)).toBe(true);
    const r2 = await handleApi(new Request(url), '9.9.9.9');
    expect(r2.headers.get('x-tts-cache')).toBe('hit');
  }, 30_000);
});

describe('음성 인식 어댑터 (모의 OpenAI 호환 서버)', () => {
  let mock: Awaited<ReturnType<typeof mockServer>>;
  beforeAll(async () => {
    mock = await mockServer((req) => (req.headers.authorization === 'Bearer test-stt' ? { status: 200, body: { text: ' مرحبا ' } } : { status: 401, body: {} }));
  });
  afterAll(() => mock.close());

  it('언어를 ar로 지정해 multipart로 보내고, 인식 결과를 돌려준다', async () => {
    const { handleApi } = await loadApp({ STT_API_KEY: 'test-stt', STT_BASE_URL: mock.url });
    const res = await handleApi(post('/api/stt', new Uint8Array(5000).fill(1), { 'content-type': 'audio/webm;codecs=opus' }), '1.1.1.1');
    expect(res.status).toBe(200);
    expect((await res.json()).text).toBe('مرحبا');
    const sent = mock.seen.at(-1)!;
    expect(sent.url).toBe('/audio/transcriptions');
    const body = sent.body.toString('latin1');
    expect(body).toContain('name="language"\r\n\r\nar');
    expect(body).toContain('filename="speech.webm"');
  });

  it('너무 짧은 녹음·허용하지 않는 형식·잘못된 키를 구분한다', async () => {
    const { handleApi } = await loadApp({ STT_API_KEY: 'wrong', STT_BASE_URL: mock.url });
    expect((await handleApi(post('/api/stt', new Uint8Array(100), { 'content-type': 'audio/webm' }), '1.1.1.1')).status).toBe(400);
    expect((await handleApi(post('/api/stt', new Uint8Array(5000), { 'content-type': 'text/plain' }), '1.1.1.1')).status).toBe(400);
    expect((await handleApi(post('/api/stt', new Uint8Array(5000), { 'content-type': 'audio/webm' }), '1.1.1.1')).status).toBe(503);
  });
});

describe('Anthropic 공급자 (모의 Messages API 서버 — 실제 Claude 호출 아님)', () => {
  let mock: Awaited<ReturnType<typeof mockServer>>;
  let mode: 'ok' | 'bad-harakat' | '401' | '429' | 'slow' | 'not-json' = 'ok';
  const replyJson = (ar: string) => ({
    reply: { ar, ko: '안녕! 나는 라일라야.', translit: 'marḥaban' },
    understood: true,
    correction: null,
    hint: { words: [{ ar: 'مَرْحَبًا', ko: '안녕', translit: 'marḥaban' }], contextKo: '인사해 보세요', model: { ar: 'مَرْحَبًا!', ko: '안녕하세요!', translit: 'marḥaban!' }, alternatives: [] },
    memoryCandidates: [],
    topic: '인사',
  });
  const message = (obj: unknown) => ({
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'text', text: JSON.stringify(obj) }],
  });

  beforeAll(async () => {
    mock = await mockServer((_req, body) => {
      const req = JSON.parse(body.toString());
      if (mode === '401') return { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'bad key' } } };
      if (mode === '429') return { status: 429, body: { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, headers: { 'retry-after': '0' } };
      if (mode === 'slow') return { status: 200, body: message(replyJson('مَرْحَبًا!')), delayMs: 1500 };
      if (mode === 'not-json') return { status: 200, body: { ...message({}), content: [{ type: 'text', text: 'not json' }] } };
      if (req.output_config?.format?.schema?.properties?.lines) {
        // 하라카트 교정 요청
        const lines = JSON.parse(req.messages[0].content) as string[];
        return { status: 200, body: message({ lines: lines.map((l) => (l === 'مرحبا! انا ليلى.' ? 'مَرْحَبًا! أَنَا لَيْلَى.' : l)) }) };
      }
      return { status: 200, body: message(replyJson(mode === 'bad-harakat' ? 'مرحبا! انا ليلى.' : 'مَرْحَبًا! أَنَا لَيْلَى.')) };
    });
  });
  afterAll(() => mock.close());
  beforeEach(() => {
    mode = 'ok';
  });

  const app = () => loadApp({ ANTHROPIC_API_KEY: 'sk-test', VILLAGE_ANTHROPIC_BASE_URL: mock.url, AI_TIMEOUT_MS: '600' });

  it('구조화된 출력·대체 모델·키를 담아 요청하고, 검증된 응답을 source=ai로 돌려준다', async () => {
    const { handleApi } = await app();
    const res = await handleApi(post('/api/chat', chatBody(null)), '5.5.5.5');
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d).toMatchObject({ source: 'ai', provider: 'anthropic', reply: { ar: 'مَرْحَبًا! أَنَا لَيْلَى.' } });
    const sent = mock.seen.at(-1)!;
    const body = JSON.parse(sent.body.toString());
    // SDK 버전에 따라 x-api-key 또는 Authorization: Bearer 로 보낸다
    expect(sent.headers['x-api-key'] === 'sk-test' || sent.headers.authorization === 'Bearer sk-test').toBe(true);
    expect(String(sent.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01');
    expect(body).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', output_config: { effort: 'low', format: { type: 'json_schema' } } });
    expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(body.system[1].text).toContain('مَرْحَبًا'); // 학습자 프로필이 전달됨
    expect(body.messages[0].role).toBe('user');
  });

  it('모음 부호가 빠진 AI 문장은 교정 단계를 거쳐 고쳐진다 (글자는 그대로)', async () => {
    mode = 'bad-harakat';
    const { handleApi } = await app();
    const d = await (await handleApi(post('/api/chat', chatBody('مرحبا')), '5.5.5.6')).json();
    expect(d.reply.ar).toBe('مَرْحَبًا! أَنَا لَيْلَى.');
    expect(d.diacriticsWarning).toBeUndefined();
  });

  it('키 오류·사용량 제한·시간 초과·잘못된 응답을 서로 다른 오류로 돌려준다 (가짜 응답으로 바꾸지 않음)', async () => {
    const { handleApi } = await app();
    const cases: [typeof mode, number, string][] = [
      ['401', 503, 'not_configured'],
      ['429', 429, 'rate_limited'],
      ['slow', 504, 'timeout'],
      ['not-json', 502, 'invalid_response'],
    ];
    for (const [m, status, code] of cases) {
      mode = m;
      const res = await handleApi(post('/api/chat', chatBody('مرحبا')), `6.6.6.${status}`);
      expect([m, res.status]).toEqual([m, status]);
      const d = await res.json();
      expect(d.error.code).toBe(code);
      expect(d.source).toBeUndefined();
    }
  }, 20_000);
});

describe('초대 코드 (ACCESS_CODE)', () => {
  const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0];
  const withCookie = (req: Request, cookie: string) => {
    const h = new Headers(req.headers);
    h.set('cookie', cookie);
    return new Request(req, { headers: h });
  };

  it('코드가 없으면 키가 있어도 연습 모드로 보고하고 연습 상대가 답한다 (AI 호출 없음)', async () => {
    const { handleApi } = await loadApp({ ACCESS_CODE: 'salam-2026', ANTHROPIC_API_KEY: 'sk-test', VILLAGE_ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', STT_API_KEY: 'x' });
    const h = await (await handleApi(new Request('http://localhost/api/health'), '1.1.1.1')).json();
    expect(h).toMatchObject({ access: 'required', chat: { provider: 'practice' }, stt: null });
    const res = await handleApi(post('/api/chat', chatBody('مرحبا')), '1.1.1.1');
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe('practice');
    const stt = await handleApi(post('/api/stt', new Uint8Array(5000), { 'content-type': 'audio/webm' }), '1.1.1.1');
    expect(stt.status).toBe(403);
  });

  it('틀린 코드는 거부하고, 맞는 코드는 HttpOnly 쿠키를 준다. 쿠키가 있으면 유료 기능이 열린다', async () => {
    const { handleApi } = await loadApp({ ACCESS_CODE: 'salam-2026', ANTHROPIC_API_KEY: 'sk-test' });
    expect((await handleApi(post('/api/access', { code: 'wrong' }), '1.1.1.2')).status).toBe(403);
    const ok = await handleApi(post('/api/access', { code: 'salam-2026' }), '1.1.1.2');
    expect(ok.status).toBe(200);
    const setCookie = ok.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/Path=\/api/);
    expect(setCookie).not.toContain('salam-2026');
    const h = await (await handleApi(withCookie(new Request('http://localhost/api/health'), cookieOf(ok)), '1.1.1.2')).json();
    expect(h).toMatchObject({ access: 'granted', chat: { provider: 'anthropic' } });
    const forged = await (await handleApi(withCookie(new Request('http://localhost/api/health'), `village_access=${'0'.repeat(64)}`), '1.1.1.2')).json();
    expect(forged.access).toBe('required');
  });

  it('코드 맞히기 시도는 분당 10회로 제한한다', async () => {
    const { handleApi } = await loadApp({ ACCESS_CODE: 'salam-2026' });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await handleApi(post('/api/access', { code: `guess-${i}` }), '1.1.1.3')).status);
    expect(statuses.at(-1)).toBe(429);
  });

  it('코드를 설정하지 않으면 누구나 쓸 수 있다 (open)', async () => {
    const { handleApi } = await loadApp();
    expect((await (await handleApi(new Request('http://localhost/api/health'), '1.1.1.4')).json()).access).toBe('open');
  });
});

describe('하루 상한 (비용 보호)', () => {
  it('서버 음성 인식은 STT_DAILY_LIMIT을 넘으면 429', async () => {
    const mock = await mockServer(() => ({ status: 200, body: { text: 'مرحبا' } }));
    const { handleApi } = await loadApp({ STT_API_KEY: 'k', STT_BASE_URL: mock.url, STT_DAILY_LIMIT: '2' });
    const r: number[] = [];
    for (let i = 0; i < 3; i++) r.push((await handleApi(post('/api/stt', new Uint8Array(5000).fill(1), { 'content-type': 'audio/webm' }), `7.7.7.${i}`)).status);
    expect(r).toEqual([200, 200, 429]);
    await mock.close();
  });

  it('하라카트 교정 호출도 AI 하루 상한에 센다: 상한이 1이면 교정은 건너뛰고 경고만 남긴다', async () => {
    let calls = 0;
    const mock = await mockServer(() => {
      calls++;
      return {
        status: 200,
        body: {
          id: 'msg', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
          content: [{ type: 'text', text: JSON.stringify({ reply: { ar: 'مرحبا! انا ليلى.', ko: '안녕', translit: 'm' }, understood: true, correction: null, hint: { words: [], contextKo: '', model: { ar: 'مَرْحَبًا!', ko: '안녕', translit: 'm' }, alternatives: [] }, memoryCandidates: [], topic: '인사' }) }],
        },
      };
    });
    const { handleApi } = await loadApp({ ANTHROPIC_API_KEY: 'sk-test', VILLAGE_ANTHROPIC_BASE_URL: mock.url, AI_DAILY_LIMIT: '1' });
    const d = await (await handleApi(post('/api/chat', chatBody('مرحبا')), '8.8.8.1')).json();
    expect(d.source).toBe('ai');
    expect(d.diacriticsWarning).toEqual(['مرحبا! انا ليلى.']);
    expect(calls).toBe(1);
    const next = await handleApi(post('/api/chat', chatBody('مرحبا')), '8.8.8.1');
    expect(next.status).toBe(429);
    expect(calls).toBe(1);
    await mock.close();
  });
});
