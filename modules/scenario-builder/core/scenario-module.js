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
    this.createUI();
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
    
    this.isExecuting = true;
    this._showRunUI({ name: scenario?.name || 'Scenario', positions: [] });
    this.createUI();
    EnderTrack.Events?.emit?.('scenario:activated');

    await this._executor.executeTree(scenario.tree, scenario.watchers);

    const dur = this._executor.getElapsedTime().toFixed(1);
    this.addLog('✅ Done (' + dur + 's)', 'info');
    this.isExecuting = false;
    this._paused = false;
    const bar = document.getElementById('sbGlobalBar');
    const txt = document.getElementById('sbGlobalPct');
    if (bar) { bar.style.width = '100%'; bar.style.background = '#6366f1'; bar.style.opacity = '1'; bar.style.animation = ''; }
    if (txt) txt.textContent = '100%';
    EnderTrack.Events?.emit?.('scenario:completed', {
      scenarioName: scenario.name,
      duration: parseFloat(dur)
    });
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

  _renderMiniTree(children, indent = 0) {
    if (!children?.length) return '<div style="font-size:9px; color:#444; font-style:italic;">empty</div>';
    const pad = indent * 10;
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return children.map(node => {
      if (node.type === 'action') {
        const def = EnderTrack.ActionRegistry?.get(node.actionId);
        const label = node.label || def?.label || node.actionId;
        const p = node.params || {};
        let detail = '';
        if (node.actionId === 'move') {
          if (p.moveType === 'list') {
            const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
            const list = lists[Math.max(0, Math.floor(Number(p.listId) || 0))] || lists[0];
            detail = ` <span style="color:#4f9eff;">${esc(list?.name || 'List')}[${esc(p.listIndex || '$i')}]</span>`;
          } else if (p.moveType === 'relative') {
            detail = ` <span style="color:#666;">&Delta;(${esc(p.dx||0)}, ${esc(p.dy||0)}, ${esc(p.dz||0)})</span>`;
          } else {
            detail = ` <span style="color:#666;">(${esc(p.x||0)}, ${esc(p.y||0)}, ${esc(p.z||0)})</span>`;
          }
        } else if (node.actionId === 'wait') {
          detail = ` <span style="color:#666;">${esc(p.duration||0)}s</span>`;
        } else if (node.actionId === 'log') {
          detail = ` <span style="color:#555;">"${esc((p.message||'').substring(0,20))}"</span>`;
        } else if (node.actionId === 'setvar') {
          detail = ` <span style="color:#a78bfa;">${esc(p.varId||'')} = ${esc(p.value||'')}</span>`;
        } else if (node.actionId === 'capture') {
          detail = ` <span style="color:#666;">${esc(p.filename||'img')}.${esc(p.format||'tiff')}</span>`;
        } else if (node.actionId === 'led') {
          detail = ` <span style="color:#666;">${p.on !== false ? 'ON' : 'OFF'}</span>`;
        }
        return `<div style="padding:1px 0 1px ${pad}px; font-size:10px; color:#666; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">· ${esc(label)}${detail}</div>`;
      }
      if (node.type === 'loop') {
        const def = EnderTrack.LoopTypesRegistry?.get(node.loopId);
        const label = node.label || node.params?.label || def?.label || 'Loop';
        const p = node.params || {};
        let detail = '';
        if (node.loopId === 'simple') {
          if (p.countMode === 'list') {
            const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
            const list = lists[Math.max(0, Math.floor(Number(p.countListId) || 0))] || lists[0];
            detail = ` <span style="color:#4f9eff;">× ${esc(list?.name || 'List')} (${list?.positions?.length ?? '?'})</span>`;
          } else if (p.countMode === 'infinite') {
            detail = ` <span style="color:#94a3b8;">∞</span>`;
          } else {
            detail = ` <span style="color:#94a3b8;">× ${esc(p.count ?? '?')}</span>`;
          }
        } else if (node.loopId === 'while') {
          detail = ` <span style="color:#94a3b8;">${esc(p.condition || '')}</span>`;
        }
        const sub = this._renderMiniTree(node.children || [], indent + 1);
        return `<div style="padding:1px 0 1px ${pad}px; font-size:10px; color:#94a3b8; font-weight:600;">${esc(label)}${detail}</div>${sub}`;
      }
      if (node.type === 'condition') {
        const label = node.label || node.params?.label || 'Condition';
        const branches = (node.branches || []).map((b, bi) => {
          const bl = b.condition === null ? 'ELSE' : (bi === 0 ? `IF ${b.condition}` : `ELSE IF ${b.condition}`);
          return `<div style="padding:1px 0 1px ${pad + 10}px; font-size:10px; color:#6366f1;">${esc(bl)}</div>` +
            this._renderMiniTree(b.actions || [], indent + 2);
        }).join('');
        return `<div style="padding:1px 0 1px ${pad}px; font-size:10px; color:#818cf8; font-weight:600;">${esc(label)}</div>${branches}`;
      }
      if (node.type === 'macro') {
        const count = EnderTrack.TreeUtils?.countActions?.(node) || 0;
        return `<div style="padding:1px 0 1px ${pad}px; font-size:10px; color:#94a3b8;">${esc(node.name || 'Macro')} <span style="color:#555;">(${count})</span></div>`;
      }
      return '';
    }).join('');
  }

  // === UI ===

  createUI() {
    const container = document.getElementById('acquisitionTabContent');
    if (!container) return;

    // During execution: update button styles without rebuilding DOM
    if (this.isExecuting) {
      const btn = document.getElementById('sbPlayPauseBtn');
      if (btn) {
        btn.textContent = '\u23f8';
        btn.style.background = '#92400e';
        btn.style.color = '#fcd34d';
        btn.style.boxShadow = this._paused ? 'inset 0 2px 4px rgba(0,0,0,0.4)' : '';
      }
      // Inject stop button if not present
      if (!document.getElementById('sbStopBtn')) {
        const stopBtn = document.createElement('button');
        stopBtn.id = 'sbStopBtn';
        stopBtn.textContent = '\u25a0';
        stopBtn.onclick = () => EnderTrack.Scenario._confirmStop();
        stopBtn.style.cssText = 'padding:10px 14px; border:none; border-radius:4px; cursor:pointer; font-size:14px; background:#7f1d1d; color:#fca5a5; font-weight:600;';
        btn?.parentElement?.appendChild(stopBtn);
      }
      return;
    }
    const scenarios = this.manager?.getAllScenarios() || [];
    const current = this.manager?.getCurrentScenario();
    const actionCount = current ? EnderTrack.TreeUtils.countActions(current.tree) : 0;
    const hasScenarios = scenarios.length > 0;

    const vars = current?.customVariables || [];
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; padding:8px;">

        <!-- 1. Dropdown + builder button -->
        <div style="display:flex; gap:6px; align-items:center;">
          <select id="sbScenarioSelect" style="flex:1; padding:8px; background:var(--app-bg); border:1px solid #444; border-radius:4px; color:var(--text-selected); font-size:11px;">
            ${hasScenarios ? scenarios.map(s => `<option value="${s.id}" ${s.id === current?.id ? 'selected' : ''}>${s.icon || '\ud83c\udfac'} ${s.name}</option>`).join('') : '<option value="_new">+ New scenario</option>'}
          </select>
          <button onclick="EnderTrack.Scenario._openBuilder()" title="Open builder" style="padding:6px 8px; border:1px solid #444; border-radius:4px; background:var(--app-bg); color:var(--text-general); cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center;" onmouseenter="this.style.background='var(--container-bg)'" onmouseleave="this.style.background='var(--app-bg)'">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <circle cx="10" cy="3" r="1.5"/>
              <line x1="10" y1="4.5" x2="10" y2="8"/>
              <line x1="10" y1="8" x2="5" y2="11"/>
              <line x1="10" y1="8" x2="15" y2="11"/>
              <circle cx="5" cy="12.5" r="1.5"/>
              <circle cx="15" cy="12.5" r="1.5"/>
              <line x1="5" y1="14" x2="3" y2="17"/>
              <line x1="5" y1="14" x2="7" y2="17"/>
              <line x1="15" y1="14" x2="13" y2="17"/>
              <line x1="15" y1="14" x2="17" y2="17"/>
              <circle cx="3" cy="17.5" r="1"/>
              <circle cx="7" cy="17.5" r="1"/>
              <circle cx="13" cy="17.5" r="1"/>
              <circle cx="17" cy="17.5" r="1"/>
            </svg>
          </button>
        </div>

        <!-- 2. Play / Pause / Stop -->
        <div style="display:flex; gap:6px;">
          <button id="sbPlayPauseBtn" onclick="EnderTrack.Scenario.isExecuting ? EnderTrack.Scenario._togglePause() : EnderTrack.Scenario.executeScenario()"
            style="flex:1; padding:10px; border:none; border-radius:4px; cursor:pointer; font-size:14px; font-weight:600; background:#14532d; color:#86efac;"
            ${actionCount > 0 || isNaN(actionCount) ? '' : 'disabled'}>&#x25b6;</button>
        </div>

        <!-- 3. Separator -->
        <div style="border-top:1px solid #2a2a2a;"></div>

        <!-- 4. Scenario card -->
        ${current ? `<div style="background:#2a2a2a; border-radius:6px; overflow:hidden; ${current.color ? `border-left:3px solid ${current.color};` : ''}">\n
          <!-- Header: icon + title -->
          <div style="padding:8px 10px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:${current.description ? 4 : 0}px;">
              ${current.icon ? `<span style="font-size:14px; line-height:1;">${current.icon}</span>` : ''}
              <span style="font-size:12px; font-weight:600; color:var(--text-selected);">${current.name}</span>
            </div>
            ${current.description ? `<div style="font-size:10px; color:#888; white-space:pre-line; line-height:1.5;">${current.description}</div>` : ''}
          </div>

          ${vars.length ? `<div style="padding:0 10px 8px; display:flex; flex-wrap:wrap; gap:4px;">
            ${vars.map(v => `<span style="font-size:9px; font-family:monospace; color:#6366f1; background:#1e1e2e; border-radius:3px; padding:1px 5px;">${v.id}</span>`).join('')}
          </div>` : ''}

          <div style="border-top:1px solid #333; padding:6px 10px; max-height:180px; overflow-y:auto;">
            ${this._renderMiniTree(current.tree?.children || [])}
          </div>

        </div>` : ''}

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
    this._executor.togglePause();
    this._paused = this._executor.isPaused;
    this.createUI();
    this._updateLoopBars(this._executor._loopStack || []);
    this._updateGlobalBar(this._executor._doneActions || 0, this._executor._totalActions || 0);
    const elapsed = ((Date.now() - this._runStartTime) / 1000).toFixed(0);
    this.addLog(this._paused ? `\u23f8 Paused at ${elapsed}s` : `\u25b6 Resumed at ${elapsed}s`, 'info');
  }

  _confirmStop() {
    if (!this.isExecuting) return;
    if (!confirm('Stop the current scenario?')) return;
    this.stopExecution();
  }

  stopExecution() {
    this._stopped = true;
    this._isExecuting = false;
    this._paused = false;
    this._executor?.stop?.();
    // Reset le flag emergency stop pour ne pas bloquer les mouvements manuels
    EnderTrack.State?.update?.({ emergencyStopActive: false, isMoving: false });
    if (EnderTrack.Movement) EnderTrack.Movement.emergencyStop = false;
    // Marquer le panel comme arrêté sans le cacher
    const nameEl = document.getElementById('sbRunName');
    if (nameEl && !nameEl.textContent.includes('—')) nameEl.textContent += ' — stopped';
    const bar = document.getElementById('sbGlobalBar');
    if (bar) bar.style.background = '#ef4444';
    const pct = document.getElementById('sbGlobalPct');
    if (pct) pct.textContent = '■';
    this.createUI();
  }

  stop() { this.stopExecution(); }

  _updateRunUI(done, total) {
    this._updateGlobalBar(done, total);
  }

  _showRunUI(list) {
    const zone = document.getElementById('rightPluginZone');
    if (!zone) return;
    let el = document.getElementById('scenarioRunPanel');
    if (!el) { el = document.createElement('div'); el.id = 'scenarioRunPanel'; zone.prepend(el); }
    el.style.display = '';
    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0;">
        <!-- Bloc progression (fixe) -->
        <div id="sbProgressBlock" style="padding:8px; display:flex; flex-direction:column; gap:5px; border-bottom:1px solid #333;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div id="sbRunName" style="font-size:11px; color:var(--text-selected); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${list.name}</div>
            <span id="sbRunStatus" style="font-size:10px; color:var(--text-general); font-family:monospace; flex-shrink:0; margin-left:6px;">0s</span>
          </div>
          <div id="sbGlobalBarWrap" style="position:relative; height:14px; background:var(--app-bg); border-radius:6px; overflow:hidden; border:1px solid #444;">
            <div id="sbGlobalBar" style="height:100%; width:0%; background:#6366f1; border-radius:6px; transition:width 0.3s, background 0.3s;"></div>
            <span id="sbGlobalPct" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:600; color:#fff; font-family:monospace;"></span>
          </div>
          <div id="sbLoopBars" style="display:flex; flex-direction:column; gap:3px;"></div>
          <div id="sbWaitTimer" style="visibility:hidden; font-size:10px; color:var(--text-general); font-family:monospace;">​</div>
        </div>
        <!-- Bloc logs (fixe) -->
        <div style="padding:6px 8px 4px; display:flex; align-items:center; justify-content:space-between;">
          <span style="font-size:9px; color:#555; font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Logs</span>
          <button onclick="EnderTrack.Scenario._copyLogs()" title="Copier les logs" style="border:none; background:none; color:#666; cursor:pointer; font-size:11px; padding:2px 4px; border-radius:3px;" onmouseenter="this.style.color='var(--text-general)'" onmouseleave="this.style.color='#666'">⎘</button>
        </div>
        <div id="sbRunLog" style="height:180px; overflow-y:auto; padding:0 8px 8px; font-size:10px; font-family:monospace; line-height:1.6;"></div>
      </div>`;
    this._runStartTime = Date.now();
    this._startStatusTimer();
  }

  _copyLogs() {
    const el = document.getElementById('sbRunLog');
    if (!el) return;
    const text = Array.from(el.querySelectorAll('div')).map(d => d.textContent).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      EnderTrack.UI?.showNotification?.('Logs copiés', 'success');
    });
  }

  _startStatusTimer() {
    if (this._statusTimer) clearInterval(this._statusTimer);
    this._statusTimer = setInterval(() => {
      if (!this.isExecuting) { clearInterval(this._statusTimer); return; }
      const elapsed = ((Date.now() - this._runStartTime) / 1000).toFixed(0);
      const el = document.getElementById('sbRunStatus');
      if (el) el.textContent = `${elapsed}s`;
    }, 500);
  }

  _updateGlobalBar(done, total) {
    const paused = this._paused;
    const color = paused ? '#f59e0b' : '#6366f1';
    const bar = document.getElementById('sbGlobalBar');
    const txt = document.getElementById('sbGlobalPct');
    if (total === Infinity || isNaN(total)) {
      // indeterminate: animated sliding bar, no percentage
      if (bar) { bar.style.width = '40%'; bar.style.background = color; bar.style.opacity = '0.7'; bar.style.animation = paused ? 'none' : 'sbSlide 1.2s linear infinite'; }
      if (txt) txt.textContent = '';
    } else {
      const pct = Math.min(100, Math.round((done / total) * 100));
      if (bar) { bar.style.width = pct + '%'; bar.style.background = color; bar.style.opacity = '1'; bar.style.animation = ''; }
      if (txt) txt.textContent = pct + '%';
    }
  }

  _updateLoopBars(loopStack) {
    const container = document.getElementById('sbLoopBars');
    if (!container) return;
    const paused = this._paused;
    const barColor = paused ? '#f59e0b' : '#22d3ee';
    container.innerHTML = loopStack.map((entry, depth) => {
      const isInfinite = entry.total === Infinity;
      const pct = !isInfinite && entry.total > 0 ? Math.round((entry.current / entry.total) * 100) : 0;
      const vars = this._executor?.context?.variables || {};
      let rightText, barContent;
      if (entry.isWhile) {
        // Resolve condition vars for display
        let condDisplay = entry.condition || '';
        for (const [k, v] of Object.entries(vars))
          if (typeof v !== 'object') condDisplay = condDisplay.replace(new RegExp('\\' + k, 'g'), v);
        rightText = `<span style="color:#94a3b8;">${condDisplay}</span> <span style="color:${barColor};">${entry.current}</span>`;
        // Animated indeterminate bar
        barContent = `<div style="height:100%; width:40%; background:${barColor}; border-radius:3px; opacity:0.5; animation:${paused ? 'none' : 'sbSlide 1.2s linear infinite'};"></div>`;
      } else {
        rightText = `<span style="color:${barColor};">${isInfinite ? '∞' : `${entry.current}/${entry.total}`}</span>`;
        barContent = !isInfinite ? `<div style="height:100%; width:${pct}%; background:${barColor}; border-radius:3px; transition:width 0.2s;"></div>` : '';
      }
      return `<div style="padding-left:${depth * 8}px; display:flex; align-items:center; gap:6px;">
        <span style="font-size:10px; color:#94a3b8; flex-shrink:0; min-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${entry.label}</span>
        <div style="flex:1; height:5px; background:var(--app-bg); border-radius:3px; overflow:hidden;">${barContent}</div>
        <span style="font-size:10px; font-family:monospace; flex-shrink:0; text-align:right;">${rightText}</span>
      </div>`;
    }).join('');
  }

  _showWaitTimer(durationS) {
    const el = document.getElementById('sbWaitTimer');
    if (!el) return;
    el.style.visibility = 'visible';
    let remaining = durationS;
    let lastTick = Date.now();
    const tick = () => {
      if (!document.getElementById('sbWaitTimer')) return;
      const now = Date.now();
      if (!this._executor?.isPaused) remaining -= (now - lastTick) / 1000;
      lastTick = now;
      remaining = Math.max(0, remaining);
      const paused = this._executor?.isPaused;
      el.textContent = `\u23f1 Wait ${remaining.toFixed(1)}s / ${durationS}s${paused ? ' \u23f8' : ''}`;
      if (remaining > 0 && this.isExecuting) requestAnimationFrame(tick);
      else { el.style.visibility = 'hidden'; el.textContent = '\u200b'; }
    };
    requestAnimationFrame(tick);
  }

  _hideRunUI() {
    const el = document.getElementById('scenarioRunPanel');
    if (el) el.style.display = 'none';
  }

  addLog(message, type = 'info') {
    const colors = { info: 'var(--text-general)', warning: '#f59e0b', error: '#ef4444' };
    const el = document.getElementById('sbRunLog') || document.getElementById('scenarioRightLog');
    if (el) {
      const ts = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      el.innerHTML += `<div style="color:${colors[type] || colors.info}; padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; gap:6px;"><span style="opacity:0.35; flex-shrink:0;">${ts}</span><span>${message}</span></div>`;
      el.scrollTop = el.scrollHeight;
      el.scrollTop = el.scrollHeight;
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Scenario = new ScenarioModule();
// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = '@keyframes sbSlide { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }';
    document.head.appendChild(s);
    EnderTrack.Scenario.init();
  });
} else {
  setTimeout(() => EnderTrack.Scenario.init(), 0);
}
