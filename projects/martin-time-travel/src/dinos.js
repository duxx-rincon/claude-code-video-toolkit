// T. rex, Triceratops and background animals, built from primitives.
import * as THREE from 'three';
import { mat, mesh, pivot, canvasTex, rng, clamp, ik2, lerp } from './util.js';

function skinTex(base, stripe, belly, seed) {
  return canvasTex(1024, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, base); grd.addColorStop(0.55, base); grd.addColorStop(0.72, belly); grd.addColorStop(1, belly);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const r = rng(seed);
    g.fillStyle = stripe;
    for (let i = 0; i < 26; i++) { const x = (i / 26) * w + r() * 10; g.beginPath(); g.moveTo(x - 12, 0); g.lineTo(x + 12, 0); g.lineTo(x + 3, h * (0.25 + r() * 0.2)); g.lineTo(x - 3, h * (0.25 + r() * 0.2)); g.fill(); }
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; const s = 2 + r() * 5; g.fillRect(r() * w, r() * h, s, s); }
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(255,240,200,${r() * 0.07})`; const s = 2 + r() * 4; g.fillRect(r() * w, r() * h, s, s); }
  });
}


// creature skin: dark striped back, pale belly, decided per pixel from the world normal,
// so every body part (spheres, cylinders, boxes) shares one seamless look.
export function creatureMat(back, belly, stripe, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.cBack = { value: new THREE.Color(back) }; sh.uniforms.cBelly = { value: new THREE.Color(belly) }; sh.uniforms.cStripe = { value: new THREE.Color(stripe) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWN; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWN = normalize(mat3(modelMatrix) * objectNormal); vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWN; varying vec3 vWP; uniform vec3 cBack; uniform vec3 cBelly; uniform vec3 cStripe;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float up = smoothstep(-0.35, 0.35, vWN.y);
      vec3 col = mix(cBelly, cBack, up);
      float st = smoothstep(0.55, 0.75, n3(vWP * vec3(1.6, 0.5, 1.6)) ) * smoothstep(0.1, 0.6, vWN.y);
      col = mix(col, cStripe, st * 0.8);
      col *= 0.85 + 0.3 * n3(vWP * 9.0);
      diffuseColor.rgb *= col;`);
  };
  return m;
}

// stance/swing foot path. returns {z, y} in hip-relative units for a leg.
export function gait(dist, stride, stance, lift, offset) {
  const cyc = stride / stance;
  let p = ((dist / cyc) + offset) % 1; if (p < 0) p += 1;
  if (p < stance) return { z: stride / 2 - stride * (p / stance), y: 0, p, st: true };
  const q = (p - stance) / (1 - stance);
  const e = q * q * (3 - 2 * q);
  return { z: -stride / 2 + stride * e, y: lift * Math.sin(Math.PI * q), p, st: false };
}

export function createRex(opts = {}) {
  const o = { dead: false, seed: 5, ...opts };
  const skinM = o.bone ? mat(0xe6d6b4, { roughness: 0.7 }) : creatureMat(o.back ?? 0x5a7438, 0xd8c79a, 0x34461f);
  const darkM = mat(0x44592c, { roughness: 0.85 });
  const bellyM = mat(0xcfbf92, { roughness: 0.85 });
  const toothM = mat(0xf6f1e2, { roughness: 0.4 });
  const mouthM = mat(0x7a2a2a, { roughness: 0.6 });
  const clawM = mat(0x2a2620, { roughness: 0.5 });

  const root = new THREE.Group();
  const body = pivot(root); // pelvis frame
  mesh(new THREE.SphereGeometry(1, 40, 28), skinM, body, [0, 0.15, 0.45], [Math.PI / 2 + 0.06, 0, 0], [1.0, 2.45, 1.2]);
  // neck
  const neck = pivot(body, [0, 0.55, 2.35]);
  mesh(new THREE.SphereGeometry(1, 28, 20), skinM, neck, [0, 0.25, 0.35], [Math.PI / 2 - 0.5, 0, 0], [0.62, 0.9, 0.7]);
  const head = pivot(neck, [0, 0.75, 0.75]); head.scale.setScalar(1.3);
  // skull + snout
  mesh(new THREE.SphereGeometry(1, 32, 24), skinM, head, [0, 0.18, 0.55], [Math.PI / 2, 0, 0], [0.55, 0.95, 0.5]);
  mesh(new THREE.BoxGeometry(0.7, 0.42, 1.1), skinM, head, [0, 0.12, 1.15]);
  mesh(new THREE.SphereGeometry(0.36, 20, 14), skinM, head, [0, 0.13, 1.65], null, [1, 0.6, 0.7]);
  // brow ridges + eyes
  const eyes = [];
  for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.2, 0.09, 0.32), darkM, head, [s * 0.36, 0.5, 0.55], [0.15, 0, s * -0.35]);
    const e = pivot(head, [s * 0.43, 0.38, 0.6]);
    mesh(new THREE.SphereGeometry(0.1, 18, 14), mat(0xf2c23a, { roughness: 0.25 }), e);
    const pup = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), mat(0x111111), e, [s * 0.085, 0, 0.02]);
    pup.visible = !o.dead;
    if (o.dead) {
      for (const a of [0.8, -0.8]) mesh(new THREE.BoxGeometry(0.03, 0.17, 0.03), mat(0x111111), e, [s * 0.09, 0, 0], [0, 0, a]);
    }
    // nostril
    mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0x1a1a14), head, [s * 0.16, 0.34, 1.78]);
    eyes.push(e);
  }
  // upper teeth
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) {
    const z = 0.55 + i * 0.15, len = 0.16 + (i < 6 ? 0.06 : 0) - (i > 6 ? 0.05 : 0);
    mesh(new THREE.ConeGeometry(0.035, len, 8), toothM, head, [s * (0.33 - i * 0.008), -0.1 - len / 2, z], [Math.PI, 0, 0]);
  }
  // jaw
  const jaw = pivot(head, [0, -0.08, 0.35]);
  mesh(new THREE.BoxGeometry(0.6, 0.22, 1.45), skinM, jaw, [0, -0.13, 0.78]);
  mesh(new THREE.BoxGeometry(0.48, 0.05, 1.3), mouthM, jaw, [0, -0.01, 0.78]);
  mesh(new THREE.SphereGeometry(0.3, 16, 12), bellyM, jaw, [0, -0.18, 0.25], null, [1, 0.6, 1.2]);
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) mesh(new THREE.ConeGeometry(0.03, 0.13, 8), toothM, jaw, [s * 0.25, 0.06, 0.3 + i * 0.15]);
  const tongue = mesh(new THREE.BoxGeometry(0.28, 0.05, 0.7), mat(0xc0545a, { roughness: 0.5 }), jaw, [0, 0.02, 0.6]);
  // tail chain
  const tail = []; let par = body, rad = 0.85;
  const tp = pivot(body, [0, 0.3, -1.4]); par = tp;
  for (let i = 0; i < 10; i++) {
    const seg = pivot(par, i === 0 ? [0, 0, 0] : [0, 0, -0.62]);
    const r1 = rad, r2 = rad * 0.78;
    mesh(new THREE.CylinderGeometry(r2, r1, 0.68, 18), skinM, seg, [0, 0, -0.31], [Math.PI / 2, 0, 0]);
    mesh(new THREE.SphereGeometry(r1 * 1.0, 16, 12), skinM, seg);
    tail.push(seg); par = seg; rad = r2;
  }
  // arms (tiny)
  const arms = [];
  for (const s of [-1, 1]) {
    const a = pivot(body, [s * 0.62, -0.1, 1.85]);
    mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.42, 10), skinM, a, [0, -0.2, 0]);
    const f = pivot(a, [0, -0.4, 0]);
    mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.36, 10), skinM, f, [0, -0.17, 0]);
    for (const c of [-1, 1]) mesh(new THREE.ConeGeometry(0.025, 0.12, 6), clawM, f, [c * 0.025, -0.38, 0.03], [Math.PI, 0, 0]);
    f.rotation.x = -1.1; a.rotation.x = 0.5;
    arms.push(a);
  }
  // legs
  const T = 1.55, S = 1.65; // thigh, shin+metatarsus
  const legs = [];
  for (const s of [-1, 1]) {
    const hp = pivot(body, [s * 0.72, -0.15, 0.35]);
    mesh(new THREE.SphereGeometry(1, 24, 18), skinM, hp, [0, -0.6, 0.1], null, [0.55, 1.0, 0.75]);
    const kn = pivot(hp, [0, -T, 0]);
    mesh(new THREE.SphereGeometry(0.3, 14, 10), skinM, kn); mesh(new THREE.CylinderGeometry(0.3, 0.17, S, 14), skinM, kn, [0, -S / 2, 0]);
    const an = pivot(kn, [0, -S, 0]);
    const foot = pivot(an);
    for (const t of [-1, 0, 1]) {
      mesh(new THREE.BoxGeometry(0.17, 0.14, 0.7), skinM, foot, [t * 0.19, -0.09, 0.32], [0, t * 0.25, 0]);
      mesh(new THREE.ConeGeometry(0.06, 0.18, 8), clawM, foot, [t * 0.25, -0.12, 0.66], [Math.PI / 2, 0, 0]);
    }
    legs.push({ hp, kn, an, foot, s });
  }
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const HIP = T + S + 0.22;

  return {
    root, body, neck, head, jaw, tail, legs, eyes, tongue, HIP,
    // p: x,z,ry, dist (locomotion distance), stride, stance, lift, bob, neckX, neckY, headX, headY, jaw, tailAmp, t, lean, crouch
    setPose(p) {
      const g = (k, d = 0) => p[k] ?? d;
      const stride = g('stride', 2.2), stance = g('stance', 0.62), lift = g('lift', 0.45);
      const dist = g('dist');
      root.position.set(g('x'), 0, g('z'));
      root.rotation.set(0, g('ry'), g('rz'));
      let bob = 0; const crouch = g('crouch', 0.4);
      const feet = legs.map((L, i) => gait(dist, stride, stance, lift, i * 0.5));
      if (g('moving', 0)) bob = Math.min(...feet.map(f => f.st ? Math.abs(f.z) : 0.6)) * 0.12;
      const hipY = HIP - crouch - bob + g('dy');
      root.position.y = hipY;
      body.rotation.set(g('lean'), g('bodyY'), g('roll'));
      legs.forEach((L, i) => {
        const f = feet[i];
        const r = ik2(T, S, f.z + 0.1, -(hipY - 0.15 - 0.16 - f.y));
        L.hp.rotation.x = r.hip - g('lean'); L.kn.rotation.x = r.knee;
        L.an.rotation.x = -(r.hip + r.knee) + 0; // keep foot flat
      });
      const t = g('t');
      neck.rotation.set(g('neckX'), g('neckY'), 0);
      head.rotation.set(g('headX'), g('headY'), g('headZ'));
      jaw.rotation.x = g('jaw') * 0.75;
      const amp = g('tailAmp', 0.06), sp = g('tailSpeed', 1.6);
      tail.forEach((s, i) => { s.rotation.y = Math.sin(t * sp - i * 0.5) * amp * (0.5 + i * 0.12) + g('tailY') * 0.08; s.rotation.x = 0.03 + Math.sin(t * sp * 0.7 - i * 0.4) * amp * 0.25 + g('tailX') * 0.05; });
      arms.forEach((a, i) => { a.rotation.x = 0.5 + Math.sin(t * 3 + i) * 0.15 * g('armWiggle', 0.3); });
    },
  };
}

export function createTriceratops() {
  const sk = creatureMat(0x8a7450, 0xd5c49c, 0x5e4c30);
  const frillM = mat(0xc06a2c, { roughness: 0.7 });
  const hornM = mat(0xeee4c8, { roughness: 0.5 });
  const root = new THREE.Group();
  const body = pivot(root, [0, 1.6, 0]);
  mesh(new THREE.SphereGeometry(1, 32, 24), sk, body, [0, 0, 0], [Math.PI / 2, 0, 0], [1.15, 2.1, 1.05]);
  mesh(new THREE.ConeGeometry(0.55, 2.2, 14), sk, body, [0, 0.1, -2.6], [-Math.PI / 2 - 0.15, 0, 0]);
  const head = pivot(body, [0, 0.0, 2.0]);
  mesh(new THREE.SphereGeometry(0.7, 24, 18), sk, head, [0, -0.1, 0.5], null, [0.85, 0.85, 1.25]);
  const frill = mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 30), frillM, head, [0, 0.6, 0.05], [-0.55, 0, 0]);
  for (let i = 0; i < 12; i++) { const a = (i / 11) * Math.PI - Math.PI; mesh(new THREE.ConeGeometry(0.1, 0.25, 6), hornM, head, [Math.cos(a) * 1.25, 0.6 + Math.sin(-a) * 1.1 * 0.84, 0.05 - Math.sin(-a) * 0.6], [-0.55, 0, a + Math.PI / 2]); }
  for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.12, 1.2, 10), hornM, head, [s * 0.35, 0.45, 0.85], [1.0, 0, s * -0.25]);
  mesh(new THREE.ConeGeometry(0.1, 0.4, 10), hornM, head, [0, 0.05, 1.3], [0.7, 0, 0]);
  mesh(new THREE.ConeGeometry(0.2, 0.45, 10), mat(0x3a3328), head, [0, -0.35, 1.3], [Math.PI / 2 + 0.6, 0, 0]);
  const eyes = [];
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.1, 12, 10), mat(0xfafafa, { roughness: 0.3 }), head, [s * 0.45, 0.12, 0.75]); mesh(new THREE.SphereGeometry(0.055, 10, 8), mat(0x111111), e, [s * 0.05, 0, 0.05]); eyes.push(e); }
  const legs = [];
  for (const [x, z] of [[-0.75, 1.2], [0.75, 1.2], [-0.8, -1.1], [0.8, -1.1]]) {
    const l = pivot(body, [x, -0.4, z]);
    mesh(new THREE.CylinderGeometry(0.3, 0.25, 1.4, 12), sk, l, [0, -0.6, 0]);
    legs.push(l);
  }
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { root, head, body, legs, eyes, setPose(p) { const g = (k, d = 0) => p[k] ?? d; root.position.set(g('x'), 0, g('z')); root.rotation.y = g('ry'); head.rotation.set(g('headX'), g('headY'), 0); body.position.y = 1.6 + g('dy'); legs.forEach((l, i) => l.rotation.x = Math.sin(g('dist') * 1.6 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.35 * g('moving')); eyes.forEach(e => e.scale.setScalar(1 + g('scared') * 0.6)); } };
}

export function createPterosaur(seed) {
  const r = rng(seed); const m = mat(0x6d5a44, { roughness: 0.8 }), w = mat(0x8a6e52, { roughness: 0.8, side: THREE.DoubleSide });
  const root = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.9, 8), m, root, [0, 0, 0], [Math.PI / 2, 0, 0]);
  mesh(new THREE.ConeGeometry(0.08, 0.9, 8), m, root, [0, 0.05, 0.85], [Math.PI / 2, 0, 0]);
  mesh(new THREE.ConeGeometry(0.06, 0.4, 6), m, root, [0, 0.2, 0.45], [-0.6, 0, 0]);
  const wings = [];
  for (const s of [-1, 1]) {
    const p = pivot(root); const sh = new THREE.Shape(); sh.moveTo(0, 0.25); sh.lineTo(s * 2.2, -0.05); sh.lineTo(0, -0.35); sh.lineTo(0, 0.25);
    mesh(new THREE.ShapeGeometry(sh), w, p, [0, 0, 0], [-Math.PI / 2, 0, 0]); wings.push({ p, s });
  }
  const ph = r() * 6;
  return { root, update(t) { wings.forEach(({ p, s }) => p.rotation.z = s * Math.sin(t * 4 + ph) * 0.5); } };
}
