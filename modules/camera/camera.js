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
    this._liveLutId = 'gray';
    this._liveSettings = null;
    this._loadLiveSettings();
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
      if (!this.histogram && window.CameraHistogram) {
        this.histogram = new window.CameraHistogram();
        this.histogram.inject();
        // Live histogram: contrast/LUT apply to live viewport only
        const origRedraw = this.histogram._redraw.bind(this.histogram);
        this.histogram._redraw = () => {
          origRedraw();
          const tab = window.EnderTrack?.State?.get?.()?.activeTab;
          if (tab === 'navigation' || !tab) {
            const r = this.histogram.getContrastRange();
            const renderer = window.EnderTrack?.LiveRenderer;
            if (renderer) { renderer.setContrast(r.min, r.max); if (this._liveLutId && this._liveLutId !== 'gray') renderer.enabled = true; }
            this._saveLiveSettings();
          }
        };
        this.histogram._getCurrentLut = () => {
          if (!this._liveLutId || this._liveLutId === 'gray') return null;
          const def = window.CameraLUTs?.[this._liveLutId];
          return def ? def.generate() : null;
        };
        this.histogram._showOptionsMenu = (x, y) => {
          this._showLiveLutMenu(x, y);
        };
      }
      if (!this.fastExplore && window.CameraFastExplore) {
        this.fastExplore = new window.CameraFastExplore(this);
      }
      // Auto-start live if real camera
      if (name !== 'simulation' && !this.live) {
        await this.startLive();
        this._startLiveHistogram();
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

  _showLiveLutMenu(x, y) {
    document.getElementById('live-lut-menu')?.remove();
    const luts = window.CameraLUTs || {};
    const menu = document.createElement('div');
    menu.id = 'live-lut-menu';
    menu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:10000; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.4); padding:4px 0; min-width:120px;`;
    // Log scale toggle
    const logRow = document.createElement('div');
    logRow.style.cssText = 'padding:4px 10px; font-size:11px; cursor:pointer; color:var(--text-general);';
    logRow.innerHTML = `<span style="width:14px; display:inline-block;">${this.histogram?.logScale ? '\u2713' : ''}</span>Log scale`;
    logRow.onmouseenter = () => logRow.style.background = 'var(--app-bg)';
    logRow.onmouseleave = () => logRow.style.background = '';
    logRow.onclick = () => { if (this.histogram) { this.histogram.logScale = !this.histogram.logScale; this.histogram._redraw(); } menu.remove(); };
    menu.appendChild(logRow);
    // RGB toggle
    const renderer = window.EnderTrack?.LiveRenderer;
    const rgbRow = document.createElement('div');
    rgbRow.style.cssText = 'padding:4px 10px; font-size:11px; cursor:pointer; color:var(--text-general);';
    rgbRow.innerHTML = `<span style="width:14px; display:inline-block;">${!renderer?.enabled ? '\u2713' : ''}</span>RGB (no LUT)`;
    rgbRow.onmouseenter = () => rgbRow.style.background = 'var(--app-bg)';
    rgbRow.onmouseleave = () => rgbRow.style.background = '';
    rgbRow.onclick = () => { if (renderer) { renderer.enabled = false; renderer.lutId = 'gray'; renderer._lutTable = null; } this._liveLutId = 'gray'; this._saveLiveSettings(); menu.remove(); };
    menu.appendChild(rgbRow);
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px; background:#444; margin:4px 8px;';
    menu.appendChild(sep);
    // LUT options
    for (const [id, def] of Object.entries(luts)) {
      const active = id === this._liveLutId;
      const row = document.createElement('div');
      row.style.cssText = `padding:4px 10px; font-size:11px; cursor:pointer; color:${active ? 'var(--text-selected)' : 'var(--text-general)'}; background:${active ? 'var(--active-element)' : 'transparent'};`;
      row.textContent = def.name;
      row.onmouseenter = () => { if (!active) row.style.background = 'var(--app-bg)'; };
      row.onmouseleave = () => { if (!active) row.style.background = ''; };
      row.onclick = () => { this._liveLutId = id; const renderer = window.EnderTrack?.LiveRenderer; if (renderer) { renderer.setLut(id); renderer.enabled = true; }; this.histogram?._redraw?.(); this._saveLiveSettings(); menu.remove(); };
      menu.appendChild(row);
    }
    document.body.appendChild(menu);
    setTimeout(() => { const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } }; document.addEventListener('mousedown', close); }, 0);
  }

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
        #camera-nav .cam-btn { padding:6px 12px; border:none; border-radius:4px; cursor:pointer; font-size:11px; flex:1; min-width:0; background:var(--app-bg); color:var(--text-general); transition:background 0.15s; font-weight:500; }
        #camera-nav .cam-btn:hover { background:var(--active-element); color:var(--text-selected); }
        #camera-nav .cam-btn.rec { background:#ef4444; color:#fff; animation:recBlink 1s ease-in-out infinite; }
        @keyframes recBlink { 50% { opacity:0.7; } }
      </style>
      <div style="display:flex; gap:4px;">
        <button class="cam-btn" onclick="EnderTrack.Camera.saveLive()">\ud83d\udcf7 Photo</button>
        <button class="cam-btn ${recording ? 'rec' : ''}" onclick="EnderTrack.Camera.toggleRecord()">${recording ? '\u23f9 Stop' : '\ud83c\udfac Vid\u00e9o'}</button>
      </div>
    `;
  }

  async saveLive() {
    const frame = await this.getFrame();
    if (!frame?.frame) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const pos = window.EnderTrack?.State?.get?.()?.pos || {x:0,y:0,z:0};
    const path = './captures/snap_' + ts + '_X' + pos.x.toFixed(2) + '_Y' + pos.y.toFixed(2) + '_Z' + pos.z.toFixed(2) + '.png';
    // Save to server (for gallery)
    try {
      const url = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      await fetch(url + '/api/capture/save', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ frame: frame.frame, path })
      });
    } catch(e) {}
    // Also download locally
    const a = document.createElement('a');
    a.href = 'data:image/png;base64,' + frame.frame;
    a.download = path.split('/').pop();
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
    this._updateLiveOverlay();
  }

  stopRecord() {
    if (this._mediaRecorder && this._recording) {
      this._mediaRecorder.stop();
    }
    this._recording = false;
    this._renderNav();
    this._updateLiveOverlay();
  }

  _updateLiveOverlay() {
    const overlay = document.getElementById('liveOverlayBadge');
    if (!overlay) return;
    if (this._recording) {
      overlay.innerHTML = '<span style="padding:2px 6px; border-radius:3px; font-size:9px; font-weight:600; background:rgba(34,197,94,0.85); color:#000;">LIVE</span><span style="padding:2px 6px; border-radius:3px; font-size:9px; font-weight:600; background:rgba(239,68,68,0.9); color:#fff; animation:recBlink 1s ease-in-out infinite;">REC</span>';
    } else {
      overlay.innerHTML = '<span style="padding:2px 6px; border-radius:3px; font-size:9px; font-weight:600; background:rgba(34,197,94,0.85); color:#000;">LIVE</span>';
    }
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

  // Live histogram: periodically grab frame and update histogram
  _startLiveHistogram() {
    if (this._liveHistTimer) return;
    this._liveHistTimer = setInterval(() => {
      if (!this.live || !this.histogram) return;
      const tab = window.EnderTrack?.State?.get?.()?.activeTab;
      if (tab !== 'navigation') return;
      this.getFrame().then(f => {
        if (f?.frame) this.histogram.updateFromBase64(f.frame);
      }).catch(() => {});
    }, 1000);
  }

  _stopLiveHistogram() {
    if (this._liveHistTimer) { clearInterval(this._liveHistTimer); this._liveHistTimer = null; }
  }

  // Show/hide histogram based on active tab
  showHistogram(show) {
    if (this.histogram?.el) this.histogram.el.style.display = show ? '' : 'none';
  }

  // Switch viewport source based on active tab
  switchViewportForTab(tabId) {
    const display = window.EnderTrack?.Display;
    const cameras = window._cameras || [];
    const hasCamera = cameras.length && this.driverName !== 'simulation';
    if (!display) return;

    const liveRenderer = window.EnderTrack?.LiveRenderer;
    const multiVp = display.viewports.length > 1;
    const targetVp = multiVp ? 1 : 0;
    const vp = display.viewports[targetVp];
    if (!vp) return;

    // Save current renderer state before switching
    if (liveRenderer) {
      if (vp.source?.startsWith('camera')) {
        this._liveSettings = { min: liveRenderer.min, max: liveRenderer.max, lutId: this._liveLutId || 'gray' };
      } else if (vp.source === 'gallery') {
        window.EnderTrack?.ImageManager?._saveCurrentSettings?.();
      }
    }

    if (tabId === 'navigation') {
      this.showHistogram(hasCamera);
      const metaPanel = document.getElementById('imageMetadataPanel');
      if (metaPanel) metaPanel.style.display = 'none';
      if (hasCamera && vp.source !== 'camera:0') display.assignSource(targetVp, 'camera:0');
      // Restore live histogram settings
      if (liveRenderer && this._liveSettings) {
        liveRenderer.min = this._liveSettings.min;
        liveRenderer.max = this._liveSettings.max;
        liveRenderer.lutId = this._liveSettings.lutId;
        liveRenderer.enabled = this._liveSettings.lutId !== 'gray';
        this._liveLutId = this._liveSettings.lutId;
        const def = window.CameraLUTs?.[this._liveSettings.lutId];
        liveRenderer._lutTable = def ? def.generate() : null;
        if (this.histogram) {
          this.histogram.mode = this._liveSettings.autoContrast ? 'auto' : 'manual';
          this.histogram.manualMin = Math.round((this._liveSettings.min / 255) * 255);
          this.histogram.manualMax = Math.round((this._liveSettings.max / 255) * 255);
          this.histogram._redraw();
        }
      }
    } else if (tabId === 'image') {
      this.showHistogram(false);
      // Restore gallery image settings into renderer before showing
      const imgMgr = window.EnderTrack?.ImageManager;
      const renderer = window.EnderTrack?.GalleryRenderer;
      if (imgMgr && renderer) {
        const img = imgMgr.getSelectedImage();
        const s = img ? imgMgr._imageSettings[img.path] : null;
        if (s) {
          renderer.min = s.min;
          renderer.max = s.max;
          renderer.lutId = s.lutId;
          renderer.rgbMode = s.rgbMode;
          const def = window.CameraLUTs?.[s.lutId];
          renderer._lutTable = def ? def.generate() : null;
        } else {
          renderer.min = 0; renderer.max = 255;
          renderer.lutId = 'gray'; renderer.rgbMode = false;
          renderer._lutTable = null;
        }
      }
      if (vp.source !== 'gallery') display.assignSource(targetVp, 'gallery');
    } else {
      this.showHistogram(false);
      if (!multiVp && vp.source !== 'stage') display.assignSource(0, 'stage');
    }
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

  async _loadLiveSettings() {
    try {
      const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      const res = await fetch(base + '/api/live/settings');
      const data = await res.json();
      if (data && data.lutId) {
        this._liveSettings = data;
        this._liveLutId = data.lutId;
      }
    } catch {}
  }

  _saveLiveSettings() {
    const renderer = window.EnderTrack?.LiveRenderer;
    if (!renderer) return;
    this._liveSettings = {
      min: renderer.min, max: renderer.max,
      lutId: this._liveLutId || 'gray',
      autoContrast: this.histogram?.mode === 'auto'
    };
    clearTimeout(this._liveSettingsTimer);
    this._liveSettingsTimer = setTimeout(() => {
      const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      fetch(base + '/api/live/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this._liveSettings)
      }).catch(() => {});
    }, 1000);
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
