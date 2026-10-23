import type { Tile } from './Grid';

/**
 * 클릭/터치하면 플레이어가 다가가서 무언가를 하는 대상 (주민, 책상, 문 등).
 * 장면은 이 인터페이스만 알면 되므로, 새로운 상호작용 대상을 추가하기 쉽다.
 */
export interface Interactable {
  /** 플레이어가 서 있을 수 있는 접근 타일 후보. 가장 가까운 칸으로 간다. */
  approachTiles(): Tile[];
  /** 플레이어 발 위치가 이 거리(px) 안이면 "충분히 가깝다"고 본다. */
  isInRange(feet: { x: number; y: number }): boolean;
  /** 플레이어가 바라볼 지점 */
  lookAt(): { x: number; y: number };
  /** 도착(또는 이미 가까이 있음) 후 실행 */
  interact(): void;
}

export const INTERACTABLE_KEY = 'interactable';
