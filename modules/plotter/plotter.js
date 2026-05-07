// modules/plotter/plotter.js — Pen plotter (image/txt → list → draw)

class PlotterModule {
  constructor() {
    this.penUpZ = 5;
    this.penDownZ = 0;
    this.scale = 0.1;       // mm per pixel
    this.threshold = 128;
    this.offsetX = 0;
    this.offsetY = 0;
    this._drawing = false;
    this._stopped = false;
  }

  // === FILE LOADING → POSITION LIST ===

  async loadAndGenerate(file) {
    let positions;
    if (file.name.endsWith('.txt') || file.type === 'text/plain') {
      positions = await this._parseTxt(file);
    } else {
      positions = await this._parseImage(file);
    }
    if (!positions.length) return 0;

    // Add to Lists module
    const lists = window.EnderTrack?.Lists;
    if (lists) {
      lists.addGroup(file.name);
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

  async _parseTxt(file) {
    const text = await file.text();
    const positions = [];
    for (const line of text.trim().split('\n')) {
      const parts = line.trim().split(/[,;\s\t]+/);
      if (parts.length >= 2) {
        const x = parseFloat(parts[0]), y = parseFloat(parts[1]);
        if (!isNaN(x) && !isNaN(y)) positions.push({ x: this.offsetX + x * this.scale, y: this.offsetY + y * this.scale, z: this.penDownZ });
      }
    }
    return positions;
  }

  async _parseImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        const positions = [];
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            if (lum < this.threshold) {
              positions.push({ x: this.offsetX + x * this.scale, y: this.offsetY + y * this.scale, z: this.penDownZ });
            }
          }
        }
        resolve(positions);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  // === DRAW (iterate active list with pen up/down) ===

  async draw() {
    const list = window.EnderTrack?.Lists?._activeGroup?.();
    if (!list?.positions?.length) return;

    this._drawing = true;
    this._stopped = false;
    this.renderUI();

    const positions = list.positions;
    for (let i = 0; i < positions.length && !this._stopped; i++) {
      const p = positions[i];
      // Pen up → move XY → pen down
      await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penUpZ);
      if (this._stopped) break;
      await window.EnderTrack?.Movement?.moveAbsolute(p.x, p.y, this.penDownZ);
    }
    // Final pen up
    if (!this._stopped) await window.EnderTrack?.Movement?.moveAbsolute(positions[0]?.x || 0, positions[0]?.y || 0, this.penUpZ);

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
        <input type="file" id="plotterFile" accept="image/*,.txt" onchange="EnderTrack.Plotter._onFile(event)"
          style="font-size:10px; color:var(--text-general);">
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:50px;">Seuil</label>
          <input type="range" min="10" max="245" value="${this.threshold}" class="et-slider"
            oninput="EnderTrack.Plotter.threshold=parseInt(this.value); this.nextElementSibling.textContent=this.value">
          <span style="font-size:9px; color:var(--coordinates-color); width:24px; text-align:right;">${this.threshold}</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:50px;">Échelle</label>
          <input type="number" value="${this.scale}" min="0.01" step="0.01" onchange="EnderTrack.Plotter.scale=parseFloat(this.value)"
            style="width:50px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">mm/px</span>
          <label style="font-size:10px; color:var(--text-general); margin-left:8px;">Z</label>
          <input type="number" value="${this.penDownZ}" step="0.1" onchange="EnderTrack.Plotter.penDownZ=parseFloat(this.value)"
            style="width:35px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">↓</span>
          <input type="number" value="${this.penUpZ}" step="0.5" onchange="EnderTrack.Plotter.penUpZ=parseFloat(this.value)"
            style="width:35px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">↑</span>
        </div>
        <div id="plotterInfo" style="font-size:10px; color:var(--text-general);">${pointCount ? pointCount + ' points dans la liste active' : 'Charger un fichier image ou .txt'}</div>
        ${this._drawing ? `
          <button onclick="EnderTrack.Plotter.stop()" style="width:100%; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:#ef4444; color:#fff; font-weight:600;">■ Stop</button>
        ` : `
          <button onclick="EnderTrack.Plotter.draw()" style="width:100%; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:var(--active-element); color:var(--text-selected); font-weight:600;" ${pointCount ? '' : 'disabled style="width:100%; padding:10px; border:none; border-radius:4px; font-size:12px; opacity:0.4;"'}>🖊️ Draw</button>
        `}
      </div>`;
  }

  async _onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const count = await this.loadAndGenerate(file);
    const info = document.getElementById('plotterInfo');
    if (info) info.textContent = `${count} points générés → liste "${file.name}"`;
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
