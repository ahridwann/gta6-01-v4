// localStorage save for Lumina City.
// Key: lumina-city-save-v1. Stores cash, mission progress, collected chips
// and taxi fares done. Loading a corrupt save falls back to a fresh game.

import { SAVE_KEY } from './config.js';

export function freshSave() {
  return {
    cash: 0,
    nextMission: 0,
    chips: [],
    fares: 0,
    rank: 'Street Rookie',
    savedAt: Date.now(),
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const save = freshSave();
    if (typeof data.cash === 'number') save.cash = Math.max(0, Math.floor(data.cash));
    if (typeof data.nextMission === 'number') save.nextMission = Math.max(0, Math.min(5, Math.floor(data.nextMission)));
    if (Array.isArray(data.chips)) save.chips = data.chips.filter((n) => Number.isInteger(n));
    if (typeof data.fares === 'number') save.fares = Math.max(0, Math.floor(data.fares));
    return save;
  } catch (_) {
    return null;
  }
}

export function writeSave(state) {
  try {
    const save = {
      cash: state.cash,
      nextMission: state.nextMission,
      chips: [...state.chipsCollected],
      fares: state.faresDone,
      rank: state.rank,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (_) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (_) {
    /* storage unavailable — game still runs */
  }
}
