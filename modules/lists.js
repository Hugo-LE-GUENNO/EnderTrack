// modules/lists.js - Position list manager (same pattern as overlays.js)

class ListManager {
  constructor() {
    this.groups = [];
    this.activeGroupId = null;
    this.isActive = false;
    this.selectedIdx = null;
    this._nextGroupId = 1;
    this._clickMode = false;
    this._editingIdx = null;
    this._draggingIdx = null;
    this.load();
    if (this.groups.length === 0) this.addGroup('Liste 1');
    window.addEventListener('load', () => this._startSync());
  }

  get positions() {
    const g = this._activeGroup();
    return g ? g.positions : [];
  }

  get allVisiblePositions() {
    const all = [];
    this.groups.forEach(g => { if (g.visible) g.positions.forEach((p, i) => all.push({ ...p, _groupId: g.id, _idx: i, _color: g.color })); });
    return all;
  }

  _activeGroup() { return this.groups.find(g => g.id === this.activeGroupId); }

  // === COMPAT API (for scenario, renderers, etc.) ===

  get manager() {
    const self = this;
    return {
      getAllLists() {
        return self.groups.map(g => ({
          id: g.id, name: g.name, positions: g.positions,
          color: g.color, showOnNavigation: g.pinned
        }));
      },
      getCurrentList() {
        const g = self._activeGroup();
        if (!g) return null;
        return { id: g.id, name: g.name, positions: g.positions, color: g.color };
      },
      getList(id) {
        const g = self.groups.find(g => String(g.id) === String(id));
        if (!g) return null;
        return { id: g.id, name: g.name, positions: g.positions, color: g.color };
      },
      getListColor(id) {
        return self.groups.find(g => String(g.id) === String(id))?.color || '#4a90e2';
      },
      addPosition(x, y, z, name) { self.addPosition(x, y, z, name); }
    };
  }

  get currentMode() { return this._clickMode ? 'click' : 'normal'; }

  // === GROUPS ===

  addGroup(name) {
    const colors = ['#4a90e2', '#e2844a', '#4ae290', '#e24a90', '#90e24a', '#904ae2'];
    const g = { id: this._nextGroupId++, name: name || `Liste ${this._nextGroupId - 1}`, positions: [], visible: true, pinned: false, color: colors[(this._nextGroupId - 2) % colors.length] };
    this.groups.push(g);
    this.activeGroupId = g.id;
    this.selectedIdx = null;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  removeGroup(gid) {
    this.groups = this.groups.filter(g => g.id !== gid);
    if (this.activeGroupId === gid) { this.activeGroupId = this.groups[0]?.id || null; this.selectedIdx = null; }
    if (this.groups.length === 0) this.addGroup('Liste 1');
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  renameGroup(gid, name) {
    const g = this.groups.find(g => g.id === gid);
    if (g) { g.name = name; this.save(); this.renderUI(); }
  }

  toggleGroupPinned(gid) {
    const g = this.groups.find(g => g.id === gid);
    if (g) { g.pinned = !g.pinned; this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.(); }
  }

  selectGroup(gid) {
    this.activeGroupId = gid;
    this.selectedIdx = null;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  clearGroup() {
    const g = this._activeGroup();
    if (g) g.positions = [];
    this.selectedIdx = null;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  // === POSITIONS ===

  addPosition(x, y, z, name) {
    const g = this._activeGroup();
    if (!g) return;
    g.positions.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100, name: name || '' });
    this.selectedIdx = g.positions.length - 1;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.(); EnderTrack.ZVisualization?.render?.();
  }

  addCurrentPosition() {
    const pos = EnderTrack.State?.get()?.pos;
    if (!pos) return;
    const xEl = document.getElementById('listAddX');
    if (xEl) {
      xEl.value = Math.round(pos.x * 100) / 100;
      document.getElementById('listAddY').value = Math.round(pos.y * 100) / 100;
      document.getElementById('listAddZ').value = Math.round(pos.z * 100) / 100;
    } else {
      this.addPosition(pos.x, pos.y, pos.z);
    }
  }

  duplicatePosition(idx) {
    const g = this._activeGroup();
    if (!g?.positions[idx]) return;
    const p = { ...g.positions[idx], name: g.positions[idx].name ? g.positions[idx].name + ' (copie)' : '' };
    g.positions.splice(idx + 1, 0, p);
    this.selectedIdx = idx + 1;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  removePosition(idx) {
    const g = this._activeGroup();
    if (!g) return;
    g.positions.splice(idx, 1);
    if (this.selectedIdx === idx) this.selectedIdx = null;
    else if (this.selectedIdx > idx) this.selectedIdx--;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.(); EnderTrack.ZVisualization?.render?.();
  }

  updatePosition(idx, props) {
    const g = this._activeGroup();
    if (!g || !g.positions[idx]) return;
    Object.assign(g.positions[idx], props);
    this.save(); EnderTrack.Canvas?.requestRender?.();
  }

  goToPosition(idx) {
    const g = this._activeGroup();
    const p = g?.positions[idx];
    if (p) EnderTrack.Movement?.moveAbsolute(p.x, p.y, p.z);
  }

  movePosition(idx, dir) {
    const g = this._activeGroup();
    if (!g) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= g.positions.length) return;
    [g.positions[idx], g.positions[newIdx]] = [g.positions[newIdx], g.positions[idx]];
    this.selectedIdx = newIdx;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  selectPoint(idx) {
    this.selectedIdx = idx;
    this.renderUI();
    const p = this.positions[idx];
    if (!p) return;
    if (window.EnderTrack?.CanvasInteractions?.centerOnPosition) {
      window.EnderTrack.CanvasInteractions.centerOnPosition(p.x, p.y);
    }
    if (window.EnderTrack?.ZVisualization) {
      window.EnderTrack.ZVisualization.zPan = p.z;
      window.EnderTrack.State.update({ zPan: p.z });
      window.EnderTrack.ZVisualization.render();
    }
    EnderTrack.Canvas?.requestRender?.();
  }

  hoverPoint(idx) {
    this.hoveredIdx = idx;
    EnderTrack.Canvas?.requestRender?.();
    if (window.EnderTrack?.ZVisualization?.render) {
      window.EnderTrack.ZVisualization.render();
    }
  }

  addManualPosition() {
    const x = parseFloat(document.getElementById('listAddX')?.value);
    const y = parseFloat(document.getElementById('listAddY')?.value);
    const z = parseFloat(document.getElementById('listAddZ')?.value);
    const name = document.getElementById('listAddName')?.value.trim() || '';
    this.addPosition(isNaN(x) ? 0 : x, isNaN(y) ? 0 : y, isNaN(z) ? 0 : z, name);
    const n = document.getElementById('listAddName'); if (n) n.value = '';
  }

  // === COMPAT: tracks & executor (minimal stubs for renderers/scenario) ===

  getListTracks() { return []; }
  getPreviewPositions() { return []; }
  getPreviewTracks() { return []; }

  get executor() {
    const self = this;
    return {
      isExecuting: false,
      async executeList(positions) {
        if (!positions?.length || !EnderTrack.Movement) return;
        this.isExecuting = true;
        for (let i = 0; i < positions.length; i++) {
          const p = positions[i];
          try { await EnderTrack.Movement.moveAbsolute(p.x, p.y, p.z); }
          catch { break; }
        }
        this.isExecuting = false;
      },
      stopExecution() { this.isExecuting = false; EnderTrack.Movement?.stopMovement?.(); },
      getExecutionStatus() { return { isExecuting: this.isExecuting, currentIndex: 0, progress: 0 }; }
    };
  }

  // === ACTIVATE / DEACTIVATE ===

  activate() {
    this.isActive = true;
    this._clickMode = true;
    this.renderUI();
    this._setupCanvasListeners();
    this._setupKeyListener();
    EnderTrack.Canvas?.requestRender?.();
  }

  deactivate() {
    this.isActive = false;
    this._clickMode = false;
    this._removeCanvasListeners();
    this._removeKeyListener();
    EnderTrack.Canvas?.requestRender?.();
  }

  // === CANVAS INTERACTION ===

  _setupCanvasListeners() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    this._onClick = (e) => this._handleClick(e);
    this._onHover = (e) => this._handleHover(e);
    canvas.addEventListener('click', this._onClick);
    canvas.addEventListener('mousemove', this._onHover);
  }

  _removeCanvasListeners() {
    const canvas = document.getElementById('mapCanvas');
    if (canvas) {
      if (this._onClick) canvas.removeEventListener('click', this._onClick);
      if (this._onHover) canvas.removeEventListener('mousemove', this._onHover);
    }
    if (canvas) canvas.style.cursor = '';
  }

  _hitTestPoint(cx, cy) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return -1;
    const g = this.groups.find(g => g.id === this.activeGroupId);
    if (!g) return -1;
    for (let i = 0; i < g.positions.length; i++) {
      const p = coords.mapToCanvas(g.positions[i].x, g.positions[i].y);
      if (Math.sqrt((cx - p.cx) ** 2 + (cy - p.cy) ** 2) <= 12) return i;
    }
    return -1;
  }

  _handleClick(e) {
    if (!this.isActive || !this._clickMode) return;
    // Block during pan (mouse drag or trackpad scroll)
    const ci = window.EnderTrack?.CanvasInteractions;
    if (ci?.isPanning || ci?._dragMoved) return;
    if (Date.now() - (ci?._lastPanTime || 0) < 500) return;
    const coords = window.EnderTrack?.Coordinates;
    const canvas = document.getElementById('mapCanvas');
    if (!coords || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const map = coords.canvasToMap(cx, cy);
    const bounds = coords.getCoordinateBounds();
    if (map.x < bounds.minX || map.x > bounds.maxX || map.y < bounds.minY || map.y > bounds.maxY) return;
    e._listHandled = true;
    // Hit test: click on existing point → select it
    const hit = this._hitTestPoint(cx, cy);
    if (hit >= 0) {
      this.selectPoint(hit);
      return;
    }
    // Click on empty space → add new point
    const pos = EnderTrack.State?.get()?.pos;
    this.addPosition(map.x, map.y, pos?.z || 0);
  }

  _handleHover(e) {
    if (!this.isActive) return;
    const canvas = document.getElementById('mapCanvas');
    const coords = window.EnderTrack?.Coordinates;
    if (!canvas || !coords) return;
    if (!this._clickMode) { canvas.style.cursor = ''; this.hoverPoint(null); return; }
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const map = coords.canvasToMap(cx, cy);
    const bounds = coords.getCoordinateBounds();
    const onPlateau = map.x >= bounds.minX && map.x <= bounds.maxX && map.y >= bounds.minY && map.y <= bounds.maxY;
    const hit = this._hitTestPoint(cx, cy);
    if (hit >= 0) {
      canvas.style.cursor = 'pointer';
      this.hoverPoint(hit);
    } else {
      canvas.style.cursor = onPlateau ? 'copy' : 'not-allowed';
      this.hoverPoint(null);
    }
  }

  _setupKeyListener() {
    this._onKey = (e) => {
      if (!this.isActive || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedIdx !== null) this.removePosition(this.selectedIdx);
      } else if (e.key === 'Escape') {
        this.selectedIdx = null;
        this._clickMode = false;
        this.renderUI(); EnderTrack.Canvas?.requestRender?.();
      } else if (e.key === 'p' || e.key === 'P') {
        this.addCurrentPosition();
      }
    };
    document.addEventListener('keydown', this._onKey);
  }

  _removeKeyListener() {
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
  }

  // === RENDER ON CANVAS ===

  renderOnCanvas(ctx, coords) {
    if (window.EnderTrack?.Lists !== this) return;
    const state = EnderTrack.State?.get();
    const tab = state?.activeTab;
    const scenarioListId = window.EnderTrack?.Scenario?.selectedListId;

    this.groups.forEach(g => {
      const isActiveGroup = g.id === this.activeGroupId;
      const isScenarioList = String(g.id) === String(scenarioListId);

      // Determine what to show
      let showPoints, showTrack;
      if (tab === 'lists') {
        showPoints = isActiveGroup;
        showTrack = isActiveGroup;
      } else if (tab === 'acquisition') {
        showPoints = isScenarioList;
        showTrack = isScenarioList;
      } else {
        showPoints = g.pinned;
        showTrack = false;
      }

      if (!showPoints) return;

      // Track line
      if (showTrack && g.positions.length > 1) {
        const executing = tab === 'acquisition' && window.EnderTrack?.Scenario?.isExecuting;
        const color = g.color || '#4a90e2';
        ctx.strokeStyle = executing ? '#555' : color;
        ctx.lineWidth = executing ? 1 : (tab === 'acquisition' ? 2 : 1);
        ctx.globalAlpha = executing ? 0.4 : (tab === 'acquisition' ? 0.5 : 0.3);
        if (executing) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        const f = coords.mapToCanvas(g.positions[0].x, g.positions[0].y);
        ctx.moveTo(f.cx, f.cy);
        for (let i = 1; i < g.positions.length; i++) {
          const p = coords.mapToCanvas(g.positions[i].x, g.positions[i].y);
          ctx.lineTo(p.cx, p.cy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Direction arrows only in selection mode
        if (tab === 'acquisition' && !executing) {
          ctx.fillStyle = color;
          for (let i = 1; i < g.positions.length; i++) {
            const from = coords.mapToCanvas(g.positions[i-1].x, g.positions[i-1].y);
            const to = coords.mapToCanvas(g.positions[i].x, g.positions[i].y);
            const dx = to.cx - from.cx, dy = to.cy - from.cy;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 20) continue;
            const mx = (from.cx + to.cx) / 2, my = (from.cy + to.cy) / 2;
            const a = Math.atan2(dy, dx);
            ctx.beginPath();
            ctx.moveTo(mx + 5*Math.cos(a), my + 5*Math.sin(a));
            ctx.lineTo(mx - 5*Math.cos(a-0.5), my - 5*Math.sin(a-0.5));
            ctx.lineTo(mx - 5*Math.cos(a+0.5), my - 5*Math.sin(a+0.5));
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      // Scenario progress overlay
      const executing = isScenarioList && window.EnderTrack?.Scenario?.isExecuting;
      const track = executing && window.EnderTrack?.Scenario?.scenarioTrack;
      const visitedSet = track ? new Set(track.visited.map(v => `${v.x},${v.y}`)) : null;
      const currentKey = track?.current ? `${track.current.x},${track.current.y}` : null;

      // Points
      g.positions.forEach((p, idx) => {
        const cp = coords.mapToCanvas(p.x, p.y);
        const isSel = isActiveGroup && idx === this.selectedIdx && this.isActive;
        const isHov = isActiveGroup && idx === this.hoveredIdx && this.isActive;
        const r = isSel ? 8 : (isHov ? 7 : 6);
        const key = `${p.x},${p.y}`;

        if (track) {
          if (key === currentKey) ctx.fillStyle = '#ffc107';
          else if (visitedSet.has(key)) ctx.fillStyle = '#4caf50';
          else ctx.fillStyle = '#555';
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = g.color || '#4a90e2';
          ctx.globalAlpha = isSel ? 1 : 0.7;
        }
        ctx.beginPath();
        ctx.arc(cp.cx, cp.cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(idx + 1, cp.cx, cp.cy);
        ctx.globalAlpha = 1;

        if (isSel) {
          ctx.strokeStyle = '#ffc107';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cp.cx, cp.cy, 11, 0, Math.PI * 2);
          ctx.stroke();
        } else if (isHov) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(cp.cx, cp.cy, 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });
    });
  }

  // === PERSISTENCE ===

  save() {
    const data = {
      groups: this.groups.map(g => ({ id: g.id, name: g.name, visible: g.visible, pinned: g.pinned || false, color: g.color, positions: g.positions })),
      activeGroupId: this.activeGroupId,
      _nextGroupId: this._nextGroupId
    };
    localStorage.setItem('endertrack_lists', JSON.stringify(data));
    // Sync to server
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
    fetch(url + '/api/sync/lists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => { if (!r.ok) console.error('[Lists] save failed:', r.status); })
      .catch(e => console.error('[Lists] save error:', e));
  }

  load() {
    // Try server first, fallback to localStorage
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
    fetch(url + '/api/sync/lists', { signal: AbortSignal.timeout(2000) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data?.groups?.length) {
          this._applyData(data);
        } else {
          this._loadLocal();
        }
      })
      .catch(() => this._loadLocal());
  }

  _loadLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem('endertrack_lists') || '{}');
      if (raw.groups) this._applyData(raw);
    } catch (e) { /* ignore */ }
  }

  _applyData(raw) {
    this.groups = raw.groups;
    this.activeGroupId = raw.activeGroupId || this.groups[0]?.id;
    this._nextGroupId = raw._nextGroupId || 1;
    this.renderUI?.();
    window.EnderTrack?.Canvas?.requestRender?.();
    window.EnderTrack?.ZVisualization?.render?.();
  }

  // Real-time sync via SSE
  _startSync() {
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
    this._clientId = Math.random().toString(36).slice(2, 8);

    try {
      const es = new EventSource(url + '/api/events');
      this._sse = es;
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          if (evt.type === 'lists:updated' && evt.data?._from !== this._clientId) {
            // Another client changed the lists — reload from server
            fetch(url + '/api/state', { signal: AbortSignal.timeout(2000) })
              .then(r => r.json())
              .then(state => { if (state?.lists?.groups) this._applyData(state.lists); })
              .catch(() => {});
          }
        } catch {}
      };
      es.onerror = () => {
        // SSE failed — fallback to polling
        es.close();
        this._startPolling();
      };
    } catch {
      this._startPolling();
    }
  }

  // Fallback polling if SSE not available
  _startPolling() {
    this._lastHash = '';
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
    setInterval(async () => {
      try {
        const resp = await fetch(url + '/api/state/hash', { signal: AbortSignal.timeout(1500) });
        const { hash } = await resp.json();
        if (hash && hash !== this._lastHash) {
          if (this._lastHash !== '') {
            const state = await (await fetch(url + '/api/state', { signal: AbortSignal.timeout(2000) })).json();
            if (state?.lists?.groups) this._applyData(state.lists);
          }
          this._lastHash = hash;
        }
      } catch {}
    }, 3000);
  }

  exportGroup(gid) {
    const g = this.groups.find(g => g.id === gid);
    if (!g) return;
    const data = { name: g.name, color: g.color, positions: g.positions, exported: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${g.name.replace(/[^a-z0-9]/gi, '_')}-positions.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    EnderTrack.UI?.showNotification?.(`"${g.name}" exportée (${g.positions.length} pts)`, 'success');
  }

  exportToFile() {
    const data = {
      groups: this.groups.map(g => ({ id: g.id, name: g.name, color: g.color, positions: g.positions })),
      exported: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `endertrack-positions-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    EnderTrack.UI?.showNotification?.('Positions exportées', 'success');
  }

  importFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          // Support both single group and multi-group format
          const groups = data.groups || [{ name: data.name, color: data.color, positions: data.positions }];
          if (!groups.length || !groups[0].positions) throw new Error('No positions found');
          for (const g of groups) {
            const id = this._nextGroupId++;
            this.groups.push({ id, name: g.name || `Import ${id}`, visible: true, pinned: false, color: g.color || '#4a90e2', positions: g.positions || [] });
          }
          this.activeGroupId = this.groups[this.groups.length - 1].id;
          this.save();
          this.renderUI();
          EnderTrack.Canvas?.requestRender?.();
          EnderTrack.UI?.showNotification?.(`${data.groups.length} liste(s) importée(s)`, 'success');
        } catch (err) {
          EnderTrack.UI?.showNotification?.('Fichier invalide: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // === UI ===

  renderUI() {
    const container = document.getElementById('listsContent') || document.getElementById('listsTabContent');
    if (!container) return;
    const pts = this.positions;

    container.innerHTML = `
      <div style="display:flex; gap:2px; margin-bottom:6px; flex-wrap:wrap; align-items:center;">
        ${this.groups.map(g => {
          const active = g.id === this.activeGroupId;
          return `<button onclick="EnderTrack.Lists.selectGroup(${g.id})" oncontextmenu="event.preventDefault(); EnderTrack.Lists._groupContextMenu(event, ${g.id})" style="
            padding:3px 8px; border:none; border-radius:4px; cursor:pointer; font-size:11px;
            background:${active ? 'var(--active-element)' : 'var(--app-bg)'};
            color:${active ? 'var(--text-selected)' : 'var(--text-general)'};
            opacity:${g.visible ? '1' : '0.35'};
            border-left:3px solid ${g.color};
          ">${g.pinned ? '📌 ' : ''}${g.name} (${g.positions.length})</button>`;
        }).join('')}
        <button onclick="EnderTrack.Lists.addGroup()" style="padding:3px 8px; border:none; border-radius:4px; cursor:pointer; font-size:11px; background:var(--app-bg); color:var(--text-general);">+</button>
      </div>
      <div id="listsPluginZone" style="display:flex; gap:4px; margin-bottom:4px;"></div>
      <div style="display:grid; grid-template-columns:20px 1fr 46px 46px 46px; gap:2px; padding:0 4px 2px; font-size:9px; color:var(--text-general); opacity:0.5;">
        <span></span><span>Nom</span><span style="text-align:center">X</span><span style="text-align:center">Y</span><span style="text-align:center">Z</span>
      </div>
      <div style="display:grid; grid-template-columns:20px 1fr 46px 46px 46px; gap:2px; align-items:center; padding:3px 4px 6px; border-bottom:1px solid #333; margin-bottom:4px;">
        <button onclick="EnderTrack.Lists.addCurrentPosition()" style="background:none; border:none; color:var(--coordinates-color); cursor:pointer; font-size:12px; padding:0; text-align:center; line-height:1;" title="Remplir avec la position actuelle">📍</button>
        <input type="text" id="listAddName" placeholder="—" style="width:100%; background:transparent; border:none; border-bottom:1px solid var(--border); color:var(--text-general); font-size:11px; outline:none; padding:1px;">
        <input type="number" id="listAddX" placeholder="—" step="0.1" style="width:100%; background:transparent; border:none; border-bottom:1px solid var(--border); color:var(--pos-potential); text-align:center; font-size:10px; font-family:monospace; outline:none; padding:1px;">
        <input type="number" id="listAddY" placeholder="—" step="0.1" style="width:100%; background:transparent; border:none; border-bottom:1px solid var(--border); color:var(--pos-potential); text-align:center; font-size:10px; font-family:monospace; outline:none; padding:1px;">
        <input type="number" id="listAddZ" placeholder="—" step="0.1" style="width:100%; background:transparent; border:none; border-bottom:1px solid var(--border); color:var(--pos-potential); text-align:center; font-size:10px; font-family:monospace; outline:none; padding:1px;">
        <span></span>
        <button onclick="EnderTrack.Lists.addManualPosition()" style="grid-column:2 / span 4; background:var(--button-bg); border:none; border-radius:3px; color:var(--text-general); cursor:pointer; font-size:11px; padding:3px; margin-top:3px;">+ Ajouter</button>
      </div>
      ${!pts.length ? '<div style="text-align:center; color:var(--text-general); font-size:11px; padding:8px; opacity:0.5;">Cliquez sur le canvas pour ajouter des positions</div>' : ''}
      ${pts.map((p, i) => this._renderRow(p, i)).join('')}
    `;

    // Plugin injection zone
    window.EnderTrack?.Events?.notifyListeners?.('lists:rendered', container);

    container.querySelectorAll('[data-pt-prop]').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.dataset.ptIdx);
        const prop = input.dataset.ptProp;
        const val = prop === 'name' ? input.value : parseFloat(input.value);
        if (prop === 'name' || !isNaN(val)) this.updatePosition(idx, { [prop]: val });
      });
    });

    // Enter on add inputs
    ['listAddX', 'listAddY', 'listAddZ'].forEach(id => {
      document.getElementById(id)?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addManualPosition();
      });
    });
  }

  _renderRow(p, i) {
    const sel = i === this.selectedIdx;
    const border = sel ? 'border-left:3px solid #ffc107;' : 'border-left:3px solid transparent;';
    const nameEsc = (p.name || '').replace(/"/g, '&quot;');
    const is = 'width:100%; background:transparent; border:none; border-bottom:1px solid transparent; color:var(--pos-current); text-align:center; font-size:10px; font-family:monospace; outline:none; cursor:pointer;';
    const isFocus = `this.style.borderBottomColor='#f59e0b'; this.style.color='#f59e0b';`;
    const iBlur = `this.style.borderBottomColor='transparent'; this.style.color='var(--pos-current)';`;
    return `
      <div draggable="true" data-drag-idx="${i}"
        style="display:grid; grid-template-columns:20px 1fr 46px 46px 46px; gap:2px; align-items:center; padding:3px 4px; ${border} cursor:pointer; font-size:11px; user-select:none;"
        onclick="EnderTrack.Lists.selectPoint(${i})"
        onmouseenter="EnderTrack.Lists.hoverPoint(${i})"
        onmouseleave="EnderTrack.Lists.hoverPoint(null)"
        oncontextmenu="event.preventDefault(); EnderTrack.Lists.selectPoint(${i}); EnderTrack.Lists._positionContextMenu(event, ${i})"
        ondragstart="EnderTrack.Lists._dragStart(event, ${i})"
        ondragover="event.preventDefault(); EnderTrack.Lists._dragOver(event, ${i})"
        ondragleave="EnderTrack.Lists._dragLeave(event)"
        ondrop="EnderTrack.Lists._dragDrop(event, ${i})"
        ondragend="EnderTrack.Lists._dragEnd()">
        <span style="text-align:center; color:var(--text-general); font-size:10px; opacity:0.5; cursor:grab; user-select:none;" title="Glisser pour réordonner">${i + 1}</span>
        <input type="text" value="${nameEsc}" placeholder="—" data-pt-idx="${i}" data-pt-prop="name"
          style="background:transparent; border:none; border-bottom:1px solid transparent; color:${sel ? '#ffc107' : 'var(--text-general)'}; font-size:11px; min-width:0; outline:none; cursor:pointer; width:100%;"
          onfocus="${isFocus} this.style.color='#f59e0b';"
          onblur="${iBlur} this.style.color='${sel ? '#ffc107' : 'var(--text-general)'}';"
          onclick="event.stopPropagation()">
        <input type="number" value="${p.x}" step="0.01" data-pt-idx="${i}" data-pt-prop="x" style="${is}" onfocus="${isFocus}" onblur="${iBlur}" onclick="event.stopPropagation()">
        <input type="number" value="${p.y}" step="0.01" data-pt-idx="${i}" data-pt-prop="y" style="${is}" onfocus="${isFocus}" onblur="${iBlur}" onclick="event.stopPropagation()">
        <input type="number" value="${p.z}" step="0.01" data-pt-idx="${i}" data-pt-prop="z" style="${is}" onfocus="${isFocus}" onblur="${iBlur}" onclick="event.stopPropagation()">
      </div>`;
  }

  _dragStart(e, idx) {
    this._draggingIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
  }

  _dragOver(e, idx) {
    if (this._draggingIdx === idx) return;
    e.currentTarget.style.borderTop = this._draggingIdx > idx ? '2px solid #f59e0b' : 'none';
    e.currentTarget.style.borderBottom = this._draggingIdx < idx ? '2px solid #f59e0b' : 'none';
  }

  _dragLeave(e) {
    e.currentTarget.style.borderTop = '';
    e.currentTarget.style.borderBottom = '';
  }

  _dragDrop(e, toIdx) {
    e.currentTarget.style.borderTop = '';
    e.currentTarget.style.borderBottom = '';
    const fromIdx = this._draggingIdx;
    if (fromIdx === null || fromIdx === toIdx) return;
    const g = this._activeGroup();
    if (!g) return;
    const [item] = g.positions.splice(fromIdx, 1);
    g.positions.splice(toIdx, 0, item);
    this.selectedIdx = toIdx;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  _dragEnd() {
    this._draggingIdx = null;
    this.renderUI();
  }

  _positionContextMenu(e, idx) {
    document.getElementById('listPosCtxMenu')?.remove();
    const total = this.positions.length;
    const menu = document.createElement('div');
    menu.id = 'listPosCtxMenu';
    menu.className = 'axis-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.innerHTML = `
      <button onmousedown="EnderTrack.Lists.goToPosition(${idx}); this.parentElement.remove()">🎯 Aller à</button>
      <button onmousedown="EnderTrack.Lists.duplicatePosition(${idx}); this.parentElement.remove()">⧉ Dupliquer</button>
      <button onmousedown="EnderTrack.Lists.movePosition(${idx},-1); this.parentElement.remove()" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>▲ Monter</button>
      <button onmousedown="EnderTrack.Lists.movePosition(${idx},1); this.parentElement.remove()" ${idx === total - 1 ? 'disabled style="opacity:0.3"' : ''}>▼ Descendre</button>
      <button onmousedown="EnderTrack.Lists.removePosition(${idx}); this.parentElement.remove()" style="color:#e25555;">✕ Supprimer</button>
    `;
    document.body.appendChild(menu);
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  _groupContextMenu(e, gid) {
    document.getElementById('listGroupCtxMenu')?.remove();
    const g = this.groups.find(g => g.id === gid);
    if (!g) return;
    const menu = document.createElement('div');
    menu.id = 'listGroupCtxMenu';
    menu.className = 'axis-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.innerHTML = `
      <button onmousedown="EnderTrack.Lists.toggleGroupPinned(${gid}); this.parentElement.remove()">${g.pinned ? '📌 Désépingler' : 'Épingler'}</button>
      <button onmousedown="const n=prompt('Nom:','${g.name.replace(/'/g, "\\'")}'); if(n) { EnderTrack.Lists.renameGroup(${gid},n); } this.parentElement.remove()">Renommer</button>
      <button onmousedown="EnderTrack.Lists.exportGroup(${gid}); this.parentElement.remove()">Sauver</button>
      <button onmousedown="EnderTrack.Lists.importFromFile(); this.parentElement.remove()">Importer</button>
      <button onmousedown="if(confirm('Supprimer ?')) EnderTrack.Lists.removeGroup(${gid}); this.parentElement.remove()">Supprimer</button>
    `;
    document.body.appendChild(menu);
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Lists = new ListManager();
