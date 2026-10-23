import { SCENES, TILE } from '../config';
import { Villager } from '../entities/Villager';
import { TileTarget } from '../world/TileTarget';
import { VILLAGE_MAP, VILLAGE_SPAWN, VILLAGER_TILE } from '../world/maps';
import { getPlayerName } from '../state';
import { LAYLA } from '../../data/dialogue';
import { dialogueUI } from '../../ui/DialogueUI';
import { hud } from '../../ui/Hud';
import { WorldScene } from './WorldScene';

/** 마을: 주민 라일라와 대화하고, 빨간 지붕 집(내 집)으로 들어갈 수 있다. */
export class VillageScene extends WorldScene {
  protected readonly viewTiles = { cols: 15, rows: 10 };

  constructor() {
    super(SCENES.village);
  }

  create(): void {
    this.buildMap(VILLAGE_MAP);
    this.spawnPlayer(VILLAGE_SPAWN);

    const layla = new Villager(this, LAYLA, VILLAGER_TILE, 'layla', (v) => {
      v.faceTowards(this.player.x);
      dialogueUI.open(v.def, v.def.greeting, getPlayerName());
    });
    this.blockTile(layla.tile.col, layla.tile.row);

    // 들어갈 수 있는 집의 문
    for (const h of VILLAGE_MAP.houses.filter((house) => house.enterable)) {
      const door = { col: h.col + h.doorOffset, row: h.row + h.h - 1 };
      const front = { col: door.col, row: door.row + 1 };
      const target = new TileTarget([front], { x: (door.col + 0.5) * TILE, y: door.row * TILE }, () => this.goTo(SCENES.house));
      // 문과 그 위 벽 한 칸까지를 클릭 영역으로 잡는다.
      this.addInteractiveZone(door.col * TILE, (door.row - 1) * TILE, TILE, TILE * 2, target);
    }

    this.setupCamera(true);
    hud.setPlace('🏘️ 마을', '땅을 눌러 이동하고, 주민이나 빨간 지붕 집 문을 눌러 보세요.');
    hud.setExit(null);
  }
}
