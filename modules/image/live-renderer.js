// modules/image/live-renderer.js — Real-time contrast/LUT on live video feed

class LiveRenderer {
  constructor() {
    this._canvas = null;
    this._ctx = null;
    this._video = null;
    this._running = false;
    this._animId = null;
    this.min = 0;
    this.max = 255;
    this._maxVal = 255;
    this._dataMin = 0;
    this._dataMax = 255;
    this.lutId = 'gray';
    this._lutTable = null;
    this.enabled = false; // only process when enabled (not passthrough)
  }

  setCanvas(canvas) {
    this._canvas = canvas;
    this._ctx = canvas?.getContext('2d') || null;
  }

  setVideo(video) {
    this._video = video;
  }

  setContrast(min, max) {
    this.min = min;
    this.max = max;
  }

  setLut(lutId) {
    this.lutId = lutId;
    const def = window.CameraLUTs?.[lutId];
    this._lutTable = (def && lutId !== 'gray') ? def.generate() : null;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._loop();
  }

  stop() {
    this._running = false;
    if (this._animId) { cancelAnimationFrame(this._animId); this._animId = null; }
  }

  _loop() {
    if (!this._running) return;
    this._renderFrame();
    this._animId = requestAnimationFrame(() => this._loop());
  }

  _renderFrame() {
    if (!this._video || !this._canvas || !this._ctx) return;
    if (this._video.readyState < 2 || !this._video.videoWidth) return;

    const w = this._video.videoWidth, h = this._video.videoHeight;
    if (this._canvas.width !== w) this._canvas.width = w;
    if (this._canvas.height !== h) this._canvas.height = h;

    // If no processing needed, just draw video directly
    if (!this.enabled || (!this._lutTable && this.min === 0 && this.max === 255)) {
      this._ctx.drawImage(this._video, 0, 0);
      return;
    }

    // Draw video to canvas, get pixels, apply contrast/LUT
    this._ctx.drawImage(this._video, 0, 0);
    const imgData = this._ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const min = this.min, max = this.max;
    const range = Math.max(1, max - min);
    const lut = this._lutTable;

    for (let i = 0; i < data.length; i += 4) {
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
      const stretched = Math.max(0, Math.min(255, Math.round(((lum - min) / range) * 255)));
      if (lut) {
        const c = lut[stretched];
        data[i] = c[0]; data[i+1] = c[1]; data[i+2] = c[2];
      } else {
        data[i] = stretched; data[i+1] = stretched; data[i+2] = stretched;
      }
    }
    this._ctx.putImageData(imgData, 0, 0);
  }

  // Get current frame data for histogram
  getFrameData() {
    if (!this._video || this._video.readyState < 2) return null;
    const w = Math.min(this._video.videoWidth, 320);
    const h = Math.min(this._video.videoHeight, 240);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(this._video, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.LiveRenderer = new LiveRenderer();
