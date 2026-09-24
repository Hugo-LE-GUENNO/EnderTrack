// plugins/extruder/ui.js

class ExtruderPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
    this._el = null;
  }

  init() {
    this.bridge.activate();
    const zone = document.getElementById('navPluginZone');
    if (!zone) return;

    this._el = document.createElement('div');
    this._el.className = 'extruder-panel';
    this._el.innerHTML = `
      <div class="extruder-header">🔩 Extrudeur</div>
      <div class="extruder-controls">
        <button class="extruder-btn" id="extRetract">◄ Recul</button>
        <button class="extruder-btn" id="extAdvance">Avance ►</button>
      </div>
      <div class="extruder-row">
        <label>Distance</label>
        <input type="range" id="extDist" min="0.1" max="50" value="5" step="0.1">
        <input type="number" id="extDistVal" value="5" min="0.1" max="50" step="0.1" class="extruder-input">
        <span>mm</span>
      </div>
      <div class="extruder-row">
        <label>Vitesse</label>
        <input type="range" id="extSpeed" min="10" max="3000" value="300" step="10">
        <input type="number" id="extSpeedVal" value="300" min="10" max="3000" step="10" class="extruder-input">
        <span>mm/min</span>
      </div>
    `;

    this._el.querySelector('#extAdvance').onclick = () => this.bridge.extrude(1);
    this._el.querySelector('#extRetract').onclick = () => this.bridge.extrude(-1);

    const distSlider = this._el.querySelector('#extDist');
    const distInput = this._el.querySelector('#extDistVal');
    const speedSlider = this._el.querySelector('#extSpeed');
    const speedInput = this._el.querySelector('#extSpeedVal');

    const syncDist = (v) => { distSlider.value = v; distInput.value = v; this.bridge.setDistance(v); };
    const syncSpeed = (v) => { speedSlider.value = v; speedInput.value = v; this.bridge.setFeedrate(v); };

    distSlider.oninput = () => syncDist(distSlider.value);
    distInput.onchange = () => syncDist(distInput.value);
    speedSlider.oninput = () => syncSpeed(speedSlider.value);
    speedInput.onchange = () => syncSpeed(speedInput.value);

    zone.appendChild(this._el);
  }

  destroy() {
    this.bridge.deactivate();
    this._el?.remove();
    this._el = null;
  }
}

window.ExtruderPluginUI = ExtruderPluginUI;
