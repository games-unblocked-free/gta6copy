// world.js - builds the city: ground, roads, sidewalks, instanced buildings/palms/streetlights, banks, sea, sky, day/night.
// Tweak: cfg.world (size/block/road), cfg.dayLengthSec, cfg.drawDistance, zone() for what goes where.
import * as THREE from 'three';

const rnd = (() => { let s = 1234567; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();

// Turns any template (placeholder or real GLB) into InstancedMeshes, one per sub-mesh.
function instanceModel(tpl, mats) {
  const g = new THREE.Group(); tpl.updateMatrixWorld(true);
  tpl.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m.clone().multiply(o.matrixWorld)));
    im.instanceMatrix.needsUpdate = true; g.add(im);
  });
  return g;
}

export function buildWorld(scene, A, cfg) {
  const B = cfg.world.block, R = cfg.world.road, IN = B - R;
  const xs = [], zs = [];
  for (let i = 0; i < 7; i++) xs.push(-600 + B * i);   // north-south roads
  for (let i = 0; i < 9; i++) zs.push(-600 + B * i);   // east-west roads
  const rep = (t, x, y) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(x, y); c.needsUpdate = true; return c; };
  const plane = (w, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat); m.position.set(x, y, z); scene.add(m); return m; };
  const std = o => new THREE.MeshStandardMaterial(o);

  scene.fog = new THREE.Fog(0x87ceeb, 200, cfg.drawDistance);
  const hemi = new THREE.HemisphereLight(0xbfdfff, 0x556b2f, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2); scene.add(sun);

  // land: grass x -750..450, sand 450..560, sea beyond
  plane(1200, 1500, std({ map: rep(A.tex('grass'), 300, 375) }), -150, 0, 0);
  plane(110, 1500, std({ map: rep(A.tex('sand'), 28, 375) }), 505, 0.01, 0);
  const seaMat = std({ map: rep(A.tex('water_normal'), 20, 40), roughness: 0.2, metalness: 0.1 });
  plane(1500, 3000, seaMat, 1310, -0.6, 0);

  // roads (y offsets differ so overlaps at intersections don't z-fight)
  const road = (cx, cz, len, w, alongX, y) => {
    const g = new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2); if (!alongX) g.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(g, std({ map: rep(A.tex('road_asphalt'), len / 16, 1) })); m.position.set(cx, y, cz); scene.add(m);
  };
  xs.forEach(x => road(x, 0, 1400, R, false, 0.02));
  zs.forEach(z => road(-150, z, 1100, R, true, 0.025));
  [-700, 400].forEach(x => road(x, 0, 1400, 22, false, 0.03));   // highway loop
  [-700, 700].forEach(z => road(-150, z, 1122, 22, true, 0.03));

  // blocks, sidewalks
  const blocks = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) blocks.push([xs[i] + B / 2, zs[j] + B / 2]);
  const sw = new THREE.InstancedMesh(new THREE.PlaneGeometry(IN, IN).rotateX(-Math.PI / 2), std({ map: rep(A.tex('sidewalk'), IN / 4, IN / 4) }), blocks.length);
  const mat4 = new THREE.Matrix4();
  blocks.forEach(([x, z], i) => sw.setMatrixAt(i, mat4.makeTranslation(x, 0.04, z)));
  scene.add(sw);

  const BANKS = [[-75, 75, 'Gold Coast Bank'], [-375, -225, 'Leona Savings'], [75, -375, 'Sunset Trust']];
  const zone = (cx, cz) => (Math.abs(cx + 150) <= 160 && Math.abs(cz) <= 230 ? 'down' : cz >= 375 ? 'ind' : cx <= -375 ? 'sub' : 'shop');
  const tall = [], brick = [], conc = [], colliders = [];
  const put = (arr, x, z, w, h, d) => { arr.push({ x, z, w, h, d }); colliders.push({ x, z, hw: w / 2, hd: d / 2, h }); };
  for (const [cx, cz] of blocks) {
    if (BANKS.some(b => b[0] === cx && b[1] === cz)) continue;
    const z = zone(cx, cz);
    if (z === 'down') for (const dx of [-34, 34]) for (const dz of [-34, 34]) put(tall, cx + dx, cz + dz, 40 + rnd() * 8, 35 + rnd() * 115, 40 + rnd() * 8);
    else if (z === 'sub') for (const dx of [-42, 0, 42]) for (const dz of [-42, 0, 42]) put(brick, cx + dx, cz + dz, 14, 6, 12);
    else if (z === 'ind') for (const dz of [-34, 34]) put(conc, cx, cz + dz, 100, 14, 55);
    else for (const dx of [-34, 34]) for (const dz of [-34, 34]) put(brick, cx + dx, cz + dz, 40, 9 + rnd() * 5, 40);
  }
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), col = new THREE.Color();
  const inst = (arr, tex, rx, ry, hue) => {
    if (!arr.length) return;
    const im = new THREE.InstancedMesh(box, std({ map: rep(A.tex(tex), rx, ry) }), arr.length);
    arr.forEach((b, i) => {
      im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(b.x, 0, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d)));
      im.setColorAt(i, col.setHSL(hue, 0.1, 0.65 + rnd() * 0.3));
    });
    scene.add(im);
  };
  inst(tall, 'glass_building', 3, 5, 0.58); inst(brick, 'brick', 4, 2, 0.05); inst(conc, 'concrete', 6, 2, 0.1);

  // banks (real GLB if present, else placeholder)
  const banks = BANKS.map(([x, z, name]) => {
    const group = A.model('bank'); group.position.set(x, 0, z); scene.add(group);
    return { x, z, name, group };
  });

  // palms along the beach, streetlights at every intersection
  const palms = [];
  for (let z = -690; z <= 690; z += 14) palms.push(new THREE.Matrix4().compose(new THREE.Vector3(440 + rnd() * 6, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6), new THREE.Vector3().setScalar(0.8 + rnd() * 0.4)));
  scene.add(instanceModel(A.tpl('palm_tree'), palms));
  const lights = [];
  for (const x of xs) for (const z of zs) lights.push(new THREE.Matrix4().makeTranslation(x + 10, 0, z + 10));
  const lampGroup = instanceModel(A.tpl('streetlight'), lights); scene.add(lampGroup);
  const lampMats = new Set(); lampGroup.traverse(o => { if (o.isMesh && o.material.name === 'lamp') lampMats.add(o.material); });

  // sky dome (equirect), follows camera
  const skyMat = new THREE.MeshBasicMaterial({ map: A.tex('sky'), side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 12), skyMat); sky.renderOrder = -1; scene.add(sky);

  const dayFog = new THREE.Color(0x9fd4ff), nightFog = new THREE.Color(0x070b1a), lampOn = new THREE.Color(0xffd27a), lampOff = new THREE.Color(0x333333);
  const api = {
    xs, zs, banks, colliders, tod: 10, isNight: false, spawn: new THREE.Vector3(-150, 2, 30),
    update(dt, cam) {
      api.tod = (api.tod + dt / cfg.dayLengthSec * 24) % 24;
      const a = (api.tod - 6) * Math.PI / 12, s = Math.sin(a), day = THREE.MathUtils.clamp(s * 2 + 0.5, 0, 1);
      sun.position.set(Math.cos(a) * 400, Math.abs(s) * 400 + 20, 100); sun.intensity = day * 2;
      hemi.intensity = 0.15 + day * 0.85;
      scene.fog.color.lerpColors(nightFog, dayFog, day); skyMat.color.setScalar(0.1 + 0.9 * day);
      api.isNight = day < 0.3;
      lampMats.forEach(m => m.color.copy(api.isNight ? lampOn : lampOff));
      seaMat.map.offset.x += dt * 0.01;
      sky.position.copy(cam.position);
    },
  };
  return api;
}
