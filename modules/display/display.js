// modules/display/display.js — Viewport manager (split stage/camera)

class DisplayModule {
  constructor() {
    this.layout = 'single'; // 'single' | 'split-h' | 'split-v'
    this._liveCanvas = null;
    this._liveCtx = null;
    this._liveContainer = null;
    this._pollTimer = null;
    this._frameListener = null;
  }

  // === LAYOUT ===

  setLayout(mode) {
    this.layout = mode;
    this._applyLayout();
  }

  toggleSplit() {
    this.setLayout(this.layout === 'single' ? 'split-h' : 'single');
  }

  _applyLayout() {
    const wrapper = document.getElementById('canvasWrapper') || document.getElementById('mainCanvas')?.parentElement;
    if (!wrapper) return;

    // Remove existing live container
    this._destroyLive();

    if (this.layout === 'single') {
      wrapper.style.display = '';
      wrapper.style.gridTemplateColumns = '';
      return;
    }

    // Create split
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = this.layout === 'split-h' ? '1fr 1fr' : '1fr';
    wrapper.style.gridTemplateRows = this.layout === 'split-v' ? '1fr 1fr' : '1fr';

    this._liveContainer = document.createElement('div');
    this._liveContainer.id = 'liveViewContainer';
    this._liveContainer.style.cssText = 'position:relative; background:#111; display:flex; align-items:center; justify-content:center; overflow:hidden; border-left:1px solid #333;';

    this._liveCanvas = document.createElement('canvas');
    this._liveCanvas.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain;';
    this._liveContainer.appendChild(this._liveCanvas);
    this._liveCtx = this._liveCanvas.getContext('2d');

    // "No camera" placeholder
    const placeholder = document.createElement('div');
    placeholder.id = 'livePlaceholder';
    placeholder.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#555; font-size:12px; pointer-events:none;';
    placeholder.textContent = '📷 Live view';
    this._liveContainer.appendChild(placeholder);

    wrapper.appendChild(this._liveContainer);

    // Start listening to camera frames
    this._startLive();
  }

  _startLive() {
    this._stopLive();
    const camera = window.EnderTrack?.Camera;
    if (!camera) return;

    this._frameListener = (frame) => this._renderFrame(frame);
    camera.onFrame(this._frameListener);

    // Also poll if camera is in live mode but not emitting
    this._pollTimer = setInterval(async () => {
      if (!camera.live) return;
      const frame = await camera.getFrame();
      if (frame) this._renderFrame(frame);
    }, 250);
  }

  _stopLive() {
    if (this._frameListener && window.EnderTrack?.Camera) {
      window.EnderTrack.Camera.offFrame(this._frameListener);
      this._frameListener = null;
    }
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  }

  _renderFrame(frame) {
    if (!this._liveCanvas || !this._liveCtx || !frame?.frame) return;
    const img = new Image();
    img.onload = () => {
      this._liveCanvas.width = img.width;
      this._liveCanvas.height = img.height;
      this._liveCtx.drawImage(img, 0, 0);
      // Hide placeholder
      const ph = document.getElementById('livePlaceholder');
      if (ph) ph.style.display = 'none';
    };
    img.src = 'data:image/jpeg;base64,' + frame.frame;
  }

  _destroyLive() {
    this._stopLive();
    if (this._liveContainer) {
      this._liveContainer.remove();
      this._liveContainer = null;
      this._liveCanvas = null;
      this._liveCtx = null;
    }
  }

  getStatus() {
    return { layout: this.layout, liveActive: !!this._frameListener };
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Display = new DisplayModule();
