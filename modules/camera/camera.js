// modules/camera/camera.js — Camera abstraction module

class CameraModule {
  constructor() {
    this.driver = null;
    this.driverName = null;
    this.live = false;
    this.config = {
      resolution: [1280, 720],
      exposure: 100000,
      gain: 1.0,
      format: 'tiff',
      storagePath: './captures',
      pixelSize: 1.0,       // µm/px
      rotation: 0,          // degrees
      flipH: false,
      flipV: false
    };
    this._frameListeners = [];
    this._navEl = null;
  }

  // === DRIVER MANAGEMENT ===

  async setDriver(name) {
    if (this.live) await this.stopLive();
    const Driver = window.EnderTrack?.CameraDrivers?.[name];
    if (!Driver) {
      console.warn(`[Camera] Driver "${name}" not found`);
      return false;
    }
    this.driver = new Driver(this);
    this.driverName = name;
    const ok = await this.driver.init(this.config);
    if (ok) {
      this._registerScenarioAction();
      this._updateStatus();
      this._renderNav();
    }
    return ok;
  }

  getAvailableDrivers() {
    return Object.keys(window.EnderTrack?.CameraDrivers || {});
  }

  // === API ===

  async configure(params) {
    Object.assign(this.config, params);
    if (this.driver?.configure) await this.driver.configure(this.config);
    this._renderNav();
    return { success: true, config: this.config };
  }

  async capture(params = {}) {
    if (!this.driver) return { success: false, error: 'No driver' };
    const p = { ...this.config, ...params };
    if (!p.path) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const pos = window.EnderTrack?.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
      p.path = `${this.config.storagePath}/acq_${ts}_X${pos.x.toFixed(2)}_Y${pos.y.toFixed(2)}_Z${pos.z.toFixed(2)}.${p.format}`;
    }
    return await this.driver.capture(p);
  }

  async startLive() {
    if (!this.driver) return false;
    const ok = await this.driver.startLive();
    if (ok) { this.live = true; this._updateStatus(); this._renderNav(); }
    return ok;
  }

  async stopLive() {
    if (!this.driver) return false;
    await this.driver.stopLive();
    this.live = false;
    this._updateStatus();
    this._renderNav();
    return true;
  }

  async getFrame() {
    if (!this.driver) return null;
    return await this.driver.getFrame();
  }

  getStatus() {
    return { connected: !!this.driver, driver: this.driverName, live: this.live, config: { ...this.config } };
  }

  getEffectivePixelSize() {
    return this.config.pixelSize || 1.0;
  }

  // === FRAME LISTENERS ===

  onFrame(fn) { this._frameListeners.push(fn); }
  offFrame(fn) { this._frameListeners = this._frameListeners.filter(f => f !== fn); }
  _emitFrame(frame) { this._frameListeners.forEach(fn => fn(frame)); }

  // === NAV CONTROLS ===

  _renderNav() {
    const zone = document.getElementById('navPluginZone');
    if (!zone) return;
    if (this.driverName === 'simulation') {
      if (this._navEl) { this._navEl.remove(); this._navEl = null; }
      return;
    }
    if (!this._navEl) {
      this._navEl = document.createElement('div');
      this._navEl.id = 'camera-nav';
      zone.appendChild(this._navEl);
    }

    const exp = this.config.exposure || 100000;
    const gain = this.config.gain || 1.0;
    const fmtExp = (us) => us >= 1000000 ? (us/1000000).toFixed(1)+'s' : us >= 1000 ? (us/1000).toFixed(0)+'ms' : us+'µs';

    this._navEl.innerHTML = `
      <div style="display:flex; align-items:center; gap:4px; margin-bottom:3px;">
        <span style="font-size:9px; color:var(--text-general); width:22px;">Exp</span>
        <input type="range" min="100" max="2000000" value="${exp}" step="100"
          oninput="EnderTrack.Camera.configure({exposure:parseInt(this.value)})"
          style="flex:1; height:3px; accent-color:var(--active-element);">
        <span style="font-size:9px; color:var(--coordinates-color); width:38px; text-align:right; font-family:monospace;">${fmtExp(exp)}</span>
      </div>
      <div style="display:flex; align-items:center; gap:4px; margin-bottom:3px;">
        <span style="font-size:9px; color:var(--text-general); width:22px;">Gain</span>
        <input type="range" min="1" max="16" value="${gain}" step="0.1"
          oninput="EnderTrack.Camera.configure({gain:parseFloat(this.value)})"
          style="flex:1; height:3px; accent-color:var(--active-element);">
        <span style="font-size:9px; color:var(--coordinates-color); width:38px; text-align:right; font-family:monospace;">${gain.toFixed(1)}</span>
      </div>
      <div style="display:flex; gap:4px;">
        <button onclick="EnderTrack.Camera.capture()" style="flex:1; padding:4px; border:none; border-radius:3px; cursor:pointer; font-size:9px; background:var(--app-bg); color:var(--text-general);">📷 Capture</button>
      </div>`;
  }

  // === STATUS WIDGET ===

  _updateStatus() {
    const sp = window.EnderTrack?.StatusPeripherals;
    if (!sp) return;
    if (this.driverName === 'simulation') {
      sp.remove('camera');
    } else {
      sp.set('camera', {
        name: 'Camera',
        icon: '📷',
        state: this.live ? 'connected' : 'warning',
        detail: this.driverName + (this.live ? ' (live)' : '')
      });
    }
  }

  // === SCENARIO ACTION ===

  _registerScenarioAction() {
    if (!window.EnderTrack?.ActionRegistry) return;
    window.EnderTrack.ActionRegistry.register({
      id: 'capture',
      label: '📷 Capture',
      icon: '📷',
      category: 'camera',
      params: [
        { id: 'label', label: 'Label', type: 'text', default: 'Capture' },
        { id: 'format', label: 'Format', type: 'select', options: [
          { value: 'tiff', label: 'TIFF' },
          { value: 'png', label: 'PNG' },
          { value: 'jpeg', label: 'JPEG' }
        ], default: 'tiff' },
        { id: 'showInLog', label: 'Log', type: 'checkbox', default: true }
      ],
      execute: async (params, context) => {
        const result = await window.EnderTrack.Camera.capture({ format: params.format });
        if (params.showInLog && window.EnderTrack?.Scenario?.addLog) {
          const msg = result.success ? `📷 ${result.path || 'OK'}` : `📷 ❌ ${result.error}`;
          window.EnderTrack.Scenario.addLog(msg, result.success ? 'info' : 'error');
        }
        return result;
      }
    });
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Camera = new CameraModule();
window.EnderTrack.CameraDrivers = window.EnderTrack.CameraDrivers || {};

// Auto-init with simulation driver
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.Camera.setDriver('simulation'));
} else {
  setTimeout(() => EnderTrack.Camera.setDriver('simulation'), 0);
}
