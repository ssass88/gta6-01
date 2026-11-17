// Neon Vice: Syndicate - Input Management
// Handles keyboard, mouse aiming, shooting, weapon switching, and menu interactions.

export const ACTION_CONFIRM = 1 << 0;
export const ACTION_PAUSE = 1 << 1;
export const ACTION_ENTER_VEHICLE = 1 << 2;
export const ACTION_HANDBRAKE = 1 << 3;
export const ACTION_HORN = 1 << 4;
export const ACTION_RADIO = 1 << 5;
export const ACTION_RELOAD = 1 << 6;
export const ACTION_MAP = 1 << 7;

export function createInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  let mouse = { x: 0, y: 0, isDown: false, rightDown: false, wheelDelta: 0 };
  let pendingActions = 0;

  function onKeyDown(e) {
    const code = e.code;
    if (!keys.has(code)) {
      justPressed.add(code);
    }
    keys.add(code);

    if (code === 'KeyP' || code === 'Escape') pendingActions |= ACTION_PAUSE;
    if (code === 'Space' || code === 'Enter') pendingActions |= ACTION_CONFIRM;
    if (code === 'KeyF' || code === 'Enter') pendingActions |= ACTION_ENTER_VEHICLE;
    if (code === 'Space') pendingActions |= ACTION_HANDBRAKE;
    if (code === 'KeyE') pendingActions |= ACTION_HORN;
    if (code === 'KeyR') pendingActions |= ACTION_RADIO;
    if (code === 'KeyM') pendingActions |= ACTION_MAP;

    // Prevent default browser scrolling for arrow keys, space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      mouse.isDown = true;
      pendingActions |= ACTION_CONFIRM;
    } else if (e.button === 2) {
      mouse.rightDown = true;
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) mouse.isDown = false;
    else if (e.button === 2) mouse.rightDown = false;
  }

  function onWheel(e) {
    mouse.wheelDelta += Math.sign(e.deltaY);
    e.preventDefault();
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  function isDown(code) {
    return keys.has(code);
  }

  function wasJustPressed(code) {
    const has = justPressed.has(code);
    justPressed.delete(code);
    return has;
  }

  function takeActions() {
    const act = pendingActions;
    pendingActions = 0;
    return act;
  }

  function getMovementVector() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;

    // Normalize diagonal
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  function isSprinting() {
    return keys.has('ShiftLeft') || keys.has('ShiftRight');
  }

  function isHandbrake() {
    return keys.has('Space');
  }

  function getWeaponNumber() {
    for (let i = 1; i <= 6; i++) {
      if (keys.has(`Digit${i}`)) return i;
    }
    if (keys.has('KeyQ')) return 'prev';
    if (keys.has('KeyE') && !keys.has('KeyW')) return 'next';
    if (mouse.wheelDelta !== 0) {
      const dir = mouse.wheelDelta > 0 ? 'next' : 'prev';
      mouse.wheelDelta = 0;
      return dir;
    }
    return null;
  }

  function getMouseAimAngle(screenCenterX, screenCenterY) {
    const dx = mouse.x - screenCenterX;
    const dy = mouse.y - screenCenterY;
    return Math.atan2(dy, dx);
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
  }

  return {
    isDown,
    wasJustPressed,
    takeActions,
    getMovementVector,
    isSprinting,
    isHandbrake,
    getWeaponNumber,
    getMouseAimAngle,
    getMouseState: () => mouse,
    destroy,
  };
}
