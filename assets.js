// assets.js - AssetManager. Every load: try/catch + 5 s timeout, falls back to a placeholder, never throws.
// Tweak: TIMEOUT_MS, or override filenames with assets/manifest.json: {"models":{"sedan":"./assets/models/cars/my.glb"}}
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TIMEOUT_MS = 5000;
const P = './assets/';
export const CATS = {
  cars: ['sedan', 'sports_car', 'suv', 'pickup', 'taxi', 'police_car', 'motorcycle'],
  characters: ['player', 'pedestrian_male', 'pedestrian_female', 'cop', 'bank_guard', 'bank_teller'],
  buildings: ['bank', 'skyscraper_01', 'skyscraper_02', 'house_01', 'shop_01', 'gas_station'],
  props: ['palm_tree', 'streetlight', 'traffic_light', 'bench', 'trash_can', 'money_bag', 'vault_door', 'pistol', 'smg'],
};
const list = (dir, ext, names) => Object.fromEntries(names.map(n => [n, `${P}${dir}/${n}.${ext}`]));
export const DEFAULTS = {
  models: Object.assign({}, ...Object.entries(CATS).map(([c, n]) => list(`models/${c}`, 'glb', n))),
  textures: {
    ...list('textures', 'jpg', ['road_asphalt', 'sidewalk', 'grass', 'sand', 'concrete', 'brick', 'glass_building', 'bank_floor_tile', 'water_normal', 'sky']),
    road_lines: `${P}textures/road_lines.png`,
  },
  ui: list('ui', 'png', ['crosshair', 'wanted_star', 'cash_icon', 'minimap_frame']),
  audio: {
    ...list('audio/sfx', 'mp3', ['engine_loop', 'car_horn', 'tire_screech', 'car_door', 'car_crash', 'gunshot_pistol', 'gunshot_smg', 'siren_police', 'bank_alarm', 'vault_drill', 'footsteps_concrete', 'cash_pickup', 'pedestrian_scream', 'police_radio', 'wasted', 'busted']),
    ...list('audio/music', 'mp3', ['radio_01', 'radio_02', 'radio_03']),
    ...list('audio/ambience', 'mp3', ['city_loop', 'ocean_waves']),
  },
};
const catOf = key => Object.keys(CATS).find(c => CATS[c].includes(key));

// ---- model fitting: scale to target size, center on XZ, ground at y=0, find wheel nodes
function fit(obj, { size = 1, axis = 'max', rotY = 0 } = {}) {
  const inner = new THREE.Group(); inner.add(obj); inner.rotation.y = rotY;
  const b = new THREE.Box3().setFromObject(inner), s = b.getSize(new THREE.Vector3());
  const d = axis === 'max' ? Math.max(s.x, s.y, s.z) : s[axis];
  inner.scale.setScalar(size / (d || 1)); inner.updateMatrixWorld(true);
  b.setFromObject(inner);
  const c = b.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -b.min.y, -c.z);
  const out = new THREE.Group(); out.add(inner);
  out.userData.wheels = Object.fromEntries(['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']
    .map(n => [n, obj.getObjectByName(n)]).filter(e => e[1]));
  return out;
}

// ---- placeholder models (all face +Z)
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const box = (w, h, d, m, x = 0, y = 0, z = 0, name = '') => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.name = name; return o;
};
const CAR_COL = { sedan: 0x3a7bd5, sports_car: 0xe03030, suv: 0x2f4f2f, pickup: 0xc08a2a, taxi: 0xf5c518, police_car: 0x111111, motorcycle: 0x7a2fbf };
function phCar(key) {
  const g = new THREE.Group(), moto = key === 'motorcycle', w = moto ? 0.5 : 1.9, L = moto ? 2.1 : 4.5;
  g.add(box(w, moto ? 0.5 : 0.6, L, M(CAR_COL[key]), 0, 0.6, 0));
  if (!moto) g.add(box(1.6, 0.55, 2.2, M(key === 'police_car' ? 0xffffff : 0x223344), 0, 1.15, -0.2));
  for (const [n, sx, sz] of [['fl', -1, 1], ['fr', 1, 1], ['rl', -1, -1], ['rr', 1, -1]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), M(0x111111));
    wh.rotation.z = Math.PI / 2; wh.position.set(sx * w / 2, 0.35, sz * L * 0.3); wh.name = 'wheel_' + n; g.add(wh);
  }
  if (key === 'police_car') {
    g.add(box(0.5, 0.15, 0.3, M(0xff0000, { emissive: 0xff0000 }), -0.35, 1.5, -0.2, 'light_red'));
    g.add(box(0.5, 0.15, 0.3, M(0x0000ff, { emissive: 0x0000ff }), 0.35, 1.5, -0.2, 'light_blue'));
  }
  return g;
}
const ROLE_COL = { player: 0x2e8b57, pedestrian_male: 0x8888cc, pedestrian_female: 0xcc88aa, cop: 0x1a2a6c, bank_guard: 0x444444, bank_teller: 0xeeeeee };
function phPerson(key) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 4, 8), M(ROLE_COL[key])); body.position.y = 0.7; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), M(0xe0b090)); head.position.y = 1.55; g.add(head);
  return g;
}
function phBank() {
  const g = new THREE.Group();
  g.add(box(28, 10, 20, M(0x1d4ed8), 0, 5, 0), box(29, 1, 21, M(0xd4af37), 0, 10.5, 0), box(4, 5, 0.4, M(0x111827), 0, 2.5, 10.1));
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d'); x.fillStyle = '#d4af37'; x.fillRect(0, 0, 256, 64);
  x.fillStyle = '#1d3a8a'; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BANK', 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: t })); sign.position.set(0, 7.5, 10.2); g.add(sign);
  return g;
}
function phModel(key) {
  const cat = catOf(key);
  if (cat === 'cars') return phCar(key);
  if (cat === 'characters') return phPerson(key);
  const g = new THREE.Group();
  if (key === 'bank') return phBank();
  if (cat === 'buildings') {
    const h = { skyscraper_01: 80, skyscraper_02: 110, house_01: 6, shop_01: 9, gas_station: 5 }[key];
    g.add(box(key.startsWith('sky') ? 30 : 14, h, key.startsWith('sky') ? 30 : 14, M(0x9fb4c7), 0, h / 2, 0));
  } else if (key === 'palm_tree') {
    g.add(box(0.4, 7, 0.4, M(0x7a5230), 0, 3.5, 0));
    const l = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), M(0x2e8b3a)); l.scale.set(3, 0.8, 3); l.position.y = 7.2; g.add(l);
  } else if (key === 'streetlight') {
    g.add(box(0.2, 8, 0.2, M(0x555555), 0, 4, 0));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0x333333, name: 'lamp' })); lamp.position.y = 8; g.add(lamp);
  } else g.add(box(0.6, 0.6, 0.6, M(0x888888), 0, 0.3, 0));
  return g;
}

// ---- placeholder textures (canvas)
const cv = (w, h, f) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); f(x, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
};
const noise = (x, w, h, base, amp) => {
  const d = x.createImageData(w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amp;
    d.data[i] = base[0] + n; d.data[i + 1] = base[1] + n; d.data[i + 2] = base[2] + n; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
};
const TEX = {
  road_asphalt: () => cv(256, 256, (x, w, h) => { noise(x, w, h, [60, 60, 64], 30); x.fillStyle = '#e8d44d'; for (let i = 0; i < w; i += 64) x.fillRect(i, h / 2 - 2, 32, 4); }),
  sidewalk: () => cv(128, 128, (x, w, h) => { noise(x, w, h, [170, 170, 165], 20); x.strokeStyle = '#888'; x.strokeRect(0, 0, w, h); }),
  grass: () => cv(128, 128, (x, w, h) => noise(x, w, h, [70, 130, 60], 40)),
  sand: () => cv(128, 128, (x, w, h) => noise(x, w, h, [225, 205, 150], 25)),
  concrete: () => cv(128, 128, (x, w, h) => noise(x, w, h, [150, 150, 150], 30)),
  brick: () => cv(128, 128, (x, w, h) => {
    x.fillStyle = '#9a4a3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d8c8b8'; x.lineWidth = 2;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) x.strokeRect(c * 32 + (r % 2) * 16 - 16, r * 16, 32, 16);
  }),
  glass_building: () => cv(128, 256, (x, w, h) => {
    x.fillStyle = '#3d5a73'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) { x.fillStyle = Math.random() < 0.3 ? '#ffe9a8' : '#6e9ab8'; x.fillRect(c * 16 + 2, r * 16 + 2, 12, 12); }
  }),
  bank_floor_tile: () => cv(128, 128, (x, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#eee' : '#556'; x.fillRect(i * 32, j * 32, 32, 32); } }),
  water_normal: () => cv(128, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1e6fa8'); g.addColorStop(1, '#2a9bd0'); x.fillStyle = g; x.fillRect(0, 0, w, h); }),
  sky: () => cv(512, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a6fd0'); g.addColorStop(0.5, '#8fcbff'); g.addColorStop(1, '#ffe4c4'); x.fillStyle = g; x.fillRect(0, 0, w, h); }),
  road_lines: () => cv(64, 64, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(28, 0, 8, 32); }),
};

export class AssetManager {
  constructor({ audio, cfg, onProgress }) {
    this.audio = audio; this.cfg = cfg; this.onProgress = onProgress;
    this.m = structuredClone(DEFAULTS);
    this.report = []; this.missingAssets = []; this.cache = { models: {}, textures: {}, audio: {}, ui: {} };
    this.done = 0; this.total = 0; this.gltf = new GLTFLoader();
  }
  async init() { // optional manifest override
    try {
      const r = await this.race(fetch(P + 'manifest.json'));
      if (r.ok) { const o = await r.json(); for (const k in o) Object.assign(this.m[k] ??= {}, o[k]); }
    } catch { /* no manifest: use defaults */ }
  }
  race(p) {
    let t;
    return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS); })]).finally(() => clearTimeout(t));
  }
  async _load(kind, id, fn, ph) {
    const known = this.m[kind]?.[id], path = known ?? id, name = known ? id : path;
    let r, ok = true;
    try { r = await this.race(fn(path)); } catch { ok = false; try { r = ph(); } catch { r = null; } this.missingAssets.push(`${kind}/${name}`); }
    this.cache[kind][name] = r;
    this.report.push({ type: kind, asset: name, status: ok ? 'loaded' : 'placeholder', path });
    this.done++; this.onProgress?.(this.done, this.total, name);
    return r;
  }
  fitFor(key) { const f = this.cfg.fit; return { ...f.byCat[catOf(key)], ...f.override[key] }; }
  loadModel(id, ph, spec) {
    return this._load('models', id, async p => fit((await this.gltf.loadAsync(p)).scene, spec), () => fit(ph(), spec));
  }
  loadTexture(id, ph) {
    return this._load('textures', id, async p => { const t = await new THREE.TextureLoader().loadAsync(p); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }, ph);
  }
  loadAudio(id, ph) {
    return this._load('audio', id, async p => {
      const r = await fetch(p); if (!r.ok) throw new Error(r.status);
      return this.audio.ctx.decodeAudioData(await r.arrayBuffer());
    }, ph);
  }
  loadImage(id) {
    return this._load('ui', id, p => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = p; }), () => null);
  }
  async preload() {
    const m = this.m;
    this.total = Object.keys(m.textures).length + Object.keys(m.models).length + Object.keys(m.audio).length + Object.keys(m.ui).length;
    const jobs = [];
    for (const k in m.textures) jobs.push(this.loadTexture(k, () => TEX[k]?.()));
    for (const k in m.models) jobs.push(this.loadModel(k, () => phModel(k), this.fitFor(k)));
    for (const k in m.audio) jobs.push(this.loadAudio(k, () => this.audio.synth(k)).then(b => this.audio.set(k, b)));
    for (const k in m.ui) jobs.push(this.loadImage(k));
    await Promise.allSettled(jobs);
  }
  tex(k) { return this.cache.textures[k]; }
  tpl(k) { return this.cache.models[k]; }          // shared template (use for instancing)
  model(k) { return this.cache.models[k]?.clone(true); } // fresh copy (skinned GLBs may need SkeletonUtils later)
  printReport() { console.table(this.report.map(({ type, asset, status }) => ({ type, asset, status }))); }
}
