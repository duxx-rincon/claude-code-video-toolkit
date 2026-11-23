// Martin (and the fossil hunter variant): jointed 3D character built from primitives.
import * as THREE from 'three';
import { mat, mesh, pivot, canvasTex, rng, lerp, clamp, ik2 } from './util.js';

const L1 = 0.46, L2 = 0.46, ANKLE_H = 0.055;
export const HIP_H = L1 + L2 + ANKLE_H + 0.02;   // pelvis height when standing straight

function flowerTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#1f3fa8'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h, s = 18 + r() * 22, a = r() * 6;
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#f4f4ef';
      for (let p = 0; p < 5; p++) { g.rotate(Math.PI * 2 / 5); g.beginPath(); g.ellipse(s * 0.55, 0, s * 0.55, s * 0.32, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e8c23a'; g.beginPath(); g.arc(0, 0, s * 0.18, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }, { repeat: [1, 1] });
}

function stubbleTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); const r = rng(3);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h;
      g.fillStyle = `rgba(60,40,28,${0.35 + r() * 0.4})`; g.fillRect(x, y, 1.6, 1.6);
    }
  });
}

export function createCharacter(opts = {}) {
  const o = {
    skin: 0xe2ad7c, hair: 0x5b3a22, shirt: 0xd62a22, tee: 0xf2f0ea, shortsTex: true, shorts: 0x1f3fa8,
    glasses: true, pimples: true, stubble: true, hairyLimbs: true, hat: false, openShirt: true, bald: true,
    sandals: 0x151515, ...opts,
  };
  const skin = mat(o.skin, { roughness: 0.6 });
  const hairM = mat(o.hair, { roughness: 0.95 });
  const black = mat(0x111111, { roughness: 0.4 });
  const shirtM = mat(o.shirt, { roughness: 0.8, side: THREE.DoubleSide });
  const teeM = mat(o.tee, { roughness: 0.85 });
  const shortsM = o.shortsTex ? mat(0xffffff, { map: flowerTex(), roughness: 0.85 }) : mat(o.shorts, { roughness: 0.85 });
  const J = {};

  const root = new THREE.Group();
  const pelvis = pivot(root); J.pelvis = pelvis;
  // shorts (hip block)
  mesh(new THREE.CylinderGeometry(0.15, 0.155, 0.17, 20), shortsM, pelvis, [0, 0.02, 0], null, [1, 1, 0.72]);
  if (o.shortsTex) { // drawstring
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), teeM, pelvis, [-0.02, 0.04, 0.115], [0.2, 0, 0.1]);
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), teeM, pelvis, [0.02, 0.035, 0.115], [0.2, 0, -0.15]);
  }

  // spine / torso
  const spine = pivot(pelvis, [0, 0.07, 0]); J.spine = spine;
  mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.5, 22), teeM, spine, [0, 0.24, 0], null, [1, 1, 0.66]);
  if (o.openShirt) {
    mesh(new THREE.CylinderGeometry(0.163, 0.143, 0.48, 26, 1, true, 0.42, Math.PI * 2 - 0.84), shirtM, spine, [0, 0.25, 0], null, [1, 1, 0.7]);
    // buttons on his right panel edge
    for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.007, 8, 6), black, spine, [-0.06, 0.42 - i * 0.1, 0.098]);
  } else {
    mesh(new THREE.CylinderGeometry(0.162, 0.142, 0.48, 26), shirtM, spine, [0, 0.25, 0], null, [1, 1, 0.7]);
    for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.007, 8, 6), black, spine, [0, 0.42 - i * 0.1, 0.104]);
  }
  // collar flaps
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.07, 0.012, 0.06), shirtM, spine, [s * 0.065, 0.49, 0.06], [0.5, 0, s * 0.5]);
  // shoulders (rounded)
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.06, 14, 10), shirtM, spine, [s * 0.15, 0.47, 0]);

  // neck + head
  const neck = pivot(spine, [0, 0.5, 0]); J.neck = neck;
  mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.08, 12), skin, neck, [0, 0.02, 0]);
  const head = pivot(neck, [0, 0.035, 0]); J.head = head;
  const HR = 0.165;
  const skull = mesh(new THREE.SphereGeometry(HR, 40, 30), skin, head, [0, HR, 0], null, [1, 1.08, 1]);
  const H = pivot(head, [0, HR, 0]); // head-centre frame
  H.scale.set(1, 1.08, 1);
  // ears
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.03, 12, 10), skin, H, [s * 0.162, 0.0, 0], null, [0.6, 1, 0.8]);
  // nose
  mesh(new THREE.SphereGeometry(0.03, 16, 12), skin, H, [0, -0.03, 0.165], null, [0.85, 1, 1.25]);
  // hair: lower back + sides, spikes, loose top strands
  if (o.bald) {
    // messy horseshoe of hair: a base band plus overlapping clumps and spikes
    mesh(new THREE.SphereGeometry(HR * 1.01, 32, 16, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 1.3, 0.75), hairM, H);
    const r = rng(11);
    const onHead = (phi, th, k = 1) => new THREE.Vector3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th)).multiplyScalar(HR * k);
    for (let i = 0; i < 70; i++) {
      const phi = Math.PI / 2 + 1.0 + r() * (Math.PI * 2 - 2.0), th = 1.18 + r() * 0.85;
      const v = onHead(phi, th, 1.0);
      const c = mesh(new THREE.SphereGeometry(0.026 + r() * 0.018, 10, 8), hairM, H, v.toArray());
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.clone().normalize()); c.scale.set(1, 1, 0.55);
    }
    for (let i = 0; i < 16; i++) {
      const phi = Math.PI / 2 + 1.1 + (i / 15) * (Math.PI * 2 - 2.2) + (r() - 0.5) * 0.15, th = 1.15 + r() * 0.12;
      const v = onHead(phi, th, 1.0);
      const out = v.clone().normalize().add(new THREE.Vector3(0, 0.55 + r() * 0.4, 0)).normalize();
      const sp = mesh(new THREE.ConeGeometry(0.02 + r() * 0.008, 0.06 + r() * 0.05, 7), hairM, H, v.clone().add(out.clone().multiplyScalar(0.025)).toArray());
      sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
    }
    for (let i = 0; i < 3; i++) {
      const x0 = -0.03 + i * 0.03;
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, HR * 0.98, 0.02), new THREE.Vector3(x0 + 0.02, HR * 1.18, 0.0), new THREE.Vector3(x0 + 0.05, HR * 1.2, -0.03), new THREE.Vector3(x0 + 0.06, HR * 1.1, -0.04)]);
      mesh(new THREE.TubeGeometry(c, 16, 0.0035, 6), hairM, H);
    }
  } else {
    mesh(new THREE.SphereGeometry(HR * 1.04, 32, 20, 0, Math.PI * 2, 0, 1.9), hairM, H, [0, 0, -0.01]);
  }
  if (o.hat) {
    const hat = mat(0x9a7b4f, { roughness: 0.9 });
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 32), hat, H, [0, 0.12, 0]);
    mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 24), hat, H, [0, 0.18, 0]);
    mesh(new THREE.CylinderGeometry(0.171, 0.171, 0.025, 24), mat(0x4a3520), H, [0, 0.135, 0]);
  }
  // stubble shell
  if (o.stubble) {
    const st = new THREE.MeshStandardMaterial({ map: stubbleTex(), transparent: true, alphaTest: 0.05, roughness: 1, depthWrite: false });
    const sh = mesh(new THREE.SphereGeometry(HR * 1.004, 32, 16, Math.PI / 2 - 1.05, 2.1, 1.92, 0.8), st, H);
    sh.castShadow = false;
  }
  // pimples on his left cheek (+x)
  if (o.pimples) {
    const pm = mat(0xc8322a, { roughness: 0.5 });
    for (const d of [[0.62, -0.32, 0.72], [0.7, -0.22, 0.66], [0.58, -0.42, 0.7]]) {
      const v = new THREE.Vector3(...d).normalize().multiplyScalar(HR * 0.995);
      mesh(new THREE.SphereGeometry(0.0085, 10, 8), pm, H, v.toArray());
    }
  }
  // eyes
  const eyeW = mat(0xfafafa, { roughness: 0.3 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = pivot(H, [s * 0.058, 0.03, 0.142]);
    mesh(new THREE.SphereGeometry(0.033, 20, 16), eyeW, e);
    const pupilP = pivot(e);
    mesh(new THREE.SphereGeometry(0.014, 12, 10), black, pupilP, [0, 0, 0.026], null, [1, 1, 0.5]);
    const lidP = pivot(e);
    mesh(new THREE.SphereGeometry(0.0355, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin, lidP);
    const lowP = pivot(e);
    mesh(new THREE.SphereGeometry(0.035, 20, 10, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), skin, lowP);
    eyes.push({ e, pupilP, lidP, lowP, s });
  }
  // brows
  const brows = [];
  for (const s of [-1, 1]) {
    const b = pivot(H, [s * 0.06, 0.098, 0.15]);
    mesh(new THREE.BoxGeometry(0.075, 0.017, 0.022), mat(0x2b1a10, { roughness: 1 }), b, [0, 0, 0], [0.15, 0, 0]);
    brows.push({ b, s });
  }
  // glasses
  if (o.glasses) {
    const fr = new THREE.Shape(); const rr = (sh, w, h, r) => { sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); };
    rr(fr, 0.1, 0.075, 0.012); const hole = new THREE.Path(); rr(hole, 0.074, 0.05, 0.008); fr.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(fr, { depth: 0.014, bevelEnabled: false });
    const lensM = new THREE.MeshStandardMaterial({ color: 0xddeeff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false });
    for (const s of [-1, 1]) {
      mesh(fg, black, H, [s * 0.06, 0.028, 0.168]);
      const l = mesh(new THREE.PlaneGeometry(0.075, 0.05), lensM, H, [s * 0.06, 0.028, 0.176]); l.castShadow = false;
      mesh(new THREE.BoxGeometry(0.012, 0.012, 0.17), black, H, [s * 0.112, 0.035, 0.09], [0, s * -0.12, 0]);
    }
    mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), black, H, [0, 0.04, 0.178]);
  }
  // mouth: three shapes for neutral / smile / frown, plus an open mouth
  const mouthM = mat(0x5a2418, { roughness: 0.6 });
  const mkArc = (bend) => { const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.035, 0, 0), new THREE.Vector3(0, bend, 0.004), new THREE.Vector3(0.035, 0, 0)); return mesh(new THREE.TubeGeometry(c, 12, 0.0045, 6), mouthM, H, [0.006, -0.085, 0.146]); };
  const mouths = { neutral: mkArc(-0.004), smile: mkArc(-0.022), frown: mkArc(0.018) };
  const openP = pivot(H, [0.004, -0.088, 0.134]);
  const openM = mesh(new THREE.SphereGeometry(0.03, 18, 12), mat(0x3a0f0a, { roughness: 0.7 }), openP, null, null, [1.1, 1, 0.38]);
  const teethTop = mesh(new THREE.BoxGeometry(0.04, 0.01, 0.01), mat(0xfafafa), openP, [0, 0.02, 0.01]);
  // sweat drop
  const sweat = mesh(new THREE.SphereGeometry(0.018, 12, 10), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.05, transparent: true, opacity: 0.9 }), H, [-0.15, 0.08, 0.08], null, [0.8, 1.2, 0.8]);
  const sweatTip = mesh(new THREE.ConeGeometry(0.0145, 0.025, 10), sweat.material, sweat, [0, 0.022, 0]);

  // arms
  const hairLineM = mat(0x3b2416, { roughness: 1 });
  const addHair = (parent, len, rad, n, seed) => {
    if (!o.hairyLimbs) return;
    const g = new THREE.BoxGeometry(0.0022, 0.016, 0.0022);
    const im = new THREE.InstancedMesh(g, hairLineM, n); const r = rng(seed); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, y = -len * (0.15 + r() * 0.75);
      q.setFromEuler(new THREE.Euler(0.4 * (r() - 0.5), a, 0.9 + r() * 0.5));
      m4.compose(new THREE.Vector3(Math.sin(a) * rad, y, Math.cos(a) * rad), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4);
    }
    parent.add(im);
  };
  const mkArm = (s) => {
    const sh = pivot(spine, [s * 0.18, 0.47, 0]);
    mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.32, 12), skin, sh, [0, -0.16, 0]);
    mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.15, 14, 1, true), shirtM, sh, [0, -0.06, 0]);
    addHair(sh, 0.3, 0.033, 10, 20 + s);
    const el = pivot(sh, [0, -0.32, 0]);
    mesh(new THREE.SphereGeometry(0.032, 12, 10), skin, el);
    mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.29, 12), skin, el, [0, -0.145, 0]);
    addHair(el, 0.29, 0.029, 26, 30 + s);
    const wr = pivot(el, [0, -0.29, 0]);
    const hand = pivot(wr); hand.rotation.y = s * -0.0;
    mesh(new THREE.BoxGeometry(0.028, 0.075, 0.062), skin, hand, [0, -0.04, 0]);
    const fingers = [];
    for (let i = 0; i < 4; i++) {
      const f1 = pivot(hand, [0, -0.078, 0.024 - i * 0.016]);
      mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.03, 8), skin, f1, [0, -0.015, 0]);
      const f2 = pivot(f1, [0, -0.03, 0]);
      mesh(new THREE.CylinderGeometry(0.0072, 0.0068, 0.026, 8), skin, f2, [0, -0.013, 0]);
      mesh(new THREE.SphereGeometry(0.007, 8, 6), skin, f2, [0, -0.026, 0]);
      fingers.push([f1, f2]);
    }
    const th = pivot(hand, [-s * 0.016, -0.03, 0.03]);
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 8), skin, th, [0, -0.017, 0]);
    // hold point (centre of the closed fist), props attach here
    const hold = pivot(hand, [-s * 0.005, -0.085, 0.0]);
    return { sh, el, wr, hand, fingers, th, hold, s };
  };
  const arms = { l: mkArm(1), r: mkArm(-1) };

  // legs
  const mkLeg = (s) => {
    const hp = pivot(pelvis, [s * 0.085, -0.02, 0]);
    mesh(new THREE.CylinderGeometry(0.04, 0.035, L1, 12), skin, hp, [0, -L1 / 2, 0]);
    mesh(new THREE.CylinderGeometry(0.078, 0.084, 0.24, 16), shortsM, hp, [0, -0.1, 0]);
    addHair(hp, L1, 0.038, 12, 40 + s);
    const kn = pivot(hp, [0, -L1, 0]);
    mesh(new THREE.SphereGeometry(0.038, 12, 10), skin, kn);
    mesh(new THREE.CylinderGeometry(0.036, 0.03, L2, 12), skin, kn, [0, -L2 / 2, 0]);
    addHair(kn, L2, 0.034, 34, 50 + s);
    const an = pivot(kn, [0, -L2, 0]);
    const foot = pivot(an);
    mesh(new THREE.BoxGeometry(0.075, 0.04, 0.2), skin, foot, [0, -0.025, 0.06]);
    const sandal = pivot(foot);
    mesh(new THREE.BoxGeometry(0.095, 0.018, 0.25), mat(o.sandals, { roughness: 0.5 }), sandal, [0, -0.052, 0.055]);
    mesh(new THREE.BoxGeometry(0.1, 0.03, 0.07), mat(o.sandals, { roughness: 0.5 }), sandal, [0, -0.01, 0.07]);
    return { hp, kn, an, foot, sandal, s };
  };
  const legs = { l: mkLeg(1), r: mkLeg(-1) };

  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  const api = {
    root, J, arms, legs, head, H, eyes,
    L1, L2,
    setPose(p = {}) {
      const g = (k, d = 0) => (p[k] ?? d);
      root.position.set(g('x'), g('y', HIP_H), g('z'));
      root.rotation.set(0, g('ry'), 0);
      pelvis.rotation.set(g('px'), g('py'), g('pz'));
      spine.rotation.set(g('sx'), g('sy'), g('sz'));
      neck.rotation.set(g('nx') * 0.4, g('ny') * 0.4, g('nz') * 0.4);
      head.rotation.set(g('nx') * 0.6, g('ny') * 0.6, g('nz') * 0.6);
      for (const k of ['l', 'r']) {
        const a = arms[k], s = a.s;
        a.sh.rotation.set(g(k + 'sx'), g(k + 'sy'), s * (g(k + 'sz') + 0.08));
        a.el.rotation.set(-g(k + 'e', 0.15), 0, 0);
        a.wr.rotation.set(g(k + 'wx'), g(k + 'wy') * s, g(k + 'wz') * s);
        const grip = g(k + 'g', 0.25);
        a.fingers.forEach(([f1, f2]) => { f1.rotation.set(0, 0, -s * grip * 1.45); f2.rotation.set(0, 0, -s * grip * 1.55); });
        a.th.rotation.set(-0.5 - grip * 0.4, 0, -s * (0.2 + grip * 0.5));
        const L = legs[k];
        L.hp.rotation.set(g(k + 'hx'), g(k + 'hy'), s * g(k + 'hz'));
        L.kn.rotation.set(g(k + 'k'), 0, 0);
        L.an.rotation.set(g(k + 'a'), 0, 0);
      }
    },
    // put feet at targets given in pelvis-local sagittal coords (z fwd, y up relative to hip pivot)
    legIK(k, z, y) { const r = ik2(L1, L2, z, y); return { hx: r.hip, k: r.knee }; },
    setFace(f = {}) {
      const lid = f.lid ?? 0.45, look = f.look ?? [0, 0];
      for (const e of eyes) {
        e.lidP.rotation.x = lerp(-0.75, 1.5, clamp(lid));
        e.lowP.rotation.x = -0.15 * (f.squint ?? 0);
        e.pupilP.rotation.set(-look[1] * 0.45, look[0] * 0.5, 0);
        e.pupilP.scale.setScalar(f.pupil ?? 1);
      }
      const br = f.brow ?? 0, worry = f.worry ?? 0;
      for (const b of brows) { b.b.position.y = 0.098 + br * 0.018; b.b.rotation.z = b.s * (-worry * 0.35 + (f.angry ?? 0) * 0.35); }
      const open = f.open ?? 0, sm = f.smile ?? 0;
      openP.visible = open > 0.04; openP.scale.set(1 - open * 0.15, Math.max(0.05, open), 1);
      teethTop.visible = open > 0.3;
      mouths.neutral.visible = !openP.visible && Math.abs(sm) < 0.35;
      mouths.smile.visible = !openP.visible && sm >= 0.35;
      mouths.frown.visible = !openP.visible && sm <= -0.35;
      const sw = f.sweat ?? 0; sweat.visible = sw > 0.01;
      sweat.position.y = 0.09 - sw * 0.06; sweat.scale.setScalar(0.4 + 0.6 * Math.min(1, sw * 3));
    },
  };
  api.setPose({}); api.setFace({});
  return api;
}
