import type { GameModeId, PowerUpKind, WorldId } from './types';

export interface PowerUpDef {
  kind: PowerUpKind;
  name: string;
  short: string;
  color: string;
  secondary: string;
  duration: number;
  description: string;
  icon: string;
}

export const POWERUPS: Record<PowerUpKind, PowerUpDef> = {
  shield: {
    kind: 'shield',
    name: 'Shield',
    short: 'SHIELD',
    color: '#4fc3ff',
    secondary: '#e6f8ff',
    duration: 8,
    description: 'Absorbs the next dangerous collision without losing health.',
    icon: '🛡',
  },
  magnet: {
    kind: 'magnet',
    name: 'Magnet',
    short: 'MAGNET',
    color: '#ff6bd6',
    secondary: '#ffe3f6',
    duration: 9,
    description: 'Pulls nearby rewards straight into DIGO.',
    icon: '🧲',
  },
  slow: {
    kind: 'slow',
    name: 'Slow Motion',
    short: 'SLOW',
    color: '#9b8cff',
    secondary: '#e7e2ff',
    duration: 7,
    description: 'Falling objects drop to 42% speed.',
    icon: '⏳',
  },
  double: {
    kind: 'double',
    name: 'Double Reward',
    short: 'x2',
    color: '#ffd23f',
    secondary: '#fff6cf',
    duration: 10,
    description: 'Every point you earn is doubled.',
    icon: '✖',
  },
  speed: {
    kind: 'speed',
    name: 'Speed Boost',
    short: 'SPEED',
    color: '#3dffa8',
    secondary: '#dcffef',
    duration: 8,
    description: 'DIGO moves noticeably faster across the field.',
    icon: '»',
  },
  invincible: {
    kind: 'invincible',
    name: 'Invincibility',
    short: 'INVINCIBLE',
    color: '#ff5470',
    secondary: '#ffe0e6',
    duration: 5,
    description: 'Total protection: hazards cannot hurt DIGO.',
    icon: '★',
  },
};

export const POWERUP_LIST: PowerUpDef[] = Object.values(POWERUPS);

export interface ProfileSettings {
  music: number;
  sfx: number;
  controls: 'drag' | 'buttons' | 'both';
  quality: 'auto' | 'low' | 'high';
  haptics: boolean;
}

export interface WalletLink {
  address: string;
  verifiedAt: number;
  sessionToken: string;
}

export interface Profile {
  playerName: string;
  version: number;
  coins: number;
  xp: number;
  totalRuns: number;
  totalCoins: number;
  powerupsUsed: number;
  bossesDefeated: number;
  bestScore: number;
  bestCombo: number;
  longestRun: number;
  bestByMode: Record<GameModeId, number>;
  worldsPlayed: WorldId[];
  selectedWorld: WorldId;
  selectedMode: GameModeId;
  missionProgress: Record<string, number>;
  missionsClaimed: string[];
  achievements: string[];
  daily: { date: string; best: number; attempts: number };
  settings: ProfileSettings;
  wallet: WalletLink | null;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_PROFILE: Profile = {
  playerName: 'DIGO PILOT',
  version: 1,
  coins: 0,
  xp: 0,
  totalRuns: 0,
  totalCoins: 0,
  powerupsUsed: 0,
  bossesDefeated: 0,
  bestScore: 0,
  bestCombo: 0,
  longestRun: 0,
  bestByMode: { endless: 0, time: 0, mission: 0, boss: 0, daily: 0 },
  worldsPlayed: ['tropical'],
  selectedWorld: 'tropical',
  selectedMode: 'endless',
  missionProgress: {},
  missionsClaimed: [],
  achievements: [],
  daily: { date: '', best: 0, attempts: 0 },
  settings: { music: 0.5, sfx: 0.7, controls: 'both', quality: 'auto', haptics: true },
  wallet: null,
  createdAt: 0,
  updatedAt: 0,
};
