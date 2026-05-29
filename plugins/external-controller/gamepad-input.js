// plugins/controller-v2/gamepad-input.js
// Minimal PS4/generic gamepad → bridge directions
// Polls at 60fps, left stick = XY, R2/L2 = Z, dpad = step directions

class GamepadInput {
  constructor(bridge) {
    this._bridge = bridge;
    this._raf = null;
    this._active = false;
    this._currentDir = null;
    this._deadzone = 0.15;
    this._gpIndex = null;
    this._btnState = {};  // track pressed state per button
    this._lastDpad = 'false,false,false,false';
    this._dpadHeld = null;  // current dpad direction held
    this._dpadPending = null; // pending direction change
    this._dpadDebounce = 0;   // frames to wait before committing

    // Face button → action (PS4 standard mapping)
    this._btnActions = {};

    // Listen for connection
    this._onConnect = (e) => { this._gpIndex = e.gamepad.index; };
    this._onDisconnect = () => { this._gpIndex = null; this._release(); };
  }

  start() {
    if (this._active) return;
    this._active = true;
    window.addEventListener('gamepadconnected', this._onConnect);
    window.addEventListener('gamepaddisconnected', this._onDisconnect);
    // Check if already connected
    const gps = navigator.getGamepads?.();
    if (gps) for (const gp of gps) { if (gp) { this._gpIndex = gp.index; break; } }
    this._poll();
  }

  stop() {
    this._active = false;
    this._release();
    window.removeEventListener('gamepadconnected', this._onConnect);
    window.removeEventListener('gamepaddisconnected', this._onDisconnect);
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  _poll() {
    if (!this._active) return;
    this._raf = requestAnimationFrame(() => this._poll());
    if (this._gpIndex === null) return;
    const gp = navigator.getGamepads?.()?.[this._gpIndex];
    if (!gp) return;

    // --- Face button actions (edge-triggered) ---
    // (empty by default — Controller++ plugin will add these)
    for (const [btnIdx, action] of Object.entries(this._btnActions)) {
      const pressed = gp.buttons[btnIdx]?.pressed;
      if (pressed && !this._btnState[btnIdx]) {
        this._execAction(action);
      }
      this._btnState[btnIdx] = pressed;
    }

    // PS4 mapping (standard): left stick axes 0,1 | R2=buttons[7] L2=buttons[6] | dpad=buttons[12-15]
    const lx = Math.abs(gp.axes[0]) > this._deadzone ? gp.axes[0] : 0;
    const ly = Math.abs(gp.axes[1]) > this._deadzone ? gp.axes[1] : 0;
    const r2 = gp.buttons[5]?.pressed ? 1 : 0;  // RB / R1
    const l2 = gp.buttons[4]?.pressed ? 1 : 0;  // LB / L1

    // --- D-pad → movement (held = repeat in step, continuous while held) ---
    const dUp = gp.buttons[12]?.pressed;
    const dDown = gp.buttons[13]?.pressed;
    const dLeft = gp.buttons[14]?.pressed;
    const dRight = gp.buttons[15]?.pressed;

    let dpadDir = null;
    if (dUp || dDown || dLeft || dRight) {
      const dx = (dRight ? 1 : 0) - (dLeft ? 1 : 0);
      const dy = (dUp ? 1 : 0) - (dDown ? 1 : 0);
      dpadDir = this._xyToDir(dx, dy);
    }

    // Z from triggers (combine with dpad)
    const zThreshold = 0.1;
    if (r2 > zThreshold) dpadDir = dpadDir ? dpadDir + 'ZUp' : 'zUp';
    else if (l2 > zThreshold) dpadDir = dpadDir ? dpadDir + 'ZDown' : 'zDown';

    // Edge detection with 2-frame debounce for diagonal transitions
    if (dpadDir !== this._dpadPending) {
      this._dpadPending = dpadDir;
      this._dpadDebounce = 2;
    } else if (this._dpadDebounce > 0) {
      this._dpadDebounce--;
    }
    if (this._dpadDebounce === 0 && this._dpadPending !== this._dpadHeld) {
      if (this._dpadHeld) this._bridge._btnUp();
      if (this._dpadPending) this._bridge._btnDown(this._dpadPending);
      this._dpadHeld = this._dpadPending;
    }
  }

  _execAction(action) {
    // Reserved for Controller++ plugin
  }

  _release() {
    if (this._dpadHeld) {
      this._bridge._btnUp();
      this._dpadHeld = null;
    }
  }

  _angleToDir(angle) {
    // 8 directions, 45° sectors
    const deg = ((angle * 180 / Math.PI) + 360) % 360;
    if (deg < 22.5 || deg >= 337.5) return 'right';
    if (deg < 67.5) return 'upRight';
    if (deg < 112.5) return 'up';
    if (deg < 157.5) return 'upLeft';
    if (deg < 202.5) return 'left';
    if (deg < 247.5) return 'downLeft';
    if (deg < 292.5) return 'down';
    return 'downRight';
  }

  _xyToDir(dx, dy) {
    const map = {
      '0,1': 'up', '0,-1': 'down', '1,0': 'right', '-1,0': 'left',
      '1,1': 'upRight', '-1,1': 'upLeft', '1,-1': 'downRight', '-1,-1': 'downLeft'
    };
    return map[`${dx},${dy}`] || null;
  }
}

window.GamepadInput = GamepadInput;
