/** 타일 한 칸의 크기(px). 모든 맵 좌표는 이 단위를 기준으로 한다. */
export const TILE = 32;

/** 플레이어 이동 속도(px/초). 방향과 상관없이 일정하다. */
export const PLAYER_SPEED = 110;

/** 주민·책상 등과 상호작용할 수 있는 최대 거리(px, 발 위치 기준). */
export const INTERACT_RANGE = TILE * 1.6;

export const SCENES = {
  boot: 'boot',
  village: 'village',
  house: 'house',
} as const;

/** 깊이(depth) 기준값. 캐릭터·나무 등은 발 위치(y)로 정렬해 앞뒤가 자연스럽게 겹친다. */
export const DEPTH = {
  ground: 0,
  decor: 1,
  marker: 2,
  /** 이 값 + y 좌표 */
  sorted: 10,
  label: 5000,
} as const;
