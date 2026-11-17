// Keyboard + mouse input. Tracks held keys, pointer-lock camera deltas,
// and one-shot "pressed" actions (E to enter a car, F to punch, Esc to pause).

export const ACTION_ENTER_CAR = 'enterCar';
export const ACTION_PUNCH = 'punch';
export const ACTION_PAUSE = 'pause';
export const ACTION_CONFIRM = 'confirm';

export function createInput(canvas) {
  const keys = new Set();
  // Actions pressed since the last call to consumeActions().
  const pressed = new Set();
  // Accumulated mouse movement since the last frame read.
  let mouseDX = 0;
  let mouseDY = 0;
  let locked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') pressed.add(ACTION_ENTER_CAR);
    if (event.code === 'KeyF') pressed.add(ACTION_PUNCH);
    if (event.code === 'Escape') pressed.add(ACTION_PAUSE);
    if (event.code === 'Enter' || event.code === 'Space') pressed.add(ACTION_CONFIRM);
    // Keep the page from scrolling on game keys.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    if (!locked) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
  }

  function onMouseDown(event) {
    if (event.button === 0) pressed.add(ACTION_PUNCH);
  }

  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    isDown(code) {
      return keys.has(code);
    },
    /** Forward / back / strafe as -1..1, from WASD or arrow keys. */
    moveAxes() {
      let forward = 0;
      let strafe = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) strafe -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) strafe += 1;
      return { forward, strafe };
    },
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    braking() {
      return keys.has('Space');
    },
    /** Mouse delta since the last call; resets the accumulator. */
    takeMouseDelta() {
      const out = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return out;
    },
    /** Actions pressed since the last call; clears the set. */
    takeActions() {
      const out = new Set(pressed);
      pressed.clear();
      return out;
    },
    isLocked() {
      return locked;
    },
    requestLock() {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock can fail in some browsers; the game still works
        // with the keyboard, so a failure here is not fatal.
      }
    },
    releaseLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
  };
}
