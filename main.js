// main.js - entry point. All tunables live in CONFIG. Part 1 has a debug fly-cam; the player/cars arrive in Part 2.
import * as THREE from 'three';
import { AssetManager } from './assets.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { buildWorld } from './world.js';

export const CONFIG = {
  traffic: { cars: 25, respawnDist: 300 },
  peds: { count: 40, respawnDist: 200 },
  wanted: { cooldownSec: 15, searchRadius: 120, bustedHealth: 25 },
  bank: { payout: [40000, 120000], cooldownSec: 300, drillSec: 20, count: 3 },
  economy: { startCash: 500, deathCashLoss: 0.1, saveEverySec: 30 },
  // car feel: accel (m/s^2), max (m/s), turn (rad/s), grip (1 = no drift), hp
  cars: {
    sedan: { accel: 14, max: 38, turn: 1.8, grip: 0.9, hp: 100 },
    sports_car: { accel: 24, max: 58, turn: 2.2, grip: 0.7, hp: 80 },
    suv: { accel: 11, max: 34, turn: 1.4, grip: 0.95, hp: 160 },
    pickup: { accel: 9, max: 30, turn: 1.5, grip: 0.9, hp: 140 },
    taxi: { accel: 14, max: 38, turn: 1.8, grip: 0.9, hp: 100 },
    police_car: { accel: 20, max: 52, turn: 2.0, grip: 0.8, hp: 130 },
    motorcycle: { accel: 22, max: 50, turn: 2.8, grip: 0.6, hp: 50 },
  },
  dayLengthSec: 600, drawDistance: 900, maxPixelRatio: 2,
  world: { size: 1500, block: 150, road: 14 },
  // model fitting: size in meters along `axis`; rotY fixes models facing the wrong way (try Math.PI or Math.PI/2)
  fit: {
    byCat: {
      cars: { size: 4.5, axis: 'max', rotY: 0 }, characters: { size: 1.8, axis: 'y', rotY: 0 },
      buildings: { size: 28, axis: 'max', rotY: 0 }, props: { size: 1.5, axis: 'y', rotY: 0 },
    },
    override: {
      motorcycle: { size: 2.1 }, pickup: { size: 5.3 }, suv: { size: 4.9 }, sports_car: { size: 4.3 },
      palm_tree: { size: 9 }, streetlight: { size: 8 }, bank: { size: 30 },
      skyscraper_01: { size: 120, axis: 'y' }, skyscraper_02: { size: 150, axis: 'y' }, house_01: { size: 12 }, shop_01: { size: 20 }, gas_station: { size: 24 },
    },
  },
};

async function boot() {
  const ui = new UI(), audio = new AudioSys();
  const A = new AssetManager({ audio, cfg: CONFIG, onProgress: (d, t, k) => ui.loading(d / t, `${k} (${d}/${t})`) });
  try { await A.init(); await A.preload(); } catch (e) { console.error('preload problem, starting anyway', e); }
  A.printReport(); ui.report = A.report;
  console.info('placeholders in use:', A.missingAssets.length);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 3000);
  const world = buildWorld(scene, A, CONFIG);
  camera.position.copy(world.spawn);
  ui.hideLoading();

  let yaw = 0, pitch = 0;
  const keys = {};
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'F3') { e.preventDefault(); ui.toggleDebug(); }
    const s = { KeyH: 'car_horn', KeyG: 'gunshot_pistol', KeyB: 'bank_alarm', KeyC: 'cash_pickup' }[e.code];
    if (s && !e.repeat) audio.play(s);
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  renderer.domElement.addEventListener('click', () => { try { renderer.domElement.requestPointerLock()?.catch?.(() => {}); } catch { /* ignore */ } });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement !== renderer.domElement) return;
    yaw -= e.movementX * 0.002; pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.002, -1.5, 1.5);
  });

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), clock = new THREE.Clock();
  let fpsT = 0, frames = 0, fps = 0, dbgT = 0;
  (function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.getWorldDirection(fwd); right.crossVectors(fwd, camera.up).normalize();
    const v = (keys.ShiftLeft ? 120 : 25) * dt;
    if (keys.KeyW) camera.position.addScaledVector(fwd, v);
    if (keys.KeyS) camera.position.addScaledVector(fwd, -v);
    if (keys.KeyD) camera.position.addScaledVector(right, v);
    if (keys.KeyA) camera.position.addScaledVector(right, -v);
    if (keys.Space) camera.position.y += v;
    if (keys.KeyV) camera.position.y = Math.max(1.5, camera.position.y - v);
    world.update(dt, camera);
    ui.hud({ cash: CONFIG.economy.startCash, wanted: 0, hp: 100, armor: 0, objective: 'debug cam: WASD, Shift fast, Space/V up/down, H/G/B/C test sounds, F3 debug' });
    ui.minimap(world, camera.position, yaw, []);
    renderer.render(scene, camera);
    frames++; fpsT += dt; dbgT += dt;
    if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
    if (dbgT > 0.25) { dbgT = 0; const p = camera.position; ui.debug({ fps, pos: `${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}`, wanted: 0, tod: world.tod.toFixed(1) }); }
  })();
}
boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="position:fixed;top:0;color:#f88">boot error: ' + e.message + '</pre>'); });
