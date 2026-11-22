import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PROFILE, type Profile, type ProfileSettings } from '../game/core/profile';
import type { GameModeId, RunResult, WorldId } from '../game/core/types';
import { applyRunResult, type RunExtras, type RunOutcome } from './profileOps';

const STORAGE_KEY = 'digo-evolution:profile:v1';

/** DEFAULT_PROFILE is a shared template, so every profile starts from a deep copy. */
function freshProfile(): Profile {
  return {
    ...DEFAULT_PROFILE,
    bestByMode: { ...DEFAULT_PROFILE.bestByMode },
    worldsPlayed: [...DEFAULT_PROFILE.worldsPlayed],
    missionProgress: {},
    missionsClaimed: [],
    achievements: [],
    daily: { ...DEFAULT_PROFILE.daily },
    settings: { ...DEFAULT_PROFILE.settings },
    wallet: null,
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshProfile();
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const base = freshProfile();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      bestByMode: { ...base.bestByMode, ...(parsed.bestByMode ?? {}) },
      daily: { ...base.daily, ...(parsed.daily ?? {}) },
    };
  } catch {
    return freshProfile();
  }
}

export interface ProfileApi {
  profile: Profile;
  finishRun: (result: RunResult, extras: RunExtras) => RunOutcome;
  updateSettings: (patch: Partial<ProfileSettings>) => void;
  selectWorld: (world: WorldId) => void;
  selectMode: (mode: GameModeId) => void;
  setPlayerName: (name: string) => void;
  claimMission: (id: string) => void;
  resetProgress: () => void;
}

export function useProfile(): ProfileApi {
  const [profile, setProfile] = useState<Profile>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      /* private mode: the run still works, only persistence is skipped */
    }
  }, [profile]);

  const finishRun = useCallback(
    (result: RunResult, extras: RunExtras): RunOutcome => {
      const outcome = applyRunResult(profile, result, extras);
      setProfile(outcome.profile);
      return outcome;
    },
    [profile],
  );

  const updateSettings = useCallback((patch: Partial<ProfileSettings>) => {
    setProfile((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const selectWorld = useCallback((world: WorldId) => {
    setProfile((prev) => ({ ...prev, selectedWorld: world }));
  }, []);

  const selectMode = useCallback((mode: GameModeId) => {
    setProfile((prev) => ({ ...prev, selectedMode: mode }));
  }, []);

  const setPlayerName = useCallback((name: string) => {
    setProfile((prev) => ({ ...prev, playerName: name.slice(0, 16) }));
  }, []);

  const claimMission = useCallback((id: string) => {
    setProfile((prev) => {
      if (prev.missionsClaimed.includes(id)) return prev;
      return { ...prev, missionsClaimed: [...prev.missionsClaimed, id] };
    });
  }, []);

  const resetProgress = useCallback(() => {
    setProfile((prev) => ({
      ...freshProfile(),
      settings: prev.settings,
      playerName: prev.playerName,
      selectedWorld: prev.selectedWorld,
      selectedMode: prev.selectedMode,
    }));
  }, []);

  return {
    profile,
    finishRun,
    updateSettings,
    selectWorld,
    selectMode,
    setPlayerName,
    claimMission,
    resetProgress,
  };
}
