// modules/image/stack-viewer.js — Multi-dimensional TIFF stack viewer

class StackViewer {
  constructor() {
    this._file = null;
    this._info = null; // {pages, width, height, mode}
    this._index = 0;
    this._container = null;
  }

  async open(filepath) {
    this._file = filepath;
    this._index = 0;
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
    try {
      const res = await fetch(url + '/api/stack/info?file=' + encodeURIComponent(filepath));
      this._info = await res.json();
      if (this._info.error) { console.warn('[Stack]', this._info.error); return false; }
      this._renderViewport();
      return true;
    } catch(e) { return false; }
  }

  setIndex(idx) {
    if (!this._info) return;
    this._index = Math.max(0, Math.min(idx, this._info.pages - 1));
    this._updateImage();
    // Update renderer with raw data for this page
    const renderer = window.EnderTrack?.GalleryRenderer;
    if (renderer && this._file) {
      renderer.loadRaw(this._file, this._index);
    }
    // Update histogram
    const img = window.EnderTrack?.ImageManager?.getSelectedImage?.();
    if (img) window.EnderTrack?.ImageManager?._updateHistogram?.(img);
  }

  renderInViewport(container) {
    this._container = container;
    let wrap = container.querySelector('.stack-viewport-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'stack-viewport-wrap';
      wrap.style.cssText = 'position:absolute; inset:0; z-index:10; display:flex; flex-direction:column; background:#000;';
      container.appendChild(wrap);
    }

    if (!this._file) {
      wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:11px;">Aucun stack ouvert</div>';
      return;
    }

    this._renderViewport();
  }

  _renderViewport() {
    const wrap = this._container?.querySelector('.stack-viewport-wrap');
    if (!wrap) return;
    const info = this._info;
    if (!info || info.error) {
      wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:11px;">Erreur stack</div>';
      return;
    }

    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
    const imgUrl = url + '/api/stack/page?file=' + encodeURIComponent(this._file) + '&index=' + this._index;

    wrap.innerHTML = `
      <img id="stackImg" src="${imgUrl}" style="flex:1; object-fit:contain; min-height:0; background:#000;">
      <div style="padding:4px 8px; background:#1a1a1a; display:flex; align-items:center; gap:8px;">
        <input type="range" id="stackSlider" min="0" max="${info.pages - 1}" value="${this._index}"
          oninput="EnderTrack.StackViewer.setIndex(parseInt(this.value))"
          style="flex:1; height:4px; cursor:pointer;">
        <span style="font-size:10px; color:var(--text-general); min-width:50px; text-align:right;" id="stackLabel">${this._index + 1} / ${info.pages}</span>
      </div>`;

    // Mouse wheel navigation
    wrap.onwheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      this.setIndex(this._index + delta);
    };
  }

  _updateImage() {
    const img = document.getElementById('stackImg');
    const slider = document.getElementById('stackSlider');
    const label = document.getElementById('stackLabel');
    if (!img || !this._file) return;

    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
    img.src = url + '/api/stack/page?file=' + encodeURIComponent(this._file) + '&index=' + this._index;
    if (slider) slider.value = this._index;
    if (label) label.textContent = (this._index + 1) + ' / ' + this._info.pages;
  }

  // Update gallery viewport if stack source is active
  _updateStackViewport() {
    const display = window.EnderTrack?.Display;
    if (!display) return;
    display.viewports.forEach(vp => {
      if (vp.source === 'stack') {
        const cell = vp.id === 0 ? display._stageWrap : display._cells.get(vp.id);
        if (cell) this.renderInViewport(cell);
      }
    });
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.StackViewer = new StackViewer();
