/**
 * 음성·AI 회화 E2E (Playwright + 실제 Chromium).
 *   node tests/e2e/voice-ai.mjs      (E2E_SHOTS=폴더 로 스크린샷 저장)
 *
 * 검증 범위 (보고서에서 구분):
 * - [실제]  브라우저가 MP3를 받아 실제로 재생(currentTime 증가, ended)하는지 — 미리 만든 파일 / 서버 espeak-ng 음성
 * - [실제]  가짜 마이크(espeak 아랍어 WAV)로 실제 녹음 → 업로드된 파일을 ffprobe로 확인
 * - [모의]  음성→텍스트 변환 자체는 모의 OpenAI 호환 서버가 고정 문장을 돌려준다
 * - [모의]  "AI 모드"는 모의 Anthropic Messages 서버로 UI·오류 처리를 검증한다 (실제 Claude 호출 아님)
 * 필요: espeak-ng, ffmpeg/ffprobe, Playwright Chromium
 */
import { chromium } from 'playwright';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, mkdtempSync, writeFileSync, existsSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.E2E_SHOTS;
const TMP = mkdtempSync(path.join(os.tmpdir(), 'village-e2e-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

// ── 준비: 가짜 마이크 입력용 아랍어 음성 (espeak-ng) ──────────────
const MIC_WAV = path.join(TMP, 'mic.wav');
execFileSync('espeak-ng', ['-v', 'ar', '-s', '120', '-w', MIC_WAV, 'مَرْحَبًا، أَنَا بِخَيْرٍ']);

// ── 모의 서버들 ─────────────────────────────────────
function listen(handler) {
  return new Promise((ok) => {
    const s = createServer((req, res) =>
      Promise.resolve(handler(req, res)).catch((e) => {
        console.error('  [mock error]', e);
        res.writeHead(500);
        res.end();
      }),
    );
    s.on('clientError', (e) => console.error('  [mock clientError]', e.code));
    s.listen(0, '127.0.0.1', () => ok({ server: s, url: `http://127.0.0.1:${s.address().port}` }));
  });
}
const readBody = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });

/** 모의 STT: 받은 녹음을 파일로 남겨 ffprobe로 검사할 수 있게 하고, 고정 문장을 돌려준다 */
const sttLog = [];
let sttFail = false;
const stt = await listen(async (req, res) => {
  const body = await readBody(req);
  const boundary = /boundary=(.+)$/.exec(req.headers['content-type'] ?? '')?.[1];
  const raw = body.toString('latin1');
  const fileStart = raw.indexOf('\r\n\r\n', raw.indexOf('name="file"')) + 4;
  const fileEnd = raw.indexOf(`\r\n--${boundary}`, fileStart);
  const file = path.join(TMP, `upload-${sttLog.length}.bin`);
  writeFileSync(file, body.subarray(fileStart, fileEnd));
  const lang = /name="language"\r\n\r\n(\w+)/.exec(raw)?.[1];
  sttLog.push({ file, lang, filename: /filename="([^"]+)"/.exec(raw)?.[1] });
  if (sttFail) { res.writeHead(500); return res.end('{}'); }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ text: 'مرحبا' }));
});

/** 모의 Anthropic Messages API (실제 Claude 아님) */
const aiLog = [];
const line = (ar, ko, translit = '') => ({ ar, ko, translit });
function aiReplyFor(text) {
  const base = {
    understood: true, correction: null, memoryCandidates: [], topic: '인사',
    hint: { words: [line('صَدِيقٌ', '친구', 'ṣadīqun')], contextKo: '라일라가 반가워해요. 인사해 보세요.', model: line('أَهْلًا يَا لَيْلَى!', '안녕, 라일라!', 'ahlan yā laylā!'), alternatives: ['مَرْحَبًا!'] },
  };
  if (/اسمي/.test(text)) return { ...base, reply: line('تَشَرَّفْنَا يَا سَارَة!', '만나서 반가워, 사라!', 'tasharrafnā yā sāra!'), memoryCandidates: [{ kind: 'name', value: 'سارة', evidence: 'اسمي سارة' }, { kind: 'likes', value: 'القهوة', evidence: 'أحب القهوة' }] };
  if (/طالب/.test(text)) return { ...base, reply: line('جَمِيلٌ! أَنَا أَيْضًا أُحِبُّ الدِّرَاسَةَ.', '멋지다! 나도 공부를 좋아해.'), correction: { playerSaid: text, better: line('أَنَا طَالِبَةٌ.', '저는 학생이에요. (여성)', 'anā ṭāliba.'), explanationKo: '여성이라면 طَالِبَةٌ를 써요.' } };
  if (/تحذير/.test(text)) return { ...base, reply: line('هذا كلام بدون تشكيل', '부호가 없는 문장') };
  return { ...base, reply: line('أَهْلًا يَا صَدِيقِي! كَيْفَ الْحَالُ الْيَوْمَ؟', '안녕, 친구! 오늘 어때?', 'ahlan yā ṣadīqī! kayfa l-ḥālu l-yawm?') };
}
const ai = await listen(async (req, res) => {
  const body = JSON.parse((await readBody(req)).toString());
  aiLog.push(body);
  const send = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json', 'retry-after': '0' }); res.end(JSON.stringify(obj)); };
  if (body.output_config?.format?.schema?.properties?.lines) {
    const lines = JSON.parse(body.messages[0].content);
    return send(200, { id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: JSON.stringify({ lines }) }] });
  }
  const last = body.messages.at(-1).content;
  if (String(last).includes('خطأ')) return send(500, { type: 'error', error: { type: 'api_error', message: 'boom' } });
  send(200, { id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'text', text: JSON.stringify(aiReplyFor(String(last))) }] });
});

/** 게임 개발 서버 (자식 프로세스, 환경 변수별로) */
async function startVite(port, env) {
  // 이전 실행이 남긴 서버가 응답하면 잘못된 설정으로 테스트하게 되므로 먼저 확인한다
  if (await fetch(`http://127.0.0.1:${port}/`).then(() => true, () => false)) throw new Error(`포트 ${port}가 이미 사용 중입니다`);
  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    detached: true, // 프로세스 그룹째 종료하기 위해
    cwd: ROOT,
    env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', STT_API_KEY: '', TTS_CACHE_DIR: path.join(TMP, 'tts-cache'), ...env },
    stdio: 'ignore',
  });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url + 'api/health')).ok) return { child, url }; } catch {}
    await sleep(250);
  }
  child.kill();
  throw new Error('vite 서버 시작 실패');
}

/** 정적 서버 (API 없음 = 서버 없는 배포를 흉내) */
async function startStatic() {
  const dist = path.join(ROOT, 'dist');
  return listen((req, res) => {
    const p = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = path.join(dist, p === '/' ? 'index.html' : p);
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/html' });
      return res.end('not found');
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' }[ext] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
}

// ── 브라우저 측 계측: 실제 오디오 재생 기록 ────────────────────
const AUDIO_PROBE = () => {
  window.__audio = [];
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    const rec = { src: this.src, rate: this.playbackRate, started: false, ended: false, paused: false, maxTime: 0, duration: 0 };
    window.__audio.push(rec);
    this.addEventListener('playing', () => (rec.started = true));
    this.addEventListener('timeupdate', () => { rec.maxTime = Math.max(rec.maxTime, this.currentTime); rec.duration = this.duration; });
    this.addEventListener('ended', () => (rec.ended = true));
    this.addEventListener('pause', () => (rec.paused = true));
    return origPlay.apply(this, args);
  };
  window.dispatchEvent(new Event('focus'));
};

async function enterAndTalk(page, url) {
  await page.goto(url);
  await page.waitForSelector('#player-name');
  await page.click('label[for=gender-m]');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => window.__arabicVillage?.game.scene.isActive('village'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await sleep(400);
  await openConvo(page);
}
async function openConvo(page) {
  // 라일라 위치(17,11)까지 걸어가 대화 시작 (클릭 대신 장면 API로 정확히 접근)
  await page.evaluate(() => {
    const s = window.__arabicVillage.game.scene.getScene('village');
    const target = s.children.list.find((o) => o.texture?.key?.startsWith('layla') && o.getData('interactable'));
    s.approach(target.getData('interactable'));
  });
  await page.waitForSelector('.convo .entry--npc', { timeout: 30000 });
}
const lastNpc = (page) => page.evaluate(() => [...document.querySelectorAll('.convo .entry--npc')].at(-1)?.querySelector('.ar--chat')?.textContent ?? '');
async function say(page, text) {
  const before = await page.$$eval('.convo .entry--npc', (n) => n.length);
  await page.fill('.convo__input', text);
  await page.click('[data-role=send]');
  await page.waitForFunction((b) => document.querySelectorAll('.convo .entry--npc').length > b || document.querySelector('.convo .error-box'), before, { timeout: 30000 });
}
/** 재생 중인 음성이 없을 때까지 기다린다 (자동 재생이 끝나기를 기다림) */
async function waitIdle(page) {
  await page.waitForFunction(() => !document.querySelector('.is-playing, .is-loading'), null, { timeout: 20000 });
  await sleep(150);
}
async function waitAudio(page, predicate, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const a = await page.evaluate(() => window.__audio);
    if (predicate(a)) return a;
    await sleep(100);
  }
  return page.evaluate(() => window.__audio);
}

const browserArgs = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${MIC_WAV}`, '--autoplay-policy=no-user-gesture-required'];
const errors = [];
const watch = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${tag}: ${m.text()}`));
};

const servers = [];
let browser;
try {
  browser = await chromium.launch({ args: browserArgs });

  // ═════ A. 서버 있음 + AI 키 없음 (연습 모드) + 서버 STT(모의) ═════
  const A = await startVite(5311, { STT_API_KEY: 'mock-stt', STT_BASE_URL: stt.url, TTS_PROVIDERS: 'espeak' });
  servers.push(A.child);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(AUDIO_PROBE);
  const page = await ctx.newPage();
  watch(page, 'A');
  const ttsResponses = [];
  page.on('response', (r) => /\/audio\/tts\/|\/api\/tts/.test(r.url()) && ttsResponses.push({ url: r.url(), status: r.status(), type: r.headers()['content-type'], provider: r.headers()['x-tts-provider'] }));
  await enterAndTalk(page, A.url);

  const badge = await page.evaluate(() => ({ mode: document.querySelector('.mode-badge').dataset.mode, text: document.querySelector('.mode-badge').textContent }));
  check('A. AI 키 없음 → "연습 모드 (모의)"로 표시', badge.mode === 'practice' && badge.text.includes('모의'), badge.text);
  check('A. 첫 인사 (처음 만남)', (await lastNpc(page)).includes('أَنَا لَيْلَى'), await lastNpc(page));

  // 자동 재생: 첫 인사를 미리 만든 음성 파일로 실제 재생
  let audio = await waitAudio(page, (a) => a.some((x) => x.ended));
  const played = audio.find((x) => x.ended);
  check('[실제 재생] 주민 대사 자동 재생: 미리 만든 MP3가 실제로 재생되고 끝남', !!played && played.maxTime > 0.3 && played.duration > 0.3, JSON.stringify(played));
  check('[실제 재생] 음성 파일 응답 = audio/mpeg (미리 만든 파일)', ttsResponses.some((r) => r.url.includes('/audio/tts/') && r.status === 200 && r.type === 'audio/mpeg'), JSON.stringify(ttsResponses.slice(0, 2)));
  const sentences = await page.$$eval('.convo .entry--npc .sent', (n) => n.map((x) => x.textContent));
  check('문장 단위 표시 순서 = 원문 순서', sentences.join(' ') === (await lastNpc(page)), sentences.join(' | '));

  // 같은 버튼 다시 누르면 정지, 중복 재생 없음
  await waitIdle(page);
  await page.evaluate(() => (window.__audio.length = 0));
  const listenAll = '.convo .entry--npc .bubble__ar > .btn-listen';
  await page.click(listenAll);
  audio = await waitAudio(page, (a) => a.some((x) => x.started));
  await page.click(listenAll);
  await sleep(300);
  audio = await page.evaluate(() => window.__audio);
  const stillPlaying = await page.evaluate(() => document.querySelectorAll('.btn-listen.is-playing').length);
  check('재생 중 같은 버튼 → 정지 (중복 재생 없음)', audio.length === 1 && audio[0].paused && stillPlaying === 0, JSON.stringify(audio));

  // 문장 하나만 듣기
  await page.evaluate(() => (window.__audio.length = 0));
  await page.click('.convo .entry--npc .sent >> nth=1');
  audio = await waitAudio(page, (a) => a.some((x) => x.ended));
  check('[실제 재생] 문장을 눌러 그 문장만 듣기', audio.length === 1 && audio[0].ended, JSON.stringify(audio));

  // 텍스트 대화 + 친밀도
  await say(page, 'مرحبا');
  check('A. 아랍어 입력 → 응답 (다음 주제 질문)', (await lastNpc(page)).includes('كَيْفَ حَالُكَ؟'), await lastNpc(page));
  const notices = await page.$$eval('.convo .notice', (n) => n.map((x) => x.textContent).join(' / '));
  check('친밀도: 오늘 첫 대화 + 아랍어로 말함 (게임 로직)', notices.includes('오늘 첫 대화') && notices.includes('아랍어로 말했어요'), notices);

  // 단계별 힌트
  await page.click('[data-hint=words]');
  const words = await page.textContent('.hint-panel');
  await page.click('[data-hint=context]');
  const ctxHint = await page.textContent('.hint-panel');
  await page.click('[data-hint=model]');
  const model = await page.textContent('.hint-panel');
  check('힌트 1~3단계: 단어 → 상황 설명 → 모범 답변', words.includes('خَيْر') && ctxHint.includes('안부') && model.includes('أَنَا بِخَيْرٍ، شُكْرًا.'), `${words.slice(0, 40)} | ${ctxHint.slice(0, 30)} | ${model.slice(0, 50)}`);
  await page.evaluate(() => (window.__audio.length = 0));
  await page.click('.hint-panel .btn-listen');
  audio = await waitAudio(page, (a) => a.some((x) => x.ended));
  check('[실제 재생] 힌트 4단계: 모범 답변 듣기', audio.some((x) => x.ended && x.maxTime > 0.3), JSON.stringify(audio.at(-1)));
  await page.click('.hint-panel >> text=입력창에 넣기');
  check('모범 답변을 입력창에 넣기 (수정 가능)', (await page.inputValue('.convo__input')).includes('أَنَا بِخَيْرٍ'));
  await say(page, 'انا بخير الحمد لله');
  check('모범 답변과 다른 표현도 받아들임 (부호 없이)', (await page.$$('.convo .entry--npc')).length >= 3 && !(await lastNpc(page)).startsWith('عَفْوًا'), await lastNpc(page));

  // 기억: 이름
  await say(page, 'اسمي سارة');
  const mem = await page.$$eval('.convo .notice--memory', (n) => n.map((x) => x.textContent).join(''));
  check('기억: 플레이어가 말한 이름만 근거와 함께 저장', mem.includes('이름') && mem.includes('سارة'), mem);
  await shot(page, '10-convo-practice');

  // 느리게 듣기 설정
  await page.click('.convo [aria-label="대화 설정"]');
  await page.check('.convo__settings .setting--check:has-text("천천히") input');
  await page.click('.convo__settings >> text=닫기');
  await waitIdle(page);
  await page.evaluate(() => (window.__audio.length = 0));
  await page.click(`.convo .entry--npc >> nth=-1 >> .bubble__ar > .btn-listen`);
  audio = await waitAudio(page, (a) => a.some((x) => x.started));
  check('느린 속도 설정 → 재생 속도 0.75', audio[0]?.rate === 0.75, JSON.stringify(audio[0]));

  // 대화창을 닫으면 음성 정지
  await page.click('.convo [data-role=close]');
  await sleep(200);
  audio = await page.evaluate(() => window.__audio);
  check('대화창을 닫으면 재생 중 음성 정지', audio.every((x) => x.ended || x.paused), JSON.stringify(audio));

  // ── 음성 입력 (서버 STT 경로, 가짜 마이크) ──
  await openConvo(page);
  await page.click('.convo__mic');
  await page.waitForSelector('[data-role=stt-consent]');
  const consent = await page.textContent('.stt-status');
  check('음성 입력 전 외부 전송 안내와 동의', consent.includes('전송') && consent.includes('저장하지 않아요'), consent.slice(0, 60));
  await page.click('[data-role=stt-consent]');
  await page.waitForFunction(() => document.querySelector('.stt-status')?.textContent.includes('듣는 중'), null, { timeout: 10000 }).catch(async () => {
    throw new Error('녹음 시작 안 됨: ' + (await page.textContent('.stt-status')));
  });
  await sleep(2200);
  await page.click('.convo__mic'); // ■ 완료
  await page.waitForFunction(() => document.querySelector('.stt-status')?.textContent.includes('확인하고'), null, { timeout: 20000 }).catch(async () => {
    throw new Error(`인식 결과 없음: "${await page.textContent('.stt-status')}" 업로드 ${sttLog.length}건`);
  });
  const recognized = await page.inputValue('.convo__input');
  const up = sttLog.at(-1);
  // MediaRecorder의 WebM은 헤더에 길이가 없으므로 실제로 디코딩해 길이·음량을 잰다
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', up.file, '-af', 'volumedetect', '-f', 'null', '-']).stderr.toString();
  const codec = /Audio: (\w+)/.exec(probe)?.[1];
  const times = [...probe.matchAll(/time=(\d+):(\d+):([\d.]+)/g)].at(-1);
  const dur = times ? +times[1] * 3600 + +times[2] * 60 + +times[3] : 0;
  const meanDb = parseFloat(/mean_volume: (-?[\d.]+) dB/.exec(probe)?.[1] ?? '-99');
  check('[실제 녹음] 가짜 마이크 음성이 녹음·업로드됨 (ffmpeg 디코딩: 코덱·길이·음량)', !!codec && dur > 1 && meanDb > -60, `codec=${codec} 길이=${dur.toFixed(2)}s 평균음량=${meanDb}dB`);
  check('STT 요청: language=ar, 녹음 형식 유지', up.lang === 'ar' && /speech\.(webm|ogg|m4a)/.test(up.filename), JSON.stringify({ lang: up.lang, filename: up.filename }));
  check('[모의 STT] 인식 결과를 입력창에 넣고, 보내기 전에 고칠 수 있음', recognized === 'مرحبا' && !(await page.$$eval('.convo .entry--player', (n) => n.length)), recognized);
  await page.fill('.convo__input', 'مرحبا يا ليلى');
  await page.click('[data-role=send]');
  await page.waitForFunction(() => [...document.querySelectorAll('.convo .entry--player')].some((e) => e.textContent.includes('음성 입력')), null, { timeout: 15000 });
  check('수정한 인식 결과를 보내면 "음성 입력"으로 표시', true);

  // STT 실패 → 벌점 없이 다시 말하기
  const friendBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('arabic-village:v1')).npcs.layla.friendship);
  sttFail = true;
  await page.click('.convo__mic');
  await page.waitForFunction(() => document.querySelector('.stt-status')?.textContent.includes('듣는 중'), null, { timeout: 10000 });
  await sleep(1500);
  await page.click('.convo__mic');
  await page.waitForFunction(() => document.querySelector('.stt-status')?.textContent.includes('다시'), null, { timeout: 20000 });
  const failMsg = await page.textContent('.stt-status');
  const friendAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('arabic-village:v1')).npcs.layla.friendship);
  check('인식 실패 → 안내 + 다시 말하기, 친밀도 감소 없음', failMsg.includes('다시 말하기') && friendAfter >= friendBefore, `${failMsg.slice(0, 50)} (${friendBefore}→${friendAfter})`);
  sttFail = false;
  await page.click('.convo [data-role=close]');

  // 새로고침 후 기억 유지
  await page.reload();
  await enterAndTalk(page, A.url);
  const prev = await page.$$eval('.prev-talk__line', (n) => n.length);
  await page.click('.convo [aria-label="대화 설정"]');
  const facts = await page.textContent('.convo__settings');
  check('새로고침 후 라일라의 기억·지난 대화 유지', facts.includes('سارة') && prev > 0 && (await lastNpc(page)).includes('أَهْلًا وَسَهْلًا'), `prev=${prev}, greet=${await lastNpc(page)}`);
  await page.click('.convo__settings >> text=닫기');
  // 표현 저장
  await page.click('.convo .entry--npc >> nth=-1 >> [data-role=save-phrase]');
  await page.click('.convo [data-role=close]');

  // 책상: 대화에서 만난 표현
  await page.evaluate(() => {
    const s = window.__arabicVillage.game.scene.getScene('village');
    s.walkTo({ x: 6 * 32 + 16, y: 6 * 32 + 16 });
  });
  await sleep(2500);
  await page.evaluate(() => window.__arabicVillage.game.scene.getScene('village').scene.start('house'));
  await sleep(800);
  await page.evaluate(() => {
    const s = window.__arabicVillage.game.scene.getScene('house');
    const desk = s.children.list.find((o) => o.texture?.key === 'desk');
    s.approach(desk.getData('interactable'));
  });
  await page.waitForSelector('.study');
  await page.click('[data-topic=phrases]');
  const heardRows = await page.$$eval('.phrase-list [data-item-id]', (n) => n.map((x) => x.dataset.itemId));
  const savedRows = await page.$$eval('.phrase-list .related__row:not([data-item-id])', (n) => n.length);
  check('책상: 대화에서 들은 표현(학습 전)과 저장한 표현 표시', heardRows.includes('s.kayfa_haluka') && savedRows >= 1, `heard=${heardRows.join(',')} saved=${savedRows}`);
  await page.click('.phrase-list [data-item-id="s.kayfa_haluka"] [data-role=learn-heard]');
  const lessonItem = await page.getAttribute('.ar--hero', 'data-item-id');
  const heardChip = await page.textContent('.lesson__head');
  check('들은 표현 → 바로 배우기 (대화에서 들은 횟수 표시)', lessonItem === 's.kayfa_haluka' && heardChip.includes('대화에서'), heardChip);
  await shot(page, '11-desk-phrases');
  await ctx.close();

  // ── 모바일 화면 ──
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await mctx.addInitScript(AUDIO_PROBE);
  const m = await mctx.newPage();
  watch(m, 'mobile');
  await enterAndTalk(m, A.url);
  await m.click('.convo__kbtoggle');
  await m.click('.kb-key >> text=م');
  const layout = await m.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const box = r('.convo');
    const parts = ['.convo__input', '.convo__mic', '[data-role=send]', '.convo .entry--npc .btn-listen'].map((s) => r(s));
    return { inView: parts.every((p) => p.left >= 0 && p.right <= innerWidth && p.bottom <= innerHeight && p.height >= 32), boxW: box.width, vw: innerWidth, docW: document.documentElement.scrollWidth, input: document.querySelector('.convo__input').value };
  });
  check('모바일: 입력창·마이크·보내기·듣기 버튼이 화면 안, 가로 스크롤 없음, 화면 자판 입력', layout.inView && layout.docW <= layout.vw && layout.input === 'م', JSON.stringify(layout));
  await shot(m, '12-mobile-convo');
  await mctx.close();

  // ═════ B. 모의 AI 서버 (실제 Claude 아님) ═════
  const B = await startVite(5312, { ANTHROPIC_API_KEY: 'sk-test-mock', VILLAGE_ANTHROPIC_BASE_URL: ai.url, TTS_PROVIDERS: 'espeak' });
  servers.push(B.child);
  const bctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await bctx.addInitScript(AUDIO_PROBE);
  const b = await bctx.newPage();
  watch(b, 'B');
  const bTts = [];
  b.on('response', (r) => r.url().includes('/api/tts') && bTts.push({ status: r.status(), type: r.headers()['content-type'], provider: r.headers()['x-tts-provider'] }));
  await enterAndTalk(b, B.url);
  const bBadge = await b.evaluate(() => ({ mode: document.querySelector('.mode-badge').dataset.mode, tag: document.querySelector('.src-tag')?.textContent }));
  check('B. [모의 AI] AI 모드 배지와 응답 출처 표시', bBadge.mode === 'ai' && bBadge.tag.includes('claude-opus-5-5'), JSON.stringify(bBadge));
  const sentReq = aiLog.at(-1);
  check('B. AI 요청에 시험 단계·기억·구조화 출력 포함 (키는 서버에만)', sentReq.output_config?.format?.type === 'json_schema' && sentReq.system?.[2]?.text.includes('Exam stage'), sentReq.model);
  const bAudio = await waitAudio(b, (a) => a.some((x) => x.ended), 20000);
  check('[실제 재생] 미리 만들지 않은 AI 문장 → 서버 espeak-ng 음성 생성 후 재생', bTts.some((r) => r.status === 200 && r.type === 'audio/mpeg' && r.provider === 'espeak-ng') && bAudio.some((x) => x.ended && x.maxTime > 0.5), JSON.stringify(bTts.slice(0, 2)));
  const bundle = await b.evaluate(async () => {
    const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
    let all = '';
    for (const s of scripts) all += await (await fetch(s)).text();
    return all.includes('sk-test-mock');
  });
  check('API 키가 브라우저에 전달되지 않음', !bundle && !(await b.evaluate(() => JSON.stringify(localStorage))).includes('sk-test'));

  await say(b, 'انا طالب');
  const corr = await b.textContent('.convo .entry--npc >> nth=-1');
  check('B. 교정: 짧은 설명 + 더 자연스러운 표현(듣기 포함)', corr.includes('더 자연스러워요') && corr.includes('طَالِبَةٌ'), corr.slice(0, 80));
  await say(b, 'اسمي سارة');
  const bMem = await b.evaluate(() => JSON.parse(localStorage.getItem('arabic-village:v1')).npcs.layla.facts.map((f) => f.kind + ':' + f.value));
  check('B. AI가 추측한 기억(말하지 않은 취향)은 저장하지 않음', bMem.includes('name:سارة') && !bMem.some((f) => f.startsWith('likes')), bMem.join(','));
  await say(b, 'تحذير');
  const warn = await b.textContent('.convo .entry--npc >> nth=-1');
  check('B. 모음 부호가 의심되는 AI 문장에 경고 표시', warn.includes('확실하지 않은'), warn.slice(-60));
  await say(b, 'خطأ');
  const err = await b.textContent('.convo .error-box');
  check('B. AI 서버 오류 → 오류 종류 안내 + 다시 시도/연습 모드 버튼 (가짜 응답 없음)', err.includes('서버 오류') && !!(await b.$('[data-role=retry]')) && !!(await b.$('[data-role=practice]')), err.slice(0, 60));
  await b.click('[data-role=practice]');
  await b.waitForFunction(() => document.querySelector('.mode-badge').dataset.mode === 'practice' && [...document.querySelectorAll('.src-tag')].at(-1).textContent.includes('모의'));
  check('B. 사용자가 고르면 연습 모드(모의)로 계속, 출처 표시 변경', true);
  await shot(b, '13-convo-ai-mock');
  await bctx.close();

  // ═════ C. 서버 없는 정적 배포 (오프라인) ═════
  execFileSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'ignore' });
  const C = await startStatic();
  const cctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await cctx.addInitScript(AUDIO_PROBE);
  const c = await cctx.newPage();
  watch(c, 'C');
  await c.goto(C.url + '/');
  await c.waitForSelector('#player-name');
  await c.click('label[for=gender-m]');
  await c.click('button[type=submit]');
  await c.waitForFunction(() => document.querySelector('canvas'));
  await sleep(600);
  // 정적 배포에는 개발 훅이 없으므로 라일라를 화면 클릭으로 찾는다: 대화창 열기 함수가 없어 키보드로 직접 연다
  const opened = await c.evaluate(() => typeof window.__arabicVillage);
  check('C. 정적 배포 빌드에는 개발용 훅이 없음', opened === 'undefined');
  await cctx.close();

  // 정적 서버 + 개발 훅 대신: 개발 서버를 API 없이 흉내 내기 위해, 같은 정적 서버에서 API 요청이 404인 상황을 A 서버 페이지로 재현
  const octx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await octx.addInitScript(AUDIO_PROBE);
  await octx.route('**/api/**', (route) => route.abort('failed')); // 서버 API 전부 차단 = 오프라인
  const o = await octx.newPage();
  watch(o, 'offline');
  await enterAndTalk(o, A.url);
  const oBadge = await o.evaluate(() => document.querySelector('.mode-badge').dataset.mode);
  const oAudio = await waitAudio(o, (a) => a.some((x) => x.ended));
  check('C. 서버 API 없음 → 오프라인 연습 모드(모의) + 미리 만든 음성으로 실제 재생', oBadge === 'offline' && oAudio.some((x) => x.ended && x.maxTime > 0.3), `${oBadge} ${JSON.stringify(oAudio[0])}`);
  await say(o, 'شكرا');
  check('C. 오프라인에서도 대화 계속', (await lastNpc(o)).includes('عَفْوًا'), await lastNpc(o));
  await o.click('.convo__mic');
  await sleep(300);
  if (await o.$('[data-role=stt-consent]')) await o.click('[data-role=stt-consent]');
  await o.waitForFunction(() => /듣는 중|음성|마이크/.test(document.querySelector('.stt-status')?.textContent ?? ''), null, { timeout: 15000 });
  await sleep(1500);
  if ((await o.textContent('.stt-status')).includes('듣는 중')) await o.click('.convo__mic');
  await o.waitForFunction(() => !/듣는 중|준비하는 중|바꾸는 중/.test(document.querySelector('.stt-status')?.textContent ?? ''), null, { timeout: 20000 });
  const oStt = await o.textContent('.stt-status');
  check('C. 오프라인에서 음성 입력: 결과 또는 이유 안내 (키보드로 계속 가능)', oStt.length > 5 && !(await o.isDisabled('.convo__input')), oStt.slice(0, 70));
  await octx.close();

  check('콘솔/페이지 오류 없음', errors.length === 0, errors.slice(0, 3).join(' || '));
} catch (e) {
  console.error(e);
  check('예외 없이 완료', false, String(e).slice(0, 300));
} finally {
  await browser?.close();
  for (const s of servers) {
    try {
      process.kill(-s.pid, 'SIGTERM'); // npx와 그 아래 vite까지 함께 종료
    } catch {}
  }
  stt.server.close();
  ai.server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
