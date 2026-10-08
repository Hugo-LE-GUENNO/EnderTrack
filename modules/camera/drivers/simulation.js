// modules/camera/drivers/simulation.js — Simulated camera driver

class SimulationCameraDriver {
  constructor(camera) {
    this.camera = camera;
    this._live = false;
    this._timer = null;
    this._frameCount = 0;
  }

  async init(config) {
    return true;
  }

  async configure(config) {
    return { success: true, config };
  }

  async capture(params) {
    const frame = this._generateFrame();
    this._frameCount++;
    return {
      success: true,
      frame,
      width: this.camera.config.resolution[0],
      height: this.camera.config.resolution[1],
      path: params.path,
      format: params.format || 'tiff',
      simulated: true
    };
  }

  async startLive() {
    this._live = true;
    this._timer = setInterval(() => {
      if (!this._live) return;
      const frame = this._generateFrame();
      this._frameCount++;
      this.camera._emitFrame({
        frame,
        width: this.camera.config.resolution[0],
        height: this.camera.config.resolution[1],
        timestamp: Date.now()
      });
    }, 200);
    return true;
  }

  async stopLive() {
    this._live = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  async getFrame() {
    return {
      frame: this._generateFrame(),
      width: this.camera.config.resolution[0],
      height: this.camera.config.resolution[1],
      timestamp: Date.now()
    };
  }

  _generateFrame() {
    // Generate a small noise pattern as base64 JPEG placeholder
    const w = 160, h = 120;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const pos = window.EnderTrack?.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
    for (let i = 0; i < img.data.length; i += 4) {
      const px = (i / 4) % w, py = Math.floor((i / 4) / w);
      // Noise + position-dependent pattern
      const v = (Math.random() * 30 + 20 +
        Math.sin((px + pos.x * 10) * 0.1) * 20 +
        Math.cos((py + pos.y * 10) * 0.1) * 20) | 0;
      img.data[i] = v;
      img.data[i + 1] = v + 10;
      img.data[i + 2] = v + 5;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.CameraDrivers = window.EnderTrack.CameraDrivers || {};
window.EnderTrack.CameraDrivers.simulation = SimulationCameraDriver;
