/**
 * 브라우저 E2E 테스트 (Playwright + Vite 개발 서버).
 *   npm run test:e2e            결과만 출력
 *   E2E_SHOTS=dir npm run test:e2e   스크린샷도 저장
 * 개발 모드에서만 노출되는 window.__arabicVillage 훅을 사용한다.
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.E2E_SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const T = 32;
const C = (n) => n * T + T / 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

// 페이지 안 도우미
const HELPERS = () => {
  window.dispatchEvent(new Event('focus')); // 헤드리스에서 Phaser가 프레임 간격을 줄이지 않게
  window.__t = {
    av: () => window.__arabicVillage,
    scene() { return this.av().game.scene.getScenes(true)[0]; },
    feet() { const p = this.scene().player.feet; return { x: p.x, y: p.y }; },
    moving() { return this.scene().player.isMoving; },
    camKey() { const c = this.scene().cameras.main; return `${c.scrollX.toFixed(1)},${c.scrollY.toFixed(1)}`; },
    toScreen(wx, wy) {
      const s = this.scene(); const cam = s.cameras.main; const r = s.game.canvas.getBoundingClientRect();
      return { x: r.left + (wx - cam.worldView.x) * cam.zoom, y: r.top + (wy - cam.worldView.y) * cam.zoom };
    },
    startTrace() {
      const s = this.scene(); this.trace = [];
      this._fn = () => { const p = s.player.feet; const b = s.player.body; this.trace.push({ vx: b.velocity.x, vy: b.velocity.y, fits: s.grid.bodyFits(p) }); };
      s.events.on('postupdate', this._fn);
    },
    stopTrace() { this.scene().events.off('postupdate', this._fn); return this.trace; },
    rec(id) { return this.av().learning().get(id); },
  };
};

async function inject(page) { await page.evaluate(HELPERS); }
async function camSettle(page) {
  let prev = null;
  for (let i = 0; i < 50; i++) { const k = await page.evaluate(() => __t.camKey()); if (k === prev) return; prev = k; await sleep(60); }
}
async function waitStill(page, timeout = 20000) {
  const t0 = Date.now();
  await sleep(120);
  while (Date.now() - t0 < timeout) {
    if (!(await page.evaluate(() => __t.moving()))) { await camSettle(page); return true; }
    await sleep(50);
  }
  return false;
}
async function clickWorld(page, wx, wy, tap = false) {
  await camSettle(page);
  const p = await page.evaluate(([x, y]) => __t.toScreen(x, y), [wx, wy]);
  const vp = page.viewportSize();
  if (p.x < 0 || p.y < 0 || p.x > vp.width || p.y > vp.height) throw new Error(`화면 밖 클릭 (${wx},${wy})`);
  if (tap) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
}
async function moveTo(page, wx, wy) {
  await page.evaluate(([x, y]) => __t.scene().walkTo({ x, y }), [wx, wy]);
  await waitStill(page);
}
/** 성별을 아직 고르지 않았으면 고른다 (첫 화면에서 반드시 골라야 한다) */
async function pickGender(page, gender = 'm', tap = false) {
  if (await page.isChecked('#gender-m') || await page.isChecked('#gender-f')) return;
  if (tap) await page.tap(`label[for=gender-${gender}]`); else await page.click(`label[for=gender-${gender}]`);
}
async function startGame(page, name = '') {
  await page.waitForSelector('#player-name');
  if (name) await page.fill('#player-name', name);
  await pickGender(page);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => window.__arabicVillage?.game.scene.isActive('village'));
  await inject(page);
  await sleep(500);
}
async function waitScene(page, key) {
  await page.waitForFunction((k) => window.__arabicVillage.game.scene.isActive(k), key, { timeout: 20000 });
  await sleep(400);
  await inject(page);
}
/** 마을 → 집 → 책상 → 공부 메뉴 */
async function openStudy(page, tap = false) {
  if (await page.evaluate(() => window.__arabicVillage.game.scene.isActive('village'))) {
    await moveTo(page, C(6), C(7));
    await clickWorld(page, C(6), 5 * T + 10, tap);
    await waitScene(page, 'house');
  }
  await clickWorld(page, 6 * T, 2 * T + 10, tap);
  await page.waitForSelector('.study', { timeout: 20000 });
}
const statValues = (page) => page.$$eval('.study__stats .stat__value', (els) => els.map((e) => e.textContent));

/** 가짜 아랍어 음성 (재생 상태 UI 검증용). 실제 음성 유무는 별도 시나리오에서 확인한다. */
const FAKE_SPEECH = () => {
  const log = (window.__speechLog = []);
  let active = null;
  const synth = {
    getVoices: () => [{ name: 'Fake Arabic', lang: 'ar-SA', localService: true }],
    addEventListener() {}, removeEventListener() {},
    speak(u) { log.push('speak:' + u.text); if (active) log.push('OVERLAP'); active = u; setTimeout(() => active === u && u.onstart && u.onstart(), 10); },
    cancel() { log.push('cancel'); const u = active; active = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); },
    get speaking() { return !!active; },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  // 실제 SpeechSynthesisUtterance는 진짜 음성 객체만 받으므로 가짜 발화 객체도 함께 바꾼다.
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; this.lang = ''; this.voice = null; this.rate = 1; } };
};

/** 시간 이동 (간격 반복 검증용). 학습 진도는 생성 시점의 Date.now를 쓰므로 앱보다 먼저 바꾼다. */
const TIME_TRAVEL = () => {
  const realNow = Date.now.bind(Date);
  window.__timeOffset = 0;
  Date.now = () => realNow() + window.__timeOffset;
};

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const URL = server.resolvedUrls.local[0];
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, tag) => {
    page.on('pageerror', (e) => errors.push(`${tag}: ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${tag}: ${m.text()}`));
  };

  try {
    // ═════ 1. 회귀: 이동·충돌·대화·집 출입 ═════
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    watch(page, 'desktop');
    await page.goto(URL);
    await startGame(page);
    check('[회귀] 빈 이름 → 기본 이름', (await page.textContent('#hud-name')) === '유학생');

    await page.evaluate(() => __t.startTrace());
    await clickWorld(page, C(10), C(10));
    await waitStill(page);
    let tr = await page.evaluate(() => __t.stopTrace());
    let end = await page.evaluate(() => __t.feet());
    const speeds = tr.filter((p) => p.vx || p.vy).map((p) => Math.hypot(p.vx, p.vy));
    check('[회귀] 대각선 클릭 이동 + 일정 속도 + 정지', tr.some((p) => Math.abs(p.vx) > 1 && Math.abs(p.vy) > 1) && speeds.every((s) => Math.abs(s - 110) < 0.5) && Math.hypot(end.x - C(10), end.y - C(10)) < 1.5, JSON.stringify(end));

    await moveTo(page, C(13), C(11));
    await page.evaluate(() => __t.startTrace());
    await clickWorld(page, C(16), C(12));
    await waitStill(page);
    tr = await page.evaluate(() => __t.stopTrace());
    check('[회귀] 장애물(우물) 우회, 겹침 없음', tr.length > 0 && tr.every((p) => p.fits));

    await moveTo(page, C(6), C(7));
    await page.evaluate(() => __t.scene().player.walk([{ x: 6 * 32 + 16, y: 3 * 32 + 16 }]));
    await sleep(1500);
    end = await page.evaluate(() => __t.feet());
    check('[회귀] Arcade 충돌: 집 벽 통과 불가', end.y >= 192, JSON.stringify(end));
    await page.evaluate(() => __t.scene().player.halt());

    const before = await page.evaluate(() => __t.feet());
    await clickWorld(page, C(5), C(4));
    await sleep(400);
    const after = await page.evaluate(() => __t.feet());
    check('[회귀] 건물 한가운데 클릭 → 이동 거부', Math.hypot(after.x - before.x, after.y - before.y) < 0.5 && (await page.textContent('#toast')).includes('갈 수 없어요'));

    // 라일라 대화 (자유 회화 창)
    await moveTo(page, C(15), C(13));
    await clickWorld(page, C(17), C(11) - 4);
    await page.waitForSelector('.convo .entry--npc', { timeout: 20000 });
    const dlg = await page.evaluate(() => {
      const ar = document.querySelector('.convo .entry--npc .ar--chat');
      return { ar: ar.textContent, dir: getComputedStyle(ar).direction, mode: document.querySelector('.mode-badge').dataset.mode, listen: !!document.querySelector('.convo .entry--npc .btn-listen') };
    });
    check('[회귀] 주민 클릭 → 대화창 (아랍어 RTL, 첫 인사)', dlg.ar.includes('مَرْحَبًا') && dlg.dir === 'rtl' && dlg.listen, JSON.stringify(dlg));
    const p0 = await page.evaluate(() => __t.feet());
    await page.mouse.click(200, 150);
    await sleep(400);
    const p1 = await page.evaluate(() => __t.feet());
    check('[회귀] 대화 중 마을 클릭 무시', Math.hypot(p1.x - p0.x, p1.y - p0.y) < 0.01);
    await shot(page, '01-dialogue');
    await page.click('.convo [data-role=close]');
    check('[회귀] 대화창 닫기', !(await page.$('.convo')));

    // ═════ 2. 책상 공부 메뉴 ═════
    await moveTo(page, C(9), C(8));
    await openStudy(page);
    check('[회귀] 집 출입 + 책상 접근 → 공부 메뉴', true);
    let stats = await statValues(page);
    check('학습 현황: 기록 없음 상태 표시', stats[0] === '0 / 49' && stats[1] === '0 / 43' && stats[2] === '0' && stats[3].includes('인사와 안부'), stats.join(' | '));
    await page.waitForFunction(() => !document.querySelector('.voice-status').textContent.includes('확인 중'));
    const voiceStatus = await page.textContent('.voice-status');
    check('음성 상태 안내 표시', voiceStatus.length > 5, voiceStatus);
    await shot(page, '02-study-menu');
    const before2 = await page.evaluate(() => __t.feet());
    await page.mouse.click(30, 780);
    await sleep(300);
    check('공부 메뉴 열림 중 캐릭터 이동 없음', JSON.stringify(before2) === JSON.stringify(await page.evaluate(() => __t.feet())));

    // 새 단어 배우기
    await page.click('[data-topic=words]');
    await page.waitForSelector('.lesson');
    let hero = await page.evaluate(() => {
      const h = document.querySelector('.ar--hero');
      const cs = getComputedStyle(h);
      return { id: h.dataset.itemId, text: h.textContent, dir: cs.direction, font: cs.fontFamily, lh: parseFloat(cs.lineHeight), fs: parseFloat(cs.fontSize), clipped: h.scrollHeight > h.clientHeight + 1, banner: !!document.querySelector('.new-banner') };
    });
    check('단어 학습: 첫 단어(모음 부호 포함) 표시', hero.id === 'w.marhaban' && hero.text === 'مَرْحَبًا' && hero.banner, JSON.stringify(hero));
    check('아랍어 RTL + 웹폰트 + 넉넉한 줄 간격(부호 잘림 방지)', hero.dir === 'rtl' && hero.font.includes('Noto Naskh Arabic') && hero.lh >= hero.fs * 1.9 && !hero.clipped, `font-size ${hero.fs}px, line-height ${hero.lh}px`);
    check('웹폰트 실제 로드', await page.evaluate(() => document.fonts.check('40px "Noto Naskh Arabic"', 'مَرْحَبًا')));
    const reading = await page.textContent('.reading');
    check('발음 보조·부호 없는 표기 표시', reading.includes('marḥaban') && reading.includes('마르하반') && reading.includes('مرحبا'), reading);
    stats = await statValues(page);
    check('처음 본 단어 → 단어 1 / 49, 복습 1', stats[0] === '1 / 49' && stats[2] === '1', stats.join(' | '));
    await shot(page, '03-word');

    for (let i = 0; i < 5; i++) await page.click('[data-nav=next]');
    stats = await statValues(page);
    const sixth = await page.getAttribute('.ar--hero', 'data-item-id');
    check('다음 버튼으로 이동하며 학습 기록 (6개)', stats[0] === '6 / 49' && sixth === 'w.khayr', `${stats[0]} ${sixth}`);
    await page.click('[data-nav=prev]');
    await page.click('[data-nav=prev]');
    stats = await statValues(page);
    const back = await page.evaluate(() => ({ id: document.querySelector('.ar--hero').dataset.itemId, banner: !!document.querySelector('.new-banner') }));
    check('이전 이동: 이미 배운 항목은 새로 세지 않음', stats[0] === '6 / 49' && back.id === 'w.sabah' && !back.banner, JSON.stringify(back));
    await page.keyboard.press('ArrowRight');
    check('키보드 → 로 다음 항목', (await page.getAttribute('.ar--hero', 'data-item-id')) === 'w.masa');
    const examples = await page.$$eval('.related__row .ar', (els) => els.map((e) => e.textContent));
    check('단어의 예문 표시', examples.some((e) => e.includes('مَسَاءَ')), examples.join(' / '));

    // 새 문장 배우기
    await page.click('text=메뉴로');
    await page.click('[data-topic=sentences]');
    await page.waitForSelector('.lesson');
    const s1 = await page.evaluate(() => ({
      id: document.querySelector('.ar--hero').dataset.itemId,
      ko: document.querySelector('.ko--meaning').textContent,
      keyWords: [...document.querySelectorAll('[data-word-id]')].map((e) => ({ id: e.dataset.wordId, text: e.textContent, listen: !!e.querySelector('.btn-listen') })),
    }));
    check('문장 학습: 원문·번역·핵심 단어(듣기 포함) 표시', s1.id === 's.marhaban' && s1.ko === '안녕하세요!' && s1.keyWords.length === 1 && s1.keyWords[0].listen && s1.keyWords[0].text.includes('✓'), JSON.stringify(s1));
    for (let i = 0; i < 3; i++) await page.click('[data-nav=next]');
    const s4 = await page.evaluate(() => ({ id: document.querySelector('.ar--hero').dataset.itemId, words: [...document.querySelectorAll('[data-word-id]')].map((e) => e.dataset.wordId) }));
    check('문장 ↔ 단어 관계 유지 (صَبَاحَ الْخَيْرِ → 아침, 좋은 것)', s4.id === 's.sabah_khayr' && s4.words.join() === 'w.sabah,w.khayr', JSON.stringify(s4));
    await shot(page, '04-sentence');
    stats = await statValues(page);
    check('문장 4개 학습 기록', stats[1] === '4 / 43', stats.join(' | '));

    // 복습
    await page.click('text=메뉴로');
    await page.click('[data-topic=review]');
    await page.waitForSelector('.review [data-index]');
    const answerPositions = [];
    const typesSeen = new Set();
    let wrongChecked = false;
    let correctChecked = false;
    for (let round = 0; round < 3; round++) {
      for (let q = 0; q < 12; q++) {
        const info = await page.evaluate(() => {
          const sec = document.querySelector('.review[data-question-item]');
          if (!sec) return null;
          const choices = [...sec.querySelectorAll('[data-index]')].map((b) => b.dataset.itemId);
          return { item: sec.dataset.questionItem, type: sec.dataset.questionType, choices };
        });
        if (!info) break;
        typesSeen.add(info.type);
        const answerIdx = info.choices.indexOf(info.item);
        answerPositions.push(answerIdx);
        const beforeRec = await page.evaluate((id) => __t.rec(id), info.item);
        // 번갈아 오답/정답을 고른다
        const pickWrong = (answerPositions.length % 2 === 1);
        const pick = pickWrong ? (answerIdx + 1) % info.choices.length : answerIdx;
        await page.click(`.review [data-index="${pick}"]`);
        const fb = await page.evaluate(() => ({
          title: document.querySelector('.feedback__title')?.textContent ?? '',
          answer: document.querySelector('.feedback__answer .ar')?.textContent ?? '',
          correctBtn: document.querySelector('.choice.is-correct')?.dataset.index,
          wrongBtn: document.querySelector('.choice.is-wrong')?.dataset.index,
          disabled: [...document.querySelectorAll('.choice')].every((b) => b.disabled),
        }));
        const afterRec = await page.evaluate((id) => __t.rec(id), info.item);
        if (pickWrong && !wrongChecked) {
          wrongChecked = true;
          check('오답 선택 → 정답 표시·해설, 기록은 유지(오답 +1)', fb.title.includes('아쉬워요') && fb.answer.length > 0 && fb.correctBtn === String(answerIdx) && fb.wrongBtn === String(pick) && fb.disabled && afterRec.wrong === beforeRec.wrong + 1 && afterRec.firstStudiedAt === beforeRec.firstStudiedAt, JSON.stringify(fb));
          await shot(page, '05-review-wrong');
        }
        if (!pickWrong && !correctChecked) {
          correctChecked = true;
          check('정답 선택 → 정답 표시, 정답 +1', fb.title.includes('정답이에요') && afterRec.correct === beforeRec.correct + 1, JSON.stringify(fb));
        }
        await page.click('[data-role=next]');
      }
      await page.waitForSelector('.review--summary');
      if (round === 0) {
        const summary = await page.textContent('.summary__score');
        check('복습 결과 화면 (벌점 없음)', /문제 중 \d+문제 정답/.test(summary), summary);
        await shot(page, '06-review-summary');
      }
      await page.click('[data-role=again]');
      await page.waitForSelector('.review [data-index]');
    }
    const posCounts = [0, 1, 2, 3].map((i) => answerPositions.filter((p) => p === i).length);
    check(`정답 위치 무작위 (${answerPositions.length}문제: ${posCounts.join('/')})`, posCounts.filter((c) => c > 0).length >= 3 && Math.max(...posCounts) < answerPositions.length * 0.6);
    check(`복습 문제 유형 혼합 (${[...typesSeen].join(', ')})`, typesSeen.size >= 3);

    // 프로필 (AI 회화용)
    const profile = await page.evaluate(() => {
      const p = window.__arabicVillage.getLearnerProfile();
      return { encountered: p.encountered.length, reviewed: p.reviewed.length, comfortable: p.comfortable.length, needsReview: p.needsReview.length, unit: p.currentUnit.id };
    });
    check('학습자 프로필: 본 표현/복습한 표현/익숙한 표현 구분', profile.encountered === 10 && profile.reviewed > 0 && profile.comfortable <= profile.reviewed, JSON.stringify(profile));

    // 모음 부호 표시 검사: 모든 학습 문자열의 실제 글리프(위·아래 부호 포함)가 CSS 줄 상자 안에 들어오는지 측정
    const glyphReport = await page.evaluate(async () => {
      const { ALL_ITEMS } = await import('/src/learning/content/index.ts');
      await document.fonts.load('700 40px "Noto Naskh Arabic"');
      await document.fonts.load('400 40px "Noto Naskh Arabic"');
      const ctx2d = document.createElement('canvas').getContext('2d');
      // [이름, 굵기, 글자 크기(px), CSS line-height 배수] — main.css와 같은 값
      const styles = [['hero-word', 700, 57.6, 2], ['hero-sentence', 700, 40, 2], ['row', 400, 23.2, 2], ['choice', 400, 23.2, 2]];
      const problems = [];
      let checked = 0;
      for (const item of ALL_ITEMS) {
        for (const [name, weight, size, lh] of styles) {
          if (name === 'hero-word' && item.kind !== 'word') continue;
          if (name === 'hero-sentence' && item.kind !== 'sentence') continue;
          ctx2d.font = `${weight} ${size}px "Noto Naskh Arabic"`;
          ctx2d.direction = 'rtl';
          const m = ctx2d.measureText(item.ar);
          const half = (size * lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;
          checked++;
          if (m.actualBoundingBoxAscent > m.fontBoundingBoxAscent + half || m.actualBoundingBoxDescent > m.fontBoundingBoxDescent + half) {
            problems.push(`${item.id}/${name}: ink ${m.actualBoundingBoxAscent.toFixed(1)}+${m.actualBoundingBoxDescent.toFixed(1)} > line ${(size * lh).toFixed(1)}`);
          }
        }
      }
      return { checked, problems };
    });
    check(`모음 부호가 줄 상자 안에 표시됨 (${glyphReport.checked}개 측정)`, glyphReport.checked > 150 && glyphReport.problems.length === 0, glyphReport.problems.slice(0, 5).join(' | '));

    // 마을로 복귀 → 대화창 표시 변화
    await page.click('text=그만하기');
    await page.click('text=마을로 돌아가기');
    await waitScene(page, 'village');
    check('[회귀] 공부 메뉴에서 마을로 복귀', true);
    await moveTo(page, C(15), C(13));
    await clickWorld(page, C(17), C(11) - 4);
    await page.waitForSelector('.convo .entry--npc', { timeout: 20000 });
    const tag2 = await page.textContent('.convo .entry--npc .bubble__tags');
    check('배운 뒤 대화창: "배운 표현" 표시', tag2.includes('배운 표현'), tag2);
    await page.click('.convo [data-role=close]');

    // ═════ 3. 저장·복원 ═════
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('arabic-village:v1')));
    await page.reload();
    await page.waitForSelector('#player-name');
    check('새로고침 후 이름 유지', (await page.inputValue('#player-name')) === '유학생');
    await startGame(page);
    await openStudy(page);
    const stats2 = await statValues(page);
    check('새로고침 후 학습 진도 복원', saved.version === 5 && Object.keys(saved.learning.items).length === 10 && stats2[0] === '6 / 49' && stats2[1] === '4 / 43', stats2.join(' | '));
    await page.click('[data-topic=words]');
    check('이어서 배우기: 아직 안 배운 첫 단어부터', (await page.getAttribute('.ar--hero', 'data-item-id')) === 'w.nur');
    await page.keyboard.press('Escape');
    check('Esc로 공부 메뉴 닫기', !(await page.$('.study')));
    await ctx.close();

    // ═════ 4. 1단계 저장 데이터 이전 ═════
    const ctxOld = await browser.newContext();
    await ctxOld.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('arabic-village:v1', JSON.stringify({ playerName: '옛 이름' })); sessionStorage.setItem('seeded', '1'); } });
    const pOld = await ctxOld.newPage();
    watch(pOld, 'migrate');
    await pOld.goto(URL);
    await pOld.waitForSelector('#player-name');
    const oldName = await pOld.inputValue('#player-name');
    await startGame(pOld);
    const migrated = await pOld.evaluate(() => JSON.parse(localStorage.getItem('arabic-village:v1')));
    check('1단계 저장 데이터(이름만) → 현재 버전(5)으로 이전, 시험 1단계', oldName === '옛 이름' && migrated.version === 5 && migrated.exam?.stage === 1 && migrated.playerName === '옛 이름' && typeof migrated.learning === 'object', JSON.stringify(migrated).slice(0, 80));
    await ctxOld.close();

    // ═════ 5. 음성 재생 상태 (가짜 아랍어 음성 주입) ═════
    const ctxSp = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctxSp.addInitScript(FAKE_SPEECH);
    const sp = await ctxSp.newPage();
    watch(sp, 'speech');
    await sp.goto(URL);
    await startGame(sp);
    await openStudy(sp);
    await sp.waitForFunction(() => document.querySelector('.voice-status').textContent.includes('Fake Arabic'));
    await sp.click('[data-topic=words]');
    await sp.click('.hero .btn-listen');
    await sp.waitForSelector('.hero .btn-listen.is-playing');
    const log1 = await sp.evaluate(() => [...window.__speechLog]);
    check('듣기 → 원문(모음 부호 포함) 그대로 재생, 재생 중 표시', log1.includes('speak:مَرْحَبًا'), log1.join(','));
    await sp.click('.hero .btn-listen');
    await sp.waitForFunction(() => !document.querySelector('.hero .btn-listen.is-playing'));
    check('재생 중 같은 버튼 → 정지', (await sp.evaluate(() => window.__speechLog)).at(-1) === 'cancel');
    await sp.click('.hero .btn-listen');
    await sp.waitForSelector('.hero .btn-listen.is-playing');
    await sp.click('[data-nav=next]');
    await sleep(100);
    check('다음 항목으로 이동하면 이전 음성 정지', !(await sp.$('.btn-listen.is-playing')) && (await sp.evaluate(() => window.__speechLog.at(-1))) === 'cancel');
    await sp.click('.hero .btn-listen');
    await sp.waitForSelector('.hero .btn-listen.is-playing');
    await sp.click('.related__row .btn-listen');
    await sleep(100);
    const states = await sp.evaluate(() => [...document.querySelectorAll('.btn-listen.is-playing')].length);
    check('다른 듣기 버튼 → 이전 음성을 끊고 하나만 재생', states === 1 && !(await sp.evaluate(() => window.__speechLog.includes('OVERLAP'))));
    await sp.keyboard.press('Escape');
    await sleep(50);
    check('공부 메뉴를 닫으면 음성 정지', (await sp.evaluate(() => window.__speechLog.at(-1))) === 'cancel');
    await ctxSp.close();

    // ═════ 5-1. 성별·외형 선택 ═════
    const ctxG = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const gp = await ctxG.newPage();
    watch(gp, 'gender');
    await gp.goto(URL);
    await gp.waitForSelector('#player-name');
    check('성별 선택지는 남/여 두 가지', (await gp.$$eval('input[name=gender]', (els) => els.map((e) => e.value))).join(',') === 'm,f');
    await gp.click('button[type=submit]');
    await sleep(200);
    check('성별을 고르지 않으면 출발할 수 없음', !!(await gp.$('#player-name')) && (await gp.isVisible('.start__error')));
    const previewOf = () => gp.evaluate(() => document.querySelector('.start__preview').toDataURL());
    const pv0 = await previewOf();
    await gp.click('label[for=hair-long]');
    const pv1 = await previewOf();
    await gp.click('label[for=eyes-big]');
    const pv2 = await previewOf();
    check('머리·눈 모양을 바꾸면 미리보기가 바뀜', pv0 !== pv1 && pv1 !== pv2);
    await gp.click('label[for=gender-f]');
    check('성별을 고르면 나를 부르는 형태 안내', (await gp.textContent('.start__form')).includes('كَيْفَ حَالُكِ؟') && !(await gp.isVisible('.start__error')));
    await shot(gp, '07-start-gender');
    await gp.click('button[type=submit]');
    await gp.waitForFunction(() => window.__arabicVillage?.game.scene.isActive('village'));
    await inject(gp);
    await sleep(500);
    const gSaved = await gp.evaluate(() => JSON.parse(localStorage.getItem('arabic-village:v1')).player);
    check('성별·외형 저장', JSON.stringify(gSaved) === JSON.stringify({ gender: 'f', appearance: { hairStyle: 'long', eyes: 'big' } }), JSON.stringify(gSaved));
    // 긴 머리는 얼굴 옆(도트 3,6)까지 내려온다 → 마을 캐릭터 텍스처에 머리색이 찍혀 있어야 한다
    const hairPx = await gp.evaluate(() => {
      const c = window.__arabicVillage.game.textures.getPixel(7, 13, 'player-down-0');
      return c ? [c.red, c.green, c.blue, c.alpha] : null;
    });
    check('고른 머리 모양이 마을 캐릭터에 반영', !!hairPx && hairPx[0] === 0x3b && hairPx[1] === 0x2a && hairPx[2] === 0x20 && hairPx[3] === 255, JSON.stringify(hairPx));
    await moveTo(gp, C(15), C(13));
    await clickWorld(gp, C(17), C(11) - 4);
    await gp.waitForSelector('.convo .entry--npc', { timeout: 20000 });
    await gp.fill('.convo__input', 'مرحبا');
    await gp.click('[data-role=send]');
    await gp.waitForFunction(() => document.querySelectorAll('.convo .entry--npc').length >= 2, null, { timeout: 20000 });
    const fLine = await gp.evaluate(() => [...document.querySelectorAll('.convo .entry--npc .ar--chat')].map((e) => e.textContent).join(' '));
    check('여성 플레이어 → 라일라가 여성형으로 안부 (حَالُكِ)', fLine.includes('كَيْفَ حَالُكِ؟') && !fLine.includes('حَالُكَ'), fLine);
    await gp.click('.convo button[aria-label="대화 설정"]');
    await shot(gp, '08-convo-female');
    await gp.selectOption('.convo .setting:has-text("내 성별") select', 'm');
    const gAfter = await gp.evaluate(() => JSON.parse(localStorage.getItem('arabic-village:v1')).player.gender);
    check('대화 설정에서 성별을 바꾸면 같은 값이 바뀜', gAfter === 'm', gAfter);
    await gp.selectOption('.convo .setting:has-text("내 성별") select', 'f');
    await gp.click('.convo [data-role=close]');
    await gp.reload();
    await gp.waitForSelector('#player-name');
    check('다시 시작할 때 고른 성별·외형 유지', (await gp.isChecked('#gender-f')) && (await gp.isChecked('#hair-long')) && (await gp.isChecked('#eyes-big')));
    await ctxG.close();

    // ═════ 6. 모바일 (터치) ═════
    const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const m = await ctxM.newPage();
    watch(m, 'mobile');
    await m.goto(URL);
    await m.waitForSelector('#player-name');
    await m.fill('#player-name', '민지');
    await pickGender(m, 'f', true);
    await m.tap('button[type=submit]');
    await m.waitForFunction(() => window.__arabicVillage?.game.scene.isActive('village'));
    await inject(m);
    await sleep(500);
    await openStudy(m, true);
    await m.tap('[data-topic=words]');
    await m.waitForSelector('.lesson');
    const layout = await m.evaluate(() => {
      const card = document.querySelector('.study').getBoundingClientRect();
      const btns = [...document.querySelectorAll('.lesson__nav .btn, .hero .btn-listen')].map((b) => b.getBoundingClientRect().height);
      return { left: card.left, right: card.right, vw: innerWidth, docW: document.documentElement.scrollWidth, minBtn: Math.min(...btns) };
    });
    check('모바일: 공부 화면이 화면 안에, 가로 스크롤 없음, 버튼 높이 ≥ 40px', layout.left >= 0 && layout.right <= layout.vw && layout.docW <= layout.vw && layout.minBtn >= 40, JSON.stringify(layout));
    await shot(m, '07-mobile-word');
    await m.tap('[data-nav=next]');
    await m.tap('text=메뉴로');
    await m.tap('[data-topic=review]');
    await m.waitForSelector('.review [data-index]');
    const cols = await m.evaluate(() => getComputedStyle(document.querySelector('.choices')).gridTemplateColumns.split(' ').length);
    check('모바일: 보기가 한 줄에 하나씩', cols === 1);
    await m.tap('.review [data-index="0"]');
    await shot(m, '08-mobile-review');
    await ctxM.close();

    // ═════ 7. 학습 흐름: 빈 복습 → 단원 진행 → 간격 반복(시간 경과) → 전부 학습 ═════
    const ctxL = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctxL.addInitScript(TIME_TRAVEL);
    const L = await ctxL.newPage();
    watch(L, 'learning');
    await L.goto(URL);
    await startGame(L);
    await openStudy(L);
    const reviewSub = () => L.textContent('[data-topic=review] .menu-item__sub');
    check('복습 메뉴: 배운 것이 없으면 먼저 배우라고 안내', (await reviewSub()).includes('먼저 표현을 배워 보세요'));
    await L.click('[data-topic=review]');
    await L.waitForSelector('.review--empty');
    check('빈 복습 화면: 문제 없이 안내만 표시', (await L.textContent('.review--empty')).includes('아직 배운 표현이 없어요') && !(await L.$('.choice')));
    await L.click('.review--empty >> text=새 단어 배우기');
    await L.waitForSelector('.lesson');
    check('빈 복습 → "새 단어 배우기"로 바로 이동', (await L.getAttribute('.ar--hero', 'data-item-id')) === 'w.marhaban');

    // 1단원(인사와 안부)의 단어·문장을 끝까지 배운다
    const unit1 = await L.evaluate(async () => {
      const { itemsOfKind } = await import('/src/learning/content/index.ts');
      const ids = (k) => itemsOfKind(k).map((i) => ({ id: i.id, unit: i.unit }));
      return { words: ids('word'), sentences: ids('sentence') };
    });
    const firstOf = (list) => list.findIndex((i) => i.unit !== 'greetings');
    const u1Words = firstOf(unit1.words);
    const u1Sentences = firstOf(unit1.sentences);
    check('콘텐츠 순서: 단어·문장 목록이 단원 순서대로 정렬', u1Words > 0 && u1Sentences > 0 && unit1.words.slice(u1Words).every((i) => i.unit !== 'greetings') && unit1.sentences.slice(u1Sentences).every((i) => i.unit !== 'greetings'), `words ${u1Words}, sentences ${u1Sentences}`);
    for (let i = 1; i < u1Words; i++) await L.click('[data-nav=next]');
    stats = await statValues(L);
    check('1단원 단어를 다 배워도 문장이 남아 있으면 현재 단원은 1단원', stats[0] === `${u1Words} / 49` && stats[3].includes('1. 인사와 안부'), stats.join(' | '));
    await L.click('text=메뉴로');
    await L.click('[data-topic=sentences]');
    await L.waitForSelector('.lesson');
    for (let i = 1; i < u1Sentences; i++) await L.click('[data-nav=next]');
    stats = await statValues(L);
    const u1Total = u1Words + u1Sentences;
    check('1단원을 모두 배우면 현재 단원이 2단원(자기소개)으로', stats[1] === `${u1Sentences} / 43` && stats[2] === String(u1Total) && stats[3].includes('2. 자기소개'), stats.join(' | '));
    await L.click('text=메뉴로');
    const unitRows = await L.$$eval('.units .unit', (els) => els.map((e) => ({ current: e.classList.contains('unit--current'), now: e.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), max: e.querySelector('[role=progressbar]').getAttribute('aria-valuemax'), fill: e.querySelector('.unit__fill').style.width })));
    check('단원 진행 막대: 1단원 100%, 2단원이 현재 단원', unitRows.length === 4 && unitRows[0].now === unitRows[0].max && unitRows[0].fill === '100%' && !unitRows[0].current && unitRows[1].current && unitRows[1].now === '0', JSON.stringify(unitRows.slice(0, 2)));
    check('복습 메뉴: 복습할 항목 수 표시', (await reviewSub()) === `복습할 항목 ${u1Total}개`);

    /** 복습 한 세트를 키보드 숫자로 푼다. wrongFirst면 첫 문제만 오답. */
    const answerSet = async (wrongFirst = false) => {
      const out = [];
      for (;;) {
        const info = await L.evaluate(() => {
          const sec = document.querySelector('.review[data-question-item]');
          return sec && { item: sec.dataset.questionItem, choices: [...sec.querySelectorAll('[data-index]')].map((b) => b.dataset.itemId) };
        });
        if (!info) break;
        const before = await L.evaluate((id) => __t.rec(id), info.item);
        const answerIdx = info.choices.indexOf(info.item);
        const wrong = wrongFirst && out.length === 0;
        await L.keyboard.press(String((wrong ? (answerIdx + 1) % info.choices.length : answerIdx) + 1));
        await L.waitForSelector('.feedback__title');
        const after = await L.evaluate((id) => __t.rec(id), info.item);
        out.push({ id: info.item, wrong, before, after, title: await L.textContent('.feedback__title') });
        await L.click('[data-role=next]');
      }
      await L.waitForSelector('.review--summary');
      return out;
    };
    const dueNow = () => L.evaluate(() => window.__arabicVillage.learning().stats().dueCount);
    const boxes = () => L.evaluate(() => { const r = window.__arabicVillage.learning(); return r.studiedItems().map((i) => r.get(i.id).box); });

    await L.click('[data-topic=review]');
    await L.waitForSelector('.review [data-index]');
    let set = await answerSet();
    stats = await statValues(L);
    check('키보드 1~4로 답하기 + 복습 시점의 정답 → 단계 0→1, 다음 복습은 10분 뒤', set.length === 8 && set.every((r) => r.title.includes('정답') && r.before.box === 0 && r.after.box === 1 && r.after.dueAt - r.after.lastReviewedAt === 10 * 60_000), JSON.stringify(set[0].after));
    check('맞힌 항목만큼 "복습할 항목"이 줄어듦', stats[2] === String(u1Total - 8), stats.join(' | '));
    const firstSetIds = set.map((r) => r.id);
    await L.click('[data-role=again]');
    set = await answerSet();
    check('다시 풀기: 직전 세트 항목은 뒤로 미룸', set.every((r) => !firstSetIds.includes(r.id)));
    while ((await dueNow()) > 0) {
      await L.click('[data-role=again]');
      set = await answerSet();
    }
    const early = set.filter((r) => r.before.box === 1);
    check('복습 시점 전의 정답은 기록만 하고 단계는 그대로 (몰아서 풀어도 숙달 아님)', early.length > 0 && early.every((r) => r.after.box === 1 && r.after.correct === r.before.correct + 1), `early=${early.length}`);
    check('모두 복습하면 "복습할 항목" 0, 단계는 모두 1', (await statValues(L))[2] === '0' && (await boxes()).every((b) => b === 1));
    await L.click('text=메뉴로');
    check('복습 메뉴: 복습할 항목이 없으면 자유 연습 안내', (await reviewSub()).includes('자유 연습'));

    // 오답 → 단계 한 칸 내림, 곧바로 다시 복습 대상
    await L.click('[data-topic=review]');
    await L.waitForSelector('.review [data-index]');
    set = await answerSet(true);
    const missed = set[0];
    check('오답 → 기록 유지, 단계 1→0, 즉시 복습 대상', missed.after.box === 0 && missed.after.wrong === missed.before.wrong + 1 && missed.after.firstStudiedAt === missed.before.firstStudiedAt && missed.after.dueAt === missed.after.lastReviewedAt, JSON.stringify(missed.after));
    stats = await statValues(L);
    check('오답 1개 → "복습할 항목" 1, 강조 표시', stats[2] === '1' && (await L.$('.stat--due')) !== null, stats.join(' | '));
    const missedRow = await L.textContent('.review--summary');
    check('결과 화면: 틀린 표현을 "다시 볼 표현"으로 보여 줌', missedRow.includes('다시 볼 표현'));

    // 시간 경과: 10분 뒤 → 단계 1 항목이 다시 복습 대상
    await L.evaluate(() => (window.__timeOffset += 10 * 60_000 + 1000));
    await L.keyboard.press('Escape');
    await openStudy(L);
    stats = await statValues(L);
    check('10분 뒤: 단계 1 항목이 모두 다시 복습 대상', stats[2] === String(u1Total) && (await reviewSub()) === `복습할 항목 ${u1Total}개`, stats.join(' | '));
    await L.click('[data-topic=review]');
    await L.waitForSelector('.review [data-index]');
    set = await answerSet();
    check('복습할 항목 중 틀렸던 항목을 먼저 냄', set.some((r) => r.id === missed.id), set.map((r) => r.id).join(','));
    while ((await dueNow()) > 0) {
      await L.click('[data-role=again]');
      set = await answerSet();
    }
    const b2 = await boxes();
    check('두 번째 복습 정답 → 단계 2 (하루 간격), 틀렸던 항목은 1', b2.filter((b) => b === 2).length === u1Total - 1 && b2.filter((b) => b === 1).length === 1, b2.join(''));

    // 하루 뒤 → 단계 3 = 익숙함
    await L.evaluate(() => (window.__timeOffset += 24 * 60 * 60_000 + 1000));
    await L.click('text=메뉴로');
    await L.click('[data-topic=review]');
    await L.waitForSelector('.review [data-index]');
    set = await answerSet();
    while ((await dueNow()) > 0) {
      await L.click('[data-role=again]');
      set = await answerSet();
    }
    const familiar = await L.evaluate(() => window.__arabicVillage.learning().stats().familiarCount);
    const profileL = await L.evaluate(() => window.__arabicVillage.getLearnerProfile().encountered.filter((e) => e.familiarity === 'familiar').length);
    check('하루 뒤 다시 맞히면 "익숙함" (단계 3), 학습자 프로필에도 반영', familiar === u1Total - 1 && profileL === familiar, `familiar=${familiar} profile=${profileL}`);
    await L.click('text=메뉴로');
    await L.click('[data-topic=words]');
    await L.click('[data-nav=prev]');
    const chipText = await L.textContent('.lesson__head .chip-group');
    const chipItem = await L.getAttribute('.ar--hero', 'data-item-id');
    const chipBox = await L.evaluate((id) => __t.rec(id).box, chipItem);
    check('학습 화면 상태 표시: 단계 3 → "익숙함 ⭐", 단계 2 → "연습 중"', chipBox >= 3 ? chipText.includes('익숙함') : chipText.includes('연습 중'), `${chipItem} box=${chipBox} ${chipText}`);

    // 저장한 표현 지우기
    await L.click('text=메뉴로');
    await L.evaluate(() => window.__arabicVillage.learning().savePhrase({ ar: 'مَرْحَبًا!', ko: '안녕하세요!', source: 'practice' }));
    await L.click('[data-topic=phrases]');
    const savedBefore = await L.$$eval('.phrase-list .related__row:not([data-item-id])', (n) => n.length);
    await L.click('.phrase-list .related__row:not([data-item-id]) >> text=지우기');
    const savedAfter = await L.$$eval('.phrase-list .related__row:not([data-item-id])', (n) => n.length);
    const persisted = await L.evaluate(() => JSON.parse(localStorage.getItem('arabic-village:v1')).learning.saved.length);
    check('저장한 표현 지우기 → 목록과 저장 데이터에서 삭제', savedBefore === 1 && savedAfter === 0 && persisted === 0, `${savedBefore}→${savedAfter}, saved=${persisted}`);
    await L.click('text=메뉴로');

    // 전부 배우기 → "모두 학습 완료", 마지막에서 처음으로
    for (const [topic, total] of [['words', 49], ['sentences', 43]]) {
      await L.click(`[data-topic=${topic}]`);
      await L.waitForSelector('.lesson');
      for (;;) {
        const counter = await L.textContent('.lesson__counter');
        if (counter.endsWith(`${total} / ${total}`)) break;
        await L.click('[data-nav=next]');
      }
      await L.click('text=메뉴로');
    }
    stats = await statValues(L);
    const menuSubs = await L.$$eval('.menu-item__sub', (els) => els.map((e) => e.textContent));
    check('모든 단어·문장을 배우면 "모두 학습 완료"', stats[0] === '49 / 49' && stats[1] === '43 / 43' && stats[3].includes('모두 학습 완료') && !(await L.$('.unit--current')), stats.join(' | '));
    check('메뉴: "모두 배웠어요 · 다시 보기"', menuSubs[0].includes('모두 배웠어요') && menuSubs[1].includes('모두 배웠어요'), menuSubs.slice(0, 2).join(' / '));
    await L.click('[data-topic=words]');
    const lastWord = await L.evaluate(() => ({ counter: document.querySelector('.lesson__counter').textContent, next: document.querySelector('[data-nav=next]').textContent, banner: !!document.querySelector('.new-banner') }));
    await L.click('[data-nav=next]');
    const wrapped = await L.evaluate(() => ({ id: document.querySelector('.ar--hero').dataset.itemId, prevDisabled: document.querySelector('[data-nav=prev]').disabled }));
    check('모두 배운 뒤: 마지막으로 보던 곳에서 이어 보기, "처음으로 ↺" → 첫 단어', lastWord.counter.endsWith('49 / 49') && lastWord.next.includes('처음으로') && !lastWord.banner && wrapped.id === 'w.marhaban' && wrapped.prevDisabled, JSON.stringify({ lastWord, wrapped }));
    await ctxL.close();

    check('콘솔/페이지 오류 없음', errors.length === 0, errors.join(' || '));
  } finally {
    await browser.close();
    await server.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
