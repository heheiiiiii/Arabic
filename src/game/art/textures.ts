import Phaser from 'phaser';
import { TILE } from '../config';

/**
 * [임시 그래픽] 외부 이미지 없이 사각형을 찍어 픽셀풍 텍스처를 만든다.
 * 나중에 실제 픽셀아트 에셋으로 바꿀 때는 같은 텍스처 키로 이미지를 로드하면 된다.
 *
 * 모든 좌표는 2px 단위의 "픽셀"로 찍어 도트 느낌을 낸다 (32px 타일 = 16x16 도트).
 */
const P = 2;

type G = Phaser.GameObjects.Graphics;

function px(g: G, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillRect(x * P, y * P, w * P, h * P);
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** 결정적인 의사 난수 (매번 같은 무늬가 나오도록). */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const C = {
  grass: 0x8cc152,
  grassDark: 0x76ad3f,
  grassLight: 0xa4d36a,
  path: 0xdcb985,
  pathDark: 0xc49f6b,
  stone: 0xd8cdb8,
  stoneDark: 0xb9ab92,
  water: 0x5fb3d9,
  waterLight: 0x9bd6ef,
  trunk: 0x7a5232,
  leaf: 0x4f9a3a,
  leafDark: 0x3d7d2d,
  leafLight: 0x6cb84e,
  wood: 0xb07a4a,
  woodDark: 0x8a5a33,
  wall: 0xf3e3c3,
  wallDark: 0xd9c49d,
  roofRed: 0xc8553d,
  roofRedDark: 0x9e3f2c,
  roofBlue: 0x4a7fb5,
  roofBlueDark: 0x355f8a,
  skin: 0xf1c27d,
  skinDark: 0xd9a35f,
  outline: 0x3b2a20,
};

export function createTextures(scene: Phaser.Scene): void {
  // ── 지면 ──────────────────────────────────────────
  for (let v = 0; v < 3; v++) {
    make(scene, `grass-${v}`, TILE, TILE, (g) => {
      px(g, 0, 0, 16, 16, C.grass);
      const r = rng(17 + v * 31);
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(r() * 15);
        const y = Math.floor(r() * 14);
        px(g, x, y, 1, 2, r() > 0.5 ? C.grassDark : C.grassLight);
      }
    });
  }
  make(scene, 'flowers', TILE, TILE, (g) => {
    const r = rng(99);
    const colors = [0xf6e05e, 0xf28b82, 0xffffff, 0xc39bd3];
    for (let i = 0; i < 4; i++) {
      const x = 2 + Math.floor(r() * 11);
      const y = 2 + Math.floor(r() * 11);
      px(g, x, y + 1, 1, 2, C.leafDark);
      px(g, x - 1, y, 3, 1, colors[i % colors.length]);
      px(g, x, y - 1, 1, 3, colors[i % colors.length]);
      px(g, x, y, 1, 1, 0xf6c343);
    }
  });
  make(scene, 'path', TILE, TILE, (g) => {
    px(g, 0, 0, 16, 16, C.path);
    const r = rng(7);
    for (let i = 0; i < 5; i++) px(g, Math.floor(r() * 15), Math.floor(r() * 15), 2, 1, C.pathDark);
  });
  make(scene, 'plaza', TILE, TILE, (g) => {
    px(g, 0, 0, 16, 16, C.stoneDark);
    px(g, 0, 0, 7, 7, C.stone);
    px(g, 8, 0, 8, 7, C.stone);
    px(g, 0, 8, 11, 8, C.stone);
    px(g, 12, 8, 4, 8, C.stone);
  });
  make(scene, 'water', TILE, TILE, (g) => {
    px(g, 0, 0, 16, 16, C.water);
    px(g, 2, 4, 4, 1, C.waterLight);
    px(g, 9, 10, 5, 1, C.waterLight);
  });

  // ── 자연물 ────────────────────────────────────────
  // 나무: 32x56, 아래 가운데가 뿌리(타일 바닥)
  make(scene, 'tree', 32, 56, (g) => {
    px(g, 3, 25, 10, 3, 0x000000, 0.18); // 그림자
    px(g, 7, 18, 3, 9, C.trunk);
    px(g, 6, 25, 5, 2, C.trunk);
    px(g, 2, 4, 12, 13, C.leafDark);
    px(g, 3, 2, 10, 2, C.leafDark);
    px(g, 1, 7, 14, 8, C.leafDark);
    px(g, 3, 3, 10, 12, C.leaf);
    px(g, 2, 6, 12, 7, C.leaf);
    px(g, 4, 4, 4, 3, C.leafLight);
    px(g, 10, 8, 2, 2, C.leafLight);
  });
  make(scene, 'bush', TILE, TILE, (g) => {
    px(g, 2, 12, 12, 3, 0x000000, 0.15);
    px(g, 1, 5, 14, 9, C.leafDark);
    px(g, 2, 4, 12, 8, C.leaf);
    px(g, 4, 5, 3, 2, C.leafLight);
    px(g, 10, 7, 1, 1, 0xe74c3c);
    px(g, 5, 9, 1, 1, 0xe74c3c);
  });
  make(scene, 'fence', TILE, TILE, (g) => {
    px(g, 0, 6, 16, 2, C.wood);
    px(g, 0, 10, 16, 2, C.wood);
    px(g, 1, 3, 3, 11, C.woodDark);
    px(g, 12, 3, 3, 11, C.woodDark);
    px(g, 1, 3, 3, 1, C.wood);
    px(g, 12, 3, 3, 1, C.wood);
  });
  // 우물: 32x40
  make(scene, 'well', 32, 40, (g) => {
    px(g, 1, 17, 14, 3, 0x000000, 0.18);
    px(g, 2, 9, 12, 10, 0x8c8c8c);
    px(g, 3, 10, 10, 2, 0xb0b0b0);
    px(g, 4, 12, 8, 2, 0x2f5f7a);
    px(g, 2, 1, 1, 9, C.woodDark);
    px(g, 13, 1, 1, 9, C.woodDark);
    px(g, 1, 0, 14, 2, C.roofRed);
    px(g, 7, 2, 2, 4, 0x6b6b6b);
  });

  // ── 건물 ──────────────────────────────────────────
  // 집: 4x3 타일(128x96) 바닥 + 지붕이 위로 24px 더 솟음 → 128x120
  const house = (key: string, roof: number, roofDark: number) =>
    make(scene, key, 128, 120, (g) => {
      // 벽 (아래 두 줄 정도)
      px(g, 4, 30, 56, 30, C.wall);
      px(g, 4, 56, 56, 4, C.wallDark);
      // 지붕
      for (let i = 0; i < 18; i++) {
        const inset = Math.max(0, 9 - i);
        px(g, 1 + inset, 4 + i, 62 - inset * 2, 1, i % 4 === 3 ? roofDark : roof);
      }
      px(g, 0, 22, 64, 9, roofDark);
      px(g, 0, 22, 64, 2, roof);
      // 굴뚝
      px(g, 46, 2, 6, 8, 0x8a6d5b);
      // 창문
      for (const wx of [10, 44]) {
        px(g, wx, 36, 10, 9, C.woodDark);
        px(g, wx + 1, 37, 8, 7, 0x9fd3f2);
        px(g, wx + 5, 37, 1, 7, C.woodDark);
        px(g, wx + 1, 40, 8, 1, C.woodDark);
      }
      // 문 (가운데보다 오른쪽: doorOffset 2 → x 64~96px → 도트 32~48)
      px(g, 34, 40, 12, 20, C.woodDark);
      px(g, 35, 41, 10, 19, C.wood);
      px(g, 43, 50, 1, 2, 0xf6c343);
      px(g, 33, 58, 14, 2, 0x8c8c8c);
    });
  house('house-red', C.roofRed, C.roofRedDark);
  house('house-blue', C.roofBlue, C.roofBlueDark);

  // ── 실내 ──────────────────────────────────────────
  make(scene, 'floor', TILE, TILE, (g) => {
    px(g, 0, 0, 16, 16, 0xc9965f);
    px(g, 0, 7, 16, 1, 0xa87745);
    px(g, 0, 15, 16, 1, 0xa87745);
    px(g, 5, 0, 1, 7, 0xa87745);
    px(g, 12, 8, 1, 7, 0xa87745);
  });
  make(scene, 'wall-face', TILE, TILE, (g) => {
    px(g, 0, 0, 16, 16, 0xe9d8b4);
    px(g, 0, 13, 16, 3, 0xb98b5e);
  });
  make(scene, 'wall-top', TILE, TILE, (g) => {
    px(g, 0, 0, 16, 16, 0x6d4c3d);
    px(g, 0, 14, 16, 2, 0x5a3d31);
  });
  make(scene, 'window', TILE, TILE, (g) => {
    px(g, 0, 0, 16, 16, 0xe9d8b4);
    px(g, 0, 13, 16, 3, 0xb98b5e);
    px(g, 3, 2, 10, 9, C.woodDark);
    px(g, 4, 3, 8, 7, 0x9fd3f2);
    px(g, 8, 3, 1, 7, C.woodDark);
    px(g, 5, 4, 2, 2, 0xffffff, 0.7);
  });
  make(scene, 'rug', TILE, TILE, (g) => {
    px(g, 0, 0, 16, 16, 0xb84a4a);
    px(g, 1, 1, 14, 14, 0xd06363);
    px(g, 6, 6, 4, 4, 0xf6c343);
  });
  make(scene, 'door-mat', TILE, TILE, (g) => {
    px(g, 0, 0, 16, 16, 0xc9965f);
    px(g, 2, 4, 12, 10, 0x6b8e4e);
    px(g, 3, 5, 10, 8, 0x86a865);
  });
  // 침대: 64x64 (2x2)
  make(scene, 'bed', 64, 64, (g) => {
    px(g, 1, 1, 30, 30, C.woodDark);
    px(g, 2, 2, 28, 28, 0xf7f3e8);
    px(g, 4, 3, 24, 6, 0xffffff);
    px(g, 2, 12, 28, 18, 0x6c9bd2);
    px(g, 2, 12, 28, 2, 0x8bb4e6);
  });
  // 책장: 64x32 (2x1)
  make(scene, 'shelf', 64, 32, (g) => {
    px(g, 0, 0, 32, 16, C.woodDark);
    px(g, 1, 1, 30, 6, 0x5a3d31);
    px(g, 1, 8, 30, 6, 0x5a3d31);
    const books = [0xc8553d, 0x4a7fb5, 0xf6c343, 0x6cb84e, 0x9b59b6];
    for (let i = 0; i < 12; i++) {
      px(g, 2 + i * 2.4, 2 + (i % 3 === 0 ? 1 : 0), 2, 5 - (i % 3 === 0 ? 1 : 0), books[i % books.length]);
      px(g, 3 + i * 2.2, 9, 2, 5, books[(i + 2) % books.length]);
    }
  });
  make(scene, 'plant', TILE, TILE, (g) => {
    px(g, 5, 10, 6, 5, 0xb5651d);
    px(g, 4, 3, 8, 8, C.leaf);
    px(g, 6, 1, 4, 3, C.leafLight);
  });
  // 책상: 64x40 (2타일 너비, 위로 약간 솟음)
  make(scene, 'desk', 64, 40, (g) => {
    px(g, 1, 17, 30, 3, 0x000000, 0.15);
    px(g, 0, 4, 32, 6, C.wood);
    px(g, 0, 4, 32, 1, 0xd29a64);
    px(g, 1, 10, 2, 9, C.woodDark);
    px(g, 29, 10, 2, 9, C.woodDark);
    px(g, 20, 10, 9, 6, C.woodDark);
    px(g, 24, 12, 2, 1, 0xf6c343);
    // 책과 공책
    px(g, 4, 1, 7, 4, 0x4a7fb5);
    px(g, 5, 2, 5, 1, 0xffffff);
    px(g, 13, 2, 8, 3, 0xffffff);
    px(g, 14, 3, 6, 1, 0x9e9e9e);
    px(g, 24, 0, 2, 5, 0x6b6b6b); // 스탠드
    px(g, 22, 0, 6, 1, 0xf6c343);
  });
  make(scene, 'chair', TILE, TILE, (g) => {
    px(g, 4, 2, 8, 3, C.woodDark);
    px(g, 4, 5, 8, 5, C.wood);
    px(g, 4, 10, 1, 4, C.woodDark);
    px(g, 11, 10, 1, 4, C.woodDark);
  });

  // ── 캐릭터 ────────────────────────────────────────
  // 플레이어: 정면(down)/뒷면(up) 각각 걷기 2프레임. 32x32, 발이 아래쪽.
  for (const facing of ['down', 'up'] as const) {
    for (let f = 0; f < 2; f++) {
      make(scene, `player-${facing}-${f}`, 32, 32, (g) => drawPerson(g, facing, f, {
        hair: 0x3b2a20, shirt: 0x3f7fbf, shirtDark: 0x2f6399, pants: 0x3a3f58, scarf: null,
      }));
    }
  }
  // 주민 라일라: 히잡을 쓴 모습. 대기 2프레임.
  for (let f = 0; f < 2; f++) {
    make(scene, `layla-${f}`, 32, 32, (g) => drawPerson(g, 'down', f === 0 ? 0 : 2, {
      hair: 0x3b2a20, shirt: 0xd9824b, shirtDark: 0xb86a39, pants: 0x7b4f8e, scarf: 0x2e9c8f,
    }));
  }

  // ── 표시용 ────────────────────────────────────────
  make(scene, 'shadow', 20, 8, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(10, 4, 20, 8);
  });
  make(scene, 'player-ring', 28, 12, (g) => {
    g.lineStyle(2, 0xfff27a, 1);
    g.strokeEllipse(14, 6, 24, 9);
  });
  make(scene, 'target-marker', 20, 12, (g) => {
    g.lineStyle(2, 0xffffff, 1);
    g.strokeEllipse(10, 6, 16, 8);
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(10, 6, 8, 4);
  });
  make(scene, 'talk-icon', 16, 14, (g) => {
    px(g, 0, 0, 8, 5, 0xffffff);
    px(g, 1, 5, 2, 2, 0xffffff);
    px(g, 1, 2, 1, 1, 0x3b2a20);
    px(g, 3, 2, 1, 1, 0x3b2a20);
    px(g, 5, 2, 1, 1, 0x3b2a20);
  });
}

interface Palette {
  hair: number;
  shirt: number;
  shirtDark: number;
  pants: number;
  scarf: number | null;
}

/** 16x16 도트 사람. step: 0 = 서기, 1 = 걷기(다리 교차), 2 = 숨쉬기(살짝 내려감) */
function drawPerson(g: G, facing: 'down' | 'up', step: number, c: Palette): void {
  const bob = step === 2 ? 1 : 0;
  // 다리
  if (step === 1) {
    px(g, 5, 12, 2, 3, c.pants);
    px(g, 9, 11, 2, 3, c.pants);
    px(g, 5, 15, 2, 1, C.outline);
    px(g, 9, 14, 2, 1, C.outline);
  } else {
    px(g, 5, 12, 2, 3, c.pants);
    px(g, 9, 12, 2, 3, c.pants);
    px(g, 5, 15, 2, 1, C.outline);
    px(g, 9, 15, 2, 1, C.outline);
  }
  // 몸통
  px(g, 4, 7 + bob, 8, 6 - bob, c.shirt);
  px(g, 4, 11, 8, 1, c.shirtDark);
  px(g, 3, 8 + bob, 1, 4, C.skin);
  px(g, 12, 8 + bob, 1, 4, C.skin);
  // 머리
  const hy = bob;
  if (c.scarf !== null) {
    px(g, 4, 1 + hy, 8, 7, c.scarf);
    px(g, 3, 3 + hy, 10, 6, c.scarf);
    if (facing === 'down') {
      px(g, 5, 3 + hy, 6, 4, C.skin);
      px(g, 6, 4 + hy, 1, 1, C.outline);
      px(g, 9, 4 + hy, 1, 1, C.outline);
      px(g, 7, 6 + hy, 2, 1, C.skinDark);
    }
  } else {
    px(g, 4, 1 + hy, 8, 6, C.skin);
    px(g, 4, 0 + hy, 8, 2, c.hair);
    px(g, 3, 1 + hy, 1, 4, c.hair);
    px(g, 12, 1 + hy, 1, 4, c.hair);
    if (facing === 'down') {
      px(g, 4, 2 + hy, 8, 1, c.hair);
      px(g, 6, 4 + hy, 1, 1, C.outline);
      px(g, 9, 4 + hy, 1, 1, C.outline);
      px(g, 7, 6 + hy, 2, 1, C.skinDark);
    } else {
      px(g, 4, 1 + hy, 8, 6, c.hair);
    }
  }
}
