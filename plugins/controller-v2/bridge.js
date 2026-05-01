// plugins/controller-v2/bridge.js
// Step = repeat moveDirection while held (with diagonal combo detection)
// Continuous = G91 G1 to boundary, M410+M114 on release

class ControllerV2Bridge {
  constructor() {
    this.isActive = false;
    this.mode = 'step';
    this._kd = null;
    this._cm = null;
    this._interval = null;
    this._hwDebounce = null;
    this._upDebounce = null;
    this._currentDir = null;
    this._heldKeys = new Set();
    this._onKeyDown = null;
    this._onKeyUp = null;
    this._stopping = false;
    this._pendingDir = null;
  }

  activate() {
    this._loadScripts();
    this._onKeyDown = (e) => this._handleKeyDown(e);
    this._onKeyUp = (e) => this._handleKeyUp(e);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    this._posListener = (pos) => {
      const x = document.getElementById('statusPosX');
      const y = document.getElementById('statusPosY');
      const z = document.getElementById('statusPosZ');
      if (x) x.textContent = (pos?.x ?? 0).toFixed(2);
      if (y) y.textContent = (pos?.y ?? 0).toFixed(2);
      if (z) z.textContent = (pos?.z ?? 0).toFixed(2);
    };
    window.EnderTrack?.Events?.on?.('position:changed', this._posListener);
    this._bindButtons();
  }

  _loadScripts() {
    const load = (src, cb) => {
      if (document.querySelector(`script[src="${src}"]`)) { cb(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = cb;
      document.head.appendChild(s);
    };
    load('plugins/controller-v2/key-directions.js', () => {
      this._kd = new window.KeyDirections(() => {}, () => {});
      load('plugins/controller-v2/continuous-move.js', () => {
        this._cm = new window.ContinuousMove();
        this._cm.calibrate();
        load('plugins/controller-v2/canvas-patches.js', () => {
          window.CV2Patches?.install();
          load('plugins/controller-v2/gamepad-input.js', () => {
            this._gp = new window.GamepadInput(this);
          });
        });
      });
    });
  }

  deactivate() {
    this.setActive(false);
    this._unbindButtons();
    if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
    if (this._onKeyUp) document.removeEventListener('keyup', this._onKeyUp);
    if (this._posListener) window.EnderTrack?.Events?.off?.('position:changed', this._posListener);
    this._onKeyDown = null;
    this._onKeyUp = null;
    this._posListener = null;
    this._kd?.reset();
    window.CV2Patches?.uninstall();
  }

  getStatus() { return { active: this.isActive, mode: this.mode }; }
  toggle() { this.setActive(!this.isActive); return this.isActive; }
  setActive(on) {
    this.isActive = on;
    if (on) {
      this._gp?.start();
    } else {
      this._stopAll();
      this._kd?.reset();
      this._heldKeys.clear();
      this._gp?.stop();
    }
  }
  setMode(mode) {
    this.mode = mode;
    this._stopAll();
    this._kd?.reset();
    this._heldKeys.clear();
    // Re-calibrate when switching to continuous (picks up new connection)
    if (mode === 'continuous') this._cm?.calibrate();
  }

  // Only arrow keys + PgUp/PgDn allowed
  static ALLOWED_KEYS = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown']);

  _handleKeyDown(e) {
    if (!this.isActive || !this._kd) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!ControllerV2Bridge.ALLOWED_KEYS.has(e.code)) return;
    if (this._heldKeys.has(e.code)) return;
    if (!this._kd.keyDown(e.code)) return;
    this._heldKeys.add(e.code);
    e.preventDefault();

    const dir = this._kd.resolveNow();
    if (!dir) return;
    this._currentDir = dir;
    this._pressBtn(dir, true);

    if (this._hwDebounce) clearTimeout(this._hwDebounce);

    if (this.mode === 'step') {
      this._hwDebounce = setTimeout(() => {
        this._hwDebounce = null;
        const d = this._kd.resolveNow();
        if (d) {
          this._currentDir = d;
          this._pressBtn(d, true);
          this._execStep(d);
          this._startRepeat();
        }
      }, this._comboDelay || 60);
    } else {
      if (!this._cm?._moving && !this._cm?._stopping) {
        this._hwDebounce = setTimeout(() => {
          this._hwDebounce = null;
          if (!this._currentDir) return;
          // Re-check keys are still held
          if (this._heldKeys.size === 0) return;
          const d = this._kd.resolveNow();
          if (d) {
            this._setEstimating(true);
            this._cm?.start(d);
          }
        }, this._comboDelay || 60);
      } else if (this._cm?._moving) {
        this._cm?.redirect(dir);
      }
      // If _stopping, ignore — the pending mechanism in cm handles it
    }
  }

  _handleKeyUp(e) {
    if (!this.isActive || !this._kd) return;
    this._heldKeys.delete(e.code);
    if (!this._kd.keyUp(e.code)) return;
    e.preventDefault();

    const dir = this._kd.resolveNow();

    if (this.mode === 'step') {
      if (dir) {
        this._currentDir = dir;
      } else {
        this._currentDir = null;
        this._stopRepeat();
        this._pressAllBtns(false);
      }
    } else {
      // Continuous: any keyUp = stop
      if (this._hwDebounce) { clearTimeout(this._hwDebounce); this._hwDebounce = null; }
      this._kd?.reset();
      this._heldKeys.clear();
      this._continuousStop();
    }
  }

  // --- Arrow button mouse/touch hold ---

  _bindButtons() {
    this._btnMap = {
      up: 'up', down: 'down', left: 'left', right: 'right',
      upLeft: 'upLeft', upRight: 'upRight', downLeft: 'downLeft', downRight: 'downRight',
      zUp: 'zUp', zDown: 'zDown'
    };
    this._btnHandlers = {};
    for (const [id, dir] of Object.entries(this._btnMap)) {
      const el = document.getElementById(id);
      if (!el) continue;
      // Use capture phase to intercept before core controls.js handlers
      const onDown = (e) => {
        if (!this.isActive) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this._btnDown(dir);
      };
      const onUp = (e) => {
        if (!this.isActive) return;
        e.stopImmediatePropagation();
        this._btnUp();
      };
      el.addEventListener('mousedown', onDown, true);
      el.addEventListener('mouseup', onUp, true);
      el.addEventListener('mouseleave', onUp, true);
      el.addEventListener('touchstart', onDown, { capture: true, passive: false });
      el.addEventListener('touchend', onUp, true);
      this._btnHandlers[id] = { el, onDown, onUp };
    }
  }

  _unbindButtons() {
    if (!this._btnHandlers) return;
    for (const { el, onDown, onUp } of Object.values(this._btnHandlers)) {
      el.removeEventListener('mousedown', onDown, true);
      el.removeEventListener('mouseup', onUp, true);
      el.removeEventListener('mouseleave', onUp, true);
      el.removeEventListener('touchstart', onDown, true);
      el.removeEventListener('touchend', onUp, true);
    }
    this._btnHandlers = null;
  }

  // --- Continuous stop (single entry point) ---

  _continuousStop() {
    if (this._stopping) return; // already stopping
    this._stopping = true;
    this._currentDir = null;
    this._pressAllBtns(false);
    // Safety timeout: if callback never fires, force reset after 3s
    this._stopTimeout = setTimeout(() => this._continuousStopDone(), 3000);
    if (this._cm) {
      this._cm.stop(() => this._continuousStopDone());
    } else {
      this._continuousStopDone();
    }
  }

  _continuousStopDone() {
    if (!this._stopping) return; // already handled (prevent double call)
    this._stopping = false;
    if (this._stopTimeout) { clearTimeout(this._stopTimeout); this._stopTimeout = null; }
    if (this._pendingDir) {
      const dir = this._pendingDir;
      this._pendingDir = null;
      this._btnDown(dir);
    } else {
      this._setEstimating(false);
    }
  }

  // --- Button/gamepad/keyboard entry points ---

  _btnDown(dir) {
    if (!this.isActive) return;
    if (this.mode === 'continuous' && this._stopping) { this._pendingDir = dir; return; }
    this._pressBtn(dir, true);
    if (this.mode === 'step') {
      this._currentDir = dir;
      this._execStep(dir);
      this._startRepeat();
    } else {
      this._currentDir = dir;
      this._setEstimating(true);
      this._cm?.start(dir);
    }
  }

  _btnUp() {
    if (!this.isActive) return;
    this._pendingDir = null;
    if (this.mode === 'step') {
      this._pressAllBtns(false);
      this._currentDir = null;
      this._stopRepeat();
    } else {
      this._continuousStop();
    }
  }

  // --- Button animation ---

  _pressBtn(dir, on) {
    // Map direction to button IDs
    const d = dir.toLowerCase();
    const btns = [];
    if (d.includes('up') && !d.includes('down')) btns.push('up');
    if (d.includes('down') && !d.includes('up')) btns.push('down');
    if (d.includes('left') && !d.includes('right')) btns.push('left');
    if (d.includes('right') && !d.includes('left')) btns.push('right');
    if (d.includes('zup')) btns.push('zUp');
    if (d.includes('zdown')) btns.push('zDown');
    // Diagonal buttons
    if (d === 'upright') btns.push('upRight');
    if (d === 'upleft') btns.push('upLeft');
    if (d === 'downright') btns.push('downRight');
    if (d === 'downleft') btns.push('downLeft');
    btns.forEach(id => document.getElementById(id)?.classList.toggle('pressed', on));
  }

  _pressAllBtns(on) {
    ['up','down','left','right','upLeft','upRight','downLeft','downRight','zUp','zDown']
      .forEach(id => document.getElementById(id)?.classList.toggle('pressed', on));
  }

  // --- Estimating state for status widget ---

  _setEstimating(on) {
    const widget = document.querySelector('.status-widget');
    const label = document.getElementById('mainStatusLabel');
    const light = document.getElementById('mainStatusLight');
    if (widget) widget.classList.toggle('estimating', on);
    if (light) light.classList.toggle('estimating-light', on);
    if (label) label.textContent = on
      ? '📍 Position estimée'
      : '📍 État Actuel' + (window.EnderTrack?.Enderscope?.isConnected ? '' : ' - SIMULATEUR');
    window.continuousEstimating = on;
    window.EnderTrack?.Canvas?.requestRender?.();
  }

  // Same direction parsing as continuous mode, but single step
  _execStep(d) {
    const dl = d.toLowerCase();
    const state = window.EnderTrack?.State?.get();
    if (!state) return;

    // Read sensitivities from sliders (same as core moveDirection)
    let sensX = parseFloat(document.getElementById(state.lockXY ? 'sensitivityXY' : 'sensitivityX')?.value) || 1;
    let sensY = parseFloat(document.getElementById(state.lockXY ? 'sensitivityXY' : 'sensitivityY')?.value) || 1;
    let sensZ = parseFloat(document.getElementById('sensitivityZ')?.value) || 0.5;

    // Parse direction → dx, dy, dz (same logic as continuous _dirToRelative)
    let dx = 0, dy = 0, dz = 0;
    if (dl.includes('right'))     dx = sensX;
    else if (dl.includes('left')) dx = -sensX;
    if (dl.startsWith('up'))      dy = sensY;
    else if (dl.startsWith('down')) dy = -sensY;
    if (dl.includes('zup'))       dz = sensZ;
    else if (dl.includes('zdown')) dz = -sensZ;

    // Diagonal normalization
    const axes = (dx !== 0 ? 1 : 0) + (dy !== 0 ? 1 : 0);
    if (axes > 1) { const n = 1 / Math.sqrt(2); dx *= n; dy *= n; }

    // Axis orientation
    const ori = state.axisOrientation || { x: 'right', y: 'up' };
    if (ori.x === 'left') dx = -dx;
    if (ori.y === 'down') dy = -dy;

    // Locks
    if (state.lockX) dx = 0;
    if (state.lockY) dy = 0;
    if (state.lockZ) dz = 0;

    if (dx === 0 && dy === 0 && dz === 0) return;
    window.EnderTrack?.Movement?.moveRelative?.(dx, dy, dz);
  }

  _startRepeat() {
    this._stopRepeat();
    const interval = this._repeatInterval || 500;
    this._interval = setInterval(() => {
      if (!this._currentDir) return;
      this._execStep(this._currentDir);
    }, interval);
  }

  _stopRepeat() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }

  _stopAll() {
    this._stopRepeat();
    if (this._hwDebounce) { clearTimeout(this._hwDebounce); this._hwDebounce = null; }
    if (this._upDebounce) { clearTimeout(this._upDebounce); this._upDebounce = null; }
    if (this._stopTimeout) { clearTimeout(this._stopTimeout); this._stopTimeout = null; }
    this._stopping = false;
    this._pendingDir = null;
    this._currentDir = null;
    this._cm?.stop(() => {});
    this._setEstimating(false);
    this._pressAllBtns(false);
    this._kd?.reset();
  }
}

window.PiloteMoiBridge = ControllerV2Bridge;
