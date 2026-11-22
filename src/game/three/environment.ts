import * as THREE from 'three';
import type { WorldDef } from '../core/worlds';
import { groundTexture, silhouetteTexture, skyTexture } from './textures';

/**
 * Per-world 3D backdrop: sky dome, glowing platform, parallax silhouettes,
 * ambient particles (stars, snow, embers, bubbles) and a lighting rig.
 */
export class Environment {
  readonly group = new THREE.Group();
  private ambientPoints: THREE.Points | null = null;
  private ambientData: { speed: number; drift: number }[] = [];
  private silhouettes: THREE.Mesh[] = [];
  private rails: THREE.Mesh[] = [];
  private time = 0;

  constructor(private world: WorldDef) {
    this.build();
  }

  applyTo(scene: THREE.Scene): void {
    scene.background = new THREE.Color(this.world.sky[0]);
    scene.fog = new THREE.Fog(new THREE.Color(this.world.fog), 16, 46);
  }

  private build(): void {
    // sky dome
    const skyGeo = new THREE.SphereGeometry(60, 32, 20);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTexture(this.world),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(sky);

    // background silhouette layers (parallax)
    for (let layer = 0; layer < 2; layer += 1) {
      const texture = silhouetteTexture(this.world, layer as 0 | 1);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: layer === 0 ? 0.95 : 0.6,
        fog: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 20), material);
      mesh.position.set(0, 7 - layer * 1.5, -26 + layer * 7);
      this.silhouettes.push(mesh);
      this.group.add(mesh);
    }

    // platform the player runs on
    const groundGeo = new THREE.PlaneGeometry(18, 30);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture(this.world),
      roughness: 0.55,
      metalness: 0.35,
      emissive: new THREE.Color(this.world.groundEmissive),
      emissiveIntensity: 0.55,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.position.z = 0;
    this.group.add(ground);

    // side rails so the playable width is obvious
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 30, 8),
        new THREE.MeshBasicMaterial({ color: this.world.accent, fog: false }),
      );
      rail.rotation.x = Math.PI / 2;
      rail.position.set(side * 5.05, 0.12, 0);
      this.rails.push(rail);
      this.group.add(rail);
    }

    // ambient particles
    const count = 220;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color(this.world.ambientColor);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 26;
      positions[i * 3 + 1] = Math.random() * 22;
      positions[i * 3 + 2] = -18 + Math.random() * 22;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      this.ambientData.push({ speed: 0.4 + Math.random() * 1.6, drift: Math.random() * 2 - 1 });
    }
    const ambientGeo = new THREE.BufferGeometry();
    ambientGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    ambientGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ambientMat = new THREE.PointsMaterial({
      size: this.world.ambient === 'snow' ? 0.22 : 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: skyTexture(this.world),
    });
    this.ambientPoints = new THREE.Points(ambientGeo, ambientMat);
    this.group.add(this.ambientPoints);

    // lighting rig
    const ambient = new THREE.AmbientLight(new THREE.Color(this.world.sky[1]), 1.1);
    const hemi = new THREE.HemisphereLight(
      new THREE.Color(this.world.sky[0]),
      new THREE.Color(this.world.groundEmissive),
      1.2,
    );
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(3, 12, 9);
    const fill = new THREE.PointLight(new THREE.Color(this.world.accent), 26, 30, 2);
    fill.position.set(-6, 4, 5);
    const rim = new THREE.PointLight(new THREE.Color(this.world.accent), 18, 26, 2);
    rim.position.set(6, 3, 2);
    this.group.add(ambient, hemi, key, fill, rim);
  }

  update(dt: number, speedBoost = 0): void {
    this.time += dt;
    const t = this.time;

    this.silhouettes.forEach((mesh, i) => {
      mesh.position.x = Math.sin(t * (0.08 + i * 0.05)) * 2.4;
      mesh.position.y = 7 - i * 1.5 + Math.sin(t * 0.3 + i) * 0.15;
    });

    this.rails.forEach((rail, i) => {
      const material = rail.material as THREE.MeshBasicMaterial;
      material.opacity = 1;
      const pulse = 0.6 + Math.abs(Math.sin(t * 2 + i)) * 0.4;
      rail.scale.x = pulse;
    });

    if (this.ambientPoints) {
      const attr = this.ambientPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const array = attr.array as Float32Array;
      const falling = this.world.ambient !== 'embers';
      for (let i = 0; i < this.ambientData.length; i += 1) {
        const data = this.ambientData[i];
        const idx = i * 3;
        array[idx + 1] += (falling ? -1 : 1) * data.speed * dt * (1 + speedBoost);
        array[idx] += data.drift * dt * 0.6;
        if (falling && array[idx + 1] < 0) array[idx + 1] = 22;
        if (!falling && array[idx + 1] > 22) array[idx + 1] = 0;
        if (array[idx] > 13) array[idx] = -13;
        if (array[idx] < -13) array[idx] = 13;
      }
      attr.needsUpdate = true;
    }
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.geometry.dispose();
        const material = child.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    });
  }
}
