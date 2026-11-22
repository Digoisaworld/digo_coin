import * as THREE from 'three';
import { sparkTexture } from './textures';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

/**
 * One additive Points cloud for every spark in the game. Keeping all particles
 * in a single buffer avoids per-object draw calls on mobile.
 */
export class ParticleSystem {
  readonly points: THREE.Points;
  private particles: Particle[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private cursor = 0;

  constructor(private capacity = 420) {
    this.positions = new Float32Array(this.capacity * 3);
    this.colors = new Float32Array(this.capacity * 3);
    this.sizes = new Float32Array(this.capacity);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    this.material = new THREE.PointsMaterial({
      size: 0.5,
      map: sparkTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    });

    for (let i = 0; i < this.capacity; i += 1) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 0.4,
        color: new THREE.Color(0xffffff),
      });
      this.positions[i * 3 + 1] = -999;
    }

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(
    x: number,
    y: number,
    color: string | THREE.Color,
    count = 8,
    spread = 1.6,
    options: { z?: number; life?: number; size?: number; upward?: number } = {},
  ): void {
    const tint = color instanceof THREE.Color ? color : new THREE.Color(color);
    const z = options.z ?? 0;
    for (let i = 0; i < count; i += 1) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const p = this.particles[index];
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.2;
      p.y = y + (Math.random() - 0.5) * 0.2;
      p.z = z + (Math.random() - 0.5) * 0.4;
      p.vx = (Math.random() - 0.5) * spread;
      p.vy = (Math.random() - 0.5) * spread + (options.upward ?? 0.6);
      p.maxLife = options.life ?? 0.55 + Math.random() * 0.4;
      p.life = p.maxLife;
      p.size = options.size ?? 0.25 + Math.random() * 0.3;
      p.color.copy(tint);
    }
  }

  burst(x: number, y: number, color: string, count = 18, power = 3.4): void {
    this.emit(x, y, color, count, power, { life: 0.7, size: 0.4, upward: 0.4 });
  }

  update(dt: number): void {
    const positions = this.positions;
    const colors = this.colors;
    for (let i = 0; i < this.capacity; i += 1) {
      const p = this.particles[i];
      if (!p.active) {
        positions[i * 3 + 1] = -999;
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        positions[i * 3 + 1] = -999;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 2.4 * dt;
      p.vx *= 0.98;
      const t = p.life / p.maxLife;
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      colors[i * 3] = p.color.r * t;
      colors[i * 3 + 1] = p.color.g * t;
      colors[i * 3 + 2] = p.color.b * t;
      this.sizes[i] = p.size * t;
    }
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    for (const p of this.particles) p.active = false;
    this.update(0.016);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
