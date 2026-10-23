import { DEPTH, SCENES, TILE } from '../config';
import { INTERACTABLE_KEY } from '../world/Interactable';
import { TileTarget } from '../world/TileTarget';
import { DESK_RECT, HOUSE_DOOR, HOUSE_MAP, HOUSE_SPAWN } from '../world/maps';
import { hud } from '../../ui/Hud';
import { isModalOpen } from '../../ui/modal';
import { studyUI } from '../../ui/study/StudyUI';
import { WorldScene } from './WorldScene';

/** 내 집 내부: 책상에서 공부 메뉴를 열 수 있다. */
export class HouseScene extends WorldScene {
  protected readonly viewTiles = { cols: 12, rows: 10 };

  constructor() {
    super(SCENES.house);
  }

  create(): void {
    this.buildMap(HOUSE_MAP);
    this.spawnPlayer(HOUSE_SPAWN);

    // 책상 (막힘) + 의자 (책상 바로 아래, 통과 가능)
    const { col, row, w } = DESK_RECT;
    const deskBottom = (row + 1) * TILE;
    const desk = this.add
      .image(col * TILE, deskBottom, 'desk')
      .setOrigin(0, 1)
      .setDepth(DEPTH.sorted + deskBottom);
    for (let c = col; c < col + w; c++) this.blockTile(c, row);
    this.add.image(col * TILE + TILE / 2, (row + 1) * TILE, 'chair').setOrigin(0.5, 0).setDepth(DEPTH.decor);

    const chairTiles = Array.from({ length: w }, (_, i) => ({ col: col + i, row: row + 1 }));
    const deskTarget = new TileTarget(chairTiles, { x: col * TILE + (w * TILE) / 2, y: row * TILE }, () =>
      studyUI.open(() => this.leave()),
    );
    // 책상 스프라이트를 직접 클릭 대상으로 만든다.
    desk.setInteractive({ useHandCursor: true }).setData(INTERACTABLE_KEY, deskTarget);

    // 출입문 (아래 벽 가운데)
    const doorTarget = new TileTarget([HOUSE_DOOR], { x: (HOUSE_DOOR.col + 0.5) * TILE, y: (HOUSE_DOOR.row + 1) * TILE }, () =>
      this.leave(),
    );
    this.add.image(HOUSE_DOOR.col * TILE, HOUSE_DOOR.row * TILE, 'door-mat').setOrigin(0).setDepth(DEPTH.decor);
    this.addInteractiveZone(HOUSE_DOOR.col * TILE, HOUSE_DOOR.row * TILE, TILE, TILE, doorTarget);

    this.setupCamera(false);
    hud.setPlace('🏠 내 집', '책상을 눌러 공부를 시작해 보세요.');
    hud.setExit(() => {
      if (!isModalOpen()) this.leave();
    });
  }

  private leave(): void {
    hud.setExit(null);
    this.goTo(SCENES.village);
  }
}
