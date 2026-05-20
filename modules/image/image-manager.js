// modules/image/image-manager.js — Image layer & gallery manager

class ImageManager {
  constructor() {
    this.layers = [];
    this.gallery = [];
    this.selectedId = null;
    this._galleryIdx = 0;
    this.isActive = false;
    this._imageSettings = {}; // {path: {min, max, lutId, rgbMode}}
    // Load persisted settings
    try { this._imageSettings = JSON.parse(localStorage.getItem('endertrack_img_settings') || '{}'); } catch {}
  }

  activate() {
    this.isActive = true;
    this.renderUI();
    this.loadGallery();
    this._renderMetadata();
    this._loadAndDisplay();
    this._onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.key === 'ArrowUp') this.selectGalleryImage(Math.max(0, this._galleryIdx - 1));
        else this.selectGalleryImage(Math.min(this.gallery.length - 1, this._galleryIdx + 1));
      }
    };
    document.addEventListener('keydown', this._onKey, true);
    if (window.EnderTrack?.Canvas) window.EnderTrack.Canvas.clickAndGoEnabled = false;
  }

  deactivate() {
    this.isActive = false;
    if (this._onKey) { document.removeEventListener('keydown', this._onKey, true); this._onKey = null; }
    const panel = document.getElementById('imageMetadataPanel');
    if (panel) panel.style.display = 'none';
  }

  // === GALLERY ===

  async loadGallery() {
    try {
      const url = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      const res = await fetch(url + '/api/gallery');
      const data = await res.json();
      this.gallery = data.files || [];
      this._renderGallery();
    } catch(e) { this.gallery = []; }
  }

  selectGalleryImage(idx) {
    this._saveCurrentSettings();
    this._galleryIdx = idx;
    this._renderGallery();
    this._renderMetadata();
    this._loadAndDisplay();
  }

  // Single load path: load image → apply settings → render → update histogram
  async _loadAndDisplay() {
    const img = this.getSelectedImage();
    if (!img) return;
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (!renderer) return;

    // Get saved settings for this image
    const s = this._imageSettings[img.path];

    // Pre-apply settings so renderer uses them on render
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

    // Sync histogram min/max
    if (this._histogram) {
      this._histogram.manualMin = s ? Math.round((s.min / (renderer._maxVal || 255)) * 255) : 0;
      this._histogram.manualMax = s ? Math.round((s.max / (renderer._maxVal || 255)) * 255) : 255;
    }

    // Load image (single load, no auto-render)
    renderer._skipAutoRender = true;
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    const isTiff = img.name.endsWith('.tiff') || img.name.endsWith('.tif');
    if (isTiff) {
      await renderer.loadRaw(img.path, window.EnderTrack?.StackViewer?._index || 0);
      window.EnderTrack?.StackViewer?.open?.(img.path);
    } else {
      await renderer.loadImage(base + '/api/gallery/thumb/' + img.path);
    }
    renderer._skipAutoRender = false;

    // Now render once with correct settings
    renderer.render();

    // Update histogram from loaded raw data
    if (this._histogram && renderer._rawPixels) {
      const data = new Uint8ClampedArray(renderer._width * renderer._height * 4);
      const ch = renderer._channels;
      for (let i = 0; i < renderer._width * renderer._height; i++) {
        if (ch >= 3) {
          data[i*4] = Math.min(255, renderer._rawPixels[i*3]);
          data[i*4+1] = Math.min(255, renderer._rawPixels[i*3+1]);
          data[i*4+2] = Math.min(255, renderer._rawPixels[i*3+2]);
        } else {
          const v = Math.min(255, renderer._rawPixels[i]);
          data[i*4] = v; data[i*4+1] = v; data[i*4+2] = v;
        }
        data[i*4+3] = 255;
      }
      this._histogram.updateFromImageData(data, renderer._channels === 1);
    }

    // Update info label
    const info = document.getElementById('gallery-hist-info');
    if (info && this._histogram) {
      const r = this._histogram.getContrastRange();
      info.textContent = r.min + ' - ' + r.max;
    }

    // Update viewport display canvas
    this._updateGalleryViewport();
  }

  _saveCurrentSettings() {
    const img = this.getSelectedImage();
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (!img || !renderer) return;
    this._imageSettings[img.path] = {
      min: renderer.min,
      max: renderer.max,
      lutId: renderer.lutId,
      rgbMode: renderer.rgbMode
    };
    // Persist to localStorage
    try { localStorage.setItem('endertrack_img_settings', JSON.stringify(this._imageSettings)); } catch {}
  }

  _restoreSettings() {
    const img = this.getSelectedImage();
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (!img || !renderer) return;
    const s = this._imageSettings[img.path];
    if (s) {
      renderer.min = s.min;
      renderer.max = s.max;
      renderer.lutId = s.lutId;
      renderer.rgbMode = s.rgbMode;
      const def = window.CameraLUTs?.[s.lutId];
      renderer._lutTable = def ? def.generate() : null;
      // Sync histogram UI
      if (this._histogram) {
        this._histogram.manualMin = Math.round((s.min / renderer._maxVal) * 255);
        this._histogram.manualMax = Math.round((s.max / renderer._maxVal) * 255);
      }
      // Apply to image
      renderer.render();
    }
  }

  getSelectedImage() {
    return this.gallery[this._galleryIdx] || null;
  }

  // === CANVAS LAYERS ===

  addLayer(src, x, y, width, height, name) {
    const layer = {
      id: Date.now(),
      src, x, y, width, height,
      opacity: 1, visible: true,
      timestamp: new Date().toISOString(),
      name: name || 'Image'
    };
    this.layers.push(layer);
    this.renderUI();
    EnderTrack.Canvas?.requestRender?.();
  }

  removeLayer(id) {
    this.layers = this.layers.filter(l => l.id !== id);
    this.renderUI();
    EnderTrack.Canvas?.requestRender?.();
  }

  toggleLayer(id) {
    const l = this.layers.find(l => l.id === id);
    if (l) { l.visible = !l.visible; this.renderUI(); EnderTrack.Canvas?.requestRender?.(); }
  }

  setLayerOpacity(id, opacity) {
    const l = this.layers.find(l => l.id === id);
    if (l) { l.opacity = opacity; EnderTrack.Canvas?.requestRender?.(); }
  }

  // Render layers on canvas (called by canvas render pipeline)
  renderOnCanvas(ctx, coords) {
    this.layers.forEach(l => {
      if (!l.visible || !l._img) return;
      const tl = coords.mapToCanvas(l.x, l.y + l.height);
      const br = coords.mapToCanvas(l.x + l.width, l.y);
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l._img, tl.cx, tl.cy, br.cx - tl.cx, br.cy - tl.cy);
      ctx.globalAlpha = 1;
    });
  }

  // === VIEWPORT SOURCE ===

  renderInViewport(container) {
    let wrap = container.querySelector('.gallery-viewport-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'gallery-viewport-wrap';
      wrap.style.cssText = 'position:absolute; inset:0; z-index:10; display:flex; flex-direction:column;';
      container.appendChild(wrap);
    }
    const img = this.getSelectedImage();
    if (!img) {
      wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:11px;">Aucune image</div>';
      return;
    }
    // If TIFF, delegate to StackViewer
    if (img.name.endsWith('.tiff') || img.name.endsWith('.tif')) {
      wrap.remove();
      const sv = window.EnderTrack?.StackViewer;
      if (sv) {
        sv._container = container;
        sv.open(img.path).then(() => sv.renderInViewport(container));
      }
      return;
    }
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/gallery/thumb/' + img.path;
    wrap.innerHTML = `
      <div style="position:relative; width:100%; height:100%; display:flex; flex-direction:column; background:#000;">
        <canvas id="galleryDisplayCanvas" style="flex:1; object-fit:contain; min-height:0; image-rendering:pixelated;"></canvas>
        <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; background:#1a1a1a; font-size:10px; color:var(--text-general);">
          <button onclick="EnderTrack.ImageManager.selectGalleryImage(${this._galleryIdx - 1 >= 0 ? this._galleryIdx - 1 : 0})" style="border:none;background:none;color:var(--text-general);cursor:pointer;font-size:14px;">&#9664;</button>
          <span>${img.name} (${this._galleryIdx + 1}/${this.gallery.length})</span>
          <button onclick="EnderTrack.ImageManager.selectGalleryImage(${Math.min(this._galleryIdx + 1, this.gallery.length - 1)})" style="border:none;background:none;color:var(--text-general);cursor:pointer;font-size:14px;">&#9654;</button>
        </div>
      </div>`;
    // Load image into renderer
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (renderer) {
      const canvas = document.getElementById("galleryDisplayCanvas");
      renderer.setDisplayCanvas(canvas);
      // Use raw endpoint for TIFF, standard for PNG/JPG
      const img2 = this.getSelectedImage();
      const imgSettings = img2 ? this._imageSettings[img2.path] : null;
      // Skip auto-render in loadImage — we'll render after applying settings
      renderer._skipAutoRender = true;
      const applyAfterLoad = () => {
        renderer._skipAutoRender = false;
        if (imgSettings) {
          renderer.min = imgSettings.min;
          renderer.max = imgSettings.max;
          renderer.lutId = imgSettings.lutId;
          renderer.rgbMode = imgSettings.rgbMode;
          const def = window.CameraLUTs?.[imgSettings.lutId];
          renderer._lutTable = def ? def.generate() : null;
        }
        renderer.render();
      };
      if (img2 && (img2.name.endsWith('.tiff') || img2.name.endsWith('.tif'))) {
        renderer.loadRaw(img2.path, 0).then(applyAfterLoad);
      } else {
        renderer.loadImage(url).then(applyAfterLoad);
      }
      // Right-click on canvas for RGB/LUT options
      canvas.oncontextmenu = (e) => { e.preventDefault(); this._showRendererMenu(e.clientX, e.clientY); };
      // Double-click for fullscreen toggle
      canvas.ondblclick = () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else canvas.requestFullscreen?.();
      };
    }

  }
  _toggleAutoContrast() {
    if (!this._histogram) return;
    const isAuto = this._histogram.mode === 'auto';
    this._histogram.setMode(isAuto ? 'manual' : 'auto');
    const btn = document.getElementById('gallery-hist-auto');
    if (btn) {
      btn.style.background = this._histogram.mode === 'auto' ? 'var(--active-element)' : 'var(--app-bg)';
      btn.style.color = this._histogram.mode === 'auto' ? 'var(--text-selected)' : 'var(--text-general)';
    }
    if (this._histogram.mode === 'auto') {
      const r = this._histogram.getContrastRange();
      const renderer = window.EnderTrack?.GalleryRenderer;
      if (renderer) renderer.setContrast(r.min, r.max);
    }
  }

  _showRendererMenu(x, y) {
    document.getElementById('gallery-renderer-menu')?.remove();
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (!renderer) return;
    const luts = window.CameraLUTs || {};
    const menu = document.createElement('div');
    menu.id = 'gallery-renderer-menu';
    menu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:10000; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.4); padding:4px 0; min-width:120px;`;
    // RGB toggle
    if (renderer._channels >= 3) {
      const rgbRow = document.createElement('div');
      rgbRow.style.cssText = 'padding:4px 10px; font-size:11px; cursor:pointer; color:var(--text-general);';
      rgbRow.innerHTML = `<span style="width:14px; display:inline-block;">${renderer.rgbMode ? '\u2713' : ''}</span>RGB`;
      rgbRow.onmouseenter = () => rgbRow.style.background = 'var(--app-bg)';
      rgbRow.onmouseleave = () => rgbRow.style.background = '';
      rgbRow.onclick = () => { renderer.setRgbMode(!renderer.rgbMode); menu.remove(); };
      menu.appendChild(rgbRow);
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px; background:#444; margin:4px 8px;';
      menu.appendChild(sep);
    }
    // Log scale toggle
    const logRow = document.createElement('div');
    logRow.style.cssText = 'padding:4px 10px; font-size:11px; cursor:pointer; color:var(--text-general);';
    logRow.innerHTML = `<span style="width:14px; display:inline-block;">${this._histogram?.logScale ? '\u2713' : ''}</span>Log scale`;
    logRow.onmouseenter = () => logRow.style.background = 'var(--app-bg)';
    logRow.onmouseleave = () => logRow.style.background = '';
    logRow.onclick = () => { if (this._histogram) { this._histogram.logScale = !this._histogram.logScale; this._histogram._redraw(); } menu.remove(); };
    menu.appendChild(logRow);
    // Data range info
    if (renderer._dtype === 'uint16') {
      const infoRow = document.createElement('div');
      infoRow.style.cssText = 'padding:4px 10px; font-size:9px; color:#888;';
      infoRow.textContent = `16-bit [${Math.round(renderer._dataMin)}-${Math.round(renderer._dataMax)}]`;
      menu.appendChild(infoRow);
    }
    const sep2 = document.createElement('div');
    sep2.style.cssText = 'height:1px; background:#444; margin:4px 8px;';
    menu.appendChild(sep2);
    // LUT options
    for (const [id, def] of Object.entries(luts)) {
      const row = document.createElement('div');
      const active = id === renderer.lutId && !renderer.rgbMode;
      row.style.cssText = `padding:4px 10px; font-size:11px; cursor:pointer; color:${active ? 'var(--text-selected)' : 'var(--text-general)'}; background:${active ? 'var(--active-element)' : 'transparent'};`;
      row.textContent = def.name;
      row.onmouseenter = () => { if (!active) row.style.background = 'var(--app-bg)'; };
      row.onmouseleave = () => { if (!active) row.style.background = ''; };
      row.onclick = () => { renderer.setLut(id); if (this._histogram) this._histogram._redraw(); menu.remove(); };
      menu.appendChild(row);
    }
    document.body.appendChild(menu);
    setTimeout(() => { const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } }; document.addEventListener('mousedown', close); }, 0);
  }

  _updateGalleryViewport() {
    const display = window.EnderTrack?.Display;
    if (!display) return;
    const renderer = window.EnderTrack?.GalleryRenderer;
    display.viewports.forEach(vp => {
      if (vp.source === 'gallery') {
        const cell = vp.id === 0 ? display._stageWrap : display._cells.get(vp.id);
        if (!cell) return;
        // Reuse existing canvas or create one
        let canvas = cell.querySelector('#galleryDisplayCanvas');
        if (!canvas) {
          // First time: build viewport
          this.renderInViewport(cell);
          return;
        }
        // Canvas exists: just re-render with current data
        if (renderer) {
          renderer.setDisplayCanvas(canvas);
          if (renderer._rawPixels) renderer.render();
        }
      }
    });
  }

  // === UI ===

  renderUI() {
    const container = document.getElementById('imageTabContent');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; padding:8px;">
        <div style="font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#666;">Calque caméra</div>
        <div id="imageLayerTable">
          ${this.layers.length ? this.layers.map(l => `
            <div style="display:flex; align-items:center; gap:6px; padding:4px; font-size:10px; border-bottom:1px solid #222;">
              <input type="checkbox" ${l.visible ? 'checked' : ''} onchange="EnderTrack.ImageManager.toggleLayer(${l.id})" style="margin:0;">
              <span style="flex:1; color:var(--text-general); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${l.name}</span>
              <input type="range" min="0" max="1" step="0.1" value="${l.opacity}" oninput="EnderTrack.ImageManager.setLayerOpacity(${l.id}, parseFloat(this.value))" style="width:50px;">
              <button onclick="EnderTrack.ImageManager.removeLayer(${l.id})" style="border:none;background:none;color:#666;cursor:pointer;font-size:10px;">x</button>
            </div>
          `).join('') : '<div style="text-align:center; color:#555; font-size:10px; padding:8px;">Aucune image sur le canvas</div>'}
        </div>

        <div style="border-top:1px solid #333; padding-top:8px;">
          <div style="font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#666; margin-bottom:4px;">Galerie</div>
          <div id="imageGalleryList"></div>
        </div>
      </div>`;

    this._renderGallery();
  }

  _renderGallery() {
    const el = document.getElementById('imageGalleryList');
    if (!el) return;

    if (!this.gallery.length) {
      el.innerHTML = '<div style="text-align:center; color:#555; font-size:10px; padding:8px;">Aucune capture</div>';
      return;
    }

    el.innerHTML = `
      <input type="text" placeholder="Rechercher..." oninput="EnderTrack.ImageManager._filterGallery(this.value)"
        style="width:100%; padding:4px 6px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px; margin-bottom:4px;">
      <div style="max-height:200px; overflow-y:auto;">
        ${this.gallery.map((f, i) => `
          <div onclick="EnderTrack.ImageManager.selectGalleryImage(${i})" style="display:flex; align-items:center; gap:6px; padding:4px; cursor:pointer; font-size:10px; background:${i === this._galleryIdx ? 'var(--app-bg)' : 'transparent'}; border-radius:3px;">
            <span style="color:var(--coordinates-color); width:20px; text-align:right;">${i + 1}</span>
            <span style="flex:1; color:var(--text-general); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.name}</span>
            <span style="color:#666; font-size:9px;">${(f.size / 1024).toFixed(0)}k</span>
          </div>
        `).join('')}
      </div>`;
  }

  _filterGallery(query) {
    const el = document.getElementById('imageGalleryList');
    if (!el) return;
    const items = el.querySelectorAll('[onclick]');
    const q = query.toLowerCase();
    items.forEach((item, i) => {
      const name = this.gallery[i]?.name || '';
      item.style.display = name.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  _renderMetadata() {
    const panel = document.getElementById('imageMetadataPanel');
    if (!panel) return;
    panel.style.display = 'block';
    const img = this.getSelectedImage();
    if (!img) { panel.innerHTML = '<div style="font-size:10px; color:#555; padding:8px;">Aucune image</div>'; return; }
    const match = img.name.match(/X([\d.]+)_Y([\d.]+)_Z([\d.]+)/);
    const pos = match ? { x: match[1], y: match[2], z: match[3] } : null;
    panel.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px; padding:4px;">
        <div style="font-size:10px; color:var(--text-general); display:flex; flex-direction:column; gap:3px;">
          <strong style="color:var(--text-selected); word-break:break-all;">${img.name}</strong>
          ${pos ? `<div style="font-family:monospace; color:var(--coordinates-color);">X${pos.x} Y${pos.y} Z${pos.z}</div>` : ''}
          <div>Taille: ${(img.size / 1024).toFixed(1)} Ko</div>
          <div>Date: ${new Date(img.mtime * 1000).toLocaleString()}</div>
        </div>
        <div id="galleryHistContainer"></div>
      </div>`;
    // Ensure histogram DOM is built (but don't load image data — _loadAndDisplay handles that)
    this._ensureHistogramDOM();
  }

  _ensureHistogramDOM() {
    const container = document.getElementById('galleryHistContainer');
    if (!container) return;
    const HistClass = window.CameraHistogram;
    if (!HistClass) return;
    if (!this._histogram) {
      this._histogram = new HistClass();
      this._histogram.mode = 'manual';
      this._histogram.manualMin = 0;
      this._histogram.manualMax = 255;
      this._histSetup = false;
    }
    if (!this._histSetup || !document.getElementById('gallery-hist-canvas')) {
      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:9px; color:var(--text-general);">Histogram</span>
          <div style="display:flex; gap:2px; align-items:center;">
            <span id="gallery-hist-info" style="font-family:monospace; font-size:9px; color:var(--text-general);">-</span>
            <button onclick="EnderTrack.ImageManager._toggleAutoContrast()" id="gallery-hist-auto" style="font-size:8px; padding:1px 4px; border:none; border-radius:2px; cursor:pointer; background:var(--app-bg); color:var(--text-general);">Auto</button>
          </div>
        </div>
        <canvas id="gallery-hist-canvas" width="200" height="70" style="width:100%; height:70px; border-radius:4px; background:#111; cursor:default;"></canvas>`;
      this._histogram.canvas = document.getElementById('gallery-hist-canvas');
      this._histogram.ctx = this._histogram.canvas.getContext('2d');
      this._histogram._setupEvents();
      const origRedraw = this._histogram._redraw.bind(this._histogram);
      this._histogram._redraw = () => {
        origRedraw();
        const r = this._histogram.getContrastRange();
        const renderer = window.EnderTrack?.GalleryRenderer;
        if (renderer) { renderer.setContrast(r.min, r.max); }
        const info = document.getElementById('gallery-hist-info');
        if (info) { const ren = window.EnderTrack?.GalleryRenderer; if (ren && ren._dtype === 'uint16') { info.textContent = Math.round(ren.min) + ' - ' + Math.round(ren.max); } else { info.textContent = r.min + ' - ' + r.max; } }
        this._saveCurrentSettings();
      };
      this._histogram._getCurrentLut = () => {
        const renderer = window.EnderTrack?.GalleryRenderer;
        if (!renderer || renderer.lutId === 'gray') return null;
        const def = window.CameraLUTs?.[renderer.lutId];
        return def ? def.generate() : null;
      };
      this._histogram._showOptionsMenu = (x, y) => {
        window.EnderTrack?.ImageManager?._showRendererMenu?.(x, y);
      };
      this._histSetup = true;
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ImageManager = new ImageManager();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { EnderTrack.ImageManager.renderUI(); EnderTrack.ImageManager.loadGallery(); });
} else {
  setTimeout(() => { EnderTrack.ImageManager.renderUI(); EnderTrack.ImageManager.loadGallery(); }, 200);
}
