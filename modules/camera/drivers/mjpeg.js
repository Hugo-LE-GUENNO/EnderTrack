// modules/camera/drivers/mjpeg.js — MJPEG stream camera driver

class MjpegCameraDriver {
  constructor(camera) {
    this.camera = camera;
    this._img = null;
    this._canvas = null;
    this._ctx = null;
    this._live = false;
    this._timer = null;
    this.streamUrl = '';
  }

  async init(config) {
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._img = document.createElement('img');
    this._img.crossOrigin = 'anonymous';
    this._img.style.display = 'none';
    document.body.appendChild(this._img);
    if (config.streamUrl) this.streamUrl = config.streamUrl;
    return true;
  }

  async configure(config) {
    if (config.streamUrl) {
      this.streamUrl = config.streamUrl;
      // Restart stream if live
      if (this._live) {
        await this.stopLive();
        await this.startLive();
      }
    }
    return { success: true, config };
  }

  async startLive() {
    if (!this.streamUrl) return false;
    this._live = true;
    // MJPEG: just set img src to stream URL — browser handles the stream
    this._img.src = this.streamUrl;
    // Poll frames from the img element
    this._timer = setInterval(() => {
      if (!this._live) return;
      const frame = this._grabFrame();
      if (frame) this.camera._emitFrame(frame);
    }, 200);
    return true;
  }

  async stopLive() {
    this._live = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._img.src = '';
  }

  async capture(params) {
    const frame = this._grabFrame();
    if (!frame) return { success: false, error: 'No frame available' };
    return {
      success: true,
      frame: frame.frame,
      width: frame.width,
      height: frame.height,
      path: params.path,
      format: params.format || 'jpeg'
    };
  }

  async getFrame() {
    return this._grabFrame();
  }

  _grabFrame() {
    if (!this._img || !this._img.naturalWidth) return null;
    const w = this._img.naturalWidth;
    const h = this._img.naturalHeight;
    this._canvas.width = w;
    this._canvas.height = h;
    try {
      this._ctx.drawImage(this._img, 0, 0);
      const b64 = this._canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      return { frame: b64, width: w, height: h, timestamp: Date.now() };
    } catch (e) {
      // CORS or tainted canvas
      return null;
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.CameraDrivers = window.EnderTrack.CameraDrivers || {};
window.EnderTrack.CameraDrivers.mjpeg = MjpegCameraDriver;
