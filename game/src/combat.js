// Combat and wanted level for Lumina City.
// Melee (F) and pistol (G, 24 rounds) against peds and cops; crimes raise
// wanted stars, which spawn police cruisers that chase and ram, and a
// helicopter at 4–5 stars. On foot, a cop that stays close long enough
// arrests Juno — BUSTED. Health at zero is WASTED.

import { WANTED, PLAYER } from './config.js';

export function createWanted() {
  return {
    stars: 0,
    decayTimer: 0,
    arrestTimer: 0,
    busted: false,
    wasted: false,
  };
}

export function addWanted(wanted, n) {
  wanted.stars = Math.max(0, Math.min(5, wanted.stars + n));
  wanted.decayTimer = 0;
}

export function setWanted(wanted, n) {
  wanted.stars = Math.max(0, Math.min(5, n));
  wanted.decayTimer = 0;
}

// Wanted decays when Juno stays clean: one star per decay window.
export function stepWanted(wanted, dt, committingCrime) {
  if (wanted.stars <= 0) return;
  if (committingCrime) {
    wanted.decayTimer = 0;
    return;
  }
  wanted.decayTimer += dt;
  const window = WANTED.decaySeconds + wanted.stars * 6;
  if (wanted.decayTimer >= window) {
    wanted.stars--;
    wanted.decayTimer = 0;
  }
}

// On-foot arrest: cops close by for arrestSeconds straight → BUSTED.
export function stepArrest(wanted, dt, copNear, inCar) {
  if (inCar || wanted.stars === 0) {
    wanted.arrestTimer = 0;
    return false;
  }
  if (copNear) {
    wanted.arrestTimer += dt;
    if (wanted.arrestTimer >= WANTED.arrestSeconds) {
      wanted.busted = true;
      return true;
    }
  } else {
    wanted.arrestTimer = Math.max(0, wanted.arrestTimer - dt * 2);
  }
  return false;
}

// Pistol hitscan: from the player toward the camera/heading direction.
// Returns the hit target { kind: 'ped'|'cop', ref } or null.
export function pistolShot(playerPos, heading, peds, cops, range = 46) {
  const dx = Math.sin(heading);
  const dz = Math.cos(heading);
  let best = null;
  let bestT = range;
  const test = (x, z, kind, ref) => {
    const rx = x - playerPos.x;
    const rz = z - playerPos.z;
    const t = rx * dx + rz * dz;
    if (t < 1 || t > bestT) return;
    const perp = Math.abs(rx * dz - rz * dx);
    if (perp < 2.2) {
      bestT = t;
      best = { kind, ref, dist: t };
    }
  };
  for (const p of peds) test(p.x, p.z, 'ped', p);
  for (const c of cops) test(c.mesh.position.x, c.mesh.position.z, 'cop', c);
  return best;
}

// Melee swing: hits the nearest ped/cop inside melee range in front.
export function meleeHit(playerPos, heading, peds, cops) {
  const dx = Math.sin(heading);
  const dz = Math.cos(heading);
  let best = null;
  let bestD = PLAYER.meleeRange;
  const test = (x, z, kind, ref) => {
    const rx = x - playerPos.x;
    const rz = z - playerPos.z;
    const d = Math.hypot(rx, rz);
    if (d > bestD) return;
    if (d > 0.5 && rx * dx + rz * dz < 0) return; // must be roughly ahead
    bestD = d;
    best = { kind, ref, dist: d };
  };
  for (const p of peds) test(p.x, p.z, 'ped', p);
  for (const c of cops) test(c.mesh.position.x, c.mesh.position.z, 'cop', c);
  return best;
}

// Knock a ped down: they fall over and stay down a while, then get up.
export function knockPed(ped) {
  ped.mesh.rotation.x = -Math.PI / 2;
  ped.mesh.position.y = 0.4;
  ped.downT = 3;
  ped.fleeing = true;
  ped.fleeT = 4;
}

export function stepDownedPeds(peds, dt) {
  for (const p of peds) {
    if (p.downT > 0) {
      p.downT -= dt;
      if (p.downT <= 0) {
        p.mesh.rotation.x = 0;
        p.mesh.position.y = 0;
      }
    }
  }
}
