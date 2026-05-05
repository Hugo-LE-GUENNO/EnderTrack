// plugins/scenario-builder/src/core/scenario-module.js — Main entry point

class ScenarioModule {
  constructor() {
    this.isActive = false;
    this.selectedListId = null;
    this.scenarioTrack = { enabled: true, visited: [], current: null, remaining: [], preview: [] };
    this.manager = null;
    this._executor = null;
    this._logEntries = [];
  }

  get isExecuting() { return this._executor?.isExecuting || false; }

  async init() {
    this.manager = new window.EnderTrack.ScenarioManager();
    this._executor = new window.EnderTrack.ScenarioExecutor();
    this.isActive = true;
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
    const el = document.getElementById('scenarioRightLog');
    if (el) { el.innerHTML += line; el.scrollTop = el.scrollHeight; }
  }

  // === EXECUTION ===

  async executeScenario() {
    const scenario = this.manager?.getCurrentScenario();
    if (!scenario?.tree) return;

    // Close builder if open
    document.getElementById('sbModal')?.remove();

    this.scenarioTrack = { enabled: true, visited: [], current: null, remaining: [], preview: this.scenarioTrack.preview || [] };
    this._logEntries = [];
    this._showRightPanel(true);
    this.showExecutionUI();
    EnderTrack.Events?.emit?.('scenario:activated');

    await this._executor.executeTree(scenario.tree, scenario.watchers);

    EnderTrack.Events?.emit?.('scenario:completed', {
      scenarioName: scenario.name,
      duration: this._executor.getElapsedTime()
    });
    this._showRightPanel(false);
    this.createUI();
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

    if (!this._subTab) this._subTab = 'presets';
    const scenarios = this.manager?.getAllScenarios() || [];
    const current = this.manager?.getCurrentScenario();

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%;">
        <!-- Sub-tabs -->
        <div style="display:flex; gap:2px; padding:6px 8px; border-bottom:1px solid #333;">
          <button onclick="EnderTrack.Scenario._setSubTab('presets')" style="padding:5px 10px; border:none; border-radius:4px; cursor:pointer; font-size:10px; background:${this._subTab === 'presets' ? 'var(--active-element)' : 'transparent'}; color:${this._subTab === 'presets' ? 'var(--text-selected)' : 'var(--text-general)'};">Presets</button>
          <button onclick="EnderTrack.Scenario._setSubTab('builder')" style="padding:5px 10px; border:none; border-radius:4px; cursor:pointer; font-size:10px; background:${this._subTab === 'builder' ? 'var(--active-element)' : 'transparent'}; color:${this._subTab === 'builder' ? 'var(--text-selected)' : 'var(--text-general)'};">Builder</button>
          <button onclick="EnderTrack.Scenario._setSubTab('accessories')" style="padding:5px 10px; border:none; border-radius:4px; cursor:pointer; font-size:10px; background:${this._subTab === 'accessories' ? 'var(--active-element)' : 'transparent'}; color:${this._subTab === 'accessories' ? 'var(--text-selected)' : 'var(--text-general)'};">Accessoires</button>
        </div>
        <!-- Content -->
        <div style="flex:1; overflow-y:auto; padding:8px;">
          ${this._subTab === 'presets' ? this._renderPresetsTab(scenarios, current) : ''}
          ${this._subTab === 'builder' ? this._renderBuilderTab(scenarios, current) : ''}
          ${this._subTab === 'accessories' ? this._renderAccessoriesTab() : ''}
        </div>
      </div>`;

    document.getElementById('sbScenarioSelect')?.addEventListener('change', e => {
      this.manager.setCurrentScenario(e.target.value);
      EnderTrack.VariableManager?.init?.(this.manager.getCurrentScenario());
      this.updateCanvasOverlay();
      this.createUI();
    });
  }

  _setSubTab(tab) {
    this._subTab = tab;
    this.createUI();
  }

  _renderPresetsTab(scenarios, current) {
    const templates = window.EnderTrack?.Acquisition?.getTemplates() || [];
    return `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="font-size:10px; color:var(--text-general);">Acquisition rapide</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          ${templates.map(t => `
            <button onclick="EnderTrack.AcquisitionModal._selectedType='${t.id}'; EnderTrack.AcquisitionModal.open()"
              style="padding:10px 8px; border:1px solid #444; border-radius:6px; cursor:pointer; font-size:10px; background:var(--app-bg); color:var(--text-selected); text-align:center;">
              <div style="font-size:18px; margin-bottom:2px;">${t.icon}</div>${t.name}
            </button>
          `).join('')}
        </div>
        ${scenarios.length > 0 ? `
        <div style="margin-top:8px; padding-top:8px; border-top:1px solid #333;">
          <div style="font-size:10px; color:var(--text-general); margin-bottom:6px;">Scénarios existants</div>
          <select id="sbScenarioSelect" style="width:100%; padding:6px; background:var(--app-bg); border:1px solid #444; border-radius:4px; color:var(--text-selected); font-size:11px;">
            ${scenarios.map(s => `<option value="${s.id}" ${s.id === current?.id ? 'selected' : ''}>${s.icon || '\ud83c\udfac'} ${s.name}</option>`).join('')}
          </select>
          <button onclick="EnderTrack.Scenario.executeScenario()" style="width:100%; margin-top:6px; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:var(--active-element); color:var(--text-selected); font-weight:600;">\u25b6 Ex\u00e9cuter</button>
        </div>` : ''}
      </div>`;
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
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Scenario = new ScenarioModule();
// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => EnderTrack.Scenario.init());
} else {
  setTimeout(() => EnderTrack.Scenario.init(), 0);
}
