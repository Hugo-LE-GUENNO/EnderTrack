// plugins/scenario-builder/src/core/scenario-module.js — Main entry point

class ScenarioModule {
  constructor() {
    this.isActive = false;
    this.selectedListId = null;
    this.scenarioTrack = { enabled: true, visited: [], current: null, remaining: [], preview: [] };
    this.manager = null;
    this.executor = null;
    this._logEntries = [];
  }

  get isExecuting() { return this.executor?.isExecuting || false; }

  async init() {
    this.manager = new window.EnderTrack.ScenarioManager();
    this.executor = new window.EnderTrack.ScenarioExecutor();
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

    await this.executor.executeTree(scenario.tree, scenario.watchers);

    EnderTrack.Events?.emit?.('scenario:completed', {
      scenarioName: scenario.name,
      duration: this.executor.getElapsedTime()
    });
    this._showRightPanel(false);
    this.createUI();
  }

  stopExecution() {
    this.executor?.stop();
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
    const watcherCount = current?.watchers?.length || 0;
    const desc = current?.description || '';
    const icon = current?.icon || '🎬';

    let infoHtml = '';
    if (current) {
      const parts = [`${actionCount} action${actionCount > 1 ? 's' : ''}`];
      if (watcherCount) parts.push(`${watcherCount} watcher${watcherCount > 1 ? 's' : ''}`);
      const statsLine = `<div style="font-size:10px; color:var(--text-general); margin-bottom:4px;">${icon} ${parts.join(' \u2022 ')}</div>`;
      const descLine = desc ? `<div style="font-size:10px; color:var(--text-general); opacity:0.6;">${desc}</div>` : '';
      const customFields = current.customFields || [];
      const customHtml = customFields.filter(f => f.label).map(f =>
        `<div style="display:flex; justify-content:space-between; font-size:10px; padding:1px 0;"><span style="color:var(--text-general);">${f.label}</span><span style="color:var(--coordinates-color); font-family:monospace;">${f.value || ''}</span></div>`
      ).join('');
      if (statsLine || descLine || customHtml) infoHtml = `<div style="background:var(--app-bg); border-radius:4px; padding:8px;">${statsLine}${descLine}${customHtml}</div>`;
    }

    container.innerHTML = `
      <div style="padding:8px; display:flex; flex-direction:column; gap:8px;">
        <select id="sbScenarioSelect" style="width:100%; padding:6px; background:var(--app-bg); border:1px solid #444; border-radius:4px; color:var(--text-selected); font-size:11px;">
          ${scenarios.map(s => `<option value="${s.id}" ${s.id === current?.id ? 'selected' : ''}>${s.icon || '🎬'} ${s.name}</option>`).join('')}
        </select>
        ${infoHtml}
        <button onclick="EnderTrack.Scenario.executeScenario()" style="width:100%; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:var(--active-element); color:var(--text-selected); font-weight:600;">▶ Exécuter</button>
        <button onclick="EnderTrack.Scenario._openBuilder()" style="width:100%; padding:8px; border:none; border-radius:4px; cursor:pointer; font-size:11px; background:var(--container-bg); color:var(--text-general); transition:background 0.15s;" onmouseover="this.style.background='var(--active-element)';this.style.color='var(--text-selected)'" onmouseout="this.style.background='var(--container-bg)';this.style.color='var(--text-general)'">🔧 Builder</button>
      </div>`;

    document.getElementById('sbScenarioSelect')?.addEventListener('change', e => {
      this.manager.setCurrentScenario(e.target.value);
      EnderTrack.VariableManager?.init?.(this.manager.getCurrentScenario());
      this.updateCanvasOverlay();
      this.createUI();
    });
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
    this.createUI();
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
    this.executor?.togglePause?.();
    const btn = document.getElementById('sbPauseBtn');
    if (btn) btn.textContent = this.executor?.isPaused ? '▶' : '⏸';
  }

  // === COMPAT API ===

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
