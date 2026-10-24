import { speech } from '../../audio/speech';
import { browserSttSupported, recorderSupported, STT_MESSAGES, VoiceInput, type SttEngine } from '../../audio/recognizer';
import { getHealth, submitAccessCode, type ServerHealth } from '../../conversation/client';
import { forgetFact, friendshipLevel } from '../../conversation/memory';
import { ConversationSession, type Entry } from '../../conversation/session';
import { getNpcRecord, getPlayerGender, getSettings, persist, resetNpcRecord, setPlayerGender, updateSettings } from '../../game/state';
import { learning } from '../../learning';
import { getItem } from '../../learning/content';
import type { ArabicLine, MemoryFact, NpcReply } from '../../shared/conversation';
import { LIMITS } from '../../shared/conversation';
import { splitSentences } from '../../shared/sentences';
import { listenButton, mixedText, newSpeechKey, reportSpeech } from '../arabicText';
import { el } from '../dom';
import { closeModal, openModal } from '../modal';
import { showToast } from '../toast';
import { arabicKeyboard } from './ArabicKeyboard';

export interface NpcInfo {
  id: string;
  nameAr: string;
  nameKo: string;
}

const KIND_LABEL: Record<MemoryFact['kind'], string> = {
  name: '이름', origin: '출신', likes: '좋아하는 것', dislikes: '싫어하는 것', interest: '관심사', promise: '약속', fact: '알려 준 사실',
};

const btn = (label: string, onClick: () => void, cls = 'btn', attrs: Record<string, string> = {}) => {
  const b = el('button', { type: 'button', class: cls, ...attrs }, label);
  b.addEventListener('click', onClick);
  return b;
};

/** 아랍어 줄: 문장마다 눌러서 들을 수 있다 (표시 순서 = 재생 순서) */
function arabicSentences(text: string, cls = 'ar ar--chat'): HTMLElement {
  const p = el('p', { class: cls, lang: 'ar', dir: 'rtl' });
  splitSentences(text).forEach((s, i) => {
    if (i > 0) p.append(' ');
    const key = newSpeechKey();
    const b = el('button', { type: 'button', class: 'sent', 'data-speech-key': key, title: '이 문장 듣기' }, s);
    b.addEventListener('click', async () => reportSpeech(await speech.speak(s, key)));
    p.append(b);
  });
  return p;
}

function lineBlock(line: ArabicLine, listen = true): HTMLElement {
  return el(
    'div',
    { class: 'line' },
    el('div', { class: 'line__ar' }, arabicSentences(line.ar, 'ar ar--line-sm'), ...(listen ? [listenButton(splitSentences(line.ar), { small: true })] : [])),
    el('p', { class: 'ko ko--row', lang: 'ko' }, line.ko + (line.translit ? `  ·  ${line.translit}` : '')),
  );
}

/**
 * 라일라와의 자유 회화 창 (HTML).
 * 텍스트 입력·화면 자판·음성 입력, 단계별 힌트, 문장별 듣기, 교정, 기억/친밀도 표시를 제공한다.
 */
export class ConversationUI {
  private root: HTMLElement | null = null;
  private session: ConversationSession | null = null;
  private npc!: NpcInfo;
  private health: ServerHealth | null = null;
  private voice = new VoiceInput();
  private viaVoice = false;
  private renderedCount = 0;
  private unsub: (() => void) | null = null;
  // DOM
  private log!: HTMLElement;
  private input!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private micBtn!: HTMLButtonElement;
  private sttStatus!: HTMLElement;
  private hintBar!: HTMLElement;
  private hintPanel!: HTMLElement;
  private headInfo!: HTMLElement;
  private modeBadge!: HTMLElement;
  private settingsPanel!: HTMLElement;
  private kb!: HTMLElement;

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!this.settingsPanel.hidden) this.settingsPanel.hidden = true;
      else this.close();
    }
  };

  get isOpen(): boolean {
    return this.root !== null;
  }

  open(npc: NpcInfo): void {
    if (this.isOpen) return;
    this.npc = npc;
    this.session = new ConversationSession(npc.id);
    this.renderedCount = 0;
    this.build();
    openModal();
    document.addEventListener('keydown', this.onKey);
    this.unsub = this.session.onChange(() => this.update());
    void getHealth().then((h) => {
      this.health = h;
      this.updateMic();
    });
    void this.session.open();
    this.update();
  }

  close(): void {
    if (!this.root) return;
    this.session?.close();
    this.voice.cancel();
    speech.stop();
    this.unsub?.();
    this.root.remove();
    this.root = null;
    this.session = null;
    document.removeEventListener('keydown', this.onKey);
    closeModal();
  }

  // ── 구성 ─────────────────────────────────────────

  private build(): void {
    this.headInfo = el('span', { class: 'convo__rel' });
    this.modeBadge = el('span', { class: 'mode-badge' });
    this.log = el('div', { class: 'convo__log', 'aria-live': 'polite' });
    this.hintPanel = el('div', { class: 'hint-panel', hidden: '' });
    this.hintBar = el('div', { class: 'hint-bar' });
    this.sttStatus = el('div', { class: 'stt-status', 'aria-live': 'polite' });

    this.input = el('textarea', {
      class: 'convo__input',
      rows: '1',
      dir: 'auto',
      lang: 'ar',
      maxlength: String(LIMITS.playerText),
      placeholder: '아랍어로 말해 보세요 (예: مرحبا)',
      'aria-label': '라일라에게 할 말',
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        void this.send();
      }
    });
    this.input.addEventListener('input', () => {
      this.sendBtn.disabled = !this.input.value.trim() || !!this.session?.state.pending;
    });

    this.sendBtn = btn('보내기', () => void this.send(), 'btn btn--primary convo__send', { 'data-role': 'send' });
    this.sendBtn.disabled = true;
    this.micBtn = btn('🎤', () => void this.toggleMic(), 'btn convo__mic', { 'aria-label': '음성으로 말하기', title: '음성으로 말하기' });
    this.kb = el('div', { class: 'convo__kb', hidden: '' }, arabicKeyboard(this.input));
    const kbBtn = btn('ا ب', () => {
      this.kb.hidden = !this.kb.hidden;
      kbBtn.setAttribute('aria-pressed', String(!this.kb.hidden));
    }, 'btn convo__kbtoggle', { 'aria-label': '아랍어 화면 자판', title: '아랍어 화면 자판', 'aria-pressed': 'false' });

    this.settingsPanel = el('div', { class: 'convo__settings', hidden: '' });

    this.root = el(
      'section',
      { class: 'convo', role: 'dialog', 'aria-label': `${this.npc.nameKo}와(과)의 대화` },
      el(
        'header',
        { class: 'convo__head' },
        el('span', { class: 'dialogue__speaker' }, el('bdi', { lang: 'ar', dir: 'rtl', class: 'name-ar' }, this.npc.nameAr), el('span', { class: 'name-ko' }, this.npc.nameKo)),
        this.headInfo,
        this.modeBadge,
        btn('설정', () => this.toggleSettings(), 'btn btn--small', { 'aria-label': '대화 설정', title: '대화 설정' }),
        btn('✕', () => this.close(), 'btn btn--icon', { 'aria-label': '대화 닫기', title: '닫기 (Esc)', 'data-role': 'close' }),
      ),
      this.settingsPanel,
      this.log,
      this.hintBar,
      this.hintPanel,
      this.sttStatus,
      el('div', { class: 'convo__inputrow' }, this.input, kbBtn, this.micBtn, this.sendBtn),
      this.kb,
    );
    document.getElementById('ui-root')!.append(this.root);
    this.renderPreviousTalk();
    this.input.focus({ preventScroll: true });
  }

  /** 지난번 대화의 마지막 몇 줄을 흐리게 보여 준다 (기억이 이어진다는 느낌) */
  private renderPreviousTalk(): void {
    const recent = getNpcRecord(this.npc.id).recent.slice(-4);
    if (recent.length === 0) return;
    this.log.append(
      el(
        'div',
        { class: 'prev-talk' },
        el('p', { class: 'muted small' }, '지난 대화'),
        ...recent.map((t) => el('p', { class: `prev-talk__line prev-talk__line--${t.role}`, dir: 'auto', lang: 'ar' }, t.text)),
      ),
    );
  }

  // ── 갱신 ─────────────────────────────────────────

  private update(): void {
    if (!this.root || !this.session) return;
    const st = this.session.state;
    const rel = getNpcRecord(this.npc.id);
    const lv = friendshipLevel(rel.friendship);
    this.headInfo.textContent = `💛 ${lv.label} (${rel.friendship}${lv.next ? `/${lv.next}` : ''})`;
    this.modeBadge.className = `mode-badge mode-badge--${st.mode ?? 'loading'}`;
    this.modeBadge.textContent = st.mode === 'ai' ? '🤖 실제 AI' : st.mode === 'practice' ? '🧩 연습 모드 (모의)' : st.mode === 'offline' ? '📴 오프라인 연습 (모의)' : '연결 확인 중…';
    this.modeBadge.title = st.modeDetail;
    this.modeBadge.dataset.mode = st.mode ?? '';

    // 항목 렌더링 (오류 항목이 지워지면 전체 다시 그리기)
    const entries = st.entries;
    if (entries.length < this.renderedCount) {
      this.log.querySelectorAll('.entry').forEach((n) => n.remove());
      this.renderedCount = 0;
    }
    for (let i = this.renderedCount; i < entries.length; i++) {
      const node = this.renderEntry(entries[i], i === entries.length - 1);
      if (node) this.log.append(node);
    }
    this.renderedCount = entries.length;

    this.log.querySelector('.typing')?.remove();
    if (st.pending) this.log.append(el('div', { class: 'entry typing', role: 'status' }, el('span', { class: 'typing__dots' }, '•••'), ` ${this.npc.nameKo}가 생각하는 중…`));
    this.log.scrollTop = this.log.scrollHeight;

    this.sendBtn.disabled = st.pending || !this.input.value.trim();
    this.renderHintBar(st.hint);
  }

  private renderEntry(e: Entry, isLatest: boolean): HTMLElement | null {
    switch (e.kind) {
      case 'player':
        return el(
          'div',
          { class: 'entry entry--player' },
          el('p', { class: 'bubble bubble--player', dir: 'auto', lang: 'ar' }, e.text),
          ...(e.viaVoice ? [el('span', { class: 'muted small' }, '🎤 음성 입력')] : []),
        );
      case 'notice':
        return el('p', { class: `entry notice notice--${e.tone}` }, e.text);
      case 'memory':
        return el(
          'div',
          { class: 'entry notice notice--memory' },
          el('span', {}, `🧠 ${this.npc.nameKo}가 기억했어요: `),
          ...e.facts.map((f) => el('span', { class: 'fact-chip' }, `${KIND_LABEL[f.kind]} — `, el('bdi', { dir: 'auto' }, f.value))),
        );
      case 'error':
        return this.renderError(e);
      case 'npc':
        return this.renderNpc(e.reply, e.heardIds, isLatest);
    }
  }

  private renderError(e: Extract<Entry, { kind: 'error' }>): HTMLElement {
    const box = el('div', { class: 'entry error-box', role: 'alert' }, el('p', {}, `⚠ ${e.message}`));
    if (e.failure === 'not_configured') {
      box.append(el('p', { class: 'muted small' }, '설정 방법: 서버 환경 변수 ANTHROPIC_API_KEY를 넣고 서버를 다시 시작하세요 (README의 "AI 설정").'));
    }
    box.append(
      el(
        'div',
        { class: 'error-box__actions' },
        btn('다시 시도', () => void this.session?.retry(), 'btn btn--primary', { 'data-role': 'retry' }),
        ...(e.canPractice ? [btn('연습 모드(모의)로 계속', () => void this.session?.switchToPractice(), 'btn', { 'data-role': 'practice' })] : []),
      ),
    );
    return box;
  }

  private renderNpc(reply: NpcReply, heardIds: string[], isLatest: boolean): HTMLElement {
    const sentences = splitSentences(reply.reply.ar);
    const listenAll = listenButton(sentences, { small: true, title: '전체 듣기 (다시 누르면 정지)' });
    const bubble = el(
      'div',
      { class: 'bubble bubble--npc' },
      el('div', { class: 'bubble__ar' }, arabicSentences(reply.reply.ar), listenAll),
      el('p', { class: 'ko ko--line', lang: 'ko' }, reply.reply.ko),
    );
    if (reply.reply.translit) {
      const tr = el('details', { class: 'translit-toggle' }, el('summary', {}, '발음 보기'), el('p', { class: 'translit', dir: 'ltr' }, reply.reply.translit));
      bubble.append(tr);
    }
    if (reply.correction) {
      bubble.append(
        el(
          'div',
          { class: 'correction' },
          el('p', { class: 'correction__title' }, '💬 이렇게 말하면 더 자연스러워요'),
          el('p', { class: 'muted small' }, '내가 한 말: ', el('bdi', { dir: 'auto', lang: 'ar' }, reply.correction.playerSaid)),
          lineBlock(reply.correction.better),
          mixedText(reply.correction.explanationKo, 'small'),
        ),
      );
    }
    if (reply.diacriticsWarning?.length) {
      bubble.append(el('p', { class: 'warn small' }, '⚠ 자동 검사에서 모음 부호가 확실하지 않은 부분이 있어요. (AI가 만든 문장, 원어민 검수 전)'));
    }

    const progress = learning();
    const studied = heardIds.filter((id) => progress.isStudied(id));
    const fresh = heardIds.filter((id) => !progress.isStudied(id));
    const tags = el('div', { class: 'bubble__tags' });
    tags.append(el('span', { class: `src-tag src-tag--${reply.source}` }, reply.source === 'ai' ? `AI · ${reply.model ?? reply.provider}` : '연습 상대(모의)'));
    if (studied.length) tags.append(el('span', { class: 'learned-tag learned-tag--done' }, `📘 배운 표현 ${studied.length}개`));
    if (fresh.length) {
      tags.append(
        el('span', { class: 'learned-tag', title: fresh.map((id) => getItem(id)?.ko ?? id).join(', ') }, `📗 새 표현 ${fresh.length}개 — 책상에서 배울 수 있어요`),
      );
    }
    const saveBtn = btn(progress.isSaved(reply.reply.ar) ? '✓ 저장됨' : '📌 표현 저장', () => {
      const ok = progress.savePhrase({ ar: reply.reply.ar, ko: reply.reply.ko, translit: reply.reply.translit, source: reply.source, uncertain: !!reply.diacriticsWarning?.length });
      saveBtn.textContent = '✓ 저장됨';
      if (ok) showToast('책상의 "대화에서 만난 표현"에 저장했어요.');
    }, 'btn btn--ghost btn--tiny', { 'data-role': 'save-phrase' });
    tags.append(saveBtn);
    bubble.append(tags);

    const node = el('div', { class: 'entry entry--npc', 'data-source': reply.source }, bubble);
    if (isLatest && getSettings().autoplay) {
      // 화면에 나온 순서대로 자동 재생 (실패해도 조용히 넘어간다: 버튼으로 다시 들을 수 있음)
      setTimeout(() => {
        const key = listenAll.dataset.speechKey!;
        if (this.root && speech.currentKey === null) void speech.speakSequence(sentences, key);
      }, 50);
    }
    return node;
  }

  // ── 힌트 ─────────────────────────────────────────

  private hintFor: NpcReply['hint'] | null = null;

  private renderHintBar(hint: NpcReply['hint'] | null): void {
    if (hint === this.hintFor) return;
    this.hintFor = hint;
    this.hintPanel.hidden = true;
    this.hintPanel.replaceChildren();
    if (!hint) {
      this.hintBar.replaceChildren();
      return;
    }
    const show = (which: 'words' | 'context' | 'model', b: HTMLButtonElement) => {
      this.hintBar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      this.hintPanel.hidden = false;
      if (which === 'words') {
        this.hintPanel.replaceChildren(
          el('p', { class: 'hint-panel__title' }, '🔤 쓸 수 있는 단어'),
          el('div', { class: 'hint-words' }, ...hint.words.map((w) => lineBlock(w))),
        );
      } else if (which === 'context') {
        this.hintPanel.replaceChildren(el('p', { class: 'hint-panel__title' }, '🧭 상황 설명'), mixedText(hint.contextKo || '편하게 대답해 보세요.'));
      } else {
        const use = btn('입력창에 넣기', () => {
          this.input.value = hint.model.ar.replace('…', '').trim() + (hint.model.ar.includes('…') ? ' ' : '');
          this.viaVoice = false;
          this.input.dispatchEvent(new Event('input'));
          this.input.focus();
        }, 'btn btn--tiny');
        this.hintPanel.replaceChildren(
          el('p', { class: 'hint-panel__title' }, '✨ 모범 답변 (하나의 예시일 뿐, 다른 표현도 좋아요)'),
          lineBlock(hint.model),
          ...(hint.alternatives.length
            ? [el('p', { class: 'muted small' }, '다른 표현: '), ...hint.alternatives.map((a) => el('div', { class: 'line__ar' }, arabicSentences(a, 'ar ar--line-sm'), listenButton(splitSentences(a), { small: true })))]
            : []),
          use,
        );
      }
    };
    const mk = (label: string, which: 'words' | 'context' | 'model') => {
      const b = btn(label, () => (b.getAttribute('aria-pressed') === 'true' ? this.hideHint() : show(which, b)), 'btn btn--tiny hint-btn', { 'aria-pressed': 'false', 'data-hint': which });
      return b;
    };
    this.hintBar.replaceChildren(
      el('span', { class: 'muted small' }, '도움이 필요하면:'),
      mk('🔤 단어 힌트', 'words'),
      mk('🧭 상황 설명', 'context'),
      mk('✨ 모범 답변', 'model'),
    );
  }

  private hideHint(): void {
    this.hintPanel.hidden = true;
    this.hintBar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
  }

  // ── 보내기 ─────────────────────────────────────────

  private async send(): Promise<void> {
    if (!this.session || this.session.state.pending) return;
    const text = this.input.value.trim();
    if (!text) return;
    if (this.voice.active) this.voice.cancel();
    speech.stop();
    const via = this.viaVoice;
    this.input.value = '';
    this.viaVoice = false;
    this.sttStatus.replaceChildren();
    this.hideHint();
    await this.session.send(text, via);
  }

  // ── 음성 입력 ─────────────────────────────────────────

  private sttEngine(): SttEngine | null {
    const pref = getSettings().sttEngine;
    const server = !!this.health?.stt && recorderSupported();
    const browser = browserSttSupported();
    if (pref === 'off') return null;
    if (pref === 'server') return server ? 'server' : null;
    if (pref === 'browser') return browser ? 'browser' : null;
    return server ? 'server' : browser ? 'browser' : null;
  }

  private updateMic(): void {
    const engine = this.sttEngine();
    // 누를 수 없을 때도 버튼은 활성으로 두고, 누르면 이유를 안내한다.
    this.micBtn.classList.toggle('is-unavailable', engine === null);
    this.micBtn.title = engine ? `음성으로 말하기 (${engine === 'server' ? '서버 인식' : '브라우저 인식'})` : '음성 입력을 쓸 수 없어요';
  }

  private async toggleMic(): Promise<void> {
    if (this.voice.active) {
      this.voice.stop();
      return;
    }
    const engine = this.sttEngine();
    if (!engine) {
      const why = getSettings().sttEngine === 'off' ? '설정에서 음성 입력을 껐어요.' : '이 브라우저/서버에서는 음성 인식을 쓸 수 없어요. (서버 음성 인식 미설정 + 브라우저 인식 미지원)';
      this.status(`🎤 ${why} 키보드나 화면 자판(ا ب 버튼)으로 입력해 주세요.`);
      return;
    }
    if (!getSettings().sttConsent) {
      this.askConsent(engine);
      return;
    }
    speech.stop(); // 내 목소리 대신 스피커 소리가 녹음되지 않게
    const level = el('span', { class: 'level' }, el('span', { class: 'level__bar' }));
    const cancel = btn('취소', () => this.voice.cancel(), 'btn btn--tiny');
    const result = await this.voice.start(
      engine,
      {
        onState: (s) => {
          this.micBtn.classList.toggle('is-recording', s === 'listening');
          this.micBtn.textContent = s === 'listening' ? '■' : '🎤';
          this.micBtn.setAttribute('aria-label', s === 'listening' ? '말하기 끝내기' : '음성으로 말하기');
          if (s === 'requesting') this.status('🎤 마이크를 준비하는 중… (처음이면 권한을 허용해 주세요)');
          if (s === 'listening') this.status('🎙 듣는 중… 다 말했으면 ■ 버튼을 누르세요.', level, cancel);
          if (s === 'processing') this.status('⏳ 아랍어로 바꾸는 중…', cancel);
        },
        onLevel: (v) => ((level.firstElementChild as HTMLElement).style.width = `${Math.round(v * 100)}%`),
        onInterim: (t) => {
          this.input.value = t;
        },
      },
      (import.meta.env?.BASE_URL as string | undefined) ?? '/',
    );
    this.micBtn.classList.remove('is-recording');
    this.micBtn.textContent = '🎤';
    if (!this.root) return;
    if (result.ok) {
      this.input.value = result.text;
      this.viaVoice = true;
      this.input.dispatchEvent(new Event('input'));
      this.status('✅ 인식 결과를 확인하고, 필요하면 고친 뒤 [보내기]를 누르세요.');
      this.input.focus();
    } else if (result.reason === 'cancelled') {
      this.status('');
    } else {
      const again = btn('다시 말하기', () => void this.toggleMic(), 'btn btn--tiny');
      this.status(`🎤 ${STT_MESSAGES[result.reason]}`, again);
    }
  }

  private askConsent(engine: SttEngine): void {
    const where =
      engine === 'server'
        ? `녹음한 음성은 텍스트로 바꾸기 위해 서버를 거쳐 음성 인식 서비스(${this.health?.stt?.host ?? '설정된 공급자'})로 전송돼요.`
        : '브라우저 음성 인식은 브라우저 제조사(예: Chrome은 Google)의 서버로 음성을 보낼 수 있어요.';
    const ok = btn('동의하고 말하기', () => {
      updateSettings({ sttConsent: true });
      this.status('');
      void this.toggleMic();
    }, 'btn btn--primary btn--tiny', { 'data-role': 'stt-consent' });
    this.status(`🔒 ${where} 게임은 녹음 파일을 저장하지 않아요. 원하지 않으면 키보드로 계속할 수 있어요.`, ok, btn('키보드로 할게요', () => this.status(''), 'btn btn--tiny'));
  }

  private status(text: string, ...extra: HTMLElement[]): void {
    this.sttStatus.replaceChildren(...(text ? [el('span', {}, text), ...extra] : []));
  }

  // ── 설정 ─────────────────────────────────────────

  private toggleSettings(): void {
    this.settingsPanel.hidden = !this.settingsPanel.hidden;
    if (!this.settingsPanel.hidden) this.renderSettings();
  }

  /** 초대 코드 입력 (서버가 초대 코드를 요구할 때만) */
  private accessSetting(h: ServerHealth | null): HTMLElement[] {
    if (!h?.online || h.access === 'open') return [];
    if (h.access === 'granted') return [el('p', { class: 'muted small', 'data-role': 'access-ok' }, '초대 코드: 확인됨 (실제 AI·서버 음성 사용 가능)')];
    const input = el('input', { type: 'password', autocomplete: 'off', placeholder: '초대 코드', 'aria-label': '초대 코드', 'data-role': 'access-code' }) as HTMLInputElement;
    const submit = async () => {
      const code = input.value.trim();
      if (!code) return;
      const r = await submitAccessCode(code);
      if (r === 'ok') {
        this.health = await getHealth();
        this.updateMic();
        showToast('초대 코드를 확인했어요. 대화창을 다시 열면 실제 AI와 대화해요.', 3600);
        this.renderSettings();
      } else {
        showToast(r === 'wrong' ? '초대 코드가 맞지 않아요.' : '서버에 연결하지 못했어요. 잠시 후 다시 해 주세요.', 3000);
      }
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') void submit();
    });
    return [
      el(
        'label',
        { class: 'setting' },
        el('span', {}, '초대 코드 (실제 AI 대화·서버 음성을 쓰려면 필요)'),
        input,
        btn('확인', () => void submit(), 'btn btn--tiny btn--primary', { 'data-role': 'access-submit' }),
      ),
    ];
  }

  private renderSettings(): void {
    const s = getSettings();
    const select = <T extends string>(label: string, value: T, options: [T, string][], onChange: (v: T) => void) => {
      const sel = el('select', {}) as HTMLSelectElement;
      for (const [v, l] of options) {
        const o = el('option', { value: v }, l);
        if (v === value) o.selected = true;
        sel.append(o);
      }
      sel.addEventListener('change', () => onChange(sel.value as T));
      return el('label', { class: 'setting' }, el('span', {}, label), sel);
    };
    const check = (label: string, value: boolean, onChange: (v: boolean) => void) => {
      const c = el('input', { type: 'checkbox' }) as HTMLInputElement;
      c.checked = value;
      c.addEventListener('change', () => onChange(c.checked));
      return el('label', { class: 'setting setting--check' }, c, el('span', {}, label));
    };
    const rel = getNpcRecord(this.npc.id);
    const facts = rel.facts.length
      ? el(
          'ul',
          { class: 'fact-list' },
          ...rel.facts.map((f) =>
            el('li', {}, el('span', {}, `${KIND_LABEL[f.kind]}: `), el('bdi', { dir: 'auto' }, f.value), btn('잊게 하기', () => {
              forgetFact(rel, f);
              persist();
              this.renderSettings();
            }, 'btn btn--tiny btn--ghost')),
          ),
        )
      : el('p', { class: 'muted small' }, '아직 기억하는 것이 없어요. 대화에서 직접 말해 준 것만 기억해요.');

    const h = this.health;
    this.settingsPanel.replaceChildren(
      el('h3', { class: 'related__title' }, '대화 설정'),
      select('내 성별 (라일라가 나를 부르는 말)', getPlayerGender(), [['m', '남성 (أَنْتَ · حَالُكَ)'], ['f', '여성 (أَنْتِ · حَالُكِ)']], (v) => setPlayerGender(v)),
      check('주민 대사 자동으로 듣기', s.autoplay, (v) => updateSettings({ autoplay: v })),
      check('🐢 천천히 듣기', s.slow, (v) => updateSettings({ slow: v })),
      select('음성 출력', s.ttsEngine, [['auto', '자동 (브라우저 → 음성 파일)'], ['browser', '브라우저 음성만'], ['audio', '음성 파일·서버 음성만']], (v) => updateSettings({ ttsEngine: v })),
      select('음성 입력', s.sttEngine, [['auto', '자동'], ['server', '서버 인식'], ['browser', '브라우저 인식'], ['off', '끄기 (키보드만)']], (v) => {
        updateSettings({ sttEngine: v });
        this.updateMic();
      }),
      el(
        'p',
        { class: 'muted small' },
        `연결 상태 — 대화: ${h?.online ? (h.chat?.provider === 'anthropic' ? `실제 AI (${h.chat.model})` : h.access === 'required' ? '연습 모드(모의, 초대 코드 없음)' : '연습 모드(모의, AI 키 없음)') : '서버 없음(오프라인 연습)'} · ` +
          `서버 음성: ${h?.tts.length ? h.tts.join(', ') : '없음'} · 서버 음성 인식: ${h?.stt ? h.stt.provider : '없음'} · ` +
          `브라우저 인식: ${browserSttSupported() ? '지원' : '미지원'} · 최근 재생 엔진: ${speech.lastEngine ?? '-'}`,
      ),
      ...this.accessSetting(h),
      el('h3', { class: 'related__title' }, `${this.npc.nameKo}가 기억하는 것`),
      facts,
      el(
        'div',
        { class: 'card__footer' },
        btn('대화 기록 지우기', () => {
          rel.recent = [];
          rel.topics = [];
          persist();
          showToast('최근 대화 기록을 지웠어요. (기억과 친밀도는 유지)');
        }, 'btn btn--tiny'),
        btn('기억·관계 모두 초기화', () => {
          if (!confirm(`${this.npc.nameKo}의 기억과 친밀도를 모두 초기화할까요? (학습 진도는 그대로예요)`)) return;
          resetNpcRecord(this.npc.id);
          this.renderSettings();
          this.update();
        }, 'btn btn--tiny'),
        btn('닫기', () => (this.settingsPanel.hidden = true), 'btn btn--tiny btn--primary'),
      ),
    );
  }
}

export const conversationUI = new ConversationUI();
