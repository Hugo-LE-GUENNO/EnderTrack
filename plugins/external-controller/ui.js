// plugins/controller-v2/ui.js

class ExternalControllerPluginUI {
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
            onclick="window.ExternalControllerPlugin?.ui?.setStepPreset('fine')">Fine</button>
          <button class="action-btn cv2-preset-btn" id="cv2PresetCoarse"
            onclick="window.ExternalControllerPlugin?.ui?.setStepPreset('coarse')">Coarse</button>
        </div>
      </div>
      <div class="axis-control">
        <label class="axis-label">F</label>
        <input type="range" id="cv2FeedrateSlider" min="100" max="10000" value="3000" step="100"
          oninput="window.ExternalControllerPlugin?.ui?.onFeedrateChange(this.value, true)">
        <input type="number" id="cv2FeedrateInput" value="3000" min="100" max="10000" step="100"
          style="width:50px" onchange="window.ExternalControllerPlugin?.ui?.onFeedrateChange(this.value, true)">
      </div>
      <div class="home-row">
        <button class="action-btn cv2-preset-btn" id="cv2PresetSlow"
          onclick="window.ExternalControllerPlugin?.ui?.setFeedrate(window.ExternalControllerPlugin?.ui?.getSlow())">Slow</button>
        <button class="action-btn cv2-preset-btn" id="cv2PresetFast"
          onclick="window.ExternalControllerPlugin?.ui?.setFeedrate(window.ExternalControllerPlugin?.ui?.getFast())">Fast</button>
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
              onclick="window.ExternalControllerPlugin?.ui?.showCfgTab('step')">Step</button>
            <button class="cv2-mode-btn" id="cv2CfgTabCont"
              onclick="window.ExternalControllerPlugin?.ui?.showCfgTab('continuous')">Continu</button>
          </div>
        </div>
        <div id="cv2CfgStep">
          <div class="cv2-config-row">
            <span class="cv2-label">Fine XY (mm)</span>
            <input type="number" id="cv2FineXYCfg" class="cv2-input" value="0.5" min="0.01" max="5" step="0.1"
              onchange="window.ExternalControllerPlugin?.ui?.setConfigVal('_fineXY', this.value)">
          </div>
          <div class="cv2-config-row">
            <span class="cv2-label">Coarse XY (mm)</span>
            <input type="number" id="cv2CoarseXYCfg" class="cv2-input" value="10" min="1" max="50" step="1"
              onchange="window.ExternalControllerPlugin?.ui?.setConfigVal('_coarseXY', this.value)">
          </div>
          <div class="cv2-config-row">
            <span class="cv2-label">Fine Z (mm)</span>
            <input type="number" id="cv2FineZCfg" class="cv2-input" value="0.1" min="0.01" max="2" step="0.01"
              onchange="window.ExternalControllerPlugin?.ui?.setConfigVal('_fineZ', this.value)">
          </div>
          <div class="cv2-config-row">
            <span class="cv2-label">Coarse Z (mm)</span>
            <input type="number" id="cv2CoarseZCfg" class="cv2-input" value="2" min="0.1" max="20" step="0.1"
              onchange="window.ExternalControllerPlugin?.ui?.setConfigVal('_coarseZ', this.value)">
          </div>
          <div class="cv2-config-row">
            <span class="cv2-label">Repeat (ms)</span>
            <input type="number" id="cv2RepeatCfg" class="cv2-input" value="500" min="100" max="2000" step="50"
              onchange="window.ExternalControllerPlugin?.ui?.setRepeatInterval(this.value)">
          </div>
        </div>
        <div id="cv2CfgCont" style="display:none">
          <div class="cv2-config-row">
            <span class="cv2-label">Slow (mm/min)</span>
            <input type="number" id="cv2SlowCfg" class="cv2-input" value="500" min="100" max="3000" step="100"
              onchange="window.ExternalControllerPlugin?.ui?.setConfigVal('_slowSpeed', this.value)">
          </div>
          <div class="cv2-config-row">
            <span class="cv2-label">Fast (mm/min)</span>
            <input type="number" id="cv2FastCfg" class="cv2-input" value="6000" min="1000" max="10000" step="500"
              onchange="window.ExternalControllerPlugin?.ui?.setConfigVal('_fastSpeed', this.value)">
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
    // Ensure mapper is loaded
    if (!this.bridge._mapper && window.ActionMapper) {
      this.bridge._mapper = new window.ActionMapper();
      if (this.bridge._gp) this.bridge._gp._btnActions = this.bridge._mapper.getMapping();
    }
    const mapper = this.bridge._mapper;
    if (!mapper) {
      // Load script manually if not yet loaded
      const s = document.createElement('script');
      s.src = 'plugins/pilote-moi-plus/action-mapper.js';
      s.onload = () => {
        this.bridge._mapper = new window.ActionMapper();
        if (this.bridge._gp) this.bridge._gp._btnActions = this.bridge._mapper.getMapping();
        this.openMappingModal();
      };
      document.head.appendChild(s);
      return;
    }
    const gp = this.bridge._gp;
    let gpName = null;
    const gpads = navigator.getGamepads?.();
    if (gpads) for (const g of gpads) {
      if (g) { gpName = g.id.length > 50 ? g.id.substring(0, 50) + '…' : g.id; break; }
    }

    const modal = document.createElement('div');
    modal.id = 'cv2MappingModal';
    modal.className = 'cv2-modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
      <div class="cv2-modal">
        <div class="cv2-modal-header">
          <span>🗺️ Mapping PiloteMoi+</span>
          <button class="cv2-modal-close" id="cv2ModalClose">✕</button>
        </div>
        <div class="cv2-modal-body">
          <div class="cv2-modal-tabs">
            <button class="cv2-mode-btn active" id="cv2MapTabKb">⌨️ Clavier</button>
            <button class="cv2-mode-btn" id="cv2MapTabGp">🎮 Gamepad</button>
          </div>
          <div id="cv2MapKbContent">
            <div class="cv2-map-section">Directions</div>
            <div id="cv2KbDirMappings" class="cv2-map-list"></div>
            <div class="cv2-map-section">Actions</div>
            <div id="cv2KeyMappings" class="cv2-map-list"></div>
            <button class="action-btn" id="cv2AddKeyMap" style="width:100%;margin-top:8px">➕ Ajouter raccourci</button>
          </div>
          <div id="cv2MapGpContent" style="display:none">
            ${gpName ? `<div class="cv2-map-device">🎮 ${gpName}</div>` : '<div class="cv2-map-device cv2-map-none">Aucun gamepad détecté</div>'}
            <div class="cv2-map-section">Directions</div>
            <div id="cv2DirMappings" class="cv2-map-list"></div>
            <div class="cv2-map-section">Boutons</div>
            <div id="cv2BtnMappings" class="cv2-map-list"></div>
            <button class="action-btn" id="cv2AddBtnMap" style="width:100%;margin-top:8px">➕ Ajouter bouton</button>
          </div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="action-btn" id="cv2MapReset" style="flex:1">🔄 Reset</button>
            <button class="action-btn" id="cv2MapExport" style="flex:1">💾 Export</button>
            <button class="action-btn" id="cv2MapImport" style="flex:1">📂 Import</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#cv2ModalClose').onclick = () => modal.remove();
    modal.querySelector('#cv2MapTabKb').onclick = () => this._switchMapTab('kb');
    modal.querySelector('#cv2MapTabGp').onclick = () => this._switchMapTab('gp');
    modal.querySelector('#cv2AddKeyMap').onclick = () => {
      this._listenForKey();
    };
    modal.querySelector('#cv2AddBtnMap').onclick = () => this._listenForButton();
    modal.querySelector('#cv2MapReset').onclick = () => { mapper?.reset(); this.openMappingModal(); };
    modal.querySelector('#cv2MapExport').onclick = () => mapper?.exportJSON();
    modal.querySelector('#cv2MapImport').onclick = () => {
      mapper?.importJSON();
      // Reopen modal after short delay to reflect imported data
      setTimeout(() => this.openMappingModal(), 500);
    };
    this._refreshKeyTable(mapper);
    this._refreshBtnTable(mapper);
    this._refreshDirTable(mapper);
    this._refreshKbDirTable(mapper);
  }

  // --- Render a mapping row (shared by keyboard & gamepad) ---

  _makeRow(container, inputLabel, actionId, mapper, type, key) {
    const row = document.createElement('div');
    row.className = 'cv2-map-row';
    const actionList = mapper.getActionList();

    const isCustom = actionId && !actionList.find(a => a.id === actionId);
    const selectVal = isCustom ? '__custom' : (actionId || 'none');

    row.innerHTML = `
      <span class="cv2-map-btn-label"><kbd>${inputLabel}</kbd></span>
      <select class="cv2-map-select">
        ${actionList.map(a => `<option value="${a.id}" ${a.id === selectVal ? 'selected' : ''}>${a.label}</option>`).join('')}
        <option value="__custom" ${isCustom ? 'selected' : ''}>✏️ Custom...</option>
      </select>
      <input type="text" class="cv2-map-custom" placeholder="ex: window.goHome('xy')" value="${isCustom ? actionId : ''}" style="display:${isCustom ? 'flex' : 'none'}">
      <button class="cv2-map-remove">✕</button>
    `;

    const select = row.querySelector('select');
    const customInput = row.querySelector('.cv2-map-custom');

    const save = () => {
      const val = select.value === '__custom' ? customInput.value.trim() : select.value;
      if (!val) return;
      if (type === 'key') mapper.setKey(key, val);
      else mapper.setButton(key, val);
    };

    select.onchange = () => {
      customInput.style.display = select.value === '__custom' ? 'flex' : 'none';
      if (select.value !== '__custom') save();
    };
    customInput.onchange = () => save();
    row.querySelector('.cv2-map-remove').onclick = () => {
      if (type === 'key') mapper.setKey(key, 'none');
      else mapper.setButton(key, 'none');
      row.remove();
    };

    container.appendChild(row);
  }

  // --- Keyboard table ---

  _refreshKeyTable(mapper) {
    const container = document.getElementById('cv2KeyMappings');
    if (!container || !mapper) return;
    container.innerHTML = '';
    const entries = Object.entries(mapper._keyMapping || {});
    if (!entries.length) {
      container.innerHTML = '<div style="color:var(--text-general);font-size:11px">Aucun raccourci</div>';
      return;
    }
    entries.forEach(([code, actionId]) => this._makeRow(container, code, actionId, mapper, 'key', code));
  }

  // --- Gamepad button table ---

  _refreshBtnTable(mapper) {
    const container = document.getElementById('cv2BtnMappings');
    if (!container || !mapper) return;
    container.innerHTML = '';
    const btnLabels = { 0: '✕/A', 1: '○/B', 2: '□/X', 3: '△/Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Back', 9: 'Start', 10: 'L3', 11: 'R3' };
    const entries = Object.entries(mapper._btnMapping || {});
    if (!entries.length) {
      container.innerHTML = '<div style="color:var(--text-general);font-size:11px">Aucun bouton mappé</div>';
      return;
    }
    entries.forEach(([btn, actionId]) => {
      const label = btnLabels[btn] || 'B' + btn;
      this._makeRow(container, label, actionId, mapper, 'btn', parseInt(btn));
    });
  }

  // --- Listen for key/button ---

  _listenForKey() {
    const mapper = this.bridge._mapper;
    if (!mapper) return;
    const overlay = document.createElement('div');
    overlay.className = 'cv2-modal-backdrop';
    overlay.style.zIndex = '1002';
    overlay.innerHTML = `<div class="cv2-modal" style="width:300px;text-align:center;padding:24px">
      <div style="font-size:24px;margin-bottom:8px">⌨️</div>
      <div style="color:var(--text-selected);font-size:13px">Appuyez sur une touche...</div>
      <div style="color:var(--text-general);font-size:11px;margin-top:8px">Echap pour annuler</div>
    </div>`;
    document.body.appendChild(overlay);
    const handler = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      document.removeEventListener('keydown', handler, true);
      overlay.remove();
      if (e.code !== 'Escape') {
        mapper.setKey(e.code, 'home_xy');
        this._refreshKeyTable(mapper);
      }
    };
    document.addEventListener('keydown', handler, true);
  }

  _listenForButton() {
    const mapper = this.bridge._mapper;
    const gp = this.bridge._gp;
    if (!mapper) return;
    const overlay = document.createElement('div');
    overlay.className = 'cv2-modal-backdrop';
    overlay.style.zIndex = '1002';
    overlay.innerHTML = `<div class="cv2-modal" style="width:300px;text-align:center;padding:24px">
      <div style="font-size:24px;margin-bottom:8px">🎮</div>
      <div style="color:var(--text-selected);font-size:13px">Appuyez sur un bouton...</div>
      <div style="color:var(--text-general);font-size:11px;margin-top:8px">Echap pour annuler</div>
    </div>`;
    document.body.appendChild(overlay);

    let raf = null;
    let baseline = null;

    // Also listen for Escape to cancel
    const escHandler = (e) => {
      if (e.code === 'Escape') { e.stopImmediatePropagation(); cleanup(); }
    };
    document.addEventListener('keydown', escHandler, true);

    const cleanup = () => {
      document.removeEventListener('keydown', escHandler, true);
      if (raf) cancelAnimationFrame(raf);
      overlay.remove();
    };

    const poll = () => {
      // Find any connected gamepad
      const gpads = navigator.getGamepads?.();
      let gpObj = null;
      if (gpads) for (const g of gpads) { if (g) { gpObj = g; break; } }
      if (!gpObj) { raf = requestAnimationFrame(poll); return; }
      if (!baseline) {
        baseline = Array.from(gpObj.buttons).map(b => b.pressed);
        raf = requestAnimationFrame(poll);
        return;
      }
      for (let i = 0; i < gpObj.buttons.length; i++) {
        if (gpObj.buttons[i].pressed && !baseline[i]) {
          cleanup();
          const btnLabels = { 0: '✕/A', 1: '○/B', 2: '□/X', 3: '△/Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Back', 9: 'Start', 10: 'L3', 11: 'R3' };
          mapper.setButton(i, 'home_xy');
          if (gp) gp._btnActions = mapper.getMapping();
          this._refreshBtnTable(mapper);
          return;
        }
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
  }

  // --- Keyboard direction table ---

  _refreshKbDirTable(mapper) {
    const container = document.getElementById('cv2KbDirMappings');
    if (!container || !mapper) return;
    container.innerHTML = '';
    const dirLabels = {
      up: '⬆ Haut', down: '⬇ Bas', left: '⬅ Gauche', right: '➡ Droite',
      zUp: '⬆ Z+', zDown: '⬇ Z-'
    };
    const dirs = mapper._kbDirMapping || {};
    for (const [dirName, label] of Object.entries(dirLabels)) {
      const curCode = dirs[dirName] || '—';
      const row = document.createElement('div');
      row.className = 'cv2-map-row';
      row.innerHTML = `
        <span class="cv2-map-btn-label" style="min-width:80px">${label}</span>
        <span class="cv2-map-btn-label"><kbd>${curCode}</kbd></span>
        <button class="action-btn" style="font-size:10px;padding:2px 8px">⌨️ Changer</button>
      `;
      row.querySelector('button').onclick = () => this._listenForKbDir(dirName, mapper);
      container.appendChild(row);
    }
  }

  _listenForKbDir(dirName, mapper) {
    const dirLabels = { up: 'Haut', down: 'Bas', left: 'Gauche', right: 'Droite', zUp: 'Z+', zDown: 'Z-' };
    const overlay = document.createElement('div');
    overlay.className = 'cv2-modal-backdrop';
    overlay.style.zIndex = '1002';
    overlay.innerHTML = `<div class="cv2-modal" style="width:300px;text-align:center;padding:24px">
      <div style="font-size:24px;margin-bottom:8px">⌨️</div>
      <div style="color:var(--text-selected);font-size:13px">Touche pour <strong>${dirLabels[dirName]}</strong></div>
      <div style="color:var(--text-general);font-size:11px;margin-top:8px">Echap pour annuler</div>
    </div>`;
    document.body.appendChild(overlay);
    const handler = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      document.removeEventListener('keydown', handler, true);
      overlay.remove();
      if (e.code !== 'Escape') {
        mapper.setKbDir(dirName, e.code);
        this._refreshKbDirTable(mapper);
      }
    };
    document.addEventListener('keydown', handler, true);
  }

  // --- Gamepad direction table ---

  _refreshDirTable(mapper) {
    const container = document.getElementById('cv2DirMappings');
    if (!container || !mapper) return;
    container.innerHTML = '';
    const dirLabels = {
      up: '⬆ Haut', down: '⬇ Bas', left: '⬅ Gauche', right: '➡ Droite',
      zUp: '⬆ Z+', zDown: '⬇ Z-'
    };
    const dirs = mapper._dirMapping || {};
    for (const [dirName, cfg] of Object.entries(dirLabels)) {
      const cur = dirs[dirName];
      const curLabel = cur ? `${cur.type} ${cur.index}` : '—';
      const row = document.createElement('div');
      row.className = 'cv2-map-row';
      row.innerHTML = `
        <span class="cv2-map-btn-label" style="min-width:80px">${cfg}</span>
        <span class="cv2-map-btn-label"><kbd>${curLabel}</kbd></span>
        <button class="action-btn" style="font-size:10px;padding:2px 8px">🎮 Changer</button>
      `;
      row.querySelector('button').onclick = () => this._listenForDir(dirName, mapper);
      container.appendChild(row);
    }
  }

  _listenForDir(dirName, mapper) {
    const overlay = document.createElement('div');
    overlay.className = 'cv2-modal-backdrop';
    overlay.style.zIndex = '1002';
    const dirLabels = { up: 'Haut', down: 'Bas', left: 'Gauche', right: 'Droite', zUp: 'Z+', zDown: 'Z-' };
    overlay.innerHTML = `<div class="cv2-modal" style="width:320px;text-align:center;padding:24px">
      <div style="font-size:24px;margin-bottom:8px">🕹️</div>
      <div style="color:var(--text-selected);font-size:13px">Appuyez sur le bouton/axe pour <strong>${dirLabels[dirName]}</strong></div>
      <div style="color:var(--text-general);font-size:11px;margin-top:8px">Bouton, trigger, axe de stick... | Echap pour annuler</div>
    </div>`;
    document.body.appendChild(overlay);

    let raf = null;
    let baseline = null;
    let baseAxes = null;

    const escHandler = (e) => {
      if (e.code === 'Escape') { e.stopImmediatePropagation(); cleanup(); }
    };
    document.addEventListener('keydown', escHandler, true);

    const cleanup = () => {
      document.removeEventListener('keydown', escHandler, true);
      if (raf) cancelAnimationFrame(raf);
      overlay.remove();
    };

    const poll = () => {
      const gpads = navigator.getGamepads?.();
      let gpObj = null;
      if (gpads) for (const g of gpads) { if (g) { gpObj = g; break; } }
      if (!gpObj) { raf = requestAnimationFrame(poll); return; }
      if (!baseline) {
        baseline = Array.from(gpObj.buttons).map(b => b.pressed);
        baseAxes = Array.from(gpObj.axes);
        raf = requestAnimationFrame(poll);
        return;
      }
      // Check buttons
      for (let i = 0; i < gpObj.buttons.length; i++) {
        if (gpObj.buttons[i].pressed && !baseline[i]) {
          cleanup();
          mapper.setDir(dirName, 'button', i);
          this._refreshDirTable(mapper);
          return;
        }
      }
      // Check axes (threshold 0.7)
      for (let i = 0; i < gpObj.axes.length; i++) {
        const delta = gpObj.axes[i] - baseAxes[i];
        if (Math.abs(delta) > 0.7) {
          cleanup();
          const sign = delta > 0 ? 'axis+' : 'axis-';
          mapper.setDir(dirName, sign, i);
          this._refreshDirTable(mapper);
          return;
        }
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
  }

  _switchMapTab(tab) {
    const tabs = { kb: 'cv2MapKbContent', gp: 'cv2MapGpContent' };
    const btns = { kb: 'cv2MapTabKb', gp: 'cv2MapTabGp' };
    for (const [k, id] of Object.entries(tabs)) {
      const el = document.getElementById(id);
      if (el) el.style.display = k === tab ? '' : 'none';
    }
    for (const [k, id] of Object.entries(btns)) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', k === tab);
    }
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

window.ExternalControllerPluginUI = ExternalControllerPluginUI;
