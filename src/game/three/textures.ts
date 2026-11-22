import * as THREE from 'three';
import { seededRng } from '../core/rng';
import type { WorldDef } from '../core/worlds';

/* ------------------------------------------------------------------ */
/* canvas helpers                                                      */
/* ------------------------------------------------------------------ */

const textureCache = new Map<string, THREE.Texture>();

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return [canvas, ctx];
}

function finish(canvas: HTMLCanvasElement, key: string): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

/* ------------------------------------------------------------------ */
/* glow / spark sprites                                                */
/* ------------------------------------------------------------------ */

export function glowTexture(): THREE.Texture {
  const cached = textureCache.get('glow');
  if (cached) return cached;
  const [canvas, ctx] = canvasOf(128, 128);
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.16)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return finish(canvas, 'glow');
}

export function sparkTexture(): THREE.Texture {
  const cached = textureCache.get('spark');
  if (cached) return cached;
  const [canvas, ctx] = canvasOf(64, 64);
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return finish(canvas, 'spark');
}

export function ringTexture(color = '#ffffff'): THREE.Texture {
  const key = `ring:${color}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const [canvas, ctx] = canvasOf(256, 256);
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(128, 128, 108, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(128, 128, 100, 0, Math.PI * 2);
  ctx.stroke();
  return finish(canvas, key);
}

/* ------------------------------------------------------------------ */
/* DIGO face - layered artwork swapped per animation                   */
/* ------------------------------------------------------------------ */

export type FaceExpression = 'normal' | 'happy' | 'hurt' | 'focus' | 'victory' | 'defeat';

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  accent: string,
  mode: FaceExpression,
): void {
  ctx.save();
  if (mode === 'victory') {
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#3a2a00';
    ctx.lineWidth = 6;
    star(ctx, cx, cy, rx * 1.15);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (mode === 'defeat') {
    ctx.strokeStyle = '#12162e';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.7, cy - ry * 0.7);
    ctx.lineTo(cx + rx * 0.7, cy + ry * 0.7);
    ctx.moveTo(cx + rx * 0.7, cy - ry * 0.7);
    ctx.lineTo(cx - rx * 0.7, cy + ry * 0.7);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // eye socket
  ctx.fillStyle = '#0b1030';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // iris
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.08, rx * 0.62, ry * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();

  // pupil
  ctx.fillStyle = '#070a1c';
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.12, rx * 0.3, ry * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  // highlights
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.26, cy - ry * 0.34, rx * 0.24, ry * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.3, cy + ry * 0.3, rx * 0.12, ry * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // squint for hurt / focus
  if (mode === 'hurt' || mode === 'focus') {
    ctx.fillStyle = '#0b1030';
    const lidY = mode === 'hurt' ? cy - ry * 0.15 : cy - ry * 0.45;
    ctx.fillRect(cx - rx * 1.05, cy - ry * 1.1, rx * 2.1, lidY - (cy - ry * 1.1));
  }
  ctx.restore();
}

export function faceTexture(expression: FaceExpression, accent: string): THREE.Texture {
  const key = `face:${expression}:${accent}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 512;
  const [canvas, ctx] = canvasOf(size, size);

  // eyes
  drawEye(ctx, 172, 232, 74, 88, accent, expression);
  drawEye(ctx, 340, 232, 74, 88, accent, expression);

  // brows for attitude
  ctx.strokeStyle = '#0b1030';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  if (expression === 'hurt') {
    ctx.beginPath();
    ctx.moveTo(112, 128);
    ctx.lineTo(206, 158);
    ctx.moveTo(400, 128);
    ctx.lineTo(306, 158);
    ctx.stroke();
  } else if (expression === 'focus') {
    ctx.beginPath();
    ctx.moveTo(112, 150);
    ctx.lineTo(206, 138);
    ctx.moveTo(400, 150);
    ctx.lineTo(306, 138);
    ctx.stroke();
  } else if (expression === 'happy' || expression === 'victory') {
    ctx.beginPath();
    ctx.moveTo(116, 140);
    ctx.quadraticCurveTo(172, 112, 222, 140);
    ctx.moveTo(396, 140);
    ctx.quadraticCurveTo(340, 112, 290, 140);
    ctx.stroke();
  }

  // cheeks
  ctx.fillStyle = 'rgba(255,120,160,0.28)';
  ctx.beginPath();
  ctx.ellipse(110, 330, 44, 24, 0, 0, Math.PI * 2);
  ctx.ellipse(402, 330, 44, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  // mouth
  ctx.strokeStyle = '#0b1030';
  ctx.fillStyle = '#2a0f1c';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  if (expression === 'happy' || expression === 'victory') {
    ctx.beginPath();
    ctx.moveTo(196, 348);
    ctx.quadraticCurveTo(256, 424, 316, 348);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff7a9c';
    ctx.beginPath();
    ctx.ellipse(256, 398, 30, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (expression === 'hurt') {
    ctx.beginPath();
    ctx.ellipse(256, 384, 34, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'defeat') {
    ctx.beginPath();
    ctx.moveTo(212, 386);
    ctx.quadraticCurveTo(256, 360, 300, 386);
    ctx.stroke();
  } else if (expression === 'focus') {
    ctx.beginPath();
    ctx.moveTo(214, 380);
    ctx.lineTo(298, 380);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(212, 362);
    ctx.quadraticCurveTo(256, 400, 300, 362);
    ctx.stroke();
  }

  return finish(canvas, key);
}

/* ------------------------------------------------------------------ */
/* coin emblem                                                         */
/* ------------------------------------------------------------------ */

export function coinEmblemTexture(accent: string): THREE.Texture {
  const key = `coin:${accent}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const size = 512;
  const [canvas, ctx] = canvasOf(size, size);

  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, size, size);

  // engraved ring
  ctx.strokeStyle = 'rgba(120,72,0,0.85)';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(256, 256, 224, 0, Math.PI * 2);
  ctx.stroke();

  // DIGO emblem letter
  const gradient = ctx.createLinearGradient(120, 120, 400, 400);
  gradient.addColorStop(0, '#fff7d6');
  gradient.addColorStop(0.5, '#ffd23f');
  gradient.addColorStop(1, '#b8791b');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = '#7a4a00';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(150, 118);
  ctx.lineTo(268, 118);
  ctx.quadraticCurveTo(410, 118, 410, 256);
  ctx.quadraticCurveTo(410, 394, 268, 394);
  ctx.lineTo(150, 394);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#3d2500';
  ctx.beginPath();
  ctx.moveTo(212, 176);
  ctx.lineTo(268, 176);
  ctx.quadraticCurveTo(340, 176, 340, 256);
  ctx.quadraticCurveTo(340, 336, 268, 336);
  ctx.lineTo(212, 336);
  ctx.closePath();
  ctx.fill();

  // eyes inside the counter to echo the character face
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(240, 232, 16, 20, 0, 0, Math.PI * 2);
  ctx.ellipse(292, 232, 16, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(235, 224, 6, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(287, 224, 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  return finish(canvas, key);
}

/* ------------------------------------------------------------------ */
/* labels                                                             */
/* ------------------------------------------------------------------ */

export function labelTexture(
  text: string,
  color: string,
  background = 'rgba(8,10,24,0.82)',
): THREE.Texture {
  const key = `label:${text}:${color}:${background}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const [canvas, ctx] = canvasOf(256, 256);
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(8, 64, 240, 128, 28) : ctx.rect(8, 64, 240, 128);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 96px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 130);
  return finish(canvas, key);
}

/* ------------------------------------------------------------------ */
/* world sky + silhouettes + ground                                    */
/* ------------------------------------------------------------------ */

export function skyTexture(world: WorldDef): THREE.Texture {
  const key = `sky:${world.id}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const [canvas, ctx] = canvasOf(1024, 1024);

  const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
  gradient.addColorStop(0, world.skyTop);
  gradient.addColorStop(0.55, world.skyBottom);
  gradient.addColorStop(0.78, world.horizon);
  gradient.addColorStop(1, world.skyTop);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1024);

  // atmospheric glow band
  const glow = ctx.createRadialGradient(512, 700, 20, 512, 700, 620);
  glow.addColorStop(0, `${world.accent}55`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 1024);

  // stars / specks
  const rng = seededRng(`${world.id}-sky`);
  for (let i = 0; i < 220; i += 1) {
    const x = rng() * 1024;
    const y = rng() * 720;
    const r = rng() * 1.9 + 0.4;
    ctx.globalAlpha = 0.25 + rng() * 0.6;
    ctx.fillStyle = rng() > 0.7 ? world.accent : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // celestial body
  const cx = world.id === 'space' ? 760 : 250;
  const cy = 190;
  const sun = ctx.createRadialGradient(cx, cy, 8, cx, cy, 190);
  sun.addColorStop(0, 'rgba(255,255,255,0.95)');
  sun.addColorStop(0.2, `${world.accent}cc`);
  sun.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, cy, 190, 0, Math.PI * 2);
  ctx.fill();

  return finish(canvas, key);
}

/** Draws the world specific skyline / scenery silhouette. */
export function silhouetteTexture(world: WorldDef, layer: 0 | 1): THREE.Texture {
  const key = `sil:${world.id}:${layer}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const [canvas, ctx] = canvasOf(1024, 512);
  const rng = seededRng(`${world.id}-sil-${layer}`);
  ctx.fillStyle = world.silhouette;
  const baseY = 512;

  const drawBuildings = () => {
    let x = -40;
    while (x < 1064) {
      const w = 50 + rng() * 90;
      const h = 120 + rng() * (layer === 0 ? 300 : 210);
      ctx.fillRect(x, baseY - h, w, h);
      if (layer === 1) {
        ctx.fillStyle = `${world.accent}66`;
        for (let wy = baseY - h + 24; wy < baseY - 20; wy += 34) {
          for (let wx = x + 12; wx < x + w - 14; wx += 26) {
            if (rng() > 0.45) ctx.fillRect(wx, wy, 10, 14);
          }
        }
        ctx.fillStyle = world.silhouette;
      }
      x += w + 12 + rng() * 26;
    }
  };

  const drawMountains = () => {
    ctx.beginPath();
    ctx.moveTo(-40, baseY);
    let x = -40;
    while (x < 1064) {
      const peak = baseY - (140 + rng() * (layer === 0 ? 320 : 220));
      const next = x + 120 + rng() * 160;
      ctx.lineTo((x + next) / 2, peak);
      ctx.lineTo(next, baseY - 40 - rng() * 60);
      x = next;
    }
    ctx.lineTo(1064, baseY);
    ctx.closePath();
    ctx.fill();
  };

  const drawPalms = () => {
    for (let i = 0; i < (layer === 0 ? 7 : 11); i += 1) {
      const x = 40 + i * (1000 / (layer === 0 ? 7 : 11)) + rng() * 40;
      const h = (layer === 0 ? 230 : 160) + rng() * 90;
      ctx.fillRect(x - 7, baseY - h, 14, h);
      for (let f = 0; f < 6; f += 1) {
        const angle = (Math.PI / 3) * f - Math.PI / 2 + (rng() - 0.5) * 0.5;
        ctx.beginPath();
        ctx.ellipse(
          x + Math.cos(angle) * 52,
          baseY - h + Math.sin(angle) * 40,
          56,
          16,
          angle,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.fillRect(-40, baseY - 60, 1104, 60);
  };

  const drawCrystals = () => {
    for (let i = 0; i < (layer === 0 ? 9 : 15); i += 1) {
      const x = rng() * 1024;
      const h = (layer === 0 ? 200 : 130) + rng() * 220;
      const w = 40 + rng() * 46;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + w * 0.5, baseY - h);
      ctx.lineTo(x + w, baseY);
      ctx.closePath();
      ctx.fill();
    }
  };

  const drawTemple = () => {
    for (let i = 0; i < (layer === 0 ? 5 : 8); i += 1) {
      const w = 60 + rng() * 40;
      const h = (layer === 0 ? 240 : 170) + rng() * 130;
      const x = 60 + i * 130 + rng() * 30;
      ctx.fillRect(x, baseY - h, w, h);
      ctx.fillRect(x - 14, baseY - h - 22, w + 28, 24);
    }
    ctx.fillRect(-40, baseY - 46, 1104, 46);
  };

  const drawVolcano = () => {
    ctx.beginPath();
    ctx.moveTo(-40, baseY);
    ctx.lineTo(260, baseY - 300);
    ctx.lineTo(360, baseY - 250);
    ctx.lineTo(620, baseY - 340);
    ctx.lineTo(880, baseY - 210);
    ctx.lineTo(1064, baseY - 120);
    ctx.lineTo(1064, baseY);
    ctx.closePath();
    ctx.fill();
  };

  switch (world.id) {
    case 'tropical':
      drawPalms();
      break;
    case 'cyberpunk':
      drawBuildings();
      break;
    case 'temple':
      drawTemple();
      break;
    case 'space':
      drawMountains();
      break;
    case 'lava':
      drawVolcano();
      break;
    case 'crystal':
      drawCrystals();
      break;
    case 'frozen':
      drawMountains();
      break;
    default:
      drawBuildings();
  }

  return finish(canvas, key);
}

export function groundTexture(world: WorldDef): THREE.Texture {
  const key = `ground:${world.id}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const [canvas, ctx] = canvasOf(512, 512);
  ctx.fillStyle = world.ground;
  ctx.fillRect(0, 0, 512, 512);

  const rng = seededRng(`${world.id}-ground`);
  for (let i = 0; i < 160; i += 1) {
    ctx.globalAlpha = 0.05 + rng() * 0.1;
    ctx.fillStyle = rng() > 0.5 ? world.groundLine : world.silhouette;
    const r = 6 + rng() * 42;
    ctx.beginPath();
    ctx.arc(rng() * 512, rng() * 512, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // perspective grid
  ctx.strokeStyle = `${world.groundLine}55`;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  textureCache.set(key, texture);
  return texture;
}

export function disposeTextureCache(): void {
  textureCache.forEach((texture) => texture.dispose());
  textureCache.clear();
}
