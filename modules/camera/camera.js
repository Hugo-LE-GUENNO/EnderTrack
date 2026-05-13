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
    };
    this._frameListeners = [];
    this._navEl = null;
    // Image processing
    this.grayscale = true;
    this.lutId = 'gray';
    this._lutTable = null;
    this.histogram = null;
    this.fastExplore = null;
    this.tiles = [];
    // Register scenario action early (even without driver)
    setTimeout(() => this._registerScenarioAction(), 100);
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
      // Init histogram and fast-explore if available
      if (!this.histogram && window.EnderTrack?.CameraHistogram) {
        this.histogram = new window.EnderTrack.CameraHistogram();
        this.histogram.inject();
      }
      if (!this.fastExplore && window.EnderTrack?.CameraFastExplore) {
        this.fastExplore = new window.EnderTrack.CameraFastExplore(this);
      }
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
      p.path = `${p.storagePath || this.config.storagePath || './captures'}/acq_${ts}_X${pos.x.toFixed(2)}_Y${pos.y.toFixed(2)}_Z${pos.z.toFixed(2)}.${p.format || 'png'}`;
    }
    const result = await this.driver.capture(p);
    if (result.success && result.frame) {
      // Save to server
      try {
        const url = window.ENDERTRACK_SERVER || 'http://localhost:5000';
        const res = await fetch(url + '/api/capture/save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frame: result.frame, path: p.path })
        });
        const saved = await res.json();
        result.path = saved.path || p.path;
      } catch (e) {
        result.error = 'Save failed: ' + e.message;
      }
    }
    return result;
  }

  async startLive() {
    if (!this.driver) return false;
    const ok = await this.driver.startLive();
    if (ok) { this.live = true; this._renderNav(); }
    return ok;
  }

  async stopLive() {
    if (!this.driver) return false;
    await this.driver.stopLive();
    this.live = false;
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


  // === FRAME LISTENERS ===

  onFrame(fn) { this._frameListeners.push(fn); }
  offFrame(fn) { this._frameListeners = this._frameListeners.filter(f => f !== fn); }
  _emitFrame(frame) { this._frameListeners.forEach(fn => fn(frame)); }

  // === NAV CONTROLS ===

  _renderNav() {
    const zone = document.getElementById('navPluginZone');
    if (!zone) return;
    const cameras = window._cameras || [];
    if (!cameras.length || this.driverName === 'simulation') {
      if (this._navEl) { this._navEl.remove(); this._navEl = null; }
      return;
    }
    if (!this._navEl) {
      this._navEl = document.createElement('div');
      this._navEl.id = 'camera-nav';
      zone.appendChild(this._navEl);
    }
    const recording = this._recording;
    this._navEl.innerHTML = `
      <style>
        #camera-nav .cam-btn { padding:5px 8px; border:none; border-radius:4px; cursor:pointer; font-size:10px; flex:1; min-width:0; background:var(--app-bg); color:var(--text-general); transition:background 0.15s; }
        #camera-nav .cam-btn:hover { background:var(--active-element); color:var(--text-selected); }
        #camera-nav .cam-btn.rec { background:#ef4444; color:#fff; }
      </style>
      ${cameras.map((cam, i) => `
        <div style="margin-bottom:6px;">
          <div style="font-size:10px; color:var(--text-selected); margin-bottom:3px;">${cam.label}</div>
          <div style="display:flex; gap:4px;">
            ${this.live ? `
              <button class="cam-btn" onclick="EnderTrack.Camera.stopLive()">Stop</button>
              <button class="cam-btn" onclick="EnderTrack.Camera.saveLive()">Save</button>
              <button class="cam-btn ${recording ? 'rec' : ''}" onclick="EnderTrack.Camera.toggleRecord()">${recording ? '\u23f9 Rec' : '\u23fa Rec'}</button>
            ` : `
              <button class="cam-btn" onclick="window._liveAndSplit()">Live</button>
            `}
          </div>
        </div>
      `).join('')}
    `;
  }

  async saveLive() {
    const frame = await this.getFrame();
    if (!frame?.frame) return;
    const a = document.createElement('a');
    a.href = 'data:image/jpeg;base64,' + frame.frame;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = 'capture_' + ts + '.jpg';
    a.click();
  }

  toggleRecord() {
    if (this._recording) this.stopRecord();
    else this.startRecord();
  }

  startRecord() {
    if (!this.driver?._stream) return;
    this._chunks = [];
    this._mediaRecorder = new MediaRecorder(this.driver._stream, { mimeType: 'video/webm' });
    this._mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this._chunks.push(e.data); };
    this._mediaRecorder.onstop = () => {
      const blob = new Blob(this._chunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = 'record_' + ts + '.webm';
      a.click();
      URL.revokeObjectURL(a.href);
      this._chunks = [];
    };
    this._mediaRecorder.start();
    this._recording = true;
    this._renderNav();
  }

  stopRecord() {
    if (this._mediaRecorder && this._recording) {
      this._mediaRecorder.stop();
    }
    this._recording = false;
    this._renderNav();
  }
  // === IMAGE PROCESSING ===

  toggleFastExplore() {
    if (!this.fastExplore) return;
    if (this.fastExplore.active) this.fastExplore.deactivate();
    else this.fastExplore.activate();
    this._renderNav();
  }

  setLut(id) {
    this.lutId = id;
    this.grayscale = (id !== 'none');
    this._buildLutTable();
  }

  _buildLutTable() {
    const luts = window.EnderTrack?.CameraLUTs;
    if (!luts || !this.lutId || this.lutId === 'none') { this._lutTable = null; return; }
    const def = luts[this.lutId];
    this._lutTable = def ? def.generate() : null;
  }

  // === STATUS WIDGET ===

  _updateStatus() {
    const sp = window.EnderTrack?.StatusPeripherals;
    if (!sp) return;
    const cameras = window._cameras || [];
    // Remove old entries
    for (let i = 0; i < 8; i++) sp.remove('camera_' + i);
    if (this.driverName === 'simulation' || !cameras.length) return;
    cameras.forEach((cam, i) => {
      sp.set('camera_' + i, {
        name: cam.label,
        icon: '📷',
        state: 'connected',
        detail: cam.type
      });
    });
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
        { id: "label", label: "Label", type: "text", default: "Capture" },
        { id: "cameraId", label: "Caméra", type: "select", options: (window._cameras || []).map(c => ({ value: String(c.id), label: c.label })), default: "" },
        { id: "format", label: "Format", type: "select", options: [
          { value: "tiff", label: "TIFF" },
          { value: "png", label: "PNG" },
          { value: "jpeg", label: "JPEG" }
        ], default: "tiff" },
        { id: "path", label: "Chemin", type: "text", default: "./captures" },
        { id: "showInLog", label: "Log", type: "checkbox", default: true }
      ],
      execute: async (params, context) => {
        let result;
        let video = null;
        const cam = window.EnderTrack.Camera;
        // 1. Try existing live video in DOM
        for (const v of document.querySelectorAll("video")) {
          if (v.readyState >= 2 && v.videoWidth > 0) { video = v; break; }
        }
        // 2. If none, use driver stream or open webcam
        if (!video) {
          try {
            const stream = cam?.driver?._stream || await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
            const tmp = document.createElement("video");
            tmp.srcObject = stream;
            tmp.muted = true;
            await tmp.play();
            await new Promise(r => setTimeout(r, 300));
            if (tmp.videoWidth > 0) video = tmp;
          } catch(e) {}
        }
        // 3. Capture frame
        if (video && video.videoWidth > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d").drawImage(video, 0, 0);
          const frame = canvas.toDataURL("image/" + (params.format === "jpeg" ? "jpeg" : "png")).split(",")[1];
          const ts = new Date().toISOString().replace(/[:.]/g, "-");
          const pos = window.EnderTrack?.State?.get?.()?.pos || {x:0,y:0,z:0};
          const path = (params.path || "./captures") + "/acq_" + ts + "_X" + pos.x.toFixed(2) + "_Y" + pos.y.toFixed(2) + "_Z" + pos.z.toFixed(2) + "." + (params.format || "png");
          try {
            const url = window.ENDERTRACK_SERVER || "http://localhost:5000";
            const res = await fetch(url + "/api/capture/save", {
              method: "POST", headers: {"Content-Type": "application/json"},
              body: JSON.stringify({ frame, path })
            });
            const saved = await res.json();
            result = { success: saved.success, path: saved.path || path };
          } catch(e) { result = { success: false, error: e.message }; }
        } else {
          result = { success: false, error: "No camera available" };
        }
        if (params.showInLog && window.EnderTrack?.Scenario?.addLog) {
          const msg = result.success ? ("Capture " + (result.path || "OK")) : ("Capture ERR: " + (result.error || "?"));
          window.EnderTrack.Scenario.addLog(msg, result.success ? "info" : "error");
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
