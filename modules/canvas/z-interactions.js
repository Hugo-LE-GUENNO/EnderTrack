// modules/canvas/z-interactions.js - Z canvas interactions (V2)

class ZInteractions {
  constructor(zVisualization) {
    this.zVis = zVisualization;
    this.isDragging = false;
    this._zPanning = false;
    this._zDragMoved = false;
    this._hoveredListPoint = null;
    this.lastMouseY = 0;
    this.dragStartY = 0;
  }

  // ── Setup ──────────────────────────────────────────────────

  setupEventListeners() {
    const c = this.zVis.canvas;
    if (!c) return console.warn('⚠️ Z-canvas not found for event listeners');

    c.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    c.addEventListener('mousedown', (e) => this._onMouseDown(e));
    c.addEventListener('mousemove', (e) => this._onMouseMove(e));
    c.addEventListener('mouseup', () => this._onMouseUp());
    c.addEventListener('mouseleave', () => this._onMouseLeave());
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    // Delayed click to distinguish single-click from double-click
    let clickTimer = null;
    c.addEventListener('click', (e) => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
      clickTimer = setTimeout(() => { clickTimer = null; this._onClick(e); }, 250);
    });
    c.addEventListener('dblclick', () => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    });
  }

  // ── Coordinate helpers ─────────────────────────────────────

  _zInverted() {
    const orient = window.EnderTrack.State.get().axisOrientation?.z || 'up';
    return orient === 'down' ? -1 : 1;
  }

  _canvasYToZ(canvasY) {
    const inv = this._zInverted();
    return this.zVis.zPan + inv * (0.5 - canvasY / this.zVis.canvas.height) * this.zVis.zRange;
  }

  _zToCanvasY(z) {
    const inv = this._zInverted();
    const halfRange = this.zVis.zRange / 2;
    return this.zVis.canvas.height / 2 - (inv * (z - this.zVis.zPan) / halfRange) * (this.zVis.canvas.height / 2);
  }

  _canvasCoords(e) {
    const r = this.zVis.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ── Mouse events ───────────────────────────────────────────

  _onWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    // Trackpad 2-finger scroll → pan
    if (!e.ctrlKey && !e.metaKey && e.deltaMode === 0 && Math.abs(e.deltaY) < 50 && !Number.isInteger(e.deltaY)) {
      this.zVis.zPan -= e.deltaY * 0.1;
      window.EnderTrack.State.update({ zPan: this.zVis.zPan });
      this.zVis.render();
      return;
    }

    // Zoom centered on current Z position
    const state = window.EnderTrack.State.get();
    const dims = state.plateauDimensions || { z: 100 };
    const minZoom = this.zVis.canvas.height / dims.z;
    const curZoom = state.zZoom || minZoom;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(minZoom, Math.min(1000, curZoom * factor));

    this.zVis.zPan = state.pos?.z || 0;
    this.zVis.zRange = this.zVis.canvas.height / newZoom;
    window.EnderTrack.State.update({ zZoom: newZoom, zPan: this.zVis.zPan });
    this.zVis.render();
  }

  _onMouseDown(e) {
    this.isDragging = true;
    this._zDragMoved = false;
    this._zPanning = false;
    this.lastMouseY = e.clientY;
    this.dragStartY = e.clientY;
  }

  _onMouseMove(e) {
    const { x, y } = this._canvasCoords(e);

    if (!this.isDragging) this._updateMouseZ(y);

    this._checkCompassHover(x, y);
    this._checkListPointHover(x, y);
    this._updateCursor(y);

    if (this.isDragging) {
      if (!this._zPanning && Math.abs(e.clientY - this.dragStartY) > 3) {
        this._zPanning = true;
        this._zDragMoved = true;
        this.zVis.canvas.style.cursor = 'grabbing';
      }
      if (this._zPanning) this._pan(e);
    } else {
      this.zVis.updateZInfo(window.EnderTrack.State.get());
    }
  }

  _onMouseUp() {
    if (this._zPanning) this.zVis.canvas.style.cursor = '';
    this.isDragging = false;
    this._zPanning = false;
  }

  _onMouseLeave() {
    this.isDragging = false;
    this.zVis.canvas.style.cursor = '';
    this.zVis.canvas.classList.add('crosshair-cursor');
    this.zVis.mouseZ = null;
    this._hoveredListPoint = null;
    this.zVis.updateZInfo(window.EnderTrack.State.get());
  }

  _updateMouseZ(canvasY) {
    this.zVis.mouseZ = Math.round(this._canvasYToZ(canvasY) * 100) / 100;
  }

  // ── Pan & Zoom ─────────────────────────────────────────────

  _pan(e) {
    const state = window.EnderTrack.State.get();
    const deltaY = e.clientY - this.lastMouseY;
    const zMove = this._zInverted() * (deltaY / this.zVis.canvas.height) * this.zVis.zRange;
    const bounds = state.coordinateBounds || { z: { min: -20, max: 80 } };
    const margin = this.zVis.zRange / 4;

    this.zVis.zPan = Math.max(
      bounds.z.min + margin,
      Math.min(bounds.z.max - margin, this.zVis.zPan + zMove)
    );
    window.EnderTrack.State.update({ zPan: this.zVis.zPan });
    this.lastMouseY = e.clientY;
    this.zVis.render();
  }

  fitToView() {
    const state = window.EnderTrack.State.get();
    const bounds = state.coordinateBounds || { z: { min: -20, max: 80 } };
    const zRange = bounds.z.max - bounds.z.min;
    const effectiveH = this.zVis.canvas.height * 0.9; // 5% margin top+bottom
    const zoom = effectiveH / zRange;
    const center = (bounds.z.min + bounds.z.max) / 2;

    this.zVis.zPan = center;
    this.zVis.zRange = this.zVis.canvas.height / zoom;
    window.EnderTrack.State.update({ zZoom: zoom, zPan: center });
    this.zVis.render();
  }

  // ── Click handling ─────────────────────────────────────────

  _onClick(e) {
    if (this._zDragMoved) { this._zDragMoved = false; return; }
    if (e.button !== 0) return;

    const { x, y } = this._canvasCoords(e);

    // Priority 1: compass
    if (this._isOverCompass(x, y)) { this.fitToView(); return; }

    // Priority 2: history point
    if (this._clickHistoryPoint(y)) return;

    // Priority 3: list point
    const hit = this._hitTestListPoint(x, y);
    if (hit) {
      const Lists = window.EnderTrack?.Lists;
      if (Lists?.isActive && Lists.currentMode === 'click') {
        Lists.selectPoint(hit.idx);
      } else {
        this._showPointDialog(hit, e.clientX, e.clientY);
      }
      return;
    }

    // Priority 4: list click mode — add point at current XY + clicked Z
    const Lists = window.EnderTrack?.Lists;
    if (Lists?.isActive && Lists.currentMode === 'click') {
      const ci = window.EnderTrack?.CanvasInteractions;
      if (ci?._dragMoved || Date.now() - (ci?._lastPanTime || 0) < 500) return;
      if (this.zVis.mouseZ !== null && this._isMouseZValid()) {
        const pos = window.EnderTrack.State.get().pos;
        Lists.addPosition(pos.x, pos.y, this.zVis.mouseZ);
      }
      return;
    }

    // Priority 5: scenario executing — block
    if (window.EnderTrack?.Scenario?.isExecuting) return;

    // Priority 6: click-and-go
    this._clickAndGo(e);
  }

  _clickAndGo(e) {
    const state = window.EnderTrack.State.get();
    if (state.historyMode || state.lockZ) return;

    if (!this._isMouseZValid()) {
      window.EnderTrack?.UI?.showNotification?.('Position Z non autorisée', 'warning');
      return;
    }

    if (this.zVis.mouseZ !== null) {
      const inputZ = document.getElementById('inputZ');
      if (inputZ) {
        inputZ.value = this.zVis.mouseZ.toFixed(2);
        inputZ.dispatchEvent(new Event('input', { bubbles: true }));
        window.updateGetButtonStates?.();
        setTimeout(() => this.zVis.render(), 10);
      }
      this.zVis.showZClickDialog(this.zVis.mouseZ, e.clientX, e.clientY);
    }
  }

  _clickHistoryPoint(canvasY) {
    const state = window.EnderTrack.State.get();
    if (!state.historyMode || !state.positionHistory) return false;

    const finals = state.positionHistory.filter(p => p.isFinalPosition);
    for (let i = 0; i < finals.length; i++) {
      if (Math.abs(canvasY - this._zToCanvasY(finals[i].z)) <= 8) {
        window.EnderTrack.State.goToHistoryPosition(i);
        return true;
      }
    }
    return false;
  }

  // ── List point hit-testing ─────────────────────────────────

  _getVisibleGroups() {
    const Lists = window.EnderTrack?.Lists;
    if (!Lists?.groups) return [];
    const tab = window.EnderTrack.State.get().activeTab;
    return Lists.groups.filter(g => {
      if (!g.positions?.length) return false;
      return (tab === 'lists') ? g.id === Lists.activeGroupId : g.pinned;
    });
  }

  _hitTestListPoint(canvasX, canvasY) {
    const canvas = this.zVis.canvas;
    const halfRange = this.zVis.zRange / 2;
    const inv = this._zInverted();

    for (const g of this._getVisibleGroups()) {
      // Group points by Z level
      const byZ = new Map();
      g.positions.forEach((p, idx) => {
        const key = Math.round(p.z * 100);
        if (!byZ.has(key)) byZ.set(key, []);
        byZ.get(key).push({ p, idx });
      });

      for (const [zKey, points] of byZ) {
        const y = canvas.height / 2 - (inv * (zKey / 100 - this.zVis.zPan) / halfRange) * (canvas.height / 2);
        const spacing = Math.min(12.5, (canvas.width - 20) / Math.max(points.length, 1));
        const startX = canvas.width / 2 - ((points.length - 1) * spacing) / 2;

        for (let i = 0; i < points.length; i++) {
          if (Math.hypot(canvasX - (startX + i * spacing), canvasY - y) <= 10) {
            return { ...points[i].p, idx: points[i].idx, group: g };
          }
        }
      }
    }
    return null;
  }

  _checkListPointHover(canvasX, canvasY) {
    const hit = this._hitTestListPoint(canvasX, canvasY);
    this._hoveredListPoint = hit;

    const Lists = window.EnderTrack?.Lists;
    if (Lists && hit) {
      const g = Lists._activeGroup?.();
      if (g) {
        const idx = g.positions.findIndex(p => p.x === hit.x && p.y === hit.y && p.z === hit.z);
        if (idx >= 0) Lists.hoverPoint(idx);
      }
    } else if (Lists) {
      Lists.hoverPoint(null);
    }
    this.zVis.render();
  }

  _showPointDialog(hit, screenX, screenY) {
    document.querySelector('.click-and-go-dialog')?.remove();
    const dialog = document.createElement('div');
    dialog.className = 'click-and-go-dialog';
    dialog.style.cssText = `position:fixed; left:${screenX + 10}px; top:${screenY - 60}px; z-index:10000; background:var(--container-bg); border:1px solid #444; border-radius:6px; padding:10px; box-shadow:0 4px 16px rgba(0,0,0,0.5); min-width:120px;`;
    dialog.innerHTML = `
      <div style="margin-bottom:6px; font-weight:600; font-size:12px; color:var(--text-selected);">📍 ${hit.group?.name || 'Position'} #${hit.idx + 1}</div>
      <div style="font-family:monospace; font-size:11px; color:var(--coordinates-color); margin-bottom:8px;">
        X ${hit.x.toFixed(2)} &nbsp; Y ${hit.y.toFixed(2)} &nbsp; Z ${hit.z.toFixed(2)}
      </div>
      <button style="width:100%; padding:6px; border:none; border-radius:4px; cursor:pointer; font-size:11px; background:var(--active-element); color:var(--text-selected); font-weight:500;">Go</button>`;
    document.body.appendChild(dialog);

    dialog.querySelector('button').onclick = () => {
      window.EnderTrack?.Movement?.moveAbsolute?.(hit.x, hit.y, hit.z);
      dialog.remove();
    };
    const close = (ev) => {
      if ((ev.type === 'keydown' && ev.key === 'Escape') || (ev.type === 'click' && !dialog.contains(ev.target))) {
        dialog.remove();
        document.removeEventListener('keydown', close);
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => { document.addEventListener('keydown', close); document.addEventListener('click', close); }, 100);
  }

  // ── Compass ────────────────────────────────────────────────

  _isOverCompass(x, y) {
    const b = this.zVis.zCompassBounds;
    return b && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }

  _checkCompassHover(canvasX, canvasY) {
    const was = this.zVis.zCompassHovered || false;
    this.zVis.zCompassHovered = this._isOverCompass(canvasX, canvasY);
    if (was !== this.zVis.zCompassHovered) requestAnimationFrame(() => this.zVis.render());
  }

  // ── Cursor ─────────────────────────────────────────────────

  _updateCursor(canvasY) {
    const canvas = this.zVis.canvas;
    const state = window.EnderTrack.State.get();

    // Scenario executing
    if (window.EnderTrack?.Scenario?.isExecuting) {
      canvas.style.cursor = 'not-allowed';
      return;
    }

    // Compass or list point hover
    if (this.zVis.zCompassHovered || this._hoveredListPoint) {
      canvas.style.cursor = 'pointer';
      canvas.classList.remove('crosshair-cursor');
      return;
    }

    // Lists click mode
    const Lists = window.EnderTrack?.Lists;
    if (Lists?.isActive && Lists.currentMode === 'click') {
      canvas.style.cursor = this._isMouseZValid() ? 'copy' : 'not-allowed';
      canvas.classList.remove('crosshair-cursor');
      return;
    }

    // History mode — pointer over history points
    if (state.historyMode && state.positionHistory) {
      const overHistory = state.positionHistory
        .filter(p => p.isFinalPosition)
        .some(p => Math.abs(canvasY - this._zToCanvasY(p.z)) <= 8);
      canvas.style.cursor = overHistory ? 'pointer' : '';
      canvas.classList.toggle('crosshair-cursor', !overHistory);
      return;
    }

    // Default — crosshair if valid, not-allowed otherwise
    const valid = this._isMouseZValid();
    canvas.style.cursor = valid ? '' : 'not-allowed';
    canvas.classList.toggle('crosshair-cursor', valid);
  }

  // ── Validation ─────────────────────────────────────────────

  _isMouseZValid() {
    if (this.zVis.mouseZ === null) return false;
    const z = this.zVis.mouseZ;
    const state = window.EnderTrack.State.get();
    const bounds = state.coordinateBounds || { z: { min: 0, max: 100 } };

    if (z < bounds.z.min || z > bounds.z.max) return false;

    const limits = window.EnderTrack?.StrategicPositions?.getLimits();
    if (limits?.zMin !== null && limits?.zMax !== null) {
      if (z < limits.zMin || z > limits.zMax) return false;
    }
    return true;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ZInteractions = ZInteractions;
