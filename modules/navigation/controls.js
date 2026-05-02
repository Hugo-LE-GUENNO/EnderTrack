// modules/navigation/controls.js - Navigation UI controls

class NavigationControls {
  constructor() {
    this.isInitialized = false;
  }

  init() {
    this.setupSensitivityControls();
    this.setupDirectionalControls();
    this.setupAbsoluteControls();
    this.syncUIWithState();
    EnderTrack.Events?.on?.('movement:completed', () => this.updateAbsoluteOverlay());
    this.isInitialized = true;
    return true;
  }

  // === SENSITIVITY ===

  setupSensitivityControls() {
    this.setupXYCoupledControl();
    this.setupAxisContextMenus();

    ['X', 'Y', 'Z'].forEach(axis => {
      const slider = document.getElementById(`sensitivity${axis}`);
      const input = document.getElementById(`sensitivity${axis}Input`);
      const controlDiv = document.getElementById(`${axis.toLowerCase()}Control`);

      if (slider && input) {
        slider.addEventListener('input', (e) => {
          this.userModifying = true;
          const value = parseFloat(e.target.value);
          input.value = value.toFixed(2);
          this.setSensitivity(axis.toLowerCase(), value);
          setTimeout(() => { this.userModifying = false; }, 200);
        });

        input.addEventListener('input', (e) => {
          this.userModifying = true;
          const value = parseFloat(e.target.value);
          if (!isNaN(value) && value >= 0.01 && value <= (parseFloat(e.target.max) || 50)) {
            slider.value = value;
            this.setSensitivity(axis.toLowerCase(), value);
          }
          setTimeout(() => { this.userModifying = false; }, 200);
        });

        if (controlDiv) {
          controlDiv.addEventListener('wheel', (e) => {
            e.preventDefault();
            const step = e.shiftKey ? 1 : 0.1;
            const newValue = Math.max(0.01, Math.min(50, parseFloat(slider.value) + (e.deltaY < 0 ? step : -step)));
            slider.value = newValue;
            input.value = newValue.toFixed(2);
            this.setSensitivity(axis.toLowerCase(), newValue);
          });
        }
      }
    });

    EnderTrack.Events?.on?.('state:changed', (newState, oldState) => {
      if ((newState.zoom !== oldState.zoom || newState.zZoom !== oldState.zZoom) && !this.userModifying) {
        console.log('[Nav] zoom changed:', newState.zoom?.toFixed(2), 'zZoom:', newState.zZoom?.toFixed?.(2));
        this.updateSliderRanges(newState);
      }
    });

    setTimeout(() => {
      if (!this.userModifying) this.updateSliderRanges(EnderTrack.State.get());
    }, 1000);
  }

  setupXYCoupledControl() {
    const xySlider = document.getElementById('sensitivityXY');
    const xyInput = document.getElementById('sensitivityXYInput');
    const xyControlDiv = document.getElementById('xyControl');

    if (xySlider && xyInput) {
      xySlider.addEventListener('input', (e) => {
        this.userModifying = true;
        const value = parseFloat(e.target.value);
        xyInput.value = value.toFixed(2);
        this.setSensitivity('x', value);
        this.setSensitivity('y', value);
        setTimeout(() => { this.userModifying = false; }, 200);
      });

      xyInput.addEventListener('input', (e) => {
        this.userModifying = true;
        const value = parseFloat(e.target.value);
        if (!isNaN(value) && value >= 0.01 && value <= (parseFloat(e.target.max) || 50)) {
          xySlider.value = value;
          this.setSensitivity('x', value);
          this.setSensitivity('y', value);
        }
        setTimeout(() => { this.userModifying = false; }, 200);
      });

      if (xyControlDiv) {
        xyControlDiv.addEventListener('wheel', (e) => {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 0.1;
          const newValue = Math.max(0.01, Math.min(50, parseFloat(xySlider.value) + (e.deltaY < 0 ? step : -step)));
          xySlider.value = newValue;
          xyInput.value = newValue.toFixed(2);
          this.setSensitivity('x', newValue);
          this.setSensitivity('y', newValue);
        });
      }
    }
  }

  setSensitivity(axis, value) {
    const clamped = EnderTrack.Math.clamp(value, 0.01, 50);
    EnderTrack.State.update({ [`sensitivity${axis.toUpperCase()}`]: clamped });
    this.updateSensitivityUI(axis, clamped);
  }

  updateSensitivityUI(axis, value) {
    const slider = document.getElementById(`sensitivity${axis.toUpperCase()}`);
    const input = document.getElementById(`sensitivity${axis.toUpperCase()}Input`);
    if (slider && parseFloat(slider.value) !== value) slider.value = value;
    if (input && parseFloat(input.value) !== value) input.value = value.toFixed(2);
  }

  // === CONTEXT MENU ===

  setupAxisContextMenus() {
    [
      { controlId: 'xyControl', axis: 'xy', lockAxis: 'XY' },
      { controlId: 'xControl', axis: 'x', lockAxis: 'X' },
      { controlId: 'yControl', axis: 'y', lockAxis: 'Y' },
      { controlId: 'zControl', axis: 'z', lockAxis: 'Z' }
    ].forEach(({ controlId, axis, lockAxis }) => {
      const el = document.getElementById(controlId);
      if (el) el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showAxisContextMenu(e.clientX, e.clientY, axis, lockAxis);
      });
    });
  }

  showAxisContextMenu(x, y, axis, lockAxis) {
    document.getElementById('axisContextMenu')?.remove();
    const state = EnderTrack.State.get();
    const isCoupled = state.lockXY;
    const isXY = axis === 'xy' || axis === 'x' || axis === 'y';
    const isLocked = lockAxis === 'XY' ? (state.lockX && state.lockY) : state[`lock${lockAxis}`];

    const menu = document.createElement('div');
    menu.id = 'axisContextMenu';
    menu.className = 'axis-context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    let html = '';
    if (!isLocked) {
      html += `
        <button onmousedown="setAxisPreset('${axis}','fine'); this.parentElement.remove()">F — Fine</button>
        <button onmousedown="setAxisPreset('${axis}','coarse'); this.parentElement.remove()">C — Coarse</button>
        <div class="ctx-separator"></div>
      `;
    }
    html += `<button onmousedown="toggleLock('${lockAxis}'); this.parentElement.remove()">${isLocked ? '🔓 Déverrouiller' : '🔒 Verrouiller'} ${lockAxis}</button>`;
    if (isXY) {
      html += `<button onmousedown="toggleCoupling(); this.parentElement.remove()">${isCoupled ? 'Découpler XY' : 'Coupler XY'}</button>`;
    }
    menu.innerHTML = html;
    document.body.appendChild(menu);
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  // === DIRECTIONAL CONTROLS ===

  setupDirectionalControls() {
    ['up', 'down', 'left', 'right', 'upLeft', 'upRight', 'downLeft', 'downRight', 'zUp', 'zDown'].forEach(direction => {
      const btn = document.getElementById(direction);
      if (!btn) return;

      let isPressed = false;
      const handlePress = () => {
        if (isPressed || EnderTrack.State.get().isMoving) return;
        isPressed = true;
        btn.classList.add('pressed');
        this.moveDirection(direction);
      };
      const handleRelease = () => {
        isPressed = false;
        btn.classList.remove('pressed');
      };

      btn.addEventListener('mousedown', (e) => { e.preventDefault(); handlePress(); });
      btn.addEventListener('mouseup', handleRelease);
      btn.addEventListener('mouseleave', handleRelease);
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); handlePress(); });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); handleRelease(); });
      btn.addEventListener('touchcancel', (e) => { e.preventDefault(); handleRelease(); });
    });
  }

  // === ABSOLUTE CONTROLS ===

  setupAbsoluteControls() {
    document.getElementById('goToPoint')?.addEventListener('click', () => this.goToAbsolute());
    document.getElementById('homeXYBtn')?.addEventListener('click', () => this.goHome('xy'));
    document.getElementById('homeXYZBtn')?.addEventListener('click', () => this.goHome('xyz'));

    ['inputX', 'inputY', 'inputZ'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.goToAbsolute(); });
      input.addEventListener('input', () => this.updateAbsoluteOverlay());
      input.addEventListener('wheel', (e) => {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.1;
        input.value = ((parseFloat(input.value) || 0) + (e.deltaY < 0 ? step : -step)).toFixed(1);
        this.updateAbsoluteOverlay();
      });
    });
  }

  updateAbsoluteOverlay() {
    const pos = EnderTrack.State.get().pos;
    for (const [id, current] of Object.entries({ inputX: pos.x, inputY: pos.y, inputZ: pos.z })) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('potential', Math.abs((parseFloat(el.value) || 0) - current) > 0.01);
    }
    const x = parseFloat(document.getElementById('inputX')?.value) || 0;
    const y = parseFloat(document.getElementById('inputY')?.value) || 0;
    const z = parseFloat(document.getElementById('inputZ')?.value) || 0;
    EnderTrack.State.update({ targetPosition: { x, y, z } });
    EnderTrack.Canvas?.requestRender?.();
    window.EnderTrack?.ZVisualization?.render?.();
  }

  // === INPUT MODE ===

  setInputMode(mode) {
    if (mode !== 'relative' && mode !== 'absolute') return;
    this.inputMode = mode;
    EnderTrack.State.update({ inputMode: mode });
  }

  // === LOCKS ===

  toggleLock(axis) {
    const state = EnderTrack.State.get();

    if (axis === 'XY') {
      const newLock = !(state.lockX && state.lockY);
      EnderTrack.State.update({ lockX: newLock, lockY: newLock });
      this.updateLockUI('X', newLock);
      this.updateLockUI('Y', newLock);
      this.updateLockUI('XY', newLock);
    } else if (axis === 'X' || axis === 'Y') {
      const newLock = !state[`lock${axis}`];
      EnderTrack.State.update({ [`lock${axis}`]: newLock });
      this.updateLockUI(axis, newLock);
      if (state.lockXY) {
        const other = axis === 'X' ? 'Y' : 'X';
        EnderTrack.State.update({ [`lock${other}`]: newLock });
        this.updateLockUI(other, newLock);
        this.updateLockUI('XY', newLock);
      }
    } else if (axis === 'HomeXY' || axis === 'HomeXYZ') {
      const newLock = !state[`lock${axis}`];
      EnderTrack.State.update({ [`lock${axis}`]: newLock });
      this.updateLockUI(axis, newLock);
    } else {
      const newLock = !state[`lock${axis}`];
      EnderTrack.State.update({ [`lock${axis}`]: newLock });
      this.updateLockUI(axis, newLock);
    }
    this.updateButtonStates();
  }

  toggleCoupling() {
    const state = EnderTrack.State.get();
    const coupled = !state.lockXY;

    if (coupled && state.lockX !== state.lockY) {
      EnderTrack.State.update({ lockXY: coupled, lockX: false, lockY: false });
      this.updateLockUI('X', false);
      this.updateLockUI('Y', false);
      this.updateLockUI('XY', false);
    } else {
      EnderTrack.State.update({ lockXY: coupled });
      if (coupled) this.updateLockUI('XY', state.lockX);
    }
    this.updateCouplingUI(coupled);
  }

  updateCouplingUI(coupled) {
    const xy = document.getElementById('xyControl');
    const x = document.getElementById('xControl');
    const y = document.getElementById('yControl');
    if (xy && x && y) {
      xy.style.display = coupled ? 'grid' : 'none';
      x.style.display = coupled ? 'none' : 'grid';
      y.style.display = coupled ? 'none' : 'grid';
    }
  }

  updateLockUI(axis, isLocked) {
    const controlMap = { XY: 'xyControl', X: 'xControl', Y: 'yControl', Z: 'zControl' };
    const el = document.getElementById(controlMap[axis]);
    if (el) {
      el.classList.toggle('locked', isLocked);
      // Hide sensitivity entirely when locked
      if (axis === 'Z' || axis === 'X' || axis === 'Y') {
        el.style.display = isLocked ? 'none' : '';
      } else if (axis === 'XY') {
        el.style.display = isLocked ? 'none' : 'grid';
      }
    }

    const H = window.ControlsHelpers;
    if (axis === 'XY') {
      H.updateAbsoluteInput('inputX', isLocked);
      H.updateAbsoluteInput('inputY', isLocked);
    } else if (axis === 'HomeXY' || axis === 'HomeXYZ') {
      H.updateHomeButton(axis === 'HomeXY' ? 'homeXYBtn' : 'homeXYZBtn', isLocked);
    } else if (axis === 'X' || axis === 'Y' || axis === 'Z') {
      H.updateAbsoluteInput(`input${axis}`, isLocked);
    }
  }

  updateButtonStates() {
    const state = EnderTrack.State.get();
    const lx = state.lockX, ly = state.lockY, lz = state.lockZ;

    const setDisabled = (id, disabled) => { const el = document.getElementById(id); if (el) el.disabled = disabled; };
    setDisabled('up', ly); setDisabled('down', ly);
    setDisabled('left', lx); setDisabled('right', lx);
    setDisabled('upLeft', lx || ly); setDisabled('upRight', lx || ly);
    setDisabled('downLeft', lx || ly); setDisabled('downRight', lx || ly);
    setDisabled('zUp', lz); setDisabled('zDown', lz);

    const homeXY = document.getElementById('homeXYBtn');
    const homeXYZ = document.getElementById('homeXYZBtn');
    if (homeXY) { homeXY.disabled = state.lockHomeXY || false; homeXY.classList.toggle('disabled', state.lockHomeXY || false); }
    if (homeXYZ) { homeXYZ.disabled = state.lockHomeXYZ || false; homeXYZ.classList.toggle('disabled', state.lockHomeXYZ || false); }

    const gotoX = document.getElementById('gotoFieldX');
    const gotoY = document.getElementById('gotoFieldY');
    const gotoZ = document.getElementById('gotoFieldZ');
    if (gotoX) gotoX.classList.toggle('locked', lx);
    if (gotoY) gotoY.classList.toggle('locked', ly);
    if (gotoZ) gotoZ.classList.toggle('locked', lz);

    const xyLabel = document.getElementById('xyCenterLabel');
    const zLabel = document.getElementById('zCenterLabel');
    if (xyLabel) xyLabel.style.opacity = (lx && ly) ? '0.2' : '';
    if (zLabel) zLabel.style.opacity = lz ? '0.2' : '';
  }

  // === MOVEMENT ===

  async moveDirection(direction) {
    return EnderTrack.Movement?.moveDirection?.(direction);
  }

  async goToAbsolute() {
    const x = parseFloat(document.getElementById('inputX')?.value) || 0;
    const y = parseFloat(document.getElementById('inputY')?.value) || 0;
    const z = parseFloat(document.getElementById('inputZ')?.value) || 0;
    try {
      await EnderTrack.Movement?.moveAbsolute(x, y, z);
    } catch (e) {
      EnderTrack.UI?.showNotification?.('Erreur de positionnement absolu', 'error');
    }
  }

  async goHome(mode = 'xy') {
    return EnderTrack.Movement?.goHome?.(mode);
  }

  // === PRESETS ===

  setPreset(preset) {
    const state = EnderTrack.State.get();
    const viewXY = this._getViewSizeXY();
    const viewZ = this._getViewSizeZ(state);
    const factor = preset === 'fine' ? 0.01 : preset === 'coarse' ? 0.1 : null;
    if (!factor) return;

    const valXY = Math.max(0.01, viewXY * factor);
    const valZ = Math.max(0.01, viewZ * factor);
    const updates = {};
    if (!state.lockX) updates.sensitivityX = valXY;
    if (!state.lockY) updates.sensitivityY = valXY;
    if (!state.lockZ) updates.sensitivityZ = valZ;
    EnderTrack.State.update(updates);

    this.updateSensitivityUI('x', valXY);
    this.updateSensitivityUI('y', valXY);
    this.updateSensitivityUI('z', valZ);
    if (state.lockXY) {
      const s = document.getElementById('sensitivityXY'), i = document.getElementById('sensitivityXYInput');
      if (s) s.value = valXY; if (i) i.value = valXY.toFixed(2);
    }
  }

  setAxisPreset(axis, preset) {
    const state = EnderTrack.State.get();
    const factors = window.EnderTrack?.StrategicPositions?.getFactors() || {};
    const af = factors[axis] || { fine: 1, coarse: 10 };
    const viewSize = axis === 'z' ? this._getViewSizeZ(state) : this._getViewSizeXY();
    const pct = preset === 'fine' ? af.fine : preset === 'coarse' ? af.coarse : null;
    if (!pct) return;
    const val = Math.max(0.01, viewSize * (pct / 100));

    if (axis === 'xy') {
      if (!state.lockX) { EnderTrack.State.update({ sensitivityX: val }); this.updateSensitivityUI('x', val); }
      if (!state.lockY) { EnderTrack.State.update({ sensitivityY: val }); this.updateSensitivityUI('y', val); }
      if (state.lockXY) {
        const s = document.getElementById('sensitivityXY'), i = document.getElementById('sensitivityXYInput');
        if (s) s.value = val; if (i) i.value = val.toFixed(2);
      }
    } else {
      if (!state[`lock${axis.toUpperCase()}`]) {
        EnderTrack.State.update({ [`sensitivity${axis.toUpperCase()}`]: val });
        this.updateSensitivityUI(axis, val);
      }
    }
  }

  _getViewSizeXY() {
    const coords = window.EnderTrack?.Coordinates;
    const canvas = document.getElementById('mapCanvas');
    if (!coords || !canvas) return 50;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1) return 50;
    const tl = coords.canvasToMap(0, 0), br = coords.canvasToMap(rect.width, rect.height);
    return Math.min(Math.abs(br.x - tl.x), Math.abs(br.y - tl.y));
  }

  _getViewSizeZ(state) {
    const zRange = Math.abs((state.coordinateBounds?.z?.max || 100) - (state.coordinateBounds?.z?.min || 0));
    return zRange / (state.zZoom || 1);
  }

  // === SLIDER RANGES ===

  updateSliderRanges(state) {
    if (this.updatingSliders) return;
    this.updatingSliders = true;

    const viewXY = this._getViewSizeXY() / 4;
    const viewZ = this._getViewSizeZ(state) / 2;
    const min = state.plateauConfig?.minStep || 0.01;

    const rescale = (el, aMin, aMax) => {
      if (!el) return;
      el.max = aMax.toFixed(3);
      el.min = aMin.toFixed(3);
      el.step = aMax > 1 ? '0.01' : '0.001';
      // Clamp current value to new range without changing it otherwise
      const val = parseFloat(el.value);
      if (val > aMax) el.value = aMax.toFixed(3);
      if (val < aMin) el.value = aMin.toFixed(3);
    };

    const maxXY = Math.max(min, viewXY), minXY = Math.max(min, viewXY / 100);
    const maxZ = Math.max(min, viewZ), minZ = Math.max(min, viewZ / 100);

    ['sensitivityXY', 'sensitivityX', 'sensitivityY'].forEach(id => {
      rescale(document.getElementById(id), minXY, maxXY);
      rescale(document.getElementById(id + 'Input'), minXY, maxXY);
    });
    rescale(document.getElementById('sensitivityZ'), minZ, maxZ);
    rescale(document.getElementById('sensitivityZInput'), minZ, maxZ);

    if (!this.userModifying && this.lastZoom !== undefined) {
      const updates = {};
      const xyVal = parseFloat(document.getElementById('sensitivityXY')?.value);
      const zVal = parseFloat(document.getElementById('sensitivityZ')?.value);
      if (!isNaN(xyVal)) { updates.sensitivityX = Math.max(min, xyVal); updates.sensitivityY = Math.max(min, xyVal); }
      if (!isNaN(zVal)) updates.sensitivityZ = Math.max(min, zVal);
      if (Object.keys(updates).length) EnderTrack.State.update(updates);
    }
    this.lastZoom = state.zoom;

    setTimeout(() => { this.updatingSliders = false; }, 100);
  }

  // === SYNC ===

  syncUIWithState() {
    const state = EnderTrack.State.get();

    this.updateSensitivityUI('x', state.sensitivityX);
    this.updateSensitivityUI('y', state.sensitivityY);
    this.updateSensitivityUI('z', state.sensitivityZ);

    if (state.lockXY) {
      const avg = (state.sensitivityX + state.sensitivityY) / 2;
      const s = document.getElementById('sensitivityXY'), i = document.getElementById('sensitivityXYInput');
      if (s) s.value = avg; if (i) i.value = avg.toFixed(2);
    }

    this.updateLockUI('X', state.lockX);
    this.updateLockUI('Y', state.lockY);
    this.updateLockUI('Z', state.lockZ);
    if (state.lockXY) this.updateLockUI('XY', state.lockX && state.lockY);

    this.updateCouplingUI(state.lockXY);
    this.updateButtonStates();

    this.updateLockUI('HomeXY', state.lockHomeXY || false);
    this.updateLockUI('HomeXYZ', state.lockHomeXYZ || false);
    setTimeout(() => this.updateButtonStates(), 100);

    for (const [id, val] of Object.entries({ inputX: state.pos.x, inputY: state.pos.y, inputZ: state.pos.z })) {
      const el = document.getElementById(id);
      if (el) { el.value = val.toFixed(2); el.classList.remove('potential'); }
    }

    // Sync lock indicators on goto fields
    ['X', 'Y', 'Z'].forEach(axis => {
      const input = document.getElementById(`input${axis}`);
      const isLocked = state[`lock${axis}`] || (axis !== 'Z' && state.lockXY && (state.lockX || state.lockY));
      if (input) {
        input.parentElement?.classList.toggle('locked', isLocked);
        input.disabled = isLocked;
      }
    });
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Navigation = new NavigationControls();

// Global functions
window.setInputMode = (mode) => EnderTrack.Navigation?.setInputMode?.(mode);
window.moveDirection = (direction) => EnderTrack.Navigation?.moveDirection?.(direction);
window.goHome = (mode) => EnderTrack.Navigation?.goHome?.(mode);
window.toggleCoupling = () => EnderTrack.Navigation?.toggleCoupling?.();
window.emergencyStop = () => EnderTrack.Movement?.emergencyStopMovement?.();
window.setAxisPreset = (axis, preset) => EnderTrack.Navigation?.setAxisPreset?.(axis, preset);
window.toggleLock = (axis) => EnderTrack.Navigation?.toggleLock?.(axis);
window.goToAbsolute = () => EnderTrack.Navigation?.goToAbsolute?.();
