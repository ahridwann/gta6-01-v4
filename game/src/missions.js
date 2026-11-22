// Missions, taxi fares and neon chips for Lumina City.
// Five story missions in order (briefing → beacon → reward), plus side
// work: taxi fares and 12 collectible neon chips. Pure state machine —
// the renderer only reads `beacon`, `objective` and the events returned
// by step().

import { MISSIONS, TAXI, CHIP_VALUE, CHIP_COUNT, rankForCash } from './config.js';

export function createMissionState(save) {
  return {
    nextMission: save ? save.nextMission : 0,
    active: null, // { def, stage, timer, checkpoint, ... } or null
    briefing: null, // mission def awaiting accept
    objective: 'Follow Mara’s jobs — press M for the next mission.',
    beacon: null, // { x, z, color } or null
    chipsCollected: new Set(save ? save.chips : []),
    faresDone: save ? save.fares : 0,
    taxi: null, // { customer, dest, fare } or null
  };
}

export function offerNextMission(state) {
  if (state.active || state.briefing) return null;
  if (state.nextMission >= MISSIONS.length) return null;
  state.briefing = MISSIONS[state.nextMission];
  return state.briefing;
}

export function acceptMission(state, game) {
  const def = state.briefing;
  if (!def) return false;
  state.briefing = null;
  const m = { def, timer: 0, checkpoint: 0, stage: 'go', hasVan: false };
  state.active = m;
  switch (def.kind) {
    case 'deliver':
    case 'escort':
      state.beacon = { x: def.target.x, z: def.target.z, color: 0x2ee6ff };
      break;
    case 'survive':
      state.beacon = null;
      game.setWanted(def.stars || 3);
      break;
    case 'heist':
      state.beacon = { x: def.vanAt.x, z: def.vanAt.z, color: 0xffb02e };
      break;
    case 'race':
      state.beacon = { x: def.checkpoints[0].x, z: def.checkpoints[0].z, color: 0x2ee6ff };
      break;
  }
  state.objective = def.startText;
  return true;
}

export function abortMission(state) {
  state.active = null;
  state.briefing = null;
  state.beacon = null;
  state.objective = 'Mission aborted. Press M for the next job.';
}

// Returns events: [{ type: 'complete'|'fail'|'checkpoint'|'tick', ... }]
export function stepMissions(state, game, dt) {
  const events = [];
  const m = state.active;
  if (!m) return events;
  const def = m.def;
  const pos = game.playerPos();
  const distTo = (p) => Math.hypot(pos.x - p.x, pos.z - p.z);

  const complete = (reason) => {
    state.active = null;
    state.beacon = null;
    state.nextMission++;
    game.addCash(def.reward);
    game.heal(30);
    state.objective =
      state.nextMission >= MISSIONS.length
        ? 'All missions done — Night Kingpin. Free roam, courier.'
        : `Mission complete: ${def.name} +$${def.reward}. Press M for the next job.`;
    events.push({ type: 'complete', mission: def.id, reward: def.reward, reason });
  };

  if (def.kind === 'deliver' || def.kind === 'escort') {
    if (distTo(def.target) < 7) complete('arrived');
    else if (def.kind === 'escort' && game.carHp() <= 0) {
      state.active = null;
      state.beacon = null;
      state.objective = 'The escort car was destroyed. Mission failed.';
      events.push({ type: 'fail', mission: def.id, reason: 'car destroyed' });
    }
  } else if (def.kind === 'survive') {
    m.timer += dt;
    const left = Math.max(0, Math.ceil(def.seconds - m.timer));
    state.objective = `Survive the heat! ${left}s left — ${game.wantedStars()} stars.`;
    if (game.wantedStars() < def.stars) game.setWanted(def.stars);
    if (m.timer >= def.seconds) complete('survived');
  } else if (def.kind === 'heist') {
    if (m.stage === 'go' && distTo(def.vanAt) < 6 && game.inVan()) {
      m.stage = 'deliver';
      m.hasVan = true;
      state.beacon = { x: def.target.x, z: def.target.z, color: 0x2ee6ff };
      state.objective = 'Van secured! Deliver it to the Beach Strip chop shop.';
      events.push({ type: 'checkpoint', mission: def.id, note: 'van stolen' });
    } else if (m.stage === 'deliver' && distTo(def.target) < 7 && game.inVan()) {
      complete('delivered');
    } else if (m.stage === 'go') {
      state.objective = 'Steal the armored van at the Harbor docks (drive into it and press E).';
    }
  } else if (def.kind === 'race') {
    const cp = def.checkpoints[m.checkpoint];
    if (distTo(cp) < 8) {
      m.checkpoint++;
      events.push({ type: 'checkpoint', mission: def.id, checkpoint: m.checkpoint });
      if (m.checkpoint >= def.checkpoints.length) {
        complete('race won');
      } else {
        const next = def.checkpoints[m.checkpoint];
        state.beacon = { x: next.x, z: next.z, color: 0x2ee6ff };
        state.objective = `Checkpoint ${m.checkpoint + 1} of ${def.checkpoints.length} — follow the beacon!`;
      }
    } else {
      state.objective = `Checkpoint ${m.checkpoint + 1} of ${def.checkpoints.length} — follow the beacon!`;
    }
  }
  return events;
}

// --- taxi fares ---------------------------------------------------------------

export function startTaxi(state, game, customer) {
  if (state.taxi || !customer) return false;
  const dest = game.randomRoadPoint();
  const fare = TAXI.min + Math.floor(Math.random() * (TAXI.max - TAXI.min + 1));
  state.taxi = { customer, dest, fare };
  state.beacon = { x: dest.x, z: dest.z, color: 0xffd23e };
  state.objective = `Taxi fare: take your passenger to the gold beacon ($${fare}).`;
  return true;
}

export function stepTaxi(state, game) {
  const events = [];
  if (!state.taxi) return events;
  const pos = game.playerPos();
  const d = Math.hypot(pos.x - state.taxi.dest.x, pos.z - state.taxi.dest.z);
  if (d < 7) {
    const fare = state.taxi.fare;
    state.taxi.customer.taxi = false;
    state.taxi = null;
    state.faresDone++;
    game.addCash(fare);
    state.objective = `Fare complete +$${fare}.`;
    if (state.active) {
      // restore the mission beacon
      const m = state.active;
      if (m.def.kind === 'race') {
        const cp = m.def.checkpoints[m.checkpoint];
        state.beacon = { x: cp.x, z: cp.z, color: 0x2ee6ff };
      } else if (m.def.target) {
        state.beacon = { x: m.def.target.x, z: m.def.target.z, color: 0x2ee6ff };
      } else {
        state.beacon = null;
      }
    } else {
      state.beacon = null;
    }
    events.push({ type: 'fare', fare });
  }
  return events;
}

// --- neon chips ---------------------------------------------------------------

export function checkChips(state, game, chips) {
  const events = [];
  const pos = game.playerPos();
  for (const chip of chips) {
    if (chip.taken || state.chipsCollected.has(chip.index)) continue;
    if (Math.hypot(pos.x - chip.x, pos.z - chip.z) < 3) {
      chip.taken = true;
      chip.mesh.visible = false;
      state.chipsCollected.add(chip.index);
      game.addCash(CHIP_VALUE);
      events.push({ type: 'chip', index: chip.index, value: CHIP_VALUE });
    }
  }
  return events;
}

export function chipsLeft(state) {
  return CHIP_COUNT - state.chipsCollected.size;
}

export { rankForCash };
