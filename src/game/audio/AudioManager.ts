import type { WorldMusic } from '../core/worlds';

export type SfxName =
  | 'coin'
  | 'diamond'
  | 'energy'
  | 'chest'
  | 'legendary'
  | 'bombWarn'
  | 'explosion'
  | 'enemyHit'
  | 'damage'
  | 'powerup'
  | 'levelUp'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'shield'
  | 'dodge';

/**
 * Fully procedural audio: every sound effect and the per-world music loop are
 * synthesised with the Web Audio API, so the game ships without binary assets
 * and stays small on mobile data. The context is only created after the first
 * user gesture, which is what mobile browsers require.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private music: WorldMusic | null = null;
  private musicWanted = false;

  sfxVolume = 0.7;
  musicVolume = 0.4;
  muted = false;

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture (tap/click) on mobile. */
  unlock(): boolean {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
    } catch {
      return false;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVolume * 0.7;
    this.musicBus.connect(this.master);

    this.noise = this.createNoise();
    if (this.musicWanted && this.music) this.beginMusicLoop(this.music);
    return true;
  }

  private createNoise(): AudioBuffer | null {
    if (!this.ctx) return null;
    const length = Math.floor(this.ctx.sampleRate * 0.9);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.musicVolume = Math.max(0, Math.min(1, music));
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume;
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume * 0.7;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  /* ---------------------------------------------------------------- */
  /* synthesis helpers                                                  */
  /* ---------------------------------------------------------------- */

  private tone(params: {
    freq: number;
    to?: number;
    type?: OscillatorType;
    duration?: number;
    gain?: number;
    delay?: number;
    attack?: number;
    bus?: 'sfx' | 'music';
  }): void {
    const ctx = this.ctx;
    const bus = params.bus === 'music' ? this.musicBus : this.sfxBus;
    if (!ctx || !bus) return;
    const now = ctx.currentTime + (params.delay ?? 0);
    const duration = params.duration ?? 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = params.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, params.freq), now);
    if (params.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, params.to), now + duration);
    }
    const peak = Math.max(0.0001, params.gain ?? 0.22);
    const attack = params.attack ?? 0.008;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(bus);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noiseBurst(params: {
    duration?: number;
    gain?: number;
    filterFrom?: number;
    filterTo?: number;
    delay?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.sfxBus) return;
    const now = ctx.currentTime + (params.delay ?? 0);
    const duration = params.duration ?? 0.4;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.filterFrom ?? 1800, now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, params.filterTo ?? 180),
      now + duration,
    );
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(params.gain ?? 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.sfxBus);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  /* ---------------------------------------------------------------- */
  /* effects                                                            */
  /* ---------------------------------------------------------------- */

  play(name: SfxName, variant = 0): void {
    if (!this.ctx || this.muted) return;
    const step = Math.min(12, Math.max(0, variant)) * 26;
    switch (name) {
      case 'coin':
        this.tone({ freq: 1046 + step, to: 1568 + step, type: 'triangle', duration: 0.11, gain: 0.2 });
        this.tone({ freq: 1568 + step, type: 'sine', duration: 0.16, gain: 0.12, delay: 0.05 });
        break;
      case 'energy':
        this.tone({ freq: 620 + step, to: 1240 + step, type: 'square', duration: 0.14, gain: 0.14 });
        this.tone({ freq: 930 + step, to: 1860 + step, type: 'triangle', duration: 0.2, gain: 0.1, delay: 0.04 });
        break;
      case 'diamond':
        this.tone({ freq: 1318 + step, type: 'sine', duration: 0.2, gain: 0.16 });
        this.tone({ freq: 1760 + step, type: 'sine', duration: 0.24, gain: 0.14, delay: 0.06 });
        this.tone({ freq: 2349 + step, type: 'sine', duration: 0.3, gain: 0.1, delay: 0.12 });
        break;
      case 'chest':
        this.tone({ freq: 392, type: 'triangle', duration: 0.18, gain: 0.16 });
        this.tone({ freq: 523, type: 'triangle', duration: 0.2, gain: 0.14, delay: 0.07 });
        this.tone({ freq: 784, type: 'sine', duration: 0.34, gain: 0.13, delay: 0.14 });
        break;
      case 'legendary':
        [523, 659, 784, 1046, 1318].forEach((freq, i) =>
          this.tone({ freq, type: 'triangle', duration: 0.3, gain: 0.16, delay: i * 0.06 }),
        );
        this.noiseBurst({ duration: 0.5, gain: 0.12, filterFrom: 5200, filterTo: 900 });
        break;
      case 'bombWarn':
        this.tone({ freq: 196, to: 150, type: 'square', duration: 0.16, gain: 0.16 });
        this.tone({ freq: 196, to: 150, type: 'square', duration: 0.16, gain: 0.16, delay: 0.2 });
        break;
      case 'explosion':
        this.noiseBurst({ duration: 0.55, gain: 0.5, filterFrom: 2400, filterTo: 120 });
        this.tone({ freq: 140, to: 40, type: 'sawtooth', duration: 0.4, gain: 0.3 });
        break;
      case 'enemyHit':
        this.tone({ freq: 320, to: 90, type: 'sawtooth', duration: 0.26, gain: 0.2 });
        this.noiseBurst({ duration: 0.2, gain: 0.2, filterFrom: 1200, filterTo: 200 });
        break;
      case 'damage':
        this.tone({ freq: 240, to: 70, type: 'square', duration: 0.3, gain: 0.24 });
        this.noiseBurst({ duration: 0.3, gain: 0.24, filterFrom: 900, filterTo: 120 });
        break;
      case 'powerup':
        [440, 587, 740, 988].forEach((freq, i) =>
          this.tone({ freq, type: 'triangle', duration: 0.18, gain: 0.16, delay: i * 0.05 }),
        );
        break;
      case 'levelUp':
        [523, 659, 880].forEach((freq, i) =>
          this.tone({ freq, type: 'sine', duration: 0.26, gain: 0.18, delay: i * 0.09 }),
        );
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318, 1568].forEach((freq, i) =>
          this.tone({ freq, type: 'triangle', duration: 0.42, gain: 0.18, delay: i * 0.11 }),
        );
        break;
      case 'defeat':
        [440, 392, 330, 262].forEach((freq, i) =>
          this.tone({ freq, type: 'sine', duration: 0.5, gain: 0.2, delay: i * 0.16 }),
        );
        break;
      case 'click':
        this.tone({ freq: 880, to: 1120, type: 'sine', duration: 0.06, gain: 0.12 });
        break;
      case 'shield':
        this.tone({ freq: 660, to: 330, type: 'triangle', duration: 0.22, gain: 0.18 });
        break;
      case 'dodge':
        this.tone({ freq: 420, to: 720, type: 'sine', duration: 0.12, gain: 0.1 });
        break;
      default:
        break;
    }
  }

  /* ---------------------------------------------------------------- */
  /* music                                                              */
  /* ---------------------------------------------------------------- */

  startMusic(music: WorldMusic): void {
    this.music = music;
    this.musicWanted = true;
    if (!this.ctx) return;
    this.beginMusicLoop(music);
  }

  stopMusic(): void {
    this.musicWanted = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private beginMusicLoop(music: WorldMusic): void {
    if (!this.ctx) return;
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(music), 90);
  }

  private scheduleMusic(music: WorldMusic): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicWanted) return;
    const stepDuration = 60 / music.tempo / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.35) {
      const step = this.musicStep;
      const delay = Math.max(0, this.nextNoteTime - ctx.currentTime);
      const degrees = music.scale;
      const degree = degrees[step % degrees.length];
      const octave = step % 8 === 0 ? 2 : 1;

      // bass pulse on the beat
      if (step % 4 === 0) {
        this.tone({
          freq: music.root / 2,
          type: 'sine',
          duration: stepDuration * 2.6,
          gain: 0.16,
          delay,
          bus: 'music',
        });
      }
      // arpeggio
      if (step % 2 === 0) {
        this.tone({
          freq: music.root * Math.pow(2, (degree + (octave === 2 ? 12 : 0)) / 12),
          type: music.wave,
          duration: stepDuration * 1.4,
          gain: 0.07,
          delay,
          bus: 'music',
        });
      }
      // sparse melody
      if (step % 8 === 5) {
        this.tone({
          freq: music.root * Math.pow(2, (degrees[(step + 2) % degrees.length] + 12) / 12),
          type: 'triangle',
          duration: stepDuration * 2,
          gain: 0.06,
          delay,
          bus: 'music',
        });
      }

      this.musicStep = (this.musicStep + 1) % 64;
      this.nextNoteTime += stepDuration;
    }
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
  }
}

export const audio = new AudioManager();
