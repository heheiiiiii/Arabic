import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { Player } from '../entities/Player';
import { Grid, type Point, type Tile } from '../world/Grid';
import { INTERACTABLE_KEY, type Interactable } from '../world/Interactable';
import { BLOCKING_CHARS, type MapDef } from '../world/maps';
import { getPlayerName } from '../state';
import { isModalOpen } from '../../ui/modal';
import { showToast } from '../../ui/toast';

/**
 * 타일맵 장면(마을, 집 내부)의 공통 기능.
 * - 지형 그리기와 장애물(격자 + Arcade 정적 바디) 등록
 * - 클릭/터치로 목적지 이동, 상호작용 대상에게 다가가기
 * - 카메라 확대·추적
 */
export abstract class WorldScene extends Phaser.Scene {
  protected grid!: Grid;
  protected player!: Player;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private marker!: Phaser.GameObjects.Image;

  /** 화면에 최소한 보여야 할 타일 수 (가로, 세로). 확대 배율 계산에 쓴다. */
  protected abstract readonly viewTiles: { cols: number; rows: number };

  // ── 맵 구성 ─────────────────────────────────────────

  protected buildMap(map: MapDef): void {
    const rows = map.ground.length;
    const cols = map.ground[0].length;
    for (const line of map.ground) {
      if (line.length !== cols) throw new Error(`맵 행 길이가 일정하지 않습니다: "${line}"`);
    }

    this.grid = new Grid(cols, rows);
    this.obstacles = this.physics.add.staticGroup();
    this.physics.world.setBounds(0, 0, this.grid.widthPx, this.grid.heightPx);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = map.ground[r][c];
        this.drawTile(ch, c, r, map);
        if (BLOCKING_CHARS.has(ch)) this.blockTile(c, r);
      }
    }

    for (const h of map.houses) {
      const x = h.col * TILE;
      const bottom = (h.row + h.h) * TILE;
      this.add.image(x, bottom, h.texture).setOrigin(0, 1).setDepth(DEPTH.sorted + bottom);
      for (let r = h.row; r < h.row + h.h; r++) for (let c = h.col; c < h.col + h.w; c++) this.blockTile(c, r);
    }

    this.marker = this.add.image(0, 0, 'target-marker').setDepth(DEPTH.marker).setVisible(false);
  }

  /** 격자와 물리 양쪽에 장애물로 등록한다. */
  protected blockTile(col: number, row: number): void {
    if (!this.grid.isWalkable(col, row)) return;
    this.grid.setBlocked(col, row);
    const zone = this.add.zone(col * TILE + TILE / 2, row * TILE + TILE / 2, TILE, TILE);
    this.obstacles.add(zone);
  }

  private drawTile(ch: string, c: number, r: number, map: MapDef): void {
    const x = c * TILE;
    const y = r * TILE;
    const ground = (key: string) => this.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.ground);
    const sortedBottom = (key: string, ox: number, oy: number) =>
      this.add.image(x + ox, y + oy, key).setOrigin(0.5, 1).setDepth(DEPTH.sorted + y + TILE);
    const grass = () => ground(`grass-${(c * 7 + r * 13) % 3}`);
    const same = (dc: number, dr: number) => map.ground[r + dr]?.[c + dc] === ch;

    switch (ch) {
      case '.': grass(); break;
      case ',': grass(); ground('flowers').setDepth(DEPTH.decor); break;
      case '=': ground('path'); break;
      case '#': ground('plaza'); break;
      case '~': ground('water'); break;
      case 'T': grass(); sortedBottom('tree', TILE / 2, TILE + 2); break;
      case 'b': grass(); sortedBottom('bush', TILE / 2, TILE); break;
      case 'F': grass(); sortedBottom('fence', TILE / 2, TILE); break;
      case 'o': ground('plaza'); sortedBottom('well', TILE / 2, TILE + 4); break;
      case '_': ground('floor'); break;
      case 'r': ground('rug'); break;
      case 'P': ground('floor'); sortedBottom('plant', TILE / 2, TILE); break;
      case 'B':
        ground('floor');
        if (!same(-1, 0) && !same(0, -1)) this.add.image(x, y, 'bed').setOrigin(0).setDepth(DEPTH.decor);
        break;
      case 'S':
        ground('floor');
        if (!same(-1, 0)) this.add.image(x, y, 'shelf').setOrigin(0).setDepth(DEPTH.decor);
        break;
      case 'W': {
        // 위쪽 벽의 정면(두 번째 줄)은 벽지·창문, 나머지는 벽 윗면으로 그린다.
        const isFace = r === 1 && c > 0 && c < map.ground[0].length - 1;
        ground(isFace ? (c % 3 === 0 ? 'window' : 'wall-face') : 'wall-top');
        break;
      }
      default: grass();
    }
  }

  // ── 플레이어와 입력 ─────────────────────────────────

  protected spawnPlayer(tile: Tile): void {
    this.player = new Player(this, this.grid.center(tile), getPlayerName());
    this.physics.add.collider(this.player, this.obstacles);

    this.input.enabled = true; // goTo()에서 꺼 둔 입력을 장면 재시작 시 되살린다.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // 대화창·공부 메뉴가 열려 있으면 마을을 눌러도 움직이지 않는다.
      if (isModalOpen()) return;
      const target = over.map((o) => o.getData(INTERACTABLE_KEY) as Interactable | undefined).find(Boolean);
      if (target) this.approach(target);
      else this.walkTo({ x: pointer.worldX, y: pointer.worldY });
    });
  }

  /** 지정한 지점으로 걷는다. 장애물 안쪽을 누르면 가까운 빈 칸으로 보정하거나 이동을 거부한다. */
  walkTo(point: Point): void {
    const p = {
      x: Phaser.Math.Clamp(point.x, 0, this.grid.widthPx - 1),
      y: Phaser.Math.Clamp(point.y, 0, this.grid.heightPx - 1),
    };
    const clicked = this.grid.tileAt(p);
    let goal: Tile;
    let final: Point;
    if (this.grid.isWalkable(clicked.col, clicked.row)) {
      goal = clicked;
      final = this.grid.bodyFits(p) ? p : this.grid.center(clicked);
    } else {
      const near = this.grid.nearestWalkable(clicked, 1);
      if (!near) {
        showToast('그곳으로는 갈 수 없어요.');
        return;
      }
      goal = near;
      final = this.grid.center(near);
    }

    const path = this.findPathFromPlayer([goal]);
    if (!path) {
      showToast('그곳으로는 갈 수 없어요.');
      return;
    }
    this.showMarker(final);
    this.player.walk(this.grid.smoothPath(this.player.feet, path, final), () => this.marker.setVisible(false));
  }

  /** 상호작용 대상 근처로 걸어가서, 도착하면 interact()를 호출한다. */
  approach(target: Interactable): void {
    if (target.isInRange(this.player.feet)) {
      this.player.halt();
      this.marker.setVisible(false);
      this.player.face(target.lookAt());
      target.interact();
      return;
    }
    const path = this.findPathFromPlayer(target.approachTiles());
    if (!path) {
      showToast('가까이 갈 수 있는 길이 없어요.');
      return;
    }
    const final = this.grid.center(path[path.length - 1]);
    this.showMarker(final);
    this.player.walk(this.grid.smoothPath(this.player.feet, path, final), () => {
      this.marker.setVisible(false);
      this.player.face(target.lookAt());
      if (target.isInRange(this.player.feet)) target.interact();
    });
  }

  private findPathFromPlayer(goals: Tile[]): Tile[] | null {
    let start = this.grid.tileAt(this.player.feet);
    if (!this.grid.isWalkable(start.col, start.row)) start = this.grid.nearestWalkable(start, 1) ?? start;
    return this.grid.findPath(start, goals);
  }

  private showMarker(p: Point): void {
    this.marker.setPosition(p.x, p.y + 2).setVisible(true).setAlpha(1);
  }

  /** 상호작용 가능한 투명 영역 (문 등 따로 스프라이트가 없는 대상용). */
  protected addInteractiveZone(x: number, y: number, w: number, h: number, target: Interactable): void {
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.setData(INTERACTABLE_KEY, target);
  }

  // ── 카메라 ──────────────────────────────────────────

  protected setupCamera(follow: boolean): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(follow ? '#3d7d2d' : '#2b1d16');
    cam.roundPixels = true;
    const apply = () => {
      const { width, height } = this.scale.gameSize;
      const raw = Math.min(width / (this.viewTiles.cols * TILE), height / (this.viewTiles.rows * TILE));
      cam.setZoom(Phaser.Math.Clamp(Math.floor(raw * 2) / 2, 1, 3));
      if (!follow) cam.centerOn(this.grid.widthPx / 2, this.grid.heightPx / 2);
    };
    if (follow) {
      cam.setBounds(0, 0, this.grid.widthPx, this.grid.heightPx);
      cam.startFollow(this.player, true, 0.15, 0.15);
    }
    apply();
    this.scale.on('resize', apply);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', apply));
    cam.fadeIn(250, 0, 0, 0);
  }

  /** 화면을 어둡게 한 뒤 다른 장면으로 넘어간다. */
  protected goTo(sceneKey: string, data?: object): void {
    this.player.halt();
    this.input.enabled = false;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(sceneKey, data));
  }
}
