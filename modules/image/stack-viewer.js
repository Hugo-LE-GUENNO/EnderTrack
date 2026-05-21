// modules/image/stack-viewer.js — Multi-dimensional TIFF stack viewer

class StackViewer {
  constructor() {
    this._file = null;
    this._info = null; // {pages, width, height, mode}
    this._index = 0;
    this._container = null;
  }

  async open(filepath) {
    const changed = this._file !== filepath;
    this._file = filepath;
    this._index = 0;
    this._channelSettings = {};
    // Reset renderer state when changing file
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
      // Load persisted per-channel settings
      await this._loadPersistedSettings();
      return true;
    } catch(e) { return false; }
  }

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
    if (channelChanged) {
      if (!this._switching) this._saveChannelSettingsFor(oldC);
      this._switching = true;
    }
    this._updateSliders();
    this._updateMetadataAndHistogram();
    this._debouncedLoad(channelChanged);
  }

  _setDim(dim, val) {
    if (!this._dims) return;
    if (!this._dimState) this._dimState = { c: 0, z: 0, t: 0 };
    const oldC = this._dimState.c;
    if (dim === 'c') {
      if (!this._switching) this._saveChannelSettingsFor(oldC);
      this._switching = true;
    }
    this._dimState[dim] = val;
    const c = this._dimState.c || 0;
    const z = this._dimState.z || 0;
    const t = this._dimState.t || 0;
    const sizeC = this._dims.sizeC || 1;
    const sizeZ = this._dims.sizeZ || 1;
    this._index = c + sizeC * (z + sizeZ * t);
    this._updateSliders();
    this._updateMetadataAndHistogram();
    this._debouncedLoad(dim === 'c');
  }

  // Load image — debounced for large files, always debounced for channel changes
  _debouncedLoad(channelChanged) {
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (renderer) renderer._keepContrast = !channelChanged;
    clearTimeout(this._loadTimer);
    const fileSize = this._info?.fileSize || 0;
    if (channelChanged) {
      // Always debounce channel changes to avoid race conditions
      this._loadTimer = setTimeout(() => this._updateImage(true), 120);
    } else if (fileSize > 500 * 1024 * 1024) {
      this._loadTimer = setTimeout(() => this._updateImage(false), 500);
    } else if (fileSize > 50 * 1024 * 1024) {
      this._loadTimer = setTimeout(() => this._updateImage(false), 150);
    } else {
      this._updateImage(false);
    }
  }

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
    // Only update dimension labels — don't rebuild full metadata/histogram DOM
    const sv = window.EnderTrack?.StackViewer;
    const dims = sv?._dims;
    const ds = sv?._dimState || {};
    const dimLabel = document.getElementById('metaDimInfo');
    if (dimLabel && dims) {
      const parts = [];
      if (dims.sizeC > 1) parts.push(`C: ${(ds.c||0)+1}/${dims.sizeC}`);
      if (dims.sizeZ > 1) parts.push(`Z: ${(ds.z||0)+1}/${dims.sizeZ}`);
      if (dims.sizeT > 1) parts.push(`T: ${(ds.t||0)+1}/${dims.sizeT}`);
      dimLabel.textContent = parts.join(' \u2022 ');
    }
  }

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
    if (sizeC > 1) slidersHtml += `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:9px; color:#888; width:12px;">C</span><input type="range" id="stackSliderC" min="0" max="${sizeC-1}" value="0" oninput="EnderTrack.StackViewer._setDim('c', parseInt(this.value))" style="flex:1; height:3px;"><span id="stackLabelC" style="font-size:9px; color:var(--text-general); width:20px; text-align:right;">1</span><label style="font-size:9px; color:#888; display:flex; align-items:center; gap:2px; margin-left:4px;"><input type="checkbox" id="stackComposite" onchange="EnderTrack.StackViewer._toggleComposite(this.checked)" style="margin:0; width:10px; height:10px;"${this._composite ? ' checked' : ''}>Comp</label></div>`;
    if (sizeZ > 1) slidersHtml += `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:9px; color:#888; width:12px;">Z</span><input type="range" id="stackSliderZ" min="0" max="${sizeZ-1}" value="0" oninput="EnderTrack.StackViewer._setDim('z', parseInt(this.value))" style="flex:1; height:3px;"><span id="stackLabelZ" style="font-size:9px; color:var(--text-general); width:20px; text-align:right;">1</span></div>`;
    if (sizeT > 1) slidersHtml += `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:9px; color:#888; width:12px;">T</span><input type="range" id="stackSliderT" min="0" max="${sizeT-1}" value="0" oninput="EnderTrack.StackViewer._setDim('t', parseInt(this.value))" style="flex:1; height:3px;"><span id="stackLabelT" style="font-size:9px; color:var(--text-general); width:20px; text-align:right;">1</span></div>`;
    if (!slidersHtml) slidersHtml = `<div style="display:flex; align-items:center; gap:4px;"><input type="range" id="stackSlider" min="0" max="${info.pages-1}" value="${this._index}" oninput="EnderTrack.StackViewer.setIndex(parseInt(this.value))" style="flex:1; height:3px;"><span id="stackLabel" style="font-size:9px; color:var(--text-general); width:40px; text-align:right;">${this._index+1}/${info.pages}</span></div>`;
    wrap.innerHTML = `
      <canvas id="stackDisplayCanvas" style="flex:1; object-fit:contain; min-height:0; background:#000; image-rendering:pixelated;"></canvas>
      <div style="padding:4px 8px; background:#1a1a1a; display:flex; flex-direction:column; gap:2px;">
        ${slidersHtml}
      </div>`;
    // Setup renderer on this canvas
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (renderer) {
      renderer.setDisplayCanvas(document.getElementById("stackDisplayCanvas"));
      renderer._keepContrast = false;
      renderer.loadRaw(this._file, this._index).then(() => {
        this._restoreChannelSettings();
        this._saveChannelSettings();
        this._refreshHistogram();
        if (this._composite) this._renderComposite();
      });
    }
    // Mouse wheel
    wrap.onwheel = (e) => { e.preventDefault(); this.setIndex(this._index + (e.deltaY > 0 ? 1 : -1)); };
    // Right-click for LUT
    const canvas = document.getElementById("stackDisplayCanvas");
    if (canvas) {
      canvas.oncontextmenu = (e) => { e.preventDefault(); window.EnderTrack?.ImageManager?._showRendererMenu?.(e.clientX, e.clientY); };
      canvas.ondblclick = () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else canvas.requestFullscreen?.();
      };
    }
  }
  _updateImage(channelChanged) {
    if (!this._file) return;
    this._loadId = (this._loadId || 0) + 1;
    const myId = this._loadId;
    // In composite mode: load current channel for histogram, then render composite
    if (this._composite) {
      const renderer = window.EnderTrack?.GalleryRenderer;
      if (renderer) {
        renderer._keepContrast = true;
        renderer._skipAutoRender = true;
        renderer.loadRaw(this._file, this._index).then(() => {
          if (myId !== this._loadId) return; // stale request
          renderer._skipAutoRender = false;
          this._restoreChannelSettings(true); // true = don't render
          this._switching = false;
          this._refreshHistogram();
          this._renderComposite();
        });
      }
      return;
    }
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (renderer) {
      const hasSaved = channelChanged && this._channelSettings?.[this._dimState.c];
      if (hasSaved) renderer._skipAutoRender = true;
      renderer.loadRaw(this._file, this._index).then(() => {
        if (myId !== this._loadId) return; // stale request
        if (hasSaved) {
          renderer._skipAutoRender = false;
          this._restoreChannelSettings();
        }
        this._switching = false;
        this._saveChannelSettings();
        this._refreshHistogram();
        this._persistSettings();
      });
    }
    const slider = document.getElementById("stackSlider");
    const label = document.getElementById("stackLabel");
    if (slider) slider.value = this._index;
    if (label) label.textContent = (this._index + 1) + "/" + this._info.pages;
  }

  // Per-channel LUT/contrast memory
  _saveChannelSettings() {
    if (this._switching) return;
    this._saveChannelSettingsFor(this._dimState?.c);
  }

  _saveChannelSettingsFor(c) {
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (!renderer || c === undefined || c === null) return;
    if (!this._channelSettings) this._channelSettings = {};
    this._channelSettings[c] = {
      min: renderer.min, max: renderer.max,
      lutId: renderer.lutId, rgbMode: renderer.rgbMode
    };
    console.log('[Stack] SAVE ch', c, JSON.stringify(this._channelSettings[c]));
  }

  _restoreChannelSettings(skipRender) {
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (!renderer || !this._dimState) return;
    const c = this._dimState.c;
    const s = this._channelSettings?.[c];
    console.log('[Stack] RESTORE ch', c, JSON.stringify(s));
    if (s) {
      renderer.min = s.min;
      renderer.max = s.max;
      renderer.lutId = s.lutId;
      renderer.rgbMode = s.rgbMode;
      const def = window.CameraLUTs?.[s.lutId];
      renderer._lutTable = def ? def.generate() : null;
      if (!skipRender) renderer.render();
    }
  }

  // Persist channel settings to server
  _persistSettings() {
    if (!this._file || !this._channelSettings) return;
    clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => {
      const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      fetch(base + '/api/stack/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: this._file,
          channels: this._channelSettings,
          composite: this._composite || false
        })
      }).catch(() => {});
    }, 1000);
  }

  // Load persisted settings from server
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

  _refreshHistogram() {
    const renderer = window.EnderTrack?.GalleryRenderer;
    const mgr = window.EnderTrack?.ImageManager;
    if (!renderer?._rawPixels || !mgr?._histogram) return;
    // Build 8-bit image data for histogram display from raw pixels
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
    // Sync histogram min/max bars to current renderer contrast
    const hist = mgr._histogram;
    hist.manualMin = Math.max(0, Math.min(255, Math.round(((renderer.min - dMin) / dRange) * 255)));
    hist.manualMax = Math.max(0, Math.min(255, Math.round(((renderer.max - dMin) / dRange) * 255)));
    if (hist.manualMin >= hist.manualMax) hist.manualMax = Math.min(255, hist.manualMin + 1);
    // Update histogram data without triggering _redraw callbacks
    hist._skipCallback = true;
    hist.updateFromImageData(data, ch === 1);
    hist._skipCallback = false;
    // Update info label
    const info = document.getElementById('gallery-hist-info');
    if (info) {
      info.textContent = Math.round(renderer.min) + ' - ' + Math.round(renderer.max);
    }
  }

  // Update gallery viewport if stack source is active
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

  _toggleComposite(enabled) {
    this._composite = enabled;
    if (enabled) {
      this._renderComposite();
    } else {
      this._updateImage(false);
    }
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

    // Load all channels
    const channels = [];
    for (let c = 0; c < sizeC; c++) {
      const idx = c + sizeC * (z + sizeZ * t);
      const res = await fetch(base + '/api/stack/raw?file=' + encodeURIComponent(this._file) + '&index=' + idx);
      const data = await res.json();
      if (data.error) continue;
      // Decode
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
      // Get per-channel settings
      const s = this._channelSettings?.[c];
      channels.push({ pixels, settings: s, width: data.width, height: data.height });
    }

    if (!channels.length) return;
    const w = channels[0].width, h = channels[0].height;
    const canvas = renderer._displayCanvas;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const out = ctx.createImageData(w, h);
    const dst = out.data;
    const nPx = w * h;

    // Composite: additive blend of each channel through its LUT
    for (let ci = 0; ci < channels.length; ci++) {
      const ch = channels[ci];
      const s = ch.settings || {};
      const min = s.min !== undefined ? s.min : 0;
      const max = s.max !== undefined ? s.max : (ch.pixels.length > 0 ? 65535 : 255);
      const range = Math.max(1, max - min);
      const lutId = s.lutId || 'gray';
      const def = window.CameraLUTs?.[lutId];
      const lut = def ? def.generate() : null;

      for (let i = 0; i < nPx; i++) {
        const val = ch.pixels[i];
        const stretched = Math.max(0, Math.min(255, Math.round(((val - min) / range) * 255)));
        let r, g, b;
        if (lut) {
          r = lut[stretched][0]; g = lut[stretched][1]; b = lut[stretched][2];
        } else {
          r = stretched; g = stretched; b = stretched;
        }
        // Additive blend
        dst[i*4] = Math.min(255, (dst[i*4] || 0) + r);
        dst[i*4+1] = Math.min(255, (dst[i*4+1] || 0) + g);
        dst[i*4+2] = Math.min(255, (dst[i*4+2] || 0) + b);
        dst[i*4+3] = 255;
      }
    }

    ctx.putImageData(out, 0, 0);
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.StackViewer = new StackViewer();
