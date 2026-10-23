import Phaser from 'phaser';
import { DEPTH, PLAYER_SPEED } from '../config';
import { BODY_HALF_H, BODY_HALF_W, type Point } from '../world/Grid';

/** 스프라이트 아래끝에서 발(충돌 박스 중심)까지의 거리. */
const FEET_OFFSET = BODY_HALF_H;
const FRAME_MS = 160;
/** 이 시간 동안 다음 지점에 2px도 가까워지지 못하면 막힌 것으로 보고 멈춘다. */
const STUCK_MS = 500;

type Facing = 'down' | 'up';

/**
 * 목적지 지정 이동을 하는 플레이어.
 * 경로(지점 목록)를 받아 일정한 속도로 따라가며, 실제 충돌은 Arcade 물리 바디가 처리한다.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private waypoints: Point[] = [];
  private onArrive: (() => void) | null = null;
  private facing: Facing = 'down';
  private animTime = 0;
  private stuckTime = 0;
  private lastDist = Infinity;

  private readonly shadow: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, feet: Point, name: string) {
    super(scene, feet.x, feet.y + FEET_OFFSET, 'player-down-0');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.body.setSize(BODY_HALF_W * 2, BODY_HALF_H * 2);
    this.body.setOffset(16 - BODY_HALF_W, 32 - BODY_HALF_H * 2);
    this.setCollideWorldBounds(true);

    // 플레이어 위치를 쉽게 알아볼 수 있도록: 발밑 노란 고리 + 머리 위 이름표
    this.shadow = scene.add.image(0, 0, 'shadow');
    this.ring = scene.add.image(0, 0, 'player-ring').setDepth(DEPTH.marker);
    scene.tweens.add({ targets: this.ring, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    this.label = scene.add
      .text(0, 0, name, {
        fontFamily: '"Noto Naskh Arabic", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        stroke: '#3b2a20',
        strokeThickness: 3,
        resolution: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.label);

    this.syncAttachments();
  }

  /** 발(충돌 박스 중심) 위치. 경로 탐색은 모두 이 좌표를 기준으로 한다. */
  get feet(): Point {
    return { x: this.x, y: this.y - FEET_OFFSET };
  }

  get isMoving(): boolean {
    return this.waypoints.length > 0;
  }

  /** 새 경로로 이동. 이동 중에 호출하면 이전 목적지와 도착 콜백은 버린다. */
  walk(points: Point[], onArrive?: () => void): void {
    this.waypoints = points.slice();
    this.onArrive = onArrive ?? null;
    this.stuckTime = 0;
    this.lastDist = Infinity;
    if (this.waypoints.length === 0) this.arrive();
  }

  halt(): void {
    this.waypoints = [];
    this.onArrive = null;
    this.body.setVelocity(0, 0);
  }

  face(target: Point): void {
    const dx = target.x - this.x;
    const dy = target.y - this.feet.y;
    this.facing = dy < 0 && Math.abs(dy) >= Math.abs(dx) ? 'up' : 'down';
    this.setFlipX(dx < 0 && Math.abs(dx) > 2);
    this.setTexture(`player-${this.facing}-0`);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.followPath(delta);
    this.animate(delta);
    this.syncAttachments();
  }

  private followPath(delta: number): void {
    if (this.waypoints.length === 0) return;
    const target = this.waypoints[0];
    const { x, y } = this.feet;
    const dx = target.x - x;
    const dy = target.y - y;
    const dist = Math.hypot(dx, dy);
    const step = (PLAYER_SPEED * delta) / 1000;

    if (dist <= step + 0.5) {
      // 목적지에 정확히 맞춰 세운다.
      this.body.reset(target.x, target.y + FEET_OFFSET);
      this.waypoints.shift();
      this.lastDist = Infinity;
      this.stuckTime = 0;
      if (this.waypoints.length === 0) this.arrive();
      return;
    }

    // 대각선을 포함한 모든 방향에서 같은 속도가 되도록 정규화한다.
    this.body.setVelocity((dx / dist) * PLAYER_SPEED, (dy / dist) * PLAYER_SPEED);
    if (Math.abs(dy) > Math.abs(dx) * 1.2) this.facing = dy < 0 ? 'up' : 'down';
    else this.facing = 'down';
    if (Math.abs(dx) > 1) this.setFlipX(dx < 0);

    // 물리 충돌로 막혀 더 나아가지 못하면 멈춘다 (경로 탐색이 있어 보통은 일어나지 않는다).
    if (dist < this.lastDist - 2) {
      this.lastDist = dist;
      this.stuckTime = 0;
    } else {
      this.stuckTime += delta;
      if (this.stuckTime > STUCK_MS) this.halt();
    }
  }

  private arrive(): void {
    this.body.setVelocity(0, 0);
    const cb = this.onArrive;
    this.onArrive = null;
    this.setTexture(`player-${this.facing}-0`);
    cb?.();
  }

  private animate(delta: number): void {
    if (!this.isMoving) return;
    this.animTime += delta;
    const frame = Math.floor(this.animTime / FRAME_MS) % 2;
    this.setTexture(`player-${this.facing}-${frame}`);
  }

  private syncAttachments(): void {
    const { x, y } = this.feet;
    this.setDepth(DEPTH.sorted + y);
    this.shadow.setPosition(x, y + 2).setDepth(DEPTH.sorted + y - 1);
    this.ring.setPosition(x, y + 2);
    this.label.setPosition(x, this.y - 32);
  }

  destroy(fromScene?: boolean): void {
    this.shadow?.destroy();
    this.ring?.destroy();
    this.label?.destroy();
    super.destroy(fromScene);
  }
}
