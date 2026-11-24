// The sunny country fair: ground, grass, hills, trees, stalls, bunting, props.
import * as THREE from 'three';
import { mat, mesh, pivot, canvasTex, rng, clamp } from './util.js';

function woodTex(base = [150, 104, 62], seed = 1, planks = 6, rep = [1, 1]) {
  return canvasTex(512, 512, (c, w, h) => {
    const r = rng(seed); const ph = h / planks;
    for (let i = 0; i < planks; i++) {
      const k = 0.85 + r() * 0.3; c.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`; c.fillRect(0, i * ph, w, ph);
      for (let j = 0; j < 40; j++) { c.strokeStyle = `rgba(60,35,15,${0.08 + r() * 0.15})`; c.lineWidth = 1 + r() * 2; c.beginPath(); const y = i * ph + r() * ph; c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + r() * 6 - 3, w * 0.6, y + r() * 6 - 3, w, y + r() * 4 - 2); c.stroke(); }
      c.fillStyle = 'rgba(40,22,8,0.7)'; c.fillRect(0, i * ph, w, 3);
      if (r() < 0.6) { c.fillStyle = 'rgba(50,28,10,0.5)'; c.beginPath(); c.ellipse(r() * w, i * ph + ph / 2, 8, 5, 0, 0, 7); c.fill(); }
    }
  }, { repeat: rep });
}
function stripeTex(col, n = 8) {
  return canvasTex(512, 512, (c, w, h) => { for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#f7f3ea' : col; c.fillRect(i * w / n, 0, w / n, h); } c.fillStyle = 'rgba(0,0,0,0.05)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1); });
}
function valanceTex(col, n = 8) {
  return canvasTex(512, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#f7f3ea' : col; c.fillRect(i * w / n, 0, w / n, h * 0.55); }
    const sc = w / n; for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#f7f3ea' : col; c.beginPath(); c.arc(i * sc + sc / 2, h * 0.55, sc / 2, 0, Math.PI); c.fill(); }
  });
}

export function buildFair() {
  const g = new THREE.Group();
  const r = rng(5);
  // sky dome with soft clouds
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
      void main(){ vec3 d = normalize(vP); float y = d.y;
        vec3 col = mix(vec3(.80,.89,.98), vec3(.22,.50,.92), smoothstep(.0,.55,y));
        vec2 uv = d.xz / max(.08, y + .12) * 1.4;
        float c = smoothstep(.52, .78, fbm(uv * .9 + 3.)) * smoothstep(.02, .2, y);
        col = mix(col, vec3(1.), c * .9);
        gl_FragColor = vec4(col, 1.); }` }));
  g.add(sky);
  // ground: dirt fairground in the middle, grass around
  const dirt = canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = '#a8845a'; c.fillRect(0, 0, w, h); const rr = rng(9);
    for (let i = 0; i < 14000; i++) { const v = rr(); c.fillStyle = `rgba(${110 + v * 70},${82 + v * 50},${52 + v * 30},0.45)`; c.fillRect(rr() * w, rr() * h, 1 + rr() * 3, 1 + rr() * 3); }
    for (let i = 0; i < 900; i++) { const x = rr() * w, y = rr() * h, s = 1.5 + rr() * 3.5; c.fillStyle = `rgba(${130 + rr() * 50},${120 + rr() * 40},${105 + rr() * 30},0.95)`; c.beginPath(); c.ellipse(x, y, s, s * 0.8, rr() * 3, 0, 7); c.fill(); c.fillStyle = 'rgba(40,30,20,0.25)'; c.beginPath(); c.ellipse(x + 1, y + s * 0.6, s, s * 0.3, 0, 0, 7); c.fill(); }
    for (let i = 0; i < 700; i++) { c.strokeStyle = `rgba(${80 + rr() * 60},${120 + rr() * 50},${40},0.7)`; c.lineWidth = 1.2; const x = rr() * w, y = rr() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rr() * 4 - 2, y - 4 - rr() * 6); c.stroke(); }
  }, { repeat: [16, 16] });
  mesh(new THREE.PlaneGeometry(60, 60), mat(0xffffff, { map: dirt, roughness: 1 }), g, [0, 0, 0], [-Math.PI / 2, 0, 0]).castShadow = false;
  const grassRing = canvasTex(1024, 1024, (c, w, h) => {
    const rr = rng(4); c.clearRect(0, 0, w, h);
    for (let i = 0; i < 60000; i++) { const x = rr() * w, y = rr() * h; const d = Math.hypot(x - w / 2, y - h / 2) / (w / 2); const p = Math.min(1, Math.max(0, (d - 0.3) / 0.12)); if (rr() > p) continue; c.fillStyle = `rgba(${70 + rr() * 50},${115 + rr() * 50},${35 + rr() * 25},0.9)`; c.fillRect(x, y, 2, 2 + rr() * 3); }
  });
  { const gm = mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: grassRing, transparent: true, roughness: 1, depthWrite: false }), g, [0, 0.005, 0], [-Math.PI / 2, 0, 0]); gm.castShadow = false; }
  const far = mesh(new THREE.PlaneGeometry(800, 800), mat(0x77984a, { roughness: 1 }), g, [0, -0.02, 0], [-Math.PI / 2, 0, 0]); far.castShadow = false;
  // grass blades (instanced), denser at the edges of the dirt
  const blade = new THREE.PlaneGeometry(0.035, 0.22, 1, 2); blade.translate(0, 0.11, 0);
  { const p = blade.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.2) p.setX(i, 0); p.setZ(i, y * y * 0.6); } blade.computeVertexNormals(); }
  const grassM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: false, roughness: 0.9, side: THREE.DoubleSide });
  const N = 26000; const im = new THREE.InstancedMesh(blade, grassM, N); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  let k = 0;
  for (let i = 0; i < N * 3 && k < N; i++) {
    const x = (r() - 0.5) * 30, z = (r() - 0.5) * 30; const d = Math.hypot(x, z) / 10.8;
    if (d < 0.75 && r() > 0.06) continue; if (d < 0.95 && r() > 0.5) continue;
    q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.4)); const s = 0.6 + r() * 1.1;
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(k, m4);
    im.setColorAt(k, col.setHSL(0.22 + r() * 0.07, 0.55, 0.28 + r() * 0.18)); k++;
  }
  im.count = k; im.receiveShadow = true; g.add(im);
  // rolling hills (hazed by fog)
  const hillM = mat(0x5f8f3c, { roughness: 1 });
  for (let i = 0; i < 14; i++) { const a = -1.3 + (i / 13) * 2.6 + Math.PI, d = 70 + r() * 70; const x = Math.sin(a) * d, z = Math.cos(a) * d; const s = 30 + r() * 30; mesh(new THREE.SphereGeometry(1, 48, 24), i % 3 ? hillM : mat(0x6e9c45, { roughness: 1 }), g, [x, -s * 0.82, z], null, [s * 1.8, s, s * 1.3]).castShadow = false; }
  // trees: bark trunk + leafy clusters
  const bark = canvasTex(128, 512, (c, w, h) => { c.fillStyle = '#5b4330'; c.fillRect(0, 0, w, h); const rr = rng(3); for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(30,20,12,${0.3 + rr() * 0.4})`; c.lineWidth = 2 + rr() * 3; c.beginPath(); const x = rr() * w; c.moveTo(x, 0); c.lineTo(x + rr() * 10 - 5, h); c.stroke(); } }, { repeat: [2, 2] });
  const trunkM = mat(0xffffff, { map: bark, roughness: 1 });
  const leafCols = [0x4f8a2e, 0x5f9c35, 0x3f7426, 0x6cab3c];
  const leafTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); const rr = rng(21); for (let i = 0; i < 900; i++) { const v = 150 + rr() * 105; c.fillStyle = `rgb(${v},${v},${v})`; c.beginPath(); c.ellipse(rr() * w, rr() * h, 3 + rr() * 6, 2 + rr() * 4, rr() * 3, 0, 7); c.fill(); } }, { repeat: [3, 3] });
  const leafMats = {}; const leafMat = (col) => leafMats[col] ??= mat(col, { map: leafTex, roughness: 0.9 });
  const mkTree = (x, z, s, seed) => {
    const t = pivot(g, [x, 0, z]); t.scale.setScalar(s); const rr = rng(seed);
    mesh(new THREE.CylinderGeometry(0.22, 0.35, 3.2, 10), trunkM, t, [0, 1.6, 0]);
    for (let b = 0; b < 3; b++) { const a = rr() * 6.28; mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 6), trunkM, t, [Math.cos(a) * 0.5, 2.8, Math.sin(a) * 0.5], [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]); }
    for (let i = 0; i < 22; i++) {
      const geo = new THREE.IcosahedronGeometry(0.75 + rr() * 0.6, 3); const p = geo.attributes.position;
      for (let v = 0; v < p.count; v++) { const f = 1 + (rr() - 0.5) * 0.35; p.setXYZ(v, p.getX(v) * f, p.getY(v) * f, p.getZ(v) * f); } geo.computeVertexNormals();
      const a = rr() * 6.28, rad = rr() * 1.7;
      mesh(geo, leafMat(leafCols[i % 4], seed + i), t, [Math.cos(a) * rad, 3.4 + rr() * 1.6, Math.sin(a) * rad]);
    }
    return t;
  };
  mkTree(-6.5, -5.5, 1.3, 11); mkTree(7.5, -7, 1.1, 12); mkTree(-12, -14, 1.2, 13); mkTree(13, -15, 1.3, 14); mkTree(-3, -18, 1.0, 15); mkTree(4, -22, 1.2, 16); mkTree(-18, -6, 1.1, 17);
  // fence in the distance
  const fenceWood = mat(0x8a6a48, { roughness: 1 });
  for (let i = -12; i <= 12; i++) { mesh(new THREE.BoxGeometry(0.09, 1.0, 0.09), fenceWood, g, [i * 1.6, 0.5, -11]); }
  for (const y of [0.45, 0.85]) mesh(new THREE.BoxGeometry(39, 0.08, 0.05), fenceWood, g, [0, y, -11]);
  // background stalls (purple, yellow, green awnings)
  const bgCols = ['#8a4fc9', '#e0b127', '#3a9a5a', '#e06a2a'];
  for (let i = 0; i < 4; i++) { const x = -9 + i * 6 + (i > 1 ? 3 : 0), z = -8 - (i % 2) * 2; mkStall(g, x, z, bgCols[i], { small: true, seed: 30 + i }); }
  // bunting overhead
  const bunting = [];
  const flagCols = [0xd73a3a, 0xf0c22b, 0x3a7fd6, 0x45a858, 0xf07a2b, 0xffffff];
  const mkBunting = (a, b, sag, seed) => {
    const rr = rng(seed); const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const n = Math.floor(A.distanceTo(B) / 0.45);
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; const p = A.clone().lerp(B, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.008, 4), mat(0xeeeeee), g);
    for (let i = 1; i < n; i++) {
      const t = i / n; const p = A.clone().lerp(B, t); p.y -= sag * 4 * t * (1 - t);
      const sh = new THREE.Shape(); sh.moveTo(-0.14, 0); sh.lineTo(0.14, 0); sh.lineTo(0, -0.3); sh.closePath();
      const f = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: flagCols[(i + seed) % flagCols.length], side: THREE.DoubleSide, roughness: 0.8 }));
      f.position.copy(p); f.lookAt(p.x + (B.z - A.z), p.y, p.z - (B.x - A.x)); f.castShadow = true; g.add(f); bunting.push({ f, ph: rr() * 6 });
    }
  };
  mkBunting([-4.5, 3.6, -1.5], [4.5, 3.6, -1.5], 0.5, 1);
  mkBunting([-4.5, 3.8, 1.5], [4.5, 3.8, 1.5], 0.55, 2);
  mkBunting([-4.5, 3.6, -1.5], [-4.5, 3.8, 1.5], 0.2, 3);
  mkBunting([4.5, 3.6, -1.5], [4.5, 3.8, 1.5], 0.2, 4);
  for (const [x, z] of [[-4.5, -1.5], [4.5, -1.5], [-4.5, 1.5], [4.5, 1.5]]) mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.9, 8), fenceWood, g, [x, 1.95, z]);
  // light
  const sun = new THREE.DirectionalLight(0xfff1d6, 3.2); sun.position.set(6, 10, 7); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  g.add(sun, sun.target);
  g.add(new THREE.HemisphereLight(0xcfe4ff, 0x7a6a45, 1.05));
  return { group: g, bunting, sun, fog: new THREE.Fog(0xcfe0ef, 25, 150), update(t) { bunting.forEach(({ f, ph }) => { f.rotation.x = Math.sin(t * 2.2 + ph) * 0.18; }); } };
}

// a wooden market stall with a striped awning; front faces +z
export function mkStall(parent, x, z, col, o = {}) {
  const s = pivot(parent, [x, 0, z]); const rr = rng(o.seed ?? 1); const sc = o.small ? 0.9 : 1; s.scale.setScalar(sc);
  const wood = mat(0xffffff, { map: woodTex([150, 104, 62], o.seed ?? 1, 5, [1, 1]), roughness: 0.85 });
  const W = o.w ?? 2.2, D = 1.0;
  for (const [px, pz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) mesh(new THREE.BoxGeometry(0.1, 2.5, 0.1), wood, s, [px, 1.25, pz]);
  // counter: front panel + top
  const CY = o.counterY ?? 0.75;
  mesh(new THREE.BoxGeometry(W + 0.1, CY - 0.03, 0.08), wood, s, [0, (CY - 0.03) / 2, D / 2 + 0.02]);
  mesh(new THREE.BoxGeometry(W + 0.25, 0.07, 0.6), mat(0xffffff, { map: woodTex([170, 120, 72], (o.seed ?? 1) + 5, 4), roughness: 0.75 }), s, [0, CY - 0.0, D / 2 - 0.15]);
  mesh(new THREE.BoxGeometry(W, 0.06, 0.4), wood, s, [0, 1.6, -D / 2 + 0.2]); // back shelf
  // awning: sloped striped roof + scalloped valance
  const aw = mesh(new THREE.PlaneGeometry(W + 0.5, 1.6), mat(0xffffff, { map: stripeTex(col), roughness: 0.9, side: THREE.DoubleSide }), s, [0, 2.65, 0.15], [-Math.PI / 2 + 0.38, 0, 0]);
  const val = mesh(new THREE.PlaneGeometry(W + 0.5, 0.32), new THREE.MeshStandardMaterial({ map: valanceTex(col), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }), s, [0, 2.24, 0.9]);
  // goods: barrels, crates, fruit baskets
  if (!o.bare) {
    const barrelM = mat(0xffffff, { map: woodTex([140, 95, 55], (o.seed ?? 1) + 9, 10), roughness: 0.9 });
    const bx = (o.barrelSide ?? 1) * (W / 2 + 0.45);
    mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.75, 16), barrelM, s, [bx, 0.375, 0.3]);
    for (const y of [0.15, 0.6]) mesh(new THREE.TorusGeometry(0.275, 0.015, 6, 24), mat(0x3a3a3a, { metalness: 0.6, roughness: 0.5 }), s, [bx, y, 0.3], [Math.PI / 2, 0, 0]);
    const fruit = [0xe8442e, 0xf08a1e, 0x8cc63f, 0xf2c22e];
    for (let i = 0; i < 14; i++) mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(fruit[i % 4], { roughness: 0.5 }), s, [-W / 2 + 0.2 + (i % 7) * 0.13, 1.68, -D / 2 + 0.15 + Math.floor(i / 7) * 0.12]);
  }
  return s;
}

// wooden bucket ice-cream churn: ice chunks around a metal can, crank on top. Returns the crank pivot.
export function mkChurn(parent, pos, seed = 1, scale = 1.5) {
  const c = pivot(parent, pos); c.scale.setScalar(scale); const rr = rng(seed); const iceBits = [];
  const stave = mat(0xffffff, { map: canvasTex(512, 256, (g, w, h) => { const r2 = rng(seed + 3); for (let i = 0; i < 16; i++) { const k = 0.85 + r2() * 0.3; g.fillStyle = `rgb(${165 * k | 0},${112 * k | 0},${64 * k | 0})`; g.fillRect(i * w / 16, 0, w / 16, h); g.fillStyle = 'rgba(40,22,8,0.6)'; g.fillRect(i * w / 16, 0, 2, h); for (let j = 0; j < 6; j++) { g.strokeStyle = `rgba(70,40,15,${0.15})`; g.beginPath(); const x = i * w / 16 + r2() * w / 16; g.moveTo(x, 0); g.lineTo(x + r2() * 4 - 2, h); g.stroke(); } } }), roughness: 0.8 });
  mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.36, 24, 1, true), stave, c, [0, 0.18, 0]);
  mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24), stave, c, [0, 0.01, 0]);
  const iron = mat(0x2f2f2f, { metalness: 0.7, roughness: 0.4 });
  for (const y of [0.06, 0.3]) mesh(new THREE.TorusGeometry(0.19 - (0.3 - y) * 0.06, 0.009, 6, 32), iron, c, [0, y, 0], [Math.PI / 2, 0, 0]);
  // metal can
  const steel = mat(0xc9ccd0, { metalness: 0.85, roughness: 0.25 });
  mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.42, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide }), c, [0, 0.24, 0]);
  mesh(new THREE.CircleGeometry(0.085, 32), steel, c, [0, 0.03, 0], [-Math.PI / 2, 0, 0]);

  // ice chunks filling the gap, heaped a little over the rim
  const ice = new THREE.MeshPhysicalMaterial({ color: 0xb9dff2, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.86, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4, emissive: 0x8fc9ea, emissiveIntensity: 0.08 });
  for (let i = 0; i < 60; i++) {
    const a = rr() * 6.28, d = 0.1 + rr() * 0.085, y = 0.3 + rr() * 0.15;
    const geo = new THREE.IcosahedronGeometry(0.028 + rr() * 0.014, 1); const p = geo.attributes.position; for (let v = 0; v < p.count; v++) p.setXYZ(v, p.getX(v) * (0.8 + rr() * 0.5), p.getY(v) * (0.7 + rr() * 0.5), p.getZ(v) * (0.8 + rr() * 0.5)); geo.computeVertexNormals();
    iceBits.push(mesh(geo, ice, c, [Math.cos(a) * d, y, Math.sin(a) * d], [rr() * 3, rr() * 3, rr() * 3]));
  }
  // melted state: grey watery slush with a few half-melted lumps (hidden until used)
  const slush = pivot(c);
  mesh(new THREE.CircleGeometry(0.2, 40), new THREE.MeshStandardMaterial({ color: 0x6c7479, roughness: 0.15, metalness: 0.1, envMapIntensity: 1.4 }), slush, [0, 0.356, 0], [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 9; i++) { const a = rr() * 6.28, d = 0.1 + rr() * 0.07; mesh(new THREE.SphereGeometry(0.018 + rr() * 0.012, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc7cfd3, roughness: 0.3, transparent: true, opacity: 0.85 }), slush, [Math.cos(a) * d, 0.358, Math.sin(a) * d], null, [1, 0.45, 1]); }
  slush.visible = false;
  // frost creeping up the outside of the staves: a shell whose frost line rises with uniforms.frost (0..1)
  const frostM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { frost: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; varying vec3 vP; uniform float frost;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        vec2 q = vec2(vUv.x * 40., vUv.y * 12.);
        float edge = frost * 1.15 - .05 + (n(q * .8) - .5) * .18;           // ragged frost line
        float below = smoothstep(vUv.y - .02, vUv.y + .02, edge);
        float dens = clamp((edge - vUv.y) * 4. + .35, 0., 1.);               // thicker lower down
        float crystals = smoothstep(.55, .85, n(q * 3.1)) * .8 + smoothstep(.75, .95, n(q * 9.3 + 7.)) ;
        float a = below * (dens * .55 + crystals * .5);
        vec3 c = mix(vec3(.86,.93,.98), vec3(1.), crystals);
        if (a < .02) discard; gl_FragColor = vec4(c, clamp(a, 0., .95)); }` });
  const frost = mesh(new THREE.CylinderGeometry(0.203, 0.173, 0.36, 48, 1, true), frostM, c, [0, 0.18, 0]); frost.castShadow = false;
  frost.visible = false;

  // crank frame across the top + gear box + crank arm on the +x side
  const frameM = mat(0x8a6038, { roughness: 0.8 });
  const top = pivot(c);
  mesh(new THREE.BoxGeometry(0.46, 0.035, 0.05), frameM, top, [0, 0.5, 0]);
  mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 16), iron, top, [0, 0.53, 0]);
  mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.025, 24), steel, top, [0, 0.462, 0]);
  for (const x of [-0.21, 0.21]) mesh(new THREE.BoxGeometry(0.03, 0.12, 0.04), frameM, top, [x, 0.44, 0]);
  const crank = pivot(top, [0.25, 0.53, 0]); crank.rotation.order = 'ZXY';
  const arm = pivot(crank); // spins about x
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), iron, arm, [0.03, 0, 0], [0, 0, Math.PI / 2]);
  mesh(new THREE.BoxGeometry(0.02, 0.15, 0.02), iron, arm, [0.06, 0.07, 0]);
  const knob = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 10), frameM, arm, [0.1, 0.14, 0], [0, 0, Math.PI / 2]);
  return { group: c, arm, knob, iceBits, slush, frost, frostM, top };
}

// small table with a velvet cushion and a gold rosette
export function mkPrizeTable(parent, pos) {
  const t = pivot(parent, pos);
  const wood = mat(0xffffff, { map: woodTex([160, 112, 66], 77, 4), roughness: 0.8 });
  mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 28), wood, t, [0, 0.8, 0]);
  mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.78, 10), wood, t, [0, 0.4, 0]);
  mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.03, 16), wood, t, [0, 0.015, 0]);
  const velvet = mat(0x8a1230, { roughness: 1 });
  const cush = mesh(new THREE.SphereGeometry(0.2, 24, 12), velvet, t, [0, 0.86, 0], null, [1.15, 0.28, 1.0]);
  for (const [x, z] of [[-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18]]) mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(0xe2b23a, { metalness: 0.6, roughness: 0.4 }), t, [x, 0.86, z]);
  // rosette: pleated gold ring, centre medal, two ribbon tails
  const ros = pivot(t, [0, 0.93, 0]); ros.rotation.x = -1.15;
  const gold = mat(0xf2c12e, { metalness: 0.35, roughness: 0.45 });
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; mesh(new THREE.BoxGeometry(0.035, 0.07, 0.008), gold, ros, [Math.cos(a) * 0.075, Math.sin(a) * 0.075, (i % 2) * 0.004], [0, 0, a + Math.PI / 2]); }
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24), mat(0xffd64a, { metalness: 0.7, roughness: 0.3 }), ros, [0, 0, 0.01], [Math.PI / 2, 0, 0]);
  mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.014, 24), mat(0xe8a91f, { metalness: 0.8, roughness: 0.25 }), ros, [0, 0, 0.015], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(-0.025, 0); sh.lineTo(0.025, 0); sh.lineTo(0.025, -0.16); sh.lineTo(0, -0.13); sh.lineTo(-0.025, -0.16); sh.closePath(); mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: 0xf2c12e, side: THREE.DoubleSide, roughness: 0.6 }), ros, [s * 0.03, -0.06, -0.004], [0, 0, s * 0.25]); }
  return { group: t, rosette: ros };
}

// wooden hand cart piled with big clear ice blocks and a painted sign. Faces +x (rolls along x). Returns wheels to spin.
export function mkIceCart(parent, num = '300') {
  const c = pivot(parent); const rr = rng(88);
  const wood = mat(0xffffff, { map: woodTex([150, 104, 62], 61, 6), roughness: 0.85 });
  mesh(new THREE.BoxGeometry(1.7, 0.08, 1.0), wood, c, [0, 0.62, 0]);
  for (const z of [-0.5, 0.5]) mesh(new THREE.BoxGeometry(1.7, 0.22, 0.05), wood, c, [0, 0.77, z]);
  for (const x of [-0.85, 0.85]) mesh(new THREE.BoxGeometry(0.05, 0.22, 1.0), wood, c, [x, 0.77, 0]);
  for (const z of [-0.35, 0.35]) mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), wood, c, [1.3, 0.75, z], [0, 0, Math.PI / 2 + 0.25]);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), wood, c, [1.75, 0.87, 0], [Math.PI / 2, 0, 0]);
  const wheels = [];
  for (const z of [-0.56, 0.56]) {
    const w = pivot(c, [0.1, 0.36, z]);
    mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 28), mat(0x5a3d22, { roughness: 0.9 }), w);
    for (let i = 0; i < 8; i++) mesh(new THREE.BoxGeometry(0.03, 0.66, 0.03), wood, w, [0, 0, 0], [0, 0, i * Math.PI / 8]);
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), mat(0x3a3a3a, { metalness: 0.6, roughness: 0.4 }), w, [0, 0, 0], [Math.PI / 2, 0, 0]);
    wheels.push(w);
  }
  const ice = new THREE.MeshPhysicalMaterial({ color: 0x9fd3ee, roughness: 0.08, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.8, emissive: 0x9fd4ff, emissiveIntensity: 0.06 });
  const layers = [[3, 2], [3, 2], [2, 2], [1, 1]];
  layers.forEach(([nx, nz], L) => { for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const b = mesh(new THREE.BoxGeometry(0.46, 0.34, 0.4), ice, c, [(i - (nx - 1) / 2) * 0.5 + (rr() - 0.5) * 0.03, 0.85 + L * 0.35, (j - (nz - 1) / 2) * 0.43], [0, (rr() - 0.5) * 0.08, 0]); } });
  // sign on a post
  const signTex = canvasTex(512, 256, (g, w, h) => { const r2 = rng(4); for (let i = 0; i < 3; i++) { const k = 0.85 + r2() * 0.3; g.fillStyle = `rgb(${190 * k | 0},${140 * k | 0},${85 * k | 0})`; g.fillRect(0, i * h / 3, w, h / 3); g.fillStyle = 'rgba(60,35,15,0.6)'; g.fillRect(0, i * h / 3, w, 4); } g.strokeStyle = '#3a2412'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); g.font = '900 170px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2a1a0c'; g.fillText(num, w / 2, h / 2 + 8); });
  mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), wood, c, [0.35, 1.15, 0.52]);
  mesh(new THREE.BoxGeometry(0.62, 0.32, 0.03), mat(0xffffff, { map: signTex, roughness: 0.8 }), c, [0.35, 1.55, 0.55]);
  return { group: c, wheels };
}
