/**
 * 도트 사람 그리기 (플레이어·주민 공용).
 * Phaser 텍스처와 첫 화면의 미리보기(canvas)가 같은 함수를 쓰도록 그리기 대상을 추상화했다.
 * 좌표는 16x16 "도트" 단위이고, 실제 픽셀 크기는 scale 배이다.
 */

/** fillStyle/fillRect만 있으면 된다 (Phaser.GameObjects.Graphics, canvas 어댑터) */
export interface Painter {
  fillStyle(color: number, alpha?: number): unknown;
  fillRect(x: number, y: number, w: number, h: number): unknown;
}

export type HairStyle = 'short' | 'long' | 'ponytail' | 'curly';
export type EyeStyle = 'dot' | 'big' | 'narrow' | 'lashes';

export const HAIR_STYLES: readonly { id: HairStyle; ko: string }[] = [
  { id: 'short', ko: '짧은 머리' },
  { id: 'long', ko: '긴 머리' },
  { id: 'ponytail', ko: '묶은 머리' },
  { id: 'curly', ko: '곱슬머리' },
];

export const EYE_STYLES: readonly { id: EyeStyle; ko: string }[] = [
  { id: 'dot', ko: '동그란 눈' },
  { id: 'big', ko: '큰 눈' },
  { id: 'narrow', ko: '가는 눈' },
  { id: 'lashes', ko: '속눈썹' },
];

export const SKIN = 0xf1c27d;
export const SKIN_DARK = 0xd9a35f;
export const OUTLINE = 0x3b2a20;

export interface PersonLook {
  hair: number;
  shirt: number;
  shirtDark: number;
  pants: number;
  /** 히잡 색 (있으면 머리 모양 대신 히잡을 그린다) */
  scarf: number | null;
  hairStyle: HairStyle;
  eyes: EyeStyle;
}

/** 플레이어가 고르는 외형 (저장 데이터에 들어간다) */
export interface Appearance {
  hairStyle: HairStyle;
  eyes: EyeStyle;
}

export const DEFAULT_APPEARANCE: Appearance = { hairStyle: 'short', eyes: 'dot' };

/** 플레이어 옷 색은 고정이고, 머리·눈 모양만 고른다. */
export function playerLook(a: Appearance): PersonLook {
  return { hair: 0x3b2a20, shirt: 0x3f7fbf, shirtDark: 0x2f6399, pants: 0x3a3f58, scarf: null, ...a };
}

export type Facing = 'down' | 'up';

/** step: 0 = 서기, 1 = 걷기(다리 교차), 2 = 숨쉬기(살짝 내려감) */
export function drawPerson(g: Painter, facing: Facing, step: number, c: PersonLook, scale: number): void {
  const px = (x: number, y: number, w: number, h: number, color: number) => {
    g.fillStyle(color, 1);
    g.fillRect(x * scale, y * scale, w * scale, h * scale);
  };
  const bob = step === 2 ? 1 : 0;
  // 긴 머리·묶은 머리는 뒤로 늘어진 부분을 몸통보다 먼저 그린다
  if (c.scarf === null && facing === 'down') {
    if (c.hairStyle === 'long') {
      px(3, 4 + bob, 1, 5, c.hair);
      px(12, 4 + bob, 1, 5, c.hair);
    } else if (c.hairStyle === 'ponytail') {
      px(13, 2 + bob, 1, 4, c.hair);
    }
  }
  // 다리
  if (step === 1) {
    px(5, 12, 2, 3, c.pants);
    px(9, 11, 2, 3, c.pants);
    px(5, 15, 2, 1, OUTLINE);
    px(9, 14, 2, 1, OUTLINE);
  } else {
    px(5, 12, 2, 3, c.pants);
    px(9, 12, 2, 3, c.pants);
    px(5, 15, 2, 1, OUTLINE);
    px(9, 15, 2, 1, OUTLINE);
  }
  // 몸통
  px(4, 7 + bob, 8, 6 - bob, c.shirt);
  px(4, 11, 8, 1, c.shirtDark);
  px(3, 8 + bob, 1, 4, SKIN);
  px(12, 8 + bob, 1, 4, SKIN);
  // 머리
  const hy = bob;
  if (c.scarf !== null) {
    px(4, 1 + hy, 8, 7, c.scarf);
    px(3, 3 + hy, 10, 6, c.scarf);
    if (facing === 'down') {
      px(5, 3 + hy, 6, 4, SKIN);
      drawEyes(px, c.eyes, hy);
      px(7, 6 + hy, 2, 1, SKIN_DARK);
    }
    return;
  }
  px(4, 1 + hy, 8, 6, SKIN);
  drawHair(px, c, facing, hy);
  if (facing === 'down') {
    drawEyes(px, c.eyes, hy);
    px(7, 6 + hy, 2, 1, SKIN_DARK);
  }
}

type Px = (x: number, y: number, w: number, h: number, color: number) => void;

function drawHair(px: Px, c: PersonLook, facing: Facing, hy: number): void {
  const h = c.hair;
  if (c.hairStyle === 'curly') {
    // 위와 옆이 부풀어 오른 모양
    px(3, 0 + hy, 10, 2, h);
    px(2, 1 + hy, 1, 4, h);
    px(13, 1 + hy, 1, 4, h);
    px(3, 2 + hy, 1, 4, h);
    px(12, 2 + hy, 1, 4, h);
    if (facing === 'down') {
      px(4, 2 + hy, 2, 1, h);
      px(7, 2 + hy, 2, 1, h);
      px(10, 2 + hy, 2, 1, h);
    } else {
      px(3, 1 + hy, 10, 6, h);
    }
    return;
  }
  // 짧은 머리 (기본 모양). 긴 머리·묶은 머리도 머리 위쪽은 같다.
  px(4, 0 + hy, 8, 2, h);
  px(3, 1 + hy, 1, 4, h);
  px(12, 1 + hy, 1, 4, h);
  if (facing === 'down') {
    px(4, 2 + hy, 8, 1, h);
    return;
  }
  px(4, 1 + hy, 8, 6, h);
  if (c.hairStyle === 'long') {
    px(3, 5 + hy, 10, 4, h);
  } else if (c.hairStyle === 'ponytail') {
    px(7, 7 + hy, 2, 3, h);
  }
}

function drawEyes(px: Px, eyes: EyeStyle, hy: number): void {
  switch (eyes) {
    case 'big':
      px(6, 3 + hy, 1, 2, OUTLINE);
      px(9, 3 + hy, 1, 2, OUTLINE);
      break;
    case 'narrow':
      px(5, 4 + hy, 2, 1, OUTLINE);
      px(9, 4 + hy, 2, 1, OUTLINE);
      break;
    case 'lashes':
      px(6, 4 + hy, 1, 1, OUTLINE);
      px(9, 4 + hy, 1, 1, OUTLINE);
      px(5, 3 + hy, 1, 1, OUTLINE);
      px(10, 3 + hy, 1, 1, OUTLINE);
      break;
    default:
      px(6, 4 + hy, 1, 1, OUTLINE);
      px(9, 4 + hy, 1, 1, OUTLINE);
  }
}
