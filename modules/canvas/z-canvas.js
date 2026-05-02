// modules/canvas/z-canvas.js - Z Canvas orchestrator

class ZVisualization {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isInitialized = false;
    this.zRange = 200;
    this.zPan = 0;
    this.mouseZ = null;
    this.resizePending = false;
    this.zCompassHovered = false;
    this.zCompassBounds = null;

    this.interactions = new window.EnderTrack.ZInteractions(this);
  }

  init() {
    const zPanel = document.getElementById('zVisualizationPanel');
    if (!zPanel) { console.error('❌ Z panel element not found!'); return false; }

    zPanel.style.display = 'flex';
    zPanel.style.visibility = 'visible';

    this._setupCanvas();
    this._setupListeners();
    this._resetZoom();
    this._addInitialPosition();

    this.isInitialized = true;
    setTimeout(() => this.render(), 100);
    return true;
  }

  // ── Setup ──────────────────────────────────────────────────

  _setupCanvas() {
    const zScale = document.getElementById('zScale');
    if (!zScale) return;

    zScale.innerHTML = '';
    this.canvas = document.createElement('canvas');
    this.canvas.width = 80;
    this.canvas.style.cssText = 'width:100%; height:100%; cursor:crosshair;';
    this.ctx = this.canvas.getContext('2d');
    zScale.appendChild(this.canvas);

    setTimeout(() => {
      this.canvas.height = zScale.offsetHeight;
      this.render();
    }, 50);
  }

  _setupListeners() {
    const E = window.EnderTrack.Events;
    const renderEvents = ['state:changed', 'position:changed', 'movement:started', 'movement:completed'];
    renderEvents.forEach(ev => E?.on?.(ev, () => this.render()));

    E?.on?.('history:cleared', () => {
      const state = window.EnderTrack.State.get();
      this.zRange = 50 / (state.zZoom || 1);
      setTimeout(() => this.render(), 50);
    });

    E?.on?.('plateau:changed', () => this._resetZoom());

    ['inputZ', 'sensitivityZ'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.render());
    });

    ['relativeTab', 'absoluteTab'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => setTimeout(() => this.render(), 50));
    });

    // Resize observer
    if (this.canvas && window.ResizeObserver) {
      const content = document.querySelector('.canvas-content');
      if (content) {
        this.resizeObserver = new ResizeObserver(() => {
          if (!this.resizePending) {
            this.resizePending = true;
            requestAnimationFrame(() => { this.resize(); this.resizePending = false; });
          }
        });
        this.resizeObserver.observe(content);
      }
    }

    this.interactions.setupEventListeners();
  }

  _resetZoom() {
    const state = window.EnderTrack.State.get();
    const bounds = state.coordinateBounds || { z: { min: -20, max: 80 } };
    const zRange = bounds.z.max - bounds.z.min;
    const minZoom = this.canvas.height / zRange;
    const center = (bounds.z.min + bounds.z.max) / 2;

    const zoom = Math.max(minZoom, state.zZoom || 0);
    this.zPan = center;
    this.zRange = this.canvas.height / zoom;
    window.EnderTrack.State.update({ zZoom: zoom, zPan: center });

    setTimeout(() => this.render(), 50);
  }

  _addInitialPosition() {
    const state = window.EnderTrack.State.get();
    if (state.positionHistory.length === 0) {
      window.EnderTrack.State.recordFinalPosition(state.pos);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  render() {
    if (!this.isInitialized || !this.ctx) return;
    const state = window.EnderTrack.State.get();

    // Clear
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = window.customColors?.zBackground || '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.zPan = state.zPan || 0;

    const { ZGridRenderer, ZPositionRenderer, ZUIRenderer } = window.EnderTrack;
    if (!ZGridRenderer || !ZPositionRenderer || !ZUIRenderer) return;

    ZGridRenderer.render(this.ctx, this.canvas, state, this.zPan, this.zRange);
    ZPositionRenderer.render(this.ctx, this.canvas, state, this.zPan, this.zRange);
    this.zCompassBounds = ZUIRenderer.render(this.ctx, this.canvas, state, this.zPan, this.zRange, this.zCompassHovered, this.zCompassBounds);

    this.updateZInfo(state);
  }

  updateZInfo(state) {
    const zPos = document.getElementById('zPosition');
    const zZoom = document.getElementById('zZoomLevel');
    const zPan = document.getElementById('zPanLevel');

    if (zPos) zPos.textContent = this.mouseZ !== null ? this.mouseZ.toFixed(1) : '----';

    if (zZoom) {
      const dims = state.plateauDimensions || { z: 100 };
      const min = this.canvas.height / dims.z;
      zZoom.textContent = (state.zZoom || min).toFixed(1) + 'x';
    }

    if (zPan) zPan.textContent = (state.zPan || 0).toFixed(1);
  }

  // ── Click-and-go dialog ────────────────────────────────────

  showZClickDialog(targetZ, screenX, screenY) {
    document.querySelector('.click-and-go-dialog')?.remove();
    this._ensureDialogStyles();

    const dialog = document.createElement('div');
    dialog.className = 'click-and-go-dialog';
    dialog.style.cssText = `position:fixed; left:${screenX + 10}px; top:${screenY - 60}px; z-index:10000;`;
    dialog.innerHTML = `
      <div class="coords"><span>Z</span><b>${targetZ.toFixed(2)}</b></div>
      <div class="btns"><button class="go">Go</button></div>`;
    document.body.appendChild(dialog);
    this._positionDialog(dialog, screenX, screenY);

    dialog.querySelector('.go').onclick = () => {
      const state = window.EnderTrack.State.get();
      window.EnderTrack.Movement?.moveAbsolute(state.pos.x, state.pos.y, targetZ);
      dialog.remove();
    };

    this._autoCloseDialog(dialog);
    dialog.querySelector('.go').focus();
  }

  _ensureDialogStyles() {
    if (document.querySelector('#click-and-go-styles')) return;
    // Try to reuse click-handler's styles
    if (window.EnderTrack?.ClickHandler?.prototype?.addDialogStyles) {
      window.EnderTrack.ClickHandler.prototype.addDialogStyles();
      return;
    }
    const s = document.createElement('style');
    s.id = 'click-and-go-styles';
    s.textContent = `
      .click-and-go-dialog { background:var(--container-bg); border:1px solid #666; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.4); padding:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; min-width:180px; }
      .click-and-go-dialog .coords { display:grid; grid-template-columns:20px 1fr; gap:4px 8px; margin-bottom:10px; font-size:12px; color:var(--text-general); }
      .click-and-go-dialog .coords b { font-family:monospace; color:var(--coordinates-color); font-weight:500; }
      .click-and-go-dialog .btns { display:flex; gap:6px; }
      .click-and-go-dialog button { flex:1; padding:6px; border:none; border-radius:4px; font-size:12px; font-weight:500; cursor:pointer; transition:all 0.15s; }
      .click-and-go-dialog .go { background:var(--active-element); color:var(--text-selected); }
      .click-and-go-dialog .go:hover { background:var(--coordinates-color); color:#000; }`;
    document.head.appendChild(s);
  }

  _positionDialog(dialog, screenX, screenY) {
    const r = dialog.getBoundingClientRect();
    let x = screenX + 10, y = screenY - 60;
    if (r.right > window.innerWidth) x = screenX - r.width - 10;
    if (r.top < 0) y = screenY + 10;
    if (r.bottom > window.innerHeight) y = window.innerHeight - r.height - 10;
    dialog.style.left = x + 'px';
    dialog.style.top = y + 'px';
  }

  _autoCloseDialog(dialog) {
    const close = (e) => {
      if ((e.type === 'keydown' && e.key === 'Escape') || (e.type === 'click' && !dialog.contains(e.target))) {
        dialog.remove();
        document.removeEventListener('keydown', close);
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => {
      document.addEventListener('keydown', close);
      document.addEventListener('click', close);
    }, 100);
  }

  // ── Resize ─────────────────────────────────────────────────

  resize() {
    if (!this.canvas) return;
    const zScale = document.getElementById('zScale');
    if (!zScale) return;

    const h = zScale.offsetHeight;
    if (this.canvas.height === h && this.canvas.width === 80) return;

    this.canvas.width = 80;
    this.canvas.height = h;

    const state = window.EnderTrack.State.get();
    const bounds = state.coordinateBounds || { z: { min: -20, max: 80 } };
    const minZoom = h / (bounds.z.max - bounds.z.min);
    if (state.zZoom < minZoom) window.EnderTrack.State.update({ zZoom: minZoom });
    this.zRange = h / (state.zZoom || minZoom);
    setTimeout(() => this.render(), 10);
  }

  update() { this.render(); }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ZVisualization = new ZVisualization();
