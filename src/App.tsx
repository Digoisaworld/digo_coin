import { useCallback, useEffect, useState } from 'react';
import { api, type LeaderboardEntry } from './api/client';
import { audio } from './game/audio/AudioManager';
import { stageForXp } from './game/core/evolution';
import type { GameModeId, RunResult } from './game/core/types';
import { useProfile } from './state/useProfile';
import type { RunExtras } from './state/profileOps';
import { GameScreen } from './ui/GameScreen';
import { MainMenu, type ScreenName } from './ui/MainMenu';
import {
  AchievementsScreen,
  CharacterScreen,
  LeaderboardScreen,
  MissionsScreen,
  ModeSelect,
  ProfileScreen,
  SettingsScreen,
  WorldSelect,
} from './ui/screens';
import { connectPhantom, disconnectPhantom, isPhantomInstalled, signMessageWithPhantom } from './wallet/phantom';

type Screen = ScreenName | 'game';
type BoardStatus = 'loading' | 'ready' | 'error';

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function App() {
  const {
    profile,
    finishRun,
    updateSettings,
    selectWorld,
    selectMode,
    setPlayerName,
    claimMission,
    resetProgress,
  } = useProfile();

  const [screen, setScreen] = useState<Screen>('menu');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletNote, setWalletNote] = useState('');
  const [claimNote, setClaimNote] = useState('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [boardStatus, setBoardStatus] = useState<BoardStatus>('loading');
  const [boardMessage, setBoardMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    audio.setVolumes(profile.settings.sfx, profile.settings.music);
  }, [profile.settings.sfx, profile.settings.music]);

  const loadBoard = useCallback(async (mode: GameModeId) => {
    setBoardStatus('loading');
    try {
      const list = await api.leaderboard(mode);
      setEntries(list);
      setBoardStatus('ready');
      setBoardMessage(list.length > 0 ? undefined : 'No verified scores yet — be the first.');
    } catch {
      setEntries([]);
      setBoardStatus('error');
      setBoardMessage('Leaderboard needs the game server. Offline runs still count locally.');
    }
  }, []);

  useEffect(() => {
    if (screen === 'leaderboard') void loadBoard(profile.selectedMode);
  }, [screen, profile.selectedMode, loadBoard]);

  const linkWallet = useCallback(async () => {
    if (!isPhantomInstalled()) {
      setWalletNote('Phantom wallet not found. Install Phantom, then try again. The game stays fully playable without it.');
      return;
    }
    setWalletBusy(true);
    setWalletNote('Waiting for Phantom approval…');
    try {
      const { address } = await connectPhantom();
      const { nonce, message } = await api.nonce(address);
      const signature = await signMessageWithPhantom(message);
      const session = await api.verify(address, signature, nonce);
      setWalletAddress(session.address || address);
      setWalletNote('Wallet verified by signature. Only the public address is stored.');
    } catch (error) {
      setWalletNote(error instanceof Error ? error.message : 'Wallet connection was cancelled.');
    } finally {
      setWalletBusy(false);
    }
  }, []);

  const unlinkWallet = useCallback(async () => {
    setWalletBusy(true);
    try {
      await disconnectPhantom();
      await api.logout();
    } catch {
      /* disconnect is best effort */
    } finally {
      setWalletAddress(null);
      setWalletBusy(false);
      setWalletNote('Wallet disconnected. Game points stay in your local profile.');
    }
  }, []);

  const startGame = useCallback(
    (mode?: GameModeId) => {
      if (mode) selectMode(mode);
      setClaimNote('');
      audio.unlock();
      setScreen('game');
    },
    [selectMode],
  );

  const handleFinish = useCallback(
    (result: RunResult, extras: RunExtras) => {
      finishRun(result, extras);
      setClaimNote('');

      if (!walletAddress) return;
      const durationSec = Math.round(result.survivedSec);

      void (async () => {
        try {
          await api.submitScore({
            mode: result.mode,
            world: result.world,
            score: result.score,
            coins: result.coins,
            durationSec,
            maxCombo: result.maxCombo,
          });
          const claim = await api.claimReward({
            runId: result.runId,
            mode: result.mode,
            score: result.score,
            coins: result.coins,
            durationSec,
          });
          setClaimNote(
            claim.note
              ? `${claim.note} · receipt ${claim.receipt}`
              : `Server verified this run · receipt ${claim.receipt}`,
          );
        } catch {
          setClaimNote(
            'Server verification unavailable — points were kept in your local profile and no token was minted.',
          );
        }
      })();
    },
    [finishRun, walletAddress],
  );

  const back = useCallback(() => setScreen('menu'), []);
  const walletLabel = walletAddress ? shortAddress(walletAddress) : 'Link wallet';

  if (screen === 'game') {
    return (
      <GameScreen
        world={profile.selectedWorld}
        mode={profile.selectedMode}
        stageIndex={stageForXp(profile.xp)}
        sensitivity={1}
        controls={profile.settings.controls}
        bestScore={profile.bestByMode[profile.selectedMode] ?? profile.bestScore}
        claimNote={claimNote}
        onFinish={handleFinish}
        onExit={back}
      />
    );
  }

  if (screen === 'modes') {
    return (
      <ModeSelect
        profile={profile}
        onBack={back}
        onSelect={selectMode}
        onStart={() => startGame()}
      />
    );
  }

  if (screen === 'worlds') {
    return (
      <WorldSelect
        profile={profile}
        onBack={back}
        onSelect={selectWorld}
        onStart={() => startGame()}
      />
    );
  }

  if (screen === 'characters') {
    return <CharacterScreen profile={profile} onBack={back} />;
  }

  if (screen === 'missions') {
    return <MissionsScreen profile={profile} onBack={back} onClaim={claimMission} />;
  }

  if (screen === 'achievements') {
    return <AchievementsScreen profile={profile} onBack={back} />;
  }

  if (screen === 'leaderboard') {
    return (
      <LeaderboardScreen
        entries={entries}
        status={boardStatus}
        message={boardMessage}
        modeLabel={profile.selectedMode.toUpperCase()}
        onRefresh={() => void loadBoard(profile.selectedMode)}
        onBack={back}
      />
    );
  }

  if (screen === 'profile') {
    return (
      <ProfileScreen
        profile={profile}
        walletAddress={walletAddress}
        walletBusy={walletBusy}
        walletNote={walletNote}
        onLinkWallet={() => void linkWallet()}
        onUnlinkWallet={() => void unlinkWallet()}
        onRename={setPlayerName}
        onBack={back}
      />
    );
  }

  if (screen === 'settings') {
    return (
      <SettingsScreen
        profile={profile}
        onBack={back}
        onSettings={updateSettings}
        onReset={resetProgress}
      />
    );
  }

  return (
    <MainMenu
      profile={profile}
      onPlay={() => startGame()}
      onNavigate={(next) => setScreen(next)}
      walletLabel={walletLabel}
      walletAction={() => {
        setScreen('profile');
        if (!walletAddress) void linkWallet();
      }}
    />
  );
}
