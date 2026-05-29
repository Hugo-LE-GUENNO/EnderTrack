// plugins/controller-v2/key-directions.js
// IMMUTABLE — Maps pressed keys to a single direction (with diagonal support)
// 40ms combo window: waits briefly to detect simultaneous key presses
//
// Usage:
//   const kd = new KeyDirections((direction) => { /* 'up','downLeft','zUp', etc */ });
//   document.addEventListener('keydown', e => kd.keyDown(e.code));
//   document.addEventListener('keyup', e => kd.keyUp(e.code));

class KeyDirections {
  constructor(onDirection, onStop) {
    this._onDirection = onDirection; // called with direction string
    this._onStop = onStop;           // called when all keys released
    this._axes = { x: 0, y: 0, z: 0 }; // -1, 0, +1 per axis
    this._timer = null;
    this._lastDir = null;
  }

  // Key code → axis + sign
  static KEY_MAP = {
    'ArrowUp': ['y', +1], 'KeyW': ['y', +1],
    'ArrowDown': ['y', -1], 'KeyS': ['y', -1],
    'ArrowRight': ['x', +1], 'KeyD': ['x', +1],
    'ArrowLeft': ['x', -1], 'KeyA': ['x', -1],
    'PageUp': ['z', +1], 'KeyQ': ['z', +1],
    'PageDown': ['z', -1], 'KeyE': ['z', -1],
  };

  // Axes → direction name
  static DIRECTION_TABLE = {
    '0,1,0': 'up',
    '0,-1,0': 'down',
    '1,0,0': 'right',
    '-1,0,0': 'left',
    '1,1,0': 'upRight',
    '-1,1,0': 'upLeft',
    '1,-1,0': 'downRight',
    '-1,-1,0': 'downLeft',
    '0,0,1': 'zUp',
    '0,0,-1': 'zDown',
    // XY + Z combos (3D diagonals)
    '0,1,1': 'upZUp',
    '0,1,-1': 'upZDown',
    '0,-1,1': 'downZUp',
    '0,-1,-1': 'downZDown',
    '1,0,1': 'rightZUp',
    '1,0,-1': 'rightZDown',
    '-1,0,1': 'leftZUp',
    '-1,0,-1': 'leftZDown',
    '1,1,1': 'upRightZUp',
    '1,1,-1': 'upRightZDown',
    '-1,1,1': 'upLeftZUp',
    '-1,1,-1': 'upLeftZDown',
    '1,-1,1': 'downRightZUp',
    '1,-1,-1': 'downRightZDown',
    '-1,-1,1': 'downLeftZUp',
    '-1,-1,-1': 'downLeftZDown',
  };

  keyDown(code) {
    const mapping = KeyDirections.KEY_MAP[code];
    if (!mapping) return false;
    const [axis, sign] = mapping;
    this._axes[axis] = sign;
    this._scheduleResolve();
    return true;
  }

  keyUp(code) {
    const mapping = KeyDirections.KEY_MAP[code];
    if (!mapping) return false;
    const [axis, sign] = mapping;
    // Only clear if this key's sign matches (avoid clearing if opposite key still held)
    if (this._axes[axis] === sign) this._axes[axis] = 0;
    this._scheduleResolve();
    return true;
  }

  _scheduleResolve() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      this._resolve();
    }, 40);
  }

  _resolve() {
    const { x, y, z } = this._axes;
    const key = `${x},${y},${z}`;
    const dir = KeyDirections.DIRECTION_TABLE[key] || null;

    if (dir) {
      this._lastDir = dir;
      this._onDirection(dir, { x, y, z });
    } else if (x === 0 && y === 0 && z === 0) {
      if (this._lastDir) {
        this._lastDir = null;
        this._onStop?.();
      }
    }
    // x+y or x-y cancel = 0,0 → stop. Already handled above.
  }

  // Get current resolved direction (or null)
  get currentDirection() { return this._lastDir; }

  // Get raw axes
  get axes() { return { ...this._axes }; }

  // Resolve direction immediately from current axes (no debounce)
  resolveNow() {
    const { x, y, z } = this._axes;
    return KeyDirections.DIRECTION_TABLE[`${x},${y},${z}`] || null;
  }

  // Reset everything
  reset() {
    this._axes = { x: 0, y: 0, z: 0 };
    this._lastDir = null;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

window.KeyDirections = KeyDirections;
