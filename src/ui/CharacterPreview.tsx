import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getStage } from '../game/core/evolution';
import { DigoCharacter } from '../game/three/character';

/** Small rotating DIGO showcase used on the character screen. */
export function CharacterPreview({ stageIndex, size = 200 }: { stageIndex: number; size?: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 1.5, 6.4);
    camera.lookAt(0, 1.2, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2.5, 4, 4);
    scene.add(key);
    const rim = new THREE.PointLight(0x8f7dff, 14, 20);
    rim.position.set(-3, 2, -2);
    scene.add(rim);

    const stage = getStage(stageIndex);
    const character = new DigoCharacter(stage);
    scene.add(character.group);

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      character.group.rotation.y += dt * 0.7;
      character.update(dt, 'idle', 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      character.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [stageIndex, size]);

  return <div className="char-preview" ref={hostRef} style={{ width: size, height: size }} />;
}
