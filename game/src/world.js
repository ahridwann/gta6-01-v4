// Lumina City world generation: ground, road grid, lit buildings, street
// lights with pools, neon signs, props, parked cars and neon chips.
// Everything is seeded, so the same seed builds the same city every run.
// Night stays night — but the streets are lit: bright lamp pools, glowing
// window grids and neon everywhere, so no frame is a black void.

import * as THREE from '../vendor/three/three.module.min.js';
import { CITY, DISTRICTS, NEON, SIGN_TEXTS, CHIP_COUNT } from './config.js';
import { makeRng } from './rng.js';

// --- canvas texture helpers -------------------------------------------------

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Lit-window facade: a dark wall with a grid of warm/cool lit windows.
function facadeTexture(rng, base, litRatio) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    const cw = w / cols;
    const ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (rng.chance(litRatio)) {
          const warm = rng.chance(0.7);
          g.fillStyle = warm
            ? `rgba(255, ${190 + rng.int(0, 50)}, 110, ${0.85 + rng.next() * 0.15})`
            : `rgba(150, 220, 255, ${0.8 + rng.next() * 0.2})`;
        } else {
          g.fillStyle = 'rgba(12, 16, 28, 0.9)';
        }
        g.fillRect(x * cw + 2, y * ch + 3, cw - 4, ch - 6);
      }
    }
  });
}

// Neon sign: glowing text on a dark plate.
function signTexture(text, color) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#0a0a14';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.font = 'bold 34px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2 + 1);
    g.shadowBlur = 0;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 1);
  });
}

// Radial lamp pool: soft disc of light for the road surface.
function poolTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 214, 140, 0.55)');
    grad.addColorStop(0.5, 'rgba(255, 190, 100, 0.22)');
    grad.addColorStop(1, 'rgba(255, 180, 90, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

// --- world build ------------------------------------------------------------

export function buildWorld(scene, seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const colliders = []; // {x, z, r} circles the player/car cannot pass
  const roadPoints = []; // road-center points for traffic / peds
  const lampPositions = [];

  // Sky: deep indigo night with a low moon glow.
  scene.background = new THREE.Color(0x0a0c1e);
  scene.fog = new THREE.Fog(0x0a0c1e, 120, 420);

  const hemi = new THREE.HemisphereLight(0x8fa3ff, 0x1a1426, 1.4);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xbfd0ff, 0.7);
  moon.position.set(-120, 180, 60);
  scene.add(moon);

  // Ground: one big plane, district-tinted patches on top.
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x1c1e2a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 80, CITY.half * 2 + 80), groundMat);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // District tint patches (flat, slightly above ground).
  for (const d of DISTRICTS) {
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(d.r, 28),
      new THREE.MeshLambertMaterial({ color: d.color }),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(d.cx, 0.02, d.cz);
    group.add(patch);
  }

  // Harbor water (east) and beach sand (south).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 220),
    new THREE.MeshLambertMaterial({ color: 0x0e2a3a, emissive: 0x06222e }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(300, 0.05, 0);
  group.add(water);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 90),
    new THREE.MeshLambertMaterial({ color: 0x8a7a52 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.04, 300);
  group.add(sand);

  // Roads: dark asphalt strips on the grid, with lighter centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x353542 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
  const half = CITY.half;
  const gap = CITY.roadGap;
  for (let i = -half; i <= half; i += gap) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CITY.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) road.position.set(0, 0.06, i);
      else {
        road.rotation.z = Math.PI / 2;
        road.position.set(i, 0.06, 0);
      }
      group.add(road);
      // centre dashes
      for (let d = -half + 10; d < half; d += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), dashMat);
        dash.rotation.x = -Math.PI / 2;
        if (horizontal) {
          dash.position.set(d, 0.08, i);
        } else {
          dash.rotation.z = Math.PI / 2;
          dash.position.set(i, 0.08, d);
        }
        group.add(dash);
      }
    }
    // road-centre points for traffic waypoints
    for (let j = -half; j <= half; j += gap) roadPoints.push({ x: i, z: j });
  }

  // Buildings: boxes on the blocks between roads, lit window facades.
  const facadeMats = [];
  const bases = ['#232838', '#2b2438', '#1f2c3a', '#33241f'];
  for (const base of bases) {
    const tex = facadeTexture(rng, base, 0.62);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    facadeMats.push(tex);
  }
  const buildingGeos = [
    new THREE.BoxGeometry(1, 1, 1),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x14161f });
  let buildingCount = 0;
  for (let bx = -half + gap / 2; bx < half; bx += gap) {
    for (let bz = -half + gap / 2; bz < half; bz += gap) {
      // skip water / sand areas
      if (bx > 250) continue;
      if (bz > 260) continue;
      if (rng.chance(0.14)) continue; // plaza / parking gap
      const district = DISTRICTS.find((d) => Math.hypot(bx - d.cx, bz - d.cz) < d.r) || DISTRICTS[0];
      const tall = district.tall;
      const w = rng.range(16, 26);
      const d = rng.range(16, 26);
      const h = tall ? rng.range(28, 78) : rng.range(8, 22);
      const tex = rng.pick(facadeMats);
      const repeatX = Math.max(1, Math.round(w / 12));
      const repeatY = Math.max(1, Math.round(h / 14));
      const mat = new THREE.MeshLambertMaterial({
        map: tex.clone(),
        emissive: 0xffffff,
        emissiveMap: tex.clone(),
        emissiveIntensity: 0.85,
      });
      mat.map.repeat.set(repeatX, repeatY);
      mat.emissiveMap.repeat.set(repeatX, repeatY);
      mat.map.needsUpdate = true;
      const mesh = new THREE.Mesh(buildingGeos[0], [mat, mat, roofMat, roofMat, mat, mat]);
      mesh.scale.set(w, h, d);
      mesh.position.set(bx + rng.range(-2, 2), h / 2, bz + rng.range(-2, 2));
      group.add(mesh);
      colliders.push({ x: mesh.position.x, z: mesh.position.z, r: Math.max(w, d) * 0.45 });
      buildingCount++;
      // rooftop beacon light on the tallest downtown towers
      if (tall && h > 55 && rng.chance(0.5)) {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.7, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
        );
        beacon.position.set(mesh.position.x, h + 1, mesh.position.z);
        group.add(beacon);
      }
    }
  }

  // Neon signs on downtown building faces.
  const signColors = ['#ff2ea6', '#2ee6ff', '#ffb02e', '#8dff2e', '#9b5cff'];
  let signCount = 0;
  for (let i = 0; i < 26; i++) {
    const bx = rng.range(-160, 160);
    const bz = rng.range(-180, 60);
    const text = SIGN_TEXTS[i % SIGN_TEXTS.length];
    const color = signColors[i % signColors.length];
    const tex = signTexture(text, color);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 3.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    sign.position.set(bx, rng.range(6, 26), bz);
    sign.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    group.add(sign);
    signCount++;
  }

  // Street lamps: pole + glowing head + light pool on the road.
  const poolTex = poolTexture();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f3a });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8 });
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let x = -half; x <= half; x += gap) {
    for (let z = -half; z <= half; z += gap) {
      if (x > 250 || z > 260) continue;
      const lx = x + CITY.roadWidth / 2 + 1.5;
      const lz = z + CITY.roadWidth / 2 + 1.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(lx, 3.5, lz);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), headMat);
      head.position.set(lx, 7.1, lz);
      group.add(head);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(lx, 0.09, lz);
      group.add(pool);
      lampPositions.push({ x: lx, z: lz });
    }
  }

  // Props: hydrants, bins, market stalls — foreground life on sidewalks.
  const hydrantMat = new THREE.MeshLambertMaterial({ color: 0xc22e2e });
  const binMat = new THREE.MeshLambertMaterial({ color: 0x2e5d3a });
  const stallMat = new THREE.MeshLambertMaterial({ color: 0xd8a03c });
  for (let i = 0; i < 90; i++) {
    const px = rng.range(-half, half);
    const pz = rng.range(-half, half);
    if (px > 250 || pz > 260) continue;
    const kind = rng.pick(['hydrant', 'bin', 'stall']);
    let mesh;
    if (kind === 'hydrant') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.1, 8), hydrantMat);
      mesh.position.set(px, 0.55, pz);
    } else if (kind === 'bin') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, 1), binMat);
      mesh.position.set(px, 0.65, pz);
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 2), stallMat);
      mesh.position.set(px, 0.8, pz);
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.15, 2.4),
        new THREE.MeshLambertMaterial({ color: rng.pick([0xff2ea6, 0x2ee6ff, 0xffb02e]) }),
      );
      awning.position.set(px, 1.7, pz);
      group.add(awning);
    }
    group.add(mesh);
  }

  // Parked cars along the streets (stealable with E): parked IN the road
  // at the lane edge (road centre +/- 4, road is 12 wide), facing along
  // the road — never inside a building block, where the collider would
  // jam them forever.
  const parkedSpots = [];
  for (let i = 0; i < 24; i++) {
    const road = rng.pick([-280, -240, -200, -160, -120, -80, -40, 0, 40, 80, 120, 160, 200, 240, 280]);
    const along = rng.range(-280, 280);
    const horizontal = rng.chance(0.5);
    const x = horizontal ? along : road + 4;
    const z = horizontal ? road + 4 : along;
    if (x > 250 || z > 260) continue;
    parkedSpots.push({ x, z, angle: horizontal ? Math.PI / 2 : 0 });
  }

  // Neon chips: floating glowing octahedrons worth $50 each.
  const chips = [];
  const chipGeo = new THREE.OctahedronGeometry(0.9);
  const chipMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  for (let i = 0; i < CHIP_COUNT; i++) {
    const x = rng.range(-280, 280);
    const z = rng.range(-280, 280);
    if (x > 240 || z > 250) continue;
    const mesh = new THREE.Mesh(chipGeo, chipMat);
    mesh.position.set(x, 1.6, z);
    group.add(mesh);
    chips.push({ mesh, x, z, taken: false, index: chips.length });
  }

  // Palm trees on the beach strip.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7d4a });
  for (let i = 0; i < 22; i++) {
    const px = rng.range(-200, 200);
    const pz = rng.range(272, 312);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.set(px, 3.5, pz);
    trunk.rotation.z = rng.range(-0.12, 0.12);
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.6, 6), leafMat);
    leaves.position.set(px, 7.6, pz);
    group.add(leaves);
  }

  return {
    group,
    colliders,
    roadPoints,
    lampPositions,
    parkedSpots,
    chips,
    stats: { buildings: buildingCount, signs: signCount, lamps: lampPositions.length },
  };
}

// Circle-collider test used by cars and the player on foot.
export function hitsCollider(colliders, x, z, radius) {
  for (const c of colliders) {
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = c.r + radius;
    if (dx * dx + dz * dz < rr * rr) return c;
  }
  return null;
}

export function clampToCity(x, z) {
  const m = CITY.half - 6;
  return {
    x: Math.max(-m, Math.min(m, x)),
    z: Math.max(-m, Math.min(m, z)),
  };
}
