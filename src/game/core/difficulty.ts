/** Difficulty curve: everything scales with elapsed survival time. */

export interface DifficultyState {
  elapsed: number;
  level: number;
  fallSpeed: number;
  spawnInterval: number;
  maxObjects: number;
  hazardChance: number;
  driftSpeed: number;
  enemyChance: number;
  wave: number;
  powerUpInterval: number;
}

const LEVEL_SECONDS = 20;

export function levelFor(elapsed: number): number {
  return 1 + Math.floor(Math.max(0, elapsed) / LEVEL_SECONDS);
}

export function waveFor(elapsed: number): number {
  return Math.floor(Math.max(0, elapsed) / 25);
}

export function isWaveStart(elapsed: number): boolean {
  const wave = waveFor(elapsed);
  if (wave <= 0) return false;
  return Math.abs(elapsed - wave * 25) < 0.06;
}

/**
 * @param elapsed survival seconds
 * @param scale mode difficulty multiplier (1 = endless)
 */
export function difficultyFor(elapsed: number, scale = 1): DifficultyState {
  const e = Math.max(0, elapsed);
  const safeScale = Math.max(0.4, Math.min(2.5, scale));
  const fallSpeed = Math.min(5.6 + e * 0.055, 15.8) * safeScale;
  const spawnInterval = Math.max(0.9 - e * 0.0032, 0.26) / Math.max(0.8, safeScale * 0.95);
  const maxObjects = Math.min(6 + Math.floor(e / 14), 28);
  const hazardChance = Math.min(0.42 + e * 0.0012, 0.68);
  const driftSpeed = 0.5 + e * 0.018;
  const enemyChance = Math.min(0.05 + e * 0.0012, 0.2);
  const powerUpInterval = Math.max(9, 15 - e * 0.02);

  return {
    elapsed: e,
    level: levelFor(e),
    fallSpeed,
    spawnInterval,
    maxObjects,
    hazardChance,
    driftSpeed,
    enemyChance,
    wave: waveFor(e),
    powerUpInterval,
  };
}

/** Slow-motion power-up multiplier applied to falling object motion. */
export const SLOW_MOTION_FACTOR = 0.42;

/** Reward value tables used by the score system. */
export const REWARD_VALUES = {
  coin: 10,
  energy: 20,
  diamond: 35,
  chest: 80,
  legendary: 220,
} as const;

export const REWARD_COIN_VALUE = {
  coin: 1,
  energy: 2,
  diamond: 3,
  chest: 6,
  legendary: 15,
} as const;

export function comboMultiplier(combo: number): number {
  return 1 + Math.min(Math.max(0, combo), 25) * 0.04;
}

export function scoreReward(
  kind: keyof typeof REWARD_VALUES,
  combo: number,
  doubleReward: boolean,
): number {
  const base = REWARD_VALUES[kind];
  const multiplier = comboMultiplier(combo) * (doubleReward ? 2 : 1);
  return Math.round(base * multiplier);
}

export function survivalScore(dt: number, level: number, doubleReward: boolean): number {
  return dt * (2 + level * 0.6) * (doubleReward ? 2 : 1);
}

export function comboDecay(combo: number, idleSeconds: number): number {
  if (idleSeconds < 2.5) return combo;
  return Math.max(0, combo - Math.ceil((idleSeconds - 2.5) * 4));
}
