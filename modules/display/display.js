// modules/display/display.js — Viewport layout manager

class DisplayModule {
  constructor() {
    this.viewports = [{ id: 0, sources: ['stage'] }];
    this._gridWrap = null;   // container des viewports (remplace canvas-content comme parent de grille)
    this._stageWrap = null;  // viewport 0
    this._container = null;  // canvas-content (XY+Z) — jamais restructuré
    this._cells = new Map(); // id → DOM element (viewports 1+)
    this._videos = new Map();
    this._timers = new Map();
  }

  init() {
    this._container = document.querySelector('.canvas-content');
    if (!this._container) return;

    // _gridWrap remplace canvas-content dans le flux DOM
    this._gridWrap = document.createElement('div');
    this._gridWrap.className = 'viewport-grid';
    this._gridWrap.style.cssText = 'display:flex; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden;';
    this._container.parentNode.insertBefore(this._gridWrap, this._container);

    // _stageWrap = viewport 0, contient canvas-content
    this._stageWrap = document.createElement('div');
    this._stageWrap.className = 'viewport-cell stage-viewport';
    this._stageWrap.dataset.viewportId = '0';
    this._stageWrap.style.cssText = 'display:flex; flex:1; min-width:0; min-height:0; overflow:hidden; position:relative; background:#111;';
    this._stageWrap.appendChild(this._container);
    this._gridWrap.appendChild(this._stageWrap);

    this._stageWrap.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showSourceMenu(e.clientX, e.clientY, 0);
    }, true);
    this._stageWrap.addEventListener('dblclick', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else this._stageWrap.requestFullscreen?.();
    });
  }

  // === LAYOUT ===

  setLayout(panelCount) {
    const n = Math.max(1, Math.min(8, parseInt(panelCount) || 1));
    while (this.viewports.length < n)
      this.viewports.push({ id: this.viewports.length, sources: [] });
    while (this.viewports.length > n) {
      const removed = this.viewports.pop();
      this._destroyCell(removed.id);
    }
    this._rebuildGrid();
  }

  _rebuildGrid() {
    if (!this._gridWrap) return;
    const n = this.viewports.length;

    // Destroy all secondary cells
    for (const [id] of this._cells) this._destroyCell(id);

    if (n <= 1) {
      this._gridWrap.style.display = 'flex';
      this._gridWrap.style.gridTemplateColumns = '';
      this._gridWrap.style.gridTemplateRows = '';
      this._stageWrap.style.flex = '1';
      this._stageWrap.style.gridColumn = '';
      this._stageWrap.style.gridRow = '';
      this._renderSources(0);
      return;
    }

    const rows = Math.ceil(n / 2);
    this._gridWrap.style.display = 'grid';
    this._gridWrap.style.gridTemplateColumns = '1fr 1fr';
    this._gridWrap.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    this._stageWrap.style.flex = '';
    if (n % 2 === 1) {
      this._stageWrap.style.gridColumn = '1';
      this._stageWrap.style.gridRow = `1 / ${rows + 1}`;
    } else {
      this._stageWrap.style.gridColumn = '';
      this._stageWrap.style.gridRow = '';
    }

    for (let i = 1; i < n; i++) {
      this._buildCell(i);
      this._renderSources(i);
    }
    this._renderSources(0);

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      window.EnderTrack?.Canvas?.requestRender?.();
    }, 50);
  }

  _buildCell(id) {
    const cell = document.createElement('div');
    cell.className = 'viewport-cell';
    cell.dataset.viewportId = id;
    cell.style.cssText = 'position:relative; background:#111; display:flex; flex-direction:column; overflow:hidden; border:1px solid #333; min-width:0; min-height:0;';

    const ph = document.createElement('div');
    ph.className = 'viewport-placeholder';
    ph.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#555; font-size:11px; pointer-events:none;';
    ph.textContent = 'Right-click \u2192 source';
    cell.appendChild(ph);

    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showSourceMenu(e.clientX, e.clientY, id);
    }, true);
    cell.addEventListener('dblclick', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else cell.requestFullscreen?.();
    });

    this._gridWrap.appendChild(cell);
    this._cells.set(id, cell);
  }

  _destroyCell(id) {
    this._killSources(id);
    const cell = this._cells.get(id);
    if (cell) { cell.remove(); this._cells.delete(id); }
  }

  // === SOURCE KILL ===

  _killSource(viewportId, source) {
    const cell = viewportId === 0 ? this._stageWrap : this._cells.get(viewportId);
    if (!cell) return;

    if (source === 'stage') {
      this._container.style.display = 'none';
      // Remettre dans _stageWrap par défaut
      if (!this._stageWrap.contains(this._container))
        this._stageWrap.appendChild(this._container);
      return;
    }

    if (source.startsWith('camera')) {
      const video = this._videos.get(viewportId);
      if (video) { video.srcObject = null; video.remove(); this._videos.delete(viewportId); }
      const timer = this._timers.get(viewportId);
      if (timer) { cancelAnimationFrame(timer); clearInterval(timer); this._timers.delete(viewportId); }
      window.EnderTrack?.LiveRenderer?.stop?.();
      cell.querySelector('#liveDisplayCanvas')?.remove();
      cell.querySelector('#liveOverlayBadge')?.remove();
      const liveImg = window.EnderTrack?.Camera?.driver?._img;
      if (liveImg && cell.contains(liveImg)) liveImg.remove();
      return;
    }

    if (source === 'stack') {
      cell.querySelector('.stack-viewport-wrap')?.remove();
      return;
    }

    // Moveable element — restore to original position
    const el = this._getMoveableEl(source);
    if (el?._movedToViewport === source) {
      el.style.width = ''; el.style.height = ''; el.style.flex = '';
      el.style.margin = ''; el.style.boxSizing = ''; el.style.borderRadius = '';
      if (el._originalParent) el._originalParent.insertBefore(el, el._originalNextSibling || null);
      delete el._movedToViewport; delete el._originalParent; delete el._originalNextSibling;
    }
  }

  _killSources(viewportId) {
    const vp = this.viewports.find(v => v.id === viewportId);
    for (const s of (vp ? [...vp.sources] : [])) this._killSource(viewportId, s);

    const cell = viewportId === 0 ? this._stageWrap : this._cells.get(viewportId);
    if (cell) {
      cell.querySelectorAll('*').forEach(el => {
        if (el._movedToViewport) {
          el.style.width = ''; el.style.height = ''; el.style.flex = '';
          el.style.margin = ''; el.style.boxSizing = '';
          if (el._originalParent) el._originalParent.insertBefore(el, el._originalNextSibling || null);
          delete el._movedToViewport; delete el._originalParent; delete el._originalNextSibling;
        }
      });
      cell.querySelectorAll('img').forEach(img => {
        const liveImg = window.EnderTrack?.Camera?.driver?._img;
        if (img !== liveImg) img.remove();
      });
      cell.querySelector('.gallery-viewport-wrap')?.remove();
      cell.querySelector('.stack-viewport-wrap')?.remove();
    }
    this._autoCollapseRightPanel();
  }

  // === SOURCE TOGGLE ===

  toggleSource(viewportId, source) {
    const vp = this.viewports.find(v => v.id === viewportId);
    if (!vp) return;

    const idx = vp.sources.indexOf(source);
    if (idx !== -1) {
      this._killSource(viewportId, source);
      vp.sources.splice(idx, 1);
    } else {
      // Remove from another viewport if already used
      for (const other of this.viewports) {
        if (other.id !== viewportId && other.sources.includes(source)) {
          this._killSource(other.id, source);
          other.sources.splice(other.sources.indexOf(source), 1);
          this._applyLayout(other.id);
        }
      }
      vp.sources.push(source);
      this._renderOneSource(viewportId, source);
    }
    this._applyLayout(viewportId);
    this._autoCollapseRightPanel();
  }

  // === RENDER ===

  _renderSources(viewportId) {
    const vp = this.viewports.find(v => v.id === viewportId);
    if (!vp) return;
    for (const s of vp.sources) this._renderOneSource(viewportId, s);
    this._applyLayout(viewportId);
  }

  _applyLayout(viewportId) {
    const cell = viewportId === 0 ? this._stageWrap : this._cells.get(viewportId);
    const vp = this.viewports.find(v => v.id === viewportId);
    if (!cell || !vp) return;

    const ph = cell.querySelector('.viewport-placeholder');
    if (!vp.sources.length) {
      if (ph) ph.style.display = '';
      return;
    }
    if (ph) ph.style.display = 'none';

    const isExpanding = s => s === 'stage' || s.startsWith('camera') || s === 'stack';
    vp.sources.forEach(source => {
      const el = this._getRenderedEl(cell, source);
      if (!el) return;
      if (isExpanding(source)) {
        el.style.flex = '1 1 0';
        el.style.minHeight = '0';
        el.style.width = '100%';
      } else {
        el.style.flex = '0 0 auto';
        el.style.width = '100%';
      }
    });
  }

  _getRenderedEl(cell, source) {
    if (source === 'stage') return this._container; // canvas-content entier
    if (source.startsWith('camera')) return cell.querySelector('#liveDisplayCanvas') || cell.querySelector('video') || cell.querySelector('img:not([id])');
    if (source === 'stack') return cell.querySelector('.stack-viewport-wrap');
    return this._getMoveableEl(source);
  }

  _renderOneSource(viewportId, source) {
    const cell = viewportId === 0 ? this._stageWrap : this._cells.get(viewportId);
    if (!cell) return;

    if (source === 'stage') {
      // Déplacer canvas-content dans la bonne cell
      if (!cell.contains(this._container))
        cell.appendChild(this._container);
      this._container.style.display = '';
      setTimeout(() => { window.dispatchEvent(new Event('resize')); EnderTrack.Canvas?.requestRender?.(); }, 50);
      return;
    }

    if (source.startsWith('camera')) {
      const camera = window.EnderTrack?.Camera;

      const _createLiveView = () => {
        const isMjpeg = camera?.driverName === 'mjpeg';
        if (!camera?.driver?._stream && !camera?.driver?._img) return;

        const overlay = document.createElement('div');
        overlay.id = 'liveOverlayBadge';
        overlay.style.cssText = 'position:absolute; top:8px; left:8px; z-index:20; display:flex; gap:6px; pointer-events:none;';
        overlay.innerHTML = '<span style="padding:2px 6px; border-radius:3px; font-size:9px; font-weight:600; background:rgba(34,197,94,0.85); color:#000;">LIVE</span>';
        cell.appendChild(overlay);

        if (isMjpeg) {
          const liveImg = camera.driver._img;
          liveImg.style.cssText = 'width:100%; object-fit:contain; background:#000;';
          liveImg.ondblclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else cell.requestFullscreen?.(); };
          cell.appendChild(liveImg);
          const canvas = document.createElement('canvas');
          canvas.id = 'liveDisplayCanvas';
          canvas.style.cssText = 'width:100%; object-fit:contain; background:#000; image-rendering:pixelated; display:none;';
          cell.appendChild(canvas);
          const lr = window.EnderTrack?.LiveRenderer;
          if (lr) {
            lr.setVideo(null); lr.setImage(liveImg); lr.setCanvas(canvas); lr._liveImg = liveImg; lr.start();
            lr._renderFrame = () => {
              if (lr.enabled) { liveImg.style.display = 'none'; canvas.style.display = ''; lr._nativeRenderFrame(); }
              else { canvas.style.display = 'none'; liveImg.style.display = ''; }
            };
          }
        } else {
          const video = document.createElement('video');
          video.autoplay = true; video.muted = true; video.playsInline = true;
          video.style.cssText = 'width:100%; object-fit:contain; background:#000;';
          video.srcObject = camera.driver._stream;
          video.ondblclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else cell.requestFullscreen?.(); };
          cell.appendChild(video);
          video.play().catch(() => {});
          if (camera.driver) camera.driver._grabVideo = video;
          this._videos.set(viewportId, video);
          const canvas = document.createElement('canvas');
          canvas.id = 'liveDisplayCanvas';
          canvas.style.cssText = 'width:100%; object-fit:contain; background:#000; display:none;';
          cell.appendChild(canvas);
          const lr = window.EnderTrack?.LiveRenderer;
          if (lr) {
            lr.setImage(null); lr.setVideo(video); lr.setCanvas(canvas); lr.start();
            lr._renderFrame = () => {
              if (lr.enabled) { video.style.display = 'none'; canvas.style.display = 'block'; lr._nativeRenderFrame(); }
              else { canvas.style.display = 'none'; video.style.display = ''; }
            };
          }
        }
      };

      const isMjpeg = camera?.driverName === 'mjpeg';
      if (isMjpeg && camera?.driver?._img) _createLiveView();
      else if (camera?.driver?._stream) _createLiveView();
      else if (camera?.driver) camera.startLive().then(() => setTimeout(_createLiveView, 300));
      return;
    }

    if (source === 'stack') {
      window.EnderTrack?.StackViewer?.renderInViewport?.(cell);
      return;
    }

    // Moveable element
    const el = this._getMoveableEl(source);
    if (el) {
      el._originalParent = el.parentNode;
      el._originalNextSibling = el.nextSibling;
      el._movedToViewport = source;
      cell.appendChild(el);
    }
  }

  // === MOVEABLE ELEMENTS ===

  _getMoveableEl(source) {
    if (!source) return null;
    if (source.startsWith('plugin:')) {
      const [, pluginId, outputId] = source.split(':');
      return document.getElementById(`pyplugin-out-${pluginId}-${outputId}`);
    }
    if (source === 'live:histogram') return document.getElementById('enderpicam-histogram');
    if (source === 'status') return document.querySelector('.status-widget');
    return null;
  }

  // === RIGHT PANEL COLLAPSE ===

  toggleRightPanel(force) {
    const panel = document.querySelector('.right-panel');
    if (!panel) return;
    const collapsed = force !== undefined ? !force : !panel.classList.contains('collapsed');
    panel.classList.toggle('collapsed', collapsed);
    const btn = document.getElementById('rightPanelCollapseBtn');
    if (btn) btn.textContent = collapsed ? '\u2039' : '\u203a';
    setTimeout(() => { window.dispatchEvent(new Event('resize')); window.EnderTrack?.Canvas?.requestRender?.(); }, 220);
  }

  _autoCollapseRightPanel() {
    const panel = document.querySelector('.right-panel');
    if (!panel) return;
    const activeZone = panel.querySelector('.right-plugin-zone:not([style*="display:none"]):not([style*="display: none"])');
    if (!activeZone) return;
    const children = [...activeZone.children];
    if (!children.length) return;
    const allMoved = children.every(child =>
      [...child.querySelectorAll('[id^="pyplugin-out-"]')].every(el => el._movedToViewport)
    );
    const hasStatus = !!panel.querySelector('.status-widget');
    const hasHist = !!document.getElementById('enderpicam-histogram');
    const statusMoved = panel.querySelector('.status-widget')?._movedToViewport;
    const histMoved = document.getElementById('enderpicam-histogram')?._movedToViewport;

    if (allMoved && (!hasStatus || statusMoved) && (!hasHist || histMoved)) {
      if (!panel.classList.contains('collapsed')) { panel._autoCollapsed = true; this.toggleRightPanel(false); }
    } else if (panel._autoCollapsed) {
      panel._autoCollapsed = false; this.toggleRightPanel(true);
    }
  }

  // === CONTEXT MENU ===

  _showSourceMenu(x, y, viewportId) {
    this._removeMenus();
    const menu = document.createElement('div');
    menu.className = 'viewport-context-menu';
    menu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:10001; background:var(--container-bg); border:1px solid #555; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.5); padding:4px 0; min-width:160px;`;

    const header = document.createElement('div');
    header.textContent = `Panel ${viewportId}`;
    header.style.cssText = 'padding:4px 12px 6px; font-size:10px; color:var(--text-general); text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #444; margin-bottom:2px;';
    menu.appendChild(header);

    const sources = [{ id: 'stage', label: 'Stage XYZ' }];
    (window._cameras || []).forEach((c, i) => sources.push({ id: 'camera:' + i, label: c.label }));
    if (document.getElementById('enderpicam-histogram'))
      sources.push({ id: 'live:histogram', label: 'Live \u2014 Histogram' });
    if (document.querySelector('.status-widget'))
      sources.push({ id: 'status', label: 'Status' });
    const plugins = window.EnderTrack?.PyPluginUI?._plugins || {};
    for (const [pid, entry] of Object.entries(plugins))
      for (const [, def] of Object.entries(entry.ui?.sections || {}))
        for (const out of (def.outputs || []))
          sources.push({ id: `plugin:${pid}:${out.id}`, label: `${entry.ui.name} \u2014 ${out.label || out.id}` });

    const vp = this.viewports.find(v => v.id === viewportId);
    sources.forEach(s => {
      const active = vp?.sources.includes(s.id);
      const row = document.createElement('div');
      row.textContent = (active ? '\u2713 ' : '  ') + s.label;
      row.style.cssText = `padding:6px 12px; font-size:11px; cursor:pointer; color:${active ? 'var(--text-selected)' : 'var(--text-general)'}; white-space:nowrap;`;
      row.addEventListener('mouseenter', () => row.style.background = 'var(--app-bg)');
      row.addEventListener('mouseleave', () => row.style.background = '');
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSource(viewportId, s.id);
        const nowActive = this.viewports.find(v => v.id === viewportId)?.sources.includes(s.id);
        row.textContent = (nowActive ? '\u2713 ' : '  ') + s.label;
        row.style.color = nowActive ? 'var(--text-selected)' : 'var(--text-general)';
      });
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
      row.textContent = (n === current ? '\u2713 ' : '  ') + n + (n === 1 ? ' panel' : ' panels');
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

  // Backward compat — assignSource remplace toutes les sources par une seule
  assignSource(viewportId, source) {
    const vp = this.viewports.find(v => v.id === viewportId);
    if (!vp) return;
    this._killSources(viewportId);
    vp.sources = [];
    if (source) {
      vp.sources.push(source);
      this._renderSources(viewportId);
    } else {
      this._applyLayout(viewportId);
    }
    this._autoCollapseRightPanel();
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
