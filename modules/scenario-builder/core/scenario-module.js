// plugins/scenario-builder/src/core/scenario-module.js — Main entry point

class ScenarioModule {
  constructor() {
    this.isActive = false;
    this.selectedListId = null;
    this.delay = 2000;
    this.loops = 1;
    this._stopped = false;
    this.scenarioTrack = { enabled: true, visited: [], current: null, remaining: [], preview: [] };
    this.manager = null;
    this._executor = null;
    this._logEntries = [];
  }

  get isExecuting() { return this._isExecuting || this._executor?.isExecuting || false; }
  set isExecuting(v) { this._isExecuting = v; }

  async init() {
    this.manager = new window.EnderTrack.ScenarioManager();
    this._executor = new window.EnderTrack.ScenarioExecutor();
    this.isActive = false;
    this.updateCanvasOverlay();
    this.createUI();
    return true;
  }

  activate() {
    this.isActive = true;
    if (this.isExecuting) {
      this.showExecutionUI();
    } else {
      this.createUI();
    }
    this.updateCanvasOverlay();
    EnderTrack.Canvas?.requestRender?.();
  }

  deactivate() {
    this.isActive = false;
  }

  // === TRACK ===

  updateScenarioTrack(visited, current, remaining) {
    this.scenarioTrack.visited = visited || [];
    this.scenarioTrack.current = current || null;
    this.scenarioTrack.remaining = remaining || [];
    EnderTrack.Canvas?.requestRender?.();
  }

  updateCanvasOverlay() {
    const scenario = this.manager?.getCurrentScenario();
    this.selectedListId = null;

    // Extract all positions from tree for preview track
    if (scenario?.tree) {
      const currentPos = EnderTrack.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
      const positions = EnderTrack.TreeUtils.extractPositions(scenario.tree, [], { ...currentPos });
      this.scenarioTrack.preview = positions;
    } else {
      this.scenarioTrack.preview = [];
    }

    EnderTrack.Canvas?.requestRender?.();
  }

  // === LOG ===

  addLog(message, type = 'info') {
    this._logEntries.push({ message, type, time: Date.now() });
    if (this._logEntries.length > 200) this._logEntries.shift();
    const color = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : 'var(--text-general)';
    const line = `<div style="font-size:10px; color:${color}; padding:1px 0;">${message}</div>`;
    const el = document.getElementById('sbRunLog') || document.getElementById('scenarioRightLog');
    if (el) { el.innerHTML += line; el.scrollTop = el.scrollHeight; }
  }

  // === EXECUTION ===

  async executeScenario() {
    const scenario = this.manager?.getCurrentScenario();
    if (!scenario?.tree) return;

    // Reset emergency stop flag
    EnderTrack.State?.update?.({ emergencyStopActive: false });
    if (EnderTrack.Movement) EnderTrack.Movement.emergencyStop = false;

    // Close builder if open
    document.getElementById('sbModal')?.remove();

    this.scenarioTrack = { enabled: true, visited: [], current: null, remaining: [], preview: this.scenarioTrack.preview || [] };
    this._logEntries = [];
    
    this._showRunUI({ name: scenario?.name || 'Scenario', positions: [] });
    this.showExecutionUI();
    EnderTrack.Events?.emit?.('scenario:activated');

    await this._executor.executeTree(scenario.tree, scenario.watchers);

    const dur = this._executor.getElapsedTime().toFixed(1);
    this.addLog('\u2705 Termin\u00e9 (' + dur + 's)', 'info');
    EnderTrack.Events?.emit?.('scenario:completed', {
      scenarioName: scenario.name,
      duration: parseFloat(dur)
    });
    this.createUI();
  }

  async _generateStack(scenario) {
    // Collect recent captures and create a multi-page TIFF
    try {
      const url = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      const res = await fetch(url + '/api/gallery');
      const data = await res.json();
      const files = (data.files || []).filter(f => f.name.endsWith('.png') || f.name.endsWith('.jpg'));
      if (files.length < 2) return;
      // Use files from this session (last N minutes)
      const cutoff = Date.now() / 1000 - 600; // last 10 min
      const recent = files.filter(f => f.mtime > cutoff);
      if (recent.length < 2) return;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const output = './captures/' + (scenario.name || 'stack').replace(/[^a-zA-Z0-9]/g, '_') + '_' + ts + '.tiff';
      await fetch(url + '/api/stack/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: recent.map(f => f.path), output })
      });
      this.addLog('\ud83d\udcda Stack: ' + output, 'info');
    } catch(e) {}
  }

  stopExecution() {
    this._executor?.stop();
    this.scenarioTrack = { enabled: true, visited: [], current: null, remaining: [], preview: this.scenarioTrack.preview || [] };
    this._showRightPanel(false);
    EnderTrack.Events?.emit?.('scenario:deactivated');
    this.createUI();
  }

  _showRightPanel(show) {
    const el = document.getElementById('scenarioRightPanel');
    if (el) {
      el.style.display = show ? 'block' : 'none';
      if (show) {
        const log = document.getElementById('scenarioRightLog');
        if (log) log.innerHTML = '';
        const bar = document.getElementById('sbRightProgress');
        if (bar) bar.style.width = '0%';
        const text = document.getElementById('sbRightProgressText');
        if (text) text.textContent = '';
        const iter = document.getElementById('sbRightIteration');
        if (iter) iter.textContent = '';
        const label = document.getElementById('sbRightLabel');
        const scenario = this.manager?.getCurrentScenario();
        if (label) label.textContent = `▶ ${scenario?.name || 'Sc\u00e9nario'}`;
        ['green', 'orange', 'red'].forEach(c => {
          const led = document.getElementById('status-light-' + c);
          if (led) { led.style.opacity = '0.2'; led.style.boxShadow = 'none'; }
        });
      }
    }
  }

  // === UI ===

  createUI() {
    const container = document.getElementById('acquisitionTabContent');
    if (!container) return;

    const scenarios = this.manager?.getAllScenarios() || [];
    const current = this.manager?.getCurrentScenario();
    const actionCount = current ? EnderTrack.TreeUtils.countActions(current.tree) : 0;
    const hasScenarios = scenarios.length > 0;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; padding:8px;">
        <!-- Scenario selector -->
        <select id="sbScenarioSelect" style="width:100%; padding:8px; background:var(--app-bg); border:1px solid #444; border-radius:4px; color:var(--text-selected); font-size:11px;">
          ${hasScenarios ? scenarios.map(s => `<option value="${s.id}" ${s.id === current?.id ? 'selected' : ''}>${s.icon || '\ud83c\udfac'} ${s.name}</option>`).join('') : '<option value="_new">+ Nouveau sc\u00e9nario</option>'}
        </select>

        <!-- Details (click to open builder) -->
        <div onclick="EnderTrack.Scenario._openBuilder()" style="padding:8px; background:var(--app-bg); border-radius:4px; font-size:10px; color:var(--text-general); display:flex; gap:8px; align-items:center; cursor:pointer; transition:background 0.15s;" onmouseenter="this.style.background='var(--container-bg)'" onmouseleave="this.style.background='var(--app-bg)'">
          ${current ? `<span style="font-size:18px; width:30px; height:30px; line-height:30px; text-align:center; border-radius:4px; background:${current.color || 'transparent'};">${current.icon || '\ud83c\udfac'}</span>
          <div style="flex:1;">
            <strong style="color:var(--text-selected);">${current.name}</strong>
            ${current.description ? `<div style="font-size:9px; color:#888; margin-top:2px;">${current.description}</div>` : ''}
            ${(current.fields || []).length ? `<div style="font-size:9px; color:#666; margin-top:2px;">${current.fields.map(f => f.label + ': ' + f.value).join(' \u2022 ')}</div>` : ''}
          </div>` : `<span style="color:#888;">Nouveau...</span>`}
        </div>

        <!-- Execute -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
          <button onclick="EnderTrack.Scenario.executeScenario()" style="padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:#22c55e; color:#000; font-weight:600;" ${actionCount ? '' : 'disabled style="padding:10px; border:none; border-radius:4px; font-size:12px; opacity:0.3;"'}>\u25b6</button>
          <button id="sbPauseBtn" onclick="EnderTrack.Scenario._togglePause()" style="padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:var(--active-element); color:var(--text-selected); font-weight:600;">\u23f8</button>
          <button onclick="EnderTrack.Scenario.stopExecution()" style="padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:#ef4444; color:#fff; font-weight:600;">\u25a0</button>
        </div>
      </div>`;

    document.getElementById('sbScenarioSelect')?.addEventListener('change', e => {
      if (e.target.value === '_new') {
        this._openBuilder();
        return;
      }
      this.manager.setCurrentScenario(e.target.value);
      EnderTrack.VariableManager?.init?.(this.manager.getCurrentScenario());
      this.updateCanvasOverlay();
      this.createUI();
    });
  }

  _renderPresetsTab(scenarios, current) {
    const currentScenario = this.manager?.getCurrentScenario();
    this._preset = currentScenario?.presetState || { multipos: false, timelapse: false, zstack: false, mosaic: false, autofocus: false, useLight: false, useCapture: true };
    const p = this._preset;
    const pos = window.EnderTrack?.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
    // Restore presetParams from scenario or use defaults
    this._presetParams = currentScenario?.presetParams || this._presetParams || {
      interval: 10, count: 10,
      zStart: Math.max(0, pos.z - 0.5).toFixed(2), zEnd: (pos.z + 0.5).toFixed(2), zStep: 0.05,
      listId: '', delay: 0.5,
      gridX: 3, gridY: 3, overlap: 10,
      exposure: 100000, gain: 1.0,
      lightChannel: '', lightIntensity: 100,
      format: 'tiff', path: './captures', prefix: 'acq',
      afRange: 0.1, afSteps: 10,
      cameraId: ''
    };
    const pp = this._presetParams;
    const channels = window.EnderTrack?.Light?.getChannels?.() || [];
    const cameras = window._cameras || [];
    if (p.useCapture && !pp.cameraId && cameras.length) pp.cameraId = String(cameras[0].id);
    const lists = window.EnderTrack?.Lists?.groups || [];

    let paramsHtml = '';

    // Dynamic params based on checked modes
    if (p.multipos) {
      // Auto-select first list if none selected
      if (!pp.listId && lists.length) pp.listId = String(lists[0].id);
      paramsHtml += `<div style="padding:6px; background:var(--app-bg); border-radius:4px; margin-top:6px;">
        <div style="font-size:9px; color:var(--text-general); margin-bottom:4px;">📍 Multi-positions</div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; width:50px;">Liste</label>
          <select onchange="EnderTrack.Scenario._pp('listId', this.value)" style="flex:1; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;">
            ${lists.map(l => `<option value="${l.id}" ${String(l.id) === String(pp.listId) ? 'selected' : ''}>${l.name} (${l.positions?.length || 0})</option>`).join('')}
          </select>
        </div>
        <div style="display:flex; gap:6px; align-items:center; margin-top:4px;">
          <label style="font-size:10px; width:50px;">Délai</label>
          <input type="number" value="${pp.delay}" min="0" step="0.1" onchange="EnderTrack.Scenario._pp('delay', parseFloat(this.value))"
            style="width:50px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">s</span>
        </div>
      </div>`;
    }

    if (p.mosaic) {
      paramsHtml += `<div style="padding:6px; background:var(--app-bg); border-radius:4px; margin-top:6px;">
        <div style="font-size:9px; color:var(--text-general); margin-bottom:4px;">🧩 Mosaïque</div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; width:50px;">Grille</label>
          <input type="number" value="${pp.gridX}" min="1" onchange="EnderTrack.Scenario._pp('gridX', parseInt(this.value))"
            style="width:35px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:10px; color:var(--text-general);">×</span>
          <input type="number" value="${pp.gridY}" min="1" onchange="EnderTrack.Scenario._pp('gridY', parseInt(this.value))"
            style="width:35px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">overlap</span>
          <input type="number" value="${pp.overlap}" min="0" max="50" onchange="EnderTrack.Scenario._pp('overlap', parseInt(this.value))"
            style="width:35px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">%</span>
        </div>
      </div>`;
    }

    if (p.timelapse) {
      paramsHtml += `<div style="padding:6px; background:var(--app-bg); border-radius:4px; margin-top:6px;">
        <div style="font-size:9px; color:var(--text-general); margin-bottom:4px;">⏱️ Time-lapse</div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; width:50px;">Interval</label>
          <input type="number" value="${pp.interval}" min="0.1" step="0.1" onchange="EnderTrack.Scenario._pp('interval', parseFloat(this.value))"
            style="width:50px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">s</span>
          <label style="font-size:10px; margin-left:8px;">×</label>
          <input type="number" value="${pp.count}" min="1" onchange="EnderTrack.Scenario._pp('count', parseInt(this.value))"
            style="width:40px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
        </div>
      </div>`;
    }

    if (p.zstack) {
      paramsHtml += `<div style="padding:6px; background:var(--app-bg); border-radius:4px; margin-top:6px;">
        <div style="font-size:9px; color:var(--text-general); margin-bottom:4px;">📚 Z-Stack</div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; width:30px;">Z</label>
          <input type="number" value="${pp.zStart}" step="0.01" onchange="EnderTrack.Scenario._pp('zStart', parseFloat(this.value))"
            style="width:50px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">→</span>
          <input type="number" value="${pp.zEnd}" step="0.01" onchange="EnderTrack.Scenario._pp('zEnd', parseFloat(this.value))"
            style="width:50px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">pas</span>
          <input type="number" value="${pp.zStep}" min="0.001" step="0.005" onchange="EnderTrack.Scenario._pp('zStep', parseFloat(this.value))"
            style="width:50px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">mm</span>
        </div>
      </div>`;
    }

    if (p.autofocus) {
      paramsHtml += `<div style="padding:6px; background:var(--app-bg); border-radius:4px; margin-top:6px;">
        <div style="font-size:9px; color:var(--text-general); margin-bottom:4px;">AF</div>
        <div style="display:flex; gap:6px; align-items:center;">
          <label style="font-size:10px; width:40px;">Mode</label>
          <select onchange="EnderTrack.Scenario._pp('afMode', this.value)" style="flex:1; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;">
            <option value="quick" ${(pp.afMode||'quick')==='quick'?'selected':''}>Rapide (P2+P3)</option>
            <option value="full" ${pp.afMode==='full'?'selected':''}>Complet (P1+P2+P3)</option>
          </select>
        </div>
      </div>`;
    }
    return `
      <div style="display:grid; grid-template-columns:auto 1fr; gap:12px; align-items:start;">
        <!-- LEFT: 2x2 icons -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
          <button onclick="EnderTrack.Scenario._togglePreset('multipos', ${!p.multipos})" style="padding:14px; border:${p.multipos ? '2px solid var(--active-element)' : '1px solid #444'}; border-radius:6px; cursor:pointer; font-size:22px; background:${p.multipos ? 'var(--app-bg)' : 'transparent'}; text-align:center;" title="Multi-pos">📍</button>
          <button onclick="EnderTrack.Scenario._togglePreset('timelapse', ${!p.timelapse})" style="padding:14px; border:${p.timelapse ? '2px solid var(--active-element)' : '1px solid #444'}; border-radius:6px; cursor:pointer; font-size:22px; background:${p.timelapse ? 'var(--app-bg)' : 'transparent'}; text-align:center;" title="Time-lapse">⏱️</button>
          <button onclick="EnderTrack.Scenario._togglePreset('zstack', ${!p.zstack})" style="padding:14px; border:${p.zstack ? '2px solid var(--active-element)' : '1px solid #444'}; border-radius:6px; cursor:pointer; font-size:22px; background:${p.zstack ? 'var(--app-bg)' : 'transparent'}; text-align:center;" title="Z-Stack">📚</button>
          <button onclick="EnderTrack.Scenario._togglePreset('mosaic', ${!p.mosaic})" style="padding:14px; border:${p.mosaic ? '2px solid var(--active-element)' : '1px solid #444'}; border-radius:6px; cursor:pointer; font-size:22px; background:${p.mosaic ? 'var(--app-bg)' : 'transparent'}; text-align:center;" title="Mosaïque">🧩</button>
          <button onclick="EnderTrack.Scenario._togglePreset('autofocus', ${!p.autofocus})" style="padding:14px; border:${p.autofocus ? '2px solid var(--active-element)' : '1px solid #444'}; border-radius:6px; cursor:pointer; font-size:22px; background:${p.autofocus ? 'var(--app-bg)' : 'transparent'}; text-align:center; grid-column:span 2;" title="Autofocus">🔍</button>
        </div>
        <!-- RIGHT: params -->
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${paramsHtml || '<div style="font-size:10px; color:#666; padding:6px;">Sélectionnez un mode</div>'}

          <div style="padding:6px; background:var(--app-bg); border-radius:4px; opacity:${p.useLight ? '1' : '0.4'};">
            <label style="font-size:9px; color:var(--text-general); cursor:pointer; display:flex; align-items:center; gap:4px; margin-bottom:4px;">
              <input type="checkbox" ${p.useLight ? 'checked' : ''} onchange="EnderTrack.Scenario._togglePreset('useLight', this.checked)" style="margin:0;">
              💡 Excitation
            </label>
            ${p.useLight ? `<div style="display:flex; gap:6px; align-items:center;">
              <select onchange="EnderTrack.Scenario._pp('lightChannel', this.value)" style="flex:1; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;">
                <option value="">— Aucun —</option>
                ${channels.map(c => `<option value="${c.id}" ${c.id === pp.lightChannel ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
              <input type="number" value="${pp.lightIntensity}" min="0" max="100" onchange="EnderTrack.Scenario._pp('lightIntensity', parseInt(this.value))" style="width:40px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
              <span style="font-size:9px; color:var(--text-general);">%</span>
            </div>` : ''}
          </div>

          <div style="padding:6px; background:var(--app-bg); border-radius:4px; opacity:${p.useCapture ? '1' : '0.4'};">
            <label style="font-size:9px; color:var(--text-general); cursor:pointer; display:flex; align-items:center; gap:4px; margin-bottom:4px;">
              <input type="checkbox" ${p.useCapture ? 'checked' : ''} onchange="EnderTrack.Scenario._togglePreset('useCapture', this.checked)" style="margin:0;">
              📷 Acquisition & Sortie
            </label>
            ${p.useCapture ? `<div style="display:flex; flex-direction:column; gap:4px;">
              <select onchange="EnderTrack.Scenario._pp('cameraId', this.value); EnderTrack.Scenario._togglePreset('useCapture', true)" style="width:100%; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;">
                <option value="">— Caméra —</option>
                ${(window._cameras || []).map(c => `<option value="${c.id}" ${String(c.id) === String(pp.cameraId) ? 'selected' : ''}>${c.label}</option>`).join('')}
              </select>
              ${(() => { const cam = (window._cameras || []).find(c => String(c.id) === String(pp.cameraId)); const hasCtrls = cam && (cam.type === 'picamera2' || cam.type === 'simulation'); return hasCtrls ? `<div style="display:flex; gap:6px; align-items:center;">
                <label style="font-size:10px;">Expo</label>
                <input type="number" value="${pp.exposure}" min="100" step="1000" onchange="EnderTrack.Scenario._pp('exposure', parseInt(this.value))" style="width:65px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
                <span style="font-size:9px; color:var(--text-general);">µs</span>
                <label style="font-size:10px;">Gain</label>
                <input type="number" value="${pp.gain}" min="1" max="16" step="0.1" onchange="EnderTrack.Scenario._pp('gain', parseFloat(this.value))" style="width:35px; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px; text-align:center;">
              </div>` : ''; })()}
              <div style="display:flex; gap:6px; align-items:center;">
                <select onchange="EnderTrack.Scenario._pp('format', this.value)" style="padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;">
                  <option value="tiff" ${pp.format === 'tiff' ? 'selected' : ''}>TIFF</option>
                  <option value="png" ${pp.format === 'png' ? 'selected' : ''}>PNG</option>
                  <option value="jpeg" ${pp.format === 'jpeg' ? 'selected' : ''}>JPEG</option>
                </select>
                <input type="text" value="${pp.prefix}" onchange="EnderTrack.Scenario._pp('prefix', this.value)" style="flex:1; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;" placeholder="préfixe">
                <input type="text" value="${pp.path || './captures'}" id="sbPathInput" onchange="EnderTrack.Scenario._pp('path', this.value)" style="flex:1; padding:3px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;" placeholder="chemin">
                <button onclick="EnderTrack.Scenario._browsePath()" style="padding:3px 6px; border:none; border-radius:3px; cursor:pointer; font-size:10px; background:var(--container-bg); color:var(--text-general);" title="Parcourir">...</button>
              </div>
            </div>` : ''}
          </div>
          </div>
        </div>
      </div>`;
  }

  _togglePreset(key, val) {
    const scenario = this.manager?.getCurrentScenario();
    if (!scenario) return;
    if (!scenario.presetState) scenario.presetState = { multipos: false, timelapse: false, zstack: false, mosaic: false, autofocus: false, useLight: false, useCapture: true };
    scenario.presetState[key] = val;
    this._preset = scenario.presetState;
    scenario.presetParams = { ...this._presetParams };
    this.manager.save();
    // Re-render presets view
    if (document.getElementById('sbPresetsView')) {
      window.EnderTrack.ScenarioBuilder?._renderPresetsView?.();
    } else {
      this.createUI();
    }
    // Auto-generate
    this._autoGenerate();
  }

  async _browsePath() {
    try {
      const url = window.ENDERTRACK_SERVER || 'http://localhost:5000';
      const res = await fetch(url + '/api/fs/dialog/directory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Dossier de capture', initialDir: this._presetParams?.path || '.' })
      });
      const data = await res.json();
      if (data.path) {
        this._pp('path', data.path);
        const el = document.getElementById('sbPathInput');
        if (el) el.value = data.path;
      }
    } catch (e) { /* dialog cancelled or server unavailable */ }
  }

  _pp(key, val) {
    if (!this._presetParams) this._presetParams = {};
    this._presetParams[key] = val;
    // Persist presetParams in scenario
    const scenario = this.manager?.getCurrentScenario();
    if (scenario) { scenario.presetParams = { ...this._presetParams }; this.manager.save(); }
    // Debounced auto-generate
    clearTimeout(this._ppTimer);
    this._ppTimer = setTimeout(() => this._autoGenerate(), 300);
  }

  _autoGenerate() {
    const p = this._preset || {};
    if (!p.multipos && !p.timelapse && !p.zstack && !p.mosaic && !p.autofocus) return;
    console.log('[Scenario] _autoGenerate preset:', JSON.stringify(p));
    this._generateFromPreset();
  }

  _generateFromPreset() {
    const p = this._preset || {};
    const pp = this._presetParams || {};
    const manager = window.EnderTrack?.Scenario?.manager;
    if (!manager) { console.warn('[Scenario] no manager'); return; }
    if (!p.multipos && !p.timelapse && !p.zstack && !p.mosaic) { console.warn('[Scenario] no mode selected'); return; }
    // Auto-fix listId if it doesn't exist
    if (p.multipos && pp.listId) {
      const list = window.EnderTrack?.Lists?.manager?.getList?.(pp.listId);
      if (!list) {
        const all = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
        if (all.length) { pp.listId = String(all[0].id); }
      }
    }
    console.log('[Scenario] _generateFromPreset, listId:', pp.listId);

    const parts = [];
    if (p.multipos) parts.push('Multi-pos');
    if (p.mosaic) parts.push('Mosaic');
    if (p.zstack) parts.push('Z-Stack');
    if (p.timelapse) parts.push('Timelapse');
    if (p.autofocus) parts.push('AF');
    const name = parts.join(' + ');

    // Capture block: light on + wait(expo) + capture + light off
    const captureActions = [];
    const expoMs = Math.ceil((pp.exposure || EnderTrack.Camera?.picamConfig?.exposure || 100000) / 1000);
    if (p.autofocus) captureActions.push({ type: 'action', actionId: 'autofocus', params: { mode: pp.afMode || 'quick', range: 2, showInLog: true, label: 'AF' } });
    if (p.useLight) captureActions.push({ type: 'action', actionId: 'light_set', params: { lightId: 1, action: 'on', intensity: pp.lightIntensity || 100, r: 255, g: 255, b: 255, showInLog: false } });
    if (p.useLight) captureActions.push({ type: 'action', actionId: 'wait', params: { duration: (expoMs + 50) / 1000, showInLog: false } });
    if (p.useCapture) captureActions.push({ type: 'action', actionId: 'capture', params: { format: pp.format || 'tiff', exposure: pp.exposure || 0, cameraId: pp.cameraId || '', path: pp.path || './captures', showInLog: true, label: 'Capture' } });
    if (p.useLight) captureActions.push({ type: 'action', actionId: 'light_set', params: { lightId: 1, action: 'off', showInLog: false } });

    // Z-stack wrapper
    const wrapZ = (children) => {
      if (!p.zstack) return children;
      const steps = Math.max(1, Math.round(Math.abs(pp.zEnd - pp.zStart) / Math.max(0.001, pp.zStep)));
      return [{
        type: 'loop', loopId: 'simple',
        params: { count: steps + 1, countMode: 'number', loopVar: '$k', label: `Z-Stack (${steps + 1})`, showInLog: true, logMessage: 'Z $k' },
        children: [
          { type: 'action', actionId: 'move', params: { moveType: 'absolute', absSource: 'manual', x: '$x', y: '$y', z: `${pp.zStart} + $k * ${pp.zStep}`, showInLog: false, label: 'Z' } },
          { type: 'action', actionId: 'wait', params: { duration: 0.1, showInLog: false } },
          ...children
        ]
      }];
    };

    let core = wrapZ(captureActions);

    // Mosaic + multipos: at each position, do a mosaic grid
    if (p.mosaic && p.multipos) {
      this._generateMosaicGrid(pp);
      core = [{
        type: 'loop', loopId: 'simple',
        params: { count: 0, countMode: 'list', countListId: pp._mosaicListId, loopVar: '$m', label: `Mosaic (${pp.gridX}x${pp.gridY})`, showInLog: true, logMessage: 'Tile $m' },
        children: [
          { type: 'action', actionId: 'move', params: { moveType: 'absolute', absSource: 'list', listId: pp._mosaicListId, listPickMode: 'index', listIndex: '$m', showInLog: false, label: 'Tile' } },
          { type: 'action', actionId: 'wait', params: { duration: 0.2, showInLog: false } },
          ...wrapZ(captureActions)
        ]
      }];
    }

    let rootChildren;
    if (p.multipos) {
      const loopChildren = [
        { type: 'action', actionId: 'move', params: { moveType: 'absolute', absSource: 'list', listId: pp.listId, listPickMode: 'index', listIndex: '$i', showInLog: false, label: 'Go' } },
      ];
      if (p.useLight) loopChildren.push({ type: 'action', actionId: 'light_set', params: { lightId: 1, action: 'off', showInLog: false } });
      loopChildren.push({ type: 'action', actionId: 'wait', params: { duration: pp.delay || 0.2, showInLog: false } });
      loopChildren.push(...core);
      rootChildren = [{
        type: 'loop', loopId: 'simple',
        params: { count: 0, countMode: 'list', countListId: pp.listId, loopVar: '$i', label: 'Positions', showInLog: true, logMessage: 'Position $i' },
        children: loopChildren
      }];
    } else if (p.mosaic) {
      this._generateMosaicGrid(pp);
      rootChildren = [{
        type: 'loop', loopId: 'simple',
        params: { count: 0, countMode: 'list', countListId: pp._mosaicListId, loopVar: '$i', label: `Mosaic (${pp.gridX}x${pp.gridY})`, showInLog: true, logMessage: 'Tile $i' },
        children: [
          { type: 'action', actionId: 'move', params: { moveType: 'absolute', absSource: 'list', listId: pp._mosaicListId, listPickMode: 'index', listIndex: '$i', showInLog: false, label: 'Tile' } },
          { type: 'action', actionId: 'wait', params: { duration: 0.2, showInLog: false } },
          ...wrapZ(captureActions)
        ]
      }];
    } else {
      rootChildren = core;
    }

    // Timelapse wrapper
    if (p.timelapse) {
      const isOnlyTimelapse = !p.multipos && !p.zstack && !p.mosaic;
      if (isOnlyTimelapse) {
        rootChildren = [{
          type: 'loop', loopId: 'simple',
          params: { count: pp.count || 10, countMode: 'number', loopVar: '$t', label: `Time-lapse (${pp.count}x)`, showInLog: true, logMessage: 'Frame $t' },
          children: [...captureActions, { type: 'action', actionId: 'wait', params: { duration: pp.interval || 10, showInLog: false } }]
        }];
      } else {
        rootChildren = [{
          type: 'loop', loopId: 'simple',
          params: { count: pp.count || 10, countMode: 'number', loopVar: '$t', label: `Time-lapse (${pp.count}x)`, showInLog: true, logMessage: 'Cycle $t' },
          children: [...rootChildren, { type: 'action', actionId: 'wait', params: { duration: pp.interval || 10, showInLog: false } }]
        }];
      }
    }

    // Stack mode: prepend init_stack action that sets context._stackPath
    const stackMeta = { unit: 'micron', grayscale: true };
    if (p.multipos) {
      const list = window.EnderTrack?.Lists?.manager?.getList?.(pp.listId);
      stackMeta.sizeC = list?.positions?.length || 1;
    }
    if (p.zstack) {
      const steps = Math.max(1, Math.round(Math.abs(pp.zEnd - pp.zStart) / Math.max(0.001, pp.zStep)));
      stackMeta.sizeZ = steps + 1;
      stackMeta.spacing = pp.zStep;
    }
    if (p.timelapse) {
      stackMeta.sizeT = pp.count || 10;
      stackMeta.finterval = pp.interval || 10;
    }
    const stackName = (pp.prefix || name || 'acquisition').replace(/[^a-zA-Z0-9_-]/g, '_');
    rootChildren.unshift({ type: 'action', actionId: 'init_stack', params: {
      label: 'Init Stack', name: stackName, metadata: stackMeta
    }});

    const tree = { type: 'root', children: rootChildren };
    console.log('[Scenario] generated tree:', JSON.stringify(tree, null, 2).slice(0, 500));
    // Update current scenario instead of creating a new one
    let scenario = manager.getCurrentScenario();
    if (!scenario) {
      scenario = manager.createScenario(name);
    } else {
      scenario.name = name;
    }
    scenario.tree = tree;
    manager.save();
    window.EnderTrack.Scenario.updateCanvasOverlay();
    // Refresh builder tree if open
    if (window.EnderTrack.ScenarioBuilder?.scenario) {
      window.EnderTrack.ScenarioBuilder.scenario = scenario;
      window.EnderTrack.ScenarioBuilder._refreshTree?.();
      window.EnderTrack.ScenarioBuilder._renderCodePanel?.();
    }
    this.createUI();
  }

  _generateMosaicGrid(pp) {
    const pos = window.EnderTrack?.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
    const fovX = 0.5, fovY = 0.4; // placeholder FOV mm
    const stepX = fovX * (1 - (pp.overlap || 10) / 100);
    const stepY = fovY * (1 - (pp.overlap || 10) / 100);
    const anchor = pp.mosaicAnchor || 'center';
    const offsetX = anchor === 'center' ? -stepX * (pp.gridX - 1) / 2 : 0;
    const offsetY = anchor === 'center' ? -stepY * (pp.gridY - 1) / 2 : 0;
    const positions = [];
    for (let row = 0; row < pp.gridY; row++) {
      const cols = row % 2 === 1
        ? Array.from({ length: pp.gridX }, (_, i) => pp.gridX - 1 - i)
        : Array.from({ length: pp.gridX }, (_, i) => i);
      for (const col of cols) {
        positions.push({ x: pos.x + offsetX + col * stepX, y: pos.y + offsetY + row * stepY, z: pos.z });
      }
    }
    const listManager = window.EnderTrack?.Lists?.manager;
    if (listManager?.createList) {
      const list = listManager.createList(`Mosaic ${pp.gridX}x${pp.gridY}`);
      list.positions = positions;
      listManager.save?.();
      pp._mosaicListId = String(list.id);
    }
  }

  _renderBuilderTab(scenarios, current) {
    const actionCount = current ? EnderTrack.TreeUtils.countActions(current.tree) : 0;
    return `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <select id="sbScenarioSelect" style="width:100%; padding:6px; background:var(--app-bg); border:1px solid #444; border-radius:4px; color:var(--text-selected); font-size:11px;">
          ${scenarios.map(s => `<option value="${s.id}" ${s.id === current?.id ? 'selected' : ''}>${s.icon || '\ud83c\udfac'} ${s.name}</option>`).join('')}
        </select>
        ${current ? `<div style="font-size:10px; color:var(--text-general);">${current.icon || '\ud83c\udfac'} ${actionCount} action${actionCount > 1 ? 's' : ''}</div>` : ''}
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <button onclick="EnderTrack.Scenario._openBuilder()" style="padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:11px; background:var(--active-element); color:var(--text-selected); font-weight:600;">\ud83d\udd27 Ouvrir Builder</button>
          <button onclick="EnderTrack.Scenario.executeScenario()" style="padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:11px; background:var(--container-bg); color:var(--text-general);">\u25b6 Ex\u00e9cuter</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <button onclick="EnderTrack.Scenario._newScenario()" style="padding:6px; border:none; border-radius:4px; cursor:pointer; font-size:10px; background:var(--app-bg); color:var(--text-general);">+ Nouveau vide</button>
          <button onclick="EnderTrack.Scenario._deleteScenario()" style="padding:6px; border:none; border-radius:4px; cursor:pointer; font-size:10px; background:var(--app-bg); color:var(--text-general);">\ud83d\uddd1 Supprimer</button>
        </div>
      </div>`;
  }

  _renderAccessoriesTab() {
    const link = window.EnderTrack?.ComputeLink;
    const light = window.EnderTrack?.Light;
    const camera = window.EnderTrack?.Camera;
    return `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <details>
          <summary style="font-size:11px; cursor:pointer; color:var(--text-selected);">\ud83d\udcf7 Cam\u00e9ra</summary>
          <div style="padding:6px; font-size:10px; color:var(--text-general);">
            Driver: <strong>${camera?.driverName || 'aucun'}</strong><br>
            Live: ${camera?.live ? '\u2705' : '\u274c'}
            <div style="margin-top:4px; display:flex; gap:4px;">
              <button onclick="EnderTrack.Camera.startLive()" style="padding:3px 8px; border:none; border-radius:3px; cursor:pointer; font-size:9px; background:var(--app-bg); color:var(--text-general);">Start Live</button>
              <button onclick="EnderTrack.Camera.stopLive()" style="padding:3px 8px; border:none; border-radius:3px; cursor:pointer; font-size:9px; background:var(--app-bg); color:var(--text-general);">Stop</button>
              <button onclick="EnderTrack.Display.toggleSplit()" style="padding:3px 8px; border:none; border-radius:3px; cursor:pointer; font-size:9px; background:var(--app-bg); color:var(--text-general);">Split view</button>
            </div>
          </div>
        </details>
        <details>
          <summary style="font-size:11px; cursor:pointer; color:var(--text-selected);">\ud83d\udca1 \u00c9clairage</summary>
          <div style="padding:6px; font-size:10px; color:var(--text-general);">
            Driver: <strong>${light?.driverName || 'aucun'}</strong>
            ${(light?.getChannels() || []).map(ch => `
              <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                <span style="width:80px;">${ch.name}</span>
                <input type="range" min="0" max="100" value="${Math.round((ch.intensity || 0) * 100)}"
                  oninput="EnderTrack.Light.setChannel('${ch.id}', this.value/100)"
                  style="flex:1; height:4px;">
                <span style="font-family:monospace; width:30px; text-align:right;">${Math.round((ch.intensity || 0) * 100)}%</span>
              </div>
            `).join('')}
          </div>
        </details>
        <details>
          <summary style="font-size:11px; cursor:pointer; color:var(--text-selected);">\ud83d\udda5\ufe0f Compute Link</summary>
          <div style="padding:6px; font-size:10px; color:var(--text-general);">
            Status: ${link?.connected ? `\u2705 ${link.serverUrl}` : '\u274c D\u00e9connect\u00e9'}
            <div style="margin-top:4px; display:flex; gap:4px;">
              <input type="text" id="computeLinkUrl" placeholder="http://server:8080" value="${link?.serverUrl || ''}"
                style="flex:1; padding:3px 6px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;">
              <button onclick="EnderTrack.ComputeLink.connect(document.getElementById('computeLinkUrl').value)" style="padding:3px 8px; border:none; border-radius:3px; cursor:pointer; font-size:9px; background:var(--app-bg); color:var(--text-general);">Connecter</button>
            </div>
          </div>
        </details>
      </div>`;
  }

  showExecutionUI() {
    const container = document.getElementById('acquisitionTabContent');
    if (!container) return;

    const scenario = this.manager?.getCurrentScenario();
    container.innerHTML = `
      <div style="padding:10px; display:flex; flex-direction:column; gap:8px;">
        <div style="font-size:12px; color:var(--text-selected); font-weight:500;">▶ ${scenario?.name || '?'}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
          <button onclick="EnderTrack.Scenario.executeScenario()" style="padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:#22c55e; color:#000; font-weight:600;">▶</button>
          <button id="sbPauseBtn" onclick="EnderTrack.Scenario._togglePause()" style="padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:var(--active-element); color:var(--text-selected); font-weight:600;">⏸</button>
          <button onclick="EnderTrack.Scenario.stopExecution()" style="padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:#ef4444; color:#fff; font-weight:600;">■</button>
        </div>
      </div>`;
  }

  // === ACTIONS ===

  _newScenario() {
    const name = prompt('Nom du scénario :', `Scénario ${this.manager.getAllScenarios().length + 1}`);
    if (!name) return;
    this.manager.createScenario(name);
    this.updateCanvasOverlay();
    this.createUI();
  }

  _showWizard(templateId) {
    const tpl = window.EnderTrack?.Acquisition?.templates?.get(templateId);
    if (!tpl) return;
    const params = {};
    for (const p of tpl.params) {
      const val = prompt(`${tpl.icon} ${tpl.name}
${p.label}:`, p.default ?? '');
      if (val === null) return;
      params[p.id] = p.type === 'number' ? parseFloat(val) || p.default : val;
    }
    window.EnderTrack.Acquisition.generate(templateId, params);
  }

  _deleteScenario() {
    const current = this.manager.getCurrentScenario();
    if (!current) return;
    if (!confirm(`Supprimer "${current.name}" ?`)) return;
    this.manager.deleteScenario(current.id);
    this.createUI();
  }

  _openBuilder() {
    const scenario = this.manager.getCurrentScenario();
    if (!scenario) return;
    if (window.EnderTrack.ScenarioBuilder?.open) {
      window.EnderTrack.ScenarioBuilder.open(scenario);
    }
  }

  _togglePause() {
    this._executor?.togglePause?.();
    const btn = document.getElementById('sbPauseBtn');
    if (btn) btn.textContent = this._executor?.isPaused ? '▶' : '⏸';
  }

  // === COMPAT API ===

  stop() { this.stopExecution(); }

  get executor() { return { isExecuting: this.isExecuting, stop: () => this.stop() }; }
  set executor(_) { /* compat: ignore */ }

  getSelectedList() {
    if (!this.selectedListId) return null;
    return EnderTrack.Lists?.manager?.getList?.(this.selectedListId) || null;
  }

  getSelectedListPositions() {
    return this.getSelectedList()?.positions || [];
  }

  // === COMPAT: simple run (iterate list + move) for fast-explore ===
  async run() {
    const list = this.getSelectedList();
    if (!list?.positions?.length) return;
    // Reset emergency stop
    EnderTrack.State?.update?.({ emergencyStopActive: false });
    if (EnderTrack.Movement) EnderTrack.Movement.emergencyStop = false;
    this.isExecuting = true;
    this._stopped = false;
    this._paused = false;
    this._runStartTime = Date.now();
    this.scenarioTrack = { enabled: true, visited: [], current: null, remaining: [], preview: list.positions };
    // Switch to acquisition tab to show UI
    window.switchTab?.('acquisition');
    EnderTrack.Events?.emit?.('scenario:activated');
    this._showRunUI(list);

    for (let i = 0; i < list.positions.length && !this._stopped; i++) {
      // Pause support
      while (this._paused && !this._stopped) await new Promise(r => setTimeout(r, 100));
      if (this._stopped) break;

      const p = list.positions[i];
      this.scenarioTrack.current = p;
      this.scenarioTrack.remaining = list.positions.slice(i + 1);
      this._updateRunUI(i, list.positions.length);
      EnderTrack.Canvas?.requestRender?.();

      try {
        await EnderTrack.Movement?.moveAbsolute(p.x, p.y, p.z);
      } catch { break; }

      this.scenarioTrack.visited.push({ x: p.x, y: p.y, z: p.z });
      this.addLog(`📍 Position ${i+1}/${list.positions.length} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`, 'info');
      EnderTrack.Events?.emit?.('scenario:position_reached', { position: p, index: i, loop: 0 });

      if (i < list.positions.length - 1 && this.delay > 0 && !this._stopped) {
        await new Promise(r => setTimeout(r, this.delay));
      }
    }

    const duration = ((Date.now() - this._runStartTime) / 1000).toFixed(1);
    this.addLog(this._stopped ? '⏹ Arrêté' : `✅ Terminé (${duration}s)`, this._stopped ? 'warning' : 'info');
    this.isExecuting = false;
    this._stopped = false;
    this._paused = false;
    EnderTrack.Events?.emit?.('scenario:completed', { scenarioName: list.name, duration: parseFloat(duration) });
    EnderTrack.Canvas?.requestRender?.();
    this._updateRunUI(list.positions.length, list.positions.length);
  }

  _togglePause() {
    if (!this.isExecuting) return;
    this._paused = !this._paused;
    const btn = document.getElementById('sbPlayPauseBtn');
    if (btn) btn.textContent = this._paused ? '▶' : '⏸';
    this.addLog(this._paused ? '⏸ Pause' : '▶ Reprise', 'info');
  }

  stopExecution() {
    this._stopped = true;
    this._isExecuting = false;
    this._paused = false;
    this._executor?.stop?.();
    // Cancel current movement
    window.EnderTrack?.Movement?.emergencyStopMovement?.();
    // Restore UI immediately
    this._hideRunUI();
    this.createUI();
  }

  stop() { this.stopExecution(); }

  _showRunUI(list) {
    // Progress + logs in right panel
    const zone = document.getElementById('rightPluginZone');
    if (!zone) return;
    let el = document.getElementById('scenarioRunPanel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'scenarioRunPanel';
      zone.prepend(el);
    }
    el.style.display = '';
    el.innerHTML = `
      <div style="padding:8px; display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="flex:1; font-size:10px; color:var(--text-selected); font-weight:500;">\u25b6 ${list.name} (${list.positions.length})</div>
          <span id="sbRunStatus" style="font-size:9px; color:var(--coordinates-color);">0%</span>
        </div>
        <div style="height:4px; background:var(--app-bg); border-radius:2px; overflow:hidden;">
          <div id="sbRunProgress" style="height:100%; width:0%; background:#22c55e; border-radius:2px; transition:width 0.3s;"></div>
        </div>
        <div id="sbRunLog" style="max-height:150px; overflow-y:auto; background:var(--app-bg); border-radius:4px; padding:4px 6px; font-size:9px; font-family:var(--font-mono);"></div>
      </div>
    `;
    // Play/pause + stop in left panel (acquisition tab)
    const acqTab = document.getElementById('acquisitionTabContent');
    if (acqTab) {
      acqTab.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; padding:8px;">
          <div style="font-size:11px; color:var(--text-selected); font-weight:500;">\u25b6 ${list.name}</div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button id="sbPlayPauseBtn" onclick="EnderTrack.Scenario._togglePause()" style="flex:1; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:14px; background:var(--active-element); color:var(--text-selected); font-weight:600;">\u23f8</button>
            <button onclick="EnderTrack.Scenario.stopExecution()" style="padding:10px 16px; border:none; border-radius:4px; cursor:pointer; font-size:14px; background:#ef4444; color:#fff; font-weight:600;">\u25a0</button>
          </div>
        </div>
      `;
    }
  }

  _updateRunUI(current, total) {
    const pct = Math.round((current / total) * 100);
    const bar = document.getElementById('sbRunProgress');
    if (bar) bar.style.width = pct + '%';
    const status = document.getElementById('sbRunStatus');
    const elapsed = ((Date.now() - this._runStartTime) / 1000).toFixed(0);
    if (status) status.textContent = `${current}/${total} — ${elapsed}s`;
  }

  _hideRunUI() {
    const el = document.getElementById('scenarioRunPanel');
    if (el) el.style.display = 'none';
  }

  addLog(message, type = 'info') {
    const colors = { info: 'var(--text-general)', warning: '#f59e0b', error: '#ef4444' };
    const el = document.getElementById('sbRunLog') || document.getElementById('scenarioRightLog');
    if (el) {
      el.innerHTML += `<div style="color:${colors[type] || colors.info}; padding:1px 0;">${message}</div>`;
      el.scrollTop = el.scrollHeight;
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Scenario = new ScenarioModule();
// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.Scenario.init());
} else {
  setTimeout(() => EnderTrack.Scenario.init(), 0);
}
