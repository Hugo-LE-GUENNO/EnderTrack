// plugins/gamepad-simple/bridge.js
// D-pad = XY | L1/R1 = Z | gâchettes L2/R2 = sensibilité XY | boutons face = actions fixes

class GamepadSimpleBridge {
  constructor() {
    this.active   = false;
    this._raf     = null;
    this._gpIndex = null;
    this._moving  = false;
    this._lastMove = 0;
    this.repeatMs  = 200;
    this._btnState = {};

    // PS4:  0=✕  1=○  2=□  3=△  4=L1  5=R1  6=L2  7=R2  12=↑  13=↓  14=←  15=→
    // Xbox: 0=A  1=B  2=X  3=Y  4=LB  5=RB  6=LT  7=RT  12=↑  13=↓  14=←  15=→

    this._onConnect    = (e) => { this._gpIndex = e.gamepad.index; this._onStatusChange?.(); };
    this._onDisconnect = ()  => { this._gpIndex = null; this._onStatusChange?.(); };
  }

  activate() {
    if (this.active) return;
    this.active = true;
    window.addEventListener('gamepadconnected',    this._onConnect);
    window.addEventListener('gamepaddisconnected', this._onDisconnect);
    const gps = navigator.getGamepads?.();
    if (gps) for (const gp of gps) { if (gp) { this._gpIndex = gp.index; break; } }
    this._poll();
  }

  deactivate() {
    this.active = false;
    window.removeEventListener('gamepadconnected',    this._onConnect);
    window.removeEventListener('gamepaddisconnected', this._onDisconnect);
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  isConnected() { return this._gpIndex !== null; }

  _poll() {
    if (!this.active) return;
    this._raf = requestAnimationFrame(() => this._poll());
    if (this._gpIndex === null) return;
    const gp = navigator.getGamepads?.()?.[this._gpIndex];
    if (!gp) return;

    // Boutons face — edge-triggered
    const face = [
      [0, () => window.EnderTrack?.Camera?.saveLive?.()],                          // ✕/A  → capture
      [2, () => window.EnderTrack?.Movement?.goHome?.('xy')],                      // □/X  → home XY
      [3, () => { const s = window.EnderTrack?.Scenario; if (!s) return;           // △/Y  → scénario
                  s.isActive ? s.stop?.() : (s.run?.() ?? s.start?.()); }],
      [1, () => window.EnderTrack?.StrategicPositions?.addCurrentPosition?.()],    // ○/B  → add position
      [9, () => this._g28xy()],                                                    // Options/Start → G28 XY
    ];
    for (const [idx, fn] of face) {
      const pressed = gp.buttons[idx]?.pressed;
      if (pressed && !this._btnState[idx]) fn();
      this._btnState[idx] = pressed;
    }

    // L1/R1 → Z (edge + repeat)
    const r1 = gp.buttons[5]?.pressed;
    const l1 = gp.buttons[4]?.pressed;
    if (r1 && !this._btnState[5]) { this._btnState[5] = true; this._moveZ(1); }
    else if (!r1) this._btnState[5] = false;
    if (l1 && !this._btnState[4]) { this._btnState[4] = true; this._moveZ(-1); }
    else if (!l1) this._btnState[4] = false;

    // D-pad → XY (buttons 12-15, rate-limited)
    const dUp    = gp.buttons[12]?.pressed;
    const dDown  = gp.buttons[13]?.pressed;
    const dLeft  = gp.buttons[14]?.pressed;
    const dRight = gp.buttons[15]?.pressed;
    const dx = (dRight ? 1 : 0) - (dLeft ? 1 : 0);
    const dy = (dUp    ? 1 : 0) - (dDown ? 1 : 0);

    if ((dx || dy) && !this._moving) {
      const now = Date.now();
      if (now - this._lastMove >= this.repeatMs) {
        this._lastMove = now;
        this._moveXY(dx, dy);
      }
    }
  }

  _g28xy() {
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/gcode';
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'G28 X Y' }) }).catch(() => {});
  }

  _moveXY(dx, dy) {
    const state = window.EnderTrack?.State?.get();
    if (!state) return;
    const ori  = state.axisOrientation || { x: 'right', y: 'up' };
    const sens = parseFloat(document.getElementById(state.lockXY ? 'sensitivityXY' : 'sensitivityX')?.value) || 1;
    let mx = dx * sens * (ori.x === 'left' ? -1 : 1);
    let my = dy * sens * (ori.y === 'down' ? -1 : 1);
    if (state.lockX) mx = 0;
    if (state.lockY) my = 0;
    if (mx === 0 && my === 0) return;
    this._moving = true;
    const p = window.EnderTrack?.Movement?.moveRelative?.(mx, my, 0);
    if (p?.finally) p.finally(() => { this._moving = false; });
    else this._moving = false;
  }

  _moveZ(dir) {
    const state = window.EnderTrack?.State?.get();
    if (!state || state.lockZ) return;
    const sens = parseFloat(document.getElementById('sensitivityZ')?.value) || 0.1;
    window.EnderTrack?.Movement?.moveRelative?.(0, 0, dir * sens);
  }

}

window.GamepadSimpleBridge = GamepadSimpleBridge;
