// Seeded RNG for Lumina City: deterministic world gen and shot staging.
// mulberry32 — small, fast, and stable across engines, so the same seed
// always builds the same city on any machine.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [min, max)
    range(min, max) {
      return min + next() * (max - min);
    },
    // integer in [min, max]
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // pick one element
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // true with probability p
    chance(p) {
      return next() < p;
    },
  };
}

// A tiny deterministic hash of a string, for seeding from names.
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
