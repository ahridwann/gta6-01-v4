// Lumina City tuning, districts, missions and ranks.
// One place for every number the rest of the game reads, so balance tweaks
// never mean hunting through gameplay code.

export const SAVE_KEY = 'lumina-city-save-v1';

// World layout: a 640 x 640 city, roads on a 40-unit grid.
export const CITY = {
  half: 320,
  roadGap: 40,
  roadWidth: 12,
  sidewalk: 3,
};

export const DISTRICTS = [
  { name: 'Downtown', cx: 0, cz: -40, r: 130, tall: true, color: 0x2a2f45 },
  { name: 'Harbor', cx: 230, cz: 0, r: 95, tall: false, color: 0x1d2f3a },
  { name: 'Suburbs', cx: -230, cz: -20, r: 100, tall: false, color: 0x27301f },
  { name: 'Beach Strip', cx: 0, cz: 240, r: 110, tall: false, color: 0x33241f },
  { name: 'North End', cx: -40, cz: -240, r: 90, tall: false, color: 0x241f33 },
];

export const PLAYER = {
  walkSpeed: 9,
  runSpeed: 14,
  health: 100,
  pistolAmmo: 24,
  meleeRange: 2.6,
  meleeDamage: 34,
  pistolDamage: 55,
};

export const CAR = {
  accel: 26,
  brake: 42,
  maxSpeed: 42,
  reverseSpeed: 14,
  turn: 1.9,
  grip: 6.5,
};

export const WANTED = {
  decaySeconds: 22,
  // police cars on the street per star level
  copsForStars: [0, 1, 2, 3, 4, 5],
  heliAtStars: 4,
  ramDamage: 2,
  ramCooldown: 2.5,
  arrestRange: 3.2,
  arrestSeconds: 2.2,
};

export const MISSIONS = [
  {
    id: 'm1',
    name: 'First Drop',
    brief:
      'Mara Voss needs a package across Downtown. Take the magenta courier car, follow the beacon, and drop it clean. No police, no fuss.',
    reward: 250,
    kind: 'deliver',
    target: { x: 120, z: -120 },
    startText: 'Drive to the beacon and deliver the package.',
  },
  {
    id: 'm2',
    name: 'Heat Wave',
    brief:
      'A rival crew tipped off the cops. You are at 3 stars and the whole district is looking for you. Survive 60 seconds — lose them or outrun them.',
    reward: 400,
    kind: 'survive',
    seconds: 60,
    stars: 3,
    startText: 'Survive 60 seconds at 3 stars!',
  },
  {
    id: 'm3',
    name: 'The Armored Haul',
    brief:
      'An armored van is parked by the Harbor docks. Take it — the keys are in it — and bring it to the chop shop on the Beach Strip. Expect company.',
    reward: 650,
    kind: 'heist',
    vanAt: { x: 200, z: 60 },
    target: { x: -40, z: 240 },
    startText: 'Steal the armored van at the Harbor, then deliver it south.',
  },
  {
    id: 'm4',
    name: 'Midnight Grand Prix',
    brief:
      'Five checkpoints, one loop through the city, fastest courier wins the pot. Hit every ring in order — miss one and the race is void.',
    reward: 850,
    kind: 'race',
    checkpoints: [
      { x: 0, z: -200 },
      { x: 160, z: -160 },
      { x: 200, z: 120 },
      { x: -120, z: 200 },
      { x: -200, z: -120 },
    ],
    startText: 'Race through all 5 checkpoints in order!',
  },
  {
    id: 'm5',
    name: 'The Escort',
    brief:
      'Mara herself is riding shotgun tonight. Drive her to the North End safehouse while the cops throw everything at you. Do not let the car die.',
    reward: 1200,
    kind: 'escort',
    target: { x: -40, z: -240 },
    stars: 3,
    startText: 'Escort Mara to the North End safehouse. Keep the car alive!',
  },
];

export const RANKS = [
  { cash: 0, name: 'Street Rookie' },
  { cash: 500, name: 'Wheelman' },
  { cash: 1200, name: 'Night Runner' },
  { cash: 2200, name: 'City Ghost' },
  { cash: 3500, name: 'Night Kingpin' },
];

export function rankForCash(cash) {
  let rank = RANKS[0].name;
  for (const r of RANKS) if (cash >= r.cash) rank = r.name;
  return rank;
}

export const TAXI = { min: 60, max: 130 };
export const CHIP_VALUE = 50;
export const CHIP_COUNT = 12;

// Neon palette used across signs, cars and UI.
export const NEON = {
  magenta: 0xff2ea6,
  cyan: 0x2ee6ff,
  amber: 0xffb02e,
  lime: 0x8dff2e,
  violet: 0x9b5cff,
  red: 0xff3b30,
  blue: 0x2e7dff,
};

export const SIGN_TEXTS = [
  'GARAGE 9',
  'CLUB VOLT',
  'NEON MOTEL',
  'LUMINA 24H',
  'RAMEN BAR',
  'HOTEL NOVA',
  'PIER 12',
  'TURBO WASH',
  'CASINO LUX',
  'DONUT KING',
];
