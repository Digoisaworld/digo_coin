import type { GameModeId } from './types';

export interface ModeObjective {
  type: 'coins' | 'score' | 'combo' | 'survive' | 'boss';
  target: number;
  label: string;
}

export interface ModeDef {
  id: GameModeId;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  /** Seconds. null = endless until DIGO runs out of lives. */
  duration: number | null;
  lives: number;
  difficultyScale: number;
  boss: boolean;
  objective?: ModeObjective;
  rewardMultiplier: number;
  /** Daily mode seeds the run from the UTC date so every player gets one layout. */
  seeded: boolean;
}

export const MODES: ModeDef[] = [
  {
    id: 'endless',
    name: 'Endless Survival',
    shortName: 'Endless',
    description:
      'Rewards and hazards keep falling, faster and faster. How long can DIGO survive?',
    icon: '∞',
    duration: null,
    lives: 3,
    difficultyScale: 1,
    boss: false,
    rewardMultiplier: 1,
    seeded: false,
  },
  {
    id: 'time',
    name: 'Time Challenge',
    shortName: 'Time',
    description: 'Sixty seconds on the clock. Bank as much score as possible before the buzzer.',
    icon: '⏱',
    duration: 60,
    lives: 2,
    difficultyScale: 1.25,
    boss: false,
    rewardMultiplier: 1.15,
    seeded: false,
  },
  {
    id: 'mission',
    name: 'Mission Mode',
    shortName: 'Mission',
    description: 'A single objective, one life bar and a clear payout for completing it.',
    icon: '◎',
    duration: null,
    lives: 2,
    difficultyScale: 1.05,
    boss: false,
    objective: { type: 'coins', target: 30, label: 'Collect 30 rewards' },
    rewardMultiplier: 1.3,
    seeded: false,
  },
  {
    id: 'boss',
    name: 'Boss Survival',
    shortName: 'Boss',
    description:
      'A titan hovers above the field. Feed it energy crystals to break it before it buries you.',
    icon: '☠',
    duration: null,
    lives: 3,
    difficultyScale: 1.15,
    boss: true,
    objective: { type: 'boss', target: 100, label: 'Destroy the titan' },
    rewardMultiplier: 1.5,
    seeded: false,
  },
  {
    id: 'daily',
    name: 'Daily Challenge',
    shortName: 'Daily',
    description:
      'One shared layout per day, 75 seconds, tougher hazards and a double reward multiplier.',
    icon: '★',
    duration: 75,
    lives: 2,
    difficultyScale: 1.35,
    boss: false,
    rewardMultiplier: 2,
    seeded: true,
  },
];

export function getMode(id: GameModeId): ModeDef {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

export const MISSION_TARGETS = [20, 30, 45] as const;
