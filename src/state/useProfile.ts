import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PROFILE, type Profile, type ProfileSettings } from '../game/core/profile';
import type { GameModeId, RunResult } from '../game/core/types';
import { applyRunResult, type RunExtras, type RunOutcome } from './profileOps';

const STORAGE_KEY = 'digo-evolution:profile:v1';

/** DEFAULT_PROFILE is a template object, so nested structures are cloned per profile. */
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
    return { ...freshProfile(), ...parsed };
  } catch {
    return freshProfile();
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(() => load());
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      /* storage may be unavailable in private mode - game still playable */
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

  const selectWorld = useCallback((world: Profile['selectedWorld']) => {
    setProfile((prev) => ({ ...prev, selectedWorld: world }));
  }, []);

  const setPlayerName = useCallback((name: string) => {
    setProfile((prev) => ({ ...prev, playerName: name.slice(0, 16) }));
  }, []);

  const selectMode = useCallback((mode: GameModeId) => {
    setProfile((prev) => ({ ...prev, selectedMode: mode }));
  }, []);

  const resetProgress = useCallback(() => {
    setProfile((prev) => {
      const fresh = freshProfile();
      return { ...fresh, settings: prev.settings, playerName: prev.playerName };
    });
  }, []);

  return { profile, setProfile, finishRun, updateSettings, selectWorld, setPlayerName, selectMode, resetProgress };
}

export type ProfileApi = ReturnType<typeof useProfile>;
