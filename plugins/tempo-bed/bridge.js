// plugins/tempo-bed/bridge.js

class TempoBedBridge {
  constructor() {
    this._target = 60;
    this._current = 0;
    this._isOn = false;
    this._pollInterval = null;
    this._listeners = [];
  }

  activate() {
    this._startPolling();
    this.scenarioVariables = [
      { id: '$temp', name: 'Température bed', description: 'Température actuelle du plateau (°C)', getValue: () => this._current },
      { id: '$bedTarget', name: 'Consigne bed', description: 'Température cible du plateau (°C)', getValue: () => this._target }
    ];
    this.scenarioActions = [
      {
        id: 'tempobed_set',
        label: 'Bed → Température',
        icon: '🌡️',
        category: 'plugin',
        pluginId: 'tempoBed',
        params: [
          { id: 'temp', label: 'Température (°C)', type: 'number', default: 60, min: 0, max: 120, step: 1 }
        ],
        execute: async (params) => {
          await this.start(params.temp || 60);
          return { success: true };
        }
      },
      {
        id: 'tempobed_off',
        label: 'Bed OFF',
        icon: '🌡️',
        category: 'plugin',
        pluginId: 'tempoBed',
        params: [],
        execute: async () => {
          await this.stop();
          return { success: true };
        }
      },
      {
        id: 'tempobed_wait',
        label: 'Bed → Attendre temp',
        icon: '⏳',
        category: 'plugin',
        pluginId: 'tempoBed',
        params: [
          { id: 'target', label: 'Cible (°C)', type: 'number', default: 60, min: 0, max: 120, step: 1 },
          { id: 'tolerance', label: 'Tolérance (°C)', type: 'number', default: 2, min: 0.5, max: 10, step: 0.5 }
        ],
        execute: async (params) => {
          const target = params.target || 60;
          const tol = params.tolerance || 2;
          for (let i = 0; i < 600; i++) {
            await this.poll();
            if (Math.abs(this._current - target) <= tol) return { success: true };
            await new Promise(r => setTimeout(r, 1000));
          }
          return { success: false, reason: 'timeout' };
        }
      }
    ];
  }
  deactivate() { this.stop(); this._stopPolling(); this.scenarioActions = null; this.scenarioVariables = null; }

  getStatus() {
    return { target: this._target, current: this._current, isOn: this._isOn };
  }

  async start(temp) {
    const es = window.EnderTrack?.Enderscope;
    if (!es?.isConnected) return;
    this._target = Math.max(0, Math.min(120, parseInt(temp) || 60));
    this._isOn = true;
    await this._send('M140 S' + this._target);
    this._notify();
  }

  async stop() {
    this._isOn = false;
    const es = window.EnderTrack?.Enderscope;
    if (es?.isConnected) await this._send('M140 S0');
    this._notify();
  }

  async poll() {
    const es = window.EnderTrack?.Enderscope;
    if (!es?.isConnected) return;
    try {
      var r = await fetch(es.serverUrl + '/api/temperature', { signal: AbortSignal.timeout(3000) });
      var data = await r.json();
      if (data.success) {
        this._current = data.bed;
        this._notify();
      }
    } catch (e) {}
  }

  setTarget(temp) {
    this._target = Math.max(0, Math.min(120, parseInt(temp) || 60));
    if (this._isOn) this._send('M140 S' + this._target);
  }

  onChange(fn) { this._listeners.push(fn); }
  offChange(fn) { this._listeners = this._listeners.filter(function(f) { return f !== fn; }); }

  _notify() { this._listeners.forEach(function(fn) { fn(this.getStatus()); }.bind(this)); }

  _startPolling() {
    this._stopPolling();
    this.poll();
    this._pollInterval = setInterval(this.poll.bind(this), 1500);
  }

  _stopPolling() {
    if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
  }

  async _send(gcode) {
    const es = window.EnderTrack?.Enderscope;
    if (!es?.isConnected) return;
    try {
      await fetch(es.serverUrl + '/api/move/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gcode: gcode }),
        signal: AbortSignal.timeout(3000)
      });
    } catch (e) {}
  }
}

window.TempoBedBridge = TempoBedBridge;
