// modules/image/stack-viewer.js — Multi-dimensional TIFF stack viewer

class StackViewer {
  constructor() {
    this._file = null;
    this._info = null; // {pages, width, height, mode}
    this._index = 0;
    this._container = null;
  }

  async open(filepath) {
    this._file = filepath;
    this._index = 0;
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
    try {
      // Get basic info
      const res = await fetch(url + '/api/stack/info?file=' + encodeURIComponent(filepath));
      this._info = await res.json();
      if (this._info.error) { console.warn('[Stack]', this._info.error); return false; }
      // Get dimension metadata
      const dimRes = await fetch(url + '/api/stack/dimensions?file=' + encodeURIComponent(filepath));
      this._dims = await dimRes.json();
      this._renderViewport();
      return true;
    } catch(e) { return false; }
  }

  setIndex(idx) {
    if (!this._info) return;
    this._index = Math.max(0, Math.min(idx, this._info.pages - 1));
    this._updateImage();
    const img = window.EnderTrack?.ImageManager?.getSelectedImage?.();
    if (img) window.EnderTrack?.ImageManager?._updateHistogram?.(img);
  }

  _setDim(dim, val) {
    if (!this._dims) return;
    if (!this._dimState) this._dimState = { c: 0, z: 0, t: 0 };
    this._dimState[dim] = val;
    // Calculate page index from dimension state (order: XYCZT)
    const c = this._dimState.c || 0;
    const z = this._dimState.z || 0;
    const t = this._dimState.t || 0;
    const sizeC = this._dims.sizeC || 1;
    const sizeZ = this._dims.sizeZ || 1;
    // XYCZT order: index = c + sizeC * (z + sizeZ * t)
    this._index = c + sizeC * (z + sizeZ * t);
    this._updateImage();
    // Update labels
    const lc = document.getElementById('stackLabelC');
    const lz = document.getElementById('stackLabelZ');
    const lt = document.getElementById('stackLabelT');
    if (lc) lc.textContent = c + 1;
    if (lz) lz.textContent = z + 1;
    if (lt) lt.textContent = t + 1;
    const img = window.EnderTrack?.ImageManager?.getSelectedImage?.();
    if (img) window.EnderTrack?.ImageManager?._updateHistogram?.(img);
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
    if (sizeC > 1) slidersHtml += `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:9px; color:#888; width:12px;">C</span><input type="range" min="0" max="${sizeC-1}" value="0" oninput="EnderTrack.StackViewer._setDim('c', parseInt(this.value))" style="flex:1; height:3px;"><span id="stackLabelC" style="font-size:9px; color:var(--text-general); width:20px; text-align:right;">1</span></div>`;
    if (sizeZ > 1) slidersHtml += `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:9px; color:#888; width:12px;">Z</span><input type="range" min="0" max="${sizeZ-1}" value="0" oninput="EnderTrack.StackViewer._setDim('z', parseInt(this.value))" style="flex:1; height:3px;"><span id="stackLabelZ" style="font-size:9px; color:var(--text-general); width:20px; text-align:right;">1</span></div>`;
    if (sizeT > 1) slidersHtml += `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:9px; color:#888; width:12px;">T</span><input type="range" min="0" max="${sizeT-1}" value="0" oninput="EnderTrack.StackViewer._setDim('t', parseInt(this.value))" style="flex:1; height:3px;"><span id="stackLabelT" style="font-size:9px; color:var(--text-general); width:20px; text-align:right;">1</span></div>`;
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
      renderer.loadRaw(this._file, this._index);
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
  _updateImage() {
    const slider = document.getElementById("stackSlider");
    const label = document.getElementById("stackLabel");
    if (!this._file) return;
    // Update renderer with raw data
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (renderer) renderer.loadRaw(this._file, this._index);
    if (slider) slider.value = this._index;
    if (label) label.textContent = (this._index + 1) + " / " + this._info.pages;
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
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.StackViewer = new StackViewer();
