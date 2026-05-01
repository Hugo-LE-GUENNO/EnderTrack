// plugins/tempo-bed/ui.js

class TempoBedPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
    this._els = [];
    this._listener = null;
  }

  init() {
    this.bridge.activate();
    this._injectControls();
    this._injectStatus();
    this._listener = (s) => this._updateDisplay(s);
    this.bridge.onChange(this._listener);
  }

  destroy() {
    this.bridge.deactivate();
    if (this._listener) this.bridge.offChange(this._listener);
    this._els.forEach(el => el.remove());
    this._els = [];
  }

  _injectControls() {
    const zone = document.getElementById('navPluginZone');
    if (!zone) return;
    const panel = document.createElement('div');
    panel.className = 'tb-panel';
    panel.innerHTML = `
      <div class="tb-header">
        <span>🌡️ TempoBed</span>
        <button class="tb-toggle" id="tbToggle">OFF</button>
      </div>
      <div class="tb-row">
        <label>Consigne</label>
        <input type="range" id="tbTempSlider" min="20" max="120" value="60" step="1">
        <input type="number" id="tbTempInput" value="60" min="20" max="120" step="1" class="tb-input">
        <span>°C</span>
      </div>
      <div class="tb-presets">
        <button class="tb-preset" data-temp="37">37°</button>
        <button class="tb-preset" data-temp="45">45°</button>
        <button class="tb-preset" data-temp="60">60°</button>
        <button class="tb-preset" data-temp="80">80°</button>
      </div>
    `;

    const toggle = panel.querySelector('#tbToggle');
    toggle.onclick = () => {
      if (this.bridge._isOn) this.bridge.stop();
      else this.bridge.start(panel.querySelector('#tbTempSlider').value);
    };

    const slider = panel.querySelector('#tbTempSlider');
    const input = panel.querySelector('#tbTempInput');
    const sync = (v) => { slider.value = v; input.value = v; this.bridge.setTarget(v); };
    slider.oninput = () => sync(slider.value);
    input.onchange = () => sync(input.value);

    panel.querySelectorAll('.tb-preset').forEach(btn => {
      btn.onclick = () => {
        sync(btn.dataset.temp);
        if (!this.bridge._isOn) this.bridge.start(btn.dataset.temp);
      };
    });

    zone.appendChild(panel);
    this._els.push(panel);
  }

  _injectStatus() {
    const widget = document.querySelector('.status-widget');
    if (!widget) return;
    const status = document.createElement('div');
    status.className = 'tb-status';
    status.id = 'tbStatus';
    status.innerHTML = `
      <div class="tb-status-row">
        <span class="tb-status-icon" id="tbStatusIcon">⚫</span>
        <span class="tb-status-label">Bed</span>
        <span class="tb-status-temp" id="tbStatusTemp">--</span>
        <span class="tb-status-unit">°C</span>
      </div>
    `;
    widget.querySelector('.coordinates-display').after(status);
    this._els.push(status);
  }

  _updateDisplay(s) {
    // Toggle button
    const toggle = document.getElementById('tbToggle');
    if (toggle) {
      toggle.textContent = s.isOn ? 'ON' : 'OFF';
      toggle.classList.toggle('tb-on', s.isOn);
    }

    // Status icon + temp
    const icon = document.getElementById('tbStatusIcon');
    const temp = document.getElementById('tbStatusTemp');
    if (temp) temp.textContent = s.current.toFixed(1);

    if (icon) {
      const diff = Math.abs(s.current - s.target);
      if (!s.isOn) {
        icon.textContent = '⚫';
        icon.className = 'tb-status-icon';
      } else if (diff < 2) {
        icon.textContent = '🔴';
        icon.className = 'tb-status-icon tb-reached';
      } else {
        icon.textContent = '🟠';
        icon.className = 'tb-status-icon tb-warming';
      }
    }
  }
}

window.TempoBedPluginUI = TempoBedPluginUI;
