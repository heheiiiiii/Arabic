import Phaser from 'phaser';
import { SCENES } from '../config';
import { createTextures } from '../art/textures';
import { getPlayerProfile } from '../state';

/** 텍스처를 만들고 마을로 넘어간다. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    createTextures(this, getPlayerProfile().appearance);
    this.scene.start(SCENES.village);
  }
}
