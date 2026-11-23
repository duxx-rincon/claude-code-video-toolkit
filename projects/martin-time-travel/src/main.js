import * as THREE from 'three';
import { clamp, lerp, smooth, easeInOut, easeOut, easeIn, backOut, prog, rng, noise1, mesh, mat, track } from './util.js';
import { createCharacter, HIP_H } from './martin.js';
import { createRex, createTriceratops, createPterosaur, gait } from './dinos.js';
import { buildRoom, buildGlobe, buildSwamp, buildDig } from './sets.js';

const W = 1080, H = 1920, FPS = 30;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const ctx = out.getContext('2d');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 400);

let TL, room, globe, swamp, dig, martin, hunter, rex, deadRex, trike, trikes2 = [], pteros = [], swampPortal, tooth, banana, flySandal, brush, fossilSandal;

/* ---------------------------------------------------------------- helpers */
function setCam(pos, look, fov = 40, roll = 0) {
  camera.position.set(...pos); camera.up.set(0, 1, 0); camera.lookAt(...look);
  if (roll) camera.rotateZ(roll);
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
}
const L3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
function shake(amount, t, seed = 0) { if (amount <= 0) return; camera.position.x += noise1(t * 22, seed) * amount; camera.position.y += noise1(t * 25, seed + 3) * amount; camera.rotateZ(noise1(t * 18, seed + 7) * amount * 0.08); }
// stomp impulse: 1 right at a footfall, decaying
function stompShake(t, times, amt = 0.08) { let s = 0; for (const ft of times) { const d = t - ft; if (d >= 0 && d < 0.5) s += amt * Math.exp(-d * 9); } return s; }

function lineAt(t) { return TL.lines.find(l => t >= l.t0 - 0.05 && t <= l.t1 + 0.05); }
let NOW = 0;
function talking(_t, ids) { // Martin's mouth flap from word times (real clock)
  const t = NOW;
  for (const l of TL.lines) { if (!ids.includes(l.id)) continue; for (const w of l.words) if (t >= w.t0 && t <= w.t1) { const k = (t - w.t0) / (w.t1 - w.t0); return 0.25 + 0.5 * Math.sin(k * Math.PI); } }
  return 0;
}
const MARTIN_LINES = [2, 9, 13, 14, 16];

/* Martin locomotion: returns pose fields for legs/arms/pelvis */
function walkFields(dist, o = {}) {
  const stride = o.stride ?? 0.55, stance = o.stance ?? 0.6, lift = o.lift ?? 0.12, lean = o.lean ?? 0.04;
  const fl = gait(dist, stride, stance, lift, 0), fr = gait(dist, stride, stance, lift, 0.5);
  const cyc = stride / stance; const ph = (dist / cyc) * Math.PI * 2;
  const flight = o.run ? Math.max(0, Math.sin(ph * 2)) * 0.07 : 0;
  const bob = o.run ? 0.06 : Math.abs(Math.sin(ph)) * 0.025;
  const pelY = HIP_H - 0.04 - bob + flight;
  const p = { y: pelY, px: lean, sx: (o.run ? 0.25 : 0.04), sy: Math.sin(ph) * 0.12 };
  for (const [k, f] of [['l', fl], ['r', fr]]) {
    const r = martin.legIK(k, f.z, -((pelY - 0.02) - (0.065 + f.y)) / Math.cos(lean));
    p[k + 'hx'] = r.hx - lean; p[k + 'k'] = r.k; p[k + 'a'] = -(r.hx + r.k) + (f.st ? 0 : -0.2);
  }
  const sw = o.run ? 1.1 : 0.35;
  p.lsx = Math.sin(ph) * sw - (o.run ? 0.3 : 0); p.rsx = -Math.sin(ph) * sw - (o.run ? 0.3 : 0);
  p.le = o.run ? 1.4 : 0.35; p.re = o.run ? 1.4 : 0.35;
  if (o.flail) { p.lsz = 0.6 + Math.sin(ph * 2) * 0.5; p.rsz = 0.6 - Math.sin(ph * 2) * 0.5; p.lsx = -1.6 + Math.sin(ph * 1.5) * 1.0; p.rsx = -1.6 - Math.sin(ph * 1.5) * 1.0; p.le = 0.5; p.re = 0.5; }
  return p;
}
const standBase = (t) => ({ y: HIP_H - 0.005 + Math.sin(t * 2.1) * 0.004, sx: 0.03 + Math.sin(t * 2.1) * 0.015, lsz: 0.1, rsz: 0.1, le: 0.2, re: 0.2, lg: 0.3, rg: 0.3 });
function headToward(char, ry, from, to) { // yaw/pitch for a head to face a world point
  const dx = to[0] - from[0], dz = to[2] - from[2], dy = to[1] - from[1];
  let yaw = Math.atan2(dx, dz) - ry; yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  const pitch = -Math.atan2(dy, Math.hypot(dx, dz));
  return { ny: clamp(yaw, -1.3, 1.3), nx: clamp(pitch, -0.6, 0.6) };
}
function attach(obj, parent, pos = [0, 0, 0], rot = [0, 0, 0]) { parent.add(obj); obj.position.set(...pos); obj.rotation.set(...rot); obj.visible = true; }

/* ---------------------------------------------------------------- overlays */
const HL = {
  0: ['martin'], 1: ['portal', 'random', 'history'], 2: ['good'], 3: ['montana'], 4: ['sixty-eight', 'million', 'years'],
  5: ['swampy', 'dinosaurs'], 6: ['tyrannosaurus', 'rex'], 7: ['thirty', 'years'], 8: ['twelve', 'meters', 'nine', 'tons'],
  9: ['saw'], 10: ['triceratops'], 11: ['hundred', 'times'], 12: ['banana'], 13: ['crazy'], 14: ['shit'], 15: ['ran'], 16: ['glad'],
};
// two grouped boxes; each freezes the picture for a second when it pops in
// the picture stays frozen for as long as a fact box is on screen
const INS0 = 34.4, INS = 4.08;   // inserted beat after the kill: "You saw that?"
const FREEZES = [[21.6, 6.75], [38.48, 8.63]];
const FACTS = [
  { t0: 21.6, t1: 28.35, head: 'TYRANNOSAURUS REX', lines: [['Lived up to 30 years', 22.76], ['12 m long · 9 tons', 25.36]] },
  { t0: 38.48, t1: 47.11, head: 'WHAT IT EATS', lines: [['Favorite food: Triceratops', 39.14], ['Bite: up to 100× yours', 41.81], ['Teeth ≈ 30 cm, a banana', 44.76]] },
];
let grain;
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawCaption(t) {
  const l = TL.lines.find(l => t >= l.t0 - 0.12 && t <= l.t1 + 0.3);
  if (!l) return;
  const a = Math.min(prog(t, l.t0 - 0.12, l.t0 + 0.05), 1 - prog(t, l.t1 + 0.18, l.t1 + 0.3));
  const hl = HL[l.id] || [];
  const words = l.text.split(' ').map(w => ({ w, red: hl.includes(w.toLowerCase().replace(/[^a-z.\-]/g, '').replace(/\.$/, (m) => w.toLowerCase().startsWith('t.') ? '.' : '')) }));
  const size = 66; const maxW = 920;
  const font = (red) => `italic ${red ? 700 : 400} ${size}px "Playfair Display"`;
  // wrap
  const rows = []; let row = [], rw = 0;
  ctx.save();
  for (const wd of words) { ctx.font = font(wd.red); const ww = ctx.measureText(wd.w + ' ').width; if (rw + ww > maxW && row.length) { rows.push({ row, rw }); row = []; rw = 0; } row.push({ ...wd, ww }); rw += ww; }
  rows.push({ row, rw });
  const lh = size * 1.22; const y0 = 1560 - (rows.length - 1) * lh;
  ctx.globalAlpha = a; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  rows.forEach(({ row, rw }, i) => {
    let x = (W - rw) / 2; const y = y0 + i * lh;
    for (const wd of row) {
      ctx.font = font(wd.red);
      ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(0,0,0,0.78)'; ctx.strokeText(wd.w, x, y);
      ctx.fillStyle = wd.red ? '#ff3b2f' : '#ffffff'; ctx.fillText(wd.w, x, y);
      if (wd.red) { const tw = ctx.measureText(wd.w).width; ctx.fillStyle = '#ff3b2f'; ctx.fillRect(x, y + 10, tw, 4); }
      x += wd.ww;
    }
  });
  ctx.restore();
}
function topLineText(t) {
  if (t < 12.75) return 'TODAY · HIS ROOM';
  if (t < 53.4) return '68,000,000 BC · MONTANA';
  return 'TODAY · HIS ROOM';
}
function drawTopLine(t) {
  const txt = topLineText(t);
  const changes = [12.75, 53.4]; let a = 1;
  for (const c of changes) { if (t > c - 0.25 && t < c) a = 1 - (t - (c - 0.25)) / 0.25; if (t >= c && t < c + 0.3) a = (t - c) / 0.3; }
  ctx.save(); ctx.globalAlpha = a; ctx.font = '700 44px "Playfair Display"'; ctx.textAlign = 'center';
  const sp = txt.split('').join(String.fromCharCode(8202));
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(sp, W / 2, 170);
  ctx.fillStyle = '#fff'; ctx.fillText(sp, W / 2, 170);
  const tw = ctx.measureText(sp).width; ctx.fillStyle = '#ff3b2f'; ctx.fillRect(W / 2 - tw / 2, 190, tw, 4);
  ctx.restore();
}
function drawFact(t) {
  const f = FACTS.find(f => t >= f.t0 && t <= f.t1); if (!f) return;
  const k = backOut(prog(t, f.t0, f.t0 + 0.28)); const outK = 1 - easeIn(prog(t, f.t1 - 0.25, f.t1));
  const s = k * outK; if (s <= 0.001) return;
  const bw = 920, bh = 118 + f.lines.length * 76, bx = (W - bw) / 2, by = 262;
  ctx.save(); ctx.translate(W / 2, by + bh / 2); ctx.scale(s, s); ctx.translate(-W / 2, -(by + bh / 2));
  ctx.globalAlpha = clamp(s * 1.2);
  roundRect(ctx, bx, by, bw, bh, 26); ctx.fillStyle = 'rgba(14,14,18,0.86)'; ctx.fill();
  ctx.fillStyle = '#ff3b2f'; roundRect(ctx, bx, by, 16, bh, 8); ctx.fill();
  const hn = Math.floor(prog(t, f.t0 + 0.12, f.t0 + 0.6) * f.head.length);
  ctx.font = '800 50px Inter'; ctx.fillStyle = '#ff3b2f'; ctx.fillText(f.head.slice(0, hn), bx + 52, by + 78);
  ctx.font = '800 52px Inter'; ctx.fillStyle = '#fff';
  let cur = null;
  f.lines.forEach(([txt, at], i) => {
    const n = Math.floor(prog(t, at - 0.05, at - 0.05 + Math.min(0.9, txt.length * 0.04)) * txt.length);
    if (n <= 0) return;
    const y = by + 78 + 76 * (i + 1);
    ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); ctx.arc(bx + 62, y - 17, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(txt.slice(0, n), bx + 84, y);
    cur = [bx + 84 + ctx.measureText(txt.slice(0, n)).width, y, n < txt.length];
  });
  if (cur && (cur[2] || Math.floor(t * 3) % 2 === 0)) { ctx.fillStyle = '#ff3b2f'; ctx.fillRect(cur[0] + 6, cur[1] - 44, 5, 52); }
  ctx.restore();
}
function drawGlobeTag(t) {
  if (t < 11.85 || t > 14.5) return;
  const p = new THREE.Vector3(); globe.pinInner.children[0].getWorldPosition(p); p.project(camera);
  const x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H;
  const txt = 'MONTANA, USA'; const n = Math.floor(prog(t, 11.95, 12.65) * txt.length);
  const a = Math.min(prog(t, 11.85, 12.0), 1 - prog(t, 14.2, 14.5));
  ctx.save(); ctx.globalAlpha = a; ctx.font = '800 54px Inter';
  const tw = ctx.measureText(txt).width + 120; const tx = clamp(x - tw / 2, 30, W - tw - 30), ty = y - 190;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(clamp(x, tx + 30, tx + tw - 30), ty + 92); ctx.stroke();
  roundRect(ctx, tx, ty, tw, 92, 18); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.fillStyle = '#e62e2e'; ctx.beginPath(); ctx.arc(tx + 48, ty + 38, 15, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(tx + 34, ty + 44); ctx.lineTo(tx + 62, ty + 44); ctx.lineTo(tx + 48, ty + 70); ctx.fill();
  ctx.fillStyle = '#111'; ctx.fillText(txt.slice(0, n), tx + 84, ty + 66);
  ctx.restore();
}
function post(t, flash) {
  // vignette
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // grain
  ctx.save(); ctx.globalAlpha = 0.06; const ox = (t * 977) % 256, oy = (t * 613) % 256; ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.translate(-ox, -oy); ctx.fillRect(ox, oy, W, H); ctx.restore();
  if (flash > 0) { ctx.fillStyle = `rgba(235,248,255,${clamp(flash)})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------------------------------------------------------------- SHOTS */
const ROOM_SIT = { x: -1.28, z: -1.0 };
function roomShots(t) {
  room.update(t, t > 7.5 && t < 9.6 ? 1 + prog(t, 7.5, 9.3) * 1.5 : 1);
  scene.fog = null;
  martin.root.visible = true; martin.legs.r.sandal.visible = true; martin.legs.l.sandal.visible = true;
  room.chipsBag.visible = true; room.chip.visible = false;
  let face = { lid: 0.45, look: [0, 0] };
  let p;
  if (t < 5.0) {
    // sitting on bed edge, eating chips. bag in left hand, right hand to mouth
    const cyc = (t % 1.6) / 1.6; // one chip every 1.6 s
    const toMouth = cyc < 0.35 ? easeInOut(cyc / 0.35) : cyc < 0.6 ? 1 : 1 - easeInOut((cyc - 0.6) / 0.4);
    p = { x: ROOM_SIT.x, z: ROOM_SIT.z, ry: Math.PI / 2, y: 0.56, px: 0, sx: 0.12 + Math.sin(t * 2) * 0.01,
      lhx: -1.45, lk: 1.48, la: 0, rhx: -1.45, rk: 1.42, ra: 0, lhz: 0.05, rhz: 0.05,
      lsx: -0.55, lsz: 0.15, le: 1.35, lwx: 0, lg: 0.75,
      rsx: lerp(-0.55, -1.15, toMouth), rsz: lerp(0.25, -0.38, toMouth), rsy: 0, re: lerp(1.25, 2.45, toMouth), rg: 0.55,
      nx: lerp(0.25, 0.05, toMouth), ny: lerp(0.25, 0, toMouth) };
    const chew = cyc > 0.4 && cyc < 0.95 ? Math.abs(Math.sin(t * 16)) * 0.3 : 0;
    face = { lid: 0.5, look: [0.3 * (1 - toMouth), -0.3 * (1 - toMouth)], open: toMouth > 0.85 && cyc < 0.42 ? 0.5 : chew, smile: 0.4 };
    if (t > 1.6 && t < 4.9) { // glances at the portal while the narrator mentions it
      const g = smooth(prog(t, 2.0, 2.4)) * (1 - smooth(prog(t, 4.2, 4.6)));
      p.ny = lerp(p.ny, 0.5, g); p.nx = lerp(p.nx, -0.05, g); face.look = [0.6 * g, 0]; face.lid = lerp(0.5, 0.3, g);
    }
    attach(room.chipsBag, martin.arms.l.hold, [0.0, -0.02, 0.07], [0.0, -Math.PI / 2, 0.0]);
    if (cyc < 0.62) { attach(room.chip, martin.arms.r.hold, [0.0, -0.01, 0.03], [0, 0, 0.6]); }
    if (t < 1.7) setCam([0.25, 1.3, 0.75], [-1.1, 1.0, -0.95], 40);
    else { const k = easeInOut(prog(t, 1.7, 4.9)); setCam(L3([0.1, 1.5, 2.1], [0.4, 1.45, 1.7], k), L3([-1.2, 0.95, -1.0], [1.9, 1.1, -0.6], k), 50); }
  } else if (t < 8.25) {
    // stands up (snappy), drops bag on bed, walks to portal; nervous close-up
    const up = backOut(prog(t, 5.0, 5.45));
    const startX = ROOM_SIT.x + 0.1, endX = 0.75;
    const walkK = prog(t, 5.55, 7.2); const dist = easeInOut(walkK) * (endX - startX);
    p = { ...standBase(t), x: startX + dist, z: lerp(ROOM_SIT.z, -0.6, easeInOut(walkK)), ry: Math.PI / 2 - 0.12 * Math.sin(walkK * Math.PI) };
    if (t < 5.55) { // rise from sitting
      Object.assign(p, { y: lerp(0.56, HIP_H, up), lhx: lerp(-1.45, 0, up), lk: lerp(1.48, 0, up), rhx: lerp(-1.45, 0, up), rk: lerp(1.42, 0, up), la: 0, ra: 0, px: Math.sin(up * Math.PI) * 0.35, x: lerp(ROOM_SIT.x, startX, up) });
    } else if (walkK < 1) Object.assign(p, walkFields(dist, { stride: 0.5 }));
    room.chipsBag.removeFromParent(); room.group.add(room.chipsBag); room.chipsBag.position.set(-1.55, 0.58, -0.9); room.chipsBag.rotation.set(-1.3, 0.3, 0.2);
    const close = t > 5.95;
    const ry = p.ry; const mp = [p.x, 1.75, p.z];
    if (!close) setCam([0.9, 1.45, 2.2], [-0.2, 1.0, -0.8], 44);
    else { const k = easeOut(prog(t, 5.95, 8.2)); setCam([p.x + 1.35 - k * 0.2, 1.72, p.z + 0.55 - k * 0.1], [p.x, 1.66, p.z], 36); }
    const camLook = headToward(martin, ry, mp, camera.position.toArray());
    const toCam = smooth(prog(t, 7.15, 7.4)) * (1 - smooth(prog(t, 7.9, 8.1)));
    const toPortal = close ? 1 - toCam : 0;
    p.ny = lerp(0.1 * toPortal, camLook.ny, toCam); p.nx = lerp(0.05, camLook.nx, toCam);
    face = { lid: 0.3, worry: 0.9, brow: 0.4, look: [lerp(0.3, 0, toCam), 0], sweat: prog(t, 6.2, 8.0), open: talking(t, MARTIN_LINES) };
    p.lsx = -0.15; p.rsx = -0.15; p.lsz = 0.05; p.rsz = 0.05; p.le = 1.2; p.re = 1.2; p.lg = 0.8; p.rg = 0.8; // hands wringing
    if (walkK > 0 && walkK < 1) Object.assign(p, { le: 1.0, re: 1.0 });
  } else {
    // wide: steps into the portal
    const k = prog(t, 8.25, 9.35); const startX = 0.75; const dist = k * 1.25;
    p = { ...standBase(t), ...walkFields(dist, { stride: 0.55 }), x: startX + dist, z: -0.6, ry: Math.PI / 2 };
    p.lsx = -0.3; p.rsx = 0.2; p.nx = 0.05;
    face = { lid: 0.2, worry: 1, brow: 0.5, sweat: 1 };
    martin.root.visible = p.x < 2.0;
    setCam(L3([-1.6, 1.4, 1.9], [-1.4, 1.3, 1.6], k), [1.3, 1.1, -0.6], 42);
  }
  martin.setPose(p); martin.setFace(face);
}

function returnShot(t) {
  room.update(t, t < 55.2 ? 2.2 - prog(t, 54.4, 55.2) * 1.2 : 1);
  scene.fog = null;
  martin.root.visible = true; martin.legs.r.sandal.visible = false;
  room.chipsBag.visible = true; room.chip.visible = false;
  room.chipsBag.removeFromParent(); room.group.add(room.chipsBag); room.chipsBag.position.set(-1.55, 0.58, -0.9); room.chipsBag.rotation.set(-1.3, 0.3, 0.2);
  // ballistic arc out of the portal, lands sitting on the rug
  const T0 = 54.45, T1 = 54.95; const k = prog(t, T0, T1);
  const p0 = [1.9, 1.05, -0.55], p1 = [0.45, 0.13, 0.05];
  const tt = k * (T1 - T0), dur = T1 - T0, g = 9.8;
  const vy = (p1[1] - p0[1] + 0.5 * g * dur * dur) / dur;
  let y = p0[1] + vy * tt - 0.5 * g * tt * tt;
  let p;
  const breath = Math.sin(t * 7) * (1 - prog(t, 55.5, 58));
  if (t < T1) {
    p = { x: lerp(p0[0], p1[0], k), z: lerp(p0[2], p1[2], k), y: y + 0.2, ry: Math.PI / 2 + Math.PI * 0.85 * k, px: -Math.PI * 2 * k * 0.9,
      lsx: -2.6, rsx: -2.6, lsz: 0.4, rsz: 0.4, le: 0.3, re: 0.3, lhx: -0.8, rhx: -0.4, lk: 1.0, rk: 0.6 };
  } else {
    const land = t - T1; const bounce = Math.abs(Math.sin(land * 14)) * 0.05 * Math.exp(-land * 6);
    p = { x: p1[0], z: p1[2], y: p1[1] + bounce, ry: Math.PI / 2 + Math.PI * 0.85, px: -0.15 + breath * 0.04, sx: -0.1 + breath * 0.05,
      lhx: -1.45, rhx: -1.35, lk: 0.25, rk: 0.45, la: -0.2, ra: -0.1, lhz: 0.25, rhz: 0.15,
      lsx: 0.45, rsx: 0.45, lsz: 0.35, rsz: 0.35, le: 0.1, re: 0.1, lg: 0.1, rg: 0.1, nx: -0.1 + breath * 0.05 };
  }
  const face = { lid: t < 56.6 ? 0.15 : 0.5, worry: 1, brow: 0.3, sweat: 1, open: Math.max(talking(t, MARTIN_LINES), t > T1 && t < 54.65 ? 0.6 : 0, (Math.max(0, breath) * 0.25) * (t > 57.3 ? 1 : 0)), look: [0, 0] };
  if (t > 56.0 && t < 57.6) { const cl = headToward(martin, p.ry, [p.x, 1.0, p.z], camera.position.toArray()); p.ny = cl.ny * 0.8; face.look = [0.2, 0]; }
  martin.setPose(p); martin.setFace(face);
  const ck = easeOut(prog(t, 54.45, 58.2));
  setCam(L3([-0.9, 1.25, 1.9], [-0.55, 0.95, 1.45], ck), L3([0.9, 0.7, -0.35], [0.45, 0.55, 0.05], ck), 40);
}

function globeShot(t) {
  room.group.add(room.chipsBag, room.chip);
  scene.fog = null;
  martin.root.visible = false;
  const k = easeInOut(prog(t, 9.3, 12.0));
  globe.earth.rotation.y = lerp(-2.2, 0, k) + 0.03 * Math.max(0, t - 12.0);
  const mt = globe.mtPos.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), globe.earth.rotation.y).normalize();
  const final = globe.mtPos.clone().normalize();
  const d = t < 13.6 ? lerp(9.0, 3.3, easeInOut(prog(t, 9.3, 13.6))) : lerp(3.3, 2.06, easeIn(prog(t, 13.6, 15.0)));
  const camDir = final.clone().add(new THREE.Vector3(0, 0.25, 0.12)).normalize();
  const cp = camDir.multiplyScalar(d);
  const look = new THREE.Vector3(0, 0, 0).lerp(mt.clone().multiplyScalar(2), easeInOut(prog(t, 10.0, 13.0)));
  setCam(cp.toArray(), look.toArray(), 42);
  globe.mtM.opacity = smooth(prog(t, 11.55, 11.85)) * (0.75 + 0.25 * Math.sin(t * 6));
  const drop = prog(t, 11.75, 12.1);
  globe.pin.visible = t > 11.75;
  globe.pinInner.position.y = (1 - easeIn(drop)) * 0.6 + (drop >= 1 ? Math.abs(Math.sin((t - 12.1) * 14)) * 0.02 * Math.exp(-(t - 12.1) * 8) : 0);
}

const SW = { // swamp layout
  rock: [1.1, 0, 0.6], hide: [1.25, 0, 1.75],
};
const REX_EAT = [3.4, -12.3];           // where it eats the triceratops
const TRI = [8.0, -12.3];               // triceratops grazing spot
const MZ0 = 1.75, RUN0 = 50.9, MSPD = 5.2, RSPD = 6.0, PORTAL_Z = 16.6;
function swampCommon(t) {
  room.group.add(room.chipsBag, room.chip); room.chipsBag.visible = false; room.chip.visible = false;
  scene.fog = swamp.fog; swamp.update(t);
  pteros.forEach((pt, i) => { const a = t * 0.12 + i * 2.1; pt.root.position.set(Math.cos(a) * (40 + i * 8), 24 + i * 4 + Math.sin(t * 0.5 + i) * 2, Math.sin(a) * (40 + i * 8) - 30); pt.root.rotation.y = -a; pt.update(t); });
  trikes2.forEach((tr, i) => tr.setPose({ x: -30 + i * 6, z: -55 - i * 4, ry: 0.4, headX: 0.5 + Math.sin(t + i) * 0.15, dist: 0, moving: 0 }));
  deadRex.root.visible = false; swampPortal.visible = false;
  martin.root.visible = true; martin.legs.r.sandal.visible = true; martin.legs.l.sandal.visible = true; flySandal.visible = false;
  tooth.visible = false; banana.visible = false;
  rex.root.visible = true; trike.root.visible = true;
  rex.root.position.set(0, -50, 0);
}
function crouchPose(t, extra = {}) { // behind the rock, peeking
  return { x: SW.hide[0], z: SW.hide[2], ry: Math.PI, y: 0.62, px: 0.35, sx: 0.15,
    lhx: -1.7, lk: 2.2, la: -0.4, rhx: -1.3, rk: 2.3, ra: -0.6, lhz: 0.25, rhz: 0.15,
    lsx: -1.0, rsx: -1.0, lsz: 0.25, rsz: 0.25, le: 1.0, re: 1.0, lg: 0.6, rg: 0.6, nx: -0.4, ...extra };
}
// triceratops: grazes, gets knocked over at 31.6, lies on its side
function triPose(t) {
  const hit = 31.75, roll = smooth(prog(t, hit, hit + 0.55));
  const bounce = t > hit + 0.55 ? Math.abs(Math.sin((t - hit - 0.55) * 12)) * 0.12 * Math.exp(-(t - hit - 0.55) * 6) : 0;
  const alarm = smooth(prog(t, 30.15, 30.55));
  trike.setPose({ x: TRI[0] + roll * 0.6, z: TRI[1], ry: 0.15, headX: t < 30.15 ? 0.55 + Math.sin(t * 2.2) * 0.08 : lerp(0.55, -0.15, alarm), headY: -0.6 * alarm, scared: t < hit ? alarm : 0, dist: 0, moving: 0 });
  trike.root.rotation.z = -roll * (Math.PI / 2 - 0.1);
  trike.root.position.y = roll * 1.05 + bounce;
  trike.eyes.forEach(e => e.scale.set(1, t > hit + 0.3 ? 0.15 : 1 + 0.6 * alarm * (t < hit ? 1 : 0), 1));
}
// T. rex eating, head down on the triceratops
const EAT = (t) => { const tug = Math.max(0, Math.sin((t - 32.95) * 3.2)); return { x: REX_EAT[0], z: REX_EAT[1], ry: Math.PI / 2, neckX: 0.75, headX: 0.55 - tug * 0.35, headY: Math.sin(t * 2) * 0.1, jaw: 0.35 - tug * 0.25, lean: 0.25 - tug * 0.1, crouch: 0.8, dist: 0, tailAmp: 0.08 }; };
function rexHeadCam(rexP, off, lookOff = [0, 0, 0], fov = 38, local = [0, 0.2, 1.2]) {
  rex.setPose(rexP); rex.root.updateMatrixWorld(true);
  const hp = new THREE.Vector3(...local); rex.head.localToWorld(hp);
  setCam([hp.x + off[0], hp.y + off[1], hp.z + off[2]], [hp.x + lookOff[0], hp.y + lookOff[1], hp.z + lookOff[2]], fov);
  return hp;
}
function swampShots(t) {
  swampCommon(t); triPose(t);
  if (NOW >= INS0 && NOW < INS0 + INS && !FREEZES.some(([f0, d]) => NOW >= f0 && NOW < f0 + d)) {
    // inserted beat: it has started eating; ~2 s later Martin turns to camera: "You saw that?"
    const u = NOW; const rexP = { ...EAT(u), t: u };
    let p, face;
    if (u >= 35.75 && u < 37.3) {
      const turn = backOut(prog(u, 35.85, 36.05));
      p = crouchPose(u, { y: 0.8, px: 0.1, ry: lerp(Math.PI - 0.5, 0.35, turn) });
      const mp = [SW.hide[0], 1.45, SW.hide[2]];
      setCam([mp[0] + 0.5, 1.5, mp[2] + 1.15], [mp[0], 1.42, mp[2]], 36);
      const cl = headToward(martin, p.ry, mp, camera.position.toArray());
      p.ny = lerp(-0.6, cl.ny, turn); p.nx = lerp(-0.1, cl.nx, turn);
      face = { lid: 0.0, brow: 1, worry: 1, open: Math.max(talking(u, MARTIN_LINES), 0.15), pupil: 0.55, sweat: 1 };
    } else {
      p = crouchPose(u, { y: 0.8, px: 0.15, nx: -0.2, ny: 0.35 });
      face = { lid: 0.05, brow: 1, open: 0.45, pupil: 0.6 };
      setCam([14.0, 3.0, -3.5], [7.2, 1.2, -12.3], 42);
    }
    rex.setPose(rexP); rex.eyes.forEach(e => { e.rotation.y = 0; });
    martin.setPose(p); martin.setFace(face);
    return;
  }
  if (t >= 49.3) t += 1.6;   // chase/trip/dive block is authored on a clock that starts the run at 50.9
  let p, face = { lid: 0.45 };
  const rexP = { t, tailAmp: 0.06, crouch: 0.4 };
  const walkIn = (tt) => { const d = (tt - 19.2) * 2.6; return { x: -9 + d, z: -12.3, ry: Math.PI / 2, dist: d, moving: 1, stride: 2.4, neckX: -0.1, headX: Math.sin(tt * 2.6) * 0.05, tailAmp: 0.09, lean: 0.05 }; };
  if (t < 19.2) {
    // arrival: standing, confused, looking around
    const look = Math.sin((t - 15) * 1.3);
    p = { ...standBase(t), x: -0.7, z: 0.4, ry: 0.15, ny: look * 0.8, nx: -0.05, lsz: 0.25, rsz: 0.25, le: 0.5, re: 0.5, lg: 0.2, rg: 0.2 };
    face = { lid: 0.2, brow: 0.5, worry: 0.4, look: [look * 0.6, 0], open: t > 17.3 && t < 17.7 ? 0.25 : 0 };
    const k = easeOut(prog(t, 14.95, 19.2));
    setCam(L3([1.6, 1.7, 5.0], [0.6, 1.6, 3.6], k), L3([-0.7, 1.1, 0.4], [-0.7, 1.25, 0.4], k), 44);
    Object.assign(rexP, { x: -14, z: -300 });
  } else if (t < 28.35) {
    // the T. rex stomps in; Martin stares (box 1 freezes this at 21.35)
    Object.assign(rexP, walkIn(t));
    p = { ...standBase(t), x: -0.7, z: 0.4, ry: Math.PI - 0.35, nx: -0.3 * smooth(prog(t, 19.6, 20.4)), lsz: 0.15, rsz: 0.15 };
    face = { lid: 0.0, brow: 1, open: 0.45 * smooth(prog(t, 20.3, 20.6)), pupil: 0.6 };
    const k = easeInOut(prog(t, 19.2, 21.0));
    setCam(L3([0.6, 1.3, 4.0], [1.2, 1.1, 4.6], k), L3([-0.7, 1.5, 0.4], [-2.5, 3.4, -12], k), 46);
    const steps = []; const cyc = 2.4 / 0.62; for (let i = 0; i < 6; i++) steps.push(19.2 + ((i * 0.5) * cyc) / 2.6);
    shake(stompShake(t, steps, 0.04), t, 2);
  } else if (t < 29.55) {
    // box closes: Martin bolts behind the rock (snappy); it keeps stomping
    Object.assign(rexP, walkIn(21.6 + (t - 28.35)));
    const dive = prog(t, 28.5, 29.0), k = backOut(dive);
    if (dive <= 0) { p = { ...standBase(t), x: -0.7, z: 0.4, ry: Math.PI - 0.35, lsx: -0.4, rsx: -0.4 }; face = { lid: 0, brow: 1, open: 0.8, pupil: 0.5 }; }
    else { p = { ...crouchPose(t), x: lerp(-0.7, SW.hide[0], k), z: lerp(0.4, SW.hide[2], k), y: lerp(HIP_H, 0.62, k) + Math.sin(dive * Math.PI) * 0.4, nx: 0.2, lsx: lerp(-2.8, -1.0, k), rsx: lerp(-2.8, -1.0, k) }; face = { lid: 0.0, brow: 1, worry: 1, open: 0.7, pupil: 0.6 }; }
    setCam([3.4, 1.5, 5.4], [0.2, 1.4, -1.5], 46);
  } else if (t < 31.75) {
    // it spots the triceratops, roars, charges
    const x0 = walkIn(22.8).x;          // where it stopped
    const roar = prog(t, 29.75, 29.95) * (1 - prog(t, 30.45, 30.65));
    const ch = prog(t, 30.6, 31.75), d = easeIn(ch) * (1.25 - x0);
    Object.assign(rexP, { x: x0 + d, z: -12.3, ry: Math.PI / 2, dist: 2.4 + d, moving: ch > 0 ? 1 : 0, stride: 3.0, stance: 0.5, lift: 0.6, neckX: -0.1 + ch * 0.2, headX: -0.15 - roar * 0.4 + ch * 0.15, jaw: Math.max(roar * 1.1, ch * 0.7), lean: 0.05 + ch * 0.2, tailAmp: 0.12, tailSpeed: 2 + ch * 3 });
    p = crouchPose(t, { y: 0.8, px: 0.15, nx: -0.25, ny: 0.35 });
    face = { lid: 0.0, brow: 1, open: 0.3, pupil: 0.6, sweat: 1 };
    if (t < 30.6) rexHeadCam(rexP, [-1.5, -1.3, 6.0], [0, 0, 0], 40);
    else setCam([14.5, 2.4, -3.0], [4.5, 2.0, -12.3], 44);
    shake(roar * 0.06 + stompShake(t, [30.9, 31.25, 31.55], 0.05), t, 1);
  } else if (t < 34.4) {
    // impact: the triceratops goes over; the T. rex settles in to eat (box 2 freezes at 33.7)
    const settle = smooth(prog(t, 32.35, 33.6));
    const hit = prog(t, 31.75, 31.9) * (1 - prog(t, 31.9, 32.35));
    Object.assign(rexP, { x: lerp(1.25, REX_EAT[0], settle), z: -12.3, ry: Math.PI / 2, dist: 4 + settle * 2, moving: settle > 0 && settle < 1 ? 1 : 0, stride: 2.2,
      neckX: lerp(0.1, 0.75, settle), headX: lerp(0.0 - hit * 0.3, 0.55, settle), jaw: lerp(0.4, 0.35, settle), lean: lerp(0.25, 0.25, settle), crouch: lerp(0.4, 0.8, settle), tailAmp: 0.1 });
    p = crouchPose(t, { y: 0.8, px: 0.15, nx: -0.25, ny: 0.35 });
    setCam([14.5, 2.4, -3.0], [5.5, 1.6, -12.3], 44);
    shake(hit * 0.1, t, 2);
  } else if (t < 43.9) {
    // eating (frozen 33.7-42.9 under box 2, then it resumes)
    Object.assign(rexP, EAT(t));
    p = crouchPose(t, { y: 0.8, px: 0.15, nx: -0.2, ny: 0.35 });
    face = { lid: 0.05, brow: 1, open: 0.45, pupil: 0.6 };
    setCam([14.0, 3.0, -3.5], [7.2, 1.2, -12.3], 42);
  } else if (t < 45.6) {
    // "That's crazy." to camera
    Object.assign(rexP, EAT(t));
    const turn = backOut(prog(t, 43.95, 44.15));
    p = crouchPose(t, { y: 0.8, px: 0.1, ry: lerp(Math.PI - 0.5, 0.35, turn) });
    const mp = [SW.hide[0], 1.45, SW.hide[2]];
    setCam([mp[0] + 0.5, 1.5, mp[2] + 1.15], [mp[0], 1.42, mp[2]], 36);
    const cl = headToward(martin, p.ry, mp, camera.position.toArray());
    p.ny = lerp(-0.6, cl.ny, turn); p.nx = lerp(-0.1, cl.nx, turn);
    face = { lid: 0.1, brow: 1, worry: 0.6, open: Math.max(talking(t, MARTIN_LINES), 0.1), pupil: 0.6 };
  } else if (t < 46.5) {
    // "Then it smelled sandals." stops eating, lifts its head, sniffs
    const lift = smooth(prog(t, 45.6, 46.2));
    const e = EAT(t);
    Object.assign(rexP, e, { neckX: lerp(e.neckX, -0.1, lift), headX: lerp(e.headX, -0.1, lift) + Math.sin(t * 14) * 0.03 * lift, jaw: lerp(e.jaw, 0.05, lift), lean: lerp(0.25, 0, lift), crouch: lerp(0.8, 0.45, lift) });
    p = crouchPose(t);
    rexHeadCam(rexP, [-1.2, 0.0, 6.0], [0, 0, 0], 36, [0, 0.3, 1.2]);
  } else if (t < 47.2) {
    // side-eye: head still, eye slides toward Martin
    Object.assign(rexP, EAT(t), { neckX: -0.1, headX: -0.1, jaw: 0.05, lean: 0, crouch: 0.45, headY: 0 });
    p = crouchPose(t);
    rexHeadCam(rexP, [-0.4, 0.25, 2.6], [0, 0, 0], 32, [-0.43, 0.38, 0.6]);
    const side = smooth(prog(t, 46.6, 46.85));
    rex.eyes.forEach(e => { e.rotation.y = -side * 0.9; });
  } else if (t < 48.4) {
    // it turns to Martin and ROARS
    const turn = smooth(prog(t, 47.2, 47.45)), roar = prog(t, 47.4, 47.6) * (1 - prog(t, 48.15, 48.4));
    Object.assign(rexP, { x: REX_EAT[0], z: REX_EAT[1], ry: Math.PI / 2 - 1.1 * turn, neckX: -0.05, headX: -0.1 - roar * 0.4, headY: -0.25 * turn, jaw: roar * 1.15, crouch: 0.45, tailAmp: 0.14 });
    p = crouchPose(t);
    rex.eyes.forEach(e => { e.rotation.y = -0.9 * (1 - turn); });
    rex.setPose(rexP); rex.root.updateMatrixWorld(true);
    const hp = new THREE.Vector3(0, 0.1, 1.2); rex.head.localToWorld(hp);
    const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(rex.head.getWorldQuaternion(new THREE.Quaternion()));
    setCam([hp.x + fw.x * 6 + 1.0, hp.y - 1.0, hp.z + fw.z * 6], [hp.x, hp.y, hp.z], 42);
    shake(roar * 0.08, t, 3);
  } else if (t < RUN0) {
    // "Oh shit." to camera, then he bolts
    p = crouchPose(t, { y: 0.8, px: 0.1, ry: 0.35 });
    const mp = [SW.hide[0], 1.45, SW.hide[2]];
    setCam([mp[0] + 0.5, 1.5, mp[2] + 1.15], [mp[0], 1.42, mp[2]], 36);
    const cl = headToward(martin, p.ry, mp, camera.position.toArray()); p.ny = cl.ny; p.nx = cl.nx;
    face = { lid: 0.0, brow: 1, worry: 1, open: Math.max(talking(t, MARTIN_LINES), 0.3), pupil: 0.45, sweat: 1 };
    Object.assign(rexP, { x: REX_EAT[0], z: REX_EAT[1], ry: Math.PI / 2 - 1.1, neckX: -0.05, headX: -0.1, crouch: 0.45 });
  } else if (t < 55.0) {
    // chase, the trip, the dive into the portal
    const tripT = 53.0, upT = 53.75, goT = 54.1, diveT = 54.3;
    let mz, mpose;
    if (t < tripT) {
      const dist = (t - RUN0) * MSPD; mz = MZ0 + dist;
      mpose = { ...walkFields(dist, { run: true, stride: 1.05, stance: 0.36, lift: 0.3, lean: 0.25, flail: t < 52.2 }), x: SW.hide[0], z: mz, ry: 0 };
      face = { lid: 0.0, brow: 1, worry: 1, open: 0.55, pupil: 0.55, sweat: 1 };
    } else if (t < goT) {
      const zt = MZ0 + (tripT - RUN0) * MSPD;
      const fall = prog(t, tripT, tripT + 0.35), slide = easeOut(prog(t, tripT + 0.3, tripT + 0.6)), up = backOut(prog(t, upT, goT));
      mz = zt + fall * 0.9 + slide * 0.6 + up * 0.1;
      const bounce = t > tripT + 0.35 && t < upT ? Math.abs(Math.sin((t - tripT - 0.35) * 14)) * 0.05 * Math.exp(-(t - tripT - 0.35) * 8) : 0;
      const down = { x: SW.hide[0], z: mz, ry: 0, y: lerp(HIP_H - 0.05, 0.2, easeIn(fall)) + Math.sin(fall * Math.PI) * 0.15 + bounce, px: lerp(0.3, 1.5, easeIn(fall)),
        lsx: -2.9, rsx: -2.7, lsz: 0.3, rsz: 0.3, le: 0.2, re: 0.2, lhx: lerp(-0.4, 0.15, fall), rhx: lerp(0.5, 0.35, fall), lk: 0.3, rk: 0.6, nx: -0.6, lg: 0, rg: 0 };
      const runP = { ...walkFields(0.3, { run: true, stride: 1.05, stance: 0.36, lift: 0.3, lean: 0.25 }), x: SW.hide[0], z: mz, ry: 0 };
      mpose = up > 0 ? Object.fromEntries(Object.keys({ ...down, ...runP }).map(k => [k, lerp(down[k] ?? 0, runP[k] ?? 0, clamp(up))])) : down;
      face = { lid: t < upT ? 0.9 : 0.0, brow: 1, worry: 1, open: 0.6, squint: t < upT ? 1 : 0, sweat: 1 };
    } else {
      const zt = MZ0 + (tripT - RUN0) * MSPD + 1.6; const k = prog(t, diveT, 54.95);
      const dist = (t - goT) * MSPD;
      mz = t < diveT ? zt + dist : zt + (diveT - goT) * MSPD + k * 2.4;
      mpose = t < diveT ? { ...walkFields(dist, { run: true, stride: 1.05, stance: 0.36, lift: 0.3, lean: 0.25 }), x: SW.hide[0], z: mz, ry: 0 }
        : { x: SW.hide[0], z: mz, y: HIP_H - 0.1 + Math.sin(k * Math.PI) * 0.6, ry: 0, px: lerp(0.3, 1.4, k), lsx: -2.9, rsx: -2.9, lsz: 0.1, rsz: 0.1, le: 0.1, re: 0.1, lhx: 0.3, rhx: 0.6, lk: 0.4, rk: 0.2 };
      martin.root.visible = !(t > diveT && k > 0.92);
      face = { lid: 0, brow: 1, open: 0.7, pupil: 0.5 };
    }
    p = mpose;
    martin.legs.r.sandal.visible = t < tripT + 0.1;
    // the sandal flies off in the trip (ballistic)
    if (t >= tripT + 0.1) {
      const s0 = [SW.hide[0], 0.1, MZ0 + (tripT - RUN0) * MSPD]; const tt = Math.min(t - tripT - 0.1, 0.85); const v = [-0.6, 4.4, -2.2];
      flySandal.visible = true; flySandal.position.set(s0[0] + v[0] * tt, Math.max(0.03, s0[1] + v[1] * tt - 4.9 * tt * tt), s0[2] + v[2] * tt); flySandal.rotation.set(tt * 14, tt * 6, 0);
    }
    // T. rex chases
    const rz = Math.min(REX_EAT[1] + Math.max(0, t - RUN0 + 0.4) * RSPD, PORTAL_Z - 5.8);
    const snap = prog(t, 54.75, 54.85) * (1 - prog(t, 54.85, 55.0));
    Object.assign(rexP, { x: 4.0, z: rz, ry: 0, dist: rz + 12.3, moving: 1, stride: 3.2, stance: 0.5, lift: 0.7, lean: 0.15, neckX: 0.05, headX: 0.05, jaw: t > 54.5 ? 0.9 - snap * 0.9 : 0.35, tailAmp: 0.12, tailSpeed: 4 });
    swampPortal.visible = t > 53.6; swampPortal.position.set(SW.hide[0], 1.12, PORTAL_Z); swampPortal.rotation.set(0, Math.PI, 0);
    room.update(t, 1.5);
    if (t < 52.6) setCam([SW.hide[0] + 1.0, 1.4, mz + 3.2], [SW.hide[0], 1.5, mz - 3], 50);
    else if (t < 53.0) { setCam([SW.hide[0] + 0.45, 1.7, mz + 1.9], [SW.hide[0], 1.6, mz - 1.5], 42); }
    else setCam([SW.hide[0] - 5.0, 1.7, mz + 3.0], [SW.hide[0] + 1.0, 1.1, mz - 2.0], 48);
    shake(0.02 + stompShake(t, [51.5, 52.0, 52.5, 53.0, 53.5, 54.0, 54.5], 0.04), t, 5);
  }
  rex.setPose(rexP);
  if (!(t >= 46.5 && t < 48.4)) rex.eyes.forEach(e => { e.rotation.y = 0; });
  martin.setPose(p); martin.setFace(face);
}

function digShot(t) {
  room.group.add(room.chipsBag, room.chip);
  scene.fog = dig.fog; martin.root.visible = false;
  // hunter kneels and brushes the skull
  const br = Math.sin(t * 7);
  const curious = smooth(prog(t, 62.6, 63.1));
  hunter.setPose({ x: 0.85, z: 0.55, ry: -Math.PI / 2 - 0.25, y: 0.5, px: 0.45 - curious * 0.2,
    lhx: -1.5, lk: 1.55, la: 0.0, rhx: 0.15, rk: 1.75, ra: 0.6, sx: 0.2,
    rsx: -1.0 + br * 0.08, rsz: 0.15, rsy: br * 0.25, re: 0.7, rg: 0.85, lsx: -0.6, le: 0.6, lsz: 0.2, nx: 0.45 - curious * 0.35, ny: curious * 0.8 });
  hunter.setFace({ lid: 0.35, brow: curious * 0.8, look: [curious * 0.5, -0.3], open: curious > 0.5 ? 0.2 : 0 });
  attach(brush, hunter.arms.r.hold, [0, -0.02, 0], [0, 0, 0]);
  const k1 = easeInOut(prog(t, 58.1, 61.7)), k2 = easeInOut(prog(t, 61.7, 62.6)), k3 = prog(t, 62.6, 65.3);
  let pos = L3([4.2, 3.4, 5.2], [1.7, 1.1, 2.4], k1), look = L3([0, 0.2, 0], [-0.4, 0.15, 0.3], k1);
  pos = L3(pos, [-1.0, 0.7, 2.2], k2); look = L3(look, [-1.25, 0.08, 0.95], k2);
  pos = L3(pos, [-1.05, 0.52, 1.85], easeOut(k3));
  setCam(pos, look, 38);
}

/* ---------------------------------------------------------------- frame */
function sceneFor(t) {
  if (t < 9.4) return 'room';
  if (t < 14.95) return 'globe';
  if (t < 53.4) return 'swamp';
  return 'room';
}
function flashAt(t) {
  const f = (c, a, b) => (t < c ? smooth(prog(t, c - a, c)) : 1 - smooth(prog(t, c, c + b)));
  return Math.max(f(9.4, 0.35, 0.35), f(14.95, 0.45, 0.4), f(53.4, 0.3, 0.35), t < 0.25 ? 0 : 0);
}
async function setup() {
  await document.fonts.load('italic 400 40px "Playfair Display"'); await document.fonts.load('italic 700 40px "Playfair Display"');
  await document.fonts.load('700 40px "Playfair Display"'); await document.fonts.load('800 40px Inter'); await document.fonts.load('600 40px Inter');
  TL = await fetch('/work/timeline.json').then(r => r.json());
  room = buildRoom(); globe = await buildGlobe(); swamp = buildSwamp(); dig = buildDig();
  scene.add(room.group, globe.group, swamp.group, dig.group);
  martin = createCharacter(); scene.add(martin.root);
  hunter = createCharacter({ shirt: 0x9c8a5a, tee: 0x9c8a5a, shortsTex: false, shorts: 0x6b5a3a, glasses: false, pimples: false, stubble: true, bald: false, hat: true, openShirt: false, hair: 0x3a2a1a, sandals: 0x4a3524, skin: 0xd09a6a });
  dig.group.add(hunter.root);
  rex = createRex({ seed: 5 }); swamp.group.add(rex.root);
  deadRex = createRex({ seed: 8, dead: true, back: 0x6a6a3c }); swamp.group.add(deadRex.root);
  deadRex.setPose({ t: 0, crouch: 0.4 }); deadRex.root.position.set(-11.0, 1.5, -15.0); deadRex.root.rotation.set(0, 1.0, Math.PI / 2 - 0.05);
  deadRex.jaw.rotation.x = 0.5; deadRex.tail.forEach((s, i) => s.rotation.y = 0.08);
  trike = createTriceratops(); swamp.group.add(trike.root); trike.setPose({ x: 9, z: -14, ry: -Math.PI / 2 - 0.3, headX: 0.55 });
  for (let i = 0; i < 2; i++) { const tr = createTriceratops(); tr.root.scale.setScalar(0.9); swamp.group.add(tr.root); trikes2.push(tr); }
  for (let i = 0; i < 3; i++) { const pt = createPterosaur(i + 1); swamp.group.add(pt.root); pteros.push(pt); }
  swampPortal = room.portal.clone(); swampPortal.rotation.set(0, 0, 0); swamp.group.add(swampPortal);
  // props
  tooth = new THREE.Group(); { const tg = new THREE.ConeGeometry(0.04, 0.29, 14, 8); tg.translate(0, -0.145, 0); const pp = tg.attributes.position; for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); pp.setZ(i, pp.getZ(i) + 0.25 * y * y); } tg.computeVertexNormals(); mesh(tg, mat(0xf6eedb, { roughness: 0.35 }), tooth); mesh(new THREE.SphereGeometry(0.041, 14, 10), mat(0xe9dcc0, { roughness: 0.5 }), tooth, [0, 0, 0], null, [1, 0.5, 1]); }
  banana = new THREE.Group();
  { const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0.05, -0.13, 0), new THREE.Vector3(0.0, -0.27, 0)); mesh(new THREE.TubeGeometry(c, 20, 0.022, 10), mat(0xf2d33c, { roughness: 0.5 }), banana); mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.03, 6), mat(0x4a3a1a), banana, [0, 0.035, 0]); }
  flySandal = new THREE.Group(); mesh(new THREE.BoxGeometry(0.095, 0.018, 0.25), mat(0x151515, { roughness: 0.5 }), flySandal); mesh(new THREE.BoxGeometry(0.1, 0.03, 0.07), mat(0x151515, { roughness: 0.5 }), flySandal, [0, 0.03, 0.02]);
  swamp.group.add(flySandal, tooth);
  brush = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), mat(0x8a5a2a), brush, [0, 0, 0], [Math.PI / 2, 0, 0]); mesh(new THREE.BoxGeometry(0.04, 0.02, 0.05), mat(0xd8c08a), brush, [0, 0, 0.1]);
  // fossil skull + the sandal
  const fossil = createRex({ seed: 3, dead: true, bone: true }); fossil.setPose({ t: 0 });
  fossil.root.traverse(m => { if (m.isMesh) m.material = dig.boneM; });
  fossil.head.removeFromParent(); dig.group.add(fossil.head); fossil.head.position.set(-0.5, -0.2, 0.1); fossil.head.rotation.set(0.05, 1.25, 0.22); fossil.head.scale.setScalar(0.8);
  fossil.eyes.forEach(e => { e.children.forEach(c => c.visible = false); mesh(new THREE.SphereGeometry(0.13, 14, 10), mat(0x3b2f24, { roughness: 1 }), e, [0, 0, 0], null, [1, 1.2, 1.3]); }); fossil.tongue.visible = false; fossil.jaw.rotation.x = 0.25;
  fossilSandal = flySandal.clone(); dig.group.add(fossilSandal); fossilSandal.position.set(-1.25, 0.0, 0.95); fossilSandal.rotation.set(-0.25, 0.6, 0.18);
  mesh(new THREE.SphereGeometry(0.22, 16, 10), mat(0xb08c60, { roughness: 1 }), dig.group, [-1.18, -0.06, 0.82], null, [1.3, 0.35, 0.9]);
  // grain pattern
  grain = document.createElement('canvas'); grain.width = grain.height = 256; const gc = grain.getContext('2d'); const id = gc.createImageData(256, 256); const r = rng(99);
  for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } gc.putImageData(id, 0, 0);
  // warm up shader programs for every set
  for (const tt of [1, 12, 20, 56, 60]) renderAt(tt);
  return TL.frames;
}
function renderAt(t) {
  NOW = t;
  let t3 = t; let frozen = 0;
  for (const [f0, d] of FREEZES) if (t >= f0 && t < f0 + d) { t3 = f0; frozen = t - f0; }
  const L = t3 < INS0 ? t3 : (t3 < INS0 + INS ? INS0 - 0.001 : t3 - INS);   // story clock without the inserted beat
  const s = sceneFor(L);
  room.group.visible = s === 'room'; globe.group.visible = s === 'globe'; swamp.group.visible = s === 'swamp'; dig.group.visible = s === 'dig';
  scene.background = s === 'globe' ? new THREE.Color(0x02030a) : null;
  if (s === 'room') { if (L < 50) roomShots(L); else returnShot(L + 1.05); }
  else if (s === 'globe') globeShot(L);
  else if (s === 'swamp') swampShots(L);
  else digShot(L);
  if (window.CAM) setCam(window.CAM[0], window.CAM[1], window.CAM[2] || 40);
  renderer.render(scene, camera);
  if (frozen > 0) { ctx.filter = 'saturate(0.55) contrast(1.08)'; ctx.drawImage(renderer.domElement, 0, 0); ctx.filter = 'none'; }
  else ctx.drawImage(renderer.domElement, 0, 0);
  post(t, 0);
  if (frozen > 0 && frozen < 0.15) { ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - frozen / 0.15)})`; ctx.fillRect(0, 0, W, H); }
  drawTopLine(L);
  if (s === 'globe') drawGlobeTag(t);
  drawFact(t);
  drawCaption(t);
  const fl = flashAt(L); if (fl > 0) { ctx.fillStyle = `rgba(235,248,255,${clamp(fl)})`; ctx.fillRect(0, 0, W, H); }
  if (t > TL.duration - 0.5) { ctx.fillStyle = `rgba(0,0,0,${prog(t, TL.duration - 0.5, TL.duration)})`; ctx.fillRect(0, 0, W, H); }
}
window.setupScene = setup;
window.renderFrame = (f) => { renderAt(f / FPS); return out.toDataURL('image/jpeg', 0.93); };
window.ready = true;
