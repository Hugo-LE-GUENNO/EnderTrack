// modules/display/display.js — Viewport layout manager with context menu

class DisplayModule {
  constructor() {
    this.layout = '1'; // '1' | '2h' | '2v' | '4'
    this.viewports = [{ id: 0, source: 'stage' }]; // source: 'stage' | 'camera:0' | 'camera:1' | ...
    this._container = null;
    this._pollTimers = [];
    this._canvases = new Map(); // viewport id → { canvas, ctx }
  }

  init() {
    this._container = document.querySelector('.canvas-content');
    if (!this._container) return;

    // Right-click on viewport cells → source menu
    this._container.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.viewport-cell')) {
        e.preventDefault();
        e.stopPropagation();
        const vpId = parseInt(e.target.closest('.viewport-cell').dataset.viewportId);
        this._showSourceMenu(e.clientX, e.clientY, vpId);
      }
    });
  }

  // === LAYOUT ===

  setLayout(mode) {
    this.layout = mode;
    this._applyLayout();
  }

  _applyLayout() {
    if (!this._container) return;
    this._cleanup();
    this._container.querySelectorAll('.viewport-cell').forEach(el => el.remove());

    // Wrap stage elements (main-canvas + z-panel) if not already wrapped
    let stageWrap = this._container.querySelector('.stage-viewport');
    const mainCanvas = document.querySelector('.main-canvas');
    const zPanel = document.getElementById('zVisualizationPanel');

    if (!stageWrap && mainCanvas) {
      stageWrap = document.createElement('div');
      stageWrap.className = 'stage-viewport';
      stageWrap.style.cssText = 'display:flex; flex:1; min-width:0; min-height:0; overflow:hidden;';
      mainCanvas.parentNode.insertBefore(stageWrap, mainCanvas);
      stageWrap.appendChild(mainCanvas);
      if (zPanel) stageWrap.appendChild(zPanel);
    }

    switch (this.layout) {
      case '1':
        this.viewports = [{ id: 0, source: 'stage' }];
        this._container.style.display = 'flex';
        this._container.style.gridTemplateColumns = '';
        this._container.style.gridTemplateRows = '';
        if (stageWrap) stageWrap.style.flex = '1';
        break;
      case '2h':
        this.viewports = [{ id: 0, source: 'stage' }, { id: 1, source: null }];
        this._container.style.display = 'grid';
        this._container.style.gridTemplateColumns = '1fr 1fr';
        this._container.style.gridTemplateRows = '1fr';
        this._createViewportCell(1);
        break;
      case '2v':
        this.viewports = [{ id: 0, source: 'stage' }, { id: 1, source: null }];
        this._container.style.display = 'grid';
        this._container.style.gridTemplateColumns = '1fr';
        this._container.style.gridTemplateRows = '1fr 1fr';
        this._createViewportCell(1);
        break;
      case '4':
        this.viewports = [{ id: 0, source: 'stage' }, { id: 1, source: null }, { id: 2, source: null }, { id: 3, source: null }];
        this._container.style.display = 'grid';
        this._container.style.gridTemplateColumns = '1fr 1fr';
        this._container.style.gridTemplateRows = '1fr 1fr';
        this._createViewportCell(1);
        this._createViewportCell(2);
        this._createViewportCell(3);
        break;
    }
  }

  _createViewportCell(id) {
    const cell = document.createElement('div');
    cell.className = 'viewport-cell';
    cell.dataset.viewportId = id;
    cell.style.cssText = 'position:relative; background:#111; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid #333;';

    const img = document.createElement('img');
    img.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain;';
    cell.appendChild(img);

    // Placeholder
    const ph = document.createElement('div');
    ph.className = 'viewport-placeholder';
    ph.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#555; font-size:11px; cursor:pointer;';
    ph.textContent = 'Clic droit → assigner';
    cell.appendChild(ph);

    // Right-click on this cell → source menu
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showSourceMenu(e.clientX, e.clientY, id);
    });

    this._container.appendChild(cell);
    this._canvases.set(id, { img, cell, ph });
  }

  // === SOURCE ASSIGNMENT ===

  assignSource(viewportId, source) {
    const vp = this.viewports.find(v => v.id === viewportId);
    if (!vp) return;
    vp.source = source;
    const cv = this._canvases.get(viewportId);
    if (cv?.ph) cv.ph.style.display = source ? 'none' : '';
    this._startSourcePolling(viewportId, source);
  }

  _startSourcePolling(viewportId, source) {
    // Stop existing poll for this viewport
    if (this._pollTimers[viewportId]) { clearInterval(this._pollTimers[viewportId]); this._pollTimers[viewportId] = null; }
    if (!source || source === 'stage') return;

    const cv = this._canvases.get(viewportId);
    if (!cv) return;

    // If webcam driver, move its video element directly into viewport
    const camera = window.EnderTrack?.Camera;
    if (camera?.driver?._video && camera.driver._live) {
      cv.img.style.display = 'none';
      const video = camera.driver._video;
      video.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain;';
      cv.cell.insertBefore(video, cv.ph);
      cv._video = video;
      return;
    }

    // Fallback: poll frames as base64 (for MJPEG, simulation, etc.)
    this._pollTimers[viewportId] = setInterval(async () => {
      if (!cv) return;
      const frame = await window.EnderTrack?.Camera?.getFrame();
      if (frame?.frame) {
        cv.img.src = 'data:image/jpeg;base64,' + frame.frame;
      }
    }, 250);
  }

  // === CONTEXT MENUS ===

  _showLayoutMenuFromBtn(btn) {
    const rect = btn.getBoundingClientRect();
    this._showLayoutMenu(rect.left, rect.bottom + 4);
  }

  _showLayoutMenu(x, y) {
    this._removeMenus();
    const menu = this._createMenu(x, y);
    const layouts = [
      { id: '1', label: '⬜ Simple', icon: '1' },
      { id: '2h', label: '◫ Split horizontal', icon: '2H' },
      { id: '2v', label: '⬒ Split vertical', icon: '2V' },
      { id: '4', label: '⊞ Quadrants', icon: '4' }
    ];
    layouts.forEach(l => {
      const row = this._createMenuItem(l.label, l.id === this.layout);
      row.addEventListener('click', () => { this.setLayout(l.id); this._removeMenus(); });
      menu.appendChild(row);
    });
    document.body.appendChild(menu);
    this._autoCloseMenu(menu);
  }

  _showSourceMenu(x, y, viewportId) {
    this._removeMenus();
    const menu = this._createMenu(x, y);

    // Available sources
    const sources = [{ id: null, label: '— Vide —' }];
    // Camera sources
    const cam = window.EnderTrack?.Camera;
    if (cam?.driverName && cam.driverName !== 'simulation') {
      sources.push({ id: 'camera', label: '📷 Camera live' });
    }
    sources.push({ id: 'camera_sim', label: '📷 Camera (simulation)' });

    const vp = this.viewports.find(v => v.id === viewportId);
    sources.forEach(s => {
      const row = this._createMenuItem(s.label, vp?.source === s.id);
      row.addEventListener('click', () => { this.assignSource(viewportId, s.id); this._removeMenus(); });
      menu.appendChild(row);
    });

    // Layout option at bottom
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px; background:#444; margin:4px 8px;';
    menu.appendChild(sep);
    const layoutRow = this._createMenuItem('⊞ Changer layout...');
    layoutRow.addEventListener('click', () => { this._removeMenus(); this._showLayoutMenu(x, y); });
    menu.appendChild(layoutRow);

    document.body.appendChild(menu);
    this._autoCloseMenu(menu);
  }

  _createMenu(x, y) {
    const menu = document.createElement('div');
    menu.className = 'viewport-context-menu';
    menu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:10001; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.5); padding:4px 0; min-width:160px;`;
    return menu;
  }

  _createMenuItem(label, active = false) {
    const row = document.createElement('div');
    row.textContent = (active ? '✓ ' : '  ') + label;
    row.style.cssText = `padding:6px 12px; font-size:11px; cursor:pointer; color:${active ? 'var(--text-selected)' : 'var(--text-general)'}; white-space:nowrap;`;
    row.addEventListener('mouseenter', () => row.style.background = 'var(--app-bg)');
    row.addEventListener('mouseleave', () => row.style.background = '');
    return row;
  }

  _removeMenus() {
    document.querySelectorAll('.viewport-context-menu').forEach(m => m.remove());
  }

  _autoCloseMenu(menu) {
    setTimeout(() => {
      const close = (e) => {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); }
      };
      document.addEventListener('mousedown', close);
    }, 0);
  }

  // === CLEANUP ===

  _cleanup() {
    this._pollTimers.forEach(t => { if (t) clearInterval(t); });
    this._pollTimers = [];
    this._canvases.forEach(cv => cv.cell?.remove());
    this._canvases.clear();
  }

  getStatus() {
    return { layout: this.layout, viewports: this.viewports.map(v => ({ ...v })) };
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Display = new DisplayModule();

// Auto-init after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.Display.init());
} else {
  setTimeout(() => EnderTrack.Display.init(), 100);
}
