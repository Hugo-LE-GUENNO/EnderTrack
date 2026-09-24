// plugins/smart-vision/bridge.js

window.SmartVisionBridge = class SmartVisionBridge {
  constructor() {
    this._base = '/api/plugins/smartVision/vision';
    this._loopTimer = null;
    this._loopInterval = 500; // ms
  }

  async run(script) {
    // Grab current frame from webcam/video in viewport and push it first
    await this._pushFrame();
    const r = await fetch(`${this._base}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script })
    });
    return r.json();
  }

  async getScript() {
    const r = await fetch(`${this._base}/get-script`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return r.json();
  }

  async setScript(script) {
    await fetch(`${this._base}/set-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script })
    });
  }

  startLoop(script, interval, onResult) {
    this.stopLoop();
    this._loopInterval = interval;
    const tick = async () => {
      const res = await this.run(script);
      onResult(res);
      if (this._loopTimer !== null)
        this._loopTimer = setTimeout(tick, this._loopInterval);
    };
    this._loopTimer = setTimeout(tick, 0);
  }

  async _pushFrame() {
    try {
      const b64 = this._grabFrameB64();
      if (!b64) return;
      await fetch(`${this._base}/push-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: b64 })
      });
    } catch (_) {}
  }

  _grabFrameB64() {
    // 1. Webcam: video element in viewport cell
    const video = document.querySelector('.viewport-cell video');
    if (video && video.readyState >= 2 && video.videoWidth) {
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    }
    // 2. MJPEG img element
    const img = document.querySelector('.viewport-cell img[src*="stream"]');
    if (img && img.naturalWidth) {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    }
    // 3. LiveRenderer canvas
    const liveCanvas = document.getElementById('liveDisplayCanvas');
    if (liveCanvas && liveCanvas.width) {
      return liveCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    }
    return null;
  }

  stopLoop() {
    if (this._loopTimer !== null) { clearTimeout(this._loopTimer); this._loopTimer = null; }
    fetch(`${this._base}/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
  }

  async applyMove(move) {
    if (!move) return;
    const body = {};
    if (move.dx !== undefined) body.x = move.dx;
    if (move.dy !== undefined) body.y = move.dy;
    if (move.dz !== undefined) body.z = move.dz;
    if (!Object.keys(body).length) return;
    body.feedrate = move.feedrate || 1000;
    await fetch('/api/move/relative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
}
