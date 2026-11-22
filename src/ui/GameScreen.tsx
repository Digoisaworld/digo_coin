import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '../game/audio/AudioManager';
import { MODES } from '../game/core/modes';
import { POWERUPS } from '../game/core/profile';
import type { GameModeId, HudSnapshot, RunResult, WorldId } from '../game/core/types';
import { getWorld } from '../game/core/worlds';
import { Game } from '../game/engine/Game';
import type { RunExtras } from '../state/profileOps';
import { Btn, Progress } from './components';

export interface GameScreenProps {
  world: WorldId;
  mode: GameModeId;
  stageIndex: number;
  sensitivity: number;
  controls: 'drag' | 'buttons' | 'both';
  bestScore: number;
  claimNote?: string;
  onFinish: (result: RunResult, extras: RunExtras) => void;
  onExit: () => void;
}

type Toast = { id: number; text: string; tone: string };

export function GameScreen({
  world,
  mode,
  stageIndex,
  sensitivity,
  controls,
  bestScore,
  claimNote,
  onFinish,
  onExit,
}: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const finishRef = useRef(onFinish);
  const toastTimer = useRef<number | null>(null);
  const runStats = useRef<{ powerups: number; bosses: number }>({ powerups: 0, bosses: 0 });

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  finishRef.current = onFinish;

  const showToast = useCallback((text: string, tone = 'gold') => {
    setToast({ id: Date.now(), text, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1500);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;

    setResult(null);
    setHud(null);
    runStats.current = { powerups: 0, bosses: 0 };

    const game = new Game({
      canvas,
      surface,
      world,
      mode,
      stageIndex,
      sensitivity,
      callbacks: {
        onHud: (snapshot) => setHud(snapshot),
        onEvent: (event) => {
          switch (event.type) {
            case 'powerup':
              runStats.current.powerups += 1;
              showToast(`${POWERUPS[event.kind].icon} ${POWERUPS[event.kind].name.toUpperCase()}`, 'cyan');
              break;
            case 'level':
              showToast(`LEVEL ${event.level}`, 'gold');
              break;
            case 'lifeLost':
              showToast('LIFE LOST', 'danger');
              break;
            case 'bossSpawn':
              showToast('BOSS INCOMING', 'danger');
              break;
            case 'bossDefeated':
              runStats.current.bosses += 1;
              showToast('BOSS DEFEATED', 'green');
              break;
            default:
              break;
          }
        },
        onFinish: (finished) => {
          setResult(finished);
          finishRef.current(finished, { ...runStats.current });
        },
      },
    });

    gameRef.current = game;
    audio.unlock();
    game.start();

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [runKey, world, mode, stageIndex, sensitivity, showToast]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    if (game.isPaused) game.resume();
    else game.pause();
  }, []);

  const restart = useCallback(() => {
    setResult(null);
    setRunKey((key) => key + 1);
  }, []);

  const quit = useCallback(() => {
    gameRef.current?.dispose();
    gameRef.current = null;
    onExit();
  }, [onExit]);

  const hold = (axis: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gameRef.current?.setButtonAxis(axis);
  };

  const release = () => {
    gameRef.current?.setButtonAxis(0);
  };

  const paused = hud?.phase === 'paused';
  const modeDef = MODES.find((m) => m.id === mode);
  const worldDef = getWorld(world);
  const hearts = hud ? Array.from({ length: hud.maxHealth }, (_, i) => i < hud.health) : [];

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />

      <div className="hud">
        <div className="hud-row">
          <span className="hud-pill hud-score">{hud?.score.toLocaleString() ?? '0'}</span>
          <span className="hud-pill hud-coins">◉ {hud?.coins ?? 0}</span>
          <button className="pause-btn" type="button" onClick={togglePause} aria-label="Pause game">
            {paused ? '▶' : '❚❚'}
          </button>
        </div>
        <div className="hud-row">
          <span className="hearts" aria-label={`Health ${hud?.health ?? 0} of ${hud?.maxHealth ?? 0}`}>
            {hearts.map((full, index) => (
              <span key={index} className={full ? 'heart' : 'heart heart-off'}>
                ♥
              </span>
            ))}
          </span>
          <span className="hud-pill">LV {hud?.level ?? 1}</span>
          {hud?.timeLeft != null ? (
            <span className="hud-pill">{Math.max(0, Math.ceil(hud.timeLeft))}s</span>
          ) : null}
          {hud && hud.combo > 1 ? (
            <span className="hud-pill">
              x{hud.multiplier.toFixed(1)} · {hud.combo}
            </span>
          ) : null}
        </div>
        {hud?.bossHp != null && hud.bossMaxHp ? (
          <div className="boss-bar">
            <Progress value={hud.bossHp} max={hud.bossMaxHp} tone="danger" height={10} />
          </div>
        ) : null}
        {hud?.mission ? (
          <div className="mission-chip">
            <span className="tiny">{hud.mission.text}</span>
            <Progress
              value={hud.mission.current}
              max={hud.mission.target}
              tone={hud.mission.complete ? 'green' : 'gold'}
            />
          </div>
        ) : null}
        {hud && hud.powerups.length > 0 ? (
          <div className="power-chips">
            {hud.powerups.map((power) => (
              <span key={power.kind} className="power-chip">
                {POWERUPS[power.kind].icon} {Math.ceil(power.remaining)}s
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div ref={surfaceRef} className="control-surface">
        <p className="control-hint">
          {controls === 'buttons' ? 'Hold ◀ ▶ to move DIGO' : 'Hold and slide left or right'}
        </p>
      </div>

      {controls !== 'drag' ? (
        <div className="dpad">
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            aria-label="Move left"
            onPointerDown={hold(-1)}
            onPointerUp={release}
            onPointerCancel={release}
            onPointerLeave={release}
            onLostPointerCapture={release}
          >
            ◀
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-lg"
            aria-label="Move right"
            onPointerDown={hold(1)}
            onPointerUp={release}
            onPointerCancel={release}
            onPointerLeave={release}
            onLostPointerCapture={release}
          >
            ▶
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="toast-layer">
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            {toast.text}
          </div>
        </div>
      ) : null}

      {paused && !result ? (
        <div className="overlay">
          <div className="overlay-card">
            <h2 className="overlay-title">PAUSED</h2>
            <p className="tiny">
              {worldDef.name} · {modeDef?.name ?? 'Endless'}
            </p>
            <div className="overlay-actions">
              <Btn full size="lg" onClick={togglePause}>
                RESUME
              </Btn>
              <Btn full variant="secondary" onClick={restart}>
                RESTART
              </Btn>
              <Btn full variant="ghost" onClick={quit}>
                QUIT TO MENU
              </Btn>
            </div>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="overlay">
          <div className="overlay-card">
            <h2 className="overlay-title">{result.victory ? 'VICTORY' : 'RUN OVER'}</h2>
            {result.newBest || result.score > bestScore ? (
              <span className="new-best">NEW BEST</span>
            ) : null}
            <div className="result-score">{result.score.toLocaleString()}</div>
            <div className="result-grid">
              <div className="result-cell">
                <span className="result-label">Points</span>
                <strong>{result.coins}</strong>
              </div>
              <div className="result-cell">
                <span className="result-label">XP</span>
                <strong>+{result.xp}</strong>
              </div>
              <div className="result-cell">
                <span className="result-label">Survived</span>
                <strong>{Math.round(result.survivedSec)}s</strong>
              </div>
              <div className="result-cell">
                <span className="result-label">Best combo</span>
                <strong>{result.maxCombo}x</strong>
              </div>
              <div className="result-cell">
                <span className="result-label">Rewards</span>
                <strong>{result.rewards}</strong>
              </div>
              <div className="result-cell">
                <span className="result-label">Best</span>
                <strong>{Math.max(bestScore, result.score).toLocaleString()}</strong>
              </div>
            </div>
            {claimNote ? <p className="receipt">{claimNote}</p> : null}
            <div className="overlay-actions">
              <Btn full size="lg" onClick={restart}>
                PLAY AGAIN
              </Btn>
              <Btn full variant="ghost" onClick={quit}>
                MAIN MENU
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
