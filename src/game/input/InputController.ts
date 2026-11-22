/**
 * Touch input for DIGO.
 *
 * The bottom control area uses Pointer Events with pointer capture so a single
 * finger keeps controlling DIGO no matter where it drags, even outside the
 * element. Movement is relative to where the finger first pressed (no jump),
 * one finger = one controller, and release/cancel/lost-capture all clear state
 * so DIGO can never get stuck. Keyboard and on-screen buttons are alternatives.
 */
export interface InputOptions {
  /** Half of the playable horizontal range in world units. */
  getHalfWidth: () => number;
  /** Current player x, used as the anchor when a drag starts. */
  getPlayerX: () => number;
  /** world units per CSS pixel. */
  getScale: () => number;
  sensitivity?: number;
}

export class InputController {
  private surface: HTMLElement | null = null;
  private activePointerId: number | null = null;
  private anchorPointerX = 0;
  private anchorPlayerX = 0;
  private targetX: number | null = null;
  private buttonAxis = 0;
  private keys = new Set<string>();
  private enabled = true;
  private lastTouchAt = 0;
  readonly state = { dragging: false, pointerId: null as number | null };

  constructor(private options: InputOptions) {}

  attach(surface: HTMLElement): void {
    this.detach();
    this.surface = surface;
    surface.addEventListener('pointerdown', this.onPointerDown);
    surface.addEventListener('pointermove', this.onPointerMove);
    surface.addEventListener('pointerup', this.onPointerUp);
    surface.addEventListener('pointercancel', this.onPointerUp);
    surface.addEventListener('lostpointercapture', this.onPointerUp);
    surface.addEventListener('contextmenu', this.prevent);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
  }

  detach(): void {
    const surface = this.surface;
    if (surface) {
      surface.removeEventListener('pointerdown', this.onPointerDown);
      surface.removeEventListener('pointermove', this.onPointerMove);
      surface.removeEventListener('pointerup', this.onPointerUp);
      surface.removeEventListener('pointercancel', this.onPointerUp);
      surface.removeEventListener('lostpointercapture', this.onPointerUp);
      surface.removeEventListener('contextmenu', this.prevent);
    }
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.releaseAll);
    this.surface = null;
    this.activePointerId = null;
    this.state.dragging = false;
    this.state.pointerId = null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.releaseAll();
  }

  /** Desired horizontal position, or null when the player is not steering. */
  getTargetX(): number | null {
    if (!this.enabled) return null;
    if (this.buttonAxis !== 0) {
      const half = this.options.getHalfWidth();
      return this.buttonAxis * half;
    }
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) return -this.options.getHalfWidth();
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) return this.options.getHalfWidth();
    return this.targetX;
  }

  setButtonAxis(axis: number): void {
    this.buttonAxis = Math.max(-1, Math.min(1, axis));
  }

  get isDragging(): boolean {
    return this.state.dragging;
  }

  private prevent = (event: Event): void => {
    event.preventDefault();
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.enabled) return;
    // ignore the first tap that only unlocks audio? no: every pointer counts
    if (this.activePointerId !== null) return; // one controller finger only
    event.preventDefault();
    const surface = this.surface;
    if (!surface) return;
    this.activePointerId = event.pointerId;
    this.state.dragging = true;
    this.state.pointerId = event.pointerId;
    this.lastTouchAt = performance.now();
    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      /* capture is best effort; drag still works inside the element */
    }
    this.anchorPointerX = event.clientX;
    this.anchorPlayerX = this.options.getPlayerX();
    this.targetX = this.clampX(this.anchorPlayerX);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    const sensitivity = this.options.sensitivity ?? 1;
    const delta = (event.clientX - this.anchorPointerX) * this.options.getScale() * sensitivity;
    this.targetX = this.clampX(this.anchorPlayerX + delta);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    const surface = this.surface;
    if (surface && surface.hasPointerCapture?.(event.pointerId)) {
      try {
        surface.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
    }
    this.activePointerId = null;
    this.state.dragging = false;
    this.state.pointerId = null;
    // keep the last target so DIGO does not snap back
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight' || event.code === 'KeyA' || event.code === 'KeyD') {
      this.keys.add(event.code);
      event.preventDefault();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  releaseAll = (): void => {
    this.keys.clear();
    this.buttonAxis = 0;
    if (this.activePointerId !== null && this.surface?.hasPointerCapture?.(this.activePointerId)) {
      try {
        this.surface.releasePointerCapture(this.activePointerId);
      } catch {
        /* ignore */
      }
    }
    this.activePointerId = null;
    this.state.dragging = false;
    this.state.pointerId = null;
  };

  reset(): void {
    this.targetX = null;
    this.releaseAll();
  }

  get lastInputAge(): number {
    return performance.now() - this.lastTouchAt;
  }

  private clampX(x: number): number {
    const half = this.options.getHalfWidth();
    return Math.max(-half, Math.min(half, x));
  }
}
