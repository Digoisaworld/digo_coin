import * as THREE from 'three';
import type { SpawnKind } from '../core/types';
import type { WorldDef } from '../core/worlds';
import { coinEmblemTexture, glowTexture, labelTexture, ringTexture } from './textures';

interface VisualParts {
  glow: THREE.Object3D[];
  warn: THREE.Object3D[];
  fuse: THREE.Object3D[];
  ring: THREE.Object3D[];
  flame: THREE.Object3D[];
  core: THREE.Object3D[];
}

const PART_KEYS: (keyof VisualParts)[] = ['glow', 'warn', 'fuse', 'ring', 'flame', 'core'];

/**
 * Builds every falling object once as a template and hands out lightweight
 * clones. Rewards and hazards are deliberately built from different shape
 * languages: rewards are round, faceted and bright; hazards are spiky, dark and
 * wrapped in a flashing red warning ring so they read instantly on a phone.
 */
export class ObjectFactory {
  private templates = new Map<SpawnKind, THREE.Group>();
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(private world: WorldDef) {
    const kinds: SpawnKind[] = [
      'coin',
      'energy',
      'diamond',
      'chest',
      'legendary',
      'bomb',
      'meteor',
      'electric',
      'spike',
      'enemy',
      'shield',
      'magnet',
      'slow',
      'double',
      'speed',
      'invincible',
    ];
    kinds.forEach((kind) => this.templates.set(kind, this.build(kind)));
  }

  create(kind: SpawnKind): THREE.Group {
    const template = this.templates.get(kind);
    if (!template) throw new Error(`Unknown object kind: ${kind}`);
    const group = template.clone(true);
    const parts: VisualParts = { glow: [], warn: [], fuse: [], ring: [], flame: [], core: [] };
    group.traverse((child) => {
      const name = child.name as keyof VisualParts;
      if (name && PART_KEYS.includes(name)) parts[name].push(child);
    });
    group.userData.parts = parts;
    return group;
  }

  /** Cheap per-instance visual life: glow pulse, warning flash, fuse spark. */
  animate(group: THREE.Group, t: number, seed: number): void {
    const parts = group.userData.parts as VisualParts | undefined;
    if (!parts) return;
    for (const sprite of parts.glow) {
      const base = (sprite.userData.baseScale as number) || 1;
      const speed = (sprite.userData.speed as number) || 3;
      sprite.scale.setScalar(base * (1 + 0.1 * Math.sin(t * speed + seed)));
    }
    for (const warn of parts.warn) {
      const pulse = 0.82 + Math.abs(Math.sin(t * 6 + seed)) * 0.35;
      warn.scale.setScalar(pulse);
      const material = (warn as THREE.Mesh).material as THREE.Material & { opacity: number };
      if (material && 'opacity' in material) {
        material.opacity = 0.35 + Math.abs(Math.sin(t * 6 + seed)) * 0.5;
      }
    }
    for (const fuse of parts.fuse) {
      fuse.scale.setScalar(0.8 + Math.random() * 0.55);
    }
    for (const ring of parts.ring) {
      ring.rotation.z = t * 1.6 + seed;
      ring.rotation.x = Math.sin(t * 0.8 + seed) * 0.5;
    }
    for (const flame of parts.flame) {
      const base = (flame.userData.baseScale as number) || 1;
      flame.scale.setScalar(base * (0.85 + Math.random() * 0.4));
    }
    for (const core of parts.core) {
      core.rotation.y = t * 2 + seed;
    }
  }

  dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.templates.clear();
  }

  /* ---------------------------------------------------------------- */
  /* material helpers                                                   */
  /* ---------------------------------------------------------------- */

  private mat(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial(params);
    this.materials.push(material);
    return material;
  }

  private basic(params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial(params);
    this.materials.push(material);
    return material;
  }

  private geo<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private glow(color: string, size: number, opacity = 0.85, speed = 3): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.materials.push(material);
    const sprite = new THREE.Sprite(material);
    sprite.name = 'glow';
    sprite.scale.setScalar(size);
    sprite.userData.baseScale = size;
    sprite.userData.speed = speed;
    return sprite;
  }

  private label(text: string, color: string, size: number, background?: string): THREE.Mesh {
    const map = labelTexture(text, color, background);
    const material = this.basic({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(size, size)), material);
    return mesh;
  }

  /* ---------------------------------------------------------------- */
  /* builders                                                           */
  /* ---------------------------------------------------------------- */

  private build(kind: SpawnKind): THREE.Group {
    switch (kind) {
      case 'coin':
        return this.buildCoin();
      case 'energy':
        return this.buildEnergy();
      case 'diamond':
        return this.buildDiamond();
      case 'chest':
        return this.buildChest();
      case 'legendary':
        return this.buildLegendary();
      case 'bomb':
        return this.buildBomb();
      case 'meteor':
        return this.buildMeteor();
      case 'electric':
        return this.buildElectric();
      case 'spike':
        return this.buildSpike();
      case 'enemy':
        return this.buildEnemy();
      case 'shield':
        return this.buildPowerUp('shield');
      case 'magnet':
        return this.buildPowerUp('magnet');
      case 'slow':
        return this.buildPowerUp('slow');
      case 'double':
        return this.buildPowerUp('double');
      case 'speed':
        return this.buildPowerUp('speed');
      case 'invincible':
        return this.buildPowerUp('invincible');
      default:
        return this.buildCoin();
    }
  }

  private buildCoin(): THREE.Group {
    const group = new THREE.Group();
    const gold = this.mat({
      color: '#ffc72c',
      metalness: 1,
      roughness: 0.18,
      emissive: '#8a5a00',
      emissiveIntensity: 0.75,
    });
    const disc = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.46, 0.46, 0.1, 32)), gold);
    disc.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.46, 0.06, 10, 34)), gold);
    const emblemMat = this.basic({
      map: coinEmblemTexture(this.world.accent),
      transparent: true,
      depthWrite: false,
    });
    const front = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(0.86, 0.86)), emblemMat);
    front.position.z = 0.061;
    const back = front.clone();
    back.position.z = -0.061;
    back.rotation.y = Math.PI;
    group.add(disc, rim, front, back);
    group.add(this.glow('#ffd54f', 2.5, 0.8, 3.4));
    group.userData.spin = 1.9;
    group.userData.radius = 0.5;
    return group;
  }

  private buildEnergy(): THREE.Group {
    const group = new THREE.Group();
    const green = this.mat({
      color: this.world.rewardColors[1] ?? '#39ff9c',
      metalness: 0.2,
      roughness: 0.12,
      emissive: this.world.rewardColors[1] ?? '#39ff9c',
      emissiveIntensity: 1.15,
      flatShading: true,
      transparent: true,
      opacity: 0.94,
    });
    const body = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.2, 0.3, 0.72, 6)), green);
    const tipTop = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.2, 0.28, 6)), green);
    tipTop.position.y = 0.5;
    const tipBottom = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.3, 0.3, 6)), green);
    tipBottom.position.y = -0.5;
    tipBottom.rotation.z = Math.PI;
    const ring = new THREE.Mesh(
      this.geo(new THREE.TorusGeometry(0.33, 0.035, 8, 24)),
      this.basic({ color: '#d8ffe9', transparent: true, opacity: 0.9 }),
    );
    ring.name = 'ring';
    ring.rotation.x = Math.PI / 2;
    group.add(body, tipTop, tipBottom, ring);
    group.add(this.glow('#3dffa8', 2.3, 0.85, 4));
    group.userData.spin = 1.5;
    group.userData.radius = 0.46;
    return group;
  }

  private buildDiamond(): THREE.Group {
    const group = new THREE.Group();
    const crystal = new THREE.MeshPhysicalMaterial({
      color: '#8ef0ff',
      metalness: 0.05,
      roughness: 0.04,
      emissive: '#1f9fd0',
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.92,
      flatShading: true,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });
    this.materials.push(crystal);
    const gem = new THREE.Mesh(this.geo(new THREE.OctahedronGeometry(0.5, 0)), crystal);
    gem.scale.set(1, 1.4, 1);
    const core = new THREE.Mesh(
      this.geo(new THREE.OctahedronGeometry(0.2, 0)),
      this.basic({ color: '#eaffff' }),
    );
    core.name = 'core';
    group.add(gem, core);
    group.add(this.glow('#4fe3ff', 2.9, 0.9, 3));
    group.userData.spin = 2.2;
    group.userData.radius = 0.52;
    return group;
  }

  private buildChest(): THREE.Group {
    const group = new THREE.Group();
    const wood = this.mat({ color: '#6b3f1d', metalness: 0.2, roughness: 0.65 });
    const gold = this.mat({
      color: '#ffcb45',
      metalness: 1,
      roughness: 0.22,
      emissive: '#6b4300',
      emissiveIntensity: 0.5,
    });
    const base = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.92, 0.56, 0.62)), wood);
    const lid = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.96, 0.26, 0.66)), gold);
    lid.position.y = 0.4;
    const bandL = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.12, 0.6, 0.66)), gold);
    bandL.position.set(-0.32, 0.02, 0);
    const bandR = bandL.clone();
    bandR.position.x = 0.32;
    const lock = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.2, 0.24, 0.1)), gold);
    lock.position.set(0, 0.1, 0.33);
    const keyhole = new THREE.Mesh(
      this.geo(new THREE.CircleGeometry(0.04, 12)),
      this.basic({ color: '#2a1a08' }),
    );
    keyhole.position.set(0, 0.1, 0.385);
    group.add(base, lid, bandL, bandR, lock, keyhole);
    group.add(this.glow('#ffcf5c', 2.6, 0.75, 2.4));
    group.userData.spin = 0.9;
    group.userData.radius = 0.62;
    return group;
  }

  private buildLegendary(): THREE.Group {
    const group = new THREE.Group();
    const purple = this.mat({
      color: '#a24bff',
      metalness: 0.55,
      roughness: 0.2,
      emissive: '#6a1fb8',
      emissiveIntensity: 1.1,
      flatShading: true,
    });
    const gold = this.mat({
      color: '#ffd45e',
      metalness: 1,
      roughness: 0.16,
      emissive: '#7a5200',
      emissiveIntensity: 0.8,
    });
    const core = new THREE.Mesh(this.geo(new THREE.IcosahedronGeometry(0.44, 1)), purple);
    core.name = 'core';
    const shell = new THREE.Mesh(
      this.geo(new THREE.IcosahedronGeometry(0.66, 0)),
      this.basic({ color: '#ffe6a3', wireframe: true, transparent: true, opacity: 0.75 }),
    );
    const ringA = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.74, 0.035, 8, 36)), gold);
    ringA.name = 'ring';
    const ringB = ringA.clone();
    ringB.rotation.x = Math.PI / 2.4;
    group.add(core, shell, ringA, ringB);
    group.add(this.glow('#c06bff', 3.4, 0.9, 2.6));
    group.userData.spin = 2.4;
    group.userData.radius = 0.68;
    return group;
  }

  private warningRing(size: number): THREE.Mesh {
    const map = ringTexture('#ff3b30');
    const material = this.basic({
      map,
      color: '#ff3b30',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(size, size)), material);
    mesh.name = 'warn';
    mesh.rotation.x = -Math.PI / 2.4;
    return mesh;
  }

  private buildBomb(): THREE.Group {
    const group = new THREE.Group();
    const shell = this.mat({
      color: '#14161c',
      metalness: 0.75,
      roughness: 0.28,
      emissive: '#000000',
    });
    const body = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.46, 26, 20)), shell);
    const cap = new THREE.Mesh(
      this.geo(new THREE.CylinderGeometry(0.15, 0.19, 0.16, 14)),
      this.mat({ color: '#5d6472', metalness: 0.9, roughness: 0.3 }),
    );
    cap.position.y = 0.45;
    const fuse = new THREE.Mesh(
      this.geo(new THREE.TorusGeometry(0.17, 0.032, 6, 14, Math.PI)),
      this.mat({ color: '#c9a06a', roughness: 0.8 }),
    );
    fuse.position.set(0.1, 0.52, 0);
    fuse.rotation.z = -0.35;
    const spark = this.glow('#ffb03a', 0.75, 1, 9);
    spark.name = 'fuse';
    spark.position.set(0.22, 0.66, 0);
    const symbol = this.label('!', '#ffffff', 0.46, 'rgba(255,42,42,0.95)');
    symbol.position.set(0, 0.02, 0.47);
    const ring = this.warningRing(1.7);
    ring.position.y = -0.1;
    group.add(body, cap, fuse, spark, symbol, ring);
    group.add(this.glow('#ff2d2d', 2.6, 0.55, 5));
    group.userData.spin = 0.7;
    group.userData.radius = 0.5;
    group.userData.hazard = true;
    return group;
  }

  private buildMeteor(): THREE.Group {
    const group = new THREE.Group();
    const rock = this.mat({
      color: '#3a1c0d',
      metalness: 0.15,
      roughness: 0.95,
      emissive: '#ff4b00',
      emissiveIntensity: 0.85,
      flatShading: true,
    });
    const body = new THREE.Mesh(this.geo(new THREE.IcosahedronGeometry(0.48, 1)), rock);
    body.scale.set(1, 1.05, 1);
    const flameTop = this.glow('#ff8a1f', 1.9, 0.9, 8);
    flameTop.name = 'flame';
    flameTop.position.y = 0.5;
    const flameMid = this.glow('#ffd166', 1.1, 0.95, 11);
    flameMid.name = 'flame';
    flameMid.position.y = 0.78;
    const smoke = this.glow('#6b6b7a', 2.2, 0.35, 2);
    smoke.position.y = 1.1;
    group.add(body, flameTop, flameMid, smoke);
    group.add(this.glow('#ff5a00', 2.8, 0.7, 6));
    group.userData.spin = 1.3;
    group.userData.radius = 0.55;
    group.userData.hazard = true;
    return group;
  }

  private buildElectric(): THREE.Group {
    const group = new THREE.Group();
    const coreMat = this.mat({
      color: '#ff2b4e',
      metalness: 0.4,
      roughness: 0.2,
      emissive: '#ff0033',
      emissiveIntensity: 1.6,
    });
    const core = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.28, 20, 16)), coreMat);
    const arcMat = this.basic({
      color: '#ff5f7a',
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 3; i += 1) {
      const arc = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.42, 0.028, 6, 20)), arcMat);
      arc.name = 'ring';
      arc.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      group.add(arc);
    }
    const symbol = this.label('⚡', '#ffffff', 0.42, 'rgba(255,20,50,0.9)');
    symbol.position.set(0, 0, 0.32);
    group.add(core, symbol);
    group.add(this.glow('#ff1744', 2.9, 0.8, 7));
    group.userData.spin = 3.6;
    group.userData.radius = 0.48;
    group.userData.hazard = true;
    return group;
  }

  private buildSpike(): THREE.Group {
    const group = new THREE.Group();
    const metal = this.mat({
      color: '#2b2f3a',
      metalness: 0.95,
      roughness: 0.25,
      emissive: '#4a0b12',
      emissiveIntensity: 0.4,
    });
    const base = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.42, 0.46, 0.18, 10)), metal);
    base.position.y = 0.22;
    for (let i = 0; i < 5; i += 1) {
      const spike = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.11, 0.52, 8)), metal);
      const angle = (i / 5) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.27, 0, Math.sin(angle) * 0.27);
      spike.rotation.x = Math.PI;
      group.add(spike);
    }
    const center = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.16, 0.72, 8)), metal);
    center.rotation.x = Math.PI;
    center.position.y = -0.1;
    group.add(base, center);
    const ring = this.warningRing(1.5);
    ring.position.y = 0.26;
    group.add(ring);
    group.add(this.glow('#ff2d55', 1.9, 0.5, 4));
    group.userData.spin = 0.5;
    group.userData.radius = 0.5;
    group.userData.hazard = true;
    return group;
  }

  private buildEnemy(): THREE.Group {
    const group = new THREE.Group();
    const skin = this.mat({
      color: '#4a1d6b',
      metalness: 0.35,
      roughness: 0.45,
      emissive: '#8a1aff',
      emissiveIntensity: 0.45,
      flatShading: true,
    });
    const body = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.4, 16, 14)), skin);
    body.scale.set(1, 0.92, 0.95);
    for (let i = 0; i < 5; i += 1) {
      const spike = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.08, 0.3, 6)), skin);
      const angle = (i / 5) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.34, 0.24, Math.sin(angle) * 0.34);
      spike.rotation.z = Math.cos(angle) * -0.6;
      spike.rotation.x = Math.sin(angle) * 0.6;
      group.add(spike);
    }
    const eyeMat = this.basic({ color: '#ff2b2b' });
    const eyeL = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.09, 12, 10)), eyeMat);
    eyeL.position.set(-0.14, 0.08, 0.36);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;
    const glowL = this.glow('#ff2b2b', 0.55, 0.9, 8);
    glowL.position.set(-0.14, 0.08, 0.42);
    const glowR = this.glow('#ff2b2b', 0.55, 0.9, 8);
    glowR.position.set(0.14, 0.08, 0.42);
    const mouth = this.label('ᗜ', '#ffb3c1', 0.28, 'rgba(0,0,0,0)');
    mouth.position.set(0, -0.16, 0.37);
    group.add(body, eyeL, eyeR, glowL, glowR, mouth);
    group.add(this.glow('#a53bff', 2.4, 0.6, 3));
    group.userData.spin = 1.1;
    group.userData.radius = 0.5;
    group.userData.hazard = true;
    return group;
  }

  private buildPowerUp(kind: 'shield' | 'magnet' | 'slow' | 'double' | 'speed' | 'invincible'): THREE.Group {
    const group = new THREE.Group();
    const colors: Record<string, [string, string, string]> = {
      shield: ['#4fc3f7', '#0277bd', '🛡'],
      magnet: ['#ff5252', '#b71c1c', '🧲'],
      slow: ['#80deea', '#006064', '⏳'],
      double: ['#ffd54f', '#ff8f00', '×2'],
      speed: ['#ffb74d', '#e65100', '»'],
      invincible: ['#fff59d', '#f9a825', '★'],
    };
    const [primary, dark, glyph] = colors[kind];
    const shellMat = this.mat({
      color: primary,
      metalness: 0.5,
      roughness: 0.18,
      emissive: dark,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.96,
      flatShading: true,
    });

    let body: THREE.Mesh;
    switch (kind) {
      case 'shield': {
        body = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 6)), shellMat);
        body.rotation.x = Math.PI / 2;
        break;
      }
      case 'magnet': {
        body = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.3, 0.13, 12, 22, Math.PI * 1.35)), shellMat);
        break;
      }
      case 'slow': {
        body = new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.38, 18, 14)), shellMat);
        break;
      }
      case 'double': {
        body = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.6, 0.6, 0.6)), shellMat);
        break;
      }
      case 'speed': {
        body = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.34, 0.7, 4)), shellMat);
        break;
      }
      default: {
        body = new THREE.Mesh(this.geo(new THREE.IcosahedronGeometry(0.42, 0)), shellMat);
        break;
      }
    }

    const icon = this.label(glyph, '#ffffff', 0.42, 'rgba(0,0,0,0)');
    icon.position.z = 0.42;
    if (kind === 'magnet') icon.position.y = 0.02;

    const ring = new THREE.Mesh(
      this.geo(new THREE.TorusGeometry(0.56, 0.03, 8, 28)),
      this.basic({ color: '#ffffff', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.name = 'ring';

    group.add(body, icon, ring);
    group.add(this.glow(primary, 2.6, 0.85, 5));
    group.userData.spin = 1.4;
    group.userData.radius = 0.55;
    group.userData.powerUp = kind;
    return group;
  }

  /** Boss encounter visual: a huge hostile titan with a weak point core. */
  createBoss(): THREE.Group {
    const group = new THREE.Group();
    const skin = this.mat({
      color: '#2a1038',
      metalness: 0.5,
      roughness: 0.4,
      emissive: this.world.accent,
      emissiveIntensity: 0.35,
      flatShading: true,
    });
    const body = new THREE.Mesh(this.geo(new THREE.IcosahedronGeometry(1.05, 1)), skin);
    const crown = new THREE.Mesh(
      this.geo(new THREE.ConeGeometry(0.42, 0.6, 6)),
      this.mat({ color: this.world.accent, metalness: 0.9, roughness: 0.25, emissive: this.world.accent, emissiveIntensity: 0.9 }),
    );
    crown.position.y = 1.15;
    const core = new THREE.Mesh(
      this.geo(new THREE.SphereGeometry(0.34, 20, 16)),
      this.mat({ color: '#ff3b6b', emissive: '#ff0033', emissiveIntensity: 1.8, roughness: 0.2 }),
    );
    core.name = 'core';
    core.position.z = 0.85;
    const eyeL = this.glow('#ff2b2b', 0.9, 1, 6);
    eyeL.position.set(-0.36, 0.3, 0.9);
    const eyeR = this.glow('#ff2b2b', 0.9, 1, 6);
    eyeR.position.set(0.36, 0.3, 0.9);
    group.add(body, crown, core, eyeL, eyeR);
    group.add(this.glow(this.world.accent, 5, 0.6, 2));
    return group;
  }
}
