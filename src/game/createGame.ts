import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HouseScene } from './scenes/HouseScene';
import { VillageScene } from './scenes/VillageScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#2b1d16',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    input: { activePointers: 2 },
    scene: [BootScene, VillageScene, HouseScene],
  });
}
