import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeInOut = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = t => Math.pow(clamp(t), 3);
export const backOut = t => { t = clamp(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const elastic = t => { t = clamp(t); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1; };
// progress of t through [a,b]
export const prog = (t, a, b) => clamp((t - a) / (b - a));

// seeded random
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// smooth 1D noise
export function noise1(x, seed = 0) {
  const h = n => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });
}

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  return t;
}

export function mesh(geo, material, parent, pos, rot, scale) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true; m.receiveShadow = true;
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) (typeof scale === 'number') ? m.scale.setScalar(scale) : m.scale.set(...scale);
  if (parent) parent.add(m);
  return m;
}

export function pivot(parent, pos = [0, 0, 0]) {
  const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g;
}

// keyframe track: keys = [[t, value(obj of numbers)], ...], ease per segment (key[2])
export function track(keys, t) {
  if (t <= keys[0][0]) return { ...keys[0][1] };
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, a] = keys[i], [t1, b, ease] = keys[i + 1];
    if (t < t1) {
      const e = (ease || easeInOut)((t - t0) / (t1 - t0));
      const o = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const va = a[k] ?? b[k], vb = b[k] ?? a[k];
        o[k] = (typeof va === 'number') ? lerp(va, vb, e) : (e < 0.5 ? va : vb);
      }
      return o;
    }
  }
  return { ...keys[keys.length - 1][1] };
}

// snappy pose-to-pose: fast move with overshoot settle
export const snap = t => { t = clamp(t); return t < 0.55 ? backOut(t / 0.55) : 1 + (Math.sin((t - 0.55) / 0.45 * Math.PI) * 0.0); };

// two-bone IK in a sagittal plane. target = {z, y} relative to hip (y negative = down)
// returns {hip, knee} x-rotations for a leg built hanging along -y.
export function ik2(L1, L2, z, y) {
  let d = Math.hypot(z, y);
  d = clamp(d, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-4);
  const knee = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
  const alpha = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const base = Math.atan2(z, -y);
  return { hip: -(base + alpha), knee };
}
