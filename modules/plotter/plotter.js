// modules/plotter/plotter.js — Pen plotter (gcode/txt → list → draw)

class PlotterModule {
  constructor() {
    this.penUpZ = 7;
    this.penDownZ = 6;
    this.scale = 0.1;
    this.threshold = 128;
    this.maxPoints = 2000;
    this._drawing = false;
    this._stopped = false;
  }

  // === FILE LOADING ===

  async loadAndGenerate(file) {
    let positions;
    if (file.name.endsWith('.gcode') || file.name.endsWith('.gc') || file.name.endsWith('.ngc')) {
      positions = await this._parseGcode(file);
    } else if (file.name.endsWith('.txt')) {
      positions = await this._parseTxt(file);
    } else {
      positions = await this._parseImage(file);
    }
    if (!positions.length) return 0;

    // Add to Lists module
    const lists = window.EnderTrack?.Lists;
    if (lists) {
      lists.addGroup('Plot: ' + file.name);
      const g = lists._activeGroup();
      if (g) {
        g.positions = positions;
        lists.save();
        lists.renderUI();
        EnderTrack.Canvas?.requestRender?.();
      }
    }
    return positions.length;
  }

  async _parseImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width, h = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;

        // Binarize
        const binary = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
          const idx = i * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
          binary[i] = lum < this.threshold ? 1 : 0;
        }

        // Show binary preview
        this._showBinaryPreview(binary, w, h);

        // Sample points (limit to maxPoints)
        const maxPoints = this.maxPoints || 2000;
        const positions = [];
        const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / (maxPoints * 2))));
        for (let y = 0; y < h; y += step) {
          // Alternate direction for efficient plotting (boustrophedon)
          const xRange = (y / step) % 2 === 0
            ? Array.from({length: Math.ceil(w / step)}, (_, i) => i * step)
            : Array.from({length: Math.ceil(w / step)}, (_, i) => (Math.ceil(w / step) - 1 - i) * step);
          for (const x of xRange) {
            if (x < w && binary[y * w + x]) {
              positions.push({ x: x * this.scale, y: y * this.scale, z: this.penDownZ });
            }
          }
          if (positions.length >= maxPoints) break;
        }
        resolve(positions);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  _showBinaryPreview(binary, w, h) {
    const preview = document.getElementById('plotterPreview');
    if (!preview) return;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain; image-rendering:pixelated;';
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = binary[i] ? 0 : 255;
      imgData.data[i*4] = v; imgData.data[i*4+1] = v; imgData.data[i*4+2] = v; imgData.data[i*4+3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
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
      const cmd = line.trim().split(';')[0]; // remove comments
      if (!cmd.startsWith('G0') && !cmd.startsWith('G1')) continue;
      const xm = cmd.match(/X([\-\d.]+)/);
      const ym = cmd.match(/Y([\-\d.]+)/);
      const zm = cmd.match(/Z([\-\d.]+)/);
      if (xm) curX = parseFloat(xm[1]);
      if (ym) curY = parseFloat(ym[1]);
      if (zm) curZ = parseFloat(zm[1]);
      // Only record positions where pen is down
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
      const p = positions[i];
      // If new stroke (gap from last point), pen up + travel + pen down
      if (lastX !== null && (Math.abs(p.x - lastX) > 1 || Math.abs(p.y - lastY) > 1)) {
        await window.EnderTrack?.Movement?.moveAbsolute(lastX, lastY, this.penUpZ);
        if (this._stopped) break;
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penUpZ);
        if (this._stopped) break;
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penDownZ);
      } else if (lastX === null) {
        // First point: travel + pen down
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penUpZ);
        if (this._stopped) break;
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penDownZ);
      } else {
        // Continuous stroke
        await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penDownZ);
      }
      lastX = p.x; lastY = p.y;
    }
    // Final pen up
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

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; padding:8px;">
        <div style="font-size:10px; color:var(--text-general);">Charger une image, un G-code (.gcode) ou des coordonn\u00e9es (.txt)</div>
        <input type="file" id="plotterFile" accept=".gcode,.gc,.ngc,.txt,image/*" onchange="EnderTrack.Plotter._onFile(event)"
          style="font-size:10px; color:var(--text-general);">
        <div id="plotterPreview" style="background:#111; border-radius:4px; min-height:80px; display:flex; align-items:center; justify-content:center; overflow:hidden;"></div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:50px;">Seuil</label>
          <input type="range" min="10" max="245" value="${this.threshold}" class="et-slider"
            oninput="EnderTrack.Plotter.threshold=parseInt(this.value); this.nextElementSibling.textContent=this.value">
          <span style="font-size:9px; color:var(--coordinates-color); width:24px; text-align:right;">${this.threshold}</span>
          <label style="font-size:10px; color:var(--text-general); margin-left:6px;">Max</label>
          <input type="number" value="${this.maxPoints}" min="100" max="10000" step="100" onchange="EnderTrack.Plotter.maxPoints=parseInt(this.value)"
            style="width:50px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:50px;">\u00c9chelle</label>
          <input type="number" value="${this.scale}" min="0.01" step="0.01" onchange="EnderTrack.Plotter.scale=parseFloat(this.value)"
            style="width:50px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">mm/px</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:50px;">Z pen</label>
          <input type="number" value="${this.penDownZ}" step="0.5" onchange="EnderTrack.Plotter.penDownZ=parseFloat(this.value)"
            style="width:40px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">\u2193 down</span>
          <input type="number" value="${this.penUpZ}" step="0.5" onchange="EnderTrack.Plotter.penUpZ=parseFloat(this.value)"
            style="width:40px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">\u2191 up</span>
        </div>
        <div id="plotterInfo" style="font-size:10px; color:var(--text-general);">${pointCount ? pointCount + ' points' : ''}</div>
        ${this._drawing ? `
          <button onclick="EnderTrack.Plotter.stop()" style="width:100%; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:#ef4444; color:#fff; font-weight:600;">\u25a0 Stop</button>
        ` : `
          <button onclick="EnderTrack.Plotter.draw()" style="width:100%; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:var(--active-element); color:var(--text-selected); font-weight:600;" ${pointCount ? '' : 'disabled style="width:100%; padding:10px; border:none; border-radius:4px; font-size:12px; opacity:0.4;"'}>\ud83d\udd8a\ufe0f Draw</button>
        `}
      </div>`;
  }

  async _onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const count = await this.loadAndGenerate(file);
    const info = document.getElementById('plotterInfo');
    if (info) info.textContent = count + ' points \u2192 liste "' + file.name + '"';
    this.renderUI();
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Plotter = new PlotterModule();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.Plotter.renderUI());
} else {
  setTimeout(() => EnderTrack.Plotter.renderUI(), 100);
}
