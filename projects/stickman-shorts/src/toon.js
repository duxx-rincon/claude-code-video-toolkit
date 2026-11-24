// Flat 2D "paper cut-out" characters: drawn on a canvas each frame, shown as a card standing in the 3D world.
import * as THREE from 'three';
import { rng, clamp, lerp } from './util.js';

export const CW = 768, CH = 1152;           // canvas size (px)
export const CARD_W = 1.5333, CARD_H = 2.3;    // card size in metres (feet at the bottom edge)
const OUT = '#141414';

let paper;
function paperPattern() {
  if (paper) return paper;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const id = g.createImageData(256, 256); const r = rng(42);
  for (let i = 0; i < id.data.length; i += 4) { const v = 200 + r() * 55; id.data[i] = v; id.data[i + 1] = v * 0.98; id.data[i + 2] = v * 0.94; id.data[i + 3] = 255; }
  g.putImageData(id, 0, 0);
  // fibres
  g.globalAlpha = 0.18; g.strokeStyle = '#8a7f6a';
  for (let i = 0; i < 160; i++) { g.beginPath(); const x = r() * 256, y = r() * 256, a = r() * 6; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); }
  paper = c; return c;
}

function poly(g, pts, fill, lw = 10) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } g.lineWidth = lw; g.strokeStyle = OUT; g.stroke(); }
function ell(g, x, y, rx, ry, fill, lw = 10, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (lw) { g.lineWidth = lw; g.strokeStyle = OUT; g.stroke(); } }
function bean(g, cx, top, bot, w) {
  // a soft bean body: wider at the hips
  g.beginPath();
  g.moveTo(cx - w * 0.42, top + 30);
  g.bezierCurveTo(cx - w * 0.48, top - 10, cx + w * 0.48, top - 10, cx + w * 0.42, top + 30);
  g.bezierCurveTo(cx + w * 0.58, top + (bot - top) * 0.55, cx + w * 0.56, bot, cx, bot);
  g.bezierCurveTo(cx - w * 0.56, bot, cx - w * 0.58, top + (bot - top) * 0.55, cx - w * 0.42, top + 30);
  g.closePath();
}
function stick(g, x0, y0, x1, y1, bend = 0, lw = 11) {
  const mx = (x0 + x1) / 2 + (y1 - y0) * bend, my = (y0 + y1) / 2 - (x1 - x0) * bend;
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = OUT; g.stroke();
}

/* head pose: tilt/shift about the chin, so heads can be thrown back or dipped */
function headXf(g, P, cx, hy) { const h = P.head || {}; g.translate(cx + (h.dx || 0), hy + 170 + (h.dy || 0)); g.rotate(h.rot || 0); g.translate(-cx, -(hy + 170)); }
/* face pieces */
function eyes(g, cx, cy, f) {
  const look = f.look ?? [0, 0];
  for (const s of [-1, 1]) {
    const ex = cx + s * 62 + look[0] * 10, ey = cy + look[1] * 8;
    if (f.laughEyes) { g.beginPath(); g.moveTo(ex - 18, ey + 6); g.lineTo(ex, ey - 8); g.lineTo(ex + 18, ey + 6); g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = OUT; g.stroke(); }
    else ell(g, ex, ey, 9, 10, OUT, 0);
    if (f.lid && !f.laughEyes) { // calm half-closed: a lid line across the top of the dot
      g.beginPath(); g.moveTo(ex - 20, ey - 3); g.quadraticCurveTo(ex, ey - 9, ex + 20, ey - 3); g.lineWidth = 8; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = '#fbfbf8'; g.fillRect(ex - 14, ey - 22, 28, 17);
    }
    // eyebrow: short thick slanted stroke
    const ang = (f.angry ?? 0) * 0.55 - (f.raise ?? 0) * 0.15;
    g.save(); g.translate(cx + s * 62, cy - 52 - (f.raise ?? 0) * 14 + (f.angry ?? 0) * 8); g.rotate(-s * ang);   // angry: inner ends down
    g.lineCap = 'round'; g.lineWidth = 15; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-26, 0); g.lineTo(26, 0); g.stroke(); g.restore();
  }
}
function mouth(g, cx, cy, m) {
  g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 8;
  if (m === 'smile') { g.beginPath(); g.arc(cx, cy - 10, 22, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); }
  else if (m === 'grr') { ell(g, cx, cy + 6, 26, 16, '#d8576a', 7); g.fillStyle = '#7a1d2a'; g.beginPath(); g.ellipse(cx, cy + 10, 16, 8, 0, 0, Math.PI); g.fill(); }
  else if (m === 'o') { ell(g, cx, cy + 4, 13, 16, '#d8576a', 7); }
  else if (m === 'laugh') { g.beginPath(); g.moveTo(cx - 44, cy - 6); g.quadraticCurveTo(cx, cy - 14, cx + 44, cy - 6); g.quadraticCurveTo(cx + 40, cy + 52, cx, cy + 56); g.quadraticCurveTo(cx - 40, cy + 52, cx - 44, cy - 6); g.closePath(); g.fillStyle = '#7a1d2a'; g.fill(); g.lineWidth = 7; g.strokeStyle = OUT; g.stroke(); ell(g, cx, cy + 38, 20, 11, '#e0697c', 0); g.fillStyle = '#fbfbf8'; g.fillRect(cx - 34, cy - 7, 68, 10); }
  else if (m === 'cheer') { g.beginPath(); g.arc(cx, cy - 4, 26, 0.05 * Math.PI, 0.95 * Math.PI); g.closePath(); g.fillStyle = '#7a1d2a'; g.fill(); g.lineWidth = 7; g.strokeStyle = OUT; g.stroke(); }
  else { g.beginPath(); g.moveTo(cx - 16, cy); g.lineTo(cx + 16, cy); g.stroke(); }
}

/* the two cast members */
const DRAW = {
  seller(g, P) {
    const cx = CW / 2;
    // body: white shirt bean + striped apron
    bean(g, cx, 470, 905, 330); g.fillStyle = '#fbfbf8'; g.fill(); g.lineWidth = 11; g.strokeStyle = OUT; g.stroke();
    g.save(); bean(g, cx, 470, 905, 330); g.clip();
    // apron (bib + skirt) with blue stripes
    g.beginPath(); g.moveTo(cx - 92, 560); g.lineTo(cx + 92, 560); g.lineTo(cx + 120, 660); g.lineTo(cx + 190, 680); g.lineTo(cx + 190, 910); g.lineTo(cx - 190, 910); g.lineTo(cx - 190, 680); g.lineTo(cx - 120, 660); g.closePath();
    g.save(); g.clip(); g.fillStyle = '#f4f6fb'; g.fillRect(0, 0, CW, CH); g.fillStyle = '#3b7fd1';
    for (let x = cx - 200; x < cx + 210; x += 34) g.fillRect(x, 540, 15, 400);
    g.restore();
    g.lineWidth = 9; g.strokeStyle = OUT; g.stroke();
    g.restore();
    // apron pocket + waist ties
    poly(g, [[cx - 70, 760], [cx + 70, 760], [cx + 64, 830], [cx - 64, 830]], null, 8);
    g.lineWidth = 9; g.strokeStyle = OUT; g.beginPath(); g.moveTo(cx - 92, 560); g.lineTo(cx - 120, 500); g.moveTo(cx + 92, 560); g.lineTo(cx + 120, 500); g.stroke();
    // head (wide egg, no neck)
    const hy = 330 + (P.bob ?? 0);
    g.save(); headXf(g, P, cx, hy);
    ell(g, cx, hy, 232, 192, '#fbfbf8', 11);
    // chef hat
    g.save(); g.translate(cx, hy - 150); g.rotate(P.hatTilt ?? 0);
    poly(g, [[-120, 30], [120, 30], [110, -40], [-110, -40]], '#fbfbf8', 10);
    for (const [x, y, r] of [[-95, -95, 62], [0, -130, 78], [95, -95, 62]]) ell(g, x, y, r, r, '#fbfbf8', 10);
    g.fillStyle = '#fbfbf8'; g.fillRect(-104, -70, 208, 40);
    g.beginPath(); g.moveTo(-40, -30); g.quadraticCurveTo(-45, -70, -30, -95); g.moveTo(40, -30); g.quadraticCurveTo(45, -70, 30, -95); g.lineWidth = 5; g.strokeStyle = '#9a9a92'; g.stroke();
    g.restore();
    // side hair tufts
    for (const s of [-1, 1]) { g.save(); g.beginPath(); g.ellipse(cx, hy, 232, 192, 0, 0, Math.PI * 2); g.clip(); ell(g, cx + s * 222, hy - 70, 30, 44, '#6b4423', 0, s * 0.35); g.restore(); }
    eyes(g, cx, hy + 10, { lid: true, ...P.face });
    // short brown moustache
    for (const s of [-1, 1]) ell(g, cx + s * 30, hy + 74, 38, 15, '#6b4423', 6, s * -0.18);
    mouth(g, cx, hy + 112, P.face?.mouth ?? 'flat');
    g.restore();
  },
  rival(g, P) {
    const cx = CW / 2;
    bean(g, cx, 470, 905, 330); g.fillStyle = '#fbfbf8'; g.fill(); g.lineWidth = 11; g.strokeStyle = OUT; g.stroke();
    g.save(); bean(g, cx, 470, 905, 330); g.clip();
    // red waistcoat with a V opening
    g.beginPath(); g.moveTo(cx - 220, 470); g.lineTo(cx - 40, 470); g.lineTo(cx, 680); g.lineTo(cx + 40, 470); g.lineTo(cx + 220, 470); g.lineTo(cx + 220, 930); g.lineTo(cx - 220, 930); g.closePath();
    g.fillStyle = '#d32b2b'; g.fill(); g.lineWidth = 9; g.strokeStyle = OUT; g.stroke();
    // faint printed pattern on the waistcoat
    g.fillStyle = 'rgba(120,10,10,0.25)'; for (let y = 520; y < 900; y += 40) for (let x = cx - 200; x < cx + 200; x += 40) if (Math.abs(x - cx) > 40 + (680 - y) * 0.2) g.fillRect(x + ((y / 40) % 2) * 20, y, 6, 6);
    g.restore();
    // gold buttons, pocket and watch chain
    for (let i = 0; i < 4; i++) ell(g, cx - 6, 710 + i * 48, 11, 11, '#e7b52f', 5);
    g.lineWidth = 8; g.strokeStyle = OUT; g.beginPath(); g.moveTo(cx + 70, 770); g.lineTo(cx + 140, 770); g.stroke();
    g.strokeStyle = '#e7b52f'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + 80, 772); g.quadraticCurveTo(cx + 110, 800, cx + 140, 772); g.stroke();
    // bow tie
    poly(g, [[cx, 500], [cx - 60, 470], [cx - 60, 535]], '#c41f2a', 8); poly(g, [[cx, 500], [cx + 60, 470], [cx + 60, 535]], '#c41f2a', 8); ell(g, cx, 502, 15, 15, '#a3161f', 7);
    const hy = 330 + (P.bob ?? 0);
    g.save(); headXf(g, P, cx, hy);
    ell(g, cx, hy, 232, 192, '#fbfbf8', 11);
    for (const s of [-1, 1]) { g.save(); g.beginPath(); g.ellipse(cx, hy, 232, 192, 0, 0, Math.PI * 2); g.clip(); ell(g, cx + s * 222, hy - 60, 30, 42, '#3a2618', 0, s * 0.35); g.restore(); }
    // red bowler hat
    g.save(); g.translate(cx, hy - 140); g.rotate(P.hatTilt ?? 0);
    ell(g, 0, 18, 205, 34, '#c41f2a', 10);
    g.beginPath(); g.moveTo(-135, 18); g.bezierCurveTo(-140, -150, 140, -150, 135, 18); g.closePath(); g.fillStyle = '#d32b2b'; g.fill(); g.lineWidth = 10; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#2a1414'; g.beginPath(); g.moveTo(-136, -8); g.lineTo(136, -8); g.lineTo(135, 16); g.lineTo(-135, 16); g.closePath(); g.fill();
    g.restore();
    eyes(g, cx, hy + 10, { angry: 1, ...P.face });
    // big curly black moustache
    for (const s of [-1, 1]) {
      g.save(); g.translate(cx, hy + 78 + (P.stache ?? 0)); g.rotate(s * (P.stacheRot ?? 0)); g.scale(s, 1);
      g.beginPath(); g.moveTo(0, -8); g.bezierCurveTo(40, -30, 95, -20, 112, 10); g.bezierCurveTo(125, 34, 100, 50, 86, 30); g.bezierCurveTo(98, 34, 104, 18, 92, 10); g.bezierCurveTo(70, 0, 40, 18, 0, 14); g.closePath();
      g.fillStyle = OUT; g.fill(); g.restore();
    }
    mouth(g, cx, hy + 116, P.face?.mouth ?? 'grr');
    g.restore();
  },
};

DRAW.fairgoer = (g, P) => {
  const cx = CW / 2, V = P.variant;
  bean(g, cx, 470, 905, 330); g.fillStyle = V.cloth; g.fill(); g.lineWidth = 11; g.strokeStyle = OUT; g.stroke();
  g.save(); bean(g, cx, 470, 905, 330); g.clip();
  if (V.pattern === 'dots') { g.fillStyle = 'rgba(0,0,0,0.13)'; for (let y = 500; y < 900; y += 46) for (let x = cx - 200; x < cx + 200; x += 46) { g.beginPath(); g.arc(x + ((y / 46) % 2) * 23, y, 7, 0, 7); g.fill(); } }
  if (V.pattern === 'check') { g.fillStyle = 'rgba(0,0,0,0.10)'; for (let x = cx - 220; x < cx + 220; x += 60) g.fillRect(x, 470, 26, 440); for (let y = 480; y < 910; y += 60) g.fillRect(cx - 220, y, 440, 26); }
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - 220, 740, 440, 22);   // belt line
  g.restore();
  // collar
  poly(g, [[cx - 70, 478], [cx, 530], [cx + 70, 478]], '#fbfbf8', 8);
  const hy = 330 + (P.bob ?? 0);
  g.save(); headXf(g, P, cx, hy);
  ell(g, cx, hy, 232, 192, '#fbfbf8', 11);
  if (V.hair) for (const s of [-1, 1]) { g.save(); g.beginPath(); g.ellipse(cx, hy, 232, 192, 0, 0, Math.PI * 2); g.clip(); ell(g, cx + s * 222, hy - 60, 30, 42, V.hair, 0, s * 0.35); g.restore(); }
  // straw hat
  g.save(); g.translate(cx, hy - 150); g.rotate(P.hatTilt ?? 0);
  ell(g, 0, 22, 250, 40, '#e3c272', 10);
  g.beginPath(); g.moveTo(-130, 22); g.bezierCurveTo(-125, -110, 125, -110, 130, 22); g.closePath(); g.fillStyle = '#ead08a'; g.fill(); g.lineWidth = 10; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = V.band; g.fillRect(-129, -6, 258, 24);
  g.strokeStyle = 'rgba(140,100,40,0.5)'; g.lineWidth = 3; for (let x = -110; x < 120; x += 18) { g.beginPath(); g.moveTo(x, -60); g.lineTo(x + 6, 18); g.stroke(); }
  g.restore();
  eyes(g, cx, hy + 10, { ...P.face });
  if (V.stache) for (const s of [-1, 1]) ell(g, cx + s * 28, hy + 74, 34, 13, V.hair || '#3a2618', 6, s * -0.18);
  if (V.cheeks) for (const s of [-1, 1]) ell(g, cx + s * 120, hy + 60, 26, 14, 'rgba(240,130,140,0.45)', 0);
  mouth(g, cx, hy + 112, P.face?.mouth ?? 'smile');
  g.restore();
};


DRAW.judge = (g, P) => {
  const cx = CW / 2;
  // long purple coat (to the knees) over a brown waistcoat and cream cravat
  bean(g, cx, 470, 960, 340); g.fillStyle = '#6a3d8f'; g.fill(); g.lineWidth = 11; g.strokeStyle = OUT; g.stroke();
  g.save(); bean(g, cx, 470, 960, 340); g.clip();
  g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 500; y < 960; y += 38) for (let x = cx - 220; x < cx + 220; x += 38) if ((x + y) % 76 === 0) g.fillRect(x, y, 5, 5);
  g.beginPath(); g.moveTo(cx - 70, 480); g.lineTo(cx + 70, 480); g.lineTo(cx + 62, 820); g.lineTo(cx - 62, 820); g.closePath(); g.fillStyle = '#7a4a26'; g.fill(); g.lineWidth = 8; g.strokeStyle = OUT; g.stroke();
  for (let i = 0; i < 4; i++) ell(g, cx, 600 + i * 50, 10, 10, '#e7b52f', 5);
  g.strokeStyle = '#e7b52f'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + 10, 680); g.quadraticCurveTo(cx + 40, 715, cx + 60, 690); g.stroke();
  // gold trim along the coat front
  g.strokeStyle = '#e7b52f'; g.lineWidth = 9; g.beginPath(); g.moveTo(cx - 74, 480); g.lineTo(cx - 70, 960); g.moveTo(cx + 74, 480); g.lineTo(cx + 70, 960); g.stroke();
  g.restore();
  for (const s of [-1, 1]) poly(g, [[cx + s * 70, 478], [cx + s * 125, 520], [cx + s * 80, 620]], '#7b4aa3', 8);   // lapels
  poly(g, [[cx - 45, 470], [cx + 45, 470], [cx + 30, 560], [cx, 590], [cx - 30, 560]], '#f3e6c4', 8);            // cravat
  const hy = 330 + (P.bob ?? 0);
  g.save(); headXf(g, P, cx, hy);
  ell(g, cx, hy, 232, 192, '#fbfbf8', 11);
  // grey beard around the jaw
  g.beginPath(); g.moveTo(cx - 175, hy + 40); g.bezierCurveTo(cx - 170, hy + 230, cx + 170, hy + 230, cx + 175, hy + 40); g.bezierCurveTo(cx + 110, hy + 110, cx - 110, hy + 110, cx - 175, hy + 40); g.closePath();
  g.fillStyle = '#9a9a96'; g.fill(); g.lineWidth = 8; g.strokeStyle = OUT; g.stroke();
  g.strokeStyle = 'rgba(60,60,60,0.35)'; g.lineWidth = 3; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(cx + i * 22, hy + 120); g.lineTo(cx + i * 24, hy + 180); g.stroke(); }
  for (const s of [-1, 1]) ell(g, cx + s * 34, hy + 74, 40, 16, '#a3a39f', 6, s * -0.15);
  // tall black top hat
  g.save(); g.translate(cx, hy - 150); g.rotate(P.hatTilt ?? 0);
  ell(g, 0, 22, 200, 30, '#1c1c22', 10);
  poly(g, [[-120, 18], [120, 18], [128, -230], [-128, -230]], '#22222a', 10);
  ell(g, 0, -230, 128, 22, '#2c2c36', 10);
  g.fillStyle = '#6a3d8f'; g.fillRect(-121, -20, 242, 34);
  g.restore();
  // round glasses
  for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 62, hy + 10, 38, 0, Math.PI * 2); g.lineWidth = 8; g.strokeStyle = OUT; g.stroke(); }
  g.beginPath(); g.moveTo(cx - 24, hy + 8); g.lineTo(cx + 24, hy + 8); g.stroke();
  eyes(g, cx, hy + 10, { ...P.face });
  mouth(g, cx, hy + 116, P.face?.mouth ?? 'smile');
  g.restore();
};

// props drawn in the toon style
export function drawSpoon(g, x, y, ang) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.lineTo(6, -230); g.lineTo(-6, -230); g.closePath(); g.fillStyle = '#d7dbe0'; g.fill(); g.lineWidth = 7; g.strokeStyle = OUT; g.stroke();
  ell(g, 0, -300, 62, 80, '#e6e9ee', 9); ell(g, -14, -315, 22, 34, 'rgba(255,255,255,0.8)', 0);
  g.restore();
}
export function drawCone(g, x, y) {
  g.save(); g.translate(x, y);
  poly(g, [[-62, 0], [62, 0], [0, 200]], '#d9a35a', 9);
  g.strokeStyle = 'rgba(120,70,20,0.55)'; g.lineWidth = 4; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 20 - 40, 10); g.lineTo(i * 20 + 30, 150); g.stroke(); }
  // firm ice cream with neat ridges, tall
  for (let k = 0; k < 4; k++) { const w = 80 - k * 14; ell(g, 0, -30 - k * 52, w, 38, '#fff6e2', 9); g.strokeStyle = 'rgba(200,170,120,0.6)'; g.lineWidth = 4; g.beginPath(); g.ellipse(0, -30 - k * 52, w * 0.7, 22, 0, 0.2, Math.PI - 0.2); g.stroke(); }
  ell(g, 0, -232, 22, 22, '#fff6e2', 8);
  g.restore();
}
export function drawRosette(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  for (const d of [-1, 1]) poly(g, [[d * 12, 20], [d * 46, 20], [d * 52, 120], [d * 30, 100], [d * 12, 124]], '#e8b52a', 6);
  g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 52 : 62; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = '#f2c12e'; g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
  ell(g, 0, 0, 34, 34, '#ffd84a', 6); ell(g, 0, 0, 20, 20, '#e8a91f', 0);
  g.restore();
}

export function makeToon(kind, variant) {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(CARD_W, CARD_H); geo.translate(0, CARD_H / 2, 0);
  const matl = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, matl); mesh.castShadow = true;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  const group = new THREE.Group(); group.add(mesh);
  const toPx = (x, y) => [CW / 2 + x / CARD_W * CW, CH - y / CARD_H * CH];      // card metres -> px
  const toCard = (px, py) => [(px - CW / 2) / CW * CARD_W, (CH - py) / CH * CARD_H];
  return {
    group, mesh, kind, toPx, toCard,
    // P: { face:{look, angry, raise, mouth}, bob, hands:{l:[px,py], r:[px,py]}, legs:true, prop(g) drawn above the body, propBehind(g) }
    draw(P) {
      g.clearRect(0, 0, CW, CH);
      const cx = CW / 2;
      // legs
      if (P.legs !== false) for (const s of [-1, 1]) { const w = P.walk != null ? Math.sin(P.walk + (s > 0 ? Math.PI : 0)) : 0; const lift = P.walk != null ? Math.max(0, -Math.cos(P.walk + (s > 0 ? Math.PI : 0))) * 26 : 0; const kx = P.kneel?.[s > 0 ? 'r' : 'l'] ?? 0; stick(g, cx + s * 70, 880, cx + s * 78 + w * 46 + kx, 1110 - lift, 0.04 * w, 12); ell(g, cx + s * 92 + w * 52 + kx, 1118 - lift, 30, 13, OUT, 0); }
      if (P.propBehind) P.propBehind(g);
      g.save(); if (P.tilt) { g.translate(cx, 880); g.rotate(P.tilt); g.translate(-cx, -880); }
      DRAW[kind](g, { ...P, variant });
      // arms from the shoulders to round dot hands
      const sh = { l: [cx - 160, 585 + (P.bob ?? 0) * 0.5 - (P.shrug ?? 0)], r: [cx + 160, 585 + (P.bob ?? 0) * 0.5 - (P.shrug ?? 0)] };
      for (const k of ['l', 'r']) {
        const h = P.hands?.[k] ?? [sh[k][0] + (k === 'l' ? -40 : 40), 800];
        stick(g, sh[k][0], sh[k][1], h[0], h[1], (P.bend?.[k] ?? 0.12) * (k === 'l' ? 1 : -1));
      }
      if (P.prop) P.prop(g);
      for (const k of ['l', 'r']) { const h = P.hands?.[k] ?? [sh[k][0] + (k === 'l' ? -40 : 40), 800]; ell(g, h[0], h[1], 21, 21, OUT, 0);
        if (P.point === k) { const d = P.pointDir ?? [-1, 0]; stick(g, h[0], h[1], h[0] + d[0] * 46, h[1] + d[1] * 46, 0, 10); } }
      g.restore();
      // faint paper texture, only where something is drawn
      g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.16; g.fillStyle = g.createPattern(paperPattern(), 'repeat'); g.fillRect(0, 0, CW, CH); g.restore();
      tex.needsUpdate = true;
    },
  };
}

// a burlap sack with a big painted number, drawn in the toon style. (cx,cy) centre, ang tilt (rad)
export function drawSack(g, cx, cy, ang, num = '9') {
  g.save(); g.translate(cx, cy); g.rotate(ang);
  g.beginPath(); g.moveTo(-95, -95); g.bezierCurveTo(-130, -40, -135, 90, -100, 125); g.bezierCurveTo(-40, 150, 40, 150, 100, 125); g.bezierCurveTo(135, 90, 130, -40, 95, -95);
  g.bezierCurveTo(60, -120, -60, -120, -95, -95); g.closePath();
  g.fillStyle = '#b8935f'; g.fill(); g.save(); g.clip();
  g.strokeStyle = 'rgba(110,80,40,0.35)'; g.lineWidth = 3; for (let i = -150; i < 150; i += 10) { g.beginPath(); g.moveTo(i, -150); g.lineTo(i, 160); g.stroke(); g.beginPath(); g.moveTo(-150, i); g.lineTo(150, i); g.stroke(); }
  g.restore(); g.lineWidth = 10; g.strokeStyle = OUT; g.stroke();
  // opening with salt showing
  ell(g, 0, -100, 92, 24, '#f6f6f2', 9);
  g.fillStyle = '#ffffff'; for (let i = 0; i < 18; i++) { g.fillRect(-60 + (i * 37) % 120, -108 + (i * 13) % 14, 6, 6); }
  // painted 9
  g.font = '900 150px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#7a2015'; g.fillText(num, 0, 32);
  g.restore();
}
