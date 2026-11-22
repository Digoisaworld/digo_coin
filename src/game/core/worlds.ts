import type { HazardKind, RewardKind, WorldId } from './types';

export interface WorldMusic {
  /** Semitone offsets from the root, used by the procedural synth. */
  scale: number[];
  tempo: number;
  wave: OscillatorType;
  root: number;
}

export type WorldExtra = 'stars' | 'snow' | 'embers' | 'neon' | 'bubbles' | 'shards' | 'fireflies';

export interface WorldDef {
  id: WorldId;
  name: string;
  tagline: string;
  unlockScore: number;
  skyTop: string;
  skyBottom: string;
  horizon: string;
  ground: string;
  groundLine: string;
  fog: string;
  ambient: string;
  keyLight: string;
  accent: string;
  accent2: string;
  silhouette: string;
  extras: WorldExtra[];
  hazardWeights: Partial<Record<HazardKind, number>>;
  rewardWeights: Partial<Record<RewardKind, number>>;
  music: WorldMusic;
  /** Unique environmental hazard description shown in the world browser. */
  environmentalHazard: string;
}

export const WORLDS: WorldDef[] = [
  {
    id: 'tropical',
    name: 'Tropical Island',
    tagline: 'Golden sand, warm light, falling treasure.',
    unlockScore: 0,
    skyTop: '#1e6fd9',
    skyBottom: '#8fe0ff',
    horizon: '#ffd479',
    ground: '#e8c07a',
    groundLine: '#ffe9a8',
    fog: '#a9e4ff',
    ambient: '#ffe9c4',
    keyLight: '#fff3cf',
    accent: '#ffcf3f',
    accent2: '#33d6a6',
    silhouette: '#0b5c6b',
    extras: ['bubbles', 'fireflies'],
    hazardWeights: { bomb: 4, meteor: 3, spike: 2, enemy: 1.4, electric: 1 },
    rewardWeights: { coin: 10, energy: 4, diamond: 3, chest: 1.2, legendary: 0.25 },
    music: { scale: [0, 2, 4, 7, 9], tempo: 108, wave: 'triangle', root: 220 },
    environmentalHazard: 'Coconut bombs and rolling volcanic rocks',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon City',
    tagline: 'Rain-slick rooftops under neon rain.',
    unlockScore: 1500,
    skyTop: '#12002e',
    skyBottom: '#3a0a63',
    horizon: '#ff2ea6',
    ground: '#120a24',
    groundLine: '#22e7ff',
    fog: '#4a1170',
    ambient: '#a05cff',
    keyLight: '#ff56c8',
    accent: '#22e7ff',
    accent2: '#ff2ea6',
    silhouette: '#1b0436',
    extras: ['neon', 'stars'],
    hazardWeights: { electric: 5, bomb: 4, enemy: 2, spike: 1.4, meteor: 1 },
    rewardWeights: { coin: 10, energy: 5, diamond: 3.4, chest: 1.2, legendary: 0.3 },
    music: { scale: [0, 2, 3, 7, 10], tempo: 126, wave: 'sawtooth', root: 174 },
    environmentalHazard: 'Electric hazard grids and drone enemies',
  },
  {
    id: 'temple',
    name: 'Ancient Treasure Temple',
    tagline: 'Dusty halls, ancient traps, hidden gold.',
    unlockScore: 4000,
    skyTop: '#241708',
    skyBottom: '#6b4a1c',
    horizon: '#ffb347',
    ground: '#3a2a16',
    groundLine: '#ffd77a',
    fog: '#5b4020',
    ambient: '#ffd8a0',
    keyLight: '#ffc16b',
    accent: '#ffb347',
    accent2: '#8ef0c8',
    silhouette: '#1b1207',
    extras: ['embers', 'fireflies'],
    hazardWeights: { spike: 5, bomb: 3, meteor: 2.4, enemy: 2, electric: 1 },
    rewardWeights: { coin: 10, energy: 3.4, diamond: 3, chest: 2.4, legendary: 0.5 },
    music: { scale: [0, 1, 5, 7, 8], tempo: 96, wave: 'triangle', root: 196 },
    environmentalHazard: 'Ceiling spike traps and stone bombs',
  },
  {
    id: 'space',
    name: 'Space Galaxy',
    tagline: 'Zero gravity loot between the stars.',
    unlockScore: 8000,
    skyTop: '#02010f',
    skyBottom: '#141a52',
    horizon: '#7b6cff',
    ground: '#0a0b1e',
    groundLine: '#8f7dff',
    fog: '#161a44',
    ambient: '#8f9dff',
    keyLight: '#c8d4ff',
    accent: '#7b6cff',
    accent2: '#4bffd1',
    silhouette: '#080a1c',
    extras: ['stars', 'shards'],
    hazardWeights: { meteor: 6, enemy: 2.4, electric: 2, bomb: 2.4, spike: 1.2 },
    rewardWeights: { coin: 9, energy: 4, diamond: 4, chest: 1.4, legendary: 0.6 },
    music: { scale: [0, 2, 5, 7, 11], tempo: 88, wave: 'sine', root: 164 },
    environmentalHazard: 'Asteroid meteors and hostile probes',
  },
  {
    id: 'lava',
    name: 'Lava World',
    tagline: 'Survive the inferno for molten rewards.',
    unlockScore: 14000,
    skyTop: '#1a0300',
    skyBottom: '#8a1c00',
    horizon: '#ff6b1a',
    ground: '#2a0a04',
    groundLine: '#ff9a3c',
    fog: '#5c1400',
    ambient: '#ff8a4c',
    keyLight: '#ffb066',
    accent: '#ff6b1a',
    accent2: '#ffd166',
    silhouette: '#180300',
    extras: ['embers', 'stars'],
    hazardWeights: { meteor: 6.5, bomb: 4, spike: 2, enemy: 2, electric: 1.2 },
    rewardWeights: { coin: 10, energy: 4.4, diamond: 3.2, chest: 1.2, legendary: 0.4 },
    music: { scale: [0, 1, 3, 6, 8], tempo: 132, wave: 'sawtooth', root: 130 },
    environmentalHazard: 'Burning meteors and erupting ember bombs',
  },
  {
    id: 'crystal',
    name: 'Crystal Kingdom',
    tagline: 'Prismatic caves humming with power.',
    unlockScore: 22000,
    skyTop: '#0a0524',
    skyBottom: '#2b1b6b',
    horizon: '#a06bff',
    ground: '#160d3a',
    groundLine: '#c9a6ff',
    fog: '#241354',
    ambient: '#b48cff',
    keyLight: '#e2d4ff',
    accent: '#a06bff',
    accent2: '#5ffbe0',
    silhouette: '#120a30',
    extras: ['shards', 'fireflies'],
    hazardWeights: { spike: 5, electric: 3.4, enemy: 2.2, bomb: 2.6, meteor: 1.6 },
    rewardWeights: { coin: 9, energy: 5, diamond: 5, chest: 1.6, legendary: 0.7 },
    music: { scale: [0, 2, 4, 7, 11], tempo: 102, wave: 'triangle', root: 246 },
    environmentalHazard: 'Shattering crystal spikes and arc storms',
  },
  {
    id: 'frozen',
    name: 'Frozen Mountain',
    tagline: 'Blizzard peaks. Perfect clarity. Ice-cold loot.',
    unlockScore: 32000,
    skyTop: '#05121f',
    skyBottom: '#3f7fa8',
    horizon: '#bfeaff',
    ground: '#dcefff',
    groundLine: '#ffffff',
    fog: '#a9d8ee',
    ambient: '#d8f2ff',
    keyLight: '#ffffff',
    accent: '#7fe0ff',
    accent2: '#c9f5ff',
    silhouette: '#0b2333',
    extras: ['snow', 'stars'],
    hazardWeights: { spike: 4.4, meteor: 3.4, electric: 3, enemy: 2, bomb: 3 },
    rewardWeights: { coin: 10, energy: 4, diamond: 4.6, chest: 1.4, legendary: 0.6 },
    music: { scale: [0, 2, 5, 7, 10], tempo: 92, wave: 'sine', root: 262 },
    environmentalHazard: 'Ice spikes and frozen lightning',
  },
];

export function getWorld(id: WorldId): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}

export function worldsUnlocked(bestScore: number): WorldId[] {
  return WORLDS.filter((w) => bestScore >= w.unlockScore).map((w) => w.id);
}

export function isWorldUnlocked(id: WorldId, bestScore: number): boolean {
  return bestScore >= getWorld(id).unlockScore;
}
