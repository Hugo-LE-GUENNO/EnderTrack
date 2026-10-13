// modules/camera/drivers/simulation.js — Simulated camera driver

class SimulationCameraDriver {
  constructor(camera) {
    this.camera = camera;
    this._live = false;
    this._timer = null;
    this._canvas = null;
    this._beads = this._generateBeads(80);
  }

  _generateBeads(n) {
    const beads = [];
    let rng = 42;
    const rand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0xffffffff; };
    for (let i = 0; i < n; i++) {
      beads.push({ x: rand() * 300, y: rand() * 300, r: 0.05 + rand() * 0.15, brightness: 0.5 + rand() * 0.5 });
    }
    return beads;
  }

  async init(config) { return true; }
  async configure(config) { return { success: true, config }; }

  async capture(params) {
    const frame = this._generateFrame();
    return { success: true, frame, width: 320, height: 240, path: params.path, format: params.format || 'tiff', simulated: true };
  }

  async startLive() {
    this._live = true;
    if (!this._offscreen) {
      this._offscreen = document.createElement('canvas');
      this._offscreen.width = 320; this._offscreen.height = 240;
    }
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this._tick(), 100);
    return true;
  }

  async stopLive() {
    this._live = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  async getFrame() {
    return { frame: this._generateFrame(), width: 320, height: 240, timestamp: Date.now() };
  }

  _tick() {
    if (!this._live || !this._offscreen) return;
    this._drawToCanvas(this._offscreen);
    if (this._displayCanvas) {
      this._displayCanvas.getContext('2d').drawImage(this._offscreen, 0, 0);
    }
    const hist = window.EnderTrack?.Camera?.histogram;
    if (hist) {
      const data = this._offscreen.getContext('2d').getImageData(0, 0, 320, 240).data;
      hist.updateFromImageData(data, true);
    }
  }

  _drawToCanvas(canvas) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    const state = window.EnderTrack?.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
    const camCfg = this.camera.picamConfig || {};
    const exposure = camCfg.exposure || 200000;
    const gain = camCfg.gain || 4.0;
    const brightMul = Math.min((exposure / 100000) * gain * 0.5, 12.0);
    const scale = 20;
    const ox = (state.x || 0) * scale;
    const oy = (state.y || 0) * scale;
    const blurPx = Math.abs((state.z || 0) - 10.0) * 3;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    for (const b of this._beads) {
      const px = b.x * scale - ox + W / 2;
      const py = b.y * scale - oy + H / 2;
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
      const r = Math.max(1, b.r * scale + blurPx);
      const alpha = Math.min(1, b.brightness * brightMul * 0.8);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Contrast from histogram
    const imgData = ctx.getImageData(0, 0, W, H);
    const d = imgData.data;
    const renderer = window.EnderTrack?.LiveRenderer;
    const min = renderer?.min ?? 0;
    const max = renderer?.max ?? 255;
    const range = Math.max(1, max - min);
    const lut = renderer?._lutTable ?? null;
    for (let i = 0; i < d.length; i += 4) {
      let v = Math.min(255, d[i] + ((Math.random() * 6) | 0));
      v = Math.max(0, Math.min(255, Math.round((v - min) / range * 255)));
      if (lut) { const c = lut[v]; d[i]=c[0]; d[i+1]=c[1]; d[i+2]=c[2]; }
      else { d[i]=v; d[i+1]=v; d[i+2]=v; }
      d[i+3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  _generateFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    this._drawToCanvas(canvas);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.CameraDrivers = window.EnderTrack.CameraDrivers || {};
window.EnderTrack.CameraDrivers.simulation = SimulationCameraDriver;
