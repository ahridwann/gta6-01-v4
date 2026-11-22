// HUD, minimap and menus for Lumina City.
// DOM overlay: cash, rank, wanted stars, health, speed, ammo, objective,
// message toasts. Canvas minimap: roads, player arrow, beacon, cops, chips.
// Menus: start, pause, mission briefing, BUSTED / WASTED.

import { CITY } from './config.js';

export function createHud() {
  const root = document.getElementById('hud');
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');

  const overlays = {
    start: el('menu-start'),
    pause: el('menu-pause'),
    briefing: el('menu-briefing'),
    over: el('menu-over'),
  };

  let toastTimer = null;

  return {
    root,
    setCash(v) {
      el('hud-cash').textContent = `$${v.toLocaleString('en-US')}`;
    },
    setRank(v) {
      el('hud-rank').textContent = v;
    },
    setStars(n) {
      const s = el('hud-stars');
      s.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
      s.classList.toggle('hot', n >= 3);
    },
    setHealth(v) {
      const bar = el('hud-health-fill');
      bar.style.width = `${Math.max(0, Math.min(100, v))}%`;
      bar.classList.toggle('low', v < 30);
      el('hud-health-num').textContent = Math.ceil(v);
    },
    setSpeed(mph, inCar) {
      el('hud-speed').textContent = inCar ? `${Math.round(mph)} mph` : 'ON FOOT';
    },
    setAmmo(n) {
      el('hud-ammo').textContent = `Ammo ${n}`;
    },
    setObjective(text) {
      el('hud-objective').textContent = text;
    },
    setMissionLabel(text) {
      el('hud-mission').textContent = text;
    },
    setHint(text) {
      el('hud-hint').textContent = text;
    },
    toast(text, ms = 2600) {
      const t = el('hud-toast');
      t.textContent = text;
      t.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), ms);
    },
    showMenu(name) {
      for (const [k, node] of Object.entries(overlays)) {
        if (node) node.classList.toggle('hidden', k !== name);
      }
      if (name) root.classList.add('dim');
      else root.classList.remove('dim');
    },
    hideMenus() {
      this.showMenu(null);
    },
    setBriefing(mission) {
      el('briefing-title').textContent = mission.name;
      el('briefing-text').textContent = mission.brief;
      el('briefing-reward').textContent = `Reward: $${mission.reward}`;
    },
    setGameOver(title, text) {
      el('over-title').textContent = title;
      el('over-text').textContent = text;
    },
    // --- minimap ------------------------------------------------------------
    drawMinimap(state) {
      const W = minimap.width;
      const H = minimap.height;
      const half = CITY.half;
      const toMap = (x, z) => [((x + half) / (half * 2)) * W, ((z + half) / (half * 2)) * H];
      mctx.clearRect(0, 0, W, H);
      mctx.fillStyle = 'rgba(8, 10, 22, 0.85)';
      mctx.fillRect(0, 0, W, H);
      // roads
      mctx.strokeStyle = 'rgba(120, 130, 170, 0.5)';
      mctx.lineWidth = 1;
      for (let i = -half; i <= half; i += 40) {
        const [x1] = toMap(i, 0);
        const [, z1] = toMap(0, i);
        mctx.beginPath();
        mctx.moveTo(x1, 0);
        mctx.lineTo(x1, H);
        mctx.stroke();
        mctx.beginPath();
        mctx.moveTo(0, z1);
        mctx.lineTo(W, z1);
        mctx.stroke();
      }
      // chips
      mctx.fillStyle = '#ffd23e';
      for (const c of state.chips) {
        if (c.taken) continue;
        const [x, z] = toMap(c.x, c.z);
        mctx.fillRect(x - 1.5, z - 1.5, 3, 3);
      }
      // beacon
      if (state.beacon) {
        const [x, z] = toMap(state.beacon.x, state.beacon.z);
        mctx.fillStyle = '#2ee6ff';
        mctx.beginPath();
        mctx.arc(x, z, 5, 0, Math.PI * 2);
        mctx.fill();
        mctx.strokeStyle = '#ffffff';
        mctx.beginPath();
        mctx.arc(x, z, 8, 0, Math.PI * 2);
        mctx.stroke();
      }
      // cops
      mctx.fillStyle = '#ff3b30';
      for (const c of state.cops) {
        const [x, z] = toMap(c.x, c.z);
        mctx.beginPath();
        mctx.arc(x, z, 3, 0, Math.PI * 2);
        mctx.fill();
      }
      // player arrow
      const [px, pz] = toMap(state.player.x, state.player.z);
      mctx.save();
      mctx.translate(px, pz);
      mctx.rotate(Math.atan2(Math.sin(state.player.heading), Math.cos(state.player.heading)));
      mctx.fillStyle = '#ff2ea6';
      mctx.beginPath();
      mctx.moveTo(0, -7);
      mctx.lineTo(5, 6);
      mctx.lineTo(-5, 6);
      mctx.closePath();
      mctx.fill();
      mctx.restore();
    },
  };
}
