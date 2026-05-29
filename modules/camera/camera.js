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
    // Picam config
    this.picamConfig = { resolution: [1280, 720], exposure: 100000, gain: 1.0, pixel_size: 1.0, pixel_size_ref_res: [640, 480], rotation: 0, flip_h: false, flip_v: false };
    this.camRotation = 0;
    this.camFlipH = false;
    this.camFlipV = false;
    this.navigatorMode = true;
    this.showMosaic = true;
    this.fastExplore = null;
    this._loadPicamConfig();
    this.tiles = [];
    // Register scenario action early (even without driver)
    setTimeout(() => this._registerScenarioAction(), 100);
  }

  // === DRIVER MANAGEMENT ===

  async setDriver(name, opts) {
    if (this.live) await this.stopLive();
    const Driver = window.EnderTrack?.CameraDrivers?.[name];
    if (!Driver) {
      console.warn(`[Camera] Driver "${name}" not found`);
      return false;
    }
    this.driver = new Driver(this);
    this.driverName = name;
    if (opts?.url) this.driver._setUrls ? this.driver._setUrls(opts.url) : (this.driver.streamUrl = opts.url);
    const ok = await this.driver.init(this.config);
    if (ok) {
      this._registerScenarioAction();
      this._updateStatus();
      this._renderNav();
      this._renderCameraConfig();
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
            if (renderer) { renderer.setContrast(r.min, r.max); renderer.enabled = (r.min > 0 || r.max < 255 || (this._liveLutId && this._liveLutId !== 'gray')); }
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
      if (!this.fastExplore && window.EnderTrack?.FastExplore) {
        this.fastExplore = new window.EnderTrack.FastExplore(this);
      }
      // Auto-start live if real camera
      if (name !== 'simulation' && !this.live) {
        await this.startLive();
        this._startLiveHistogram();
        this._hookMosaic();
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
    const isPicam = cameras.some(c => c.type === 'picamera2');
    const exp = this.picamConfig.exposure || 100000;
    const gain = this.picamConfig.gain || 1.0;
    this._navEl.innerHTML = `
      <style>
        #camera-nav .cam-btn { padding:6px 12px; border:none; border-radius:4px; cursor:pointer; font-size:11px; flex:1; min-width:0; background:var(--app-bg); color:var(--text-general); transition:background 0.15s; font-weight:500; }
        #camera-nav .cam-btn:hover { background:var(--active-element); color:var(--text-selected); }
        #camera-nav .cam-btn.active { background:var(--active-element); color:var(--text-selected); }
      </style>
      <div style="display:flex; gap:4px; margin-bottom:6px;">
        <button class="cam-btn" onclick="EnderTrack.Camera.saveLive()">\ud83d\udcf7 Photo</button>
        ${isPicam ? `<button class="cam-btn" onclick="EnderTrack.Camera.runAutofocus('full')" oncontextmenu="event.preventDefault(); EnderTrack.Camera._afContextMenu(event)">\ud83d\udd2c AF</button>` : ''}
        <button class="cam-btn ${this.fastExplore?.active ? 'active' : ''}" onclick="EnderTrack.Camera.toggleFastExplore()">\ud83d\udd32 Explore</button>
      </div>
      ${isPicam ? `
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px; padding-top:8px; border-top:1px solid #333;">
        <div style="display:flex; align-items:center; gap:4px;">
          <span style="font-size:9px; color:var(--text-general); width:32px;">Expo</span>
          <input type="range" min="1000" max="1000000" value="${exp}" step="1000"
            oninput="document.getElementById('nav-exp-val').textContent=Math.round(this.value/1000)+'ms'"
            onchange="EnderTrack.Camera.setPicamConfig({exposure:parseInt(this.value)}).then(()=>EnderTrack.Camera._renderNav())"
            style="flex:1; height:3px;">
          <span id="nav-exp-val" style="font-size:9px; color:var(--coordinates-color); width:36px; text-align:right;">${Math.round(exp/1000)}ms</span>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <span style="font-size:9px; color:var(--text-general); width:32px;">Gain</span>
          <input type="range" min="1" max="16" value="${gain}" step="0.5"
            oninput="document.getElementById('nav-gain-val').textContent=parseFloat(this.value).toFixed(1)"
            onchange="EnderTrack.Camera.setPicamConfig({gain:parseFloat(this.value)}).then(()=>EnderTrack.Camera._renderNav())"
            style="flex:1; height:3px;">
          <span id="nav-gain-val" style="font-size:9px; color:var(--coordinates-color); width:24px; text-align:right;">${gain.toFixed(1)}</span>
        </div>
      </div>
      ` : ''}
    `;
  }

  _afContextMenu(e) {
    document.getElementById('af-ctx-menu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'af-ctx-menu';
    menu.style.cssText = 'position:fixed; left:'+e.clientX+'px; top:'+e.clientY+'px; z-index:10000; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.4); padding:4px 0; min-width:120px;';
    [{label:'\u26a1 Rapide (P2+P3)',mode:'quick'},{label:'\ud83d\udd2c Complet (P1+P2+P3)',mode:'full'}].forEach(item => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:5px 12px; font-size:10px; cursor:pointer; color:var(--text-general);';
      row.textContent = item.label;
      row.onmouseenter = () => row.style.background = 'var(--app-bg)';
      row.onmouseleave = () => row.style.background = '';
      row.onclick = () => { menu.remove(); this.runAutofocus(item.mode); };
      menu.appendChild(row);
    });
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('mousedown', function close(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } }), 0);
  }

  async runAutofocus(mode = 'full') {
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    const state = window.EnderTrack?.State?.get?.();
    const z = state?.pos?.z || 0;
    // Visual feedback
    const btn = this._navEl?.querySelector('[onclick*="runAutofocus"]');
    if (btn) { btn.textContent = '\u23f3 AF...'; btn.disabled = true; }
    try {
      const res = await fetch(base + '/api/camera/picam/autofocus', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ z_min: z - 2, z_max: z + 2, mode })
      });
      const data = await res.json();
      if (data.success) {
        // Update state with new Z
        window.EnderTrack?.State?.update?.({ pos: { ...state.pos, z: data.best_z } });
        window.EnderTrack?.UI?.showSuccess?.(`\ud83d\udd2c AF: z=${data.best_z.toFixed(3)}mm`);
      } else {
        window.EnderTrack?.UI?.showError?.('AF failed');
      }
    } catch (e) {
      window.EnderTrack?.UI?.showError?.('AF error: ' + e.message);
    }
    if (btn) { btn.textContent = '\ud83d\udd2c AF'; btn.disabled = false; }
    this._renderNav();
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
    // Refresh gallery
    window.EnderTrack?.ImageManager?.loadGallery?.();
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
  // === MOSAIC / NAVIGATOR ===

  toggleNavigator(on) {
    this.navigatorMode = on !== undefined ? on : !this.navigatorMode;
    if (this.navigatorMode) {
      this._hookMosaic();
    }
    this._renderNav();
  }

  _hookMosaic() {
    if (this._mosaicHooked) return;
    this._mosaicHooked = true;
    // Tiles are now rendered directly by xy-canvas.js (before cursor)
    // Render gallery panel
    this._renderTilesPanel();
    // Grab tile after movement
    window.EnderTrack?.Events?.on?.('movement:completed', () => {
      console.log('[Mosaic] movement:completed, navigatorMode:', this.navigatorMode, 'live:', this.live);
      if (this.navigatorMode && this.live) {
        clearTimeout(this._navDebounce);
        this._navDebounce = setTimeout(() => this._grabNavigatorTile(), 500);
      }
    });
    // Grab tile during scenario
    window.EnderTrack?.Events?.on?.('scenario:position_reached', () => {
      if (this.live) {
        const expMs = (this.picamConfig.exposure || 100000) / 1000;
        setTimeout(() => this._grabNavigatorTile(), Math.max(500, expMs * 2));
      }
    });
  }

  async _grabNavigatorTile() {
    if (this._navGrabbing || !this.driver) return;
    this._navGrabbing = true;
    console.log('[Mosaic] grabbing tile...');
    try {
      const frame = await this.getFrame();
      console.log('[Mosaic] frame:', frame ? `${frame.width}x${frame.height}` : 'null');
      if (frame?.frame) this._addTile(frame);
      else console.warn('[Mosaic] no frame data');
    } finally {
      this._navGrabbing = false;
    }
  }

  _addTile(frameData) {
    const state = window.EnderTrack?.State?.get?.();
    if (!state?.pos) { console.warn('[Mosaic] no position'); return; }
    console.log('[Mosaic] addTile at', state.pos.x.toFixed(2), state.pos.y.toFixed(2));
    const x = state.pos.x || 0;
    const y = state.pos.y || 0;
    const ps = this.getEffectivePixelSize();
    const w_px = frameData.width || this.picamConfig.resolution?.[0] || 640;
    const h_px = frameData.height || this.picamConfig.resolution?.[1] || 480;
    const widthMm = (w_px * ps) / 1000;
    const heightMm = (h_px * ps) / 1000;

    const tileImg = new Image();
    tileImg.src = 'data:image/jpeg;base64,' + frameData.frame;
    const tile = { img: tileImg, x, y, widthMm, heightMm, timestamp: Date.now(), visible: true };

    // Replace existing tile at same position
    const existing = this.tiles.findIndex(t => Math.abs(t.x - x) < 0.01 && Math.abs(t.y - y) < 0.01);
    if (existing >= 0) this.tiles[existing] = tile;
    else this.tiles.push(tile);

    // Save to server gallery
    const path = './captures/mosaic_X' + x.toFixed(2) + '_Y' + y.toFixed(2) + '.png';
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    fetch(base + '/api/capture/save', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ frame: frameData.frame, path })
    }).catch(() => {});

    this._renderTilesPanel();
    this._renderNav();
    window.EnderTrack?.Canvas?.requestRender?.();
  }

  _renderTiles(ctx, state) {
    if (!this.showMosaic || this.tiles.length === 0) return;
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;

    const rot = (this.camRotation || 0) * Math.PI / 180;
    const flipH = this.camFlipH;
    const flipV = this.camFlipV;

    ctx.save();
    ctx.globalAlpha = 0.9;
    for (const tile of this.tiles) {
      if (!tile.img.complete || !tile.img.naturalWidth) continue;
      if (tile.visible === false) continue;
      const center = coords.mapToCanvas(tile.x, tile.y);
      const wPx = coords.mmToPixels(tile.widthMm);
      const hPx = coords.mmToPixels(tile.heightMm);

      ctx.save();
      ctx.translate(center.cx, center.cy);
      ctx.rotate(rot);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      // Apply live contrast/LUT if active
      const renderer = window.EnderTrack?.LiveRenderer;
      if (renderer?.enabled && (renderer.min > 0 || renderer.max < 255 || renderer._lutTable)) {
        if (!tile._processed || tile._procMin !== renderer.min || tile._procMax !== renderer.max || tile._procLut !== renderer.lutId) {
          const tc = document.createElement('canvas');
          tc.width = tile.img.naturalWidth; tc.height = tile.img.naturalHeight;
          const tctx = tc.getContext('2d');
          tctx.drawImage(tile.img, 0, 0);
          const imgData = tctx.getImageData(0, 0, tc.width, tc.height);
          const d = imgData.data;
          const min = renderer.min, max = renderer.max, range = Math.max(1, max - min);
          const lut = renderer._lutTable;
          for (let i = 0; i < d.length; i += 4) {
            const lum = Math.round(0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]);
            const stretched = Math.max(0, Math.min(255, Math.round(((lum - min) / range) * 255)));
            if (lut) { const c = lut[stretched]; d[i]=c[0]; d[i+1]=c[1]; d[i+2]=c[2]; }
            else { d[i]=stretched; d[i+1]=stretched; d[i+2]=stretched; }
          }
          tctx.putImageData(imgData, 0, 0);
          tile._processed = tc; tile._procMin = renderer.min; tile._procMax = renderer.max; tile._procLut = renderer.lutId;
        }
        ctx.drawImage(tile._processed, -wPx / 2, -hPx / 2, wPx, hPx);
      } else {
        ctx.drawImage(tile.img, -wPx / 2, -hPx / 2, wPx, hPx);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  clearTiles() {
    this.tiles = [];
    this._renderTilesPanel();
    window.EnderTrack?.Canvas?.requestRender?.();
  }

  _renderTilesPanel() {
    let el = document.getElementById('mosaicGallerySection');
    const container = document.getElementById('imageLayerTable');
    if (!container) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'mosaicGallerySection';
      container.innerHTML = '';
      container.appendChild(el);
    }
    el.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
        <span style="font-size:10px; color:var(--text-selected); font-weight:500; flex:1;">\ud83e\udde9 Mosa\u00efque (${this.tiles.length})</span>
        <label style="font-size:9px; cursor:pointer; display:flex; align-items:center; gap:3px;">
          <input type="checkbox" ${this.navigatorMode ? 'checked' : ''} onchange="EnderTrack.Camera.toggleNavigator(this.checked)">
          <span style="color:var(--text-general);">Auto</span>
        </label>
        <label style="font-size:9px; cursor:pointer; display:flex; align-items:center; gap:3px;">
          <input type="checkbox" ${this.showMosaic ? 'checked' : ''} onchange="EnderTrack.Camera.showMosaic=this.checked; EnderTrack.Canvas?.requestRender?.()">
          <span style="color:var(--text-general);">Overlay</span>
        </label>
      </div>
      ${this.tiles.length ? `
      <div style="max-height:200px; overflow-y:auto; margin-bottom:6px;">
        ${this.tiles.map((t, i) => `
          <div style="display:flex; align-items:center; gap:6px; padding:3px 4px; border-radius:3px; cursor:pointer; font-size:9px; color:var(--text-general);" 
            onclick="EnderTrack.Camera._selectTile(${i})" 
            oncontextmenu="event.preventDefault(); EnderTrack.Camera._tileContextMenu(event, ${i})"
            onmouseenter="this.style.background='var(--app-bg)'" onmouseleave="this.style.background=''">
            <span style="color:var(--coordinates-color); font-family:var(--font-mono); min-width:90px;">${t.x.toFixed(2)}, ${t.y.toFixed(2)}</span>
            <span style="flex:1; color:#666;">${new Date(t.timestamp).toLocaleTimeString()}</span>
            <span style="font-size:8px; color:#555;">${t.widthMm?.toFixed(2)||'?'}\u00d7${t.heightMm?.toFixed(2)||'?'}mm</span>
          </div>
        `).join('')}
      </div>
      <div style="display:flex; gap:4px;">
        <button onclick="EnderTrack.Camera.saveTilesZip()" style="flex:1; padding:5px 8px; border:none; border-radius:3px; cursor:pointer; font-size:9px; background:var(--app-bg); color:var(--text-general);">\ud83d\udcbe Sauver tout (.zip)</button>
        <button onclick="EnderTrack.Camera.clearTiles()" style="padding:5px 8px; border:none; border-radius:3px; cursor:pointer; font-size:9px; background:var(--app-bg); color:#ef4444;">\ud83d\uddd1</button>
      </div>
      ` : '<div style="font-size:9px; color:#666; text-align:center; padding:8px;">Activer "Auto" puis d\u00e9placer la platine</div>'}
    `;
  }

  _selectTile(idx) {
    const tile = this.tiles[idx];
    if (!tile?.img?.complete) return;
    // Display tile in gallery viewport
    const display = window.EnderTrack?.Display;
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (renderer && display) {
      // Draw tile into gallery canvas
      const canvas = document.getElementById('galleryDisplayCanvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = tile.img.naturalWidth;
        canvas.height = tile.img.naturalHeight;
        ctx.drawImage(tile.img, 0, 0);
      } else {
        // Fallback: set renderer source directly
        renderer._drawDirect?.(tile.img);
      }
    }
    // Also center stage canvas on tile position
    window.EnderTrack?.Coordinates?.centerOn?.(tile.x, tile.y);
    window.EnderTrack?.Canvas?.requestRender?.();
  }

  _tileContextMenu(e, idx) {
    document.getElementById('tile-ctx-menu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'tile-ctx-menu';
    menu.style.cssText = `position:fixed; left:${e.clientX}px; top:${e.clientY}px; z-index:10000; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.4); padding:4px 0; min-width:120px;`;
    const items = [
      { label: '\ud83d\udcbe Sauver cette image', fn: () => this._saveSingleTile(idx) },
      { label: '\ud83d\uddd1 Supprimer', fn: () => { this.tiles.splice(idx, 1); this._renderTilesPanel(); this._renderNav(); EnderTrack.Canvas?.requestRender?.(); } }
    ];
    for (const item of items) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:5px 12px; font-size:10px; cursor:pointer; color:var(--text-general);';
      row.textContent = item.label;
      row.onmouseenter = () => row.style.background = 'var(--app-bg)';
      row.onmouseleave = () => row.style.background = '';
      row.onclick = () => { item.fn(); menu.remove(); };
      menu.appendChild(row);
    }
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('mousedown', function close(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } }), 0);
  }

  _saveSingleTile(idx) {
    const tile = this.tiles[idx];
    if (!tile?.img?.complete) return;
    const canvas = document.createElement('canvas');
    canvas.width = tile.img.naturalWidth; canvas.height = tile.img.naturalHeight;
    canvas.getContext('2d').drawImage(tile.img, 0, 0);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `mosaic_X${tile.x.toFixed(2)}_Y${tile.y.toFixed(2)}.png`;
    a.click();
  }

  async saveTilesZip() {
    if (!this.tiles.length) return;
    // Collect all tiles as base64 PNGs, send to server to create ZIP
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    const tiles = [];
    for (const tile of this.tiles) {
      if (!tile.img.complete || !tile.img.naturalWidth) continue;
      const canvas = document.createElement('canvas');
      canvas.width = tile.img.naturalWidth; canvas.height = tile.img.naturalHeight;
      canvas.getContext('2d').drawImage(tile.img, 0, 0);
      tiles.push({
        name: `mosaic_X${tile.x.toFixed(2)}_Y${tile.y.toFixed(2)}.png`,
        data: canvas.toDataURL('image/png').split(',')[1],
        x: tile.x, y: tile.y
      });
    }
    try {
      const res = await fetch(base + '/api/mosaic/zip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiles })
      });
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `mosaic_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
        window.EnderTrack?.UI?.showSuccess?.(`\ud83d\udcbe ${tiles.length} images export\u00e9es`);
      }
    } catch (e) {
      window.EnderTrack?.UI?.showError?.('Export ZIP failed: ' + e.message);
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
    // Capture action is now registered in action-registry.js (supports stack append)
    // This method is kept for compatibility but does nothing
  }

  async _loadPicamConfig() {
    try {
      const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      const res = await fetch(base + '/api/camera/picam/config');
      if (res.ok) {
        const data = await res.json();
        this.picamConfig = data;
        this.camRotation = data.rotation || 0;
        this.camFlipH = data.flip_h || false;
        this.camFlipV = data.flip_v || false;
        this.config.resolution = data.resolution || [1280, 720];
        this.config.exposure = data.exposure || 100000;
        this.config.gain = data.gain || 1.0;
        this._renderCameraConfig();
      }
    } catch {}
  }

  async setPicamConfig(params) {
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    try {
      const res = await fetch(base + '/api/camera/picam/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await res.json();
      if (data.config) {
        this.picamConfig = data.config;
        this.camRotation = data.config.rotation || 0;
        this.camFlipH = data.config.flip_h || false;
        this.camFlipV = data.config.flip_v || false;
        this.config.resolution = data.config.resolution || [1280, 720];
        this.config.exposure = data.config.exposure || 100000;
        this.config.gain = data.config.gain || 1.0;
      }
    } catch {}
  }

  getEffectivePixelSize() {
    const ps = this.picamConfig.pixel_size || 1.0;
    const refRes = this.picamConfig.pixel_size_ref_res || [640, 480];
    const curRes = this.picamConfig.resolution || [640, 480];
    return ps * (refRes[0] / curRes[0]);
  }

  _renderCameraConfig() {
    const zone = document.getElementById('picamConfigZone');
    if (!zone) return;
    const cameras = window._cameras || [];
    const hasPicam = cameras.some(c => c.type === 'picamera2') ||
      (this.driverName === 'mjpeg' && this.driver?.streamUrl?.includes('/api/camera/picam/'));
    if (!hasPicam) { zone.innerHTML = ''; return; }
    const c = this.picamConfig;
    zone.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px; padding:8px 0 0;">
        <div style="font-size:9px; text-transform:uppercase; letter-spacing:0.5px; color:#666; margin-bottom:2px;">Configuration RPi Camera</div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="width:70px; font-size:10px;">R\u00e9solution</label>
          <select onchange="EnderTrack.Camera.setPicamConfig({resolution: this.value.split(',').map(Number)})" style="flex:1; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;">
            <option value="4056,3040" ${c.resolution?.[0]===4056?'selected':''}>4056\u00d73040 (Full)</option>
            <option value="2028,1520" ${c.resolution?.[0]===2028?'selected':''}>2028\u00d71520 (Half)</option>
            <option value="1332,990" ${c.resolution?.[0]===1332?'selected':''}>1332\u00d7990</option>
            <option value="1280,720" ${c.resolution?.[0]===1280?'selected':''}>1280\u00d7720 (HD)</option>
            <option value="640,480" ${c.resolution?.[0]===640?'selected':''}>640\u00d7480 (Preview)</option>
          </select>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="width:70px; font-size:10px;">Pixel size</label>
          <input type="number" value="${c.pixel_size||1.0}" min="0.01" step="0.01" onchange="EnderTrack.Camera.setPicamConfig({pixel_size:parseFloat(this.value)})" style="width:60px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">\u00b5m/px</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="width:70px; font-size:10px;">Rotation</label>
          <input type="range" min="0" max="360" value="${c.rotation||0}" step="0.5" oninput="document.getElementById('picam-rot-val').value=this.value" onchange="EnderTrack.Camera.setPicamConfig({rotation:parseFloat(this.value)})" style="flex:1; height:3px;">
          <input id="picam-rot-val" type="number" value="${c.rotation||0}" min="0" max="360" step="0.5" onchange="EnderTrack.Camera.setPicamConfig({rotation:parseFloat(this.value)})" style="width:40px; padding:2px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">\u00b0
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="width:70px; font-size:10px;">Flip</label>
          <label style="font-size:10px; cursor:pointer; display:flex; align-items:center; gap:2px;"><input type="checkbox" ${c.flip_h?'checked':''} onchange="EnderTrack.Camera.setPicamConfig({flip_h:this.checked})"><span style="color:var(--text-general);">H</span></label>
          <label style="font-size:10px; cursor:pointer; display:flex; align-items:center; gap:2px;"><input type="checkbox" ${c.flip_v?'checked':''} onchange="EnderTrack.Camera.setPicamConfig({flip_v:this.checked})"><span style="color:var(--text-general);">V</span></label>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="width:70px; font-size:10px;">Exposition</label>
          <input type="number" value="${c.exposure||100000}" min="100" step="1000" onchange="EnderTrack.Camera.setPicamConfig({exposure:parseInt(this.value)}).then(()=>EnderTrack.Camera._renderNav())" style="width:70px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">\u00b5s</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="width:70px; font-size:10px;">Gain</label>
          <input type="number" value="${c.gain||1.0}" min="1" max="16" step="0.1" onchange="EnderTrack.Camera.setPicamConfig({gain:parseFloat(this.value)}).then(()=>EnderTrack.Camera._renderNav())" style="width:50px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
        </div>
      </div>
    `;
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

// Camera driver is now initialized by _initSavedCameras (peripherals system)
// No auto-detection at boot — user selects camera type in Settings
