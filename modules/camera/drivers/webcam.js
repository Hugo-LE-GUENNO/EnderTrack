// modules/camera/drivers/webcam.js — Browser webcam driver (USB/built-in)

class WebcamCameraDriver {
  constructor(camera) {
    this.camera = camera;
    this._stream = null;
    this._live = false;
    this.deviceId = null;
  }

  async init(config) {
    if (config.deviceId) this.deviceId = config.deviceId;
    return true;
  }

  async configure(config) {
    if (config.deviceId) this.deviceId = config.deviceId;
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
          ? { deviceId: { exact: this.deviceId }, width: 1280, height: 720 }
          : { width: 1280, height: 720 }
      };
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      this._live = true;
      return true;
    } catch (e) {
      console.warn('[Webcam] startLive failed:', e.message);
      return false;
    }
  }

  async stopLive() {
    this._live = false;
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
  }

  async capture(params) {
    const frame = await this.getFrame();
    if (!frame) return { success: false, error: 'No frame' };
    return { success: true, frame: frame.frame, width: frame.width, height: frame.height, path: params.path, format: params.format || 'jpeg' };
  }

  async getFrame() {
    // Find the video element displaying our stream (in viewport)
    const video = this._findVideoElement();
    if (!video || video.readyState < 2) return null;
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    return { frame: b64, width: w, height: h, timestamp: Date.now() };
  }

  _findVideoElement() {
    // Find video element in viewport that has our stream
    const videos = document.querySelectorAll('.viewport-cell video');
    for (const v of videos) {
      if (v.srcObject === this._stream) return v;
    }
    return null;
  }

  static async listDevices() {
    try {
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
