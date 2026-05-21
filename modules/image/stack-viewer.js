// modules/image/stack-viewer.js — Multi-dimensional TIFF stack viewer

class StackViewer {
  constructor() {
    this._file = null;
    this._info = null;
    this._index = 0;
    this._container = null;
    this._channelSettings = {}; // {0: {min, max, lutId, rgbMode}, 1: {...}, ...}
    this._switching = false;
  }

  async open(filepath) {
    const changed = this._file !== filepath;
    this._file = filepath;
    this._index = 0;
    this._channelSettings = {};
    if (changed) {
      const renderer = window.EnderTrack?.GalleryRenderer;
      if (renderer) renderer._keepContrast = false;
    }
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
    try {
      const res = await fetch(url + '/api/stack/info?file=' + encodeURIComponent(filepath));
      this._info = await res.json();
      if (this._info.error) { console.warn('[Stack]', this._info.error); return false; }
      const dimRes = await fetch(url + '/api/stack/dimensions?file=' + encodeURIComponent(filepath));
      this._dims = await dimRes.json();
      this._dimState = { c: 0, z: 0, t: 0 };
      await this._loadPersistedSettings();
      return true;
    } catch(e) { return false; }
  }

  // === NAVIGATION ===

  setIndex(idx) {
    if (!this._info) return;
    const oldC = this._dimState?.c || 0;
    this._index = Math.max(0, Math.min(idx, this._info.pages - 1));
    if (this._dims) {
      const sizeC = this._dims.sizeC || 1, sizeZ = this._dims.sizeZ || 1;
      if (!this._dimState) this._dimState = { c: 0, z: 0, t: 0 };
      this._dimState.c = this._index % sizeC;
      this._dimState.z = Math.floor(this._index / sizeC) % sizeZ;
      this._dimState.t = Math.floor(this._index / (sizeC * sizeZ));
    }
    const channelChanged = this._dimState && this._dimState.c !== oldC;
    this._updateSliders();
    this._updateMetadataAndHistogram();
    this._loadSlice(channelChanged);
  }

  _setDim(dim, val) {
    if (!this._dims) return;
    if (!this._dimState) this._dimState = { c: 0, z: 0, t: 0 };
    this._dimState[dim] = val;
    const c = this._dimState.c || 0;
    const z = this._dimState.z || 0;
    const t = this._dimState.t || 0;
    const sizeC = this._dims.sizeC || 1;
    const sizeZ = this._dims.sizeZ || 1;
    this._index = c + sizeC * (z + sizeZ * t);
    this._updateSliders();
    this._updateMetadataAndHistogram();
    this._loadSlice(dim === 'c');
  }

  // === CORE LOAD LOGIC ===

  _loadSlice(channelChanged) {
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (renderer) renderer._keepContrast = !channelChanged;

    // For channel changes: debounce, NO immediate render (avoids flicker)
    if (channelChanged && this._dims?.sizeC > 1) {
      this._switching = true;
      clearTimeout(this._loadTimer);
      this._loadTimer = setTimeout(() => this._doLoad(true), 150);
    } else {
      // Z/T navigation: no debounce during playback, otherwise debounce for very large files
      clearTimeout(this._loadTimer);
      const fileSize = this._info?.fileSize || 0;
      if (this._playing || fileSize <= 200 * 1024 * 1024) {
        this._doLoad(false);
      } else if (fileSize > 500 * 1024 * 1024) {
        this._loadTimer = setTimeout(() => this._doLoad(false), 500);
      } else {
        this._loadTimer = setTimeout(() => this._doLoad(false), 150);
      }
    }
  }

  _doLoad(channelChanged) {
    if (!this._file) return;
    // If projecting and navigating T (not channel change), re-render projection
    if (this._projecting && !channelChanged) {
      this._renderProjection();
      return;
    }
    this._loadId = (this._loadId || 0) + 1;
    const myId = this._loadId;

    // Composite mode
    if (this._composite) {
      const renderer = window.EnderTrack?.GalleryRenderer;
      if (renderer) {
        renderer._keepContrast = true;
        renderer._skipAutoRender = true;
        renderer.loadRaw(this._file, this._index).then(() => {
          if (myId !== this._loadId) return;
          renderer._skipAutoRender = false;
          // Apply saved settings for histogram display
          const s = this._channelSettings?.[this._dimState.c];
          if (s) { renderer.min = s.min; renderer.max = s.max; renderer.lutId = s.lutId; renderer.rgbMode = s.rgbMode; const def = window.CameraLUTs?.[s.lutId]; renderer._lutTable = def ? def.generate() : null; }
          this._switching = false;
          this._refreshHistogram();
          this._renderComposite();
        });
      }
      return;
    }

    // Normal mode
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (!renderer) return;
    const s = channelChanged ? this._channelSettings?.[this._dimState.c] : null;
    if (s) renderer._skipAutoRender = true;

    renderer.loadRaw(this._file, this._index).then(() => {
      if (myId !== this._loadId) return;
      // Apply saved channel settings
      if (s) {
        renderer._skipAutoRender = false;
        renderer.min = s.min;
        renderer.max = s.max;
        renderer.lutId = s.lutId;
        renderer.rgbMode = s.rgbMode;
        const def = window.CameraLUTs?.[s.lutId];
        renderer._lutTable = def ? def.generate() : null;
        renderer.render();
      }
      this._switching = false;
      // Don't refresh histogram during playback (avoids jitter)
      if (!this._playing) this._refreshHistogram();
    });
  }

  // === CHANNEL SETTINGS (only for sizeC > 1) ===

  // Called ONLY by user actions (setLut, setContrast via histogram drag)
  saveCurrentChannel() {
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (!renderer || !this._dimState) return;
    const c = this._dimState.c;
    if (!this._channelSettings) this._channelSettings = {};
    this._channelSettings[c] = {
      min: renderer.min, max: renderer.max,
      lutId: renderer.lutId, rgbMode: renderer.rgbMode
    };
    this._persistSettings();
  }

  // === SLIDERS ===

  _updateSliders() {
    const ds = this._dimState || {};
    const sliderC = document.querySelector('#stackSliderC');
    const sliderZ = document.querySelector('#stackSliderZ');
    const sliderT = document.querySelector('#stackSliderT');
    const sliderGeneric = document.querySelector('#stackSlider');
    if (sliderC) { sliderC.value = ds.c || 0; }
    if (sliderZ) { sliderZ.value = ds.z || 0; }
    if (sliderT) { sliderT.value = ds.t || 0; }
    if (sliderGeneric) { sliderGeneric.value = this._index; }
    const lc = document.getElementById('stackLabelC');
    const lz = document.getElementById('stackLabelZ');
    const lt = document.getElementById('stackLabelT');
    const lg = document.getElementById('stackLabel');
    if (lc) lc.textContent = (ds.c || 0) + 1;
    if (lz) lz.textContent = (ds.z || 0) + 1;
    if (lt) lt.textContent = (ds.t || 0) + 1;
    if (lg) lg.textContent = (this._index + 1) + '/' + (this._info?.pages || '?');
  }

  _updateMetadataAndHistogram() {
    const dims = this._dims;
    const ds = this._dimState || {};
    const dimLabel = document.getElementById('metaDimInfo');
    if (dimLabel && dims) {
      const parts = [];
      if (dims.sizeC > 1) parts.push(`C: ${(ds.c||0)+1}/${dims.sizeC}`);
      if (dims.sizeZ > 1) parts.push(`Z: ${(ds.z||0)+1}/${dims.sizeZ}`);
      if (dims.sizeT > 1) parts.push(`T: ${(ds.t||0)+1}/${dims.sizeT}`);
      dimLabel.textContent = parts.join(' \u2022 ');
    }
  }

  // === VIEWPORT ===

  renderInViewport(container) {
    this._container = container;
    let wrap = container.querySelector('.stack-viewport-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'stack-viewport-wrap';
      wrap.style.cssText = 'position:absolute; inset:0; z-index:10; display:flex; flex-direction:column; background:#000;';
      container.appendChild(wrap);
    }
    wrap.dataset.file = this._file || '';
    if (!this._file) {
      wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:11px;">Aucun stack ouvert</div>';
      return;
    }
    this._renderViewport();
  }

  _renderViewport() {
    const wrap = this._container?.querySelector('.stack-viewport-wrap');
    if (!wrap) return;
    const info = this._info;
    if (!info || info.error) {
      wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:11px;">Erreur stack</div>';
      return;
    }
    const dims = this._dims || {};
    const sizeC = dims.sizeC || 1, sizeZ = dims.sizeZ || 1, sizeT = dims.sizeT || 1;
    let slidersHtml = "";
    if (sizeC > 1) slidersHtml += `<div class="stack-slider-row" style="display:flex; align-items:center; gap:4px; margin-bottom:6px; padding:2px 4px; border-radius:3px; transition:background 0.15s;"><button id="stackCBtn" onclick="EnderTrack.StackViewer._toggleComposite(!EnderTrack.StackViewer._composite)" style="border:none; background:${this._composite ? 'var(--active-element)' : 'none'}; color:var(--text-general); cursor:pointer; font-size:9px; width:14px; padding:0; border-radius:2px;" title="Clic: composite" oncontextmenu="event.preventDefault(); event.stopPropagation();">C</button><input type="range" id="stackSliderC" min="0" max="${sizeC-1}" value="0" oninput="EnderTrack.StackViewer._setDim('c', parseInt(this.value))" style="flex:1; height:3px; cursor:pointer;"><span id="stackLabelC" style="font-size:9px; color:var(--text-general); width:20px; text-align:right;">1</span></div>`;
    if (sizeZ > 1) {
      if (this._projecting) {
        slidersHtml += `<div class="stack-slider-row" onclick="EnderTrack.StackViewer._toggleProjection()" oncontextmenu="event.preventDefault(); event.stopPropagation(); EnderTrack.StackViewer._showProjectionMenu(event)" style="display:flex; align-items:center; gap:4px; margin-bottom:6px; padding:2px 4px; border-radius:3px; cursor:pointer; background:var(--active-element);"><span style="font-size:9px; color:var(--text-selected); font-weight:500;">Z</span><span style="font-size:9px; color:var(--text-selected); flex:1;">Projection ${(this._projType || 'max').toUpperCase()}</span></div>`;
      } else {
        slidersHtml += `<div class="stack-slider-row" style="display:flex; align-items:center; gap:4px; margin-bottom:6px; padding:2px 4px; border-radius:3px; transition:background 0.15s;"><button id="stackZBtn" onclick="EnderTrack.StackViewer._toggleProjection()" oncontextmenu="event.preventDefault(); event.stopPropagation(); EnderTrack.StackViewer._showProjectionMenu(event)" style="border:none; background:none; color:var(--text-general); cursor:pointer; font-size:9px; width:14px; padding:0; border-radius:2px;" title="Clic: projection, Clic droit: type">Z</button><input type="range" id="stackSliderZ" min="0" max="${sizeZ-1}" value="0" oninput="EnderTrack.StackViewer._setDim('z', parseInt(this.value))" style="flex:1; height:3px; cursor:pointer;"><span id="stackLabelZ" style="font-size:9px; color:var(--text-general); width:20px; text-align:right;">1</span></div>`;
      }
    }
    if (sizeT > 1) slidersHtml += `<div class="stack-slider-row" style="display:flex; align-items:center; gap:4px; padding:2px 4px; border-radius:3px; transition:background 0.15s;"><button id="stackPlayBtn" onclick="EnderTrack.StackViewer._togglePlay()" oncontextmenu="event.preventDefault(); event.stopPropagation(); EnderTrack.StackViewer._showPlaySettings(event)" style="border:none; background:none; color:var(--text-general); cursor:pointer; font-size:11px; width:14px; padding:0;" title="Clic: lecture, Clic droit: FPS">\u25B6</button><input type="range" id="stackSliderT" min="0" max="${sizeT-1}" value="0" oninput="EnderTrack.StackViewer._setDim('t', parseInt(this.value))" style="flex:1; height:3px; cursor:pointer;"><span id="stackLabelT" style="font-size:9px; color:var(--text-general); width:20px; text-align:right;">1</span></div>`;
    if (!slidersHtml) slidersHtml = `<div style="display:flex; align-items:center; gap:4px;"><input type="range" id="stackSlider" min="0" max="${info.pages-1}" value="${this._index}" oninput="EnderTrack.StackViewer.setIndex(parseInt(this.value))" style="flex:1; height:3px;"><span id="stackLabel" style="font-size:9px; color:var(--text-general); width:40px; text-align:right;">${this._index+1}/${info.pages}</span></div>`;
    wrap.innerHTML = `
      <style>.stack-slider-row:hover{background:rgba(255,255,255,0.05)!important;}</style>
      <canvas id="stackDisplayCanvas" style="flex:1; object-fit:contain; min-height:0; background:#000; image-rendering:pixelated;"></canvas>
      <div style="padding:6px 8px; background:#1a1a1a; display:flex; flex-direction:column; gap:0;">
        ${slidersHtml}
      </div>`;
    // Setup renderer
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (renderer) {
      renderer.setDisplayCanvas(document.getElementById("stackDisplayCanvas"));
      renderer._keepContrast = false;
      renderer.loadRaw(this._file, this._index).then(() => {
        // Apply saved settings (works for all stacks, not just multi-C)
        const s = this._channelSettings?.[this._dimState?.c || 0];
        if (s) {
          renderer.min = s.min; renderer.max = s.max;
          renderer.lutId = s.lutId; renderer.rgbMode = s.rgbMode;
          const def = window.CameraLUTs?.[s.lutId];
          renderer._lutTable = def ? def.generate() : null;
          renderer.render();
        }
        this._refreshHistogram();
        if (this._composite) this._renderComposite();
      });
    }
    // Mouse wheel: scroll the hovered slider row, or the only slider if just one
    wrap.onwheel = (e) => {
      e.preventDefault();
      const row = e.target.closest?.('.stack-slider-row');
      if (row?.querySelector('#stackSliderC')) {
        this._setDim('c', Math.max(0, Math.min((this._dims?.sizeC||1)-1, (this._dimState?.c||0) + (e.deltaY > 0 ? 1 : -1))));
      } else if (row?.querySelector('#stackSliderT')) {
        this._setDim('t', Math.max(0, Math.min((this._dims?.sizeT||1)-1, (this._dimState?.t||0) + (e.deltaY > 0 ? 1 : -1))));
      } else if (row?.querySelector('#stackSliderZ')) {
        if (!this._projecting) this._setDim('z', Math.max(0, Math.min((this._dims?.sizeZ||1)-1, (this._dimState?.z||0) + (e.deltaY > 0 ? 1 : -1))));
      } else {
        // Not on a row: scroll the most relevant dimension
        if (this._dims?.sizeZ > 1 && !this._projecting) {
          this._setDim('z', Math.max(0, Math.min((this._dims.sizeZ)-1, (this._dimState?.z||0) + (e.deltaY > 0 ? 1 : -1))));
        } else if (this._dims?.sizeT > 1) {
          this._setDim('t', Math.max(0, Math.min((this._dims.sizeT)-1, (this._dimState?.t||0) + (e.deltaY > 0 ? 1 : -1))));
        } else if (this._dims?.sizeC > 1) {
          this._setDim('c', Math.max(0, Math.min((this._dims.sizeC)-1, (this._dimState?.c||0) + (e.deltaY > 0 ? 1 : -1))));
        }
      }
    };
    // Right-click for LUT
    const canvas = document.getElementById("stackDisplayCanvas");
    if (canvas) {
      canvas.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); };
      canvas.ondblclick = () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else canvas.requestFullscreen?.();
      };
    }
  }

  // === HISTOGRAM ===

  _refreshHistogram() {
    const renderer = window.EnderTrack?.GalleryRenderer;
    const mgr = window.EnderTrack?.ImageManager;
    if (!renderer?._rawPixels || !mgr?._histogram) return;
    const nPx = renderer._width * renderer._height;
    const ch = renderer._channels;
    const data = new Uint8ClampedArray(nPx * 4);
    const dMin = renderer._dataMin || 0;
    const dMax = renderer._dataMax || renderer._maxVal;
    const dRange = Math.max(1, dMax - dMin);
    for (let i = 0; i < nPx; i++) {
      if (ch >= 3) {
        data[i*4] = Math.max(0, Math.min(255, Math.round(((renderer._rawPixels[i*3] - dMin) / dRange) * 255)));
        data[i*4+1] = Math.max(0, Math.min(255, Math.round(((renderer._rawPixels[i*3+1] - dMin) / dRange) * 255)));
        data[i*4+2] = Math.max(0, Math.min(255, Math.round(((renderer._rawPixels[i*3+2] - dMin) / dRange) * 255)));
      } else {
        const v = Math.max(0, Math.min(255, Math.round(((renderer._rawPixels[i] - dMin) / dRange) * 255)));
        data[i*4] = v; data[i*4+1] = v; data[i*4+2] = v;
      }
      data[i*4+3] = 255;
    }
    const hist = mgr._histogram;
    hist.manualMin = Math.max(0, Math.min(255, Math.round(((renderer.min - dMin) / dRange) * 255)));
    hist.manualMax = Math.max(0, Math.min(255, Math.round(((renderer.max - dMin) / dRange) * 255)));
    if (hist.manualMin >= hist.manualMax) hist.manualMax = Math.min(255, hist.manualMin + 1);
    hist._skipCallback = true;
    hist.updateFromImageData(data, ch === 1);
    hist._skipCallback = false;
    const info = document.getElementById('gallery-hist-info');
    if (info) info.textContent = Math.round(renderer.min) + ' - ' + Math.round(renderer.max);
  }

  // === PERSISTENCE ===

  _persistSettings() {
    if (!this._file || !this._channelSettings) return;
    clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => {
      const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      fetch(base + '/api/stack/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: this._file, channels: this._channelSettings, composite: this._composite || false })
      }).catch(() => {});
    }, 1000);
  }

  async _loadPersistedSettings() {
    if (!this._file) return;
    try {
      const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      const res = await fetch(base + '/api/stack/settings?file=' + encodeURIComponent(this._file));
      const data = await res.json();
      if (data && data.channels) {
        this._channelSettings = {};
        for (const [k, v] of Object.entries(data.channels)) {
          this._channelSettings[parseInt(k)] = v;
        }
        this._composite = data.composite || false;
      }
    } catch {}
  }

  // === COMPOSITE ===

  _toggleComposite(enabled) {
    this._composite = enabled;
    const btn = document.getElementById('stackCBtn');
    if (btn) btn.style.background = enabled ? 'var(--active-element)' : 'none';
    if (enabled) this._renderComposite();
    else this._doLoad(false);
    this._persistSettings();
  }

  async _renderComposite() {
    if (!this._file || !this._dims) return;
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (!renderer) return;
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    const sizeC = this._dims.sizeC || 1;
    const z = this._dimState?.z || 0;
    const t = this._dimState?.t || 0;
    const sizeZ = this._dims.sizeZ || 1;

    const channels = [];
    for (let c = 0; c < sizeC; c++) {
      const idx = c + sizeC * (z + sizeZ * t);
      const res = await fetch(base + '/api/stack/raw?file=' + encodeURIComponent(this._file) + '&index=' + idx);
      const data = await res.json();
      if (data.error) continue;
      const binary = atob(data.data);
      const buffer = new ArrayBuffer(binary.length);
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      let pixels;
      if (data.dtype === 'uint16') {
        const u16 = new Uint16Array(buffer);
        pixels = new Float32Array(u16.length);
        for (let i = 0; i < u16.length; i++) pixels[i] = u16[i];
      } else {
        pixels = new Float32Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) pixels[i] = bytes[i];
      }
      channels.push({ pixels, settings: this._channelSettings?.[c], width: data.width, height: data.height });
    }

    if (!channels.length) return;
    const w = channels[0].width, h = channels[0].height;
    const canvas = renderer._displayCanvas;
    if (!canvas) return;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const out = ctx.createImageData(w, h);
    const dst = out.data;
    const nPx = w * h;

    for (let ci = 0; ci < channels.length; ci++) {
      const ch = channels[ci];
      const s = ch.settings || {};
      const min = s.min !== undefined ? s.min : 0;
      const max = s.max !== undefined ? s.max : 65535;
      const range = Math.max(1, max - min);
      const lutId = s.lutId || 'gray';
      const def = window.CameraLUTs?.[lutId];
      const lut = def ? def.generate() : null;
      for (let i = 0; i < nPx; i++) {
        const val = ch.pixels[i];
        const stretched = Math.max(0, Math.min(255, Math.round(((val - min) / range) * 255)));
        let r, g, b;
        if (lut) { r = lut[stretched][0]; g = lut[stretched][1]; b = lut[stretched][2]; }
        else { r = stretched; g = stretched; b = stretched; }
        dst[i*4] = Math.min(255, (dst[i*4] || 0) + r);
        dst[i*4+1] = Math.min(255, (dst[i*4+1] || 0) + g);
        dst[i*4+2] = Math.min(255, (dst[i*4+2] || 0) + b);
        dst[i*4+3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  // === PLAYBACK ===

  _togglePlay() {
    if (this._playing) {
      this._stopPlay();
    } else {
      this._playing = true;
      const btn = document.getElementById('stackPlayBtn');
      if (btn) btn.textContent = '\u275A\u275A'; // pause icon
      const fps = this._playFps || 10;
      this._playInterval = setInterval(() => {
        const sizeT = this._dims?.sizeT || 1;
        let t = (this._dimState?.t || 0) + 1;
        if (t >= sizeT) t = 0; // loop
        this._setDim('t', t);
      }, 1000 / fps);
    }
  }

  _stopPlay() {
    this._playing = false;
    clearInterval(this._playInterval);
    const btn = document.getElementById('stackPlayBtn');
    if (btn) btn.textContent = '\u25B6';
    this._refreshHistogram();
  }

  _showPlaySettings(e) {
    document.getElementById('stack-play-menu')?.remove();
    const fps = this._playFps || 10;
    const menu = document.createElement('div');
    menu.id = 'stack-play-menu';
    menu.style.cssText = `position:fixed; left:${e.clientX}px; top:${e.clientY}px; z-index:10000; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.4); padding:8px; min-width:100px;`;
    menu.innerHTML = `
      <div style="font-size:9px; color:var(--text-general); margin-bottom:4px;">FPS: <span id="stackFpsVal">${fps}</span></div>
      <input type="range" id="stackFpsInput" min="1" max="30" value="${fps}" oninput="document.getElementById('stackFpsVal').textContent=this.value" style="width:100px; height:3px;">
    `;
    document.body.appendChild(menu);
    // Reposition if overflows viewport
    const r1 = menu.getBoundingClientRect();
    if (r1.bottom > window.innerHeight) menu.style.top = Math.max(4, window.innerHeight - r1.height - 4) + 'px';
    if (r1.right > window.innerWidth) menu.style.left = Math.max(4, window.innerWidth - r1.width - 4) + 'px';
    document.getElementById('stackFpsInput')?.addEventListener('input', (ev) => {
      this._playFps = parseInt(ev.target.value) || 10;
      if (this._playing) { this._stopPlay(); this._togglePlay(); }
    });
    setTimeout(() => {
      const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
      document.addEventListener('mousedown', close);
    }, 0);
  }

  _applyFps() {
    const input = document.getElementById('stackFpsInput');
    if (input) this._playFps = Math.max(1, Math.min(30, parseInt(input.value) || 10));
    document.getElementById('stack-play-menu')?.remove();
    // If playing, restart with new fps
    if (this._playing) {
      this._stopPlay();
      this._togglePlay();
    }
  }

  // === Z PROJECTION ===

  _toggleProjection() {
    this._projecting = !this._projecting;
    if (this._projecting) {
      // Rebuild viewport to show projection label instead of slider
      this._renderViewport();
      // Show loading then precompute
      const canvas = document.getElementById('stackDisplayCanvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Projection...', canvas.width/2, canvas.height/2);
      }
      setTimeout(() => this._precomputeAndShow(), 50);
    } else {
      // Rebuild viewport to restore slider, then load current slice
      this._renderViewport();
    }
  }

  async _precomputeAndShow() {
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    const type = this._projType || 'max';
    await fetch(`${base}/api/stack/projection/precompute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: this._file, type })
    });
    this._renderProjection();
  }

  _showProjectionMenu(e) {
    document.getElementById('stack-proj-menu')?.remove();
    const types = ['max', 'min', 'mean', 'median', 'std'];
    const current = this._projType || 'max';
    const menu = document.createElement('div');
    menu.id = 'stack-proj-menu';
    menu.style.cssText = `position:fixed; left:${e.clientX}px; top:${e.clientY}px; z-index:10000; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.4); padding:4px 0; min-width:80px;`;
    types.forEach(t => {
      const row = document.createElement('div');
      row.style.cssText = `padding:4px 10px; font-size:11px; cursor:pointer; color:${t === current ? 'var(--text-selected)' : 'var(--text-general)'}; background:${t === current ? 'var(--active-element)' : 'transparent'};`;
      row.textContent = t.toUpperCase();
      row.onmouseenter = () => { if (t !== current) row.style.background = 'var(--app-bg)'; };
      row.onmouseleave = () => { if (t !== current) row.style.background = ''; };
      row.onclick = () => { this._projType = t; const label = document.getElementById('stackLabelZ'); if (label) label.textContent = t.toUpperCase(); menu.remove(); if (this._projecting) this._precomputeAndShow(); };
      menu.appendChild(row);
    });
    document.body.appendChild(menu);
    // Reposition if overflows viewport
    const r2 = menu.getBoundingClientRect();
    if (r2.bottom > window.innerHeight) menu.style.top = Math.max(4, window.innerHeight - r2.height - 4) + 'px';
    if (r2.right > window.innerWidth) menu.style.left = Math.max(4, window.innerWidth - r2.width - 4) + 'px';
    setTimeout(() => { const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } }; document.addEventListener('mousedown', close); }, 0);
  }

  async _renderProjection() {
    if (!this._file || !this._dims) return;
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (!renderer) return;
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    const sizeC = this._dims.sizeC || 1;
    const t = this._dimState?.t || 0;
    const type = this._projType || 'max';

    if (sizeC === 1) {
      // Single channel: load projection and display with current LUT
      const res = await fetch(`${base}/api/stack/projection?file=${encodeURIComponent(this._file)}&c=0&t=${t}&type=${type}`);
      const data = await res.json();
      if (data.error) return;
      const binary = atob(data.data);
      const buffer = new ArrayBuffer(binary.length);
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      if (data.dtype === 'uint16') {
        const u16 = new Uint16Array(buffer);
        renderer._rawPixels = new Float32Array(u16.length);
        for (let i = 0; i < u16.length; i++) renderer._rawPixels[i] = u16[i];
      } else {
        renderer._rawPixels = new Float32Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) renderer._rawPixels[i] = bytes[i];
      }
      renderer._width = data.width;
      renderer._height = data.height;
      renderer._channels = 1;
      renderer.rgbMode = false;
      renderer.render();
    } else {
      // Multi-channel: composite projections
      const canvas = renderer._displayCanvas;
      if (!canvas) return;
      let w = 0, h = 0;
      const projections = [];
      for (let c = 0; c < sizeC; c++) {
        const res = await fetch(`${base}/api/stack/projection?file=${encodeURIComponent(this._file)}&c=${c}&t=${t}&type=${type}`);
        const data = await res.json();
        if (data.error) continue;
        w = data.width; h = data.height;
        const binary = atob(data.data);
        const buffer = new ArrayBuffer(binary.length);
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        let pixels;
        if (data.dtype === 'uint16') {
          const u16 = new Uint16Array(buffer);
          pixels = new Float32Array(u16.length);
          for (let i = 0; i < u16.length; i++) pixels[i] = u16[i];
        } else {
          pixels = new Float32Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) pixels[i] = bytes[i];
        }
        projections.push({ pixels, settings: this._channelSettings?.[c] });
      }
      if (!projections.length) return;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const out = ctx.createImageData(w, h);
      const dst = out.data;
      const nPx = w * h;
      for (let ci = 0; ci < projections.length; ci++) {
        const ch = projections[ci];
        const s = ch.settings || {};
        const px = ch.pixels;
        let mn = Infinity, mx = -Infinity;
        for (let i = 0; i < nPx; i++) { if (px[i] < mn) mn = px[i]; if (px[i] > mx) mx = px[i]; }
        const min = s.min !== undefined ? s.min : mn;
        const max = s.max !== undefined ? s.max : mx;
        const range = Math.max(1, max - min);
        const lutId = s.lutId || 'gray';
        const def = window.CameraLUTs?.[lutId];
        const lut = def ? def.generate() : null;
        for (let i = 0; i < nPx; i++) {
          const stretched = Math.max(0, Math.min(255, Math.round(((px[i] - min) / range) * 255)));
          let r, g, b;
          if (lut) { r = lut[stretched][0]; g = lut[stretched][1]; b = lut[stretched][2]; }
          else { r = stretched; g = stretched; b = stretched; }
          dst[i*4] = Math.min(255, (dst[i*4] || 0) + r);
          dst[i*4+1] = Math.min(255, (dst[i*4+1] || 0) + g);
          dst[i*4+2] = Math.min(255, (dst[i*4+2] || 0) + b);
          dst[i*4+3] = 255;
        }
      }
      ctx.putImageData(out, 0, 0);
    }
  }

  // === MISC ===

  _updateStackViewport() {
    const display = window.EnderTrack?.Display;
    if (!display) return;
    display.viewports.forEach(vp => {
      if (vp.source === 'stack') {
        const cell = vp.id === 0 ? display._stageWrap : display._cells.get(vp.id);
        if (cell) this.renderInViewport(cell);
      }
    });
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.StackViewer = new StackViewer();
