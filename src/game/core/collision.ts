/** Circle collision helpers plus a tracker that guarantees one hit per object. */

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export function overlaps(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = a.r + b.r;
  return dx * dx + dy * dy <= radius * radius;
}

export function distance(a: Circle, b: Circle): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Remembers which object ids already produced a collision so a single object can
 * never apply damage or score twice (the classic "double collect" bug).
 */
export class CollisionTracker {
  private seen = new Set<number>();

  isFirstContact(id: number): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    return true;
  }

  release(id: number): void {
    this.seen.delete(id);
  }

  reset(): void {
    this.seen.clear();
  }

  get size(): number {
    return this.seen.size;
  }
}

/** Swept check used for fast objects so they cannot tunnel through DIGO. */
export function sweptOverlaps(prevY: number, nextY: number, a: Circle, b: Circle): boolean {
  if (overlaps(a, b)) return true;
  const steps = Math.min(6, Math.max(1, Math.ceil(Math.abs(nextY - prevY) / (a.r * 0.8))));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const probe: Circle = { x: a.x, y: prevY + (nextY - prevY) * t, r: a.r };
    if (overlaps(probe, b)) return true;
  }
  return false;
}
