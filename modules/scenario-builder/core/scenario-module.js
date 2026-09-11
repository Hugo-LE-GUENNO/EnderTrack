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
    this._runStartTime = Date.now();
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
            ${current.description ? `<div style="font-size:9px; color:#888; margin-top:2px; white-space:pre-line;">${current.description}</div>` : ''}
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

    const sel = document.getElementById('sbScenarioSelect');
    sel?.addEventListener('change', e => {
      if (e.target.value === '_new') { this._openBuilder(); return; }
      this.manager.setCurrentScenario(e.target.value);
      EnderTrack.VariableManager?.init?.(this.manager.getCurrentScenario());
      this.updateCanvasOverlay();
      this.createUI();
    });
    sel?.addEventListener('contextmenu', e => {
      e.preventDefault();
      this._showScenarioContextMenu(e.clientX, e.clientY);
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
    const name = prompt('Scenario name:', `Scenario ${this.manager.getAllScenarios().length + 1}`);
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
    if (!confirm(`Delete "${current.name}" ?`)) return;
    this.manager.deleteScenario(current.id);
    const next = this.manager.getCurrentScenario();
    if (next) EnderTrack.ScenarioBuilder?._switchToScenario?.(next.id);
    this.createUI();
  }

  _showScenarioContextMenu(x, y) {
    const scenario = this.manager?.getCurrentScenario();
    if (!scenario) return;
    document.querySelector('.sb-ctx-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'sb-ctx-menu sb-file-menu';
    menu.style.cssText = `left:${x}px; top:${y}px;`;
    menu.innerHTML = `
      <div class="sb-menu-item" data-action="rename">✏️ Rename</div>
      <div class="sb-menu-item" data-action="desc">📝 Description</div>
      <div class="sb-menu-item sb-menu-danger" data-action="delete">🗑 Delete</div>`;
    document.body.appendChild(menu);
    menu.addEventListener('click', e => {
      const action = e.target.dataset.action;
      menu.remove();
      if (action === 'rename') {
        const name = prompt('New name:', scenario.name);
        if (name?.trim()) { scenario.name = name.trim(); this.manager._save?.(); this.createUI(); }
      } else if (action === 'desc') {
        const desc = prompt('Description:', scenario.description || '');
        if (desc !== null) { scenario.description = desc; this.manager._save?.(); this.createUI(); }
      } else if (action === 'delete') {
        if (confirm(`Delete "${scenario.name}" ?`)) {
          this.manager.deleteScenario(scenario.id);
          this.createUI();
        }
      }
    });
    const close = () => { menu.remove(); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);
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
    this.addLog(this._stopped ? '⏹ Stopped' : `✅ Done (${duration}s)`, this._stopped ? 'warning' : 'info');
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
