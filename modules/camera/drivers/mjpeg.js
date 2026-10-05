// modules/camera/drivers/mjpeg.js — MJPEG polling camera driver

class MjpegCameraDriver {
  constructor(camera) {
    this.camera = camera;
    this._img = null;
    this._canvas = null;
    this._ctx = null;
    this._live = false;
    this._timer = null;
    this._failCount = 0;
    this.streamUrl = '';
    this._frameUrl = '';
  }

  async init(config) {
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._img = document.createElement('img');
    this._img.style.cssText = 'width:100%; height:100%; object-fit:contain; background:#000;';
    if (config.streamUrl) this._setUrls(config.streamUrl);
    return true;
  }

  _setUrls(url) {
    this.streamUrl = url;
    // Derive frame URL: replace /stream with /frame
    if (url.includes('/stream')) {
      this._frameUrl = url.replace('/stream', '/frame');
    } else {
      this._frameUrl = url + '/frame';
    }
  }

  async configure(config) {
    if (config.streamUrl) {
      this._setUrls(config.streamUrl);
      if (this._live) { await this.stopLive(); await this.startLive(); }
    }
    return { success: true, config };
  }

  async startLive() {
    if (!this._frameUrl) return false;
    this._live = true;
    this._poll();
    return true;
  }

  async stopLive() {
    this._live = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  _poll() {
    if (!this._live) return;
    const t0 = Date.now();
    fetch(this._frameUrl + '?t=' + t0)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(blob => {
        if (!this._live) return;
        const url = URL.createObjectURL(blob);
        const prev = this._img.src;
        this._img.onload = () => {
          this._frameTs = Date.now();
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          this._failCount = 0;
          this.camera._emitFrame({ width: this._img.naturalWidth, height: this._img.naturalHeight, timestamp: this._frameTs });
          const elapsed = Date.now() - t0;
          const delay = Math.max(30, 200 - elapsed);
          this._timer = setTimeout(() => this._poll(), delay);
        };
        this._img.onerror = () => {
          this._failCount++;
          if (this._failCount >= 10) { this.camera._onDriverError(); return; }
          this._timer = setTimeout(() => this._poll(), 500);
        };
        this._img.src = url;
      })
      .catch(() => {
        if (!this._live) return;
        this._failCount++;
        if (this._failCount >= 10) { this.camera._onDriverError(); return; }
        this._timer = setTimeout(() => this._poll(), 1000);
      });
  }

  async capture(params) {
    const frame = this._grabFrame();
    if (!frame) return { success: false, error: 'No frame available' };
    return { success: true, frame: frame.frame, width: frame.width, height: frame.height, path: params.path, format: params.format || 'jpeg' };
  }

  async getFrame() {
    return this._grabFrame();
  }

  _grabFrame() {
    if (!this._img || !this._img.naturalWidth) return null;
    const w = this._img.naturalWidth, h = this._img.naturalHeight;
    this._canvas.width = w; this._canvas.height = h;
    try {
      this._ctx.drawImage(this._img, 0, 0);
      const b64 = this._canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      return { frame: b64, width: w, height: h, timestamp: this._frameTs || 0 };
    } catch (e) { return null; }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.CameraDrivers = window.EnderTrack.CameraDrivers || {};
window.EnderTrack.CameraDrivers.mjpeg = MjpegCameraDriver;
