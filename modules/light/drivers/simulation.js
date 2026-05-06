// modules/light/drivers/simulation.js — Simulated light driver

class SimulationLightDriver {
  constructor(light) {
    this.light = light;
    this._channels = [];
  }

  async init() {
    return true;
  }

  getChannels() {
    return this._channels.map(c => ({ ...c }));
  }

  async setChannel(channelId, intensity) {
    const ch = this._channels.find(c => c.id === channelId);
    if (!ch) return false;
    ch.intensity = intensity;
    ch.on = intensity > 0;
    return true;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.LightDrivers = window.EnderTrack.LightDrivers || {};
window.EnderTrack.LightDrivers.simulation = SimulationLightDriver;
