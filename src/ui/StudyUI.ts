import { arabic, el, korean } from './dom';
import { openModal, closeModal } from './modal';
import { SAMPLE_SENTENCES, SAMPLE_WORDS, type StudyItem } from '../data/vocabulary';

type Topic = 'words' | 'sentences' | 'review';

interface MenuItem {
  topic: Topic;
  ko: string;
  ar: string;
}

const MENU: MenuItem[] = [
  { topic: 'words', ko: '새 단어 배우기', ar: 'كَلِمَاتٌ جَدِيدَةٌ' },
  { topic: 'sentences', ko: '새 문장 배우기', ar: 'جُمَلٌ جَدِيدَةٌ' },
  { topic: 'review', ko: '배운 내용 복습하기', ar: 'مُرَاجَعَةٌ' },
];

/**
 * 집 책상의 공부 메뉴 (HTML).
 * [임시] 각 항목은 "준비 중" 안내만 보여 준다. 실제 학습·진도는 다음 작업에서 구현한다.
 */
export class StudyUI {
  private root: HTMLElement | null = null;
  private onLeave: (() => void) | null = null;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  get isOpen(): boolean {
    return this.root !== null;
  }

  /** @param onLeave "마을로 돌아가기"를 눌렀을 때 실행 */
  open(onLeave: () => void): void {
    if (this.isOpen) return;
    this.onLeave = onLeave;
    this.root = el('section', { class: 'overlay overlay--dim', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'study-title' });
    document.getElementById('ui-root')!.append(this.root);
    document.addEventListener('keydown', this.onKey);
    openModal();
    this.renderMenu();
  }

  close(): void {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
    document.removeEventListener('keydown', this.onKey);
    closeModal();
  }

  private renderMenu(): void {
    const buttons = MENU.map((item, i) => {
      const btn = el(
        'button',
        { type: 'button', class: 'menu-item', 'data-topic': item.topic },
        el('span', { class: 'menu-item__num' }, String(i + 1)),
        el('span', { class: 'menu-item__ko' }, item.ko),
        el('bdi', { lang: 'ar', dir: 'rtl', class: 'menu-item__ar' }, item.ar),
      );
      btn.addEventListener('click', () => this.renderTopic(item));
      return btn;
    });

    this.show(
      el('h2', { id: 'study-title', class: 'card__title' }, '📖 공부 책상'),
      korean('무엇을 공부할까요?', 'ko card__subtitle'),
      el('div', { class: 'menu' }, ...buttons),
      this.footer(false),
    );
  }

  private renderTopic(item: MenuItem): void {
    let preview: HTMLElement;
    if (item.topic === 'review') {
      preview = korean('아직 배운 내용이 없어요. 단어나 문장을 배우면 여기에서 복습할 수 있어요.', 'ko muted');
    } else {
      const sample = item.topic === 'words' ? SAMPLE_WORDS : SAMPLE_SENTENCES;
      preview = el('div', {}, korean('맛보기로 몇 개만 먼저 보여 드릴게요:', 'ko muted'), this.sampleList(sample));
    }

    this.show(
      el('h2', { id: 'study-title', class: 'card__title' }, item.ko),
      el('p', { class: 'badge' }, '🚧 준비 중'),
      korean('학습 콘텐츠와 진도 기능은 다음 업데이트에서 추가될 예정이에요.', 'ko'),
      preview,
      this.footer(true),
    );
  }

  private sampleList(items: StudyItem[]): HTMLElement {
    return el(
      'ul',
      { class: 'sample-list' },
      ...items.map((it) => el('li', {}, arabic(it.ar, 'ar ar--sample'), korean(it.ko, 'ko ko--sample'))),
    );
  }

  private footer(withBack: boolean): HTMLElement {
    const footer = el('div', { class: 'card__footer' });
    if (withBack) {
      const back = el('button', { type: 'button', class: 'btn' }, '◀ 메뉴로');
      back.addEventListener('click', () => this.renderMenu());
      footer.append(back);
    }
    const stand = el('button', { type: 'button', class: 'btn' }, '책상에서 일어나기');
    stand.addEventListener('click', () => this.close());
    const leave = el('button', { type: 'button', class: 'btn btn--primary' }, '마을로 돌아가기');
    leave.addEventListener('click', () => {
      const cb = this.onLeave;
      this.close();
      cb?.();
    });
    footer.append(stand, leave);
    return footer;
  }

  private show(...children: HTMLElement[]): void {
    if (!this.root) return;
    this.root.replaceChildren(el('div', { class: 'card study' }, ...children));
    this.root.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }
}

export const studyUI = new StudyUI();
