import * as THREE from 'three';
import { EffectComposer } from '/node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '/node_modules/three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from '/node_modules/three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from '/node_modules/three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from '/node_modules/three/examples/jsm/environments/RoomEnvironment.js';
import { clamp, lerp, smooth, easeInOut, easeOut, backOut, prog, rng } from './util.js';
import { makeToon, drawSack, drawSpoon, drawCone, drawRosette, CW, CH, CARD_W, CARD_H } from './toon.js';
import { buildFair, mkStall, mkChurn, mkPrizeTable, mkIceCart } from './world.js';

const W = 1080, H = 1920, FPS = 30;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out); const ctx = out.getContext('2d');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 900);
let composer, bokeh, fair, seller, rival, churnS, churnR, prize, salt, saltGeo;

const SX = -1.25, RX = 1.25, CARD_Z = 0.02, COUNTER_Y = 0.635, CHURN_Z = 0.3, CS = 1.05, CHX = 0.2;   // churn sits a little right of centre on each counter   // CS: churn scale
const L3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
function setCam(pos, look, fov) { camera.position.set(...pos); camera.lookAt(...look); if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); } }

// world point -> pixel on a character card, along the camera ray (so hands land on 3D props as seen)
function onCard(toon, world) {
  const cardWorldZ = toon.group.position.z;
  const dir = world.clone().sub(camera.position).normalize();
  const s = (cardWorldZ - camera.position.z) / dir.z; const p = camera.position.clone().add(dir.multiplyScalar(s));
  const lx = p.x - toon.group.position.x, ly = p.y - toon.group.position.y;
  return toon.toPx(lx, ly);
}
function cardToWorld(toon, px, py, dz = 0) { const [x, y] = toon.toCard(px, py); return new THREE.Vector3(toon.group.position.x + x, toon.group.position.y + y, toon.group.position.z + dz); }

/* ------------------------------------------------ SHOT 1: the seller pours the "9" salt over the ice */
// sack centre (px on the seller card) and tilt over time
let SACK = null;
function sackAt(t) { return SACK ? SACK(t) : sackAt1(t); }
function sackAt1(t) {
  const lift = easeOut(prog(t, 0.15, 0.95)), tip = easeInOut(prog(t, 0.95, 1.45)), sweep = easeInOut(prog(t, 1.45, 3.7));
  const ang = -2.05 * tip + Math.sin(t * 9) * 0.015 * tip;
  const x = lerp(520, 520, lift) + lerp(0, -25, tip) + sweep * 105;
  const y = lerp(1060, 440, lift) + tip * 15 + Math.sin(t * 6) * 3;
  return { x, y, ang };
}
function sackMouthPx(t) { const s = sackAt(t); const ox = 0, oy = -112; return [s.x + ox * Math.cos(s.ang) - oy * Math.sin(s.ang) - 18, s.y + ox * Math.sin(s.ang) + oy * Math.cos(s.ang) - 62]; }   // offset matched to the drawn opening
function sellerShot1(t) {
  const s = sackAt(t);
  const hand = (lx, ly) => [s.x + lx * Math.cos(s.ang) - ly * Math.sin(s.ang), s.y + lx * Math.sin(s.ang) + ly * Math.cos(s.ang)];
  seller.draw({
    face: { look: [lerp(0, 0.2, prog(t, 1.4, 3.7)), 0.7], mouth: 'flat' }, bob: Math.sin(t * 3) * 2, legs: false,
    hands: { l: hand(-95, 110), r: hand(118, -30) }, bend: { l: -0.15, r: 0.15 },
    prop: g => drawSack(g, s.x, s.y, s.ang, '9'),
  });
}
// salt grains: analytic, so any frame can be rendered on its own
const NSALT = 2600; let POUR0 = 1.5, POUR1 = 3.75;
let grains = [];
function initSalt() {
  const r = rng(77);
  for (let i = 0; i < NSALT; i++) grains.push({ u: i / NSALT, jx: (r() - 0.5) * 0.025, jz: (r() - 0.5) * 0.025, vx: (r() - 0.5) * 0.08, vy: -0.2 - r() * 0.25, vz: (r() - 0.5) * 0.06, tw: r() * 50 });
  saltGeo = new THREE.BufferGeometry();
  saltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NSALT * 3), 3));
  saltGeo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(NSALT), 1));
  saltGeo.setAttribute('tw', new THREE.BufferAttribute(new Float32Array(NSALT), 1));
  salt = new THREE.Points(saltGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute float size; attribute float tw; varying float vTw; void main(){ vTw = tw; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * (300. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vTw; void main(){ vec2 p = gl_PointCoord - .5; float d = length(p); float grain = 1. - smoothstep(.28, .34, d); float rim = smoothstep(.16, .3, d); float star = (max(0., 1. - abs(p.x) * 10.) * max(0., 1. - abs(p.y) * 2.2) + max(0., 1. - abs(p.y) * 10.) * max(0., 1. - abs(p.x) * 2.2)) * vTw; float a = max(grain, star); if (a < .05) discard; vec3 c = mix(vec3(1.), vec3(.55, .62, .72), rim * grain * (1. - vTw)); gl_FragColor = vec4(c, clamp(a, 0., 1.)); }',
  }));
  salt.frustumCulled = false; scene.add(salt);
}
function updateSalt(t) {
  const pos = saltGeo.attributes.position.array, size = saltGeo.attributes.size.array, twA = saltGeo.attributes.tw.array;
  const bucket = new THREE.Vector3(SX + CHX, COUNTER_Y, CHURN_Z);
  for (let i = 0; i < NSALT; i++) {
    const gr = grains[i]; gr.t0 = POUR0 + gr.u * (POUR1 - POUR0);
    if (t < gr.t0) { pos[i * 3 + 1] = -99; size[i] = 0; continue; }
    const [mx, my] = sackMouthPx(gr.t0); const m = cardToWorld(seller, mx, my, 0);
    // the sack reads as held over the bucket: the stream starts at the bucket's depth, in front of the can and crank bar
    let x = m.x + gr.jx, y = m.y, z = CHURN_Z + 0.13 + gr.jz;
    const dt = t - gr.t0;
    const iceY = COUNTER_Y + 0.47 * CS;
    // time to fall to the ice
    const a = 4.9, b = -gr.vy, c = -(y - iceY); const tl = (b + Math.sqrt(b * b + 4 * a * (y - iceY))) / (2 * a);
    const tt = Math.min(dt, tl);
    x += gr.vx * tt; z += gr.vz * tt; y += gr.vy * tt - 4.9 * tt * tt;
    if (dt >= tl) { // landed: settle on the ice inside the rim
      const dx = x - bucket.x, dz = z - bucket.z, d = Math.hypot(dx, dz); const R = 0.17 * CS; if (d > R) { x = bucket.x + dx / d * R; z = bucket.z + dz / d * R; }
      y = iceY + 0.005 + ((i * 7919) % 100) / 100 * 0.02;
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    const tw = Math.pow(Math.sin(t * 37 + gr.tw) * 0.5 + 0.5, 6);
    size[i] = (dt < tl ? 0.06 : 0.045) * (0.8 + 1.6 * tw); twA[i] = tw;
  }
  saltGeo.attributes.position.needsUpdate = true; saltGeo.attributes.size.needsUpdate = true; saltGeo.attributes.tw.needsUpdate = true;
}
let stream;
function updateStream(t) {
  if (!stream) {
    stream = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform float time; float h(float x){ return fract(sin(x * 91.7) * 4375.85); } void main(){ float edge = 1. - abs(dot(vN, vV)); float grainy = .6 + .4 * h(floor(vUv.x * 160. - time * 40.) + floor(vUv.y * 6.)); vec3 c = mix(vec3(1.), vec3(.5, .56, .64), smoothstep(.45, .95, edge)); float a = (.85 - edge * .3) * grainy; gl_FragColor = vec4(c, a); }' }));
    stream.frustumCulled = false; scene.add(stream);
  }
  stream.material.uniforms.time.value = t;
  const on = t > POUR0 && t < POUR1 + 0.15; stream.visible = on; if (!on) return;
  const [mx, my] = sackMouthPx(t); const m = cardToWorld(seller, mx, my, 0);
  const iceY = COUNTER_Y + 0.47 * CS; const z = CHURN_Z + 0.13;
  const fade = 1 - prog(t, POUR1 - 0.1, POUR1 + 0.15);
  const top = new THREE.Vector3(m.x, m.y, z), pts = [];
  for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector3(m.x + Math.sin(t * 8 + k * 5) * 0.004 * k, lerp(m.y, iceY, k), z)); }
  stream.geometry.dispose(); stream.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.011 * fade + 0.002, 8);
}
function shot1(t) {
  rival.group.visible = true; seller.group.visible = true; salt.visible = true;
  sellerShot1(t);
  rival.draw({ face: { look: [-0.6, 0] }, hands: { l: [250, 720], r: [520, 720] }, legs: false });
  churnS.arm.rotation.x = 0; churnR.arm.rotation.x = 0;
  updateSalt(t); updateStream(t);
  const k = easeInOut(prog(t, 0, 4));
  setCam(L3([SX + 0.12, 1.02, 2.75], [SX + 0.1, 1.02, 2.6], k), [SX + 0.12, 1.36, 0], 45);
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(SX, 1.2, CHURN_Z));
  bokeh.uniforms.aperture.value = 0.0018;
}

/* ------------------------------------------------ SHOT 2: wide, high angle, they glare, then crank */
function crankAngle(t, start, rps) { return t < start ? 0 : (t - start) * Math.PI * 2 * rps + Math.min(1, (t - start) * 3) * 0; }
function shot2(t) {
  salt.visible = false; if (stream) stream.visible = false;
  const glare = 1.55, grab = 1.85;
  const angS = crankAngle(t, grab, 2.3), angR = crankAngle(t, grab + 0.05, 2.5);
  churnS.arm.rotation.x = angS; churnR.arm.rotation.x = -angR;
  const k = easeInOut(prog(t, 0, 4));
  setCam(L3([0, 3.0, 5.6], [0, 2.75, 4.75], k), L3([0, 1.15, 0.3], [0, 1.05, 0.95], k), lerp(50, 48, k));
  scene.updateMatrixWorld(true);
  const kS = new THREE.Vector3(); churnS.knob.getWorldPosition(kS); const kR = new THREE.Vector3(); churnR.knob.getWorldPosition(kR);
  const rimS = new THREE.Vector3(SX + CHX - 0.19 * CS, COUNTER_Y + 0.36 * CS, CHURN_Z), rimR = new THREE.Vector3(RX - CHX + 0.19 * CS, COUNTER_Y + 0.36 * CS, CHURN_Z);
  const reach = smooth(prog(t, glare + 0.05, grab));
  const shake = t > grab ? Math.sin(t * 30) * 3 : 0;
  // seller: right hand to the crank, left hand steadies the bucket
  const sR = onCard(seller, kS), sL = onCard(seller, rimS);
  seller.draw({ face: { look: [t < glare + 0.2 ? 1 : 0.3, t < glare + 0.2 ? 0 : 0.5], angry: 0.6, mouth: 'flat' }, bob: shake, legs: false,
    hands: { l: L3([250, 760], sL, reach), r: L3([520, 760], sR, reach) }, bend: { l: 0.15, r: 0.1 } });
  const rR = onCard(rival, rimR), rL = onCard(rival, kR);
  rival.draw({ face: { look: [t < glare + 0.2 ? -1 : -0.3, t < glare + 0.2 ? 0 : 0.5], angry: 1, mouth: t > grab ? 'grr' : 'flat' }, bob: shake * 1.2, legs: false,
    hands: { l: L3([250, 760], rL, reach), r: L3([520, 760], rR, reach) }, bend: { l: -0.1, r: 0.15 } });
  // lean towards each other while glaring
  const lean = Math.sin(Math.min(1, t / glare) * Math.PI) * 0.05;
  seller.group.rotation.z = -lean; rival.group.rotation.z = lean;
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(0, 1.0, 0.9));
  bokeh.uniforms.aperture.value = 0.0007;
}


/* ------------------------------------------------ SHOT 3: the rival laughs at the salt, the seller shrugs and keeps pouring */
const sack3 = (t) => ({ x: 495 + 105 * (0.5 + 0.5 * Math.sin(t * 1.5 - 1.2)), y: 455 + Math.sin(t * 6) * 3, ang: -2.05 + Math.sin(t * 9) * 0.015 });
function shot3(t) {
  SACK = sack3; POUR0 = -4; POUR1 = 4.6; salt.visible = true;
  seller.group.visible = rival.group.visible = true; churnS.arm.rotation.x = 0; churnR.arm.rotation.x = 0;
  rival.group.position.set(SX + lerp(1.5, 1.08, easeOut(prog(t, 0.0, 0.55))), 0, 0.95);
  const shrug = Math.sin(prog(t, 2.1, 2.65) * Math.PI) * 22;
  const s = sackAt(t); const hand = (lx, ly) => [s.x + lx * Math.cos(s.ang) - ly * Math.sin(s.ang), s.y + lx * Math.sin(s.ang) + ly * Math.cos(s.ang)];
  seller.draw({ face: { look: [0.1, 0.7], mouth: 'flat', raise: shrug / 60 }, shrug, head: { dy: -shrug * 0.4 }, legs: false, bob: Math.sin(t * 3) * 2,
    hands: { l: hand(-95, 110 + shrug), r: hand(118, -30 + shrug) }, bend: { l: -0.15, r: 0.15 }, prop: g => drawSack(g, s.x, s.y, s.ang, '9') });
  // rival: lean in + point, head back laughing, double over slapping his knee, recover wiping an eye
  const P = { legs: true, face: { angry: 0.7, look: [-1, 0.4], mouth: 'smile' }, hands: { l: [150, 640], r: [560, 760] }, bend: { l: 0.1, r: -0.1 } };
  const bounce = Math.sin(t * 34) * 7;
  if (t < 0.7) {
    const k = easeOut(prog(t, 0.1, 0.5));
    Object.assign(P, { tilt: -0.12 * k, point: 'l', pointDir: [-0.95, 0.3], hands: { l: [lerp(200, 40, k), lerp(760, 600, k)], r: [560, 770] } });
  } else if (t < 1.35) {
    const k = backOut(prog(t, 0.7, 0.95));
    Object.assign(P, { tilt: 0.12 * k, head: { rot: 0.32 * k, dx: 30 * k, dy: -35 * k }, stache: bounce, stacheRot: Math.sin(t * 34) * 0.08,
      face: { laughEyes: true, mouth: 'laugh', angry: 0.2 }, hands: { l: [240, 790], r: [528, 790] }, bob: Math.abs(bounce) * 0.6 });
  } else if (t < 3.2) {
    const k = backOut(prog(t, 1.35, 1.6));
    const slap = (u) => { const ph = ((u - 1.6) / 0.42) % 1; return u < 1.6 ? 0 : (ph < 0.35 ? easeOut(ph / 0.35) : 1 - easeInOut((ph - 0.35) / 0.65)); };
    const sl = slap(t);
    Object.assign(P, { tilt: -0.22 * k, head: { rot: -0.18 * k, dx: -40 * k, dy: 95 * k }, stache: bounce, stacheRot: Math.sin(t * 34) * 0.08,
      face: { laughEyes: true, mouth: 'laugh', angry: 0.2 }, hands: { l: [250, 800], r: [lerp(520, 470, sl), lerp(820, 1000, sl)] }, bob: Math.abs(bounce) * 0.5 });
    rival.group.scale.y = 1 - 0.05 * k;
  } else {
    const k = easeInOut(prog(t, 3.2, 3.6));
    Object.assign(P, { tilt: lerp(-0.22, -0.04, k), head: { rot: lerp(-0.18, 0.05, k), dx: lerp(-40, 0, k), dy: lerp(95, 0, k) }, stache: bounce * 0.5,
      face: { laughEyes: true, mouth: 'laugh', angry: 0.2 }, hands: { l: [lerp(250, 330, k), lerp(800, 345, k)], r: [530, 800] }, bob: Math.abs(bounce) * 0.3 });
    rival.group.scale.y = 1 - 0.05 * (1 - k);
  }
  if (t < 1.35) rival.group.scale.y = 1;
  rival.draw(P);
  updateSalt(t); updateStream(t);
  const k = easeInOut(prog(t, 0, 4));
  setCam(L3([SX + 0.5, 1.55, 4.6], [SX + 0.53, 1.55, 4.45], k), [SX + 0.5, 1.28, 0.35], 52);
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(SX + 0.4, 1.3, 0.6)); bokeh.uniforms.aperture.value = 0.0012;
}

/* ------------------------------------------------ SHOT 4: the "300" ice cart arrives, fairgoers line up cheering */
const FG = [
  { cloth: '#5c9e4a', pattern: 'dots', hair: '#6b4423', band: '#7a3b1e', cheeks: true },
  { cloth: '#e8c23a', pattern: 'check', hair: '#3a2618', band: '#2f5d8a', stache: true },
  { cloth: '#8b5a2b', pattern: 'none', hair: '#d9a441', band: '#b8322a', cheeks: true },
  { cloth: '#3f7f3a', pattern: 'check', hair: '#2a1a10', band: '#e8c23a', stache: true },
  { cloth: '#e0a52a', pattern: 'dots', hair: '#8a5a2b', band: '#3f7f3a' },
];
const SPOTS = [[RX - 0.5, 1.6], [RX - 1.05, 1.78], [RX - 1.6, 1.96], [RX - 2.15, 2.14], [RX - 2.7, 2.32]];   // the line runs off the left of frame
let fairgoers = [], cart;
function shot4(t) {
  salt.visible = false; if (stream) stream.visible = false;
  seller.group.visible = true; rival.group.visible = true; rival.group.position.set(RX, 0, CARD_Z); rival.group.scale.y = 1;
  seller.group.position.set(SX, 0, CARD_Z);
  seller.draw({ face: { look: [1, 0.2], mouth: 'flat' }, legs: false, hands: { l: [250, 780], r: [520, 780] } });
  churnS.arm.rotation.x = 0; churnR.arm.rotation.x = 0;
  // cart rolls in from the right and stops beside the stall
  cart.group.visible = true;
  const ck = easeOut(prog(t, 0, 1.7)); const cx0 = RX + 1.45, travel = 3.4;
  const dist = (1 - ck) * travel; cart.group.position.set(cx0 + dist, 0, 1.35);
  cart.wheels.forEach(w => { w.rotation.z = dist / 0.36; });
  cart.group.rotation.z = t > 1.7 ? Math.sin((t - 1.7) * 18) * 0.02 * Math.exp(-(t - 1.7) * 5) : 0;
  // rival: watches it arrive, then swings both arms proudly towards the ice
  const sw = backOut(prog(t, 1.75, 2.25)), held = t > 2.25 ? Math.sin((t - 2.25) * 6) * 8 : 0;
  rival.draw({ legs: false, tilt: 0.06 * sw, face: { angry: 0.45, look: [lerp(0.8, 0.2, sw), lerp(0, -0.4, sw)], mouth: sw > 0.3 ? 'smile' : 'grr', raise: 0.3 * sw },
    hands: { l: L3([250, 790], [520, 470 + held], sw), r: L3([520, 790], [700, 380 - held], sw) }, bend: { l: -0.2, r: -0.15 } });
  // fairgoers walk in from the left and line up, then clap and cheer
  fairgoers.forEach((f, i) => {
    const t0 = 0.9 + i * 0.3, spd = 1.35; const [sx, sz] = SPOTS[i]; const len = 3.0;
    const k = clamp((t - t0) * spd / len); const walking = k > 0 && k < 1;
    f.group.visible = t > t0 - 0.2;
    const x = sx - len * (1 - k);
    const cheer = t > t0 + len / spd + 0.1;
    const jump = cheer ? Math.abs(Math.sin((t + i) * 8)) * 0.05 : 0;
    f.group.position.set(x, jump + (walking ? Math.abs(Math.sin((t - t0) * 9)) * 0.02 : 0), sz);
    const clap = Math.abs(Math.sin((t + i * 0.3) * 13));
    f.draw({ legs: true, walk: walking ? (t - t0) * 9 : null, face: { look: [0.8, -0.3], mouth: cheer ? (i % 2 ? 'cheer' : 'o') : 'smile', raise: cheer ? 0.6 : 0.2 },
      hands: cheer ? { l: [384 - 18 - 40 * clap, 640], r: [384 + 18 + 40 * clap, 640] } : { l: [250 + (walking ? Math.sin((t - t0) * 9) * 30 : 0), 800], r: [520 - (walking ? Math.sin((t - t0) * 9) * 30 : 0), 800] },
      bend: { l: 0.2, r: -0.2 }, bob: cheer ? -jump * 60 : 0 });
  });
  const k = easeInOut(prog(t, 0, 5));
  setCam(L3([RX + 0.55, 1.5, 6.9], [RX + 0.5, 1.5, 6.5], k), [RX + 0.55, 1.5, 0.9], 58);
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(RX, 1.2, 1.2)); bokeh.uniforms.aperture.value = 0.0009;
}


/* ------------------------------------------------ SHOT 5: melted slush, fairgoers laugh, frost climbs the bucket */
let fg5 = [];
function shot5(t) {
  salt.visible = false; if (stream) stream.visible = false;
  rival.group.visible = false;
  churnS.iceBits.forEach(m => m.visible = false); churnS.slush.visible = true; churnS.frost.visible = true;
  churnS.frostM.uniforms.frost.value = smooth(prog(t, 0.2, 3.8));
  const ang = t * Math.PI * 2 * 1.0; churnS.arm.rotation.x = ang;
  const k = easeInOut(prog(t, 0, 4));
  setCam(L3([SX + 0.25, 1.14, 1.85], [SX + 0.25, 1.12, 1.72], k), [SX + 0.22, 1.24, 0.2], 60);
  scene.updateMatrixWorld(true);
  const kS = new THREE.Vector3(); churnS.knob.getWorldPosition(kS);
  const rimS = new THREE.Vector3(SX + CHX - 0.19 * CS, COUNTER_Y + 0.36 * CS, CHURN_Z);
  seller.draw({ face: { look: [0.2, 0.6], mouth: 'flat' }, legs: false, bob: Math.sin(t * 6.28) * 2, hands: { l: onCard(seller, rimS), r: onCard(seller, kS) }, bend: { l: 0.15, r: 0.1 } });
  // two fairgoers lean in from the left, point, then laugh holding their bellies
  fg5.forEach((f, i) => {
    const d = i === 0 ? [SX - 0.42, 0.5] : [SX - 0.5, 0.2]; f.group.scale.setScalar(i === 0 ? 0.74 : 0.84);
    const inK = easeOut(prog(t, 0.05 + i * 0.12, 0.6 + i * 0.12));
    f.group.visible = true; f.group.position.set(d[0] - 0.7 * (1 - inK), 0, d[1]);
    const laugh = t > 1.35 + i * 0.12, bounce = Math.sin(t * 30 + i * 2) * 6;
    if (!laugh) f.draw({ legs: true, tilt: 0.22 * inK, point: 'r', pointDir: [0.95, 0.35], face: { look: [1, 0.6], mouth: t > 0.8 ? 'cheer' : 'o', raise: 0.5 },
      hands: { l: [250, 800], r: [lerp(520, 700, inK), lerp(800, 640, inK)] }, bend: { l: 0.1, r: -0.15 } });
    else f.draw({ legs: true, tilt: 0.2 + Math.sin(t * 15 + i) * 0.05, head: { rot: 0.18, dx: 20, dy: -20 + bounce }, face: { laughEyes: true, mouth: 'laugh' },
      hands: { l: [300, 790 + bounce * 0.5], r: [468, 790 + bounce * 0.5] }, bend: { l: 0.2, r: -0.2 }, bob: Math.abs(bounce) * 0.6 });
  });
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(SX + CHX, 1.0, CHURN_Z)); bokeh.uniforms.aperture.value = 0.0022;
}


/* ------------------------------------------------ shared for 6-8: a table between the stalls with both churns */
let iceStack = [];
let judge, tableG, churnA, churnB, cream, creamGeo, mistPts, rimFrost, canProp, pour, puddle, splash;
const TZ = 1.15, TY = 0.78, AX = -0.42, BX = 0.42;
function setupFinale() {
  judge = makeToon('judge'); judge.group.visible = false; scene.add(judge.group);
  tableG = new THREE.Group(); scene.add(tableG);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5e36, roughness: 0.8 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.7), wood); top.position.set(0, TY - 0.03, TZ); top.castShadow = top.receiveShadow = true; tableG.add(top);
  for (const [x, z] of [[-0.78, TZ - 0.3], [0.78, TZ - 0.3], [-0.78, TZ + 0.3], [0.78, TZ + 0.3]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, TY - 0.06, 0.06), wood); l.position.set(x, (TY - 0.06) / 2, z); l.castShadow = true; tableG.add(l); }
  churnA = mkChurn(tableG, [AX, TY, TZ], 6, CS); churnB = mkChurn(tableG, [BX, TY, TZ], 7, CS);
  churnA.iceBits.forEach(m => m.visible = false); churnA.slush.visible = true; churnA.frost.visible = true; churnA.frostM.uniforms.frost.value = 1;
  tableG.visible = false;
  // cream surface inside the seller's can (polar grid, reshaped every frame)
  const R = 0.083, NR = 28, NA = 96; const pos = [], idx = [];
  pos.push(0, 0, 0); for (let r = 1; r <= NR; r++) for (let a = 0; a < NA; a++) { const rr = r / NR * R, aa = a / NA * Math.PI * 2; pos.push(Math.cos(aa) * rr, 0, Math.sin(aa) * rr); }
  for (let a = 0; a < NA; a++) idx.push(0, 1 + (a + 1) % NA, 1 + a);
  for (let r = 1; r < NR; r++) for (let a = 0; a < NA; a++) { const i0 = 1 + (r - 1) * NA + a, i1 = 1 + (r - 1) * NA + (a + 1) % NA, j0 = i0 + NA, j1 = i1 + NA; idx.push(i0, i1, j1, i0, j1, j0); }
  creamGeo = new THREE.BufferGeometry(); creamGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); creamGeo.setIndex(idx);
  cream = new THREE.Mesh(creamGeo, new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.08 }));
  cream.position.set(0, 0.405, 0); churnA.group.add(cream); cream.visible = false;
  // frost creeping round the can rim
  rimFrost = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.104, 64, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { p: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec2 vP; uniform float p; float h(vec2 q){ return fract(sin(dot(q, vec2(127.1,311.7))) * 43758.5453); } float n(vec2 q){ vec2 i=floor(q), f=fract(q); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); } void main(){ float a = atan(vP.y, vP.x) / 6.2831 + .5; float r = length(vP); float edge = p * 1.1 - .05 + (n(vec2(a * 30., r * 300.)) - .5) * .12; float on = smoothstep(a - .015, a + .015, edge); float cr = smoothstep(.5, .85, n(vec2(a * 160., r * 900.))); float al = on * (.45 + .5 * cr); if (al < .03) discard; gl_FragColor = vec4(mix(vec3(.85,.93,.99), vec3(1.), cr), al); }' }));
  rimFrost.rotation.x = -Math.PI / 2; rimFrost.position.set(0, 0.452, 0); churnA.group.add(rimFrost); rimFrost.visible = false;
  // icy mist rising out of the slush
  const NM = 160, mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NM * 3), 3)); mg.setAttribute('a', new THREE.BufferAttribute(new Float32Array(NM), 1)); mg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(NM), 1));
  mistPts = new THREE.Points(mg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: 'attribute float a; attribute float size; varying float vA; void main(){ vA = a; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * (300. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - .5); float m = smoothstep(.5, 0., d); if (m * vA < .01) discard; gl_FragColor = vec4(vec3(.95,.98,1.), m * vA * .55); }' }));
  mistPts.frustumCulled = false; mistPts.userData.seeds = Array.from({ length: NM }, (_, i) => { const r = rng(500 + i); return [r() * 6.28, 0.105 + r() * 0.085, r(), 0.6 + r() * 0.8]; });
  churnA.group.add(mistPts); mistPts.visible = false;
  // the rival's hand-held can, runny cream, splash and puddle
  canProp = new THREE.Group(); scene.add(canProp); canProp.visible = false;
  const steel = new THREE.MeshStandardMaterial({ color: 0xd5d8dc, metalness: 0.45, roughness: 0.35, side: THREE.DoubleSide });
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.42, 32, 1, true), steel); cyl.position.y = 0.21; canProp.add(cyl);
  const bot = new THREE.Mesh(new THREE.CircleGeometry(0.085, 32), steel); bot.rotation.x = -Math.PI / 2; canProp.add(bot);
  const liq = new THREE.Mesh(new THREE.CircleGeometry(0.082, 32), new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.05 })); liq.rotation.x = -Math.PI / 2; liq.position.y = 0.36; canProp.add(liq); canProp.userData.liq = liq;
  canProp.scale.setScalar(CS);
  pour = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.05 })); pour.frustumCulled = false; scene.add(pour); pour.visible = false;
  puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.05 })); puddle.rotation.x = -Math.PI / 2; scene.add(puddle); puddle.visible = false;
  splash = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.05 }), 40); splash.frustumCulled = false; scene.add(splash); splash.visible = false;
}
function hideFinale() { if (!judge) return; judge.group.visible = false; tableG.visible = false; canProp.visible = false; pour.visible = false; puddle.visible = false; splash.visible = false; }

/* ------------------------------------------------ SHOT 6: the judge lifts both lids at once */
function shot6(t) {
  salt.visible = false; if (stream) stream.visible = false;
  churnS.group.visible = churnR.group.visible = false; tableG.visible = true; judge.group.visible = true; prize.group.visible = false;
  seller.group.position.set(-0.82, 0, TZ - 0.42); rival.group.position.set(0.82, 0, TZ - 0.42);
  const wk = clamp(prog(t, 0.0, 1.5)); const jx = lerp(-2.7, 0, easeOut(wk));
  judge.group.position.set(jx, 0, TZ - 0.36);
  const lift = backOut(prog(t, 2.1, 2.5));
  for (const c of [churnA, churnB]) { c.top.position.y = 0.33 * lift; c.top.rotation.z = (c === churnA ? 0.15 : -0.15) * lift; }
  const k = easeInOut(prog(t, 0, 4));
  setCam(L3([0, 1.5, 5.4], [0, 1.48, 5.1], k), [0, 1.3, 1.0], 55);
  scene.updateMatrixWorld(true);
  const knobA = churnA.top.localToWorld(new THREE.Vector3(-0.1, 0.52, 0)), knobB = churnB.top.localToWorld(new THREE.Vector3(0.1, 0.52, 0));
  const reach = smooth(prog(t, 1.55, 2.05));
  const walking = wk < 1;
  judge.draw({ legs: true, walk: walking ? t * 10 : null, face: { look: [walking ? 1 : 0, 0.4], mouth: t > 2.1 ? 'o' : 'smile', raise: 0.5 * lift },
    hands: { l: L3([250, 800], onCard(judge, knobA), reach), r: L3([520, 800], onCard(judge, knobB), reach) }, bend: { l: 0.1, r: -0.1 }, bob: walking ? Math.abs(Math.sin(t * 10)) * 6 : 0 });
  const lean = smooth(prog(t, 2.35, 2.9));
  seller.draw({ legs: true, tilt: 0.12 * lean, head: { dy: 35 * lean }, face: { look: [0.8, 0.7 * lean], mouth: 'flat' }, hands: { l: [250, 780], r: [520, 780] } });
  rival.draw({ legs: true, tilt: -0.14 * lean, head: { dy: 40 * lean }, face: { angry: 0.8, look: [-0.8, 0.7 * lean], mouth: lean > 0.5 ? 'o' : 'grr' }, hands: { l: [250, 760], r: [520, 760] } });
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(0, 1.1, TZ)); bokeh.uniforms.aperture.value = 0.0008;
}

/* ------------------------------------------------ SHOT 7: straight down into the seller's churn */
function shot7(t) {
  salt.visible = false; if (stream) stream.visible = false;
  churnS.group.visible = churnR.group.visible = false; tableG.visible = true; prize.group.visible = false;
  seller.group.visible = rival.group.visible = false;
  churnA.top.visible = false; cream.visible = true; rimFrost.visible = true; mistPts.visible = true;
  rimFrost.material.uniforms.p.value = smooth(prog(t, 0.2, 3.6));
  // cream: runny ripples -> thick -> firm ridged ice cream
  const set = smooth(prog(t, 0.5, 3.5)), R = 0.083; const p = creamGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    const ripple = Math.sin(t * 9 - r * 140) * 0.0016 * (1 - set);
    const dome = (1 - (r / R) ** 2) * 0.03 * set;
    const ridge = Math.max(0, Math.sin(r * 160 + a * 2.0 - 1.0)) ** 1.5 * 0.006 * set * (r / R);
    p.setY(i, ripple + dome + ridge);
  }
  p.needsUpdate = true; creamGeo.computeVertexNormals();
  cream.material.roughness = lerp(0.06, 0.7, set); cream.material.color.setRGB(lerp(0.98, 1.0, set), lerp(0.965, 0.95, set), lerp(0.93, 0.86, set));
  // mist
  const mp = mistPts.geometry.attributes.position.array, ma = mistPts.geometry.attributes.a.array, ms = mistPts.geometry.attributes.size.array;
  mistPts.userData.seeds.forEach(([ang, rad, ph, sp], i) => { const k = (t * 0.35 * sp + ph) % 1; mp[i * 3] = Math.cos(ang + k) * rad; mp[i * 3 + 1] = 0.37 + k * 0.4; mp[i * 3 + 2] = Math.sin(ang + k) * rad; ma[i] = Math.sin(k * Math.PI) * (0.6 + 0.4 * prog(t, 0, 1)); ms[i] = 0.05 + k * 0.12; });
  mistPts.geometry.attributes.position.needsUpdate = mistPts.geometry.attributes.a.needsUpdate = mistPts.geometry.attributes.size.needsUpdate = true;
  camera.up.set(0, 0, -1);
  const cxw = AX, cyw = TY + 0.45 * CS;
  setCam([cxw, cyw + lerp(0.62, 0.5, easeInOut(prog(t, 0, 4))), TZ + 0.0001], [cxw, cyw, TZ], 42);
  camera.up.set(0, 1, 0);
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(cxw, cyw, TZ)); bokeh.uniforms.aperture.value = 0.0015;
}

/* ------------------------------------------------ SHOT 8: runny cream, the soup spoon, the winner's cone */
function shot8(t) {
  salt.visible = false; if (stream) stream.visible = false;
  churnR.group.visible = false; churnS.group.visible = true; judge.group.visible = true; prize.group.visible = false; iceStack.forEach(b => b.visible = false);
  rival.group.position.set(RX, 0, CARD_Z);
  // rival tips the can towards the camera; thin cream pours over the rim onto the counter
  const tip = easeInOut(prog(t, 0.2, 1.1)) * 0.95;
  canProp.visible = true; canProp.position.set(RX - 0.02, COUNTER_Y + 0.28, 0.32); canProp.rotation.set(tip, 0, 0);
  const liq = canProp.userData.liq; liq.visible = true; liq.rotation.x = -Math.PI / 2 - tip; liq.position.set(0, lerp(0.36, 0.3, tip / 0.95), lerp(0, 0.03, tip / 0.95));
  scene.updateMatrixWorld(true);
  const lip = canProp.localToWorld(new THREE.Vector3(0, 0.42, 0.085));
  const impact = new THREE.Vector3(lip.x, COUNTER_Y + 0.002, lip.z + 0.16);
  const flow = smooth(prog(t, 0.75, 1.0)) * (1 - smooth(prog(t, 2.6, 3.1)));
  pour.visible = flow > 0.02;
  if (pour.visible) { const pts = []; for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector3(lip.x + Math.sin(t * 9 + k * 4) * 0.004, lerp(lip.y, impact.y, k), lerp(lip.z, impact.z, Math.sqrt(k)))); } pour.geometry.dispose(); pour.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012 * flow + 0.003, 8); }
  const pr = 0.03 + 0.2 * smooth(prog(t, 0.85, 3.0)); puddle.visible = t > 0.85; puddle.position.copy(impact); puddle.scale.set(pr * 1.2, pr, 1);
  splash.visible = t > 0.85 && t < 3.0; const m4 = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) { const r = rng(900 + i); const ph = ((t * 2.2 + r()) % 1); const a = r() * 6.28, v = 0.25 + r() * 0.3; const x = impact.x + Math.cos(a) * v * ph * 0.35, z = impact.z + Math.sin(a) * v * ph * 0.35, y = impact.y + (v * ph - 2.5 * ph * ph) * 0.35; const sc = 0.006 * (1 - ph) * flow; m4.makeScale(sc, sc, sc).setPosition(x, Math.max(impact.y, y), z); splash.setMatrixAt(i, m4); }
  splash.instanceMatrix.needsUpdate = true;
  // judge steps in from the left and hands over a big silver soup spoon
  const step = easeOut(prog(t, 1.4, 2.3)); judge.group.position.set(lerp(RX - 2.0, RX - 0.72, step), 0, 0.95);
  const give = smooth(prog(t, 2.3, 2.75)), handed = t > 2.8;
  const handL = onCard(rival, canProp.localToWorld(new THREE.Vector3(-0.09, 0.2, 0))), handR = onCard(rival, canProp.localToWorld(new THREE.Vector3(0.09, 0.15, 0)));
  const jHand = L3([520, 800], [700, 600], give);
  judge.draw({ legs: true, walk: step > 0 && step < 1 ? t * 10 : null, face: { look: [1, 0], mouth: 'smile' }, hands: { l: [250, 800], r: handed ? L3([700, 600], [520, 800], smooth(prog(t, 2.8, 3.2))) : jHand }, bend: { l: 0.1, r: -0.15 },
    prop: handed ? null : (g => drawSpoon(g, jHand[0], jHand[1], 0.5)) });
  // rival: tipping, then takes the spoon and freezes, moustache drooping
  const freeze = smooth(prog(t, 2.9, 3.4));
  const spoonHand = handed ? [lerp(560, 600, freeze), lerp(700, 640, freeze)] : handR;
  rival.draw({ legs: false, face: { angry: lerp(0.8, -0.6, freeze), look: handed ? [0.5, 0.5] : [0, 0.6], mouth: freeze > 0.5 ? 'o' : (t > 0.9 ? 'grr' : 'smile') },
    stacheRot: 0.4 * freeze, stache: 10 * freeze, head: { dy: 8 * freeze },
    hands: { l: handL, r: spoonHand }, bend: { l: 0.15, r: -0.1 }, prop: handed ? (g => drawSpoon(g, spoonHand[0], spoonHand[1], -0.2)) : null });
  // seller in the background, holding up a tall firm cone, the rosette pinned to his apron
  seller.group.position.set(RX + 1.12, 0, -0.45);
  const up = backOut(prog(t, 0.1, 0.6));
  const coneHand = [560, lerp(700, 420, up)];
  seller.draw({ legs: true, face: { look: [0, 0], mouth: 'smile', raise: 0.3 }, hands: { l: [250, 790], r: coneHand }, bend: { l: 0.1, r: -0.2 },
    prop: g => { drawRosette(g, 300, 660, 0.9); drawCone(g, coneHand[0], coneHand[1] - 40); } });
  setCam(L3([RX + 0.08, 1.45, 3.95], [RX + 0.06, 1.45, 3.75], easeInOut(prog(t, 0, 5))), [RX + 0.1, 1.25, 0.25], 58);
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(RX, 1.2, 0.3)); bokeh.uniforms.aperture.value = 0.0012;
}

async function setup() {
  await document.fonts.load('900 100px Inter');
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45; }
  fair = buildFair(); scene.add(fair.group); scene.fog = fair.fog;
  mkStall(scene, SX, 0, '#3b7fd1', { seed: 2, w: 1.9, counterY: 0.6, barrelSide: -1 }); mkStall(scene, RX, 0, '#d32b2b', { seed: 3, w: 1.9, counterY: 0.6, barrelSide: 1 });
  // stacked ice blocks on the rival's stall
  const iceM = new THREE.MeshPhysicalMaterial({ color: 0xcdeeff, roughness: 0.1, transparent: true, opacity: 0.82, clearcoat: 1, envMapIntensity: 1.6 });
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), iceM); b.position.set(RX + 0.6 + (i % 2) * 0.24, COUNTER_Y + 0.1 + Math.floor(i / 2) * 0.2, 0.42 - (i % 2) * 0.05); b.castShadow = true; scene.add(b); iceStack.push(b); }
  churnS = mkChurn(scene, [SX + CHX, COUNTER_Y, CHURN_Z], 4, CS); churnR = mkChurn(scene, [RX - CHX, COUNTER_Y, CHURN_Z], 5, CS); churnR.group.rotation.y = Math.PI;
  prize = mkPrizeTable(scene, [0, 0, 1.75]);
  seller = makeToon('seller'); rival = makeToon('rival');
  seller.group.position.set(SX, 0, CARD_Z); rival.group.position.set(RX, 0, CARD_Z);
  scene.add(seller.group, rival.group);
  initSalt();
  setupFinale();
  cart = mkIceCart(scene, '300'); cart.group.visible = false;
  [FG[2], FG[1]].forEach(v => { const f = makeToon('fairgoer', v); f.group.visible = false; scene.add(f.group); fg5.push(f); });
  FG.forEach(v => { const f = makeToon('fairgoer', v); f.group.scale.setScalar(0.9); f.group.visible = false; scene.add(f.group); fairgoers.push(f); });
  composer = new EffectComposer(renderer); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  bokeh = new BokehPass(scene, camera, { focus: 2.0, aperture: 0.002, maxblur: 0.008 }); composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  renderFrame(0); return 150;
}
function renderAt(t) {
  fair.update(t);
  SACK = null; POUR0 = 1.5; POUR1 = 3.75; cart.group.visible = false; fairgoers.forEach(f => f.group.visible = false); fg5.forEach(f => f.group.visible = false);
  churnS.iceBits.forEach(m => m.visible = true); churnS.slush.visible = false; churnS.frost.visible = false;
  hideFinale(); iceStack.forEach(b => b.visible = true); churnS.group.visible = churnR.group.visible = true; prize.group.visible = true; seller.group.visible = rival.group.visible = true; seller.group.scale.y = 1;
  seller.group.position.set(SX, 0, CARD_Z); rival.group.position.set(RX, 0, CARD_Z); rival.group.scale.y = 1; seller.group.rotation.z = 0; rival.group.rotation.z = 0;
  if (window.SHOT === 2) shot2(t); else if (window.SHOT === 3) shot3(t); else if (window.SHOT === 4) shot4(t * 1.25); else if (window.SHOT === 5) shot5(t * 0.8); else if (window.SHOT === 6) shot6(t); else if (window.SHOT === 7) shot7(t); else if (window.SHOT === 8) shot8(t);   // authored for 5 s, played over 4 s else shot1(t);
  composer.render();
  ctx.drawImage(renderer.domElement, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,0,0.28)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function renderFrame(f) { renderAt(f / FPS); return out.toDataURL('image/jpeg', 0.93); }
window.DBG = () => { const a = saltGeo.attributes.position.array, z = saltGeo.attributes.size.array; const out = []; for (let i = 0; i < 1500; i += 250) out.push([a[i*3].toFixed(2), a[i*3+1].toFixed(2), a[i*3+2].toFixed(2), z[i].toFixed(3)]); return { vis: salt.visible, out }; };
window.setupScene = setup; window.renderFrame = renderFrame; window.SHOT = 1; window.ready = true;
