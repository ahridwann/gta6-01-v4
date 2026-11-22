// Keyboard + mouse input for Lumina City.
// Held keys are read every frame; one-shot actions (interact, punch, shoot,
// pause) are queued as flags and consumed once, so a press between frames
// is never lost and never counted twice.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let locked = false;

  const KEYMAP = {
    KeyW: 'up',
    ArrowUp: 'up',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    ShiftLeft: 'run',
    ShiftRight: 'run',
    KeyE: 'interact',
    KeyF: 'melee',
    KeyG: 'shoot',
    KeyT: 'taxi',
    Space: 'brake',
    Escape: 'pause',
    KeyM: 'mission',
  };

  function onKeyDown(e) {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (e.code === 'Space') e.preventDefault();
    if (!keys.has(action)) pressed.add(action);
    keys.add(action);
  }
  function onKeyUp(e) {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  }
  function onMouseMove(e) {
    if (!locked) return;
    // One event can carry a huge jump (a click's mouse travel, a pointer
    // -lock jump): real look input arrives in small steps, so ignore any
    // single jump that would spin the player around in one frame.
    if (Math.abs(e.movementX || 0) > 150 || Math.abs(e.movementY || 0) > 150) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  }
  function onMouseDown(e) {
    if (e.button === 0 && locked) pressed.add('shoot');
    if (e.button === 2 && locked) pressed.add('melee');
  }
  function onContextMenu(e) {
    e.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('contextmenu', onContextMenu);

  return {
    // true while the action key is held
    held(action) {
      return keys.has(action);
    },
    // true once per physical press; consumes the flag
    wasPressed(action) {
      if (pressed.has(action)) {
        pressed.delete(action);
        return true;
      }
      return false;
    },
    // mouse look deltas since last read (consumed)
    takeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    // request pointer lock for mouse-look (best effort; game works without it)
    lockPointer() {
      if (canvas.requestPointerLock) {
        try {
          const p = canvas.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch (_) {
          /* pointer lock unavailable — keyboard steering still works */
        }
      }
    },
    unlockPointer() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    setLocked(v) {
      locked = v;
    },
    isLocked() {
      return locked;
    },
    // test hooks: pretend a key was pressed / held
    testPress(action) {
      pressed.add(action);
      keys.add(action);
    },
    testRelease(action) {
      keys.delete(action);
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
