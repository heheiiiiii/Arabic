import { TILE } from '../config';
import type { Point, Tile } from './Grid';
import type { Interactable } from './Interactable';

/**
 * 정해진 접근 타일에 서면 동작하는 단순한 상호작용 대상 (책상, 문 등).
 */
export class TileTarget implements Interactable {
  constructor(
    private readonly tiles: Tile[],
    private readonly look: Point,
    private readonly action: () => void,
  ) {}

  approachTiles(): Tile[] {
    return this.tiles;
  }

  lookAt(): Point {
    return this.look;
  }

  /** 접근 타일 중 하나의 중심에서 반 칸 안에 있으면 도착한 것으로 본다. */
  isInRange(feet: Point): boolean {
    return this.tiles.some((t) => Math.hypot(feet.x - (t.col + 0.5) * TILE, feet.y - (t.row + 0.5) * TILE) <= TILE / 2);
  }

  interact(): void {
    this.action();
  }
}
