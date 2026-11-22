// The player: Juno "Jinx" Reyes, on foot and behind the wheel.
// On foot: WASD + mouse-look, run with Shift. In a car: W/S throttle and
// brake/reverse, A/D steering, Space handbrake. E enters / steals the
// nearest car. Skid marks trail the rear wheels at speed.

import * as THREE from '../vendor/three/three.module.min.js';
import { PLAYER, CAR } from './config.js';
import { hitsCollider, clampToCity } from './world.js';
import { buildCar } from './vehicles.js';

export function createPlayer(scene) {
  // On-foot body: jacket, head, legs — visible in the street shot.
  const group = new THREE.Group();
  const jacketMat = new THREE.MeshLambertMaterial({ color: 0xff2ea6 });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1c2030 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.15, 8), jacketMat);
  body.position.y = 1.35;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), skinMat);
  head.position.y = 2.2;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.85, 6), pantsMat);
  legL.position.set(-0.2, 0.42, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  group.add(legR);
  // a magenta cap so Juno reads in a crowd
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.18, 10), jacketMat);
  cap.position.y = 2.48;
  group.add(cap);
  group.position.set(0, 0, 40);
  scene.add(group);

  // Juno's own courier car — magenta, always hers.
  const own = buildCar({ color: 0xff2ea6 });
  own.group.position.set(4, 0, 40);
  scene.add(own.group);

  return {
    mesh: group,
    legL,
    legR,
    x: 0,
    z: 40,
    heading: Math.PI,
    walkPhase: 0,
    health: PLAYER.health,
    inCar: false,
    car: null, // { mesh, wheels, stolen, hp } when driving
    ownCar: { mesh: own.group, wheels: own.wheels, stolen: false, hp: 100 },
    speed: 0, // signed car speed (units/s)
    steer: 0,
  };
}

// --- on foot ---------------------------------------------------------------

export function stepOnFoot(player, input, dt, colliders) {
  const look = input.takeMouse();
  player.heading -= look.dx * 0.0032;
  const fwd = input.held('up') ? 1 : input.held('down') ? -0.6 : 0;
  const strafe = input.held('right') ? 1 : input.held('left') ? -1 : 0;
  const speed = input.held('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(player.heading);
  const cos = Math.cos(player.heading);
  let mx = (sin * fwd + cos * strafe) * speed * dt;
  let mz = (cos * fwd - sin * strafe) * speed * dt;
  const nx = player.x + mx;
  const nz = player.z + mz;
  const hit = hitsCollider(colliders, nx, nz, 0.6);
  if (!hit) {
    player.x = nx;
    player.z = nz;
  } else {
    // slide along the wall instead of stopping dead
    if (!hitsCollider(colliders, player.x + mx, player.z, 0.6)) player.x += mx;
    else if (!hitsCollider(colliders, player.x, player.z + mz, 0.6)) player.z += mz;
  }
  const cl = clampToCity(player.x, player.z);
  player.x = cl.x;
  player.z = cl.z;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  const moving = Math.abs(fwd) + Math.abs(strafe) > 0;
  player.walkPhase += dt * (moving ? speed * 1.6 : 0);
  const swing = Math.sin(player.walkPhase) * (moving ? 0.55 : 0);
  player.legL.rotation.x = swing;
  player.legR.rotation.x = -swing;
  return moving;
}

// --- driving ---------------------------------------------------------------

export function enterCar(player, car) {
  player.inCar = true;
  player.car = car;
  player.mesh.visible = false;
  player.speed = 0;
}

export function exitCar(player) {
  if (!player.car) return;
  player.inCar = false;
  const a = player.car.mesh.rotation.y;
  player.x = player.car.mesh.position.x + Math.sin(a + Math.PI / 2) * 2.4;
  player.z = player.car.mesh.position.z + Math.cos(a + Math.PI / 2) * 2.4;
  player.heading = a;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.visible = true;
  player.car = null;
  player.speed = 0;
}

export function stepDriving(player, input, dt, colliders, onSkid) {
  const car = player.car;
  if (!car) return 0;
  const mesh = car.mesh;
  const throttle = input.held('up') ? 1 : input.held('down') ? -1 : 0;
  const steerIn = input.held('left') ? 1 : input.held('right') ? -1 : 0;
  const handbrake = input.held('brake');

  // steering eases toward the input; faster cars turn less
  const speedFactor = Math.max(0.35, 1 - Math.abs(player.speed) / (CAR.maxSpeed * 1.6));
  player.steer += (steerIn * speedFactor - player.steer) * Math.min(1, dt * 8);

  if (throttle > 0) player.speed += CAR.accel * dt;
  else if (throttle < 0) {
    if (player.speed > 1) player.speed -= CAR.brake * dt;
    else player.speed -= CAR.accel * 0.6 * dt;
  } else {
    player.speed -= player.speed * Math.min(1, dt * 1.4);
  }
  if (handbrake) player.speed -= player.speed * Math.min(1, dt * 6);
  player.speed = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, player.speed));

  mesh.rotation.y += player.steer * CAR.turn * (player.speed / CAR.maxSpeed) * dt * (player.speed < 0 ? -1 : 1);
  const nx = mesh.position.x + Math.sin(mesh.rotation.y) * player.speed * dt;
  const nz = mesh.position.z + Math.cos(mesh.rotation.y) * player.speed * dt;
  const hit = hitsCollider(colliders, nx, nz, 1.6);
  if (!hit) {
    mesh.position.x = nx;
    mesh.position.z = nz;
  } else {
    player.speed *= 0.35;
  }
  const cl = clampToCity(mesh.position.x, mesh.position.z);
  mesh.position.x = cl.x;
  mesh.position.z = cl.z;

  // wheels spin + steer visually
  for (const w of car.wheels) w.rotation.x += (player.speed * dt) / 0.42;
  // skid marks when handbraking at speed or steering hard
  if (onSkid && ((handbrake && Math.abs(player.speed) > 14) || (Math.abs(player.steer) > 0.7 && Math.abs(player.speed) > 20))) {
    onSkid(mesh.position.x, mesh.position.z, mesh.rotation.y);
  }
  return Math.abs(player.speed);
}

export function playerPosition(player) {
  if (player.inCar && player.car) {
    return { x: player.car.mesh.position.x, z: player.car.mesh.position.z };
  }
  return { x: player.x, z: player.z };
}

export function playerHeading(player) {
  if (player.inCar && player.car) return player.car.mesh.rotation.y;
  return player.heading;
}
