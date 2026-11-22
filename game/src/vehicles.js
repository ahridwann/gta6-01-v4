// Vehicles for Lumina City: low-poly cars built from boxes, AI traffic that
// follows the road grid, police cruisers with flashing light bars, and the
// police helicopter with its searchlight cone.

import * as THREE from '../vendor/three/three.module.min.js';
import { NEON, CAR } from './config.js';
import { makeRng } from './rng.js';
import { clampToCity } from './world.js';

const TRAFFIC_COLORS = [0x3a6fd8, 0xd83a3a, 0xe8e8e8, 0x2e8b57, 0xd8a03c, 0x7a4fd0, 0x222831];

// Build one low-poly car. Options: color, police (light bar), taxi (sign),
// van (taller box). Returns { group, wheels, lightBar, headlights }.
export function buildCar({ color = 0xff2ea6, police = false, taxi = false, van = false } = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x11131c });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x0a2030, emissive: 0x0a2a3a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, van ? 5.2 : 4.4), bodyMat);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, van ? 3.4 : 2.1), glassMat);
  cabin.position.set(0, 1.3, van ? -0.3 : -0.2);
  group.add(cabin);

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
  const wheels = [];
  const len = van ? 1.9 : 1.5;
  for (const [wx, wz] of [[-1.0, len], [1.0, len], [-1.0, -len], [1.0, -len]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    group.add(w);
    wheels.push(w);
  }

  // headlights: emissive white boxes + a fake beam plane on the road
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const hx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    hl.position.set(hx, 0.62, van ? 2.62 : 2.22);
    group.add(hl);
  }
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 7), beamMat);
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.12, van ? 6 : 5.4);
  group.add(beam);

  // taillights
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const tx of [-0.65, 0.65]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1), tailMat);
    tl.position.set(tx, 0.62, van ? -2.62 : -2.22);
    group.add(tl);
  }

  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    red.position.x = -0.32;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }),
    );
    blue.position.x = 0.32;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.78, -0.2);
    lightBar.userData.red = red;
    lightBar.userData.blue = blue;
    group.add(lightBar);
    // black-and-white cruiser doors
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    for (const dx of [-1.06, 1.06]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 1.6), doorMat);
      door.position.set(dx, 0.66, 0);
      group.add(door);
    }
  }

  if (taxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    sign.position.set(0, 1.85, -0.2);
    group.add(sign);
  }

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return { group, wheels, lightBar, beam };
}

// --- traffic ----------------------------------------------------------------

export function createTraffic(scene, rng, roadPoints, colliders, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const spot = roadPoints[Math.floor(rng.next() * roadPoints.length)];
    const taxi = rng.chance(0.25);
    const built = buildCar({ color: rng.pick(TRAFFIC_COLORS), taxi });
    built.group.position.set(spot.x + rng.range(-2, 2), 0, spot.z + rng.range(-2, 2));
    scene.add(built.group);
    cars.push({
      mesh: built.group,
      wheels: built.wheels,
      // drive along one axis of the grid, then turn at intersections
      dir: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      speed: rng.range(7, 13),
      taxi,
      wait: 0,
    });
  }
  return cars;
}

export function stepTraffic(cars, dt, t, rand = Math.random) {
  for (const c of cars) {
    if (c.wait > 0) {
      c.wait -= dt;
      continue;
    }
    const dx = Math.sin(c.dir);
    const dz = Math.cos(c.dir);
    let nx = c.mesh.position.x + dx * c.speed * dt;
    let nz = c.mesh.position.z + dz * c.speed * dt;
    const cl = clampToCity(nx, nz);
    // reached the city edge: turn around
    if (cl.x !== nx || cl.z !== nz) {
      c.dir += Math.PI;
      nx = cl.x;
      nz = cl.z;
    }
    // at an intersection, sometimes turn
    const onGridX = Math.abs(((nx % 40) + 40) % 40) < 1.2;
    const onGridZ = Math.abs(((nz % 40) + 40) % 40) < 1.2;
    if ((onGridX || onGridZ) && rand() < 0.012) {
      c.dir += (rand() < 0.5 ? 1 : -1) * (Math.PI / 2);
      c.wait = 0.4;
    }
    c.mesh.position.x = nx;
    c.mesh.position.z = nz;
    c.mesh.rotation.y = c.dir;
    for (const w of c.wheels) w.rotation.x += (c.speed * dt) / 0.42;
  }
}

// --- police -----------------------------------------------------------------

export function createPolice(scene) {
  return {
    cars: [],
    spawn(scene, x, z, angle, phase = 0) {
      const built = buildCar({ color: 0x14161c, police: true });
      built.group.position.set(x, 0, z);
      built.group.rotation.y = angle;
      scene.add(built.group);
      const cop = {
        mesh: built.group,
        wheels: built.wheels,
        lightBar: built.lightBar,
        speed: 0,
        ramCooldown: 0,
        phase,
      };
      this.cars.push(cop);
      return cop;
    },
    clear(scene) {
      for (const c of this.cars) scene.remove(c.mesh);
      this.cars.length = 0;
    },
  };
}

// Chase the target (player car or on-foot player). Returns true if any cop
// is close enough to start an arrest. When the target is on foot, a cop
// that closes in STOPS beside them (an arrest, not a ram) so the arrest
// timer can actually complete; in a car the cops keep ramming.
export function stepPolice(police, target, dt, t, onRam, targetOnFoot = false) {
  let arrestNear = false;
  for (const cop of police.cars) {
    const dx = target.x - cop.mesh.position.x;
    const dz = target.z - cop.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const wantAngle = Math.atan2(dx, dz);
    let dA = wantAngle - cop.mesh.rotation.y;
    while (dA > Math.PI) dA -= Math.PI * 2;
    while (dA < -Math.PI) dA += Math.PI * 2;
    cop.mesh.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, dA));
    const targetSpeed = targetOnFoot && dist < 6 ? 0 : dist > 26 ? 34 : dist > 10 ? 26 : 14;
    cop.speed += Math.max(-30 * dt, Math.min(30 * dt, targetSpeed - cop.speed));
    cop.mesh.position.x += Math.sin(cop.mesh.rotation.y) * cop.speed * dt;
    cop.mesh.position.z += Math.cos(cop.mesh.rotation.y) * cop.speed * dt;
    for (const w of cop.wheels) w.rotation.x += (cop.speed * dt) / 0.42;
    // flashing light bar: red/blue alternate
    if (cop.lightBar) {
      const on = Math.floor(t * 6 + cop.phase) % 2 === 0;
      cop.lightBar.userData.red.material.color.setHex(on ? 0xff2222 : 0x550000);
      cop.lightBar.userData.blue.material.color.setHex(on ? 0x111166 : 0x2266ff);
    }
    cop.ramCooldown -= dt;
    if (dist < 4.2 && cop.ramCooldown <= 0) {
      cop.ramCooldown = 2.5;
      if (onRam) onRam(cop, dist);
    }
    if (dist < 5.5) arrestNear = true;
  }
  return arrestNear;
}

// --- helicopter -------------------------------------------------------------

export function createHelicopter(scene) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x35465c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 5.4), bodyMat);
  group.add(body);
  // red anti-collision beacon on top + white belly strobe, so the heli
  // reads against the night sky instead of vanishing into it
  const beaconLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }),
  );
  beaconLight.position.set(0, 1.1, 0);
  group.add(beaconLight);
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  strobe.position.set(0, -0.9, 0);
  group.add(strobe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5), bodyMat);
  tail.position.set(0, 0.3, -4.6);
  group.add(tail);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.0, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x0a2a3a, emissive: 0x0a2a3a }),
  );
  glass.position.set(0, -0.2, 2.2);
  group.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  rotor.position.y = 1.1;
  group.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  tailRotor.position.set(0, 0.4, -6.8);
  group.add(tailRotor);
  // searchlight cone: additive, semi-transparent — bright but never the
  // whole frame; the chase shot keeps it off to one side.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c8,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 34, 20, 1, true), coneMat);
  cone.position.y = -17.5;
  group.add(cone);
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 20),
    new THREE.MeshBasicMaterial({
      color: 0xfff2b0,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = -34;
  group.add(spot);
  group.visible = false;
  scene.add(group);
  return {
    group,
    rotor,
    cone,
    spot,
    angle: 0,
    show() {
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    // orbit above the target, offset to the side so the cone never sits
    // dead-centre over the player; rotor spins.
    step(target, dt, t, sideOffset = 26) {
      if (!group.visible) return;
      this.angle += dt * 0.35;
      const hx = target.x + Math.cos(this.angle) * sideOffset;
      const hz = target.z + Math.sin(this.angle) * sideOffset;
      group.position.set(hx, 34, hz);
      group.lookAt(target.x, 0, target.z);
      rotor.rotation.y += dt * 22;
      // cone + pool track the target from the offset position
      cone.lookAt(target.x - hx, -34, target.z - hz);
      cone.rotation.x += Math.PI / 2;
      spot.position.set(target.x - hx, -34, target.z - hz);
    },
  };
}
