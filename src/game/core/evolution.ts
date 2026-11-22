/** DIGO evolution: five stages that change visuals, scale, aura and ability. */

export interface EvolutionStage {
  index: number;
  name: string;
  title: string;
  xpRequired: number;
  scale: number;
  bodyColor: string;
  accentColor: string;
  glowColor: string;
  auraStrength: number;
  ability: string;
  abilityText: string;
  perk: {
    maxHealthBonus: number;
    magnetRadius: number;
    speedBonus: number;
    shieldSeconds: number;
  };
}

export const EVOLUTION_STAGES: EvolutionStage[] = [
  {
    index: 0,
    name: 'DIGO',
    title: 'Hatchling',
    xpRequired: 0,
    scale: 1,
    bodyColor: '#ffcf3f',
    accentColor: '#33d6a6',
    glowColor: '#ffe08a',
    auraStrength: 0.25,
    ability: 'Instinct',
    abilityText: 'Base movement and a single bonus heart.',
    perk: { maxHealthBonus: 0, magnetRadius: 0, speedBonus: 0, shieldSeconds: 0 },
  },
  {
    index: 1,
    name: 'DIGO',
    title: 'Scout',
    xpRequired: 250,
    scale: 1.06,
    bodyColor: '#ffd75e',
    accentColor: '#48f0c0',
    glowColor: '#ffeaa0',
    auraStrength: 0.4,
    ability: 'Quickstep',
    abilityText: '+8% horizontal speed and a wider collect radius.',
    perk: { maxHealthBonus: 10, magnetRadius: 0.6, speedBonus: 0.08, shieldSeconds: 0 },
  },
  {
    index: 2,
    name: 'DIGO',
    title: 'Warrior',
    xpRequired: 900,
    scale: 1.12,
    bodyColor: '#ffe06b',
    accentColor: '#6b8cff',
    glowColor: '#fff0b8',
    auraStrength: 0.55,
    ability: 'Guard',
    abilityText: 'Shields last 2s longer and +10 max health.',
    perk: { maxHealthBonus: 20, magnetRadius: 1.1, speedBonus: 0.14, shieldSeconds: 2 },
  },
  {
    index: 3,
    name: 'DIGO',
    title: 'Champion',
    xpRequired: 2200,
    scale: 1.2,
    bodyColor: '#ffea8a',
    accentColor: '#ff7ae0',
    glowColor: '#fff5cc',
    auraStrength: 0.75,
    ability: 'Overdrive',
    abilityText: 'Power-ups last 30% longer and rewards chain faster.',
    perk: { maxHealthBonus: 30, magnetRadius: 1.8, speedBonus: 0.2, shieldSeconds: 3 },
  },
  {
    index: 4,
    name: 'DIGO',
    title: 'Legend',
    xpRequired: 5000,
    scale: 1.3,
    bodyColor: '#fff3b0',
    accentColor: '#8f7dff',
    glowColor: '#ffffff',
    auraStrength: 1,
    ability: 'Ascension',
    abilityText: 'Maximum health, constant sparkle aura and the fastest feet in the galaxy.',
    perk: { maxHealthBonus: 40, magnetRadius: 2.4, speedBonus: 0.26, shieldSeconds: 4 },
  },
];

export function stageForXp(xp: number): number {
  let stage = 0;
  for (const entry of EVOLUTION_STAGES) {
    if (xp >= entry.xpRequired) stage = entry.index;
  }
  return stage;
}

export function getStage(index: number): EvolutionStage {
  return EVOLUTION_STAGES[Math.max(0, Math.min(EVOLUTION_STAGES.length - 1, index))];
}

export function evolutionProgress(xp: number): {
  stage: EvolutionStage;
  next: EvolutionStage | null;
  progress: number;
  toNext: number;
} {
  const stage = getStage(stageForXp(xp));
  const next = EVOLUTION_STAGES[stage.index + 1] ?? null;
  if (!next) return { stage, next: null, progress: 1, toNext: 0 };
  const span = next.xpRequired - stage.xpRequired;
  const done = Math.max(0, xp - stage.xpRequired);
  return {
    stage,
    next,
    progress: Math.max(0, Math.min(1, span === 0 ? 1 : done / span)),
    toNext: Math.max(0, next.xpRequired - xp),
  };
}

export function runXp(score: number, coins: number, survivedSec: number, victory: boolean): number {
  const base = score * 0.1 + coins * 1.5 + survivedSec * 0.6;
  return Math.round(base * (victory ? 1.6 : 1));
}
