// modules/light/drivers/arduino.js — Arduino Enderlights driver (USB serial via Flask)

class ArduinoLightDriver {
  constructor(light) {
    this.light = light;
    this._channels = [
      { id: 'ring', name: 'Ring', type: 'arduino', intensity: 0, on: false, r: 20, g: 20, b: 20 }
    ];
    this._base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
  }

  async init() {
    try {
      const res = await fetch(`${this._base}/api/arduino-light/status`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (data.connected) {
        this._channels[0].r = data.r || 20;
        this._channels[0].g = data.g || 20;
        this._channels[0].b = data.b || 20;
        this._channels[0].intensity = data.intensity || 0;
        this._channels[0].on = data.shutter || false;
      }
      return true;
    } catch {
      return true; // still usable in simulation
    }
  }

  getChannels() {
    return this._channels.map(c => ({ ...c }));
  }

  async setChannel(channelId, intensity) {
    const ch = this._channels.find(c => c.id === channelId);
    if (!ch) return false;
    ch.intensity = intensity;
    ch.on = intensity > 0;
    try {
      await fetch(`${this._base}/api/arduino-light/${ch.on ? 'on' : 'off'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intensity, r: ch.r, g: ch.g, b: ch.b })
      });
    } catch {}
    return true;
  }

  async setColor(channelId, r, g, b) {
    const ch = this._channels.find(c => c.id === channelId);
    if (!ch) return false;
    ch.r = r; ch.g = g; ch.b = b;
    try {
      await fetch(`${this._base}/api/arduino-light/color`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r, g, b })
      });
    } catch {}
    return true;
  }

  async setMode(mode, parameter) {
    try {
      await fetch(`${this._base}/api/arduino-light/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, parameter })
      });
    } catch {}
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.LightDrivers = window.EnderTrack.LightDrivers || {};
window.EnderTrack.LightDrivers.arduino = ArduinoLightDriver;
