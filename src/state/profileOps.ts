import { ACHIEVEMENTS, MISSIONS, type AchievementStats, type Mission } from '../game/core/missions';
import { DEFAULT_PROFILE, type Profile } from '../game/core/profile';
import { stageForXp } from '../game/core/evolution';
import type { GameModeId, RunResult } from '../game/core/types';

export interface RunExtras {
  powerups: number;
  bosses: number;
}

export interface RunOutcome {
  profile: Profile;
  newBest: boolean;
  xpGain: number;
  stageBefore: number;
  stageAfter: number;
  leveledUp: boolean;
  newAchievements: string[];
  completedMissions: string[];
}

const PROFILE_KEY = 'digo-evolution.profile.v1';

export function emptyProfile(): Profile {
  const now = Date.now();
  return { ...DEFAULT_PROFILE, createdAt: now, updatedAt: now, bestByMode: { ...DEFAULT_PROFILE.bestByMode } };
}

/** Loads a profile from storage, tolerating old or corrupt payloads. */
export function loadProfile(raw: string | null): Profile {
  if (!raw) return emptyProfile();
  try {
    const parsed = JSON.parse(raw) as Partial<Profile>;
    if (!parsed || typeof parsed !== 'object') return emptyProfile();
    const base = emptyProfile();
    return {
      ...base,
      ...parsed,
      bestByMode: { ...base.bestByMode, ...(parsed.bestByMode ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      daily: { ...base.daily, ...(parsed.daily ?? {}) },
      missionProgress: { ...(parsed.missionProgress ?? {}) },
      missionsClaimed: Array.isArray(parsed.missionsClaimed) ? parsed.missionsClaimed : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      worldsPlayed: Array.isArray(parsed.worldsPlayed) && parsed.worldsPlayed.length > 0
        ? parsed.worldsPlayed
        : base.worldsPlayed,
      wallet: parsed.wallet ?? null,
    };
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage may be unavailable (private mode) - the game stays playable */
  }
}

export function readStoredProfile(): Profile {
  try {
    return loadProfile(localStorage.getItem(PROFILE_KEY));
  } catch {
    return emptyProfile();
  }
}

export function achievementStats(profile: Profile): AchievementStats {
  return {
    totalRuns: profile.totalRuns,
    totalCoins: profile.totalCoins,
    bestScore: profile.bestScore,
    bestCombo: profile.bestCombo,
    longestRun: profile.longestRun,
    stage: stageForXp(profile.xp),
    worldsPlayed: profile.worldsPlayed.length,
    powerupsUsed: profile.powerupsUsed,
    bossesDefeated: profile.bossesDefeated,
  };
}

/** Value a mission has reached, using per-run bests or lifetime counters. */
export function missionValue(profile: Profile, mission: Mission): number {
  switch (mission.type) {
    case 'coins':
      return profile.missionProgress[`${mission.id}:run`] ?? 0;
    case 'score':
      return Math.max(profile.bestScore, 0);
    case 'combo':
      return profile.bestCombo;
    case 'survive':
      return profile.longestRun;
    case 'runs':
      return profile.totalRuns;
    case 'powerups':
      return profile.powerupsUsed;
    default:
      return 0;
  }
}

export function missionState(profile: Profile, mission: Mission) {
  const value = Math.min(missionValue(profile, mission), mission.target);
  return {
    mission,
    value,
    progress: Math.min(1, value / Math.max(1, mission.target)),
    complete: value >= mission.target,
    claimed: profile.missionsClaimed.includes(mission.id),
  };
}

export function claimMission(profile: Profile, id: string): Profile {
  const mission = MISSIONS.find((m) => m.id === id);
  if (!mission) return profile;
  const state = missionState(profile, mission);
  if (!state.complete || state.claimed) return profile;
  return {
    ...profile,
    coins: profile.coins + mission.rewardCoins,
    xp: profile.xp + mission.rewardXp,
    missionsClaimed: [...profile.missionsClaimed, id],
    updatedAt: Date.now(),
  };
}

/** Applies a finished run to the profile. Pure: returns a new profile. */
export function applyRunResult(profile: Profile, result: RunResult, extras: RunExtras): RunOutcome {
  const stageBefore = stageForXp(profile.xp);
  const newBest = result.score > profile.bestScore;
  const today = new Date().toISOString().slice(0, 10);

  const xp = profile.xp + result.xp;
  const next: Profile = {
    ...profile,
    coins: profile.coins + result.coins,
    totalCoins: profile.totalCoins + result.coins,
    xp,
    totalRuns: profile.totalRuns + 1,
    powerupsUsed: profile.powerupsUsed + Math.max(0, extras.powerups),
    bossesDefeated: profile.bossesDefeated + Math.max(0, extras.bosses),
    bestScore: Math.max(profile.bestScore, result.score),
    bestCombo: Math.max(profile.bestCombo, result.maxCombo),
    longestRun: Math.max(profile.longestRun, result.survivedSec),
    bestByMode: {
      ...profile.bestByMode,
      [result.mode as GameModeId]: Math.max(profile.bestByMode[result.mode] ?? 0, result.score),
    },
    worldsPlayed: profile.worldsPlayed.includes(result.world)
      ? profile.worldsPlayed
      : [...profile.worldsPlayed, result.world],
    missionProgress: {
      ...profile.missionProgress,
      [`${MISSIONS[0].id}:run`]: Math.max(profile.missionProgress[`${MISSIONS[0].id}:run`] ?? 0, result.coins),
    },
    daily:
      result.mode === 'daily'
        ? {
            date: today,
            best: profile.daily.date === today ? Math.max(profile.daily.best, result.score) : result.score,
            attempts: (profile.daily.date === today ? profile.daily.attempts : 0) + 1,
          }
        : profile.daily,
    updatedAt: Date.now(),
  };

  const stats = achievementStats(next);
  const newAchievements = ACHIEVEMENTS.filter(
    (a) => !next.achievements.includes(a.id) && a.check(stats),
  ).map((a) => a.id);
  next.achievements = [...next.achievements, ...newAchievements];

  const stageAfter = stageForXp(next.xp);
  const completedMissions = MISSIONS.filter((m) => {
    const state = missionState(next, m);
    return state.complete && !state.claimed;
  }).map((m) => m.id);

  return {
    profile: next,
    newBest,
    xpGain: result.xp,
    stageBefore,
    stageAfter,
    leveledUp: stageAfter > stageBefore,
    newAchievements,
    completedMissions,
  };
}

export function worldUnlocked(profile: Profile, unlockScore: number): boolean {
  return profile.bestScore >= unlockScore;
}

export function resetProfile(): Profile {
  return emptyProfile();
}

export { PROFILE_KEY };
