// scenario-builder.js — Minimal scenario builder UI

class ScenarioBuilder {
  constructor() {
    this._pluginTabs = []; // { id, label, render: fn(scenario) → html, onAction: fn(action, data) }
  }

  // Plugins register extra tabs here
  registerTab(tab) {
    if (!this._pluginTabs.find(t => t.id === tab.id))
      this._pluginTabs.push(tab);
  }

  open() {
    const mgr = window.EnderTrack.ScenarioManager;
    const scenario = mgr.getCurrent();
    document.getElementById('sbModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'sbModal';
    modal.innerHTML = `
      <div class="sb-modal">
        <div class="sb-header">
          <div class="sb-tabs">
            <button class="sb-tab active" data-tab="sequence">Séquence</button>
            <button class="sb-tab" data-tab="scenarios">Scénarios</button>
            ${this._pluginTabs.map(t => `<button class="sb-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
          </div>
          <button class="sb-close" onclick="EnderTrack.ScenarioBuilder.close()">✕</button>
        </div>
        <div class="sb-body">
          <div id="sb-tab-sequence" class="sb-tab-content"></div>
          <div id="sb-tab-scenarios" class="sb-tab-content" style="display:none"></div>
          ${this._pluginTabs.map(t => `<div id="sb-tab-${t.id}" class="sb-tab-content" style="display:none"></div>`).join('')}
        </div>
        <div class="sb-footer">
          <div id="sb-log" class="sb-log"></div>
          <div class="sb-run-btns">
            <button onclick="EnderTrack.ScenarioBuilder._run()" class="sb-btn-run">▶ Lancer</button>
            <button onclick="EnderTrack.ScenarioBuilder._pause()" class="sb-btn-pause">⏸</button>
            <button onclick="EnderTrack.ScenarioBuilder._stop()" class="sb-btn-stop">⏹</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    // Tab switching
    modal.querySelectorAll('.sb-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.sb-tab').forEach(b => b.classList.remove('active'));
        modal.querySelectorAll('.sb-tab-content').forEach(c => c.style.display = 'none');
        btn.classList.add('active');
        document.getElementById('sb-tab-' + btn.dataset.tab).style.display = '';
        this._renderTab(btn.dataset.tab, scenario);
      });
    });

    // Setup executor callbacks
    const exec = window.EnderTrack.ScenarioExecutor;
    exec._onLog = (msg, level) => this._appendLog(msg, level);
    exec._onStep = (idx) => this._highlightStep(idx);
    exec._onDone = () => this._renderTab('sequence', mgr.getCurrent());

    this._renderTab('sequence', scenario);

    // Close on backdrop
    modal.addEventListener('click', e => { if (e.target === modal) this.close(); });
  }

  close() {
    document.getElementById('sbModal')?.remove();
    window.EnderTrack.ScenarioExecutor._onLog = null;
    window.EnderTrack.ScenarioExecutor._onStep = null;
    window.EnderTrack.ScenarioExecutor._onDone = null;
  }

  _renderTab(tabId, scenario) {
    const el = document.getElementById('sb-tab-' + tabId);
    if (!el) return;
    if (tabId === 'sequence') { el.innerHTML = this._renderSequence(scenario); return; }
    if (tabId === 'scenarios') { el.innerHTML = this._renderScenarios(); return; }
    const plugin = this._pluginTabs.find(t => t.id === tabId);
    if (plugin) el.innerHTML = plugin.render(scenario);
  }

  // === SEQUENCE TAB ===

  _renderSequence(scenario) {
    const steps = scenario.steps || [];
    const stepsHtml = steps.length
      ? steps.map((s, i) => `
          <div class="sb-step" id="sb-step-${i}" data-idx="${i}">
            <span class="sb-step-icon">${this._stepIcon(s.type)}</span>
            <span class="sb-step-label">${this._stepLabel(s)}</span>
            <div class="sb-step-actions">
              <button onclick="EnderTrack.ScenarioBuilder._editStep(${i})" title="Éditer">✏️</button>
              <button onclick="EnderTrack.ScenarioBuilder._moveStep(${i},-1)" title="Monter">▲</button>
              <button onclick="EnderTrack.ScenarioBuilder._moveStep(${i},1)" title="Descendre">▼</button>
              <button onclick="EnderTrack.ScenarioBuilder._deleteStep(${i})" title="Supprimer">✕</button>
            </div>
          </div>`).join('')
      : '<div class="sb-empty">Séquence vide — ajoutez des étapes ci-dessous</div>';

    const builtinBtns = [
      { type: 'move',    icon: '📍', label: 'Déplacer' },
      { type: 'capture', icon: '📷', label: 'Capturer' },
      { type: 'wait',    icon: '⏱',  label: 'Attendre' },
      { type: 'log',     icon: '📝', label: 'Log' },
    ].map(b => `<button class="sb-add-btn" onclick="EnderTrack.ScenarioBuilder._addStep('${b.type}')">${b.icon} ${b.label}</button>`).join('');

    // Plugin-contributed step buttons
    const pluginBtns = (window.EnderTrack?.ScenarioStepDefs || [])
      .map(d => `<button class="sb-add-btn" onclick="EnderTrack.ScenarioBuilder._addStep('${d.type}')">${d.icon || '🔌'} ${d.label}</button>`)
      .join('');

    return `
      <div class="sb-sequence">
        <div class="sb-steps">${stepsHtml}</div>
        <div class="sb-add-bar">${builtinBtns}${pluginBtns}</div>
      </div>`;
  }

  _stepIcon(type) {
    const icons = { move: '📍', capture: '📷', wait: '⏱', log: '📝' };
    const def = window.EnderTrack?.ScenarioStepDefs?.find(d => d.type === type);
    return icons[type] || def?.icon || '🔌';
  }

  _stepLabel(step) {
    if (step.type === 'move') return `Move → (${step.x ?? 0}, ${step.y ?? 0}, ${step.z ?? 0})${step.relative ? ' rel' : ''}`;
    if (step.type === 'capture') return 'Capture';
    if (step.type === 'wait') return `Attendre ${step.duration ?? 1}s`;
    if (step.type === 'log') return `Log: "${step.message || ''}"`;
    const def = window.EnderTrack?.ScenarioStepDefs?.find(d => d.type === step.type);
    return def?.summary?.(step) || step.type;
  }

  // === STEP EDIT ===

  _addStep(type) {
    const mgr = window.EnderTrack.ScenarioManager;
    const scenario = mgr.getCurrent();
    const defaults = { move: { type:'move', x:0, y:0, z:0, relative:false },
                       capture: { type:'capture' }, wait: { type:'wait', duration:1 },
                       log: { type:'log', message:'' } };
    const def = window.EnderTrack?.ScenarioStepDefs?.find(d => d.type === type);
    const step = defaults[type] || def?.defaults?.() || { type };
    scenario.steps.push(step);
    mgr.save();
    this._refreshSequence(scenario);
    this._editStep(scenario.steps.length - 1);
  }

  _deleteStep(idx) {
    const mgr = window.EnderTrack.ScenarioManager;
    const scenario = mgr.getCurrent();
    scenario.steps.splice(idx, 1);
    mgr.save();
    this._refreshSequence(scenario);
  }

  _moveStep(idx, dir) {
    const mgr = window.EnderTrack.ScenarioManager;
    const scenario = mgr.getCurrent();
    const steps = scenario.steps;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
    mgr.save();
    this._refreshSequence(scenario);
  }

  _editStep(idx) {
    document.getElementById('sb-step-editor')?.remove();
    const mgr = window.EnderTrack.ScenarioManager;
    const scenario = mgr.getCurrent();
    const step = scenario.steps[idx];
    if (!step) return;

    const fields = this._stepFields(step);
    const editor = document.createElement('div');
    editor.id = 'sb-step-editor';
    editor.className = 'sb-step-editor';
    editor.innerHTML = `
      <div class="sb-editor-title">${this._stepIcon(step.type)} Étape ${idx + 1}</div>
      ${fields}
      <div class="sb-editor-btns">
        <button onclick="EnderTrack.ScenarioBuilder._saveStep(${idx})" class="sb-btn-primary">OK</button>
        <button onclick="document.getElementById('sb-step-editor')?.remove()" class="sb-btn-secondary">Annuler</button>
      </div>`;

    const stepEl = document.getElementById('sb-step-' + idx);
    stepEl?.after(editor);
  }

  _stepFields(step) {
    if (step.type === 'move') return `
      <label>X (mm) <input type="number" step="0.1" name="x" value="${step.x ?? 0}"></label>
      <label>Y (mm) <input type="number" step="0.1" name="y" value="${step.y ?? 0}"></label>
      <label>Z (mm) <input type="number" step="0.1" name="z" value="${step.z ?? 0}"></label>
      <label><input type="checkbox" name="relative" ${step.relative ? 'checked' : ''}> Relatif</label>`;
    if (step.type === 'wait') return `
      <label>Durée (s) <input type="number" step="0.5" min="0" name="duration" value="${step.duration ?? 1}"></label>`;
    if (step.type === 'log') return `
      <label>Message <input type="text" name="message" value="${step.message || ''}"></label>`;
    if (step.type === 'capture') return '<p style="color:#888;font-size:11px;">Aucun paramètre</p>';
    // Plugin-defined fields
    const def = window.EnderTrack?.ScenarioStepDefs?.find(d => d.type === step.type);
    return def?.fields?.(step) || '';
  }

  _saveStep(idx) {
    const editor = document.getElementById('sb-step-editor');
    if (!editor) return;
    const mgr = window.EnderTrack.ScenarioManager;
    const scenario = mgr.getCurrent();
    const step = scenario.steps[idx];
    editor.querySelectorAll('input').forEach(input => {
      const name = input.name;
      if (!name) return;
      if (input.type === 'checkbox') step[name] = input.checked;
      else if (input.type === 'number') step[name] = parseFloat(input.value) || 0;
      else step[name] = input.value;
    });
    // Let plugin handle custom save
    const def = window.EnderTrack?.ScenarioStepDefs?.find(d => d.type === step.type);
    def?.onSave?.(step, editor);
    mgr.save();
    editor.remove();
    this._refreshSequence(scenario);
  }

  _refreshSequence(scenario) {
    const el = document.getElementById('sb-tab-sequence');
    if (el) el.innerHTML = this._renderSequence(scenario);
  }

  // === SCENARIOS TAB ===

  _renderScenarios() {
    const mgr = window.EnderTrack.ScenarioManager;
    const all = mgr.getAll();
    const cur = mgr.getCurrent();
    return `
      <div class="sb-scenarios">
        <div class="sb-scenarios-list">
          ${all.map(s => `
            <div class="sb-scenario-row ${s.id === cur.id ? 'active' : ''}" onclick="EnderTrack.ScenarioBuilder._switchScenario('${s.id}')">
              <span>${s.name}</span>
              <div>
                <button onclick="event.stopPropagation(); EnderTrack.ScenarioBuilder._renameScenario('${s.id}')" title="Renommer">✏️</button>
                <button onclick="event.stopPropagation(); EnderTrack.ScenarioBuilder._duplicateScenario('${s.id}')" title="Dupliquer">📋</button>
                <button onclick="event.stopPropagation(); EnderTrack.ScenarioBuilder._deleteScenario('${s.id}')" title="Supprimer" style="color:#ef4444;">✕</button>
              </div>
            </div>`).join('')}
        </div>
        <button onclick="EnderTrack.ScenarioBuilder._newScenario()" class="sb-btn-primary" style="margin-top:8px;">+ Nouveau scénario</button>
      </div>`;
  }

  _switchScenario(id) {
    window.EnderTrack.ScenarioManager.setCurrent(id);
    const scenario = window.EnderTrack.ScenarioManager.getCurrent();
    this._renderTab('scenarios', scenario);
    this._renderTab('sequence', scenario);
    document.querySelector('.sb-tab[data-tab="sequence"]')?.click();
  }

  _newScenario() {
    const name = prompt('Nom du scénario :');
    if (!name) return;
    window.EnderTrack.ScenarioManager.create(name);
    this._renderTab('scenarios', window.EnderTrack.ScenarioManager.getCurrent());
  }

  _renameScenario(id) {
    const mgr = window.EnderTrack.ScenarioManager;
    const s = mgr.getAll().find(s => s.id === id);
    const name = prompt('Nouveau nom :', s?.name);
    if (!name) return;
    s.name = name;
    mgr.save();
    this._renderTab('scenarios', mgr.getCurrent());
  }

  _duplicateScenario(id) {
    window.EnderTrack.ScenarioManager.duplicate(id);
    this._renderTab('scenarios', window.EnderTrack.ScenarioManager.getCurrent());
  }

  _deleteScenario(id) {
    if (!confirm('Supprimer ce scénario ?')) return;
    window.EnderTrack.ScenarioManager.delete(id);
    this._renderTab('scenarios', window.EnderTrack.ScenarioManager.getCurrent());
  }

  // === RUN CONTROLS ===

  _run() {
    const scenario = window.EnderTrack.ScenarioManager.getCurrent();
    document.getElementById('sb-log').innerHTML = '';
    window.EnderTrack.ScenarioExecutor.run(scenario);
  }

  _pause() {
    const exec = window.EnderTrack.ScenarioExecutor;
    exec.paused ? exec.resume() : exec.pause();
  }

  _stop() { window.EnderTrack.ScenarioExecutor.abort(); }

  _appendLog(msg, level) {
    const el = document.getElementById('sb-log');
    if (!el) return;
    const colors = { info: '#aaa', error: '#ef4444', warn: '#f59e0b' };
    el.innerHTML += `<div style="color:${colors[level] || '#aaa'};font-size:10px;">${msg}</div>`;
    el.scrollTop = el.scrollHeight;
  }

  _highlightStep(idx) {
    document.querySelectorAll('.sb-step').forEach(el => el.classList.remove('running'));
    if (idx >= 0) document.getElementById('sb-step-' + idx)?.classList.add('running');
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ScenarioBuilder = new ScenarioBuilder();
