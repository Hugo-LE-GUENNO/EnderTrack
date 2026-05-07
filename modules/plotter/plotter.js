// modules/plotter/plotter.js — Pen plotter (gcode/txt → list → draw)

class PlotterModule {
  constructor() {
    this.penUpZ = 7;
    this.penDownZ = 6;
    this.scale = 0.1;
    this.threshold = 128;
    this.maxPoints = 2000;
    this.invert = false;
    this.flipH = false;
    this.flipV = false;
    this._fileName = '';
    this._drawing = false;
    this._progress = 0;
    this._stopped = false;
    this._file = null;
    this._imgData = null; // {data, w, h} raw image
  }

  // === FILE LOADING ===

  async loadFile(file) {
    this._file = file;
    this._fileName = file.name;
    if (file.name.match(/\.(gcode|gc|ngc)$/i)) {
      this._imgData = null;
      const positions = await this._parseGcode(file);
      this._setList(positions);
    } else if (file.name.endsWith('.txt')) {
      this._imgData = null;
      const positions = await this._parseTxt(file);
      this._setList(positions);
    } else {
      await this._loadImage(file);
      this._processImage();
    }
    this.renderUI();
  }

  async _loadImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width, h = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        this._imgData = { data: ctx.getImageData(0, 0, w, h).data, w, h };
        resolve();
      };
      img.src = URL.createObjectURL(file);
    });
  }

  _processImage() {
    if (!this._imgData) return;
    const { data, w, h } = this._imgData;

    // Binarize
    const binary = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
      binary[i] = this.invert ? (lum >= this.threshold ? 1 : 0) : (lum < this.threshold ? 1 : 0);
    }

    // Apply flip for preview
    this._showBinaryPreview(binary, w, h);
  }

  generateList() {
    if (!this._imgData) return;
    const { data, w, h } = this._imgData;

    // Build binary with same logic as preview
    const binary = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
      binary[i] = this.invert ? (lum >= this.threshold ? 1 : 0) : (lum < this.threshold ? 1 : 0);
    }

    // Sample from the flipped view (same as preview)
    const maxPoints = this.maxPoints || 2000;
    const positions = [];
    const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / (maxPoints * 2))));
    for (let py = 0; py < h; py += step) {
      const row = (py / step) % 2 === 0
        ? Array.from({length: Math.ceil(w / step)}, (_, i) => i * step)
        : Array.from({length: Math.ceil(w / step)}, (_, i) => (Math.ceil(w / step) - 1 - i) * step);
      for (const px of row) {
        if (px >= w) continue;
        const srcX = this.flipH ? (w - 1 - px) : px;
        const srcY = this.flipV ? (h - 1 - py) : py;
        if (binary[srcY * w + srcX]) {
          const outY = this.flipV ? py : (h - 1 - py);
          positions.push({ x: px * this.scale, y: outY * this.scale, z: this.penDownZ });
        }
      }
      if (positions.length >= maxPoints) break;
    }

    this._setList(positions);
    this.renderUI();
  }

  _setList(positions) {
    const lists = window.EnderTrack?.Lists;
    if (!lists) return;
    // Unpin all existing groups
    lists.groups.forEach(g => g.pinned = false);
    // Add new group and pin it
    lists.addGroup('Plot: ' + this._fileName);
    const g = lists._activeGroup();
    if (g) {
      g.positions = positions;
      g.pinned = true;
      lists.save();
      lists.renderUI();
      EnderTrack.Canvas?.requestRender?.();
    }
  }

  _showBinaryPreview(binary, w, h) {
    const preview = document.getElementById('plotterPreview');
    if (!preview) return;

    // Get stage size in mm
    const bounds = window.EnderTrack?.Coordinates?.coordinateBounds;
    const stageW = bounds ? (bounds.x.max - bounds.x.min) : 200;
    const stageH = bounds ? (bounds.y.max - bounds.y.min) : 200;

    // Image size in mm
    const imgWmm = w * this.scale;
    const imgHmm = h * this.scale;

    // Draw stage with image inside at correct scale
    const canvasSize = 200; // preview canvas px
    const pxPerMm = canvasSize / Math.max(stageW, stageH);

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize; canvas.height = canvasSize;
    canvas.style.cssText = 'max-width:100%; image-rendering:pixelated;';
    const ctx = canvas.getContext('2d');

    // Stage background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Stage outline
    const sw = stageW * pxPerMm, sh = stageH * pxPerMm;
    const sx = (canvasSize - sw) / 2, sy = (canvasSize - sh) / 2;
    ctx.strokeStyle = '#444';
    ctx.strokeRect(sx, sy, sw, sh);

    // Render binary image into a temp canvas
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d');
    const imgData = tctx.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const srcX = this.flipH ? (w - 1 - px) : px;
        const srcY = this.flipV ? (h - 1 - py) : py;
        const v = binary[srcY * w + srcX] ? 255 : 0;
        const di = (py * w + px) * 4;
        imgData.data[di] = v; imgData.data[di+1] = v; imgData.data[di+2] = v; imgData.data[di+3] = 255;
      }
    }
    tctx.putImageData(imgData, 0, 0);

    // Draw image at scale inside stage (origin = bottom-left of stage on canvas = top-left visually)
    const iw = imgWmm * pxPerMm, ih = imgHmm * pxPerMm;
    ctx.drawImage(tmp, sx, sy + sh - ih, iw, ih);

    // Size label
    ctx.fillStyle = '#888';
    ctx.font = '9px sans-serif';
    ctx.fillText(imgWmm.toFixed(1) + ' x ' + imgHmm.toFixed(1) + ' mm', sx + 2, sy + sh - ih - 3);

    preview.innerHTML = '';
    preview.appendChild(canvas);
  }

  async _parseTxt(file) {
    const text = await file.text();
    const positions = [];
    for (const line of text.trim().split('\n')) {
      const parts = line.trim().split(/[,;\s\t]+/);
      if (parts.length >= 2) {
        const x = parseFloat(parts[0]), y = parseFloat(parts[1]);
        if (!isNaN(x) && !isNaN(y)) positions.push({ x: x * this.scale, y: y * this.scale, z: this.penDownZ });
      }
    }
    return positions;
  }

  async _parseGcode(file) {
    const text = await file.text();
    const positions = [];
    let curX = 0, curY = 0, curZ = this.penUpZ;
    for (const line of text.split('\n')) {
      const cmd = line.trim().split(';')[0];
      if (!cmd.startsWith('G0') && !cmd.startsWith('G1')) continue;
      const xm = cmd.match(/X([\-\d.]+)/);
      const ym = cmd.match(/Y([\-\d.]+)/);
      const zm = cmd.match(/Z([\-\d.]+)/);
      if (xm) curX = parseFloat(xm[1]);
      if (ym) curY = parseFloat(ym[1]);
      if (zm) curZ = parseFloat(zm[1]);
      if (curZ <= this.penDownZ) {
        positions.push({ x: curX, y: curY, z: curZ });
      }
    }
    return positions;
  }

  // === DRAW ===

  async draw() {
    const list = window.EnderTrack?.Lists?._activeGroup?.();
    if (!list?.positions?.length) return;

    this._drawing = true;
    this._stopped = false;
    this.renderUI();

    const positions = list.positions;
    let lastX = null, lastY = null;

    for (let i = 0; i < positions.length && !this._stopped; i++) {
      this._progress = Math.round((i / positions.length) * 100);
      const bar = document.querySelector('#plotterContent div[style*="transition:width"]');
      if (bar) bar.style.width = this._progress + '%';
      const p = positions[i];
      if (lastX !== null && (Math.abs(p.x - lastX) > 1 || Math.abs(p.y - lastY) > 1)) {
        await window.EnderTrack?.Movement?.moveAbsolute(lastX, lastY, this.penUpZ);
        if (this._stopped) break;
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penUpZ);
        if (this._stopped) break;
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penDownZ);
      } else if (lastX === null) {
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penUpZ);
        if (this._stopped) break;
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penDownZ);
      } else {
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penDownZ);
      }
      lastX = p.x; lastY = p.y;
    }
    if (!this._stopped) await window.EnderTrack?.Movement?.moveAbsolute(lastX || 0, lastY || 0, this.penUpZ);

    this._drawing = false;
    this.renderUI();
  }

  stop() {
    this._stopped = true;
    this._drawing = false;
    window.EnderTrack?.Movement?.stopMovement?.();
    this.renderUI();
  }

  // === UI ===

  renderUI() {
    const container = document.getElementById('plotterContent');
    if (!container) return;

    const activeList = window.EnderTrack?.Lists?._activeGroup?.();
    const pointCount = activeList?.positions?.length || 0;
    const hasImage = !!this._imgData;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px; padding:8px;">

        <input type="file" accept=".gcode,.gc,.ngc,.txt,image/*" onchange="EnderTrack.Plotter._onFile(event)"
          style="font-size:10px; color:var(--text-general);">

        ${hasImage ? `
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:40px;">Seuil</label>
          <input type="range" min="10" max="245" value="${this.threshold}" class="et-slider"
            oninput="EnderTrack.Plotter.threshold=parseInt(this.value); this.nextElementSibling.textContent=this.value; EnderTrack.Plotter._processImage()">
          <span style="font-size:9px; color:var(--coordinates-color); width:20px; text-align:right;">${this.threshold}</span>
        </div>

        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:40px;">mm/px</label>
          <input type="range" min="0.01" max="1" step="0.01" value="${this.scale}" class="et-slider"
            oninput="EnderTrack.Plotter.scale=parseFloat(this.value); this.nextElementSibling.textContent=this.value">
          <span style="font-size:9px; color:var(--coordinates-color); width:28px; text-align:right;">${this.scale}</span>
          <button onclick="EnderTrack.Plotter.flipH=!EnderTrack.Plotter.flipH; EnderTrack.Plotter._processImage()"
            style="padding:3px 6px; border:none; border-radius:3px; cursor:pointer; font-size:9px; background:${this.flipH ? 'var(--active-element)' : 'var(--app-bg)'}; color:${this.flipH ? 'var(--text-selected)' : 'var(--text-general)'};">FlipH</button>
          <button onclick="EnderTrack.Plotter.flipV=!EnderTrack.Plotter.flipV; EnderTrack.Plotter._processImage()"
            style="padding:3px 6px; border:none; border-radius:3px; cursor:pointer; font-size:9px; background:${this.flipV ? 'var(--active-element)' : 'var(--app-bg)'}; color:${this.flipV ? 'var(--text-selected)' : 'var(--text-general)'};">FlipV</button>
          <button onclick="EnderTrack.Plotter.invert=!EnderTrack.Plotter.invert; EnderTrack.Plotter._processImage()"
            style="padding:3px 6px; border:none; border-radius:3px; cursor:pointer; font-size:9px; background:${this.invert ? 'var(--active-element)' : 'var(--app-bg)'}; color:${this.invert ? 'var(--text-selected)' : 'var(--text-general)'};">Inv</button>
        </div>

        <div id="plotterPreview" style="background:#111; border-radius:4px; min-height:100px; max-height:200px; display:flex; align-items:center; justify-content:center; overflow:hidden;"></div>

        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:40px;">Max</label>
          <input type="number" value="${this.maxPoints}" min="100" max="10000" step="100"
            onchange="EnderTrack.Plotter.maxPoints=parseInt(this.value)"
            style="width:50px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <label style="font-size:10px; color:var(--text-general); margin-left:4px;">Z</label>
          <input type="number" value="${this.penDownZ}" step="0.5"
            onchange="EnderTrack.Plotter.penDownZ=parseFloat(this.value)"
            style="width:35px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">\u2193</span>
          <input type="number" value="${this.penUpZ}" step="0.5"
            onchange="EnderTrack.Plotter.penUpZ=parseFloat(this.value)"
            style="width:35px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">\u2191</span>
        </div>

        <button onclick="EnderTrack.Plotter.generateList()"
          style="width:100%; padding:8px; border:none; border-radius:4px; cursor:pointer; font-size:11px; background:var(--app-bg); border:1px solid var(--active-element); color:var(--text-general); font-weight:600;">G\u00e9n\u00e9rer liste (${this._imgData ? Math.round(this._imgData.w * this._imgData.h / 1000) + 'kpx' : ''})</button>
        ` : ''}

        ${this._fileName ? `<div style="font-size:10px; color:var(--text-selected);">\ud83d\udd8a\ufe0f ${this._fileName} \u2014 ${pointCount} pts</div>` : ''}

        ${this._fileName ? (this._drawing ? `
          <div style="width:100%; height:4px; background:var(--app-bg); border-radius:2px; overflow:hidden;">
            <div style="width:${this._progress}%; height:100%; background:var(--active-element); transition:width 0.3s;"></div>
          </div>
          <button onclick="EnderTrack.Plotter.stop()" style="width:100%; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:#ef4444; color:#fff; font-weight:600;">\u25a0 Stop</button>
        ` : `
          <button onclick="EnderTrack.Plotter.draw()" style="width:100%; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:var(--active-element); color:var(--text-selected); font-weight:600;" ${pointCount ? '' : 'disabled style="width:100%; padding:10px; border:none; border-radius:4px; font-size:12px; opacity:0.4;"'}>\ud83d\udd8a\ufe0f Draw</button>
        `) : ''}
      </div>`;

    // Re-render preview if image loaded
    if (hasImage && document.getElementById('plotterPreview')) {
      this._processImage();
    }
  }

  async _onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    await this.loadFile(file);
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Plotter = new PlotterModule();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.Plotter.renderUI());
} else {
  setTimeout(() => EnderTrack.Plotter.renderUI(), 100);
}
