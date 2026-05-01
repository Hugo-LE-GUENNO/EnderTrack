// plugins/extruder/bridge.js
// Sends G91 + G1 E±distance F feedrate for extruder motor control

class ExtruderBridge {
  constructor() {
    this._feedrate = 300; // mm/min default
    this._distance = 5;   // mm per press
  }

  activate() {
    this.scenarioActions = [
      {
        id: 'extruder_advance',
        label: 'Extruder Avance',
        icon: '🔩',
        category: 'plugin',
        pluginId: 'extruder',
        params: [
          { id: 'distance', label: 'Distance (mm)', type: 'number', default: 5, min: 0.1, max: 100, step: 0.1 },
          { id: 'speed', label: 'Vitesse (mm/min)', type: 'number', default: 300, min: 10, max: 5000, step: 10 }
        ],
        execute: async (params) => {
          this.setDistance(params.distance || 5);
          this.setFeedrate(params.speed || 300);
          await this.extrude(1);
          return { success: true };
        }
      },
      {
        id: 'extruder_retract',
        label: 'Extruder Recul',
        icon: '🔩',
        category: 'plugin',
        pluginId: 'extruder',
        params: [
          { id: 'distance', label: 'Distance (mm)', type: 'number', default: 5, min: 0.1, max: 100, step: 0.1 },
          { id: 'speed', label: 'Vitesse (mm/min)', type: 'number', default: 300, min: 10, max: 5000, step: 10 }
        ],
        execute: async (params) => {
          this.setDistance(params.distance || 5);
          this.setFeedrate(params.speed || 300);
          await this.extrude(-1);
          return { success: true };
        }
      }
    ];
  }
  deactivate() { this.scenarioActions = null; }
  getStatus() { return { feedrate: this._feedrate, distance: this._distance }; }

  async extrude(direction) {
    const es = window.EnderTrack?.Enderscope;
    if (!es?.isConnected) return;
    const dist = direction > 0 ? this._distance : -this._distance;
    const gcode = `M302 S0\nG91\nG1 E${dist} F${this._feedrate}\nG90`;
    try {
      await fetch(es.serverUrl + '/api/move/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gcode }),
        signal: AbortSignal.timeout(3000)
      });
    } catch {}
  }

  setFeedrate(v) { this._feedrate = Math.max(10, Math.min(5000, parseInt(v) || 300)); }
  setDistance(v) { this._distance = Math.max(0.1, Math.min(100, parseFloat(v) || 5)); }
}

window.ExtruderBridge = ExtruderBridge;
