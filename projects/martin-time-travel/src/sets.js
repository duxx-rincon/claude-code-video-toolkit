// Sets: Martin's room, space + globe, the Cretaceous swamp, the modern dig site.
import * as THREE from 'three';
import { mat, mesh, pivot, canvasTex, rng, clamp, lerp } from './util.js';
import * as topojson from '/node_modules/topojson-client/src/index.js';

/* ------------------------------------------------------------------ ROOM */
export function buildRoom() {
  const g = new THREE.Group();
  const W = 5.2, D = 5, Hh = 2.8;
  const wallTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#6b6435'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { c.fillStyle = '#5a5329'; c.fillRect(x, 0, 18, h); c.fillStyle = '#77703f'; c.fillRect(x + 40, 0, 4, h); }
    c.fillStyle = 'rgba(150,135,80,0.45)';
    for (let y = 16; y < h; y += 64) for (let x = 30; x < w; x += 64) { c.beginPath(); c.ellipse(x + ((y / 64) % 2) * 0, y, 9, 13, 0, 0, 7); c.fill(); }
    const r = rng(2); for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(0,0,0,${r() * 0.06})`; c.fillRect(r() * w, r() * h, 2, 2); }
  }, { repeat: [3, 1.6] });
  const floorTex = canvasTex(512, 512, (c, w, h) => {
    const r = rng(4);
    for (let y = 0; y < h; y += 32) { let x = -r() * 200; while (x < w) { const l = 120 + r() * 180; const v = 90 + r() * 30; c.fillStyle = `rgb(${v + 40},${v - 5},${v - 45})`; c.fillRect(x, y, l, 31); c.fillStyle = 'rgba(40,20,5,0.6)'; c.fillRect(x, y + 31, l, 1); c.fillRect(x, y, 1, 32); for (let k = 0; k < 6; k++) { c.fillStyle = `rgba(60,30,10,${r() * 0.15})`; c.fillRect(x, y + r() * 30, l, 1); } x += l; } }
  }, { repeat: [3, 3] });
  const wallM = mat(0xffffff, { map: wallTex, roughness: 0.9 });
  mesh(new THREE.PlaneGeometry(W, D), mat(0xffffff, { map: floorTex, roughness: 0.6 }), g, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  mesh(new THREE.PlaneGeometry(W, Hh), wallM, g, [0, Hh / 2, -D / 2]);
  mesh(new THREE.PlaneGeometry(D, Hh), wallM, g, [-W / 2, Hh / 2, 0], [0, Math.PI / 2, 0]);
  mesh(new THREE.PlaneGeometry(D, Hh), wallM, g, [W / 2, Hh / 2, 0], [0, -Math.PI / 2, 0]);
  mesh(new THREE.PlaneGeometry(W, D), mat(0x4a3a26, { roughness: 1 }), g, [0, Hh, 0], [Math.PI / 2, 0, 0]);
  // front wall (behind the camera, for bounce light / reverse shots)
  mesh(new THREE.PlaneGeometry(W, Hh), wallM, g, [0, Hh / 2, D / 2], [0, Math.PI, 0]);
  // skirting
  const wood = mat(0x5b3418, { roughness: 0.7 });
  mesh(new THREE.BoxGeometry(W, 0.1, 0.03), wood, g, [0, 0.05, -D / 2 + 0.015]);
  mesh(new THREE.BoxGeometry(0.03, 0.1, D), wood, g, [-W / 2 + 0.015, 0.05, 0]);
  mesh(new THREE.BoxGeometry(0.03, 0.1, D), wood, g, [W / 2 - 0.015, 0.05, 0]);
  // rug
  const rugTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#8e2a1e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d9a75a'; c.lineWidth = 10; c.strokeRect(22, 22, w - 44, h - 44); c.lineWidth = 4; c.strokeRect(40, 40, w - 80, h - 80);
    const n = 8, s = (w - 120) / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = (i + j) % 2 ? '#c9774a' : '#a4402c'; c.fillRect(60 + i * s, 60 + j * s, s, s); }
  });
  mesh(new THREE.BoxGeometry(2.4, 0.012, 1.8), mat(0xffffff, { map: rugTex, roughness: 1 }), g, [0.2, 0.006, 0.3]);
  // bed (left wall)
  const bed = pivot(g, [-1.75, 0, -0.9]);
  mesh(new THREE.BoxGeometry(1.1, 0.32, 2.1), wood, bed, [0, 0.16, 0]);
  mesh(new THREE.BoxGeometry(1.0, 0.16, 2.0), mat(0xf1efe6, { roughness: 0.9 }), bed, [0, 0.4, 0]);
  const blanketTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#23468e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3460b0'; c.lineWidth = 6; for (let y = 10; y < h; y += 34) { c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x / 20) * 6); c.stroke(); } });
  mesh(new THREE.BoxGeometry(1.04, 0.06, 1.45), mat(0xffffff, { map: blanketTex, roughness: 0.95 }), bed, [0, 0.5, 0.3]);
  mesh(new THREE.BoxGeometry(1.1, 0.9, 0.08), wood, bed, [0, 0.45, -1.05]);
  mesh(new THREE.CapsuleGeometry(0.13, 0.55, 6, 12), mat(0xf6f3ea, { roughness: 0.95 }), bed, [0, 0.58, -0.75], [0, 0, Math.PI / 2]);
  // desk + CRT (back wall)
  const desk = pivot(g, [0.25, 0, -2.15]);
  mesh(new THREE.BoxGeometry(1.5, 0.05, 0.6), wood, desk, [0, 0.76, 0]);
  for (const [x, z] of [[-0.7, -0.25], [0.7, -0.25], [-0.7, 0.25], [0.7, 0.25]]) mesh(new THREE.BoxGeometry(0.05, 0.76, 0.05), wood, desk, [x, 0.38, z]);
  mesh(new THREE.BoxGeometry(0.55, 0.45, 0.45), mat(0xe9dfc4, { roughness: 0.6 }), desk, [0.2, 1.01, -0.02]);
  const screenM = new THREE.MeshStandardMaterial({ color: 0x2a73d9, emissive: 0x2a73d9, emissiveIntensity: 0.7, roughness: 0.2 });
  mesh(new THREE.PlaneGeometry(0.42, 0.32), screenM, desk, [0.2, 1.02, 0.206]);
  mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 16), mat(0xc52a20, { roughness: 0.4 }), desk, [-0.25, 0.84, 0.05]);
  const bookCols = [0xa8302a, 0x2f3e66, 0xd9a43a, 0x3d7a46, 0xa8302a, 0x444444, 0xd9a43a, 0x3d7a46, 0xa8302a];
  bookCols.slice(0, 5).forEach((c, i) => mesh(new THREE.BoxGeometry(0.05, 0.26, 0.2), mat(c, { roughness: 0.8 }), desk, [-0.6 + i * 0.055, 0.91, 0]));
  // shelf + books
  const shelf = pivot(g, [-0.9, 1.75, -2.38]);
  mesh(new THREE.BoxGeometry(1.2, 0.04, 0.22), wood, shelf, [0, 0, 0]);
  bookCols.forEach((c, i) => mesh(new THREE.BoxGeometry(0.07, 0.3 + (i % 3) * 0.03, 0.18), mat(c, { roughness: 0.8 }), shelf, [-0.45 + i * 0.08, 0.17 + (i % 3) * 0.015, 0]));
  mesh(new THREE.ConeGeometry(0.06, 0.14, 4), mat(0x4a9a3a), shelf, [0.42, 0.09, 0]);
  // poster
  const posterTex = canvasTex(400, 560, (c, w, h) => {
    c.fillStyle = '#111318'; c.fillRect(0, 0, w, h); const r = rng(8);
    for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; c.fillRect(r() * w, r() * h, 2, 2); }
    c.fillStyle = '#e9cf5b'; c.beginPath(); c.arc(w / 2, h * 0.36, 92, 0, 7); c.fill();
    c.fillStyle = 'rgba(180,150,50,0.5)'; for (const [x, y, s] of [[-30, -20, 18], [25, 30, 12], [35, -35, 9]]) { c.beginPath(); c.arc(w / 2 + x, h * 0.36 + y, s, 0, 7); c.fill(); }
    c.fillStyle = '#f1f1f1'; c.font = 'bold 54px Inter, sans-serif'; c.textAlign = 'center'; c.fillText('SPACE', w / 2, h * 0.78);
  });
  mesh(new THREE.PlaneGeometry(0.62, 0.86), mat(0xffffff, { map: posterTex, roughness: 0.8 }), g, [1.4, 1.65, -2.49]);
  // hanging lamp
  const lamp = pivot(g, [0.3, 2.8, 0.1]);
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), mat(0x222222), lamp, [0, -0.25, 0]);
  mesh(new THREE.ConeGeometry(0.42, 0.24, 32, 1, true), mat(0xf3efe2, { side: THREE.DoubleSide, roughness: 0.6 }), lamp, [0, -0.6, 0]);
  const bulb = mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffd28a, emissiveIntensity: 3 }), lamp, [0, -0.7, 0]); bulb.castShadow = false;
  const spot = new THREE.SpotLight(0xffc98a, 38, 9, 1.05, 0.65, 1.6);
  spot.position.set(0.3, 2.1, 0.1); spot.target.position.set(0.1, 0, -0.3); spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004; spot.shadow.radius = 6;
  g.add(spot, spot.target);
  const fill = new THREE.PointLight(0xffb070, 4, 7, 1.5); fill.position.set(-1.2, 1.8, 1.8); g.add(fill);
  g.add(new THREE.HemisphereLight(0xffd9a8, 0x3a2412, 0.55));
  // PORTAL (right side, facing -x)
  const portal = pivot(g, [2.05, 1.12, -0.55]); portal.rotation.y = -Math.PI / 2;
  const ringM = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x7fd0ff, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.4 });
  mesh(new THREE.TorusGeometry(0.82, 0.075, 18, 64), ringM, portal, null, null, [0.78, 1, 1]);
  const swirlM = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, boost: { value: 1 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float time; uniform float boost;
      void main(){ vec2 p=vUv*2.-1.; float r=length(p); float a=atan(p.y,p.x);
        float s=sin(a*5.+r*14.-time*5.)*.5+.5; float s2=sin(a*3.-r*9.+time*3.)*.5+.5;
        vec3 c=mix(vec3(.15,.35,.95),vec3(.75,.95,1.),s*.7+s2*.3); c+=vec3(1.)*pow(1.-r,3.)*1.2;
        float alpha=smoothstep(1.,.9,r); gl_FragColor=vec4(c*boost,alpha*.95);} `,
  });
  mesh(new THREE.CircleGeometry(0.8, 48), swirlM, portal, null, null, [0.78, 1, 1]).castShadow = false;
  const pl = new THREE.PointLight(0x7fc8ff, 6, 5, 1.6); pl.position.set(1.7, 1.15, -0.55); g.add(pl);
  // sparkles
  const sp = new THREE.BufferGeometry(); const N = 160; const pos = new Float32Array(N * 3); const r0 = rng(12);
  const seeds = []; for (let i = 0; i < N; i++) seeds.push([r0() * Math.PI * 2, 0.75 + r0() * 0.35, r0()]);
  sp.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparkles = new THREE.Points(sp, new THREE.PointsMaterial({ color: 0xdff6ff, size: 0.03, transparent: true, opacity: 0.9, depthWrite: false }));
  portal.add(sparkles);
  // chips bag + chips
  const bagTex = canvasTex(256, 320, (c, w, h) => {
    c.fillStyle = '#d63a1e'; c.fillRect(0, 0, w, h); c.fillStyle = '#f5c518'; c.beginPath(); c.arc(w / 2, h * 0.55, 80, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 50px Inter, sans-serif'; c.textAlign = 'center'; c.fillText('CHIPS', w / 2, h * 0.22);
    c.fillStyle = '#e8b13a'; for (const [x, y] of [[-30, 10], [20, -10], [10, 35]]) { c.beginPath(); c.ellipse(w / 2 + x, h * 0.55 + y, 30, 20, x, 0, 7); c.fill(); }
  });
  const chipsBag = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.1, 20, 16), mat(0xffffff, { map: bagTex, roughness: 0.35, metalness: 0.3 }), chipsBag, [0, 0, 0], null, [1, 1.35, 0.42]);
  mesh(new THREE.BoxGeometry(0.17, 0.02, 0.02), mat(0xd63a1e, { roughness: 0.35, metalness: 0.3 }), chipsBag, [0, 0.135, 0]);
  const chipM = mat(0xe9b649, { roughness: 0.6 });
  const chip = new THREE.Group(); mesh(new THREE.SphereGeometry(0.025, 12, 8), chipM, chip, null, null, [1, 0.18, 0.8]);
  return { group: g, swirlM, sparkles, seeds, portal, chipsBag, chip, pl, spot,
    update(t, boost = 1) {
      swirlM.uniforms.time.value = t; swirlM.uniforms.boost.value = boost; pl.intensity = 6 * boost;
      const a = sp.attributes.position.array;
      seeds.forEach(([ang, rad, ph], i) => { const k = (t * 0.3 + ph) % 1; const aa = ang + t * 0.6; a[i * 3] = Math.cos(aa) * rad * 0.78 * (1 + k * 0.3); a[i * 3 + 1] = Math.sin(aa) * rad * (1 + k * 0.3); a[i * 3 + 2] = (k - 0.5) * 0.3; });
      sp.attributes.position.needsUpdate = true;
    } };
}

/* ------------------------------------------------------------------ GLOBE */
export const MONTANA = { lat: 47.0, lon: -109.6 };
export function latLon(lat, lon, R) {
  const th = (90 - lat) * Math.PI / 180, ph = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).multiplyScalar(R);
}
function drawRings(c, rings, w, h, fill) {
  for (const ring of rings) {
    // unwrap longitudes so a ring never jumps across the date line
    const pts = []; let prev = null, off = 0;
    for (const [lon, lat] of ring) { let L = lon + off; if (prev !== null) { if (L - prev > 180) { off -= 360; L -= 360; } else if (L - prev < -180) { off += 360; L += 360; } } pts.push([L, lat]); prev = L; }
    for (const shift of [-360, 0, 360]) {
      c.beginPath(); pts.forEach(([lon, lat], i) => { const x = (lon + shift + 180) / 360 * w, y = (90 - lat) / 180 * h; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath();
      fill ? c.fill() : c.stroke();
    }
  }
}
export async function buildGlobe() {
  const g = new THREE.Group();
  const [land, states] = await Promise.all([fetch('/node_modules/world-atlas/land-50m.json').then(r => r.json()), fetch('/node_modules/us-atlas/states-10m.json').then(r => r.json())]);
  const landGeo = topojson.feature(land, land.objects.land);
  const stGeo = topojson.feature(states, states.objects.states);
  const polys = f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
  const W = 4096, H = 2048;
  const earthTex = canvasTex(W, H, (c) => {
    const grd = c.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#1b3f73'); grd.addColorStop(0.5, '#1e5a96'); grd.addColorStop(1, '#1b3f73');
    c.fillStyle = grd; c.fillRect(0, 0, W, H);
    c.fillStyle = '#5f8f45';
    for (const f of landGeo.features) for (const p of polys(f)) drawRings(c, p, W, H, true);
    // terrain tint
    c.globalCompositeOperation = 'source-atop';
    const r = rng(21); for (let i = 0; i < 9000; i++) { const x = r() * W, y = r() * H; const lat = 90 - y / H * 180; const dry = Math.abs(Math.abs(lat) - 25) < 12; c.fillStyle = dry ? `rgba(196,160,96,${0.25 + r() * 0.3})` : `rgba(40,90,40,${r() * 0.25})`; c.beginPath(); c.arc(x, y, 6 + r() * 26, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(240,245,250,0.95)'; c.fillRect(0, 0, W, H * 0.06); c.fillRect(0, H * 0.9, W, H * 0.1);
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5;
    for (const f of stGeo.features) for (const p of polys(f)) drawRings(c, p, W, H, false);
  });
  const mtTex = canvasTex(W, H, (c) => {
    c.clearRect(0, 0, W, H);
    const mt = stGeo.features.find(f => f.properties.name === 'Montana');
    c.fillStyle = 'rgba(255,90,40,0.85)'; c.strokeStyle = '#fff3c4'; c.lineWidth = 5;
    for (const p of polys(mt)) { drawRings(c, p, W, H, true); drawRings(c, p, W, H, false); }
  });
  const R = 2;
  const earth = pivot(g);
  mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.75, metalness: 0 }), earth).castShadow = false;
  const mtM = new THREE.MeshBasicMaterial({ map: mtTex, transparent: true, opacity: 0, depthWrite: false });
  mesh(new THREE.SphereGeometry(R * 1.002, 96, 64), mtM, earth).castShadow = false;
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-abs(dot(vN,vV)),2.2); gl_FragColor=vec4(vec3(.35,.65,1.)*f*1.6, f); }',
  }));
  g.add(atm);
  // pin
  const pin = pivot(earth);
  const pinInner = pivot(pin);
  mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe62e2e, roughness: 0.3, emissive: 0x551010 }), pinInner, [0, 0.13, 0]);
  mesh(new THREE.ConeGeometry(0.02, 0.11, 10), mat(0xdddddd, { metalness: 0.6, roughness: 0.3 }), pinInner, [0, 0.055, 0], [Math.PI, 0, 0]);
  const mtPos = latLon(MONTANA.lat, MONTANA.lon, R);
  pin.position.copy(mtPos); pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mtPos.clone().normalize());
  // stars
  const sg = new THREE.BufferGeometry(); const sN = 2500; const sp = new Float32Array(sN * 3); const r = rng(33);
  for (let i = 0; i < sN; i++) { const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(60 + r() * 30); sp.set(v.toArray(), i * 3); }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, sizeAttenuation: true })));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.6); sun.position.set(-4, 3, 6); g.add(sun);
  g.add(new THREE.AmbientLight(0x6688aa, 0.35));
  return { group: g, earth, mtM, pin, pinInner, mtPos, R };
}

/* ------------------------------------------------------------------ SWAMP */
function frondTex() {
  return canvasTex(128, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#3d6b23'; c.lineWidth = 5; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 0); c.stroke();
    for (let y = h - 20; y > 10; y -= 14) { const l = (w / 2 - 6) * Math.sin((y / h) * Math.PI) + 8; for (const s of [-1, 1]) { const grd = c.createLinearGradient(w / 2, y, w / 2 + s * l, y - 18); grd.addColorStop(0, '#4f8a2a'); grd.addColorStop(1, '#7cb043'); c.fillStyle = grd; c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + s * l * 0.6, y - 4, w / 2 + s * l, y - 18); c.quadraticCurveTo(w / 2 + s * l * 0.5, y - 14, w / 2, y - 9); c.fill(); } }
  });
}
export function buildSwamp() {
  const g = new THREE.Group();
  const groundTex = canvasTex(1024, 1024, (c, w, h) => {
    c.fillStyle = '#4f5a2c'; c.fillRect(0, 0, w, h); const r = rng(14);
    for (let i = 0; i < 2600; i++) { const x = r() * w, y = r() * h, s = 8 + r() * 40; const k = r(); c.fillStyle = k < 0.4 ? `rgba(92,70,40,${0.3 + r() * 0.3})` : k < 0.8 ? `rgba(70,100,40,${0.3 + r() * 0.3})` : `rgba(40,50,25,${0.3})`; c.beginPath(); c.ellipse(x, y, s, s * 0.7, r() * 3, 0, 7); c.fill(); }
    for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(120,150,60,${r() * 0.5})`; c.fillRect(r() * w, r() * h, 1.5, 5); }
  }, { repeat: [14, 14] });
  mesh(new THREE.PlaneGeometry(300, 300), mat(0xffffff, { map: groundTex, roughness: 0.95 }), g, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  // water ponds
  const waterM = new THREE.MeshStandardMaterial({ color: 0x2d4a3c, roughness: 0.08, metalness: 0.55 });
  for (const [x, z, sx, sz] of [[-9, -12, 9, 5], [12, -20, 14, 7], [-22, -35, 18, 9], [6, 9, 6, 3.5], [30, -6, 10, 6]]) mesh(new THREE.CircleGeometry(1, 40), waterM, g, [x, 0.02, z], [-Math.PI / 2, 0, 0], [sx, sz, 1]).castShadow = false;
  // sky dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h=normalize(vP).y; vec3 a=vec3(.93,.80,.55), b=vec3(.48,.66,.78); gl_FragColor=vec4(mix(a,b,smoothstep(-.02,.45,h)),1.); }' }));
  g.add(sky);
  const fT = frondTex();
  const frondM = new THREE.MeshStandardMaterial({ map: fT, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
  const frondGeo = new THREE.PlaneGeometry(0.35, 1.4, 1, 6); frondGeo.translate(0, 0.7, 0);
  { const p = frondGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, 0.25 * y * y); } frondGeo.computeVertexNormals(); }
  const ferns = [];
  const mkFern = (x, z, s, seed) => { const f = pivot(g, [x, 0, z]); const r = rng(seed); f.scale.setScalar(s); for (let i = 0; i < 9; i++) { const p = pivot(f); p.rotation.set(0, (i / 9) * Math.PI * 2 + r(), 0); const m = mesh(frondGeo, frondM, p); m.rotation.x = 0.55 + r() * 0.35; } ferns.push({ f, ph: r() * 6 }); return f; };
  const r = rng(77);
  const clear = (x, z, m = 0) => Math.hypot(x - 1.2, z - 1.4) < 3.2 + m || (Math.abs(x - 4.3) < 2.5 + m && z > -14 && z < 22);
  for (let i = 0; i < 90; i++) { const a = r() * Math.PI * 2, d = 3 + r() * 40; const x = Math.cos(a) * d, z = Math.sin(a) * d - 6; if (clear(x, z)) continue; mkFern(x, z, 0.8 + r() * 1.3, 100 + i); }
  // conifers + cycads
  const trunkM = mat(0x5a4128, { roughness: 1 }), needleM = mat(0x2f5a2a, { roughness: 0.9 }), needle2 = mat(0x3d6b30, { roughness: 0.9 });
  const mkConifer = (x, z, s) => { const t = pivot(g, [x, 0, z]); t.scale.setScalar(s); mesh(new THREE.CylinderGeometry(0.18, 0.35, 9, 8), trunkM, t, [0, 4.5, 0]); for (let k = 0; k < 4; k++) mesh(new THREE.ConeGeometry(2.4 - k * 0.45, 3.2, 10), k % 2 ? needleM : needle2, t, [0, 4 + k * 1.6, 0]); };
  const mkCycad = (x, z, s, seed) => { const t = pivot(g, [x, 0, z]); t.scale.setScalar(s); mesh(new THREE.CylinderGeometry(0.25, 0.32, 1.6, 10), mat(0x6b5536, { roughness: 1 }), t, [0, 0.8, 0]); const rr = rng(seed); for (let i = 0; i < 12; i++) { const p = pivot(t, [0, 1.6, 0]); p.rotation.y = i / 12 * Math.PI * 2 + rr(); const m = mesh(frondGeo, frondM, p, null, null, [2.2, 1.9, 2.2]); m.rotation.x = 0.9 + rr() * 0.4; } };
  for (let i = 0; i < 46; i++) { const a = r() * Math.PI * 2, d = 18 + r() * 60; if (clear(Math.cos(a) * d, Math.sin(a) * d - 15, 4)) continue; mkConifer(Math.cos(a) * d, Math.sin(a) * d - 15, 0.8 + r() * 0.8); }
  for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = 6 + r() * 25; { const cx = Math.cos(a) * d, cz = Math.sin(a) * d - 8; if (clear(cx, cz, 1) || (cx > -13 && cx < -1 && cz > -17 && cz < -1)) continue; } mkCycad(Math.cos(a) * d, Math.sin(a) * d - 8, 0.8 + r() * 0.6, 300 + i); }
  // hiding rock + log near Martin's spot
  const rockM = mat(0x77705f, { roughness: 0.95 });
  const rock = mesh(new THREE.DodecahedronGeometry(1, 1), rockM, g, [1.1, 0.55, 0.6], [0.3, 0.6, 0.1], [1.1, 0.75, 0.9]);
  mesh(new THREE.DodecahedronGeometry(0.6, 1), rockM, g, [2.0, 0.3, 0.2], [0.5, 0.2, 0.3], [1, 0.7, 0.8]);
  mesh(new THREE.CylinderGeometry(0.35, 0.4, 5, 12), mat(0x5d4630, { roughness: 1 }), g, [-6.5, 0.35, 2.5], [0, 0.5, Math.PI / 2]);
  // dragonflies
  const flies = []; const flyM = mat(0x2a6aa8, { roughness: 0.3, metalness: 0.4 }), wingM = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) { const f = pivot(g); mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.14, 6), flyM, f, null, [Math.PI / 2, 0, 0]); const w = []; for (const s of [-1, 1]) { const p = pivot(f); mesh(new THREE.PlaneGeometry(0.12, 0.03), wingM, p, [s * 0.06, 0, 0], [-Math.PI / 2, 0, 0]); w.push(p); } flies.push({ f, w, ph: r() * 10, c: [r() * 8 - 4, 0.8 + r() * 1.4, r() * 6 - 4] }); }
  const sun = new THREE.DirectionalLight(0xffe0aa, 3.2); sun.position.set(-18, 22, 14); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  g.add(sun, sun.target);
  g.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a4a22, 0.9));
  return { group: g, ferns, flies, rock, sun, fog: new THREE.Fog(0xbfc49a, 25, 140),
    update(t) {
      ferns.forEach(({ f, ph }) => { f.rotation.z = Math.sin(t * 1.3 + ph) * 0.03; f.rotation.x = Math.sin(t * 1.1 + ph * 2) * 0.03; });
      flies.forEach(({ f, w, ph, c }) => { f.position.set(c[0] + Math.sin(t * 0.7 + ph) * 2, c[1] + Math.sin(t * 1.9 + ph) * 0.3, c[2] + Math.cos(t * 0.5 + ph) * 2); f.rotation.y = t * 0.7 + ph; w.forEach((p, i) => p.rotation.z = Math.sin(t * 60 + i) * 0.5); });
    } };
}

/* ------------------------------------------------------------------ DIG SITE */
export function buildDig() {
  const g = new THREE.Group();
  const groundTex = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#c9a77a'; c.fillRect(0, 0, w, h); const r = rng(5); for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '120,90,60' : '230,210,170'},${r() * 0.3})`; c.fillRect(r() * w, r() * h, 3, 3); } }, { repeat: [20, 20] });
  mesh(new THREE.PlaneGeometry(300, 300), mat(0xffffff, { map: groundTex, roughness: 1 }), g, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  const bandTex = canvasTex(64, 512, (c, w, h) => { const cols = ['#c69a6a', '#a8734a', '#d8b98c', '#8a6a52', '#c49070', '#e2cfa6', '#9c7a5a']; let y = 0, i = 0; while (y < h) { const s = 14 + (i * 37 % 30); c.fillStyle = cols[i % cols.length]; c.fillRect(0, y, w, s); y += s; i++; } });
  const bandM = mat(0xffffff, { map: bandTex, roughness: 1 });
  const r = rng(9);
  for (let i = 0; i < 16; i++) { const a = -0.9 + r() * 1.8 + Math.PI, d = 30 + r() * 50; const x = Math.sin(a) * d, z = Math.cos(a) * d; const s = 6 + r() * 10; mesh(new THREE.CylinderGeometry(s * 0.5, s * 1.3, s * (0.9 + r() * 0.6), 9), bandM, g, [x, s * 0.4, z], [0, r() * 3, 0]); }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h=normalize(vP).y; gl_FragColor=vec4(mix(vec3(.96,.86,.68),vec3(.36,.6,.86),smoothstep(0.,.5,h)),1.); }' }));
  g.add(sky);
  // dig pit: darker patch, string grid, tools
  mesh(new THREE.CircleGeometry(3.2, 40), mat(0xa9875d, { roughness: 1 }), g, [0, 0.01, 0], [-Math.PI / 2, 0, 0]).castShadow = false;
  const strM = mat(0xf2efe6);
  for (let i = -2; i <= 2; i++) { mesh(new THREE.BoxGeometry(5, 0.008, 0.008), strM, g, [0, 0.12, i * 1.1]); mesh(new THREE.BoxGeometry(0.008, 0.008, 5), strM, g, [i * 1.1, 0.12, 0]); }
  for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), mat(0x8a6a3a), g, [x, 0.17, z]);
  const bucket = mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.3, 16), mat(0xe2b23a, { roughness: 0.5 }), g, [2.0, 0.15, 1.2]);
  // ribs sticking out of the ground
  const boneM = mat(0xe6d6b4, { roughness: 0.7 });
  for (let i = 0; i < 5; i++) mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 20, Math.PI * 0.8), boneM, g, [-1.6 + i * 0.32, -0.05, -0.6], [0, Math.PI / 2, 0.3]);
  const sun = new THREE.DirectionalLight(0xfff0d0, 3.4); sun.position.set(10, 18, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 60 }); sun.shadow.bias = -0.0005; g.add(sun, sun.target);
  g.add(new THREE.HemisphereLight(0xcfe3ff, 0x8a6a4a, 1.0));
  return { group: g, boneM, fog: new THREE.Fog(0xe8d6b4, 40, 160) };
}
