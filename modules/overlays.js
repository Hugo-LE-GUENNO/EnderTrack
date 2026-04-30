// modules/overlays.js - Image/SVG overlay manager for canvas

class OverlayManager {
  constructor() {
    this.groups = []; // [{ id, name, overlays: [], visible }]
    this.activeGroupId = null;
    this.isActive = false;
    this.selectedId = null;
    this._nextId = 1;
    this._nextGroupId = 1;
    this._dragging = null;
    this.load();
    if (this.groups.length === 0) this.addGroup('Overlay 1');
  }

  get overlays() {
    const g = this.groups.find(g => g.id === this.activeGroupId);
    return g ? g.overlays : [];
  }

  get visibleOverlays() {
    const all = [];
    this.groups.forEach(g => { if (g.visible) all.push(...g.overlays); });
    return all;
  }

  activate() {
    this.isActive = true;
    this.renderUI();
    this.setupDropZone();
    this._setupCanvasListeners();
    this._onKey = (e) => this._handleKey(e);
    document.addEventListener('keydown', this._onKey);
    EnderTrack.Canvas?.requestRender?.();
  }

  deactivate() {
    this.isActive = false;
    this.selectedId = null;
    this._dragging = null;
    this._removeCanvasListeners();
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
    EnderTrack.Canvas?.requestRender?.();
  }

  // === DATA ===

  _activeGroup() { return this.groups.find(g => g.id === this.activeGroupId); }

  add(name, imgSrc) {
    const g = this._activeGroup();
    if (!g) return;
    const img = new Image();
    img.src = imgSrc;
    const overlay = { id: this._nextId++, name, img, src: imgSrc, x: 0, y: 0, width: 50, height: 50, opacity: 0.5, rotation: 0, visible: true };
    img.onload = () => {
      overlay.height = overlay.width / (img.naturalWidth / img.naturalHeight);
      this.selectedId = overlay.id;
      this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
    };
    g.overlays.push(overlay);
    this.selectedId = overlay.id;
    this.save(); this.renderUI();
  }

  remove(id) {
    const g = this._activeGroup();
    if (g) g.overlays = g.overlays.filter(o => o.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  clearGroup() {
    const g = this._activeGroup();
    if (g) g.overlays = [];
    this.selectedId = null;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  update(id, props) {
    const g = this._activeGroup();
    const o = g?.overlays.find(o => o.id === id);
    if (!o) return;
    if (props.width !== undefined && o.img?.naturalWidth) {
      props.height = props.width / (o.img.naturalWidth / o.img.naturalHeight);
    }
    Object.assign(o, props);
    this.save(); EnderTrack.Canvas?.requestRender?.();
  }

  // === GROUPS ===

  addGroup(name) {
    const g = { id: this._nextGroupId++, name: name || `Overlay ${this._nextGroupId - 1}`, overlays: [], visible: true };
    this.groups.push(g);
    this.activeGroupId = g.id;
    this.selectedId = null;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  removeGroup(gid) {
    this.groups = this.groups.filter(g => g.id !== gid);
    if (this.activeGroupId === gid) {
      this.activeGroupId = this.groups[0]?.id || null;
      this.selectedId = null;
    }
    if (this.groups.length === 0) this.addGroup('Overlay 1');
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  renameGroup(gid, name) {
    const g = this.groups.find(g => g.id === gid);
    if (g) { g.name = name; this.save(); }
  }

  toggleGroupVisible(gid) {
    const g = this.groups.find(g => g.id === gid);
    if (g) { g.visible = !g.visible; this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.(); }
  }

  selectGroup(gid) {
    this.activeGroupId = gid;
    this.selectedId = null;
    this.save(); this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  select(id) {
    this.selectedId = id;
    this.renderUI(); EnderTrack.Canvas?.requestRender?.();
  }

  save() {
    const data = {
      groups: this.groups.map(g => ({
        id: g.id, name: g.name, visible: g.visible,
        overlays: g.overlays.map(({ id, name, src, x, y, width, height, opacity, rotation, visible }) =>
          ({ id, name, src, x, y, width, height, opacity, rotation: rotation || 0, visible }))
      })),
      activeGroupId: this.activeGroupId,
      _nextId: this._nextId,
      _nextGroupId: this._nextGroupId
    };
    localStorage.setItem('endertrack_overlays', JSON.stringify(data));
  }

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem('endertrack_overlays') || '{}');
      if (Array.isArray(raw)) {
        // Legacy: single array of overlays
        const g = { id: 1, name: 'Overlay 1', overlays: [], visible: true };
        raw.forEach(d => { const img = new Image(); img.src = d.src; g.overlays.push({ ...d, rotation: d.rotation || 0, img }); });
        this.groups = [g];
        this.activeGroupId = 1;
        this._nextGroupId = 2;
        this._nextId = Math.max(1, ...g.overlays.map(o => o.id)) + 1;
      } else if (raw.groups) {
        raw.groups.forEach(g => {
          const group = { id: g.id, name: g.name, visible: g.visible !== false, overlays: [] };
          (g.overlays || []).forEach(d => { const img = new Image(); img.src = d.src; group.overlays.push({ ...d, rotation: d.rotation || 0, img }); });
          this.groups.push(group);
        });
        this.activeGroupId = raw.activeGroupId || this.groups[0]?.id;
        this._nextId = raw._nextId || 1;
        this._nextGroupId = raw._nextGroupId || 1;
      }
    } catch (e) { /* ignore */ }
  }

  // === CANVAS INTERACTION ===

  _setupCanvasListeners() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    this._onDown = (e) => this._handleDown(e);
    this._onMove = (e) => this._handleMove(e);
    this._onUp = () => this._handleUp();
    this._onHover = (e) => this._handleHover(e);
    canvas.addEventListener('mousedown', this._onDown, true);
    canvas.addEventListener('mousemove', this._onHover);
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('mouseup', this._onUp);
  }

  _removeCanvasListeners() {
    const canvas = document.getElementById('mapCanvas');
    if (canvas && this._onDown) canvas.removeEventListener('mousedown', this._onDown, true);
    if (canvas && this._onHover) canvas.removeEventListener('mousemove', this._onHover);
    if (this._onMove) window.removeEventListener('mousemove', this._onMove);
    if (this._onUp) window.removeEventListener('mouseup', this._onUp);
    if (canvas) canvas.style.cursor = '';
  }

  _canvasToMap(e) {
    const canvas = document.getElementById('mapCanvas');
    const coords = window.EnderTrack?.Coordinates;
    if (!canvas || !coords) return null;
    const rect = canvas.getBoundingClientRect();
    return coords.canvasToMap(e.clientX - rect.left, e.clientY - rect.top);
  }

  _handleDown(e) {
    if (!this.isActive || e.button !== 0) return;
    const canvas = document.getElementById('mapCanvas');
    const coords = window.EnderTrack?.Coordinates;
    if (!canvas || !coords) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const map = coords.canvasToMap(px, py);
    const H = 14; // hit radius pixels

    const sel = this.overlays.find(o => o.id === this.selectedId);
    if (sel && sel.visible) {
      const tl = coords.mapToCanvas(sel.x, sel.y + sel.height);
      const br = coords.mapToCanvas(sel.x + sel.width, sel.y);
      const cxPx = (tl.cx + br.cx) / 2;

      // Rotate handle: top center, 16px above
      if ((px - cxPx) ** 2 + (py - (tl.cy - 16)) ** 2 < H * H) {
        e.stopImmediatePropagation(); e.preventDefault();
        // Rotate: use canvas-space angle for intuitive direction
      const mcx = sel.x + sel.width / 2, mcy = sel.y + sel.height / 2;
      const mcCanvas = coords.mapToCanvas(mcx, mcy);
      this._dragging = { id: sel.id, mode: 'rotate', cxPx: mcCanvas.cx, cyPx: mcCanvas.cy, origRot: sel.rotation || 0, startAngle: Math.atan2(py - mcCanvas.cy, px - mcCanvas.cx) };
        return;
      }

      // Resize handle: bottom-right corner
      if ((px - br.cx) ** 2 + (py - br.cy) ** 2 < H * H) {
        e.stopImmediatePropagation(); e.preventDefault();
        this._dragging = { id: sel.id, mode: 'resize', startX: map.x, origW: sel.width };
        return;
      }

      // Opacity handle: top-left corner
      if ((px - tl.cx) ** 2 + (py - tl.cy) ** 2 < H * H) {
        e.stopImmediatePropagation(); e.preventDefault();
        this._dragging = { id: sel.id, mode: 'opacity', startY: py, origOpacity: sel.opacity };
        return;
      }
    }

    // Click on any overlay to select + start move
    for (let i = this.overlays.length - 1; i >= 0; i--) {
      const o = this.overlays[i];
      if (!o.visible) continue;
      if (map.x >= o.x && map.x <= o.x + o.width && map.y >= o.y && map.y <= o.y + o.height) {
        e.stopImmediatePropagation(); e.preventDefault();
        this.select(o.id);
        this._dragging = { id: o.id, mode: 'move', startX: map.x, startY: map.y, origX: o.x, origY: o.y };
        return;
      }
    }
  }

  _handleMove(e) {
    if (!this._dragging) return;
    const d = this._dragging;
    const o = this.overlays.find(o => o.id === d.id);
    if (!o) return;

    if (d.mode === 'rotate') {
      // Rotate in canvas pixel space for intuitive direction
      const canvas = document.getElementById('mapCanvas');
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const angle = Math.atan2(py - d.cyPx, px - d.cxPx);
      o.rotation = d.origRot + (angle - d.startAngle) * 180 / Math.PI;
    } else if (d.mode === 'opacity') {
      o.opacity = Math.max(0, Math.min(1, d.origOpacity + (d.startY - e.clientY) / 100));
    } else {
      const map = this._canvasToMap(e);
      if (!map) return;
      if (d.mode === 'move') {
        o.x = d.origX + (map.x - d.startX);
        o.y = d.origY + (map.y - d.startY);
      } else if (d.mode === 'resize') {
        const newW = Math.max(1, d.origW + (map.x - d.startX));
        const ratio = o.img?.naturalWidth && o.img.naturalHeight ? o.img.naturalWidth / o.img.naturalHeight : 1;
        o.width = newW;
        o.height = newW / ratio;
      }
    }
    this.save();
    EnderTrack.Canvas?.requestRender?.();
  }

  _handleUp() {
    if (this._dragging) {
      this._dragging = null;
      this.renderUI();
    }
  }

  _handleHover(e) {
    if (!this.isActive || this._dragging) return;
    const canvas = document.getElementById('mapCanvas');
    const coords = window.EnderTrack?.Coordinates;
    if (!canvas || !coords) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const H = 14;

    const sel = this.overlays.find(o => o.id === this.selectedId);
    if (sel && sel.visible) {
      const tl = coords.mapToCanvas(sel.x, sel.y + sel.height);
      const br = coords.mapToCanvas(sel.x + sel.width, sel.y);
      const cxPx = (tl.cx + br.cx) / 2;

      if ((px - cxPx) ** 2 + (py - (tl.cy - 16)) ** 2 < H * H) {
        canvas.style.cursor = 'grab'; return;
      }
      if ((px - br.cx) ** 2 + (py - br.cy) ** 2 < H * H) {
        canvas.style.cursor = 'nwse-resize'; return;
      }
      if ((px - tl.cx) ** 2 + (py - tl.cy) ** 2 < H * H) {
        canvas.style.cursor = 'ns-resize'; return;
      }
    }

    // Check hover on any overlay
    const map = coords.canvasToMap(px, py);
    for (let i = this.overlays.length - 1; i >= 0; i--) {
      const o = this.overlays[i];
      if (!o.visible) continue;
      if (map.x >= o.x && map.x <= o.x + o.width && map.y >= o.y && map.y <= o.y + o.height) {
        canvas.style.cursor = 'move'; return;
      }
    }
    canvas.style.cursor = '';
  }

  // === RENDER ON CANVAS ===

  renderOverlays(ctx, coords) {
    this.visibleOverlays.forEach(o => {
      if (!o.visible || !o.img?.complete) return;
      const tl = coords.mapToCanvas(o.x, o.y + o.height);
      const br = coords.mapToCanvas(o.x + o.width, o.y);
      const w = br.cx - tl.cx;
      const h = br.cy - tl.cy;
      const cx = tl.cx + w / 2;
      const cy = tl.cy + h / 2;

      ctx.globalAlpha = o.opacity;
      if (o.rotation) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(o.rotation * Math.PI / 180);
        ctx.drawImage(o.img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(o.img, tl.cx, tl.cy, w, h);
      }
      ctx.globalAlpha = 1;

      // Selection outline + resize handle
      if (o.id === this.selectedId && this.isActive) {
        ctx.strokeStyle = '#ffc107';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(tl.cx, tl.cy, w, h);
        ctx.setLineDash([]);

        ctx.fillStyle = '#ffc107';
        // Resize handle: bottom-right (square)
        ctx.fillRect(br.cx - 5, br.cy - 5, 10, 10);
        // Rotate handle: top-center (circle + line)
        ctx.beginPath();
        ctx.arc(cx, tl.cy - 16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffc107'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx, tl.cy - 11); ctx.lineTo(cx, tl.cy); ctx.stroke();
        // Opacity handle: top-left (diamond)
        ctx.beginPath();
        ctx.moveTo(tl.cx, tl.cy - 6); ctx.lineTo(tl.cx + 6, tl.cy);
        ctx.lineTo(tl.cx, tl.cy + 6); ctx.lineTo(tl.cx - 6, tl.cy);
        ctx.closePath(); ctx.fill();
        // Opacity label
        ctx.font = '9px monospace'; ctx.fillStyle = '#ffc107'; ctx.textAlign = 'left';
        ctx.fillText(Math.round(o.opacity * 100) + '%', tl.cx + 10, tl.cy + 3);
      }
    });
  }

  // === UI ===

  renderUI() {
    const container = document.getElementById('overlaysTabContent');
    if (!container) return;
    const ols = this.overlays;

    container.innerHTML = `
      <div style="display:flex; gap:2px; margin-bottom:6px; flex-wrap:wrap; align-items:center;">
        ${this.groups.map(g => {
          const active = g.id === this.activeGroupId;
          const vis = g.visible;
          return `<button onclick="EnderTrack.Overlays.selectGroup(${g.id})" oncontextmenu="event.preventDefault(); EnderTrack.Overlays._groupContextMenu(event, ${g.id})" style="
            padding:3px 8px; border:none; border-radius:4px; cursor:pointer; font-size:11px;
            background:${active ? 'var(--active-element)' : 'var(--app-bg)'};
            color:${active ? 'var(--text-selected)' : 'var(--text-general)'};
            opacity:${vis ? '1' : '0.35'};
          ">${g.name}</button>`;
        }).join('')}
        <button onclick="EnderTrack.Overlays.addGroup()" style="padding:3px 8px; border:none; border-radius:4px; cursor:pointer; font-size:11px; background:var(--app-bg); color:var(--text-general);">+</button>
      </div>
      <div style="display:flex; align-items:center; gap:4px; margin-bottom:6px;">
        <button onclick="document.getElementById('overlayFileInput').click()" style="background:var(--active-element); border:none; color:var(--text-selected); border-radius:4px; padding:4px 10px; cursor:pointer; font-size:12px;">+ image</button>
        <input type="file" id="overlayFileInput" accept="image/*,.svg" style="display:none" multiple>
      </div>
      ${ols.length ? `
        <div style="display:grid; grid-template-columns:20px 1fr 36px 36px 36px 32px 36px 20px; gap:2px; padding:0 4px 4px; font-size:9px; color:var(--text-general); opacity:0.5;">
          <span></span><span></span><span style="text-align:center">X</span><span style="text-align:center">Y</span><span style="text-align:center">W</span><span style="text-align:center">R</span><span style="text-align:center">%</span><span></span>
        </div>
      ` : '<div style="text-align:center; color:var(--text-general); font-size:11px; padding:8px; opacity:0.5;">Vide</div>'}
      ${ols.map(o => this._renderRow(o)).join('')}
      <div id="overlaysPluginZone"></div>
    `;

    document.getElementById('overlayFileInput')?.addEventListener('change', (e) => {
      Array.from(e.target.files).forEach(f => this._loadFile(f));
    });

    container.querySelectorAll('[data-ov-prop]').forEach(input => {
      const handler = () => {
        const id = parseInt(input.dataset.ovId);
        const prop = input.dataset.ovProp;
        const val = input.type === 'checkbox' ? input.checked : parseFloat(input.value);
        if (prop === '_opacity_pct') {
          this.update(id, { opacity: Math.max(0, Math.min(1, val / 100)) });
        } else {
          this.update(id, { [prop]: val });
        }
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });

    this.setupDropZone();
  }

  _renderRow(o) {
    const sel = o.id === this.selectedId;
    const border = sel ? 'border-left:3px solid #ffc107;' : 'border-left:3px solid transparent;';
    const inputStyle = 'width:100%; background:transparent; border:none; color:var(--pos-current); text-align:center; font-size:10px; font-family:monospace;';
    return `
      <div style="display:grid; grid-template-columns:20px 1fr 36px 36px 36px 32px 36px 20px; gap:2px; align-items:center; padding:3px 4px; ${border} cursor:pointer; font-size:11px;"
        onclick="EnderTrack.Overlays.select(${o.id})">
        <input type="checkbox" ${o.visible ? 'checked' : ''} data-ov-id="${o.id}" data-ov-prop="visible" class="simple-checkbox" onclick="event.stopPropagation()">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:${sel ? '#ffc107' : 'var(--text-general)'};">${o.name}</span>
        <input type="number" value="${Math.round(o.x)}" step="1" data-ov-id="${o.id}" data-ov-prop="x" title="X mm" style="${inputStyle}" onclick="event.stopPropagation()">
        <input type="number" value="${Math.round(o.y)}" step="1" data-ov-id="${o.id}" data-ov-prop="y" title="Y mm" style="${inputStyle}" onclick="event.stopPropagation()">
        <input type="number" value="${Math.round(o.width)}" step="1" min="1" data-ov-id="${o.id}" data-ov-prop="width" title="Largeur mm" style="${inputStyle}" onclick="event.stopPropagation()">
        <input type="number" value="${Math.round(o.rotation || 0)}" step="5" data-ov-id="${o.id}" data-ov-prop="rotation" title="Rotation deg" style="${inputStyle}" onclick="event.stopPropagation()">
        <input type="number" value="${Math.round(o.opacity * 100)}" step="5" min="0" max="100" data-ov-id="${o.id}" data-ov-prop="_opacity_pct" title="Opacite %" style="${inputStyle}" onclick="event.stopPropagation()">
        <button onclick="event.stopPropagation(); EnderTrack.Overlays.remove(${o.id})" style="background:none; border:none; color:var(--text-general); cursor:pointer; opacity:0.4; font-size:12px;" title="Supprimer">x</button>
      </div>
    `;
  }

  setupDropZone() {
    const zone = document.getElementById('overlayDropZone');
    if (!zone) return;
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = '#ffc107'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = '#444'; });
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.style.borderColor = '#444';
      Array.from(e.dataTransfer.files).forEach(f => this._loadFile(f));
    });
  }

  _loadFile(file) {
    if (!file.type.startsWith('image/') && !file.name.endsWith('.svg')) return;
    const reader = new FileReader();
    reader.onload = (e) => this.add(file.name, e.target.result);
    reader.readAsDataURL(file);
  }

  _handleKey(e) {
    if (!this.isActive) return;
    // Don't intercept if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedId) {
        this.remove(this.selectedId);
      }
    } else if (e.key === 'Escape') {
      this.selectedId = null;
      this.renderUI(); EnderTrack.Canvas?.requestRender?.();
    }
  }

  _groupContextMenu(e, gid) {
    document.getElementById('ovGroupCtxMenu')?.remove();
    const g = this.groups.find(g => g.id === gid);
    if (!g) return;
    const menu = document.createElement('div');
    menu.id = 'ovGroupCtxMenu';
    menu.className = 'axis-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.innerHTML = `
      <button onmousedown="const n=prompt('Nom:','${g.name.replace(/'/g, "\\'")}''); if(n) { EnderTrack.Overlays.renameGroup(${gid},n); EnderTrack.Overlays.renderUI(); } this.parentElement.remove()">Renommer</button>
      <button onmousedown="EnderTrack.Overlays.toggleGroupVisible(${gid}); this.parentElement.remove()">${g.visible ? 'Masquer' : 'Afficher'}</button>
      <button onmousedown="if(confirm('Vider les overlays ?')) EnderTrack.Overlays.clearGroup(); this.parentElement.remove()">Vider</button>
      <div class="ctx-separator"></div>
      <button onmousedown="if(confirm('Supprimer ?')) EnderTrack.Overlays.removeGroup(${gid}); this.parentElement.remove()">Supprimer</button>
    `;
    document.body.appendChild(menu);
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Overlays = new OverlayManager();
