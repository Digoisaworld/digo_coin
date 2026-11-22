import { EVOLUTION_STAGES, evolutionProgress, stageForXp } from '../game/core/evolution';
import { MISSIONS } from '../game/core/missions';
import { MODES } from '../game/core/modes';
import type { Profile } from '../game/core/profile';
import { POWERUPS } from '../game/core/profile';
import type { GameModeId, PowerUpKind, WorldId } from '../game/core/types';
import { getWorld, WORLDS } from '../game/core/worlds';
import { achievementStats, missionState, worldUnlocked } from '../state/profileOps';
import { ACHIEVEMENTS } from '../game/core/missions';
import type { LeaderboardEntry } from '../api/client';
import { Btn, Card, Progress, ScreenHead, Stat, Tag } from './components';
import { CharacterPreview } from './CharacterPreview';

export function worldEmoji(id: WorldId): string {
  const map: Record<WorldId, string> = {
    tropical: '🏝',
    cyberpunk: '🌃',
    temple: '🏛',
    space: '🌌',
    lava: '🌋',
    crystal: '💎',
    frozen: '🏔',
  };
  return map[id];
}

const HAZARD_LABEL: Record<string, string> = {
  bomb: 'Bombs',
  meteor: 'Meteors',
  electric: 'Electric arcs',
  spike: 'Spikes',
  enemy: 'Enemies',
};

/* ------------------------------- modes ------------------------------- */

export function ModeSelect({
  profile,
  onBack,
  onSelect,
  onStart,
}: {
  profile: Profile;
  onBack: () => void;
  onSelect: (mode: GameModeId) => void;
  onStart: () => void;
}) {
  return (
    <div className="screen">
      <ScreenHead title="Game Modes" sub="Every mode has its own rules and rewards" onBack={onBack} />
      <div className="stack">
        {MODES.map((mode) => {
          const locked = mode.id === 'boss' && profile.bestScore < 1500;
          const active = profile.selectedMode === mode.id;
          return (
            <Card
              key={mode.id}
              active={active}
              locked={locked}
              onClick={() => !locked && onSelect(mode.id)}
            >
              <div className="card-icon" aria-hidden="true">
                {mode.icon}
              </div>
              <div className="card-body">
                <div className="row-between">
                  <h3 className="card-title">{mode.name}</h3>
                  {active ? <Tag tone="green">SELECTED</Tag> : null}
                  {locked ? <Tag tone="danger">LOCK 1500</Tag> : null}
                </div>
                <p className="card-desc">{mode.description}</p>
                <div className="card-meta">
                  <span>{mode.duration ? `${mode.duration}s` : 'Endless'}</span>
                  <span>{mode.lives} lives</span>
                  <span>x{mode.rewardMultiplier} rewards</span>
                  {mode.boss ? <span>Boss waves</span> : null}
                  <span>Best {profile.bestByMode[mode.id] ?? 0}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="play-cta">
        <Btn full size="lg" onClick={onStart}>
          ▶ START RUN
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------- worlds ------------------------------ */

export function WorldSelect({
  profile,
  onBack,
  onSelect,
  onStart,
}: {
  profile: Profile;
  onBack: () => void;
  onSelect: (world: WorldId) => void;
  onStart: () => void;
}) {
  return (
    <div className="screen">
      <ScreenHead title="Worlds" sub="Unlock new worlds with your best score" onBack={onBack} />
      <div className="stack">
        {WORLDS.map((world) => {
          const unlocked = worldUnlocked(profile, world.unlockScore);
          const active = profile.selectedWorld === world.id;
          const hazards = Object.keys(world.hazardWeights)
            .map((k) => HAZARD_LABEL[k] ?? k)
            .slice(0, 3)
            .join(' · ');
          return (
            <Card
              key={world.id}
              active={active}
              locked={!unlocked}
              onClick={() => unlocked && onSelect(world.id)}
            >
              <div
                className="world-swatch"
                aria-hidden="true"
                style={{
                  background: `linear-gradient(150deg, ${world.skyTop}, ${world.accent} 55%, ${world.accent2})`,
                }}
              >
                <span>{worldEmoji(world.id)}</span>
              </div>
              <div className="card-body">
                <div className="row-between">
                  <h3 className="card-title">{world.name}</h3>
                  {active ? <Tag tone="green">SELECTED</Tag> : null}
                  {!unlocked ? <Tag tone="danger">{world.unlockScore} PTS</Tag> : null}
                </div>
                <p className="card-desc">{world.tagline}</p>
                <div className="card-meta">
                  <span>{hazards}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="play-cta">
        <Btn full size="lg" onClick={onStart}>
          ▶ PLAY {getWorld(profile.selectedWorld).name.toUpperCase()}
        </Btn>
      </div>
    </div>
  );
}

/* ----------------------------- character ----------------------------- */

export function CharacterScreen({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const current = stageForXp(profile.xp);
  const evo = evolutionProgress(profile.xp);
  return (
    <div className="screen">
      <ScreenHead
        title="DIGO Evolution"
        sub={evo.next ? `${evo.toNext} XP to ${evo.next.title}` : 'Fully evolved'}
        onBack={onBack}
      />
      <div className="center">
        <div className="preview-canvas">
          <CharacterPreview stageIndex={current} size={210} />
        </div>
        <Tag tone="cyan">{EVOLUTION_STAGES[current].title.toUpperCase()}</Tag>
        <div className="xp-block">
          <div className="xp-head">
            <span>{profile.xp.toLocaleString()} XP</span>
            <span>Stage {current + 1}/5</span>
          </div>
          <Progress value={evo.progress * 100} max={100} tone="purple" />
        </div>
      </div>

      <div className="stack">
        {EVOLUTION_STAGES.map((stage) => {
          const unlocked = current >= stage.index;
          return (
            <div key={stage.index} className={`stage-card${unlocked ? '' : ' card-locked'}`}>
              <div
                className="stage-orb"
                aria-hidden="true"
                style={{ background: `radial-gradient(circle at 35% 30%, ${stage.glowColor}, ${stage.bodyColor} 60%, #0b1024)` }}
              />
              <div className="card-body">
                <div className="row-between">
                  <h3 className="card-title">
                    {stage.title} <span className="tiny">Stage {stage.index + 1}</span>
                  </h3>
                  {unlocked ? <Tag tone="green">ACTIVE</Tag> : <Tag tone="muted">{stage.xpRequired} XP</Tag>}
                </div>
                <p className="card-desc">
                  <strong>{stage.ability}</strong> — {stage.abilityText}
                </p>
                <div className="card-meta">
                  <span>+{stage.perk.maxHealthBonus} HP</span>
                  <span>Magnet {stage.perk.magnetRadius.toFixed(1)}</span>
                  <span>Speed +{Math.round(stage.perk.speedBonus * 100)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="stack">
        <p className="section-label">Power-ups in the field</p>
        <div className="ach-grid">
          {(Object.keys(POWERUPS) as PowerUpKind[]).map((kind) => {
            const p = POWERUPS[kind];
            return (
              <div key={kind} className="ach">
                <span className="card-icon" aria-hidden="true">
                  {p.icon}
                </span>
                <div>
                  <strong className="card-title">{p.name}</strong>
                  <p className="card-desc">{p.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------ missions ----------------------------- */

export function MissionsScreen({
  profile,
  onBack,
  onClaim,
}: {
  profile: Profile;
  onBack: () => void;
  onClaim: (id: string) => void;
}) {
  return (
    <div className="screen">
      <ScreenHead title="Missions" sub="Complete objectives to earn points and XP" onBack={onBack} />
      <div className="stack">
        {MISSIONS.map((mission) => {
          const state = missionState(profile, mission);
          return (
            <div key={mission.id} className="mission-chip">
              <div className="row-between">
                <h3 className="card-title">{mission.title}</h3>
                <Tag tone={state.claimed ? 'muted' : state.complete ? 'green' : 'gold'}>
                  {state.claimed ? 'CLAIMED' : `+${mission.rewardCoins}`}
                </Tag>
              </div>
              <p className="card-desc">{mission.description}</p>
              <div className="xp-block">
                <div className="xp-head">
                  <span>
                    {Math.min(state.value, mission.target)} / {mission.target}
                  </span>
                  <span>+{mission.rewardXp} XP</span>
                </div>
                <Progress value={state.value} max={mission.target} tone={state.complete ? 'green' : 'gold'} />
              </div>
              {state.complete && !state.claimed ? (
                <Btn size="sm" onClick={() => onClaim(mission.id)}>
                  CLAIM REWARD
                </Btn>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- achievements ---------------------------- */

export function AchievementsScreen({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const stats = achievementStats(profile);
  const unlocked = ACHIEVEMENTS.filter((a) => profile.achievements.includes(a.id)).length;
  return (
    <div className="screen">
      <ScreenHead
        title="Achievements"
        sub={`${unlocked}/${ACHIEVEMENTS.length} unlocked`}
        onBack={onBack}
      />
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const done = profile.achievements.includes(a.id) || a.check(stats);
          return (
            <div key={a.id} className={`ach${done ? ' ach-done' : ''}`}>
              <span className="card-icon" aria-hidden="true">
                {done ? a.icon : '🔒'}
              </span>
              <div>
                <strong className="card-title">{a.title}</strong>
                <p className="card-desc">{a.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- leaderboard ---------------------------- */

export function LeaderboardScreen({
  entries,
  status,
  message,
  modeLabel,
  onRefresh,
  onBack,
}: {
  entries: LeaderboardEntry[];
  status: 'loading' | 'ready' | 'error';
  message?: string;
  modeLabel: string;
  onRefresh: () => void;
  onBack: () => void;
}) {
  return (
    <div className="screen">
      <ScreenHead
        title="Leaderboard"
        sub={modeLabel}
        onBack={onBack}
        right={
          <Btn size="sm" variant="ghost" onClick={onRefresh}>
            ↻
          </Btn>
        }
      />
      {status === 'loading' ? <p className="tiny center">Loading scores…</p> : null}
      {status === 'error' ? <p className="tiny center">{message ?? 'Leaderboard unavailable.'}</p> : null}
      {status === 'ready' && entries.length === 0 ? (
        <p className="empty-state">No verified runs yet. Connect Phantom and set the first score.</p>
      ) : null}
      <div className="stack">
        {entries.map((entry) => (
          <div key={`${entry.rank}-${entry.address}`} className="rank-row">
            <span className="rank-num">{entry.rank}</span>
            <span className="rank-addr">{`${entry.address.slice(0, 4)}…${entry.address.slice(-4)}`}</span>
            <span className="rank-score">{entry.score.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ profile ------------------------------ */

export function ProfileScreen({
  profile,
  walletAddress,
  walletBusy,
  walletNote,
  onLinkWallet,
  onUnlinkWallet,
  onRename,
  onBack,
}: {
  profile: Profile;
  walletAddress: string | null;
  walletBusy: boolean;
  walletNote: string;
  onLinkWallet: () => void;
  onUnlinkWallet: () => void;
  onRename: (name: string) => void;
  onBack: () => void;
}) {
  const stage = stageForXp(profile.xp);
  return (
    <div className="screen">
      <ScreenHead title="Profile" sub="Your DIGO journey" onBack={onBack} />
      <div className="wallet-bar">
        <span className={`wallet-dot${walletAddress ? ' wallet-dot-on' : ''}`} aria-hidden="true" />
        <div className="spacer-grow">
          <strong>{walletAddress ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}` : 'No wallet linked'}</strong>
          <p className="tiny">{walletNote}</p>
        </div>
        {walletAddress ? (
          <Btn size="sm" variant="ghost" onClick={onUnlinkWallet}>
            Unlink
          </Btn>
        ) : (
          <Btn size="sm" onClick={onLinkWallet} disabled={walletBusy}>
            {walletBusy ? 'Connecting…' : 'Link Phantom'}
          </Btn>
        )}
      </div>

      <label className="setting-row">
        <span>Player name</span>
        <input
          className="seg"
          value={profile.playerName}
          maxLength={16}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Player name"
        />
      </label>

      <div className="stat-grid">
        <Stat label="Best score" value={profile.bestScore.toLocaleString()} />
        <Stat label="Points" value={profile.coins.toLocaleString()} />
        <Stat label="Runs" value={profile.totalRuns} />
        <Stat label="Best combo" value={`${profile.bestCombo}x`} />
        <Stat label="Longest run" value={`${Math.round(profile.longestRun)}s`} />
        <Stat label="Stage" value={`${stage + 1} · ${EVOLUTION_STAGES[stage].title}`} />
        <Stat label="Bosses" value={profile.bossesDefeated} />
        <Stat label="Power-ups" value={profile.powerupsUsed} />
      </div>
    </div>
  );
}

/* ------------------------------ settings ----------------------------- */

export function SettingsScreen({
  profile,
  onSettings,
  onReset,
  onBack,
}: {
  profile: Profile;
  onSettings: (patch: Partial<Profile['settings']>) => void;
  onReset: () => void;
  onBack: () => void;
}) {
  const s = profile.settings;
  return (
    <div className="screen">
      <ScreenHead title="Settings" sub="Audio, controls and quality" onBack={onBack} />
      <div className="stack">
        <label className="setting-row">
          <span>Music volume</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.music * 100)}
            onChange={(e) => onSettings({ music: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="setting-row">
          <span>Sound effects</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.sfx * 100)}
            onChange={(e) => onSettings({ sfx: Number(e.target.value) / 100 })}
          />
        </label>
        <div className="setting-head">Controls</div>
        <div className="seg">
          {(['drag', 'buttons', 'both'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`seg-item${s.controls === c ? ' seg-item-on' : ''}`}
              onClick={() => onSettings({ controls: c })}
            >
              {c === 'drag' ? 'Drag' : c === 'buttons' ? 'Buttons' : 'Both'}
            </button>
          ))}
        </div>
        <div className="setting-head">Graphics</div>
        <div className="seg">
          {(['auto', 'low', 'high'] as const).map((q) => (
            <button
              key={q}
              type="button"
              className={`seg-item${s.quality === q ? ' seg-item-on' : ''}`}
              onClick={() => onSettings({ quality: q })}
            >
              {q.toUpperCase()}
            </button>
          ))}
        </div>
        <label className="setting-row">
          <span>Haptic feedback</span>
          <input
            type="checkbox"
            checked={s.haptics}
            onChange={(e) => onSettings({ haptics: e.target.checked })}
          />
        </label>
        <Btn variant="danger" onClick={onReset}>
          Reset progress
        </Btn>
        <p className="tiny">
          DIGO EVOLUTION keeps your progress on this device. Points earned in game are not SOL or
          DIGO tokens, and no transaction is ever signed without your explicit approval.
        </p>
      </div>
    </div>
  );
}
