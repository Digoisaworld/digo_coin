export interface Mission {
  id: string;
  title: string;
  description: string;
  type: 'coins' | 'score' | 'combo' | 'survive' | 'runs' | 'powerups';
  target: number;
  rewardCoins: number;
  rewardXp: number;
}

export const MISSIONS: Mission[] = [
  {
    id: 'm-first-steps',
    title: 'First Steps',
    description: 'Collect 25 rewards in a single run.',
    type: 'coins',
    target: 25,
    rewardCoins: 50,
    rewardXp: 40,
  },
  {
    id: 'm-combo-adept',
    title: 'Combo Adept',
    description: 'Reach a 15x combo in one run.',
    type: 'combo',
    target: 15,
    rewardCoins: 90,
    rewardXp: 70,
  },
  {
    id: 'm-survivor',
    title: 'Survivor',
    description: 'Survive 90 seconds in a single run.',
    type: 'survive',
    target: 90,
    rewardCoins: 120,
    rewardXp: 90,
  },
  {
    id: 'm-high-roller',
    title: 'High Roller',
    description: 'Score 3,000 points in a single run.',
    type: 'score',
    target: 3000,
    rewardCoins: 160,
    rewardXp: 120,
  },
  {
    id: 'm-power-player',
    title: 'Power Player',
    description: 'Activate 8 power-ups across your runs.',
    type: 'powerups',
    target: 8,
    rewardCoins: 140,
    rewardXp: 100,
  },
  {
    id: 'm-veteran',
    title: 'Veteran',
    description: 'Finish 10 runs (any mode).',
    type: 'runs',
    target: 10,
    rewardCoins: 200,
    rewardXp: 150,
  },
];

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Checked against the persisted profile statistics. */
  check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  totalRuns: number;
  totalCoins: number;
  bestScore: number;
  bestCombo: number;
  longestRun: number;
  stage: number;
  worldsPlayed: number;
  powerupsUsed: number;
  bossesDefeated: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'a-rookie',
    title: 'Rookie Runner',
    description: 'Finish your first run.',
    icon: '🎮',
    check: (s) => s.totalRuns >= 1,
  },
  {
    id: 'a-collector',
    title: 'Treasure Collector',
    description: 'Collect 500 rewards in total.',
    icon: '💰',
    check: (s) => s.totalCoins >= 500,
  },
  {
    id: 'a-combo',
    title: 'Chain Reaction',
    description: 'Reach a 25x combo.',
    icon: '🔥',
    check: (s) => s.bestCombo >= 25,
  },
  {
    id: 'a-endurance',
    title: 'Iron Endurance',
    description: 'Survive 3 minutes in one run.',
    icon: '🛡',
    check: (s) => s.longestRun >= 180,
  },
  {
    id: 'a-score',
    title: 'Score Hunter',
    description: 'Reach a best score of 5,000.',
    icon: '🏆',
    check: (s) => s.bestScore >= 5000,
  },
  {
    id: 'a-evolve',
    title: 'Evolution Complete',
    description: 'Unlock DIGO evolution stage 3.',
    icon: '✨',
    check: (s) => s.stage >= 3,
  },
  {
    id: 'a-explorer',
    title: 'World Explorer',
    description: 'Play in 4 different worlds.',
    icon: '🌍',
    check: (s) => s.worldsPlayed >= 4,
  },
  {
    id: 'a-boss',
    title: 'Titan Slayer',
    description: 'Defeat the boss titan.',
    icon: '☠',
    check: (s) => s.bossesDefeated >= 1,
  },
  {
    id: 'a-power',
    title: 'Power Hungry',
    description: 'Activate 30 power-ups.',
    icon: '⚡',
    check: (s) => s.powerupsUsed >= 30,
  },
];
