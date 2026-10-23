import { arabic, el, korean } from './dom';
import { openModal, closeModal } from './modal';
import { DEFAULT_PLAYER_NAME, MAX_NAME_LENGTH } from '../game/state';

/** 첫 화면: 이름을 입력받는다. 비워 두면 기본 이름을 쓴다. */
export function showStartScreen(savedName: string | null): Promise<string> {
  return new Promise((resolve) => {
    const input = el('input', {
      id: 'player-name',
      class: 'input',
      type: 'text',
      maxlength: String(MAX_NAME_LENGTH),
      placeholder: DEFAULT_PLAYER_NAME,
      autocomplete: 'off',
      dir: 'auto', // 아랍어 이름을 입력하면 자동으로 오른쪽 정렬
    });
    if (savedName) input.value = savedName;

    const form = el(
      'form',
      { class: 'start__form' },
      el('label', { for: 'player-name', class: 'start__label' }, '이름을 알려 주세요'),
      input,
      el('p', { class: 'start__help' }, `비워 두면 "${DEFAULT_PLAYER_NAME}"(으)로 시작해요.`),
      el('button', { type: 'submit', class: 'btn btn--primary btn--wide' }, '마을로 출발'),
    );

    const screen = el(
      'section',
      { class: 'overlay start', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'start-title' },
      el(
        'div',
        { class: 'card start__card' },
        el('h1', { id: 'start-title', class: 'start__title' }, 'Arabic Village'),
        arabic('قَرْيَةُ اللُّغَةِ الْعَرَبِيَّةِ', 'ar ar--title'),
        korean('아랍어를 배우러 작은 마을에 온 유학생이 되어 보세요.', 'ko start__intro'),
        form,
      ),
    );

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      screen.remove();
      closeModal();
      resolve(input.value);
    });

    openModal();
    document.getElementById('ui-root')!.append(screen);
    input.focus();
  });
}
