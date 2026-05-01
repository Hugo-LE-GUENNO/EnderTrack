// plugins/controller-v2/ui.js

class ControllerV2PluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
    this._els = [];
  }

  init() {
    this.bridge.activate();
    this._injectToggle();
    this._injectControls();
    this._injectConfig();
    this._updateUI();
  }

  destroy() {
    this.bridge.deactivate();
    this._els.forEach(el => el.remove());
    this._els = [];
    // Restore sensitivity controls
    this._showSensitivity(true);
  }

  // --- Toggle button ---

  _injectToggle() {
    const container = document.getElementById('relativeControls');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'cv2-toggle-row';
    row.innerHTML = `
      <button id="ctrlV2Toggle" class="cv2-toggle" title="Mode contrôleur clavier">🕹️</button>
      <span id="cv2GamepadStatus" class="cv2-gp-status" style="display:none" title="Gamepad connecté">🎮</span>
      <div class="cv2-mode-switch" id="cv2ModeSwitch" style="display:none">
        <button class="cv2-mode-btn active" id="cv2StepBtn2">Step</button>
        <button class="cv2-mode-btn" id="cv2ContBtn2">Continu</button>
      </div>
    `;
    row.querySelector('#ctrlV2Toggle').onclick = () => { this.bridge.toggle(); this._updateUI(); };
    row.querySelector('#cv2StepBtn2').onclick = () => this.setMode('step');
    row.querySelector('#cv2ContBtn2').onclick = () => this.setMode('continuous');
    container.prepend(row);
    this._els.push(row);
  }

  // --- Inline controls (mode switch + feedrate) ---

  _injectControls() {
    const stepControls = document.getElementById('stepControls');
    if (!stepControls) return;

    const panel = document.createElement('div');
    panel.id = 'cv2Controls';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div id="cv2StepPresets" class="cv2-presets-section">
        <div class="home-row">
          <button class="action-btn cv2-preset-btn" id="cv2PresetFine"
            onclick="window.PiloteMoiPlugin?.ui?.setStepPreset('fine')">Fine</button>
          <button class="action-btn cv2-preset-btn" id="cv2PresetCoarse"
            onclick="window.PiloteMoiPlugin?.ui?.setStepPreset('coarse')">Coarse</button>
        </div>
      </div>
      <div class="axis-control">
        <label class="axis-label">F</label>
        <input type="range" id="cv2FeedrateSlider" min="100" max="10000" value="3000" step="100"
          oninput="window.PiloteMoiPlugin?.ui?.onFeedrateChange(this.value, true)">
        <input type="number" id="cv2FeedrateInput" value="3000" min="100" max="10000" step="100"
          style="width:50px" onchange="window.PiloteMoiPlugin?.ui?.onFeedrateChange(this.value, true)">
      </div>
      <div class="home-row">
        <button class="action-btn cv2-preset-btn" id="cv2PresetSlow"
          onclick="window.PiloteMoiPlugin?.ui?.setFeedrate(window.PiloteMoiPlugin?.ui?.getSlow())">Slow</button>
        <button class="action-btn cv2-preset-btn" id="cv2PresetFast"
          onclick="window.PiloteMoiPlugin?.ui?.setFeedrate(window.PiloteMoiPlugin?.ui?.getFast())">Fast</button>
      </div>
    `;
    stepControls.after(panel);
    this._els.push(panel);
  }

  // --- Config accordion ---

  _injectConfig() {
    const settings = document.getElementById('settingsTabContent');
    if (!settings) return;

    const details = document.createElement('details');
    details.id = 'cv2-config';
    details.innerHTML = `
      <summary>${this.manifest.icon} ${this.manifest.name}</summary>
      <div class="setting-group">
        <div class="cv2-mode-row">
          <span class="cv2-label">Paramètres</span>
          <div class="cv2-mode-switch">
            <button class="cv2-mode-btn active" id="cv2CfgTabStep"
              onclick="window.PiloteMoiPlugin?.ui?.showCfgTab('step')">Step</button>
            <button class="cv2-mode-btn" id="cv2CfgTabCont"
              onclick="window.PiloteMoiPlugin?.ui?.showCfgTab('continuous')">Continu</button>
          </div>
        </div>
        <div id="cv2CfgStep">
          <div class="cv2-config-row">
            <span class="cv2-label">Fine XY (mm)</span>
            <input type="number" id="cv2FineXYCfg" class="cv2-input" value="0.5" min="0.01" max="5" step="0.1"
              onchange="window.PiloteMoiPlugin?.ui?.setConfigVal('_fineXY', this.value)">
          </div>
          <div class="cv2-config-row">
            <span class="cv2-label">Coarse XY (mm)</span>
            <input type="number" id="cv2CoarseXYCfg" class="cv2-input" value="10" min="1" max="50" step="1"
              onchange="window.PiloteMoiPlugin?.ui?.setConfigVal('_coarseXY', this.value)">
          </div>
          <div class="cv2-config-row">
            <span class="cv2-label">Fine Z (mm)</span>
            <input type="number" id="cv2FineZCfg" class="cv2-input" value="0.1" min="0.01" max="2" step="0.01"
              onchange="window.PiloteMoiPlugin?.ui?.setConfigVal('_fineZ', this.value)">
          </div>
          <div class="cv2-config-row">
            <span class="cv2-label">Coarse Z (mm)</span>
            <input type="number" id="cv2CoarseZCfg" class="cv2-input" value="2" min="0.1" max="20" step="0.1"
              onchange="window.PiloteMoiPlugin?.ui?.setConfigVal('_coarseZ', this.value)">
          </div>
          <div class="cv2-config-row">
            <span class="cv2-label">Repeat (ms)</span>
            <input type="number" id="cv2RepeatCfg" class="cv2-input" value="500" min="100" max="2000" step="50"
              onchange="window.PiloteMoiPlugin?.ui?.setRepeatInterval(this.value)">
          </div>
        </div>
        <div id="cv2CfgCont" style="display:none">
          <div class="cv2-config-row">
            <span class="cv2-label">Slow (mm/min)</span>
            <input type="number" id="cv2SlowCfg" class="cv2-input" value="500" min="100" max="3000" step="100"
              onchange="window.PiloteMoiPlugin?.ui?.setConfigVal('_slowSpeed', this.value)">
          </div>
          <div class="cv2-config-row">
            <span class="cv2-label">Fast (mm/min)</span>
            <input type="number" id="cv2FastCfg" class="cv2-input" value="6000" min="1000" max="10000" step="500"
              onchange="window.PiloteMoiPlugin?.ui?.setConfigVal('_fastSpeed', this.value)">
          </div>
        </div>
        <div class="cv2-help">
          <button class="action-btn" style="width:100%" id="cv2MappingBtn">🗺️ Mapping</button>
        </div>
      </div>
    `;
    details.querySelector('#cv2MappingBtn').onclick = () => this.openMappingModal();
    details.querySelector('#cv2CfgTabStep').onclick = () => this.showCfgTab('step');
    details.querySelector('#cv2CfgTabCont').onclick = () => this.showCfgTab('continuous');
    // Bind config inputs
    const bindCfg = (id, fn) => { const el = details.querySelector('#' + id); if (el) el.onchange = () => fn(el.value); };
    bindCfg('cv2FineXYCfg', v => this.setConfigVal('_fineXY', v));
    bindCfg('cv2CoarseXYCfg', v => this.setConfigVal('_coarseXY', v));
    bindCfg('cv2FineZCfg', v => this.setConfigVal('_fineZ', v));
    bindCfg('cv2CoarseZCfg', v => this.setConfigVal('_coarseZ', v));
    bindCfg('cv2RepeatCfg', v => this.setRepeatInterval(v));
    bindCfg('cv2SlowCfg', v => this.setConfigVal('_slowSpeed', v));
    bindCfg('cv2FastCfg', v => this.setConfigVal('_fastSpeed', v));
    settings.prepend(details);
    this._els.push(details);
  }

  // --- Mapping Modal ---

  openMappingModal() {
    document.getElementById('cv2MappingModal')?.remove();
    const gp = this.bridge._gp;
    const gpObj = gp?._gpIndex !== null ? navigator.getGamepads?.()?.[gp._gpIndex] : null;
    const gpName = gpObj ? (gpObj.id.length > 50 ? gpObj.id.substring(0, 50) + '…' : gpObj.id) : null;

    const modal = document.createElement('div');
    modal.id = 'cv2MappingModal';
    modal.className = 'cv2-modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const actions = [];
    const btnLabels = {};

    modal.innerHTML = `
      <div class="cv2-modal">
        <div class="cv2-modal-header">
          <span>🗺️ Mapping Controller</span>
          <button class="cv2-modal-close" id="cv2ModalClose">✕</button>
        </div>
        <div class="cv2-modal-body">
          <div class="cv2-modal-tabs">
            <button class="cv2-mode-btn active" id="cv2MapTabKb">⌨️ Clavier</button>
            <button class="cv2-mode-btn" id="cv2MapTabGp">🎮 Gamepad</button>
          </div>

          <div id="cv2MapKbContent">
            <div class="cv2-map-section">Mouvement</div>
            <div class="cv2-map-grid">
              <div class="cv2-map-key"><kbd>↑↓←→</kbd></div><span>XY</span>
              <div class="cv2-map-key"><kbd>PgUp / PgDn</kbd></div><span>Z</span>
            </div>
          </div>

          <div id="cv2MapGpContent" style="display:none">
            ${gpName
              ? `<div class="cv2-map-device">🎮 ${gpName}</div>`
              : '<div class="cv2-map-device cv2-map-none">Aucun gamepad détecté</div>'
            }
            <div class="cv2-map-section">Mouvement</div>
            <div class="cv2-map-grid">
              <div class="cv2-map-key">D-pad</div><span>XY</span>
              <div class="cv2-map-key">LB / RB</div><span>Z- / Z+</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#cv2ModalClose').onclick = () => modal.remove();
    modal.querySelector('#cv2MapTabKb').onclick = () => this._switchMapTab('kb');
    modal.querySelector('#cv2MapTabGp').onclick = () => this._switchMapTab('gp');
  }

  _switchMapTab(tab) {
    const kb = document.getElementById('cv2MapKbContent');
    const gp = document.getElementById('cv2MapGpContent');
    const kbBtn = document.getElementById('cv2MapTabKb');
    const gpBtn = document.getElementById('cv2MapTabGp');
    if (kb) kb.style.display = tab === 'kb' ? '' : 'none';
    if (gp) gp.style.display = tab === 'gp' ? '' : 'none';
    if (kbBtn) kbBtn.classList.toggle('active', tab === 'kb');
    if (gpBtn) gpBtn.classList.toggle('active', tab === 'gp');
  }

  // --- Actions ---

  setMode(mode) {
    this.bridge.setMode(mode);
    this._updateUI();
  }

  onFeedrateChange(val, manual) {
    const v = Math.max(100, Math.min(10000, parseInt(val) || 3000));
    if (manual) this._activePreset = null; // manual change clears preset
    const slider = document.getElementById('cv2FeedrateSlider');
    const input = document.getElementById('cv2FeedrateInput');
    const mainSlider = document.getElementById('feedrateSlider');
    const mainInput = document.getElementById('feedrateInput');
    if (slider) slider.value = v;
    if (input) input.value = v;
    if (mainSlider) mainSlider.value = v;
    if (mainInput) mainInput.value = v;
    window.EnderTrack?.State?.update?.({ feedrate: v });
    localStorage.setItem('endertrack_feedrate', v);
    this._updatePresetButtons();
  }

  setFeedrate(val) {
    this._activePreset = val;
    this.onFeedrateChange(val, false);
  }

  getSlow() { return this._slowSpeed || 500; }
  getFast() { return this._fastSpeed || 6000; }

  _updatePresetButtons() {
    const slow = document.getElementById('cv2PresetSlow');
    const fast = document.getElementById('cv2PresetFast');
    const fine = document.getElementById('cv2PresetFine');
    const coarse = document.getElementById('cv2PresetCoarse');
    if (slow) slow.classList.toggle('active', this._activePreset === this.getSlow());
    if (fast) fast.classList.toggle('active', this._activePreset === this.getFast());
    if (fine) fine.classList.toggle('active', this._activeStepPreset === 'fine');
    if (coarse) coarse.classList.toggle('active', this._activeStepPreset === 'coarse');
  }

  setRepeatInterval(val) {
    this.bridge._repeatInterval = Math.max(100, parseInt(val) || 500);
  }

  setComboDelay(val) {
    this.bridge._comboDelay = Math.max(20, parseInt(val) || 60);
  }

  setConfigVal(key, val) {
    this[key] = parseFloat(val);
  }

  showCfgTab(tab) {
    const stepDiv = document.getElementById('cv2CfgStep');
    const contDiv = document.getElementById('cv2CfgCont');
    const stepBtn = document.getElementById('cv2CfgTabStep');
    const contBtn = document.getElementById('cv2CfgTabCont');
    if (stepDiv) stepDiv.style.display = tab === 'step' ? '' : 'none';
    if (contDiv) contDiv.style.display = tab === 'continuous' ? '' : 'none';
    if (stepBtn) stepBtn.classList.toggle('active', tab === 'step');
    if (contBtn) contBtn.classList.toggle('active', tab === 'continuous');
  }

  setStepPreset(preset) {
    this._activeStepPreset = preset;
    const fine = preset === 'fine';
    const xyVal = fine ? (this._fineXY || 0.5) : (this._coarseXY || 10);
    const zVal = fine ? (this._fineZ || 0.1) : (this._coarseZ || 2);
    // Set sensitivity sliders
    const state = window.EnderTrack?.State?.get();
    if (state?.lockXY) {
      const s = document.getElementById('sensitivityXY');
      const i = document.getElementById('sensitivityXYInput');
      if (s) { s.value = xyVal; s.dispatchEvent(new Event('input')); }
      if (i) i.value = xyVal;
    } else {
      ['X', 'Y'].forEach(a => {
        const s = document.getElementById('sensitivity' + a);
        const i = document.getElementById('sensitivity' + a + 'Input');
        if (s) { s.value = xyVal; s.dispatchEvent(new Event('input')); }
        if (i) i.value = xyVal;
      });
    }
    const sz = document.getElementById('sensitivityZ');
    const iz = document.getElementById('sensitivityZInput');
    if (sz) { sz.value = zVal; sz.dispatchEvent(new Event('input')); }
    if (iz) iz.value = zVal;
    this._updatePresetButtons();
  }

  // --- Show/hide sensitivity controls ---

  _showSensitivity(show) {
    const container = document.getElementById('stepControls');
    if (container) container.style.display = show ? '' : 'none';
  }

  // --- Update all UI ---

  _updateUI() {
    const active = this.bridge.isActive;
    const mode = this.bridge.mode;
    const isContinuous = active && mode === 'continuous';

    // Toggle button
    const toggle = document.getElementById('ctrlV2Toggle');
    if (toggle) toggle.classList.toggle('active', active);

    // Mode switch visibility (same line as toggle)
    const modeSwitch = document.getElementById('cv2ModeSwitch');
    if (modeSwitch) modeSwitch.style.display = active ? '' : 'none';

    // Inline controls (feedrate)
    const controls = document.getElementById('cv2Controls');
    if (controls) controls.style.display = active ? '' : 'none';

    // Mode buttons (inline)
    const stepBtn2 = document.getElementById('cv2StepBtn2');
    const contBtn2 = document.getElementById('cv2ContBtn2');
    if (stepBtn2) stepBtn2.classList.toggle('active', mode === 'step');
    if (contBtn2) contBtn2.classList.toggle('active', mode === 'continuous');

    // Mode buttons (config) — sync tab with current mode
    this.showCfgTab(mode);

    // Sensitivity: hide in continuous, show in step
    this._showSensitivity(!isContinuous);

    // Fine/Coarse: only in step mode
    const stepPresets = document.getElementById('cv2StepPresets');
    if (stepPresets) stepPresets.style.display = (active && mode === 'step') ? '' : 'none';

    // Sync feedrate from state
    const feedrate = window.EnderTrack?.State?.get()?.feedrate || 3000;
    const slider = document.getElementById('cv2FeedrateSlider');
    const input = document.getElementById('cv2FeedrateInput');
    if (slider) slider.value = feedrate;
    if (input) input.value = feedrate;
    this._updatePresetButtons();

    // Gamepad status
    const gpStatus = document.getElementById('cv2GamepadStatus');
    if (gpStatus) gpStatus.style.display = (active && this.bridge._gp?._gpIndex !== null) ? '' : 'none';
  }
}

window.PiloteMoiPluginUI = ControllerV2PluginUI;
