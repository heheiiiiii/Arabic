import Phaser from 'phaser';
import { DEPTH, INTERACT_RANGE, TILE } from '../config';
import type { Tile } from '../world/Grid';
import { INTERACTABLE_KEY, type Interactable } from '../world/Interactable';
import type { VillagerDef } from '../../data/dialogue';

/**
 * 한 자리에 서 있는 주민. 클릭/터치하면 플레이어가 다가와 대화를 시작한다.
 * (돌아다니기·일과·기억은 이후 단계에서 추가)
 */
export class Villager implements Interactable {
  readonly def: VillagerDef;
  readonly tile: Tile;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly talkIcon: Phaser.GameObjects.Image;
  private readonly onTalk: (v: Villager) => void;

  constructor(scene: Phaser.Scene, def: VillagerDef, tile: Tile, textureBase: string, onTalk: (v: Villager) => void) {
    this.def = def;
    this.tile = tile;
    this.onTalk = onTalk;

    const x = tile.col * TILE + TILE / 2;
    const feetY = tile.row * TILE + TILE / 2;
    scene.add.image(x, feetY + 2, 'shadow').setDepth(DEPTH.sorted + feetY - 1);
    this.sprite = scene.add
      .sprite(x, feetY + 5, `${textureBase}-0`)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.sorted + feetY);

    // 숨쉬는 듯한 대기 동작
    let frame = 0;
    scene.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => this.sprite.setTexture(`${textureBase}-${(frame = 1 - frame)}`),
    });

    // 클릭 영역은 스프라이트보다 조금 넉넉하게 잡아 터치하기 쉽게 한다.
    this.sprite.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-4, -6, 40, 40),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.sprite.setData(INTERACTABLE_KEY, this);

    this.talkIcon = scene.add.image(x + 10, feetY - 34, 'talk-icon').setDepth(DEPTH.label);
    scene.tweens.add({ targets: this.talkIcon, y: feetY - 38, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    scene.add
      .text(x, feetY + 8, def.nameKo, {
        fontFamily: '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
        fontSize: '10px',
        color: '#ffffff',
        stroke: '#3b2a20',
        strokeThickness: 3,
        resolution: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.label);
  }

  approachTiles(): Tile[] {
    const out: Tile[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr !== 0 || dc !== 0) out.push({ col: this.tile.col + dc, row: this.tile.row + dr });
      }
    }
    return out;
  }

  lookAt(): { x: number; y: number } {
    return { x: this.tile.col * TILE + TILE / 2, y: this.tile.row * TILE + TILE / 2 };
  }

  isInRange(feet: { x: number; y: number }): boolean {
    const c = this.lookAt();
    return Math.hypot(feet.x - c.x, feet.y - c.y) <= INTERACT_RANGE;
  }

  /** 플레이어 쪽을 바라보게 한다. */
  faceTowards(x: number): void {
    this.sprite.setFlipX(x < this.sprite.x - 2);
  }

  interact(): void {
    this.onTalk(this);
  }
}
