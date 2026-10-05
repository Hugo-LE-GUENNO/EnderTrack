// plugins/gamepad-simple/ui.js

class GamepadSimplePluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge   = bridge;
    this._els     = [];
  }

  init() {
    this.bridge._onStatusChange = () => this._updateStatus();
    this.bridge.activate();
    this._injectToggle();
    this._injectSettings();
    this._updateStatus();
  }

  destroy() {
    this.bridge.deactivate();
    this._els.forEach(el => el.remove());
    this._els = [];
  }

  _injectToggle() {
    const container = document.getElementById('relativeControls');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'gps-toggle-row';
    row.innerHTML = `
      <button id="gpsToggle" class="gps-toggle" title="Gamepad Simple">🎮</button>
      <span id="gpsStatus" class="gps-status"></span>
    `;
    row.querySelector('#gpsToggle').onclick = () => {
      if (this.bridge.active) this.bridge.deactivate();
      else this.bridge.activate();
      this._updateStatus();
    };
    container.prepend(row);
    this._els.push(row);
  }

  _injectSettings() {
    const settings = document.getElementById('settingsTabContent');
    if (!settings) return;
    const details = document.createElement('details');
    details.innerHTML = `
      <summary>🎮 Gamepad Simple</summary>
      <div class="gps-settings">
        <div class="gps-row">
          <span>Répétition D-pad (ms)</span>
          <input type="number" value="${this.bridge.repeatMs}" min="50" max="500" step="25"
            onchange="window.GamepadSimplePlugin?.bridge && (window.GamepadSimplePlugin.bridge.repeatMs = parseInt(this.value)||200)">
        </div>
        <div class="gps-help">
          ↑↓←→ D-pad → XY<br>
          L1/R1 → Z− / Z+<br>
          ✕/A → Capture &nbsp;|&nbsp; □/X → Home XY<br>
          △/Y → Scénario &nbsp;|&nbsp; ○/B → Add position<br>
          Options/Start → G28 X Y (homing physique)
        </div>
      </div>
    `;
    settings.prepend(details);
    this._els.push(details);
  }

  _updateStatus() {
    const btn    = document.getElementById('gpsToggle');
    const status = document.getElementById('gpsStatus');
    if (btn) btn.classList.toggle('active', this.bridge.active);
    if (status) status.textContent = !this.bridge.active ? '' : this.bridge.isConnected() ? '🟢' : '⚪';
  }
}

window.GamepadSimplePluginUI = GamepadSimplePluginUI;
