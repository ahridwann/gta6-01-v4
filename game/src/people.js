// Pedestrians for Lumina City: low-poly walkers on the sidewalks who stroll,
// wait for taxis, and flee from danger (speeding cars, gunfire, police).
// A few are flagged as taxi customers waiting for a fare.

import * as THREE from '../vendor/three/three.module.min.js';
import { makeRng } from './rng.js';
import { clampToCity } from './world.js';

const SHIRT_COLORS = [0xd83a6f, 0x3a9fd8, 0xe8d83a, 0x5ad83a, 0xd86a3a, 0x8a5ad8, 0xe8e8e8, 0x222831];

export function createPedestrians(scene, rng, count) {
  const peds = [];
  const bodyGeo = new THREE.CylinderGeometry(0.42, 0.5, 1.15, 8);
  const headGeo = new THREE.SphereGeometry(0.34, 10, 8);
  const legGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.85, 6);
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1c2030 });

  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const shirtMat = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLORS) });
    const body = new THREE.Mesh(bodyGeo, shirtMat);
    body.position.y = 1.35;
    group.add(body);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 2.2;
    group.add(head);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.2, 0.42, 0);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.set(0.2, 0.42, 0);
    group.add(legR);

    const x = rng.range(-290, 290);
    const z = rng.range(-290, 290);
    group.position.set(x, 0, z);
    scene.add(group);
    peds.push({
      mesh: group,
      legL,
      legR,
      x,
      z,
      dir: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.4),
      fleeing: false,
      fleeT: 0,
      taxi: false, // set true when this ped is a waiting taxi customer
      walkPhase: rng.range(0, 10),
    });
  }
  return peds;
}

export function stepPedestrians(peds, dt, t, danger, rand = Math.random) {
  // danger: {x, z, radius} or null — peds inside the radius flee away.
  for (const p of peds) {
    let fleeing = p.fleeing;
    if (danger) {
      const dx = p.x - danger.x;
      const dz = p.z - danger.z;
      const d = Math.hypot(dx, dz);
      if (d < danger.radius) {
        p.dir = Math.atan2(dx, dz);
        fleeing = true;
        p.fleeT = 1.6;
      }
    }
    if (p.fleeT > 0) {
      p.fleeT -= dt;
      if (p.fleeT <= 0) fleeing = false;
    }
    p.fleeing = fleeing;
    const speed = fleeing ? p.speed * 3.2 : p.taxi ? 0 : p.speed;
    p.x += Math.sin(p.dir) * speed * dt;
    p.z += Math.cos(p.dir) * speed * dt;
    const cl = clampToCity(p.x, p.z);
    if (cl.x !== p.x || cl.z !== p.z) {
      p.dir += Math.PI;
      p.x = cl.x;
      p.z = cl.z;
    }
    // wander: small random heading changes while strolling
    if (!fleeing && !p.taxi && rand() < 0.004) {
      p.dir += (rand() - 0.5) * 1.6;
    }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.dir;
    // walk cycle: legs swing
    p.walkPhase += dt * speed * 3.2;
    const swing = Math.sin(p.walkPhase) * (speed > 0.1 ? 0.5 : 0);
    p.legL.rotation.x = swing;
    p.legR.rotation.x = -swing;
  }
}

// Pick a ped near (x, z) to become a taxi customer, or null.
export function pickTaxiCustomer(peds, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const p of peds) {
    if (p.taxi || p.fleeing) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (best) best.taxi = true;
  return best;
}
