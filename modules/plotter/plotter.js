// modules/plotter/plotter.js — Image to path plotter

class PlotterModule {
  constructor() {
    this.paths = [];      // Array of paths: [{x,y}[]]
    this.penUpZ = 5;      // Z height when pen is up (mm)
    this.penDownZ = 0;    // Z height when pen touches paper (mm)
    this.feedrate = 3000; // Drawing speed (mm/min)
    this.scale = 1;       // mm per pixel
    this.offsetX = 0;     // Origin offset X
    this.offsetY = 0;     // Origin offset Y
    this.threshold = 128; // Binarization threshold
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
  }

  // === IMAGE LOADING ===

  async loadFile(file) {
    if (file.name.endsWith('.txt') || file.type === 'text/plain') {
      return await this._loadTxt(file);
    }
    return await this._loadImage(file);
  }

  async _loadImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this._canvas.width = img.width;
        this._canvas.height = img.height;
        this._ctx.drawImage(img, 0, 0);
        this._extractPaths();
        resolve({ width: img.width, height: img.height, paths: this.paths.length });
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async _loadTxt(file) {
    const text = await file.text();
    const lines = text.trim().split('\n');
    const path = [];
    for (const line of lines) {
      const parts = line.trim().split(/[,;\s\t]+/);
      if (parts.length >= 2) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        if (!isNaN(x) && !isNaN(y)) {
          path.push({ x: this.offsetX + x * this.scale, y: this.offsetY + y * this.scale });
        }
      }
    }
    this.paths = path.length > 0 ? [path] : [];
    return { width: 0, height: 0, paths: this.paths.length, points: path.length };
  }

  // === PATH EXTRACTION (simple contour tracing) ===

  _extractPaths() {
    const w = this._canvas.width, h = this._canvas.height;
    const data = this._ctx.getImageData(0, 0, w, h).data;
    const visited = new Uint8Array(w * h);
    this.paths = [];

    // Binarize: pixel is "ink" if luminance < threshold
    const isInk = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      return lum < this.threshold;
    };

    // Simple scanline path extraction
    for (let y = 0; y < h; y++) {
      let inStroke = false;
      let path = [];
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (isInk(x, y) && !visited[idx]) {
          visited[idx] = 1;
          if (!inStroke) {
            if (path.length > 1) this.paths.push(path);
            path = [];
            inStroke = true;
          }
          path.push({ x: this.offsetX + x * this.scale, y: this.offsetY + y * this.scale });
        } else {
          if (inStroke) inStroke = false;
        }
      }
      if (path.length > 1) this.paths.push(path);
    }
  }

  // === GENERATE POSITION LIST ===

  generateList() {
    const positions = [];
    for (const path of this.paths) {
      for (const pt of path) {
        positions.push({ x: pt.x, y: pt.y, z: this.penDownZ });
      }
    }
    // Add to EnderTrack Lists
    const listManager = window.EnderTrack?.Lists?.manager;
    if (listManager?.createList) {
      const list = listManager.createList('Plotter drawing');
      list.positions = positions;
      listManager.save?.();
      window.EnderTrack?.Lists?.renderUI?.();
      return list;
    }
    return null;
  }

  // === EXECUTE DRAWING ===

  async executeDraw() {
    if (!this.paths.length) return;
    this._drawing = true;
    this._stopped = false;
    this.renderUI();

    const move = async (x, y, z) => {
      if (this._stopped) return;
      await window.EnderTrack?.Movement?.moveAbsolute(x, y, z);
    };

    for (let p = 0; p < this.paths.length && !this._stopped; p++) {
      const path = this.paths[p];
      if (!path.length) continue;
      // Pen up + move to start of path
      await move(path[0].x, path[0].y, this.penUpZ);
      // Pen down
      await move(path[0].x, path[0].y, this.penDownZ);
      // Draw along path
      for (let i = 1; i < path.length && !this._stopped; i++) {
        await move(path[i].x, path[i].y, this.penDownZ);
      }
    }
    // Final pen up + home
    if (!this._stopped) await move(0, 0, this.penUpZ);

    this._drawing = false;
    this.renderUI();
  }

  stopDraw() {
    this._stopped = true;
    this._drawing = false;
    window.EnderTrack?.Movement?.stopMovement?.();
    this.renderUI();
  }

  // === UI ===

  renderUI() {
    const container = document.getElementById('plotterContent');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; gap:6px; align-items:center;">
          <input type="file" id="plotterFileInput" accept="image/*,.txt" onchange="EnderTrack.Plotter._onFileChange(event)"
            style="flex:1; font-size:10px; color:var(--text-general);">
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:60px;">Seuil</label>
          <input type="range" min="10" max="245" value="${this.threshold}" class="et-slider"
            oninput="EnderTrack.Plotter.threshold=parseInt(this.value); this.nextElementSibling.textContent=this.value">
          <span style="font-size:9px; color:var(--coordinates-color); width:24px; text-align:right;">${this.threshold}</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:60px;">Échelle</label>
          <input type="number" value="${this.scale}" min="0.01" step="0.1"
            onchange="EnderTrack.Plotter.scale=parseFloat(this.value)"
            style="width:50px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">mm/px</span>
          <label style="font-size:10px; color:var(--text-general); margin-left:8px;">Z pen</label>
          <input type="number" value="${this.penDownZ}" step="0.1"
            onchange="EnderTrack.Plotter.penDownZ=parseFloat(this.value)"
            style="width:40px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">↓</span>
          <input type="number" value="${this.penUpZ}" step="0.5"
            onchange="EnderTrack.Plotter.penUpZ=parseFloat(this.value)"
            style="width:40px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">↑</span>
        </div>
        <div id="plotterPreview" style="background:#111; border-radius:4px; height:120px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
          <span style="font-size:10px; color:#555;">Charger une image</span>
        </div>
        <div id="plotterInfo" style="font-size:10px; color:var(--text-general);"></div>
        ${this._drawing ? `
          <button onclick="EnderTrack.Plotter.stopDraw()" style="width:100%; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:#ef4444; color:#fff; font-weight:600;">
            ■ Stop
          </button>
        ` : `
          <button onclick="EnderTrack.Plotter._draw()" style="width:100%; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:var(--active-element); color:var(--text-selected); font-weight:600;" ${this.paths.length ? '' : 'disabled style="width:100%; padding:10px; border:none; border-radius:4px; font-size:12px; opacity:0.4;"'}>
            🖊️ Draw
          </button>
        `}
      </div>`;
  }

  async _onFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const result = await this.loadFile(file);
    // Show preview
    const preview = document.getElementById('plotterPreview');
    if (preview) {
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = this._canvas.toDataURL();
      img.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain;';
      preview.appendChild(img);
    }
    const info = document.getElementById('plotterInfo');
    if (info) info.textContent = `${result.width}×${result.height}px → ${result.paths} tracés`;
    this.renderUI();
  }

  _draw() {
    this._extractPaths(); // Re-extract with current settings
    this.executeDraw();
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Plotter = new PlotterModule();

// Auto-render UI when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.Plotter.renderUI());
} else {
  setTimeout(() => EnderTrack.Plotter.renderUI(), 100);
}
