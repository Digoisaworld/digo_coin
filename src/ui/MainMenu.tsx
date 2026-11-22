import { EVOLUTION_STAGES, evolutionProgress, stageForXp } from '../game/core/evolution';
import { MODES } from '../game/core/modes';
import type { Profile } from '../game/core/profile';
import { getWorld, WORLDS } from '../game/core/worlds';
import { worldUnlocked } from '../state/profileOps';
import { Btn, Progress, Tag } from './components';

export type ScreenName =
  | 'menu'
  | 'modes'
  | 'worlds'
  | 'characters'
  | 'missions'
  | 'achievements'
  | 'leaderboard'
  | 'profile'
  | 'settings';

const NAV: { id: ScreenName; label: string; icon: string; hint: string }[] = [
  { id: 'modes', label: 'Game Modes', icon: '🎯', hint: '5 modes' },
  { id: 'worlds', label: 'Worlds', icon: '🌍', hint: `${WORLDS.length} worlds` },
  { id: 'characters', label: 'Character', icon: '⭐', hint: 'Evolve DIGO' },
  { id: 'missions', label: 'Missions', icon: '📜', hint: 'Daily goals' },
  { id: 'achievements', label: 'Achievements', icon: '🏆', hint: 'Trophies' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '📊', hint: 'Global ranks' },
  { id: 'profile', label: 'Profile', icon: '👤', hint: 'Stats' },
  { id: 'settings', label: 'Settings', icon: '⚙️', hint: 'Audio & touch' },
];

export function MainMenu({
  profile,
  onPlay,
  onNavigate,
  walletLabel,
  walletAction,
}: {
  profile: Profile;
  onPlay: () => void;
  onNavigate: (screen: ScreenName) => void;
  walletLabel: string;
  walletAction: () => void;
}) {
  const stage = stageForXp(profile.xp);
  const stageDef = EVOLUTION_STAGES[stage];
  const evo = evolutionProgress(profile.xp);
  const world = getWorld(profile.selectedWorld);
  const mode = MODES.find((m) => m.id === profile.selectedMode) ?? MODES[0];
  const unlockedWorlds = WORLDS.filter((w) => worldUnlocked(profile, w.unlockScore)).length;

  return (
    <div className="screen menu-screen">
      <div className="menu-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            DIGO
          </span>
          <span className="brand-sub">EVOLUTION</span>
        </div>
        <button type="button" className="wallet-chip" onClick={walletAction}>
          <span aria-hidden="true">👻</span> {walletLabel}
        </button>
      </div>

      <section className="hero-card">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-body">
          <Tag tone="purple">{`STAGE ${stage + 1} · ${stageDef.title.toUpperCase()}`}</Tag>
          <h1 className="hero-title">Survive the fall.</h1>
          <p className="hero-copy">
            Catch rewards, dodge bombs. Hold anywhere at the bottom and slide DIGO left or right.
          </p>
          <div className="hero-stats">
            <div>
              <span>BEST</span>
              <strong>{profile.bestScore.toLocaleString()}</strong>
            </div>
            <div>
              <span>POINTS</span>
              <strong>{profile.coins.toLocaleString()}</strong>
            </div>
            <div>
              <span>WORLDS</span>
              <strong>
                {unlockedWorlds}/{WORLDS.length}
              </strong>
            </div>
          </div>
          <div className="xp-row">
            <div className="xp-labels">
              <span>Evolution XP</span>
              <span>
                {evo.current}/{evo.needed || 'MAX'}
              </span>
            </div>
            <Progress value={evo.current} max={evo.needed || 1} tone="purple" />
          </div>
        </div>
      </section>

      <div className="play-block">
        <Btn size="lg" full onClick={onPlay} testId="play-button">
          ▶ PLAY
        </Btn>
        <div className="play-meta">
          <span>
            {mode.icon} {mode.name}
          </span>
          <span>
            {world.icon} {world.name}
          </span>
        </div>
      </div>

      <nav className="nav-grid">
        {NAV.map((item) => (
          <button
            type="button"
            key={item.id}
            className="nav-tile"
            onClick={() => onNavigate(item.id)}
            data-testid={`nav-${item.id}`}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="nav-label">{item.label}</span>
            <span className="nav-hint">{item.hint}</span>
          </button>
        ))}
      </nav>

      <p className="foot-note">
        Fully playable offline · no wallet required · game points are not SOL tokens
      </p>
    </div>
  );
}
