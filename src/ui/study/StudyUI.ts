import { speech } from '../../audio/speech';
import { learning } from '../../learning';
import { itemsOfKind, type ItemKind } from '../../learning/content';
import { el, korean } from '../dom';
import { closeModal, openModal } from '../modal';
import { isSlowMode, setSlowMode } from '../arabicText';
import { button, type StudyContext } from './common';
import { renderLesson } from './LessonView';
import { renderReview } from './ReviewView';

/**
 * 집 책상의 공부 메뉴 (HTML 오버레이).
 * 위쪽에는 항상 학습 현황(배운 단어·문장 수, 복습할 항목, 현재 단원)을 보여 준다.
 */
export class StudyUI {
  private root: HTMLElement | null = null;
  private statsEl!: HTMLElement;
  private view!: HTMLElement;
  private onLeave: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => boolean) | null = null;

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.close();
      return;
    }
    // 화면별 단축키 (학습: ←/→, 복습: 1~4)
    if (this.keyHandler?.(e)) e.preventDefault();
  };

  get isOpen(): boolean {
    return this.root !== null;
  }

  /** @param onLeave "마을로 돌아가기"를 눌렀을 때 실행 */
  open(onLeave: () => void): void {
    if (this.isOpen) return;
    this.onLeave = onLeave;
    this.statsEl = el('div', { class: 'study__stats', 'aria-live': 'polite' });
    this.view = el('div', { class: 'study__view' });

    const slow = el('input', { type: 'checkbox', id: 'slow-mode' });
    slow.checked = isSlowMode();
    slow.addEventListener('change', () => setSlowMode(slow.checked));

    const card = el(
      'div',
      { class: 'card study' },
      el(
        'header',
        { class: 'study__header' },
        el('h2', { id: 'study-title', class: 'card__title' }, '📖 공부 책상'),
        el('label', { class: 'slow-toggle', for: 'slow-mode' }, slow, '🐢 천천히 듣기'),
        button('✕', () => this.close(), 'btn btn--icon', { 'aria-label': '공부 메뉴 닫기', title: '닫기 (Esc)' }),
      ),
      this.statsEl,
      this.view,
    );
    this.root = el('section', { class: 'overlay overlay--dim', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'study-title' }, card);
    document.getElementById('ui-root')!.append(this.root);
    document.addEventListener('keydown', this.onKey);
    openModal();
    this.renderStats();
    this.renderMenu();
  }

  close(): void {
    if (!this.root) return;
    speech.stop(); // 닫으면 재생 중인 음성도 멈춘다
    this.root.remove();
    this.root = null;
    this.keyHandler = null;
    document.removeEventListener('keydown', this.onKey);
    closeModal();
  }

  private context(): StudyContext {
    return {
      progress: learning(),
      goMenu: () => this.renderMenu(),
      openLesson: (kind) => this.showView(() => renderLesson(this.view, this.context(), kind)),
      openReview: () => this.showView(() => renderReview(this.view, this.context())),
      refreshStats: () => this.renderStats(),
      setKeyHandler: (fn) => (this.keyHandler = fn),
    };
  }

  private showView(render: () => void): void {
    speech.stop();
    this.keyHandler = null;
    render();
    this.view.scrollTop = 0;
    this.root?.querySelector('.study')?.scrollTo({ top: 0 });
  }

  private renderStats(): void {
    const s = learning().stats();
    const chip = (label: string, value: string, cls = '') =>
      el('div', { class: `stat ${cls}`.trim() }, el('span', { class: 'stat__label' }, label), el('span', { class: 'stat__value' }, value));
    this.statsEl.replaceChildren(
      chip('단어', `${s.wordsStudied} / ${s.wordsTotal}`),
      chip('문장', `${s.sentencesStudied} / ${s.sentencesTotal}`),
      chip('복습할 항목', String(s.dueCount), s.dueCount > 0 ? 'stat--due' : ''),
      chip('현재 단원', s.allStudied ? '모두 학습 완료 🎉' : `${s.currentUnit.order}. ${s.currentUnit.titleKo}`, 'stat--unit'),
    );
  }

  private renderMenu(): void {
    this.showView(() => {
      const progress = learning();
      const s = progress.stats();
      const remaining = (kind: ItemKind) => itemsOfKind(kind).filter((i) => !progress.isStudied(i.id)).length;

      const menuItem = (num: number, titleKo: string, titleAr: string, sub: string, onClick: () => void, topic: string) => {
        const b = el(
          'button',
          { type: 'button', class: 'menu-item', 'data-topic': topic },
          el('span', { class: 'menu-item__num' }, String(num)),
          el('span', { class: 'menu-item__main' }, el('span', { class: 'menu-item__ko' }, titleKo), el('span', { class: 'menu-item__sub' }, sub)),
          el('bdi', { lang: 'ar', dir: 'rtl', class: 'menu-item__ar' }, titleAr),
        );
        b.addEventListener('click', onClick);
        return b;
      };
      const ctx = this.context();
      const wordsLeft = remaining('word');
      const sentencesLeft = remaining('sentence');
      const studiedTotal = s.wordsStudied + s.sentencesStudied;

      const units = el(
        'ol',
        { class: 'units' },
        ...s.units.map((u) =>
          el(
            'li',
            { class: `unit${u.unit.id === s.currentUnit.id && !s.allStudied ? ' unit--current' : ''}` },
            el('span', { class: 'unit__title' }, `${u.unit.order}. ${u.unit.titleKo} `, el('bdi', { lang: 'ar', dir: 'rtl', class: 'ar-inline' }, u.unit.titleAr)),
            el('span', { class: 'unit__bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(u.total), 'aria-valuenow': String(u.studied), 'aria-label': `${u.unit.titleKo} 진도` },
              el('span', { class: 'unit__fill', style: `width:${Math.round((u.studied / u.total) * 100)}%` })),
            el('span', { class: 'unit__count' }, `${u.studied}/${u.total}`),
          ),
        ),
      );

      const voiceStatus = el('p', { class: 'voice-status muted small' }, '🔊 아랍어 음성 확인 중…');
      void speechStatusText().then((t) => (voiceStatus.textContent = t));

      this.view.replaceChildren(
        el(
          'section',
          { class: 'study-menu' },
          korean(studiedTotal === 0 ? '처음 오셨군요! 인사말부터 차근차근 배워 볼까요?' : `지금은 "${s.currentUnit.titleKo}" 단원을 배우고 있어요. ${s.currentUnit.goalKo}`, 'ko card__subtitle'),
          el(
            'div',
            { class: 'menu' },
            menuItem(1, '새 단어 배우기', 'كَلِمَاتٌ جَدِيدَةٌ', wordsLeft ? `남은 단어 ${wordsLeft}개` : '모두 배웠어요 · 다시 보기', () => ctx.openLesson('word'), 'words'),
            menuItem(2, '새 문장 배우기', 'جُمَلٌ جَدِيدَةٌ', sentencesLeft ? `남은 문장 ${sentencesLeft}개` : '모두 배웠어요 · 다시 보기', () => ctx.openLesson('sentence'), 'sentences'),
            menuItem(
              3,
              '배운 내용 복습하기',
              'مُرَاجَعَةٌ',
              studiedTotal === 0 ? '먼저 표현을 배워 보세요' : s.dueCount ? `복습할 항목 ${s.dueCount}개` : '복습할 항목이 없어요 · 자유 연습',
              () => ctx.openReview(),
              'review',
            ),
          ),
          el('h3', { class: 'related__title' }, '단원 진행'),
          units,
          voiceStatus,
          el(
            'div',
            { class: 'card__footer' },
            button('책상에서 일어나기', () => this.close(), 'btn'),
            button('마을로 돌아가기', () => {
              const cb = this.onLeave;
              this.close();
              cb?.();
            }, 'btn btn--primary'),
          ),
        ),
      );
      (this.view.querySelector('.menu-item') as HTMLElement | null)?.focus({ preventScroll: true });
    });
  }
}

async function speechStatusText(): Promise<string> {
  const info = await speech.info();
  if (!info.supported) return '🔇 이 브라우저는 음성 출력을 지원하지 않아요. 글자와 발음 표기로 학습할 수 있어요.';
  if (info.voice) return `🔊 아랍어 음성: ${info.voice.name} (${info.voice.lang}) · 기기마다 발음과 음질이 달라요.`;
  if (info.totalVoices === 0) return '🔊 음성 목록을 확인할 수 없어요. 듣기 버튼을 눌러 재생되는지 확인해 보세요.';
  return '🔇 이 기기에는 아랍어 음성이 없어요. 기기 설정에서 아랍어 음성을 추가하면 들을 수 있어요.';
}

export const studyUI = new StudyUI();

