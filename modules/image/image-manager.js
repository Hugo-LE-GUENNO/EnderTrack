// modules/image/image-manager.js — Image layer & gallery manager

class ImageManager {
  constructor() {
    this.layers = []; // [{id, src, x, y, width, height, opacity, visible, timestamp, name}]
    this.gallery = []; // [{path, name, size, mtime}]
    this.selectedId = null;
    this._galleryIdx = 0;
    this.isActive = false;
  }

  activate() {
    this.isActive = true;
    this.renderUI();
    this.loadGallery();
    this._renderMetadata();
    this._onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.key === 'ArrowUp') this.selectGalleryImage(Math.max(0, this._galleryIdx - 1));
        else this.selectGalleryImage(Math.min(this.gallery.length - 1, this._galleryIdx + 1));
      }
    };
    document.addEventListener('keydown', this._onKey, true);
    if (window.EnderTrack?.Canvas) window.EnderTrack.Canvas.clickAndGoEnabled = false;
  }

  deactivate() {
    this.isActive = false;
    if (this._onKey) { document.removeEventListener('keydown', this._onKey, true); this._onKey = null; }
    const panel = document.getElementById('imageMetadataPanel');
    if (panel) panel.style.display = 'none';
  }

  // === GALLERY ===

  async loadGallery() {
    try {
      const url = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      const res = await fetch(url + '/api/gallery');
      const data = await res.json();
      this.gallery = data.files || [];
      this._renderGallery();
    } catch(e) { this.gallery = []; }
  }

  selectGalleryImage(idx) {
    this._galleryIdx = idx;
    this._renderGallery();
    this._renderMetadata();
    this._updateGalleryViewport();
    // If TIFF selected, open in stack viewer
    const img = this.getSelectedImage();
    if (img && (img.name.endsWith('.tiff') || img.name.endsWith('.tif'))) {
      window.EnderTrack?.StackViewer?.open?.(img.path);
    }
  }

  getSelectedImage() {
    return this.gallery[this._galleryIdx] || null;
  }

  // === CANVAS LAYERS ===

  addLayer(src, x, y, width, height, name) {
    const layer = {
      id: Date.now(),
      src, x, y, width, height,
      opacity: 1, visible: true,
      timestamp: new Date().toISOString(),
      name: name || 'Image'
    };
    this.layers.push(layer);
    this.renderUI();
    EnderTrack.Canvas?.requestRender?.();
  }

  removeLayer(id) {
    this.layers = this.layers.filter(l => l.id !== id);
    this.renderUI();
    EnderTrack.Canvas?.requestRender?.();
  }

  toggleLayer(id) {
    const l = this.layers.find(l => l.id === id);
    if (l) { l.visible = !l.visible; this.renderUI(); EnderTrack.Canvas?.requestRender?.(); }
  }

  setLayerOpacity(id, opacity) {
    const l = this.layers.find(l => l.id === id);
    if (l) { l.opacity = opacity; EnderTrack.Canvas?.requestRender?.(); }
  }

  // Render layers on canvas (called by canvas render pipeline)
  renderOnCanvas(ctx, coords) {
    this.layers.forEach(l => {
      if (!l.visible || !l._img) return;
      const tl = coords.mapToCanvas(l.x, l.y + l.height);
      const br = coords.mapToCanvas(l.x + l.width, l.y);
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l._img, tl.cx, tl.cy, br.cx - tl.cx, br.cy - tl.cy);
      ctx.globalAlpha = 1;
    });
  }

  // === VIEWPORT SOURCE ===

  renderInViewport(container) {
    // Use a dedicated wrapper to avoid destroying other content (canvas, z-panel)
    let wrap = container.querySelector('.gallery-viewport-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'gallery-viewport-wrap';
      wrap.style.cssText = 'position:absolute; inset:0; z-index:10;';
      container.appendChild(wrap);
    }
    const img = this.getSelectedImage();
    if (!img) {
      wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:11px;">Aucune image</div>';
      return;
    }
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/gallery/thumb/' + img.path;
    wrap.innerHTML = `
      <div style="position:relative; width:100%; height:100%; display:flex; flex-direction:column; background:#000;">
        <img src="${url}" style="flex:1; object-fit:contain; min-height:0;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; background:#1a1a1a; font-size:10px; color:var(--text-general);">
          <button onclick="EnderTrack.ImageManager.selectGalleryImage(${this._galleryIdx - 1 >= 0 ? this._galleryIdx - 1 : 0})" style="border:none;background:none;color:var(--text-general);cursor:pointer;font-size:14px;">&#9664;</button>
          <span>${img.name} (${this._galleryIdx + 1}/${this.gallery.length})</span>
          <button onclick="EnderTrack.ImageManager.selectGalleryImage(${Math.min(this._galleryIdx + 1, this.gallery.length - 1)})" style="border:none;background:none;color:var(--text-general);cursor:pointer;font-size:14px;">&#9654;</button>
        </div>
      </div>`;
  }

  _updateGalleryViewport() {
    // Find viewport with gallery source and re-render
    const display = window.EnderTrack?.Display;
    if (!display) return;
    display.viewports.forEach(vp => {
      if (vp.source === 'gallery') {
        const cell = vp.id === 0 ? display._stageWrap : display._cells.get(vp.id);
        if (cell) this.renderInViewport(cell);
      }
    });
  }

  // === UI ===

  renderUI() {
    const container = document.getElementById('imageTabContent');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; padding:8px;">
        <div style="font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#666;">Calque caméra</div>
        <div id="imageLayerTable">
          ${this.layers.length ? this.layers.map(l => `
            <div style="display:flex; align-items:center; gap:6px; padding:4px; font-size:10px; border-bottom:1px solid #222;">
              <input type="checkbox" ${l.visible ? 'checked' : ''} onchange="EnderTrack.ImageManager.toggleLayer(${l.id})" style="margin:0;">
              <span style="flex:1; color:var(--text-general); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${l.name}</span>
              <input type="range" min="0" max="1" step="0.1" value="${l.opacity}" oninput="EnderTrack.ImageManager.setLayerOpacity(${l.id}, parseFloat(this.value))" style="width:50px;">
              <button onclick="EnderTrack.ImageManager.removeLayer(${l.id})" style="border:none;background:none;color:#666;cursor:pointer;font-size:10px;">x</button>
            </div>
          `).join('') : '<div style="text-align:center; color:#555; font-size:10px; padding:8px;">Aucune image sur le canvas</div>'}
        </div>

        <div style="border-top:1px solid #333; padding-top:8px;">
          <div style="font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#666; margin-bottom:4px;">Galerie</div>
          <div id="imageGalleryList"></div>
        </div>
      </div>`;

    this._renderGallery();
  }

  _renderGallery() {
    const el = document.getElementById('imageGalleryList');
    if (!el) return;

    if (!this.gallery.length) {
      el.innerHTML = '<div style="text-align:center; color:#555; font-size:10px; padding:8px;">Aucune capture</div>';
      return;
    }

    el.innerHTML = `
      <input type="text" placeholder="Rechercher..." oninput="EnderTrack.ImageManager._filterGallery(this.value)"
        style="width:100%; padding:4px 6px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px; margin-bottom:4px;">
      <div style="max-height:200px; overflow-y:auto;">
        ${this.gallery.map((f, i) => `
          <div onclick="EnderTrack.ImageManager.selectGalleryImage(${i})" style="display:flex; align-items:center; gap:6px; padding:4px; cursor:pointer; font-size:10px; background:${i === this._galleryIdx ? 'var(--app-bg)' : 'transparent'}; border-radius:3px;">
            <span style="color:var(--coordinates-color); width:20px; text-align:right;">${i + 1}</span>
            <span style="flex:1; color:var(--text-general); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.name}</span>
            <span style="color:#666; font-size:9px;">${(f.size / 1024).toFixed(0)}k</span>
          </div>
        `).join('')}
      </div>`;
  }

  _filterGallery(query) {
    const el = document.getElementById('imageGalleryList');
    if (!el) return;
    const items = el.querySelectorAll('[onclick]');
    const q = query.toLowerCase();
    items.forEach((item, i) => {
      const name = this.gallery[i]?.name || '';
      item.style.display = name.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  _renderMetadata() {
    const panel = document.getElementById('imageMetadataPanel');
    if (!panel) return;
    panel.style.display = 'block';
    const img = this.getSelectedImage();
    if (!img) { panel.innerHTML = '<div style="font-size:10px; color:#555; padding:8px;">Aucune image</div>'; return; }
    const match = img.name.match(/X([\d.]+)_Y([\d.]+)_Z([\d.]+)/);
    const pos = match ? { x: match[1], y: match[2], z: match[3] } : null;
    panel.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px; padding:4px;">
        <div style="font-size:10px; color:var(--text-general); display:flex; flex-direction:column; gap:3px;">
          <strong style="color:var(--text-selected); word-break:break-all;">${img.name}</strong>
          ${pos ? `<div style="font-family:monospace; color:var(--coordinates-color);">X${pos.x} Y${pos.y} Z${pos.z}</div>` : ''}
          <div>Taille: ${(img.size / 1024).toFixed(1)} Ko</div>
          <div>Date: ${new Date(img.mtime * 1000).toLocaleString()}</div>
        </div>
      </div>`;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ImageManager = new ImageManager();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { EnderTrack.ImageManager.renderUI(); EnderTrack.ImageManager.loadGallery(); });
} else {
  setTimeout(() => { EnderTrack.ImageManager.renderUI(); EnderTrack.ImageManager.loadGallery(); }, 200);
}
