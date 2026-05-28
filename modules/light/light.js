// modules/light/light.js — Light abstraction module

class LightModule {
  constructor() {
    this.driver = null;
    this.driverName = null;
    this.channels = []; // [{id, name, type, intensity, on}]
    setTimeout(() => this._registerScenarioActions(), 100);
  }

  // === DRIVER MANAGEMENT ===

  async setDriver(name) {
    const Driver = window.EnderTrack?.LightDrivers?.[name];
    if (!Driver) return false;
    this.driver = new Driver(this);
    this.driverName = name;
    const ok = await this.driver.init();
    if (ok) {
      this.channels = this.driver.getChannels();
      this._registerScenarioActions();
      this._updateStatus();
      this._renderNav();
    }
    return ok;
  }

  getAvailableDrivers() {
    return Object.keys(window.EnderTrack?.LightDrivers || {});
  }

  // === API ===

  async setChannel(channelId, intensity) {
    const ch = this.channels.find(c => c.id === channelId);
    if (!ch) return false;
    ch.intensity = Math.max(0, Math.min(1, intensity));
    ch.on = ch.intensity > 0;
    if (this.driver?.setChannel) await this.driver.setChannel(channelId, ch.intensity);
    this._updateStatus();
    this._renderNav();
    return true;
  }

  async on(channelId, intensity = 1) {
    return await this.setChannel(channelId, intensity);
  }

  async off(channelId) {
    return await this.setChannel(channelId, 0);
  }

  async allOff() {
    for (const ch of this.channels) await this.off(ch.id);
    return true;
  }

  async allOn(intensity = 1) {
    for (const ch of this.channels) await this.on(ch.id, intensity);
    return true;
  }

  getChannels() { return [...this.channels]; }

  getStatus() {
    return {
      connected: !!this.driver,
      driver: this.driverName,
      channels: this.channels.map(c => ({ ...c }))
    };
  }

  // === NAV CONTROLS ===

  _renderNav() {
    const zone = document.getElementById('navPluginZone');
    if (!zone) return;
    const lights = window._lights || [];
    if (!lights.length) {
      if (this._navEl) { this._navEl.remove(); this._navEl = null; }
      return;
    }
    if (!this._navEl) {
      this._navEl = document.createElement('div');
      this._navEl.id = 'light-nav';
      zone.appendChild(this._navEl);
    }
    this._navEl.innerHTML = `
      <style>
        #light-nav .light-btn { padding:5px 8px; border:none; border-radius:4px; cursor:pointer; font-size:10px; flex:1; min-width:0; transition:background 0.15s; }
        #light-nav .light-btn.off { background:var(--app-bg); color:var(--text-general); }
        #light-nav .light-btn.on { background:var(--active-element); color:var(--text-selected); }
      </style>
      ${lights.map((l, i) => `
        <div style="display:flex; align-items:center; gap:4px; margin-bottom:4px;">
          <div style="width:8px; height:8px; border-radius:50%; background:${l.on ? 'rgb('+l.r+','+l.g+','+l.b+')' : '#444'}; box-shadow:${l.on ? '0 0 4px rgb('+l.r+','+l.g+','+l.b+')' : 'none'}; flex-shrink:0;"></div>
          <button class="light-btn ${l.on ? 'on' : 'off'}" onclick="window._toggleLight(${i})" style="min-width:50px;">${l.name}</button>
          <input type="range" min="0" max="100" value="${Math.round((l.intensity||1)*100)}"
            oninput="window._setLightIntensity(${i}, this.value)"
            class="et-slider">
          <span style="font-size:9px; color:var(--coordinates-color); width:24px; text-align:right; font-family:monospace;">${Math.round((l.intensity||1)*100)}%</span>
        </div>
      `).join('')}
    `;
  }

  // === STATUS WIDGET ===

  _updateStatus() {
    const sp = window.EnderTrack?.StatusPeripherals;
    if (!sp) return;
    const lights = window._lights || [];
    // Remove old
    for (let i = 0; i < 8; i++) sp.remove('light_' + i);
    lights.forEach((l, i) => {
      sp.set('light_' + i, {
        name: l.name,
        icon: '💡',
        state: 'connected',
        detail: l.type
      });
    });
  }

  // === SCENARIO ACTIONS ===

  _registerScenarioActions() {
    if (!window.EnderTrack?.ActionRegistry) return;

    // Build channel options from current config
    const channelOpts = this.channels.map(c => ({ value: c.id, label: `${c.name}` }));

    window.EnderTrack.ActionRegistry.register({
      id: 'light_set',
      label: '💡 Light',
      icon: '💡',
      category: 'light',
      params: [
        { id: 'label', label: 'Label', type: 'text', default: 'Light' },
        { id: 'channel', label: 'Canal', type: 'select', options: channelOpts, default: channelOpts[0]?.value || '' },
        { id: 'action', label: 'Action', type: 'select', options: [
          { value: 'on', label: 'ON' },
          { value: 'off', label: 'OFF' }
        ], default: 'on' },
        { id: 'intensity', label: 'Intensité (%)', type: 'number', default: 100, min: 0, max: 100 },
        { id: 'r', label: 'R', type: 'number', default: 255, min: 0, max: 255 },
        { id: 'g', label: 'G', type: 'number', default: 255, min: 0, max: 255 },
        { id: 'b', label: 'B', type: 'number', default: 255, min: 0, max: 255 },
        { id: 'showInLog', label: 'Log', type: 'checkbox', default: true }
      ],
      execute: async (params, context) => {
        const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
        const lights = window._lights || [];
        const light = lights.find(l => l.id === params.channel) || lights[0];
        const isGpio = light?.type === 'gpio';
        if (isGpio) {
          const endpoint = '/api/light/' + (params.action === 'off' ? 'off' : 'on');
          const body = { id: light.serverId || 1 };
          if (params.action !== 'off') {
            body.intensity = (parseInt(params.intensity) || 100) / 100;
            body.r = parseInt(params.r) || 255; body.g = parseInt(params.g) || 255; body.b = parseInt(params.b) || 255;
          }
          try { await fetch(base + endpoint, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); } catch {}
        } else {
          const lm = window.EnderTrack.Light;
          if (params.action === 'off') lm?.off?.(params.channel);
          else lm?.on?.(params.channel, (params.intensity || 100) / 100);
        }
        if (params.showInLog && window.EnderTrack?.Scenario?.addLog) {
          window.EnderTrack.Scenario.addLog('\ud83d\udca1 ' + (light?.name || 'Light') + ' ' + params.action, 'info');
        }
        return { success: true };
      }
    });

    window.EnderTrack.ActionRegistry.register({
      id: 'light_all_off',
      label: '🌑 All lights OFF',
      icon: '🌑',
      category: 'light',
      params: [
        { id: 'label', label: 'Label', type: 'text', default: 'All OFF' },
        { id: 'showInLog', label: 'Log', type: 'checkbox', default: true }
      ],
      execute: async (params) => {
        const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
        try { await fetch(base + '/api/light/off', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: 1 }) }); } catch {}
        if (params.showInLog && window.EnderTrack?.Scenario?.addLog) {
          window.EnderTrack.Scenario.addLog('🌑 All lights OFF', 'info');
        }
        return { success: true };
      }
    });
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Light = new LightModule();
window.EnderTrack.LightDrivers = window.EnderTrack.LightDrivers || {};

// Auto-init with simulation driver
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.Light.setDriver('simulation'));
} else {
  setTimeout(() => EnderTrack.Light.setDriver('simulation'), 0);
}
