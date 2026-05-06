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
    this._container = document.querySelector('.main-canvas');
    if (!this._container) return;
    this._container.style.position = 'relative';

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
    // Clean up live viewports
    this._cleanup();

    // Remove all viewport overlays
    this._container.querySelectorAll('.viewport-cell').forEach(el => el.remove());

    const mainCanvas = document.getElementById('mapCanvas');

    switch (this.layout) {
      case '1':
        this.viewports = [{ id: 0, source: 'stage' }];
        this._container.style.display = '';
        this._container.style.gridTemplateColumns = '';
        this._container.style.gridTemplateRows = '';
        if (mainCanvas) mainCanvas.style.display = '';
        break;
      case '2h':
        this.viewports = [{ id: 0, source: 'stage' }, { id: 1, source: null }];
        this._container.style.display = 'grid';
        this._container.style.gridTemplateColumns = '1fr 1fr';
        this._container.style.gridTemplateRows = '1fr';
        if (mainCanvas) { mainCanvas.style.display = ''; mainCanvas.style.gridColumn = '1'; }
        this._createViewportCell(1);
        break;
      case '2v':
        this.viewports = [{ id: 0, source: 'stage' }, { id: 1, source: null }];
        this._container.style.display = 'grid';
        this._container.style.gridTemplateColumns = '1fr';
        this._container.style.gridTemplateRows = '1fr 1fr';
        if (mainCanvas) { mainCanvas.style.display = ''; mainCanvas.style.gridRow = '1'; }
        this._createViewportCell(1);
        break;
      case '4':
        this.viewports = [{ id: 0, source: 'stage' }, { id: 1, source: null }, { id: 2, source: null }, { id: 3, source: null }];
        this._container.style.display = 'grid';
        this._container.style.gridTemplateColumns = '1fr 1fr';
        this._container.style.gridTemplateRows = '1fr 1fr';
        if (mainCanvas) { mainCanvas.style.display = ''; }
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

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain;';
    cell.appendChild(canvas);

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
    this._canvases.set(id, { canvas, ctx: canvas.getContext('2d'), cell, ph });
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

    this._pollTimers[viewportId] = setInterval(async () => {
      const cv = this._canvases.get(viewportId);
      if (!cv) return;
      const frame = await window.EnderTrack?.Camera?.getFrame();
      if (frame?.frame) {
        const img = new Image();
        img.onload = () => {
          cv.canvas.width = img.width;
          cv.canvas.height = img.height;
          cv.ctx.drawImage(img, 0, 0);
        };
        img.src = 'data:image/jpeg;base64,' + frame.frame;
      }
    }, 200);
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
