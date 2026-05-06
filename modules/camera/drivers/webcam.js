// modules/camera/drivers/webcam.js — Browser webcam driver (USB/built-in)

class WebcamCameraDriver {
  constructor(camera) {
    this.camera = camera;
    this._stream = null;
    this._video = null;
    this._canvas = null;
    this._ctx = null;
    this._live = false;
    this._timer = null;
    this.deviceId = null; // specific device or null for default
  }

  async init(config) {
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._video = document.createElement('video');
    this._video.setAttribute('playsinline', '');
    this._video.muted = true;
    return true;
  }

  async configure(config) {
    if (config.deviceId) this.deviceId = config.deviceId;
    // Restart stream if live with new config
    if (this._live) {
      await this.stopLive();
      await this.startLive();
    }
    return { success: true, config };
  }

  async startLive() {
    try {
      const constraints = {
        video: this.deviceId
          ? { deviceId: { exact: this.deviceId } }
          : { facingMode: 'environment' }
      };
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      this._video.srcObject = this._stream;
      await this._video.play();
      this._live = true;
      // Poll frames
      this._timer = setInterval(() => {
        if (!this._live) return;
        const frame = this._grabFrame();
        if (frame) this.camera._emitFrame(frame);
      }, 200);
      return true;
    } catch (e) {
      console.warn('[Webcam] startLive failed:', e.message);
      return false;
    }
  }

  async stopLive() {
    this._live = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this._video.srcObject = null;
  }

  async capture(params) {
    const frame = this._grabFrame();
    if (!frame) return { success: false, error: 'No frame' };
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
    if (!this._video || !this._video.videoWidth || this._video.readyState < 2) return null;
    const w = this._video.videoWidth;
    const h = this._video.videoHeight;
    this._canvas.width = w;
    this._canvas.height = h;
    this._ctx.drawImage(this._video, 0, 0);
    const b64 = this._canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    return { frame: b64, width: w, height: h, timestamp: Date.now() };
  }

  // List available video devices
  static async listDevices() {
    try {
      // Need permission first
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
      tmp.getTracks().forEach(t => t.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'videoinput').map(d => ({
        id: d.deviceId,
        label: d.label || `Camera ${d.deviceId.slice(0, 8)}`
      }));
    } catch {
      return [];
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.CameraDrivers = window.EnderTrack.CameraDrivers || {};
window.EnderTrack.CameraDrivers.webcam = WebcamCameraDriver;
