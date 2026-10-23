import { arabic, el, korean } from './dom';
import { openModal, closeModal } from './modal';
import type { DialogueLine, VillagerDef } from '../data/dialogue';

/**
 * 화면 아래쪽 대화창 (HTML).
 * 아랍어 문장은 RTL 문단, 한국어 번역은 LTR 문단으로 분리해 순서가 섞이지 않게 한다.
 */
export class DialogueUI {
  private root: HTMLElement | null = null;
  private index = 0;
  private lines: DialogueLine[] = [];
  private villager!: VillagerDef;
  private playerName = '';
  private onClose: (() => void) | null = null;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
    // 버튼에 포커스가 있으면 Enter/Space는 버튼 클릭으로 처리되므로 중복 진행을 막는다.
    else if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLButtonElement) return;
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.next();
    }
  };

  get isOpen(): boolean {
    return this.root !== null;
  }

  open(villager: VillagerDef, lines: DialogueLine[], playerName: string, onClose?: () => void): void {
    if (this.isOpen) return;
    this.villager = villager;
    this.lines = lines;
    this.playerName = playerName;
    this.index = 0;
    this.onClose = onClose ?? null;
    this.root = el('section', { class: 'dialogue', role: 'dialog', 'aria-label': `${villager.nameKo}와(과)의 대화` });
    document.getElementById('ui-root')!.append(this.root);
    document.addEventListener('keydown', this.onKey);
    openModal();
    this.render();
  }

  next(): void {
    if (!this.root) return;
    if (this.index >= this.lines.length - 1) {
      this.close();
      return;
    }
    this.index++;
    this.render();
  }

  close(): void {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
    document.removeEventListener('keydown', this.onKey);
    closeModal();
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }

  private render(): void {
    if (!this.root) return;
    const line = this.lines[this.index];
    const isLast = this.index === this.lines.length - 1;

    // 이름표: 이름은 <bdi>로 감싸 주변 텍스트 방향의 영향을 받지 않게 한다.
    const speaker =
      line.speaker === 'villager'
        ? el(
            'div',
            { class: 'dialogue__speaker' },
            el('bdi', { lang: 'ar', dir: 'rtl', class: 'name-ar' }, this.villager.nameAr),
            el('span', { class: 'name-ko' }, this.villager.nameKo),
          )
        : el(
            'div',
            { class: 'dialogue__speaker dialogue__speaker--player' },
            el('bdi', { class: 'name-player' }, this.playerName),
            el('span', { class: 'name-ko' }, '(나)'),
          );

    const body = el('div', { class: 'dialogue__body' }, arabic(line.ar, 'ar ar--line'), korean(line.ko, 'ko ko--line'));

    if (line.note) {
      const examples = line.note.examples.map((ex) =>
        el('li', {}, el('span', { class: 'note__label' }, ex.label), el('bdi', { lang: 'ar', dir: 'rtl', class: 'ar ar--inline' }, ex.ar)),
      );
      body.append(
        el('aside', { class: 'note', lang: 'ko' }, el('p', {}, `💡 ${line.note.text}`), el('ul', { class: 'note__examples' }, ...examples)),
      );
    }

    const nextBtn = el('button', { type: 'button', class: 'btn btn--primary' }, isLast ? '대화 마치기' : '다음 ▶');
    nextBtn.addEventListener('click', () => this.next());
    const closeBtn = el('button', { type: 'button', class: 'btn' }, '닫기');
    closeBtn.addEventListener('click', () => this.close());

    const footer = el(
      'div',
      { class: 'dialogue__footer' },
      el('span', { class: 'dialogue__progress' }, `${this.index + 1} / ${this.lines.length}`),
      el('div', { class: 'dialogue__buttons' }, closeBtn, nextBtn),
    );

    this.root.replaceChildren(speaker, body, footer);
    nextBtn.focus({ preventScroll: true });
  }
}

export const dialogueUI = new DialogueUI();
