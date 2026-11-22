/** Shared game vocabulary. This module must stay free of three.js imports. */

export type WorldId =
  | 'tropical'
  | 'cyberpunk'
  | 'temple'
  | 'space'
  | 'lava'
  | 'crystal'
  | 'frozen';

export type RewardKind = 'coin' | 'energy' | 'diamond' | 'chest' | 'legendary';
export type HazardKind = 'bomb' | 'meteor' | 'electric' | 'spike' | 'enemy';
export type PowerUpKind = 'shield' | 'magnet' | 'slow' | 'double' | 'speed' | 'invincible';
export type SpawnKind = RewardKind | HazardKind | PowerUpKind;

export type GameModeId = 'endless' | 'time' | 'mission' | 'boss' | 'daily';

export type RunPhase = 'idle' | 'countdown' | 'playing' | 'paused' | 'victory' | 'defeat';

export type AnimState =
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

export interface PowerUpState {
  kind: PowerUpKind;
  remaining: number;
  duration: number;
}

export interface MissionProgress {
  text: string;
  current: number;
  target: number;
  complete: boolean;
}

export interface HudSnapshot {
  phase: RunPhase;
  score: number;
  coins: number;
  health: number;
  maxHealth: number;
  lives: number;
  maxLives: number;
  level: number;
  combo: number;
  multiplier: number;
  bestCombo: number;
  powerups: PowerUpState[];
  timeLeft: number | null;
  elapsed: number;
  bossHp: number | null;
  bossMaxHp: number | null;
  mission: MissionProgress | null;
  wave: number;
  stage: number;
  fps: number;
}

export interface RunResult {
  runId: string;
  mode: GameModeId;
  world: WorldId;
  score: number;
  coins: number;
  xp: number;
  survivedSec: number;
  maxCombo: number;
  rewards: number;
  victory: boolean;
  stage: number;
  newBest: boolean;
}

export const REWARD_KINDS: RewardKind[] = ['coin', 'energy', 'diamond', 'chest', 'legendary'];
export const HAZARD_KINDS: HazardKind[] = ['bomb', 'meteor', 'electric', 'spike', 'enemy'];
export const POWERUP_KINDS: PowerUpKind[] = [
  'shield',
  'magnet',
  'slow',
  'double',
  'speed',
  'invincible',
];

export function isReward(kind: SpawnKind): kind is RewardKind {
  return (REWARD_KINDS as string[]).includes(kind);
}

export function isHazard(kind: SpawnKind): kind is HazardKind {
  return (HAZARD_KINDS as string[]).includes(kind);
}

export function isPowerUp(kind: SpawnKind): kind is PowerUpKind {
  return (POWERUP_KINDS as string[]).includes(kind);
}
