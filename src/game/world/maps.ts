/**
 * 맵 배치 데이터. 지형은 문자 격자로, 건물·주민·책상 같은 큰 물체는 별도 목록으로 정의한다.
 *
 * 지형 문자
 *   .  잔디        ,  꽃(통과 가능)   =  흙길       #  광장 돌바닥
 *   T  나무(막힘)   b  덤불(막힘)       F  울타리(막힘) ~  연못(막힘)   o  우물(막힘)
 *   (실내) _  나무 바닥   W  벽(막힘)   r  러그   B  침대(막힘)   S  책장(막힘)   P  화분(막힘)
 */

export type GroundChar = '.' | ',' | '=' | '#' | 'T' | 'b' | 'F' | '~' | 'o' | '_' | 'W' | 'r' | 'B' | 'S' | 'P';

export const BLOCKING_CHARS: ReadonlySet<string> = new Set(['T', 'b', 'F', '~', 'o', 'W', 'B', 'S', 'P']);

export interface TileRect {
  col: number;
  row: number;
  w: number;
  h: number;
}

export interface HouseDef extends TileRect {
  id: string;
  texture: 'house-red' | 'house-blue';
  /** 문의 열 위치 (집 왼쪽 끝 기준 오프셋). 문은 집의 가장 아래 줄에 있다. */
  doorOffset: number;
  /** true면 클릭해서 들어갈 수 있다. */
  enterable: boolean;
}

export interface MapDef {
  ground: string[];
  houses: HouseDef[];
}

export const VILLAGE_MAP: MapDef = {
  // 30 x 20 타일
  ground: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T...,.......T........,......TT',
    'T..........................,.T',
    'T.T...........b..............T',
    'T............................T',
    'TT...........................T',
    'T.....=................=.....T',
    'T.....=...,......,.....=.....T',
    'T============================T',
    'T..............=.............T',
    'T...........#######......,...T',
    'T...T...T...###o###..........T',
    'T...........#######..........T',
    'T....,......#######...T......T',
    'T.FFF.FFF......=.............T',
    'T.F,,,,,F......=.....~~~~~...T',
    'T.F,,,,,F......=.....~~~~~...T',
    'T.FFFFFFF.b....=.......b.....T',
    'T..............=.............T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  houses: [
    { id: 'player-home', texture: 'house-red', col: 4, row: 3, w: 4, h: 3, doorOffset: 2, enterable: true },
    { id: 'neighbor', texture: 'house-blue', col: 21, row: 3, w: 4, h: 3, doorOffset: 2, enterable: false },
  ],
};

/** 처음 시작하거나 집에서 나왔을 때 서는 위치 (플레이어 집 문 바로 아래). */
export const VILLAGE_SPAWN = { col: 6, row: 6 };

/** 주민 라일라의 위치 (광장 우물 옆). */
export const VILLAGER_TILE = { col: 17, row: 11 };

export const HOUSE_MAP: MapDef = {
  // 11 x 9 타일 실내. 위 두 줄은 벽(창문), 아래 가운데가 출입문.
  ground: [
    'WWWWWWWWWWW',
    'WWWWWWWWWWW',
    'W__SS___BBW',
    'W_______BBW',
    'W___rrr___W',
    'W___rrr___W',
    'WP_______PW',
    'W_________W',
    'WWWWW_WWWWW',
  ],
  houses: [],
};

/** 책상 위치 (2칸 너비). 의자는 책상 바로 아래 칸에 놓이며 통과 가능하다. */
export const DESK_RECT: TileRect = { col: 5, row: 2, w: 2, h: 1 };
export const HOUSE_DOOR = { col: 5, row: 8 };
export const HOUSE_SPAWN = { col: 5, row: 7 };
