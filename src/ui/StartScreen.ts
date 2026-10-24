import { arabic, el, korean } from './dom';
import { openModal, closeModal } from './modal';
import { DEFAULT_PLAYER_NAME, MAX_NAME_LENGTH, type PlayerProfile } from '../game/state';
import { drawPerson, EYE_STYLES, HAIR_STYLES, playerLook, type Appearance } from '../game/art/person';
import type { Gender } from '../shared/conversation';

export interface StartChoice {
  name: string;
  gender: Gender;
  appearance: Appearance;
}

const GENDERS: { id: Gender; ko: string; ar: string }[] = [
  { id: 'm', ko: '남성', ar: 'كَيْفَ حَالُكَ؟' },
  { id: 'f', ko: '여성', ar: 'كَيْفَ حَالُكِ؟' },
];

/** 미리보기 배율: 16x16 도트 → 64x64 캔버스 */
const PREVIEW_SCALE = 4;

/**
 * 첫 화면: 이름, 성별, 외형(머리·눈 모양)을 고른다.
 * 이름은 비워 두면 기본 이름을 쓰고, 성별은 반드시 골라야 한다(주민이 나를 부르는 말이 달라진다).
 */
export function showStartScreen(savedName: string | null, saved: PlayerProfile): Promise<StartChoice> {
  return new Promise((resolve) => {
    let gender: Gender | null = saved.gender;
    const appearance: Appearance = { ...saved.appearance };

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

    const canvas = el('canvas', { class: 'start__preview', width: String(16 * PREVIEW_SCALE), height: String(16 * PREVIEW_SCALE), 'aria-hidden': 'true' });
    const redraw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const painter = {
        fillStyle: (color: number, alpha = 1) => {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        },
        fillRect: (x: number, y: number, w: number, h: number) => ctx.fillRect(x, y, w, h),
      };
      drawPerson(painter, 'down', 0, playerLook(appearance), PREVIEW_SCALE);
    };

    const genderError = el('p', { class: 'start__error', role: 'alert', hidden: '' }, '성별을 골라 주세요.');
    const genderHint = korean('', 'start__help');
    const updateGenderHint = () => {
      const g = GENDERS.find((x) => x.id === gender);
      genderHint.replaceChildren(
        g ? `라일라가 나에게 "어떻게 지내?"라고 물을 때: ` : '아랍어는 상대의 성별에 따라 부르는 말이 달라요. 라일라가 이 성별로 나를 불러요.',
        ...(g ? [el('bdi', { lang: 'ar', dir: 'rtl', class: 'ar-inline' }, g.ar)] : []),
      );
    };

    /** 하나만 고르는 버튼 묶음 (라디오 버튼) */
    const choiceGroup = <T extends string>(name: string, legend: string, options: readonly { id: T; ko: string }[], value: T | null, onPick: (v: T) => void) =>
      el(
        'fieldset',
        { class: 'start__group' },
        el('legend', { class: 'start__label' }, legend),
        el(
          'div',
          { class: 'pick-row' },
          ...options.map((o) => {
            const radio = el('input', { type: 'radio', name, value: o.id, id: `${name}-${o.id}` });
            radio.checked = o.id === value;
            radio.addEventListener('change', () => onPick(o.id));
            return el('label', { class: 'pick', for: `${name}-${o.id}` }, radio, el('span', {}, o.ko));
          }),
        ),
      );

    const form = el(
      'form',
      { class: 'start__form', novalidate: '' },
      el('label', { for: 'player-name', class: 'start__label' }, '이름을 알려 주세요'),
      input,
      el('p', { class: 'start__help' }, `비워 두면 "${DEFAULT_PLAYER_NAME}"(으)로 시작해요.`),
      choiceGroup('gender', '성별', GENDERS, gender, (v) => {
        gender = v;
        genderError.hidden = true;
        updateGenderHint();
      }),
      genderHint,
      genderError,
      el(
        'div',
        { class: 'start__look' },
        canvas,
        choiceGroup('hair', '머리 모양', HAIR_STYLES, appearance.hairStyle, (v) => {
          appearance.hairStyle = v;
          redraw();
        }),
        choiceGroup('eyes', '눈 모양', EYE_STYLES, appearance.eyes, (v) => {
          appearance.eyes = v;
          redraw();
        }),
      ),
      el('p', { class: 'start__help' }, '성별과 외형은 다음에 시작할 때 다시 바꿀 수 있어요. 성별은 대화 설정에서도 바꿀 수 있어요.'),
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
      if (!gender) {
        genderError.hidden = false;
        form.querySelector<HTMLInputElement>('input[name="gender"]')?.focus();
        return;
      }
      screen.remove();
      closeModal();
      resolve({ name: input.value, gender, appearance });
    });

    updateGenderHint();
    redraw();
    openModal();
    document.getElementById('ui-root')!.append(screen);
    input.focus();
  });
}
