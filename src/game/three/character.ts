import * as THREE from 'three';
import type { AnimState } from '../core/types';
import type { EvolutionStage } from '../core/evolution';
import { faceTexture, glowTexture, type FaceExpression } from './textures';

/**
 * DIGO - layered 3D character.
 *
 * The body is built from layered primitives and the identity (eyes, brows,
 * mouth, cheeks) lives on a high resolution canvas face plate that is swapped
 * per animation, so DIGO stays recognisable in every state without shipping a
 * huge rig. Every required animation is procedural and driven by one update():
 * idle, run, left, right, dodge, collect, damage, jump, victory, defeat.
 */
export class DigoCharacter {
  readonly group = new THREE.Group();
  private bodyGroup = new THREE.Group();
  private faceGroup = new THREE.Group();
  private faceMesh: THREE.Mesh;
  private faceMaterial: THREE.MeshBasicMaterial;
  private auraRings: THREE.Mesh[] = [];
  private auraGlow: THREE.Sprite;
  private shadow: THREE.Mesh;
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private earL: THREE.Mesh;
  private earR: THREE.Mesh;
  private tail: THREE.Mesh;
  private torso: THREE.Mesh;
  private belly: THREE.Mesh;
  private bodyMaterial: THREE.MeshStandardMaterial;
  private bellyMaterial: THREE.MeshStandardMaterial;
  private accentMaterial: THREE.MeshStandardMaterial;
  private stage: EvolutionStage;
  private expression: FaceExpression = 'normal';
  private expressionTimer = 0;
  private time = 0;
  private oneShot: { name: AnimState; t: number; duration: number } | null = null;
  private flash = 0;
  private blinkTimer = 2 + Math.random() * 3;
  private facing = 0;

  constructor(stage: EvolutionStage) {
    this.stage = stage;

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: stage.bodyColor,
      metalness: 0.45,
      roughness: 0.32,
      emissive: new THREE.Color(stage.glowColor),
      emissiveIntensity: 0.16,
    });
    this.bellyMaterial = new THREE.MeshStandardMaterial({
      color: '#fff6d8',
      metalness: 0.25,
      roughness: 0.45,
      emissive: new THREE.Color(stage.glowColor),
      emissiveIntensity: 0.2,
    });
    this.accentMaterial = new THREE.MeshStandardMaterial({
      color: stage.accentColor,
      metalness: 0.5,
      roughness: 0.3,
      emissive: new THREE.Color(stage.accentColor),
      emissiveIntensity: 0.6,
    });

    // shadow
    const shadowGeo = new THREE.CircleGeometry(0.62, 24);
    this.shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.015;
    this.group.add(this.shadow);

    // aura
    const auraGroup = new THREE.Group();
    for (let i = 0; i < 2; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.78 + i * 0.16, 0.02, 6, 40),
        new THREE.MeshBasicMaterial({
          color: stage.glowColor,
          transparent: true,
          opacity: 0.5 - i * 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05 + i * 0.02;
      this.auraRings.push(ring);
      auraGroup.add(ring);
    }
    this.auraGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: stage.glowColor,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.auraGlow.scale.setScalar(3.4);
    this.auraGlow.position.y = 0.9;
    auraGroup.add(this.auraGlow);
    this.group.add(auraGroup);

    // torso
    this.torso = new THREE.Mesh(new THREE.SphereGeometry(0.6, 28, 22), this.bodyMaterial);
    this.torso.scale.set(1, 1.12, 0.9);
    this.bodyGroup.add(this.torso);

    this.belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 18), this.bellyMaterial);
    this.belly.scale.set(1, 1.05, 0.6);
    this.belly.position.set(0, -0.1, 0.36);
    this.bodyGroup.add(this.belly);

    // face plate
    this.faceMaterial = new THREE.MeshBasicMaterial({
      map: faceTexture('normal', stage.accentColor),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 1.16), this.faceMaterial);
    this.faceMesh.position.set(0, 0.16, 0.47);
    this.faceGroup.add(this.faceMesh);
    this.bodyGroup.add(this.faceGroup);

    // ears
    const earGeo = new THREE.ConeGeometry(0.13, 0.36, 12);
    this.earL = new THREE.Mesh(earGeo, this.accentMaterial);
    this.earL.position.set(-0.3, 0.62, 0.05);
    this.earL.rotation.z = 0.34;
    this.earR = this.earL.clone();
    this.earR.position.x = 0.3;
    this.earR.rotation.z = -0.34;
    this.bodyGroup.add(this.earL, this.earR);

    // arms
    const armGeo = new THREE.SphereGeometry(0.16, 16, 14);
    this.armL = new THREE.Mesh(armGeo, this.bodyMaterial);
    this.armL.scale.set(0.9, 1.5, 0.9);
    this.armL.position.set(-0.58, -0.08, 0.12);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.58;
    this.bodyGroup.add(this.armL, this.armR);

    // legs
    const legGeo = new THREE.SphereGeometry(0.17, 14, 12);
    this.legL = new THREE.Mesh(legGeo, this.accentMaterial);
    this.legL.scale.set(1, 0.7, 1.2);
    this.legL.position.set(-0.26, -0.72, 0.08);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.26;
    this.bodyGroup.add(this.legL, this.legR);

    // tail
    this.tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 10), this.accentMaterial);
    this.tail.position.set(0, -0.14, -0.52);
    this.tail.rotation.x = -Math.PI / 2.1;
    this.bodyGroup.add(this.tail);

    this.bodyGroup.position.y = 0.92;
    this.group.add(this.bodyGroup);

    this.applyStage(stage);
  }

  get headHeight(): number {
    return 0.95 * this.stage.scale;
  }

  setStage(stage: EvolutionStage): void {
    this.stage = stage;
    this.applyStage(stage);
  }

  private applyStage(stage: EvolutionStage): void {
    this.bodyMaterial.color.set(stage.bodyColor);
    this.bodyMaterial.emissive.set(stage.glowColor);
    this.bellyMaterial.emissive.set(stage.glowColor);
    this.accentMaterial.color.set(stage.accentColor);
    this.accentMaterial.emissive.set(stage.accentColor);
    this.auraRings.forEach((ring) => {
      (ring.material as THREE.MeshBasicMaterial).color.set(stage.glowColor);
    });
    this.auraGlow.material.color.set(stage.glowColor);
    this.auraGlow.material.opacity = 0.18 + stage.auraStrength * 0.35;
    this.group.scale.setScalar(stage.scale);
    if (this.expression === 'normal') this.applyExpression('normal');
  }

  private applyExpression(expression: FaceExpression): void {
    this.expression = expression;
    this.faceMaterial.map = faceTexture(expression, this.stage.accentColor);
    this.faceMaterial.needsUpdate = true;
  }

  setExpression(expression: FaceExpression, duration = 0): void {
    this.applyExpression(expression);
    this.expressionTimer = duration;
  }

  playOneShot(name: AnimState, duration: number): void {
    this.oneShot = { name, t: 0, duration };
    if (name === 'collect') this.setExpression('happy', Math.min(duration, 0.55));
    if (name === 'damage') {
      this.setExpression('hurt', Math.max(duration, 0.7));
      this.flash = 1;
    }
    if (name === 'jump') this.setExpression('focus', Math.min(duration, 0.4));
    if (name === 'dodge') this.setExpression('focus', Math.min(duration, 0.35));
  }

  setPose(state: 'victory' | 'defeat'): void {
    this.oneShot = null;
    this.applyExpression(state);
  }

  reset(): void {
    this.oneShot = null;
    this.flash = 0;
    this.expressionTimer = 0;
    this.applyExpression('normal');
    this.bodyGroup.rotation.set(0, 0, 0);
    this.bodyGroup.position.y = 0.92;
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
  }

  /**
   * @param vx horizontal velocity (world units / second) for lean + facing
   * @param airborne 0..1 jump progress (1 = peak)
   */
  update(dt: number, state: AnimState, vx: number, airborne: number): void {
    this.time += dt;
    const t = this.time;

    // expression timers
    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt;
      if (this.expressionTimer <= 0) this.applyExpression('normal');
    }

    // blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.4 + Math.random() * 3.6;
      this.faceMesh.scale.y = 0.12;
    } else {
      this.faceMesh.scale.y += (1 - this.faceMesh.scale.y) * Math.min(1, dt * 14);
    }

    // one shot animation
    let shot: AnimState | null = null;
    let shotT = 0;
    if (this.oneShot) {
      this.oneShot.t += dt;
      shotT = this.oneShot.t / this.oneShot.duration;
      if (shotT >= 1) {
        this.oneShot = null;
        shot = null;
      } else {
        shot = this.oneShot.name;
      }
    }

    const moveLean = THREE.MathUtils.clamp(vx * 0.045, -0.28, 0.28);
    this.facing += (THREE.MathUtils.clamp(vx * 0.06, -0.4, 0.4) - this.facing) * Math.min(1, dt * 8);

    const target: AnimState = shot ?? state;
    let bob = 0;
    let bodyRotZ = moveLean * 0.6;
    let bodyRotX = 0;
    let armSwing = 0;
    let legSwing = 0;
    let squash = 1;

    switch (target) {
      case 'idle': {
        bob = Math.sin(t * 2.1) * 0.055;
        bodyRotZ += Math.sin(t * 1.4) * 0.035;
        armSwing = Math.sin(t * 2.1) * 0.12;
        break;
      }
      case 'run': {
        bob = Math.abs(Math.sin(t * 12)) * 0.11;
        legSwing = Math.sin(t * 15) * 0.95;
        armSwing = -Math.sin(t * 15) * 0.8;
        bodyRotX = 0.1;
        break;
      }
      case 'left':
      case 'right': {
        const dir = target === 'left' ? -1 : 1;
        bob = Math.abs(Math.sin(t * 14)) * 0.09;
        legSwing = Math.sin(t * 16) * 1.05;
        armSwing = -Math.sin(t * 16) * 0.9;
        bodyRotZ = dir * 0.26;
        bodyRotX = 0.06;
        break;
      }
      case 'jump': {
        const p = Math.sin(Math.PI * Math.min(1, shotT || airborne));
        bob = 0.25 * p;
        squash = 1 + 0.12 * p;
        legSwing = -0.9;
        armSwing = 1.4;
        break;
      }
      case 'dodge': {
        const p = Math.min(1, shotT);
        bodyRotX = p * Math.PI * 2;
        squash = 1 - 0.12 * Math.sin(p * Math.PI);
        break;
      }
      case 'collect': {
        const p = Math.min(1, shotT);
        squash = 1 + 0.24 * Math.sin(p * Math.PI);
        bob = 0.18 * Math.sin(p * Math.PI);
        armSwing = 1.8 * Math.sin(p * Math.PI);
        break;
      }
      case 'damage': {
        const p = Math.min(1, shotT);
        const shake = Math.sin(p * Math.PI * 8) * (1 - p);
        bodyRotZ = shake * 0.35;
        squash = 1 - 0.14 * Math.sin(p * Math.PI);
        bob = -0.06 * Math.sin(p * Math.PI);
        break;
      }
      case 'victory': {
        const p = (t * 2) % 1;
        bob = Math.abs(Math.sin(p * Math.PI)) * 0.32;
        armSwing = 2.2;
        bodyRotZ = Math.sin(t * 3) * 0.12;
        break;
      }
      case 'defeat': {
        bodyRotX = 0;
        bodyRotZ = THREE.MathUtils.lerp(0, -1.32, Math.min(1, t * 1.6));
        bob = -0.34;
        armSwing = -0.5;
        break;
      }
      default:
        break;
    }

    this.bodyGroup.position.y = 0.92 + bob;
    this.bodyGroup.rotation.z += (bodyRotZ - this.bodyGroup.rotation.z) * Math.min(1, dt * 12);
    this.bodyGroup.rotation.x += (bodyRotX - this.bodyGroup.rotation.x) * Math.min(1, dt * 10);
    this.bodyGroup.rotation.y = this.facing;
    this.bodyGroup.scale.set(
      1 + (1 - squash) * 0.5,
      squash,
      1 + (1 - squash) * 0.5,
    );

    this.legL.rotation.x = legSwing;
    this.legR.rotation.x = -legSwing;
    this.armL.rotation.x = armSwing;
    this.armR.rotation.x = -armSwing;
    this.armL.rotation.z = -Math.abs(armSwing) * 0.25;
    this.armR.rotation.z = Math.abs(armSwing) * 0.25;
    this.earL.rotation.z = 0.34 + Math.sin(t * 3.4) * 0.09;
    this.earR.rotation.z = -0.34 - Math.sin(t * 3.4 + 0.6) * 0.09;
    this.tail.rotation.y = Math.sin(t * 5) * 0.4;

    // damage flash
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      this.bodyMaterial.emissiveIntensity = 0.16 + this.flash * 1.6;
      this.bodyMaterial.emissive.setRGB(1, 0.15 + (1 - this.flash) * 0.8, 0.2);
      if (this.flash === 0) {
        this.bodyMaterial.emissive.set(this.stage.glowColor);
        this.bodyMaterial.emissiveIntensity = 0.16;
      }
    }

    // aura
    this.auraRings.forEach((ring, i) => {
      ring.rotation.z = t * (0.6 + i * 0.4) * (i % 2 === 0 ? 1 : -1);
      const s = 1 + Math.sin(t * 2.2 + i) * 0.06;
      ring.scale.setScalar(s * (0.8 + this.stage.auraStrength * 0.4));
    });
    this.auraGlow.material.opacity = 0.16 + this.stage.auraStrength * 0.28 + Math.sin(t * 3) * 0.04;

    // shadow follows jump height
    const lift = Math.max(0, bob);
    this.shadow.scale.setScalar(1 - Math.min(0.4, lift * 0.7));
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.32 - Math.min(0.2, lift * 0.4);
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const material = child.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
      if (child instanceof THREE.Sprite) child.material.dispose();
    });
  }
}
