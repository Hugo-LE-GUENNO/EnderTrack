// modules/display/display.js — Viewport layout manager

class DisplayModule {
  constructor() {
    this.viewports = [{ id: 0, source: 'stage' }];
    this._container = null;
    this._pollTimers = new Map();
    this._cells = new Map(); // id → { el, video, img, ph }
    this._stageWrap = null;
  }

  init() {
    this._container = document.querySelector('.canvas-content');
    if (!this._container) return;
    // Wrap stage (main-canvas + z-panel) into a viewport cell
    const mainCanvas = document.querySelector('.main-canvas');
    const zPanel = document.getElementById('zVisualizationPanel');
    if (mainCanvas) {
      this._stageWrap = document.createElement('div');
      this._stageWrap.className = 'viewport-cell stage-viewport';
      this._stageWrap.dataset.viewportId = '0';
      this._stageWrap.style.cssText = 'display:flex; min-width:0; min-height:0; overflow:hidden; position:relative;';
      mainCanvas.parentNode.insertBefore(this._stageWrap, mainCanvas);
      this._stageWrap.appendChild(mainCanvas);
      if (zPanel) this._stageWrap.appendChild(zPanel);
      // Right-click on stage too
      this._stageWrap.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.viewport-cell') === this._stageWrap) {
          e.preventDefault();
          this._showSourceMenu(e.clientX, e.clientY, 0);
        }
      });
    }
  }

  // === LAYOUT ===

  setLayout(panelCount) {
    const n = Math.max(1, Math.min(8, typeof panelCount === 'number' ? panelCount : parseInt(panelCount) || 1));
    // Preserve existing viewport sources
    while (this.viewports.length < n) {
      this.viewports.push({ id: this.viewports.length, source: null });
    }
    while (this.viewports.length > n) {
      const removed = this.viewports.pop();
      this._removeCell(removed.id);
    }
    this._applyGrid();
  }

  addViewport(source = null) {
    if (this.viewports.length >= 8) return -1;
    const id = this.viewports.length;
    this.viewports.push({ id, source });
    this._applyGrid();
    if (source) this._assignSourceToCell(id, source);
    return id;
  }

  removeViewport(id) {
    if (id === 0) return; // can't remove stage
    const idx = this.viewports.findIndex(v => v.id === id);
    if (idx === -1) return;
    this._removeCell(id);
    this.viewports.splice(idx, 1);
    // Re-index
    this.viewports.forEach((v, i) => v.id = i);
    this._applyGrid();
  }

  _applyGrid() {
    if (!this._container) return;
    const n = this.viewports.length;

    // Remove non-stage cells
    this._container.querySelectorAll('.viewport-cell:not(.stage-viewport)').forEach(el => el.remove());
    this._cells.clear();

    if (n <= 1) {
      this._container.style.display = 'flex';
      this._container.style.gridTemplateColumns = '';
      this._container.style.gridTemplateRows = '';
      if (this._stageWrap) {
        this._stageWrap.style.flex = '1';
        this._stageWrap.style.gridRow = '';
        this._stageWrap.style.gridColumn = '';
        this._stageWrap.style.height = '';
      }
      return;
    }

    // Grid layout based on panel count
    const cols = 2;
    const rows = Math.ceil(n / cols);
    this._container.style.display = 'grid';
    this._container.style.gridTemplateColumns = '1fr 1fr';
    this._container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    this._container.style.height = '100%';

    if (this._stageWrap) {
      this._stageWrap.style.flex = '';
      this._stageWrap.style.height = '100%';
      if (n % 2 === 1) {
        this._stageWrap.style.gridColumn = '1';
        this._stageWrap.style.gridRow = `1 / ${rows + 1}`;
      } else {
        this._stageWrap.style.gridColumn = '';
        this._stageWrap.style.gridRow = '';
      }
    }

    // Create cells for viewports 1+
    for (let i = 1; i < n; i++) {
      this._createCell(i);
    }

    // Re-assign sources
    for (let i = 1; i < n; i++) {
      const vp = this.viewports[i];
      if (vp.source) this._assignSourceToCell(i, vp.source);
    }
  }

  _createCell(id) {
    const cell = document.createElement('div');
    cell.className = 'viewport-cell';
    cell.dataset.viewportId = id;
    cell.style.cssText = 'position:relative; background:#111; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid #333; min-width:0; min-height:0;';

    const img = document.createElement('img');
    img.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain; display:none;';
    cell.appendChild(img);

    const ph = document.createElement('div');
    ph.className = 'viewport-placeholder';
    ph.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#555; font-size:11px;';
    ph.textContent = 'Clic droit \u2192 source';
    cell.appendChild(ph);

    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showSourceMenu(e.clientX, e.clientY, id);
    });

    this._container.appendChild(cell);
    this._cells.set(id, { el: cell, img, ph, video: null });
  }

  _removeCell(id) {
    const cell = this._cells.get(id);
    if (!cell) return;
    if (cell.video) { cell.video.srcObject = null; cell.video.remove(); }
    if (this._pollTimers.has(id)) { clearInterval(this._pollTimers.get(id)); this._pollTimers.delete(id); }
    cell.el.remove();
    this._cells.delete(id);
  }

  // === SOURCE ASSIGNMENT ===

  assignSource(viewportId, source) {
    const vp = this.viewports.find(v => v.id === viewportId);
    if (!vp) return;
    if (vp.source === source) return; // already assigned here

    // If another viewport already has this source, swap
    const existing = this.viewports.find(v => v.id !== viewportId && v.source === source);
    if (existing) {
      existing.source = vp.source;
      this._assignSourceToCell(existing.id, existing.source);
    }

    vp.source = source;
    this._assignSourceToCell(viewportId, source);
  }

  _assignSourceToCell(viewportId, source) {
    // Get the cell element (viewport 0 = stageWrap, others = created cells)
    const cellEl = viewportId === 0 ? this._stageWrap : this._cells.get(viewportId)?.el;
    if (!cellEl) return;
    const cell = this._cells.get(viewportId);

    // Cleanup previous content (except stage DOM which is just moved)
    if (cell?.video) { cell.video.srcObject = null; cell.video.remove(); cell.video = null; }
    if (this._pollTimers.has(viewportId)) { clearInterval(this._pollTimers.get(viewportId)); this._pollTimers.delete(viewportId); }
    if (cell) { cell.img.style.display = 'none'; cell.ph.style.display = ''; }

    // Assign stage: move stage DOM into this cell
    if (source === 'stage') {
      const mainCanvas = document.querySelector('.main-canvas');
      const zPanel = document.getElementById('zVisualizationPanel');
      if (mainCanvas) {
        if (viewportId === 0) {
          // Stage back to its original wrapper
          if (!this._stageWrap.contains(mainCanvas)) this._stageWrap.appendChild(mainCanvas);
          if (zPanel && !this._stageWrap.contains(zPanel)) this._stageWrap.appendChild(zPanel);
        } else if (cell) {
          // Move stage into another cell
          cell.ph.style.display = 'none';
          cellEl.insertBefore(mainCanvas, cell.ph);
          if (zPanel) cellEl.insertBefore(zPanel, cell.ph);
        }
      }
      return;
    }

    // No source
    if (!source) {
      if (cell) cell.ph.style.display = '';
      return;
    }

    // Camera source
    if (cell) cell.ph.style.display = 'none';
    const camera = window.EnderTrack?.Camera;
    if (camera?.driver?._stream) {
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = 'width:100%; height:100%; object-fit:contain; background:#000;';
      video.srcObject = camera.driver._stream;
      if (cell) { cellEl.insertBefore(video, cell.ph); cell.video = video; }
      else { cellEl.appendChild(video); }
      video.play().catch(() => {});
      return;
    }

    // Fallback: poll frames
    if (cell) {
      cell.img.style.display = '';
      const timer = setInterval(async () => {
        const frame = await camera?.getFrame();
        if (frame?.frame) cell.img.src = 'data:image/jpeg;base64,' + frame.frame;
      }, 250);
      this._pollTimers.set(viewportId, timer);
    }
  }

  // === CONTEXT MENU ===

  _showSourceMenu(x, y, viewportId) {
    this._removeMenus();
    const menu = document.createElement('div');
    menu.className = 'viewport-context-menu';
    menu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:10001; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.5); padding:4px 0; min-width:140px;`;

    const sources = [{ id: 'stage', label: '\ud83d\udccd Platine XYZ' }];
    (window._cameras || []).forEach((c, i) => {
      sources.push({ id: 'camera:' + i, label: '\ud83d\udcf7 ' + c.label });
    });

    const vp = this.viewports.find(v => v.id === viewportId);
    sources.forEach(s => {
      const active = vp?.source === s.id;
      const row = document.createElement('div');
      row.textContent = (active ? '\u2713 ' : '  ') + s.label;
      row.style.cssText = `padding:6px 12px; font-size:11px; cursor:pointer; color:${active ? 'var(--text-selected)' : 'var(--text-general)'}; white-space:nowrap;`;
      row.addEventListener('mouseenter', () => row.style.background = 'var(--app-bg)');
      row.addEventListener('mouseleave', () => row.style.background = '');
      row.addEventListener('click', () => { this.assignSource(viewportId, s.id); this._removeMenus(); });
      menu.appendChild(row);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
      document.addEventListener('mousedown', close);
    }, 0);
  }

  _removeMenus() {
    document.querySelectorAll('.viewport-context-menu').forEach(m => m.remove());
  }

  // === HEADER BUTTON ===

  _showLayoutMenuFromBtn(btn) {
    const rect = btn.getBoundingClientRect();
    this._removeMenus();
    const menu = document.createElement('div');
    menu.className = 'viewport-context-menu';
    menu.style.cssText = `position:fixed; left:${rect.left}px; top:${rect.bottom + 4}px; z-index:10001; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.5); padding:4px 0; min-width:120px;`;

    const current = this.viewports.length;
    for (let n = 1; n <= 8; n++) {
      const row = document.createElement('div');
      row.textContent = (n === current ? '\u2713 ' : '  ') + n + (n === 1 ? ' panneau' : ' panneaux');
      row.style.cssText = `padding:6px 12px; font-size:11px; cursor:pointer; color:${n === current ? 'var(--text-selected)' : 'var(--text-general)'}; white-space:nowrap;`;
      row.addEventListener('mouseenter', () => row.style.background = 'var(--app-bg)');
      row.addEventListener('mouseleave', () => row.style.background = '');
      row.addEventListener('click', () => { this.setLayout(n); this._removeMenus(); });
      menu.appendChild(row);
    }

    document.body.appendChild(menu);
    setTimeout(() => {
      const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
      document.addEventListener('mousedown', close);
    }, 0);
  }

  // === CLEANUP ===

  getStatus() {
    return { panelCount: this.viewports.length, viewports: this.viewports.map(v => ({ ...v })) };
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Display = new DisplayModule();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.Display.init());
} else {
  setTimeout(() => EnderTrack.Display.init(), 100);
}
