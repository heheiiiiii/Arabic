import { TILE } from '../config';

export interface Point {
  x: number;
  y: number;
}

export interface Tile {
  col: number;
  row: number;
}

/** 플레이어 충돌 박스의 절반 크기 (발 위치 기준). Player.ts의 물리 바디와 맞춘다. */
export const BODY_HALF_W = 8;
export const BODY_HALF_H = 5;

const DIRS: ReadonlyArray<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * 타일 단위 통행 가능 여부 + 경로 탐색.
 * 장애물 충돌 자체는 Phaser Arcade 물리가 막고, 이 클래스는 장애물을 돌아가는 경로를 계산한다.
 */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: boolean[];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.blocked = new Array(cols * rows).fill(false);
  }

  get widthPx(): number {
    return this.cols * TILE;
  }

  get heightPx(): number {
    return this.rows * TILE;
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  setBlocked(col: number, row: number, value = true): void {
    if (this.inBounds(col, row)) this.blocked[row * this.cols + col] = value;
  }

  isWalkable(col: number, row: number): boolean {
    return this.inBounds(col, row) && !this.blocked[row * this.cols + col];
  }

  tileAt(p: Point): Tile {
    return { col: Math.floor(p.x / TILE), row: Math.floor(p.y / TILE) };
  }

  center(t: Tile): Point {
    return { x: t.col * TILE + TILE / 2, y: t.row * TILE + TILE / 2 };
  }

  /** 발 위치 p에 플레이어 충돌 박스를 놓았을 때 장애물과 겹치지 않는지. */
  bodyFits(p: Point): boolean {
    const m = 1; // 경계에 딱 붙지 않도록 약간의 여유
    const xs = [p.x - BODY_HALF_W - m, p.x + BODY_HALF_W + m];
    const ys = [p.y - BODY_HALF_H - m, p.y + BODY_HALF_H + m];
    for (const x of xs) {
      for (const y of ys) {
        if (!this.isWalkable(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
      }
    }
    return true;
  }

  /** a에서 b까지 충돌 박스가 장애물에 걸리지 않고 직선 이동할 수 있는지. */
  canWalkStraight(a: Point, b: Point): boolean {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / 4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.bodyFits({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
    }
    return true;
  }

  /** 막힌 타일을 클릭했을 때 가장 가까운 통행 가능 타일 (반경 maxRadius 이내). 없으면 null. */
  nearestWalkable(t: Tile, maxRadius = 2): Tile | null {
    if (this.isWalkable(t.col, t.row)) return t;
    let best: Tile | null = null;
    let bestD = Infinity;
    for (let dr = -maxRadius; dr <= maxRadius; dr++) {
      for (let dc = -maxRadius; dc <= maxRadius; dc++) {
        const c = t.col + dc;
        const r = t.row + dr;
        if (!this.isWalkable(c, r)) continue;
        const d = dc * dc + dr * dr;
        if (d < bestD) {
          bestD = d;
          best = { col: c, row: r };
        }
      }
    }
    return best;
  }

  /**
   * 8방향 다익스트라 경로 탐색. goals 중 가장 가까운 타일까지의 경로(타일 목록)를 반환한다.
   * 대각선은 양옆 두 칸이 모두 열려 있을 때만 허용해 모서리를 파고들지 않게 한다.
   * 맵이 작아(수백 칸) 단순한 구현으로 충분하다.
   */
  findPath(start: Tile, goals: Tile[]): Tile[] | null {
    const n = this.cols * this.rows;
    const idx = (c: number, r: number) => r * this.cols + c;
    const goalSet = new Set(goals.filter((g) => this.isWalkable(g.col, g.row)).map((g) => idx(g.col, g.row)));
    if (goalSet.size === 0) return null;

    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    const s = idx(start.col, start.row);
    dist[s] = 0;
    const open: number[] = [s];

    while (open.length > 0) {
      // 작은 맵이므로 선형 탐색으로 최소값을 꺼낸다.
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (done[cur]) continue;
      done[cur] = 1;

      if (goalSet.has(cur)) {
        const path: Tile[] = [];
        for (let p = cur; p !== -1; p = prev[p]) path.push({ col: p % this.cols, row: Math.floor(p / this.cols) });
        return path.reverse();
      }

      const cc = cur % this.cols;
      const cr = Math.floor(cur / this.cols);
      for (const [dc, dr] of DIRS) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (!this.isWalkable(nc, nr)) continue;
        if (dc !== 0 && dr !== 0 && (!this.isWalkable(cc + dc, cr) || !this.isWalkable(cc, cr + dr))) continue;
        const ni = idx(nc, nr);
        const nd = dist[cur] + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
        if (nd < dist[ni]) {
          dist[ni] = nd;
          prev[ni] = cur;
          open.push(ni);
        }
      }
    }
    return null;
  }

  /**
   * 타일 경로를 실제 이동 지점 목록으로 바꾼다.
   * 직선으로 갈 수 있는 중간 지점은 건너뛰어 대각선·비스듬한 방향으로 자연스럽게 걷게 한다.
   */
  smoothPath(from: Point, tiles: Tile[], finalPoint: Point): Point[] {
    const raw: Point[] = tiles.slice(1).map((t) => this.center(t));
    raw.push(finalPoint);
    const out: Point[] = [];
    let cursor = from;
    let i = 0;
    while (i < raw.length) {
      let j = raw.length - 1;
      while (j > i && !this.canWalkStraight(cursor, raw[j])) j--;
      out.push(raw[j]);
      cursor = raw[j];
      i = j + 1;
    }
    return out;
  }
}
