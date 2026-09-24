// modules/image/live-renderer.js — Real-time contrast/LUT on live video feed

class LiveRenderer {
  constructor() {
    this._canvas = null;
    this._ctx = null;
    this._video = null;
    this._img = null;
    this._running = false;
    this._animId = null;
    this.min = 0;
    this.max = 255;
    this.lutId = 'gray';
    this._lutTable = null;
    this.enabled = false;
    this._nativeRenderFrame = this._renderFrame.bind(this);
  }

  setCanvas(canvas) {
    this._canvas = canvas;
    this._ctx = canvas?.getContext('2d') || null;
  }

  setVideo(video) { this._video = video; this._img = null; }
  setImage(img)   { this._img = img;    this._video = null; }

  setContrast(min, max) { this.min = min; this.max = max; }

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
    const src = this._video || this._img;
    if (!src || !this._canvas || !this._ctx) return;

    const isVideo = !!this._video;
    if (isVideo && (this._video.readyState < 2 || !this._video.videoWidth)) return;
    if (!isVideo && !this._img.naturalWidth) return;

    const srcW = isVideo ? this._video.videoWidth  : this._img.naturalWidth;
    const srcH = isVideo ? this._video.videoHeight : this._img.naturalHeight;
    if (!srcW || !srcH) return;

    if (this._canvas.width !== srcW)  this._canvas.width  = srcW;
    if (this._canvas.height !== srcH) this._canvas.height = srcH;

    this._ctx.drawImage(src, 0, 0, srcW, srcH);
    const imgData = this._ctx.getImageData(0, 0, srcW, srcH);
    const data = imgData.data;
    const min = this.min, max = this.max, range = Math.max(1, max - min);
    const lut = this._lutTable;
    for (let i = 0; i < data.length; i += 4) {
      if (lut) {
        const lum = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
        const v = Math.max(0, Math.min(255, Math.round(((lum - min) / range) * 255)));
        const c = lut[v]; data[i]=c[0]; data[i+1]=c[1]; data[i+2]=c[2];
      } else {
        data[i]   = Math.max(0, Math.min(255, Math.round(((data[i]   - min) / range) * 255)));
        data[i+1] = Math.max(0, Math.min(255, Math.round(((data[i+1] - min) / range) * 255)));
        data[i+2] = Math.max(0, Math.min(255, Math.round(((data[i+2] - min) / range) * 255)));
      }
    }
    this._ctx.putImageData(imgData, 0, 0);
  }

  getFrameData() {
    const src = this._video || this._img;
    if (!src) return null;
    if (this._video && this._video.readyState < 2) return null;
    if (this._img && !this._img.naturalWidth) return null;
    const sw = this._video ? this._video.videoWidth  : this._img.naturalWidth;
    const sh = this._video ? this._video.videoHeight : this._img.naturalHeight;
    const w = Math.min(sw, 320), h = Math.min(sh, 240);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    return c.getContext('2d').getImageData(0, 0, w, h).data;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.LiveRenderer = new LiveRenderer();
