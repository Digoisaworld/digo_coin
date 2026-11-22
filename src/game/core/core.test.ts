import { describe, expect, it } from 'vitest';
import { CollisionTracker, overlaps } from './collision';
import {
  comboDecay,
  comboMultiplier,
  difficultyFor,
  levelFor,
  REWARD_COIN_VALUE,
  scoreReward,
  survivalScore,
} from './difficulty';
import { EVOLUTION_STAGES, evolutionProgress, runXp, stageForXp } from './evolution';
import { mulberry32 } from './rng';

describe('collision', () => {
  it('detects overlapping circles only', () => {
    expect(overlaps({ x: 0, y: 0, r: 1 }, { x: 1, y: 0, r: 1 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, r: 0.5 }, { x: 3, y: 0, r: 0.5 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, r: 2 }, { x: 0, y: 3.9, r: 2 })).toBe(true);
  });

  it('reports a hit for a given object exactly once', () => {
    const tracker = new CollisionTracker();
    expect(tracker.isFirstContact(1)).toBe(true);
    expect(tracker.isFirstContact(1)).toBe(false);
    expect(tracker.isFirstContact(2)).toBe(true);
    tracker.release(1);
    expect(tracker.isFirstContact(1)).toBe(true);
  });
});

describe('difficulty curve', () => {
  it('levels up every 20 seconds and keeps climbing', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(19.9)).toBe(1);
    expect(levelFor(20)).toBe(2);
    expect(levelFor(200)).toBe(11);
  });

  it('increases speed, spawn rate and hazard density over time', () => {
    const early = difficultyFor(0, 1);
    const mid = difficultyFor(60, 1);
    const late = difficultyFor(180, 1);
    expect(mid.fallSpeed).toBeGreaterThan(early.fallSpeed);
    expect(late.fallSpeed).toBeGreaterThan(mid.fallSpeed);
    expect(mid.spawnInterval).toBeLessThan(early.spawnInterval);
    expect(late.maxObjects).toBeGreaterThan(early.maxObjects);
    expect(late.hazardChance).toBeGreaterThan(early.hazardChance);
    expect(late.hazardChance).toBeLessThanOrEqual(0.85);
  });

  it('honours the mode difficulty scale', () => {
    const normal = difficultyFor(30, 1);
    const hard = difficultyFor(30, 1.3);
    expect(hard.fallSpeed).toBeGreaterThan(normal.fallSpeed);
    expect(hard.spawnInterval).toBeLessThan(normal.spawnInterval);
  });
});

describe('scoring', () => {
  it('grows the combo multiplier and decays it when idle', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(10)).toBeGreaterThan(comboMultiplier(5));
    expect(comboMultiplier(60)).toBeLessThanOrEqual(8);
    expect(comboDecay(20, 0)).toBe(20);
    expect(comboDecay(20, 5)).toBeLessThan(20);
  });

  it('pays more for rarer rewards and doubles on power-up', () => {
    const coin = scoreReward('coin', 0, false);
    const diamond = scoreReward('diamond', 0, false);
    const legendary = scoreReward('legendary', 0, false);
    expect(coin).toBeGreaterThan(0);
    expect(diamond).toBeGreaterThan(coin);
    expect(legendary).toBeGreaterThan(diamond);
    expect(scoreReward('coin', 0, true)).toBe(coin * 2);
    expect(scoreReward('coin', 10, false)).toBeGreaterThan(coin);
    expect(REWARD_COIN_VALUE.coin).toBeGreaterThan(0);
  });

  it('awards survival points proportional to level', () => {
    const low = survivalScore(1, 1, false);
    const high = survivalScore(1, 10, false);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(survivalScore(1, 1, true)).toBe(low * 2);
  });
});

describe('evolution', () => {
  it('maps xp to stages', () => {
    expect(stageForXp(0)).toBe(0);
    expect(stageForXp(EVOLUTION_STAGES[1].xpRequired)).toBe(1);
    expect(stageForXp(999999)).toBe(EVOLUTION_STAGES.length - 1);
  });

  it('reports progress toward the next stage', () => {
    const early = evolutionProgress(0);
    expect(early.stage.index).toBe(0);
    expect(early.next?.index).toBe(1);
    expect(early.toNext).toBeGreaterThan(0);
    const maxed = evolutionProgress(10_000_000);
    expect(maxed.next).toBeNull();
  });

  it('rewards xp for a run and pays more for a victory', () => {
    const normal = runXp(1000, 40, 60, false);
    const win = runXp(1000, 40, 60, true);
    expect(normal).toBeGreaterThan(0);
    expect(win).toBeGreaterThan(normal);
  });
});

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});
