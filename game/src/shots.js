// Deterministic screenshot staging for Lumina City (?shot=cover|street|
// chase|mission). Each shot builds the real game from a fixed seed, places
// the player, traffic, police and helicopter deliberately, then runs the
// simulation forward a fixed number of steps so the frame is alive —
// then the camera is parked RELATIVE to the player (right / up / back /
// look-ahead in the player's own frame), so the player is always in
// frame no matter how far the autopilot drove. Same seed + same steps
// = the same pixels, every run.
//
// The chase shot is the v4 fix: two police cruisers with flashing light
// bars sit alongside and just behind the player's car, close and legible,
// while the helicopter holds high and off to the right — its searchlight
// cone is visible but secondary, never the centre of the frame.

export const SHOT_DEFS = {
  cover: {
    label: 'Cover — driving with wanted stars, mission beacon, HUD and minimap',
    seed: 101,
    steps: 150,
  },
  street: {
    label: 'On foot — peds, traffic and neon signs on a downtown street',
    seed: 202,
    steps: 120,
  },
  chase: {
    label: 'Chase — 5 stars, police cruisers with light bars beside the player, helicopter cone off to the side',
    seed: 303,
    steps: 170,
  },
  mission: {
    label: 'Race checkpoint — beacon and ring ahead, speed on the HUD',
    seed: 404,
    steps: 150,
  },
};

// Camera pose, relative to the player: right / up / back (metres behind)
// and the look point (ahead / right / up). The camera stays over the road
// corridor (right offset only +/-3) so it never ends up inside a building
// face — the road is 12 wide and the blocks start just past it.
const CAM = {
  cover: { right: 3, up: 6.5, back: 15, lookFwd: 32, lookRight: 0, lookUp: 1.6 },
  street: { right: -3, up: 4.5, back: 10, lookFwd: 24, lookRight: 1, lookUp: 1.8 },
  chase: { right: 3, up: 7, back: 17, lookFwd: 20, lookRight: 0, lookUp: 6 },
  mission: { right: 3, up: 6.5, back: 15, lookFwd: 42, lookRight: 0, lookUp: 1.6 },
};

// Place the shot's actors. `game` is the live game object (see main.js).
// Returns the relative camera pose for the shot.
export function stageShot(name, game) {
  const g = game;
  if (name === 'cover') {
    // Downtown straight, magenta courier car mid-road heading for the
    // beacon, 2 stars, traffic and peds around.
    g.placePlayerCar(0, -60, Math.PI);
    g.setWanted(2);
    g.setBeacon(0, -180, 0x2ee6ff);
    g.setObjective('Mission 1: First Drop — follow the beacon to the drop.');
    g.setMissionLabel('M1 · First Drop');
    g.spawnTrafficNear(0, -100, 6);
    g.spawnPedsNear(0, -80, 5);
    g.setCash(1250);
    return CAM.cover;
  }
  if (name === 'street') {
    // On foot, walking straight down the x=0 road so Juno and the camera
    // stay on the road, never inside a building face: peds + traffic + signs.
    g.placePlayerOnFoot(0, -40, 0);
    g.setWanted(0);
    g.clearBeacon();
    g.setObjective('Explore Lumina City — press M for Mara’s next job.');
    g.setMissionLabel('Free Roam');
    // Juno walks +z from here, so stage traffic and peds AHEAD of her.
    g.spawnTrafficNear(0, -10, 5, 1);
    g.spawnPedsNear(0, -15, 10);
    g.setCash(640);
    return CAM.street;
  }
  if (name === 'chase') {
    // THE CHASE SHOT (v4): 5 stars, player car centre-frame on a straight
    // downtown run, heading -z. Two cruisers with flashing light bars: one
    // alongside on the right, one tucked in right behind — both close,
    // both legible. Helicopter high and to the RIGHT, cone angled
    // down-left, secondary. Traffic ahead, lit towers behind.
    g.placePlayerCar(0, 20, Math.PI);
    g.setWanted(5);
    g.clearBeacon();
    g.setObjective('5 stars — lose the cops or outrun them!');
    g.setMissionLabel('WANTED · 5 STARS');
    g.spawnPoliceChase([
      { x: -5.5, z: 26, angle: Math.PI }, // alongside right, light bar in frame
      { x: 5.0, z: 36, angle: Math.PI }, // right behind, light bar in frame
    ]);
    g.spawnHeliOffset(46, 30); // high, to the right — cone secondary
    g.spawnTrafficNear(0, -40, 5);
    g.spawnPedsNear(0, 0, 3);
    g.setCash(2310);
    return CAM.chase;
  }
  if (name === 'mission') {
    // Race checkpoint: cyan beacon + ring ahead on a long straight, the
    // courier car at speed, a taxi ahead for life.
    g.placePlayerCar(0, -40, Math.PI);
    g.setWanted(0);
    g.setBeacon(0, -200, 0x2ee6ff);
    g.setObjective('Midnight Grand Prix — checkpoint 1 of 5, follow the beacon!');
    g.setMissionLabel('M4 · Midnight Grand Prix');
    g.spawnTrafficNear(0, -120, 4);
    g.spawnPedsNear(0, -90, 3);
    g.setCash(1980);
    return CAM.mission;
  }
  return null;
}

// Simple autopilot used while a shot settles: drive straight ahead (or
// walk forward) so traffic, peds and the helicopter keep moving.
export function shotAutopilot(name, game, dt) {
  if (name === 'street') {
    game.autoWalk(dt);
    return;
  }
  game.autoDrive(dt);
}
