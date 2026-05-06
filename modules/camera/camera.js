// modules/camera/camera.js — Camera abstraction module

class CameraModule {
  constructor() {
    this.driver = null;
    this.driverName = null;
    this.live = false;
    this.config = {
      resolution: [640, 480],
      exposure: 100000,
      gain: 1.0,
      format: 'tiff',
      storagePath: './captures'
    };
    this._frameListeners = [];
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
    }
    return ok;
  }

  getAvailableDrivers() {
    return Object.keys(window.EnderTrack?.CameraDrivers || {});
  }

  // === API ===

  async configure(params) {
    Object.assign(this.config, params);
    if (this.driver?.configure) return await this.driver.configure(this.config);
    return { success: true, config: this.config };
  }

  async capture(params = {}) {
    if (!this.driver) return { success: false, error: 'No driver' };
    const p = { ...this.config, ...params };
    // Auto-generate filename with nomenclature
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
    if (ok) { this.live = true; this._updateStatus(); }
    return ok;
  }

  async stopLive() {
    if (!this.driver) return false;
    await this.driver.stopLive();
    this.live = false;
    this._updateStatus();
    return true;
  }

  async getFrame() {
    if (!this.driver) return null;
    return await this.driver.getFrame();
  }

  getStatus() {
    return {
      connected: !!this.driver,
      driver: this.driverName,
      live: this.live,
      config: { ...this.config }
    };
  }

  // === FRAME LISTENERS ===

  onFrame(fn) { this._frameListeners.push(fn); }
  offFrame(fn) { this._frameListeners = this._frameListeners.filter(f => f !== fn); }
  _emitFrame(frame) { this._frameListeners.forEach(fn => fn(frame)); }

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

// Auto-init with simulation driver if no hardware detected
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.Camera.setDriver('simulation'));
} else {
  setTimeout(() => EnderTrack.Camera.setDriver('simulation'), 0);
}
