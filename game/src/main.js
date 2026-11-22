// Lumina City: Night Courier — boot, fixed-step loop, camera, screens.
// Screens: title → play → pause / briefing → game over (BUSTED / WASTED).
// ?shot=cover|street|chase|mission runs a deterministic staged scene for
// screenshots (no menus, HUD live). window.__game exposes live state for
// testing and the screenshot harness.

import * as THREE from '../vendor/three/three.module.min.js';
import { makeRng, hashSeed } from './rng.js';
import { CITY, MISSIONS, PLAYER, CAR, WANTED, NEON, rankForCash } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld, hitsCollider, clampToCity } from './world.js';
import { buildCar, createTraffic, stepTraffic, createPolice, stepPolice, createHelicopter } from './vehicles.js';
import { createPedestrians, stepPedestrians, pickTaxiCustomer } from './people.js';
import { createPlayer, stepOnFoot, stepDriving, enterCar, exitCar, playerPosition, playerHeading } from './player.js';
import { createParticles, createSkids, createBeacon } from './effects.js';
import { createMissionState, offerNextMission, acceptMission, abortMission, stepMissions, startTaxi, stepTaxi, checkChips, chipsLeft } from './missions.js';
import { createWanted, addWanted, setWanted, stepWanted, stepArrest, pistolShot, meleeHit, knockPed, stepDownedPeds } from './combat.js';
import { createHud } from './hud.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { SHOT_DEFS, stageShot, shotAutopilot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '7', 10) || 7;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const input = createInput(canvas);
const audio = createAudio();
const hud = createHud();

// --- world ---------------------------------------------------------------
const world = buildWorld(scene, SEED);
const rng = makeRng(hashSeed(`lumina-${SEED}`));
// Deterministic simulation RNG: traffic turns, ped wander and police
// spawn angles all draw from this, so a ?shot= run is byte-identical
// every time (Math.random would drift between runs).
const simRng = makeRng(hashSeed(`sim-${SEED}`));
const simRand = () => simRng.next();
const traffic = createTraffic(scene, rng, world.roadPoints, world.colliders, 26);
const peds = createPedestrians(scene, rng, 38);
const police = createPolice(scene);
const heli = createHelicopter(scene);
const particles = createParticles(scene);
const skids = createSkids(scene);
const beacon = createBeacon(scene);

// parked cars (stealable) + the armored van for m3
const parkedCars = [];
for (const spot of world.parkedSpots) {
  const built = buildCar({ color: rng.pick([0x3a6fd8, 0xd83a3a, 0xe8e8e8, 0x2e8b57, 0xd8a03c]) });
  built.group.position.set(spot.x, 0, spot.z);
  built.group.rotation.y = spot.angle;
  scene.add(built.group);
  parkedCars.push({ mesh: built.group, wheels: built.wheels, stolen: false, hp: 100, parked: true });
}
const vanBuilt = buildCar({ color: 0x4a4a52, van: true });
vanBuilt.group.position.set(200, 0, 60);
vanBuilt.group.rotation.y = 0;
scene.add(vanBuilt.group);
const van = { mesh: vanBuilt.group, wheels: vanBuilt.wheels, stolen: false, hp: 100, van: true };

const player = createPlayer(scene);
const wanted = createWanted();
const missions = createMissionState(loadSave());

// --- game state ------------------------------------------------------------
const state = {
  screen: 'title', // title | play | pause | briefing | over
  cash: 0,
  ammo: PLAYER.pistolAmmo,
  time: 0,
  crimeFlag: false,
  crimeTimer: 0,
  shotMode: !!SHOT,
  shotDone: false,
  shotSteps: 0,
  overTitle: '',
  overText: '',
  taxiCustomer: null,
  heliSide: 26,
  formationChase: false,
  paused: false,
};
state.cash = 0;
const save = loadSave();
if (save) {
  state.cash = save.cash;
  missions.nextMission = save.nextMission;
  missions.chipsCollected = new Set(save.chips);
  missions.faresDone = save.fares;
  for (const chip of world.chips) {
    if (missions.chipsCollected.has(chip.index)) {
      chip.taken = true;
      chip.mesh.visible = false;
    }
  }
}

function rank() {
  return rankForCash(state.cash);
}
function addCash(n) {
  state.cash += n;
  hud.setCash(state.cash);
  hud.setRank(rank());
  writeSave({ cash: state.cash, nextMission: missions.nextMission, chipsCollected: missions.chipsCollected, faresDone: missions.faresDone, rank: rank() });
}
function heal(n) {
  player.health = Math.min(PLAYER.health, player.health + n);
}

// --- helpers the shot stager + missions call -------------------------------
function playerPos() {
  return playerPosition(player);
}
function wantedStars() {
  return wanted.stars;
}
function carHp() {
  return player.inCar && player.car ? player.car.hp : 100;
}
function inVan() {
  return player.inCar && player.car === van;
}
function randomRoadPoint() {
  const p = world.roadPoints[Math.floor(Math.random() * world.roadPoints.length)];
  return { x: p.x, z: p.z };
}

const game = {
  playerPos,
  wantedStars,
  carHp,
  inVan,
  randomRoadPoint,
  setWanted(n) {
    setWanted(wanted, n);
    syncPolice();
  },
  setCash(n) {
    state.cash = n;
    hud.setCash(n);
    hud.setRank(rank());
  },
  addCash,
  heal,
  setBeacon(x, z, color) {
    beacon.show(x, z, color);
    missions.beacon = { x, z, color };
  },
  clearBeacon() {
    beacon.hide();
    missions.beacon = null;
  },
  setObjective(t) {
    missions.objective = t;
    hud.setObjective(t);
  },
  setMissionLabel(t) {
    hud.setMissionLabel(t);
  },
  placePlayerCar(x, z, angle) {
    player.ownCar.mesh.position.set(x, 0, z);
    player.ownCar.mesh.rotation.y = angle;
    if (!player.inCar) enterCar(player, player.ownCar);
    else {
      player.car = player.ownCar;
      player.car.mesh.position.set(x, 0, z);
      player.car.mesh.rotation.y = angle;
    }
    player.speed = 0;
  },
  placePlayerOnFoot(x, z, heading) {
    if (player.inCar) exitCar(player);
    player.x = x;
    player.z = z;
    player.heading = heading;
    player.mesh.position.set(x, 0, z);
    player.mesh.rotation.y = heading;
  },
  spawnTrafficNear(x, z, n, dirZ = -1) {
    for (let i = 0; i < n && i < traffic.length; i++) {
      const c = traffic[i];
      c.mesh.position.set(x + (i - n / 2) * 14 + (i % 2) * 6, 0, z + dirZ * (30 + i * 18));
      c.dir = dirZ < 0 ? Math.PI : 0;
      c.speed = 9 + i;
    }
  },
  spawnPedsNear(x, z, n) {
    let placed = 0;
    for (const p of peds) {
      if (placed >= n) break;
      p.x = x + (placed % 3) * 4 - 4;
      p.z = z + Math.floor(placed / 3) * 5 - 6;
      p.taxi = false;
      p.mesh.position.set(p.x, 0, p.z);
      placed++;
    }
  },
  spawnPoliceChase(spots) {
    for (const s of spots) police.spawn(scene, s.x, s.z, s.angle, simRng.next() * 10);
  },
  spawnHeliOffset(side, height) {
    heli.show();
    state.heliSide = side;
    const pos = playerPos();
    heli.group.position.set(pos.x + side, height || 34, pos.z + 10);
  },
  // Chase-shot formation (v4): the police AI trails the player, so a plain
  // chase never shows a cruiser alongside. In the staged chase shot the two
  // cruisers hold formation — one alongside, one right behind — and the
  // helicopter is parked over the road ahead-right, high, cone secondary.
  // Called every settle step, so the frozen frame keeps the composition.
  formationChase() {
    const pos = playerPos();
    const h = playerHeading(player);
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const rx = Math.cos(h);
    const rz = -Math.sin(h);
    const at = (fwd, right) => ({ x: pos.x + fx * fwd + rx * right, z: pos.z + fz * fwd + rz * right });
    const spots = [at(2, -5.5), at(-6, 5.5)];
    police.cars.forEach((cop, i) => {
      const s = spots[i % spots.length];
      cop.mesh.position.set(s.x, 0, s.z);
      cop.mesh.rotation.y = h;
    });
    // Helicopter parked over the road far ahead-right, high, so the cone
    // is a slim triangle in the upper frame — visible, but secondary.
    // (fwd is along the player's heading: +70 is ahead.)
    const hp = at(70, 4);
    heli.show();
    heli.group.position.set(hp.x, 34, hp.z);
    heli.group.rotation.set(0.18, h, 0);
  },
  autoDrive(dt) {
    // autopilot: full throttle, steer toward the beacon or straight ahead
    const pos = playerPos();
    const target = missions.beacon || { x: pos.x, z: pos.z - 100 };
    const want = Math.atan2(target.x - pos.x, target.z - pos.z);
    const heading = playerHeading(player);
    let dA = want - heading;
    while (dA > Math.PI) dA -= Math.PI * 2;
    while (dA < -Math.PI) dA += Math.PI * 2;
    input.testPress('up');
    if (dA > 0.15) input.testPress('left');
    else if (dA < -0.15) input.testPress('right');
    stepDriving(player, input, dt, world.colliders, (x, z, a) => skids.add(x, z, a));
    input.testRelease('left');
    input.testRelease('right');
  },
  autoWalk(dt) {
    input.testPress('up');
    stepOnFoot(player, input, dt, world.colliders);
  },
};

// --- police sync -----------------------------------------------------------
function syncPolice() {
  const want = WANTED.copsForStars[wanted.stars];
  const pos = playerPos();
  while (police.cars.length < want) {
    const a = simRng.next() * Math.PI * 2;
    police.spawn(scene, pos.x + Math.cos(a) * 46, pos.z + Math.sin(a) * 46, a, simRng.next() * 10);
  }
  while (police.cars.length > want) {
    const c = police.cars.pop();
    scene.remove(c.mesh);
  }
  if (wanted.stars >= WANTED.heliAtStars) heli.show();
  else heli.hide();
}

// --- interactions ------------------------------------------------------------
function nearestCar(maxDist) {
  const pos = playerPos();
  let best = null;
  let bestD = maxDist;
  const test = (car) => {
    if (car === player.car) return;
    const d = Math.hypot(car.mesh.position.x - pos.x, car.mesh.position.z - pos.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  };
  test(player.ownCar);
  for (const c of parkedCars) if (!c.stolen) test(c);
  if (!missions.active || missions.active.def.kind !== 'heist' || missions.active.stage === 'deliver') {
    // van is enterable once the heist has started
  }
  if (missions.active && missions.active.def.kind === 'heist' && missions.active.stage === 'go') test(van);
  return best;
}

function tryInteract() {
  if (player.inCar) {
    exitCar(player);
    hud.setHint('Press E near a car to get in.');
    return;
  }
  const car = nearestCar(4.5);
  if (!car) return;
  if (car.parked && !car.stolen) {
    car.stolen = true;
    car.parked = false;
    addWanted(wanted, 1);
    state.crimeFlag = true;
    state.crimeTimer = 3;
    hud.toast('Car stolen! +1 wanted star.');
    audio.denied();
  }
  if (car === van && !car.stolen) {
    car.stolen = true;
    addWanted(wanted, 2);
    state.crimeFlag = true;
    state.crimeTimer = 3;
    hud.toast('Armored van stolen! The cops are coming.');
  }
  enterCar(player, car);
  hud.setHint('W/S drive · Space brake · E exit · G shoot · F punch');
}

// --- combat actions ------------------------------------------------------------
function doMelee() {
  const pos = playerPos();
  const heading = playerHeading(player);
  const hit = meleeHit(pos, heading, peds.filter((p) => !p.downT), police.cars);
  audio.punch();
  if (!hit) return;
  particles.burst(pos.x + Math.sin(heading) * 2, 1.4, pos.z + Math.cos(heading) * 2, 0xffd23e, 10, 5);
  if (hit.kind === 'ped') {
    knockPed(hit.ref);
    addWanted(wanted, 1);
    state.crimeFlag = true;
    state.crimeTimer = 3;
  } else {
    hit.ref.mesh.position.x += Math.sin(heading) * 2;
    hit.ref.mesh.position.z += Math.cos(heading) * 2;
    addWanted(wanted, 1);
    state.crimeFlag = true;
    state.crimeTimer = 3;
  }
  syncPolice();
}

function doShoot() {
  if (state.ammo <= 0) {
    audio.denied();
    hud.toast('Out of ammo — finish a mission to restock.');
    return;
  }
  state.ammo--;
  hud.setAmmo(state.ammo);
  audio.gunshot();
  const pos = playerPos();
  const heading = playerHeading(player);
  const hit = pistolShot(pos, heading, peds.filter((p) => !p.downT), police.cars);
  const ex = pos.x + Math.sin(heading) * 8;
  const ez = pos.z + Math.cos(heading) * 8;
  particles.burst(ex, 1.2, ez, 0xffe6a8, 8, 4);
  if (hit) {
    particles.burst(
      hit.kind === 'ped' ? hit.ref.x : hit.ref.mesh.position.x,
      1.4,
      hit.kind === 'ped' ? hit.ref.z : hit.ref.mesh.position.z,
      0xff3b30,
      16,
      7,
    );
    if (hit.kind === 'ped') {
      knockPed(hit.ref);
    } else {
      // shooting a cop car damages it; it falls back briefly
      hit.ref.speed = Math.max(0, hit.ref.speed - 12);
    }
    addWanted(wanted, 1);
    state.crimeFlag = true;
    state.crimeTimer = 3;
    syncPolice();
  }
}

// --- screens -----------------------------------------------------------------
function showScreen(name) {
  state.screen = name;
  if (name === 'title') hud.showMenu('start');
  else if (name === 'pause') hud.showMenu('pause');
  else if (name === 'briefing') hud.showMenu('briefing');
  else if (name === 'over') hud.showMenu('over');
  else hud.hideMenus();
  input.setLocked(name === 'play');
}

function startGame() {
  audio.init();
  audio.startBassline();
  showScreen('play');
  input.lockPointer();
  hud.setObjective(missions.objective);
  hud.setMissionLabel(missions.nextMission >= MISSIONS.length ? 'All Jobs Done' : `Next: ${MISSIONS[missions.nextMission].name}`);
  hud.setHint('WASD move/drive · E enter car · M next mission · T taxi · F punch · G shoot · Esc pause');
  hud.toast('Welcome to Lumina City, Jinx. Press M for Mara’s first job.');
}

function gameOver(title, text) {
  state.overTitle = title;
  state.overText = text;
  audio.busted();
  audio.engine(0, false);
  audio.siren(false);
  hud.setGameOver(title, text);
  showScreen('over');
  input.unlockPointer();
  writeSave({ cash: state.cash, nextMission: missions.nextMission, chipsCollected: missions.chipsCollected, faresDone: missions.faresDone, rank: rank() });
}

function restartRun() {
  player.health = PLAYER.health;
  state.ammo = PLAYER.pistolAmmo;
  wanted.stars = 0;
  wanted.busted = false;
  wanted.wasted = false;
  wanted.arrestTimer = 0;
  police.clear(scene);
  heli.hide();
  abortMission(missions);
  missions.taxi = null;
  if (player.inCar) exitCar(player);
  player.x = 0;
  player.z = 40;
  player.heading = Math.PI;
  player.mesh.position.set(0, 0, 40);
  player.mesh.visible = true;
  player.ownCar.mesh.position.set(4, 0, 40);
  player.ownCar.hp = 100;
  hud.setHealth(player.health);
  hud.setAmmo(state.ammo);
  hud.setStars(0);
  startGame();
}

// --- UI wiring ---------------------------------------------------------------
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-continue').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', () => {
  showScreen('play');
  input.lockPointer();
});
document.getElementById('btn-quit').addEventListener('click', () => showScreen('title'));
document.getElementById('btn-accept').addEventListener('click', () => {
  acceptMission(missions, game);
  const m = missions.active;
  if (m) {
    hud.setMissionLabel(`${m.def.id.toUpperCase()} · ${m.def.name}`);
    hud.setObjective(m.def.startText);
    hud.toast(`Mission started: ${m.def.name}`);
  }
  showScreen('play');
  input.lockPointer();
});
document.getElementById('btn-decline').addEventListener('click', () => {
  missions.briefing = null;
  showScreen('play');
  input.lockPointer();
});
document.getElementById('btn-restart').addEventListener('click', restartRun);
document.getElementById('btn-title').addEventListener('click', () => showScreen('title'));
document.getElementById('btn-mute').addEventListener('click', () => {
  audio.setMuted(!audio.isMuted());
  document.getElementById('btn-mute').textContent = audio.isMuted() ? '🔇 Sound Off' : '🔊 Sound On';
});

// --- camera ------------------------------------------------------------------
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const pos = playerPos();
  const heading = playerHeading(player);
  const dist = player.inCar ? 11.5 : 9.5;
  const height = player.inCar ? 5.2 : 4.0;
  const backX = pos.x - Math.sin(heading) * dist;
  const backZ = pos.z - Math.cos(heading) * dist;
  const k = 1 - Math.exp(-dt * 5);
  camTarget.x += (pos.x - camTarget.x) * k;
  camTarget.z += (pos.z - camTarget.z) * k;
  camera.position.set(backX, height, backZ);
  camera.lookAt(camTarget.x, 1.6, camTarget.z);
}

// --- main loop ---------------------------------------------------------------
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = Math.min(100, now - last);
  last = now;
  acc += dtMs / 1000;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    step(STEP);
    acc -= STEP;
    steps++;
  }
  if (state.screen === 'play' || state.shotMode) {
    renderer.render(scene, camera);
  }
}

function step(dt) {
  state.time += dt;
  const t = state.time;

  // --- shot mode: staged scene, autopilot, fixed steps, then park camera
  // relative to the player and FREEZE — a frozen frame is byte-identical
  // across runs; a still-stepping world would depend on screenshot timing.
  if (state.shotMode) {
    if (!state.shotDone) {
      shotAutopilot(SHOT, game, dt);
      stepWorld(dt, t, true);
      if (state.formationChase) game.formationChase();
      state.shotSteps++;
      const def = SHOT_DEFS[SHOT];
      if (def && state.shotSteps >= def.steps) {
        state.shotDone = true;
        const pose = stageShot._pose;
        if (pose) {
          const pos = playerPos();
          const h = playerHeading(player);
          const fx = Math.sin(h);
          const fz = Math.cos(h);
          const rx = Math.cos(h);
          const rz = -Math.sin(h);
          camera.position.set(
            pos.x + rx * pose.right - fx * pose.back,
            pose.up,
            pos.z + rz * pose.right - fz * pose.back,
          );
          camera.lookAt(
            pos.x + rx * pose.lookRight + fx * pose.lookFwd,
            pose.lookUp,
            pos.z + rz * pose.lookRight + fz * pose.lookFwd,
          );
        }
        // HUD must be live in the shot: speed, stars and the minimap.
        hud.setSpeed(player.inCar ? Math.abs(player.speed) * 2.2 : 0, player.inCar);
        hud.setStars(wanted.stars);
        hud.setObjective(missions.objective);
        hud.drawMinimap({
          player: { x: playerPos().x, z: playerPos().z, heading: playerHeading(player) },
          beacon: missions.beacon,
          cops: police.cars.map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
          chips: world.chips,
        });
        window.__shotReady = true;
      }
    }
    return;
  }

  if (state.screen !== 'play') return;

  // pause
  if (input.wasPressed('pause')) {
    showScreen('pause');
    input.unlockPointer();
    return;
  }
  // mission briefing
  if (input.wasPressed('mission')) {
    const m = offerNextMission(missions);
    if (m) {
      hud.setBriefing(m);
      showScreen('briefing');
      input.unlockPointer();
      return;
    } else if (missions.nextMission >= MISSIONS.length) {
      hud.toast('All story missions complete — free roam, courier.');
    } else {
      hud.toast('Finish the current mission first.');
    }
  }

  // interactions
  if (input.wasPressed('interact')) tryInteract();
  if (input.wasPressed('melee') && !player.inCar) doMelee();
  if (input.wasPressed('shoot') && !player.inCar) doShoot();
  if (input.wasPressed('shoot') && player.inCar) doShoot();
  if (input.wasPressed('taxi') && player.inCar && !missions.taxi) {
    const pos = playerPos();
    const customer = pickTaxiCustomer(peds, pos.x, pos.z, 14);
    if (customer) {
      startTaxi(missions, game, customer);
      hud.toast(`Taxi fare accepted — $${missions.taxi.fare} to the gold beacon.`);
      beacon.show(missions.taxi.dest.x, missions.taxi.dest.z, 0xffd23e);
    } else {
      hud.toast('No passenger nearby. Drive closer to someone waiting.');
    }
  }

  // movement
  if (player.inCar) {
    const mph = stepDriving(player, input, dt, world.colliders, (x, z, a) => skids.add(x, z, a));
    hud.setSpeed(mph * 2.2, true);
    audio.engine(Math.abs(player.speed) / CAR.maxSpeed, true);
  } else {
    stepOnFoot(player, input, dt, world.colliders);
    hud.setSpeed(0, false);
    audio.engine(0, false);
  }

  stepWorld(dt, t, false);

  // mission / taxi / chips
  for (const ev of stepMissions(missions, game, dt)) {
    if (ev.type === 'complete') {
      audio.cash();
      hud.toast(`Mission complete: ${MISSIONS.find((m) => m.id === ev.mission).name} +$${ev.reward}!`);
      state.ammo = PLAYER.pistolAmmo;
      hud.setAmmo(state.ammo);
    } else if (ev.type === 'fail') {
      hud.toast('Mission failed.');
    } else if (ev.type === 'checkpoint') {
      audio.pickup();
      hud.toast(ev.note || `Checkpoint ${ev.checkpoint} cleared!`);
    }
  }
  for (const ev of stepTaxi(missions, game)) {
    if (ev.type === 'fare') {
      audio.cash();
      hud.toast(`Fare complete +$${ev.fare}.`);
    }
  }
  for (const ev of checkChips(missions, game, world.chips)) {
    if (ev.type === 'chip') {
      audio.pickup();
      particles.burst(playerPos().x, 1.6, playerPos().z, 0xffd23e, 18, 6);
      hud.toast(`Neon chip +$${ev.value} (${chipsLeft(missions)} left).`);
    }
  }

  // crime decay + police
  if (state.crimeTimer > 0) state.crimeTimer -= dt;
  stepWanted(wanted, dt, state.crimeTimer > 0);
  hud.setStars(wanted.stars);
  audio.siren(wanted.stars >= 2 && state.screen === 'play');

  // beacon + HUD
  if (missions.beacon) beacon.show(missions.beacon.x, missions.beacon.z, missions.beacon.color);
  else beacon.hide();
  hud.setObjective(missions.objective);
  hud.setHealth(player.health);
  hud.drawMinimap({
    player: { x: playerPos().x, z: playerPos().z, heading: playerHeading(player) },
    beacon: missions.beacon,
    cops: police.cars.map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
    chips: world.chips,
  });

  // BUSTED / WASTED
  if (wanted.busted) {
    gameOver('BUSTED', `The cops finally caught Juno. Cash kept: $${state.cash.toLocaleString('en-US')}.`);
    return;
  }
  if (player.health <= 0) {
    gameOver('WASTED', 'Juno went down in Lumina City. The night is not done with her yet.');
    return;
  }
}

function stepWorld(dt, t, isShot) {
  const pos = playerPos();
  // traffic + peds (seeded rand: deterministic in shot mode)
  stepTraffic(traffic, dt, t, simRand);
  const danger = player.inCar && Math.abs(player.speed) > 12 ? { x: pos.x, z: pos.z, radius: 14 } : null;
  stepPedestrians(peds, dt, t, danger, simRand);
  stepDownedPeds(peds, dt);
  // chips spin
  for (const chip of world.chips) {
    if (chip.taken) continue;
    chip.mesh.rotation.y += dt * 2;
    chip.mesh.position.y = 1.6 + Math.sin(t * 2 + chip.index) * 0.25;
  }
  // police chase + rams (no ram damage or particles in shot mode — the
  // staged frame stays clean)
  const copNear = stepPolice(police, pos, dt, t, isShot ? null : (cop) => {
    if (player.inCar && player.car) {
      player.car.hp = Math.max(0, player.car.hp - WANTED.ramDamage);
      player.health = Math.max(0, player.health - WANTED.ramDamage);
      particles.burst(pos.x, 1, pos.z, 0xff3b30, 10, 5);
      hud.setHealth(player.health);
    }
  }, !player.inCar);
  if (!isShot) {
    if (stepArrest(wanted, dt, copNear, player.inCar)) {
      wanted.busted = true;
    }
  }
  // helicopter (in the staged chase shot the formation positions it)
  if (state.formationChase) {
    // positioned by formationChase() after this step
  } else if (wanted.stars >= WANTED.heliAtStars || heli.group.visible) {
    heli.step(pos, dt, t, state.heliSide);
  }
  particles.step(dt);
  beacon.step(t);
  if (!isShot) updateCamera(dt);
  else if (!state.shotDone) updateCamera(dt);
}

// --- shot staging ------------------------------------------------------------
if (SHOT) {
  const def = SHOT_DEFS[SHOT];
  if (def) {
    state.screen = 'play';
    hud.hideMenus();
    hud.setCash(state.cash);
    hud.setRank(rank());
    hud.setHealth(player.health);
    hud.setAmmo(state.ammo);
    hud.setStars(0);
    const pose = stageShot(SHOT, game);
    stageShot._pose = pose;
    state.formationChase = SHOT === 'chase';
    syncPolice();
    // apply the staged wanted level to the HUD immediately
    hud.setStars(wanted.stars);
    hud.setObjective(missions.objective);
    camTarget.set(playerPos().x, 1.6, playerPos().z);
    window.__shotReady = false;
  }
} else {
  hud.setCash(state.cash);
  hud.setRank(rank());
  hud.setHealth(player.health);
  hud.setAmmo(state.ammo);
  hud.setStars(0);
  hud.setObjective(missions.objective);
  showScreen('title');
}

// resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- debug / test handle ------------------------------------------------------
window.__game = {
  state,
  player,
  wanted,
  missions,
  police,
  heli,
  peds,
  traffic,
  world,
  hud,
  input,
  audio,
  get cash() {
    return state.cash;
  },
  get screen() {
    return state.screen;
  },
  startGame,
  restartRun,
  inVan,
  acceptMission: () => acceptMission(missions, game),
  offerNextMission: () => offerNextMission(missions),
  setWanted: (n) => {
    setWanted(wanted, n);
    syncPolice();
  },
  teleportCar(x, z) {
    if (!player.inCar) enterCar(player, player.ownCar);
    player.car.mesh.position.set(x, 0, z);
  },
  teleportOnFoot(x, z) {
    if (player.inCar) exitCar(player);
    player.x = x;
    player.z = z;
    player.mesh.position.set(x, 0, z);
  },
  damage(n) {
    player.health = Math.max(0, player.health - n);
  },
  version: 'lumina-city-v4',
};

requestAnimationFrame(frame);
