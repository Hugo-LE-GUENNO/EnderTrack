// modules/display/display.js — Viewport layout manager

class DisplayModule {
  constructor() {
    this.viewports = [{ id: 0, source: 'stage' }];
    this._container = null;
    this._stageWrap = null;
    this._cells = new Map(); // id → DOM element
    this._videos = new Map(); // id → video element
    this._timers = new Map(); // id → interval
  }

  init() {
    this._container = document.querySelector('.canvas-content');
    if (!this._container) return;

    const mainCanvas = document.querySelector('.main-canvas');
    const zPanel = document.getElementById('zVisualizationPanel');
    if (!mainCanvas) return;

    this._stageWrap = document.createElement('div');
    this._stageWrap.className = 'viewport-cell stage-viewport';
    this._stageWrap.dataset.viewportId = '0';
    this._stageWrap.style.cssText = 'display:flex; min-width:0; min-height:0; overflow:hidden; position:relative; width:100%; height:100%; background:#111;';
    mainCanvas.parentNode.insertBefore(this._stageWrap, mainCanvas);
    this._stageWrap.appendChild(mainCanvas);
    if (zPanel) this._stageWrap.appendChild(zPanel);

    this._stageWrap.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._showSourceMenu(e.clientX, e.clientY, 0);
    });
  }

  // === LAYOUT ===

  setLayout(panelCount) {
    const n = Math.max(1, Math.min(8, parseInt(panelCount) || 1));

    // Adjust viewports array
    while (this.viewports.length < n) {
      this.viewports.push({ id: this.viewports.length, source: null });
    }
    while (this.viewports.length > n) {
      const removed = this.viewports.pop();
      this._destroyCell(removed.id);
    }
    this._rebuildGrid();
  }

  _rebuildGrid() {
    if (!this._container) return;
    const n = this.viewports.length;

    // Destroy all non-stage cells
    for (const [id] of this._cells) {
      this._destroyCell(id);
    }

    // Reset container
    if (n <= 1) {
      this._container.style.display = 'flex';
      this._container.style.gridTemplateColumns = '';
      this._container.style.gridTemplateRows = '';
      this._container.style.height = '';
      if (this._stageWrap) {
        this._stageWrap.style.flex = '1';
        this._stageWrap.style.gridRow = '';
        this._stageWrap.style.gridColumn = '';
      }
      // Ensure stage is back in viewport 0
      this.viewports[0].source = 'stage';
      this._renderSource(0, 'stage');
      return;
    }

    // Grid: 2 columns, rows adapt
    const rows = Math.ceil(n / 2);
    this._container.style.display = 'grid';
    this._container.style.gridTemplateColumns = '1fr 1fr';
    this._container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    this._container.style.height = '100%';

    if (this._stageWrap) {
      this._stageWrap.style.flex = '';
      if (n % 2 === 1) {
        this._stageWrap.style.gridColumn = '1';
        this._stageWrap.style.gridRow = `1 / ${rows + 1}`;
      } else {
        this._stageWrap.style.gridColumn = '';
        this._stageWrap.style.gridRow = '';
      }
    }

    // Other cells
    for (let i = 1; i < n; i++) {
      this._buildCell(i);
      const vp = this.viewports[i];
      if (vp.source) this._renderSource(i, vp.source);
    }

    // Always ensure viewport 0 has its source rendered
    const vp0 = this.viewports[0];
    if (vp0?.source) this._renderSource(0, vp0.source);

    // Trigger canvas resize after layout change
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      window.EnderTrack?.Canvas?.requestRender?.();
    }, 50);
  }

  _buildCell(id) {
    const cell = document.createElement('div');
    cell.className = 'viewport-cell';
    cell.dataset.viewportId = id;
    cell.style.cssText = 'position:relative; background:#111; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid #333; min-width:0; min-height:0;';

    const ph = document.createElement('div');
    ph.className = 'viewport-placeholder';
    ph.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#555; font-size:11px; pointer-events:none;';
    ph.textContent = 'Clic droit \u2192 source';
    cell.appendChild(ph);

    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showSourceMenu(e.clientX, e.clientY, id);
    });

    this._container.appendChild(cell);
    this._cells.set(id, cell);
  }

  _destroyCell(id) {
    // Kill video/timer
    this._killSource(id);
    // Remove DOM
    const cell = this._cells.get(id);
    if (cell) { cell.remove(); this._cells.delete(id); }
  }

  _killSource(id) {
    const video = this._videos.get(id);
    if (video) { video.srcObject = null; video.remove(); this._videos.delete(id); }
    const timer = this._timers.get(id);
    if (timer) { cancelAnimationFrame(timer); clearInterval(timer); this._timers.delete(id); }
    // Stop LiveRenderer
    window.EnderTrack?.LiveRenderer?.stop?.();
    // Remove live canvas
    const cell = id === 0 ? this._stageWrap : this._cells.get(id);
    if (cell) {
      const liveCanvas = cell.querySelector('#liveDisplayCanvas');
      if (liveCanvas) liveCanvas.remove();
      const liveOverlay = cell.querySelector('#liveOverlayBadge');
      if (liveOverlay) liveOverlay.remove();
      const gw = cell.querySelector('.gallery-viewport-wrap');
      if (gw) gw.remove();
      const sw = cell.querySelector('.stack-viewport-wrap');
      if (sw) sw.remove();
    }
  }

  // === SOURCE ASSIGNMENT ===

  assignSource(viewportId, source) {
    const vp = this.viewports.find(v => v.id === viewportId);
    if (!vp) return;
    if (vp.source === source) return;

    // Swap if source already used elsewhere
    const other = this.viewports.find(v => v.id !== viewportId && v.source === source);
    if (other) {
      const oldSource = vp.source;
      other.source = oldSource;
      this._killSource(other.id);
      this._renderSource(other.id, oldSource);
    }

    vp.source = source;
    this._killSource(viewportId);
    this._renderSource(viewportId, source);
  }

  _renderSource(viewportId, source) {
    const cell = viewportId === 0 ? this._stageWrap : this._cells.get(viewportId);
    if (!cell) return;

    // Stage source: move main-canvas + z-panel into this cell
    if (source === 'stage') {
      const mainCanvas = document.querySelector('.main-canvas');
      const zPanel = document.getElementById('zVisualizationPanel');
      if (mainCanvas) {
        cell.appendChild(mainCanvas);
        mainCanvas.style.display = '';
        if (zPanel) cell.appendChild(zPanel);
      }
      // Hide placeholder
      const ph = cell.querySelector(".viewport-placeholder");
      if (ph) ph.style.display = 'none';
      setTimeout(() => { window.dispatchEvent(new Event('resize')); EnderTrack.Canvas?.requestRender?.(); }, 50);
      return;
    }

    // Camera source: video + processed canvas (LUT/contrast via LiveRenderer)
    if (source && source.startsWith('camera')) {
      const camera = window.EnderTrack?.Camera;
      const camIdx = parseInt(source.split(':')[1]) || 0;
      const camConfig = (window._cameras || [])[camIdx];

      const _createLiveView = () => {
        const isMjpeg = camera?.driverName === 'mjpeg';
        const hasStream = camera?.driver?._stream;
        const hasImg = camera?.driver?._img;
        if (!hasStream && !hasImg) return;

        // LIVE / REC overlay
        const overlay = document.createElement('div');
        overlay.id = 'liveOverlayBadge';
        overlay.style.cssText = 'position:absolute; top:8px; left:8px; z-index:20; display:flex; gap:6px; pointer-events:none;';
        overlay.innerHTML = '<span id="liveBadge" style="padding:2px 6px; border-radius:3px; font-size:9px; font-weight:600; background:rgba(34,197,94,0.85); color:#000;">LIVE</span>';
        cell.appendChild(overlay);
        this._liveOverlay = overlay;

        if (isMjpeg) {
          // MJPEG: display img directly in viewport (reliable live update)
          const liveImg = camera.driver._img;
          liveImg.style.cssText = 'width:100%; height:100%; object-fit:contain; background:#000;';
          cell.appendChild(liveImg);
          // Double-click fullscreen
          liveImg.ondblclick = () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else cell.requestFullscreen?.();
          };
          // Also create a hidden canvas for LiveRenderer (LUT/contrast processing)
          const canvas = document.createElement('canvas');
          canvas.id = 'liveDisplayCanvas';
          canvas.style.cssText = 'width:100%; height:100%; object-fit:contain; background:#000; image-rendering:pixelated; display:none;';
          cell.appendChild(canvas);
          // LiveRenderer: when enabled (LUT active), switch to canvas mode
          const liveRenderer = window.EnderTrack?.LiveRenderer;
          if (liveRenderer) {
            liveRenderer.setVideo(null);
            liveRenderer.setImage(liveImg);
            liveRenderer.setCanvas(canvas);
            liveRenderer._liveImg = liveImg; // ref for toggling
            liveRenderer.start();
            // Override _renderFrame to toggle img/canvas visibility
            const origRender = liveRenderer._renderFrame.bind(liveRenderer);
            liveRenderer._renderFrame = () => {
              if (liveRenderer.enabled) {
                liveImg.style.display = 'none';
                canvas.style.display = '';
                origRender();
              } else {
                canvas.style.display = 'none';
                liveImg.style.display = '';
              }
            };
          }
        } else {
          // Webcam: hidden video + canvas via LiveRenderer
          const canvas = document.createElement('canvas');
          canvas.id = 'liveDisplayCanvas';
          canvas.style.cssText = 'width:100%; height:100%; object-fit:contain; background:#000; image-rendering:pixelated;';
          cell.appendChild(canvas);
          canvas.ondblclick = () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else canvas.requestFullscreen?.();
          };
          const video = document.createElement('video');
          video.autoplay = true; video.muted = true; video.playsInline = true;
          video.style.cssText = 'position:absolute; opacity:0; pointer-events:none; width:0; height:0;';
          video.srcObject = camera.driver._stream;
          cell.appendChild(video);
          video.play().catch(() => {});
          this._videos.set(viewportId, video);
          const liveRenderer = window.EnderTrack?.LiveRenderer;
          if (liveRenderer) {
            liveRenderer.setImage(null);
            liveRenderer.setVideo(video);
            liveRenderer.setCanvas(canvas);
            liveRenderer.start();
          }
        }
      };

      const _ensureLive = () => {
        const isMjpeg = camera?.driverName === 'mjpeg';
        if (isMjpeg && camera?.driver?._img) {
          _createLiveView();
        } else if (camera?.driver?._stream) {
          _createLiveView();
        } else if (camera && camera.driver) {
          camera.startLive().then(() => setTimeout(_createLiveView, 300));
        }
      };
      _ensureLive();
      // Hide placeholder
      const ph = cell.querySelector(".viewport-placeholder");
      if (ph) ph.style.display = 'none';
      return;
    }

    // Gallery source
    if (source === 'gallery') {
      const ph = cell.querySelector(".viewport-placeholder");
      if (ph) ph.style.display = 'none';
      window.EnderTrack?.ImageManager?.renderInViewport?.(cell);
      return;
    }

    // Stack source
    if (source === 'stack') {
      const ph = cell.querySelector(".viewport-placeholder");
      if (ph) ph.style.display = 'none';
      window.EnderTrack?.StackViewer?.renderInViewport?.(cell);
      return;
    }

    // No source — show placeholder
    const ph = cell.querySelector(".viewport-placeholder");
    if (ph) ph.style.display = '';
  }

  // === CONTEXT MENUS ===

  _showSourceMenu(x, y, viewportId) {
    this._removeMenus();
    const menu = document.createElement('div');
    menu.className = 'viewport-context-menu';
    menu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:10001; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.5); padding:4px 0; min-width:140px;`;

    const sources = [{ id: 'stage', label: '\ud83d\udccd Platine XYZ' }];
    (window._cameras || []).forEach((c, i) => {
      sources.push({ id: 'camera:' + i, label: '\ud83d\udcf7 ' + c.label });
    });
    sources.push({ id: 'gallery', label: '\ud83d\uddbc Galerie' });

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
