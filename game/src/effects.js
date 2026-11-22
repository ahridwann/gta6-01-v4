// Effects for Lumina City: particle bursts (impacts, pickups, exhaust),
// fading skid marks, and the tall mission beacon beam + ground ring that
// mark every objective.

import * as THREE from '../vendor/three/three.module.min.js';

// --- particles ---------------------------------------------------------------

export function createParticles(scene, max = 240) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < max; i++) parts.push({ life: 0, vx: 0, vy: 0, vz: 0 });

  return {
    burst(x, y, z, color, n = 14, speed = 6) {
      let made = 0;
      for (let i = 0; i < max && made < n; i++) {
        const p = parts[i];
        if (p.life > 0) continue;
        p.life = 0.5 + Math.random() * 0.5;
        p.maxLife = p.life;
        const a = Math.random() * Math.PI * 2;
        const up = Math.random() * 0.9 + 0.3;
        p.vx = Math.cos(a) * speed * Math.random();
        p.vy = up * speed * 0.7;
        p.vz = Math.sin(a) * speed * Math.random();
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        const c = new THREE.Color(color);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
        made++;
      }
    },
    step(dt) {
      for (let i = 0; i < max; i++) {
        const p = parts[i];
        if (p.life <= 0) {
          pos[i * 3 + 1] = -100;
          continue;
        }
        p.life -= dt;
        p.vy -= 9 * dt;
        pos[i * 3] += p.vx * dt;
        pos[i * 3 + 1] += p.vy * dt;
        pos[i * 3 + 2] += p.vz * dt;
        if (pos[i * 3 + 1] < 0.05) {
          pos[i * 3 + 1] = 0.05;
          p.vy = 0;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// --- skid marks ---------------------------------------------------------------

export function createSkids(scene, max = 120) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x0a0a10, transparent: true, opacity: 0.55, depthWrite: false });
  const geo = new THREE.PlaneGeometry(0.5, 1.6);
  const marks = [];
  let next = 0;
  for (let i = 0; i < max; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    marks.push(m);
  }
  return {
    add(x, z, angle) {
      const m = marks[next];
      next = (next + 1) % max;
      m.position.set(x, 0.1, z);
      m.rotation.z = -angle;
      m.visible = true;
    },
  };
}

// --- mission beacon -----------------------------------------------------------

export function createBeacon(scene) {
  const group = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x2ee6ff,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 150, 12, 1, true), beamMat);
  beam.position.y = 75;
  group.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x2ee6ff,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.4, 5.6, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshBasicMaterial({
    color: 0x2ee6ff, transparent: true, opacity: 0.14, depthWrite: false,
  }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.14;
  group.add(inner);
  group.visible = false;
  scene.add(group);
  return {
    group,
    ring,
    show(x, z, color = 0x2ee6ff) {
      group.visible = true;
      group.position.set(x, 0, z);
      beamMat.color.setHex(color);
      ringMat.color.setHex(color);
    },
    hide() {
      group.visible = false;
    },
    step(t) {
      if (!group.visible) return;
      const s = 1 + Math.sin(t * 3) * 0.08;
      ring.scale.set(s, s, 1);
      beamMat.opacity = 0.32 + Math.sin(t * 2.2) * 0.08;
    },
  };
}
