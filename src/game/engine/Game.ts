import * as THREE from 'three';
import { audio } from '../audio/AudioManager';
import { overlaps } from '../core/collision';
import {
  comboDecay,
  comboMultiplier,
  difficultyFor,
  REWARD_COIN_VALUE,
  scoreReward,
  SLOW_MOTION_FACTOR,
  survivalScore,
} from '../core/difficulty';
import { getStage } from '../core/evolution';
import { MODES } from '../core/modes';
import { POWERUPS } from '../core/profile';
import { mulberry32, type Rng } from '../core/rng';
import {
  HAZARD_KINDS,
  isHazard,
  isPowerUp,
  isReward,
  POWERUP_KINDS,
  type GameModeId,
  type HazardKind,
  type HudSnapshot,
  type PowerUpKind,
  type PowerUpState,
  type RewardKind,
  type RunResult,
  type SpawnKind,
  type WorldId,
} from '../core/types';
import { getWorld, type WorldDef } from '../core/worlds';
import { InputController } from '../input/InputController';
import { DigoCharacter } from '../three/character';
import { Environment } from '../three/environment';
import { ObjectFactory } from '../three/objects';
import { ParticleSystem } from '../three/particles';

export type GameEvent =
  | { type: 'reward'; kind: RewardKind; combo: number; points: number }
  | { type: 'damage'; health: number }
  | { type: 'lifeLost'; lives: number }
  | { type: 'blocked'; kind: HazardKind }
  | { type: 'powerup'; kind: PowerUpKind }
  | { type: 'level'; level: number }
  | { type: 'bossSpawn'; hp: number }
  | { type: 'bossHit'; hp: number }
  | { type: 'bossDefeated' }
  | { type: 'objective'; text: string }
  | { type: 'gameover'; result: RunResult };

export interface GameCallbacks {
  onHud: (hud: HudSnapshot) => void;
  onEvent: (event: GameEvent) => void;
  onFinish: (result: RunResult) => void;
}

export interface GameConfig {
  canvas: HTMLCanvasElement;
  surface: HTMLElement;
  world: WorldId;
  mode: GameModeId;
  stageIndex: number;
  sensitivity: number;
  seed?: number;
  callbacks: GameCallbacks;
}

interface ActiveObject {
  kind: SpawnKind;
  group: THREE.Group;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  seed: number;
  age: number;
  fromBoss: boolean;
}

interface BossState {
  group: THREE.Group;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  attackTimer: number;
  ttl: number;
  age: number;
}

const RADIUS: Record<SpawnKind, number> = {
  coin: 0.55,
  energy: 0.52,
  diamond: 0.56,
  chest: 0.62,
  legendary: 0.66,
  bomb: 0.62,
  meteor: 0.64,
  electric: 0.56,
  spike: 0.6,
  enemy: 0.58,
  shield: 0.52,
  magnet: 0.52,
  slow: 0.52,
  double: 0.52,
  speed: 0.52,
  invincible: 0.52,
};

const PLAYER_RADIUS = 0.52;
const CAMERA_FOV = 50;
const CAMERA_Z = 16;
const LEVEL_COOLDOWN = 20;

export class Game {
  private readonly cfg: GameConfig;
  private readonly world: WorldDef;
  private readonly mode = MODES[0];
  private readonly rng: Rng;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private environment: Environment;
  private character: DigoCharacter;
  private factory: ObjectFactory;
  private particles: ParticleSystem;
  private input: InputController;

  private objects: ActiveObject[] = [];
  private pool = new Map<SpawnKind, THREE.Group[]>();
  private boss: BossState | null = null;

  private phase: 'playing' | 'paused' | 'victory' | 'defeat' = 'playing';
  private disposed = false;
  private frameId = 0;
  private lastTime = 0;
  private hudTimer = 0;
  private fps = 60;

  private halfWidth = 3.4;
  private halfHeight = 7.4;
  private groundY = -4.3;
  private spawnY = 7.2;
  private killY = -7.6;

  private playerX = 0;
  private playerVX = 0;
  private playerPrevX = 0;

  private score = 0;
  private coins = 0;
  private health = 3;
  private maxHealth = 3;
  private lives = 3;
  private maxLives = 3;
  private combo = 0;
  private bestCombo = 0;
  private elapsed = 0;
  private level = 1;
  private wave = 1;
  private invuln = 0;
  private lastPickupAge = 0;
  private spawnTimer = 0.6;
  private powerTimer = 6;
  private bossWaves = 0;
  private shake = 0;
  private powerups = new Map<PowerUpKind, number>();
  private stage = getStage(0);
  private characterAnim = 'idle';
  private runId = '';

  constructor(config: GameConfig) {
    this.cfg = config;
    this.world = getWorld(config.world);
    this.mode = MODES.find((m) => m.id === config.mode) ?? MODES[0];
    const seed =
      config.seed ??
      (this.mode.seeded ? Math.floor(Date.now() / 86_400_000) : Math.floor(Math.random() * 1e9));
    this.rng = mulberry32(seed);
    this.runId = `${Date.now().toString(36)}-${Math.floor(this.rng() * 1e6).toString(36)}`;

    this.stage = getStage(config.stageIndex);
    this.maxLives = this.mode.lives;
    this.lives = this.mode.lives;
    this.maxHealth = 3 + this.stage.perk.maxHealthBonus;
    this.health = this.maxHealth;

    this.renderer = new THREE.WebGLRenderer({
      canvas: config.canvas,
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(new THREE.Color(this.world.skyBottom), 1);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 120);
    this.camera.position.set(0, 0, CAMERA_Z);
    this.camera.lookAt(0, 0, 0);

    this.environment = new Environment(this.world);
    this.environment.applyTo(this.scene);
    this.scene.add(this.environment.group);

    this.character = new DigoCharacter(this.stage);
    this.scene.add(this.character.group);

    this.factory = new ObjectFactory(this.world);
    this.particles = new ParticleSystem(460);
    this.scene.add(this.particles.points);

    this.input = new InputController({
      getHalfWidth: () => this.halfWidth,
      getPlayerX: () => this.playerX,
      getScale: () =>
        (this.halfWidth * 2) / Math.max(1, this.cfg.surface.clientWidth || window.innerWidth),
      sensitivity: config.sensitivity,
    });

    this.resize();
    this.character.group.position.set(0, this.groundY + 0.55, 0);
  }

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  start(): void {
    this.input.attach(this.cfg.surface);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.lastTime = performance.now();
    this.emitHud();
    this.frameId = requestAnimationFrame(this.loop);
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.input.setEnabled(false);
    this.emitHud();
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.input.setEnabled(true);
    this.input.reset();
    this.lastTime = performance.now();
    this.emitHud();
  }

  get isPaused(): boolean {
    return this.phase === 'paused';
  }

  /** Bridge for the on-screen D-pad: -1 left, +1 right, 0 released. */
  setButtonAxis(axis: number): void {
    this.input.setButtonAxis(axis);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.detach();
    for (const object of this.objects) object.group.removeFromParent();
    this.objects = [];
    this.pool.forEach((groups) => groups.forEach((g) => g.removeFromParent()));
    this.pool.clear();
    if (this.boss) this.boss.group.removeFromParent();
    this.boss = null;
    this.environment.dispose();
    this.character.dispose();
    this.factory.dispose();
    this.particles.dispose();
    this.scene.clear();
    this.renderer.dispose();
  }

  private onVisibility = (): void => {
    if (document.hidden) this.pause();
  };

  private resize = (): void => {
    const canvas = this.cfg.canvas;
    const parent = canvas.parentElement;
    const width = Math.max(240, parent?.clientWidth ?? window.innerWidth);
    const height = Math.max(320, parent?.clientHeight ?? window.innerHeight);
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.halfHeight = Math.tan((CAMERA_FOV / 2) * (Math.PI / 180)) * CAMERA_Z;
    const visibleHalfWidth = this.halfHeight * aspect;
    this.halfWidth = Math.min(Math.max(visibleHalfWidth * 0.9, 2.9), 5.6);
    this.groundY = -this.halfHeight * 0.58;
    this.spawnY = this.halfHeight * 0.98;
    this.killY = -this.halfHeight * 1.02;
    this.playerX = Math.max(-this.halfWidth, Math.min(this.halfWidth, this.playerX));
    this.character.group.position.y = this.groundY + 0.55;
  };

  /* ------------------------------------------------------------------ */
  /* main loop                                                          */
  /* ------------------------------------------------------------------ */

  private loop = (now: number): void => {
    if (this.disposed) return;
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt > 0 ? rawDt : 0.016, 0.05);
    this.fps = this.fps * 0.92 + (1 / Math.max(dt, 0.0001)) * 0.08;

    if (this.phase === 'playing') this.update(dt);
    this.render(dt);

    this.hudTimer += dt;
    if (this.hudTimer >= 0.08) {
      this.hudTimer = 0;
      this.emitHud();
    }
    this.frameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.elapsed += dt;
    const diff = difficultyFor(this.elapsed, this.mode.difficultyScale);

    if (diff.level !== this.level) {
      this.level = diff.level;
      this.onLevelUp();
    }
    this.wave = diff.wave;

    // power-up timers
    for (const [kind, remaining] of Array.from(this.powerups.entries())) {
      const next = remaining - dt;
      if (next <= 0) this.powerups.delete(kind);
      else this.powerups.set(kind, next);
    }
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    this.lastPickupAge += dt;
    if (this.lastPickupAge > 2.4) {
      this.combo = comboDecay(this.combo, this.lastPickupAge);
    }

    this.score += survivalScore(dt, this.level, this.hasPower('double'));

    this.updatePlayer(dt);
    this.updateSpawning(dt, diff);
    this.updateObjects(dt, diff);
    this.updateBoss(dt);
    this.checkObjective();
  }

  private updatePlayer(dt: number): void {
    const target = this.input.getTargetX();
    const speedBoost = this.hasPower('speed') ? 1.6 : 1;
    if (target !== null) {
      const follow = Math.min(1, dt * 13 * speedBoost);
      this.playerX += (target - this.playerX) * follow;
    }
    this.playerX = Math.max(-this.halfWidth, Math.min(this.halfWidth, this.playerX));
    this.playerVX = (this.playerX - this.playerPrevX) / Math.max(dt, 0.0001);
    this.playerPrevX = this.playerX;

    this.character.group.position.x = this.playerX;
    this.character.group.position.y = this.groundY + 0.55;

    let state = this.characterAnim as
      | 'idle'
      | 'run'
      | 'left'
      | 'right'
      | 'dodge'
      | 'collect'
      | 'damage'
      | 'jump'
      | 'victory'
      | 'defeat';
    if (this.phase === 'victory') state = 'victory';
    else if (this.phase === 'defeat') state = 'defeat';
    else {
      const speed = Math.abs(this.playerVX);
      if (speed > 3.4) state = this.playerVX > 0 ? 'right' : 'left';
      else if (speed > 0.5) state = 'run';
      else state = 'idle';
    }
    this.characterAnim = state;
    this.character.update(dt, state, this.playerVX, 0);

    if (this.invuln > 0) {
      this.character.group.visible = Math.floor(this.invuln * 12) % 2 === 0;
    } else {
      this.character.group.visible = true;
    }
  }

  /* ------------------------------------------------------------------ */
  /* spawning                                                           */
  /* ------------------------------------------------------------------ */

  private pickWeighted<T extends string>(weights: Partial<Record<T, number>>, fallback: T[]): T {
    const entries = Object.entries(weights) as [T, number][];
    const total = entries.reduce((sum, [, w]) => sum + (w ?? 0), 0);
    if (total <= 0) return fallback[Math.floor(this.rng() * fallback.length)];
    let roll = this.rng() * total;
    for (const [key, weight] of entries) {
      roll -= weight ?? 0;
      if (roll <= 0) return key;
    }
    return entries[0][0];
  }

  private updateSpawning(dt: number, diff: ReturnType<typeof difficultyFor>): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.objects.length < diff.maxObjects) {
      const hazard = this.rng() < diff.hazardChance;
      const kind = hazard
        ? this.pickWeighted<HazardKind>(this.world.hazardWeights, HAZARD_KINDS)
        : this.pickWeighted<RewardKind>(this.world.rewardWeights, [
            'coin',
            'energy',
            'diamond',
            'chest',
            'legendary',
          ]);
      this.spawnObject(kind);
      this.spawnTimer = diff.spawnInterval * (0.7 + this.rng() * 0.6);
    }

    this.powerTimer -= dt;
    if (this.powerTimer <= 0) {
      const kind = POWERUP_KINDS[Math.floor(this.rng() * POWERUP_KINDS.length)];
      this.spawnObject(kind);
      this.powerTimer = diff.powerUpInterval;
    }
  }

  private spawnObject(kind: SpawnKind, x?: number, y?: number, fromBoss = false): void {
    const group = this.acquire(kind);
    const radius = RADIUS[kind];
    const spread = Math.max(0.5, this.halfWidth - radius);
    const object: ActiveObject = {
      kind,
      group,
      x: x ?? (this.rng() * 2 - 1) * spread,
      y: y ?? this.spawnY,
      vx: 0,
      vy: 0,
      radius,
      seed: this.rng() * 100,
      age: 0,
      fromBoss,
    };

    const diff = difficultyFor(this.elapsed, this.mode.difficultyScale);
    const speedJitter = 0.85 + this.rng() * 0.45;
    if (isHazard(kind)) {
      object.vy = diff.fallSpeed * 1.08 * speedJitter;
      if (kind === 'enemy') object.vx = (this.rng() > 0.5 ? 1 : -1) * diff.driftSpeed;
      if (kind === 'bomb' && !fromBoss) audio.play('bombWarn');
    } else if (isPowerUp(kind)) {
      object.vy = diff.fallSpeed * 0.62;
    } else {
      object.vy = diff.fallSpeed * 0.92 * speedJitter;
      if (kind === 'legendary') object.vy *= 0.7;
    }
    if (fromBoss) object.vy *= 0.85;

    object.x = Math.max(-this.halfWidth + radius, Math.min(this.halfWidth - radius, object.x));
    group.position.set(object.x, object.y, 0);
    group.visible = true;
    this.scene.add(group);
    this.objects.push(object);

    if (kind === 'legendary') {
      this.particles.emit(object.x, object.y, this.world.accent, 22, 3, { life: 0.9 });
    }
  }

  private acquire(kind: SpawnKind): THREE.Group {
    const pooled = this.pool.get(kind);
    if (pooled && pooled.length > 0) {
      const group = pooled.pop() as THREE.Group;
      group.visible = true;
      return group;
    }
    return this.factory.create(kind);
  }

  private release(object: ActiveObject): void {
    object.group.removeFromParent();
    object.group.visible = false;
    const pooled = this.pool.get(object.kind) ?? [];
    if (pooled.length < 18) pooled.push(object.group);
    this.pool.set(object.kind, pooled);
  }

  /* ------------------------------------------------------------------ */
  /* physics + collisions                                               */
  /* ------------------------------------------------------------------ */

  private updateObjects(dt: number, diff: ReturnType<typeof difficultyFor>): void {
    const slow = this.hasPower('slow') ? SLOW_MOTION_FACTOR : 1;
    const magnet = this.hasPower('magnet');
    const magnetRadius = 2.8 + this.stage.perk.magnetRadius;
    const player = { x: this.playerX, y: this.groundY + 0.55, r: PLAYER_RADIUS };
    const remove: ActiveObject[] = [];

    for (const object of this.objects) {
      object.age += dt;
      object.y -= object.vy * dt * slow;

      if (object.kind === 'enemy') {
        object.x += Math.sin(object.age * 2.4 + object.seed) * object.vx * dt * 1.6;
        object.x = Math.max(-this.halfWidth, Math.min(this.halfWidth, object.x));
      } else if (isReward(object.kind) && magnet) {
        const dx = player.x - object.x;
        const dy = player.y - object.y;
        const dist = Math.hypot(dx, dy);
        if (dist < magnetRadius && dist > 0.01) {
          const pull = 6.5 * dt * (1 - dist / magnetRadius + 0.4);
          object.x += (dx / dist) * pull;
          object.y += (dy / dist) * pull;
        }
      }

      object.group.position.set(object.x, object.y, 0);
      this.factory.animate(object.group, object.age, object.seed);

      // trail particles for valuable objects
      if (isReward(object.kind) && object.age > 0.05) {
        const color =
          object.kind === 'coin'
            ? '#ffd54a'
            : object.kind === 'diamond'
              ? '#66e0ff'
              : object.kind === 'energy'
                ? '#5cff9d'
                : object.kind === 'legendary'
                  ? '#c07bff'
                  : this.world.accent;
        if (this.rng() < 0.25) {
          this.particles.emit(object.x, object.y + 0.3, color, 1, 0.4, { life: 0.4, size: 0.2 });
        }
      }

      if (object.y < this.killY) {
        if (object.fromBoss) this.damageBoss(3);
        if (isReward(object.kind)) this.combo = comboDecay(this.combo, 99);
        remove.push(object);
        continue;
      }

      if (overlaps(player, { x: object.x, y: object.y, r: object.radius })) {
        const consumed = this.handleContact(object);
        if (consumed) remove.push(object);
      }
    }

    if (remove.length > 0) {
      this.objects = this.objects.filter((object) => !remove.includes(object));
      for (const object of remove) this.release(object);
    }

    this.environment.update(dt, diff.fallSpeed / 6);
  }

  /** Returns true when the object should be removed from play. */
  private handleContact(object: ActiveObject): boolean {
    const isPower = isPowerUp(object.kind);

    if (isReward(object.kind)) {
      const kind = object.kind;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.lastPickupAge = 0;
      const points = Math.round(
        scoreReward(kind, this.combo, this.hasPower('double')) * this.mode.rewardMultiplier,
      );
      this.score += points;
      this.coins += REWARD_COIN_VALUE[kind];
      this.particles.burst(object.x, object.y, rewardColor(kind), 14, 3.2);
      this.character.playOneShot('collect', 0.42);
      if (kind === 'legendary' || kind === 'chest') audio.play(kind);
      else audio.play(kind === 'diamond' ? 'diamond' : kind === 'energy' ? 'energy' : 'coin', this.combo);
      this.cfg.callbacks.onEvent({ type: 'reward', kind, combo: this.combo, points });
      return true;
    }

    if (isPowerUp(object.kind)) {
      const kind = object.kind;
      this.activatePower(kind);
      this.particles.burst(object.x, object.y, POWERUPS[kind].color, 18, 3.4);
      return true;
    }

    // hazard
    const kind = object.kind as HazardKind;
    if (this.hasPower('invincible')) {
      this.particles.burst(object.x, object.y, '#ffe066', 16, 3.6);
      audio.play('shield');
      this.cfg.callbacks.onEvent({ type: 'blocked', kind });
      return true;
    }
    if (this.hasPower('shield')) {
      this.powerups.delete('shield');
      this.particles.burst(object.x, object.y, POWERUPS.shield.color, 20, 3.8);
      audio.play('shield');
      this.cfg.callbacks.onEvent({ type: 'blocked', kind });
      this.shake = 0.35;
      return true;
    }
    if (this.invuln > 0) return false;

    this.takeDamage(kind, object.x, object.y);
    return true;
  }

  private takeDamage(kind: HazardKind, x: number, y: number): void {
    this.health -= 1;
    this.invuln = 1.5;
    this.combo = 0;
    this.lastPickupAge = 0;
    this.shake = 0.6;
    this.particles.burst(x, y, kind === 'electric' ? '#ff5a5a' : '#ff8a3d', 22, 4.2);
    this.character.playOneShot('damage', 0.6);
    this.character.setExpression('hurt', 0.9);
    audio.play(kind === 'bomb' || kind === 'meteor' ? 'explosion' : 'damage');

    if (this.health <= 0) {
      this.lives -= 1;
      if (this.lives > 0) {
        this.health = this.maxHealth;
        this.invuln = 2.4;
        this.cfg.callbacks.onEvent({ type: 'lifeLost', lives: this.lives });
        audio.play('defeat');
      } else {
        this.health = 0;
        this.endRun(false);
        return;
      }
    }
    this.cfg.callbacks.onEvent({ type: 'damage', health: this.health });
    this.emitHud();
  }

  private activatePower(kind: PowerUpKind): void {
    this.powerups.set(kind, POWERUPS[kind].duration);
    audio.play('powerup');
    this.character.setExpression('happy', 0.8);
    this.cfg.callbacks.onEvent({ type: 'powerup', kind });
  }

  private hasPower(kind: PowerUpKind): boolean {
    return (this.powerups.get(kind) ?? 0) > 0;
  }

  /* ------------------------------------------------------------------ */
  /* boss                                                               */
  /* ------------------------------------------------------------------ */

  private onLevelUp(): void {
    audio.play('levelUp');
    this.character.playOneShot('jump', 0.6);
    this.character.setExpression('happy', 1);
    this.particles.burst(this.playerX, this.groundY + 1, this.world.accent, 24, 4);
    this.cfg.callbacks.onEvent({ type: 'level', level: this.level });

    // rare reward shower on every level up
    for (let i = 0; i < 3; i += 1) {
      this.spawnObject(this.rng() > 0.6 ? 'legendary' : 'chest');
    }

    if (!this.mode.boss && this.level % 3 === 0 && !this.boss) {
      this.spawnBoss(30 + this.level * 8, 22);
    }
  }

  private spawnBoss(hp: number, ttl: number): void {
    if (this.boss) return;
    const group = this.factory.createBoss();
    group.position.set(0, this.halfHeight * 0.45, 0);
    this.scene.add(group);
    this.boss = {
      group,
      hp,
      maxHp: hp,
      x: 0,
      y: this.halfHeight * 0.45,
      attackTimer: 1.4,
      ttl,
      age: 0,
    };
    this.bossWaves += 1;
    audio.play('bombWarn');
    this.cfg.callbacks.onEvent({ type: 'bossSpawn', hp });
  }

  private updateBoss(dt: number): void {
    const boss = this.boss;
    if (!boss) return;
    boss.age += dt;
    boss.ttl -= dt;
    boss.x = Math.sin(boss.age * 0.7) * this.halfWidth * 0.62;
    boss.y = this.halfHeight * 0.45 + Math.sin(boss.age * 1.4) * 0.35;
    boss.group.position.set(boss.x, boss.y, 0);
    boss.group.rotation.z = Math.sin(boss.age * 0.9) * 0.12;

    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      boss.attackTimer = Math.max(0.55, 1.5 - this.elapsed * 0.004);
      const kind: HazardKind = this.rng() < 0.4 ? 'meteor' : 'bomb';
      this.spawnObject(kind, boss.x, boss.y - 0.8, true);
    }

    if (boss.ttl <= 0) {
      boss.group.removeFromParent();
      this.boss = null;
    }
  }

  private damageBoss(amount: number): void {
    const boss = this.boss;
    if (!boss) return;
    boss.hp = Math.max(0, boss.hp - amount);
    this.particles.burst(boss.x, boss.y, '#ff7b4a', 10, 2.6);
    this.cfg.callbacks.onEvent({ type: 'bossHit', hp: boss.hp });
    if (boss.hp <= 0) {
      this.particles.burst(boss.x, boss.y, '#ffd166', 40, 6);
      boss.group.removeFromParent();
      this.boss = null;
      audio.play('legendary');
      this.cfg.callbacks.onEvent({ type: 'bossDefeated' });
      if (this.mode.boss) {
        this.score += 500;
        this.endRun(true);
      } else {
        this.score += 300;
        for (let i = 0; i < 4; i += 1) this.spawnObject('legendary');
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* objectives + end                                                   */
  /* ------------------------------------------------------------------ */

  private missionProgress(): { text: string; current: number; target: number; complete: boolean } | null {
    const objective = this.mode.objective;
    if (!objective) return null;
    let current = 0;
    if (objective.type === 'coins') current = this.coins;
    else if (objective.type === 'score') current = this.score;
    else if (objective.type === 'combo') current = this.bestCombo;
    else if (objective.type === 'survive') current = Math.floor(this.elapsed);
    else if (objective.type === 'boss') current = this.boss ? this.boss.maxHp - this.boss.hp : this.mode.boss ? 0 : objective.target;
    return {
      text: objective.label,
      current: Math.round(current),
      target: objective.target,
      complete: current >= objective.target,
    };
  }

  private checkObjective(): void {
    if (this.phase !== 'playing') return;
    const duration = this.mode.duration;
    if (duration !== null && this.elapsed >= duration) {
      this.endRun(true);
      return;
    }
    const progress = this.missionProgress();
    if (progress && progress.complete && this.mode.objective?.type !== 'boss') {
      this.endRun(true);
    }
  }

  private endRun(victory: boolean): void {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.phase = victory ? 'victory' : 'defeat';
    this.input.setEnabled(false);
    this.character.setPose(victory ? 'victory' : 'defeat');
    this.character.setExpression(victory ? 'victory' : 'defeat');
    if (victory) {
      audio.play('victory');
      this.particles.burst(this.playerX, this.groundY + 1.2, this.world.accent, 36, 5);
    } else {
      audio.play('defeat');
      this.shake = 0.8;
    }

    const survivedSec = Math.round(this.elapsed);
    const result: RunResult = {
      runId: this.runId,
      mode: this.mode.id,
      world: this.world.id,
      score: Math.round(this.score),
      coins: this.coins,
      xp: runXp(this.score, this.coins, survivedSec, victory),
      survivedSec,
      maxCombo: this.bestCombo,
      rewards: this.coins,
      victory,
      stage: this.stage.index,
      newBest: false,
    };
    this.cfg.callbacks.onEvent({ type: 'gameover', result });
    this.cfg.callbacks.onFinish(result);
    this.emitHud();
  }

  /* ------------------------------------------------------------------ */
  /* rendering + hud                                                    */
  /* ------------------------------------------------------------------ */

  private render(dt: number): void {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.8);
      const amount = this.shake * 0.35;
      this.camera.position.x = (Math.random() - 0.5) * amount;
      this.camera.position.y = (Math.random() - 0.5) * amount;
    } else {
      this.camera.position.x *= 0.85;
      this.camera.position.y *= 0.85;
    }
    this.camera.lookAt(0, 0, 0);
    this.particles.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private emitHud(): void {
    const powerups: PowerUpState[] = Array.from(this.powerups.entries()).map(([kind, remaining]) => ({
      kind,
      remaining,
      duration: POWERUPS[kind].duration,
    }));
    const boss = this.boss;
    const hud: HudSnapshot = {
      phase: this.phase,
      score: Math.round(this.score),
      coins: this.coins,
      health: this.health,
      maxHealth: this.maxHealth,
      lives: this.lives,
      maxLives: this.maxLives,
      level: this.level,
      combo: this.combo,
      multiplier: comboMultiplier(this.combo),
      bestCombo: this.bestCombo,
      powerups,
      timeLeft:
        this.mode.duration === null ? null : Math.max(0, this.mode.duration - this.elapsed),
      elapsed: this.elapsed,
      bossHp: boss ? boss.hp : null,
      bossMaxHp: boss ? boss.maxHp : null,
      mission: this.missionProgress(),
      wave: this.wave,
      stage: this.stage.index,
      fps: Math.round(this.fps),
    };
    this.cfg.callbacks.onHud(hud);
  }
}

function rewardColor(kind: RewardKind): string {
  switch (kind) {
    case 'coin':
      return '#ffd54a';
    case 'diamond':
      return '#7fe4ff';
    case 'energy':
      return '#66ffa6';
    case 'chest':
      return '#ffb347';
    case 'legendary':
      return '#c07bff';
    default:
      return '#ffffff';
  }
}

// imported late to keep the module graph shallow
import { runXp } from '../core/evolution';
