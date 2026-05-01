// plugins/scenario-builder/src/builder/scenario-builder.js — Split-screen Builder (v3)

class ScenarioBuilder {
  constructor() {
    this.scenario = null;
    this.selectedPath = null;
    this._undoStack = [];
    this._redoStack = [];
    this._viewMode = 'build'; // 'build' | 'vars' | 'code'
    this._mode = 'build'; // 'build' | 'helper'
    this._buildSubView = 'tree'; // 'tree' | 'watchers'
    this._selectedWatcherIdx = null;
    this._openAccordions = { flow: true, actions: true, plugins: false, custom: false, python: false, macros: false };
  }

  // === OPEN / CLOSE ===

  open(scenario) {
    this.scenario = scenario;
    this._snapshot = JSON.stringify(scenario);
    this.selectedPath = null;
    this._undoStack = [];
    this._redoStack = [];
    this._renderModal();
  }

  save() {
    // If editing a macro, save back to registry and restore scenario
    if (this._macroEditMode) {
      const me = this._macroEditMode;
      const m = EnderTrack.MacroRegistry?.get(me.macroId);
      if (m) {
        m.children = JSON.parse(JSON.stringify(this.scenario.tree.children || []));
        m.inputs = EnderTrack.TreeUtils.extractMacroInputs(m.children);
        EnderTrack.MacroRegistry.persist();
      }
      // Restore original scenario
      this.scenario = me.originalScenario;
      this._snapshot = me.originalSnapshot;
      this._macroEditMode = null;
      this._editingMacroId = me.macroId;
      // Go back to Fonctionothèque
      const nameEl = document.querySelector('.sb-header-name');
      if (nameEl) nameEl.textContent = this.scenario.name;
      this._setMode('helper');
      this._setHelperTab('fonctions');
      this._refreshPalette();
      return;
    }
    this._unbindKeyboard();
    document.getElementById('sbModal')?.remove();
    EnderTrack.Scenario?.manager?.save?.();
    EnderTrack.Scenario?.updateCanvasOverlay?.();
    EnderTrack.Scenario?.createUI?.();
  }

  close() {
    // If editing a macro, just go back without saving
    if (this._macroEditMode) {
      const me = this._macroEditMode;
      this.scenario = me.originalScenario;
      this._snapshot = me.originalSnapshot;
      this._macroEditMode = null;
      this._editingMacroId = me.macroId;
      const nameEl = document.querySelector('.sb-header-name');
      if (nameEl) nameEl.textContent = this.scenario.name;
      this._setMode('helper');
      this._setHelperTab('fonctions');
      this._refreshPalette();
      return;
    }
    // Revert to snapshot
    if (this._snapshot && this.scenario) {
      const reverted = JSON.parse(this._snapshot);
      Object.assign(this.scenario, reverted);
    }
    this._unbindKeyboard();
    document.getElementById('sbModal')?.remove();
    this.scenario = null;
    EnderTrack.Scenario?.manager?.save?.();
    EnderTrack.Scenario?.updateCanvasOverlay?.();
    EnderTrack.Scenario?.createUI?.();
  }

  // Inline entry point (called by ScenarioModule)
  renderInline(scenario) {
    this.scenario = scenario;
    // Don't auto-open modal — just store scenario reference
    // The module UI has the "Ouvrir Builder" button
  }

  // === UNDO/REDO ===

  _saveUndo() {
    this._undoStack.push(JSON.stringify(this.scenario.tree));
    if (this._undoStack.length > 50) this._undoStack.shift();
    this._redoStack = [];
  }

  undo() {
    if (!this._undoStack.length) return;
    this._redoStack.push(JSON.stringify(this.scenario.tree));
    this.scenario.tree = JSON.parse(this._undoStack.pop());
    this._refresh();
  }

  redo() {
    if (!this._redoStack.length) return;
    this._undoStack.push(JSON.stringify(this.scenario.tree));
    this.scenario.tree = JSON.parse(this._redoStack.pop());
    this._refresh();
  }

  // === NODE OPERATIONS ===

  addLoop(loopId) {
    this._saveUndo();
    const loopDef = EnderTrack.LoopTypesRegistry?.get(loopId);
    if (!loopDef) return;
    const node = { type: 'loop', loopId, params: {}, children: [] };
    loopDef.params.forEach(p => { node.params[p.name] = p.default; });
    const existing = this._countLoops(this.scenario.tree);
    node.params.loopVar = existing === 0 ? '$i' : `$${String.fromCharCode(105 + existing)}`;
    if (loopDef.onAdd) loopDef.onAdd(node);
    EnderTrack.TreeUtils.insertNode(this.scenario.tree, node, this.selectedPath);
    this._refresh();
  }

  addAction(actionId) {
    this._saveUndo();
    const actionDef = EnderTrack.ActionRegistry?.get(actionId);
    if (!actionDef) return;
    const node = { type: 'action', actionId, params: {} };
    if (actionDef.params) actionDef.params.forEach(p => { node.params[p.id || p.name] = p.default; });
    // Auto-set listIndex and listId from closest loop
    if (actionId === 'move') {
      node.params.listIndex = this._getClosestLoopVar(this.selectedPath);
      const loopListId = this._getClosestLoopListId(this.selectedPath);
      if (loopListId) node.params.listId = loopListId;
    }
    // Auto-register output variables for python scripts
    if (actionId.startsWith('pyscript_')) {
      const scriptId = actionId.replace('pyscript_', '');
      const script = EnderTrack.ScriptRegistry?.get(scriptId);
      if (script?.outputs?.length) {
        if (!this.scenario.customVariables) this.scenario.customVariables = [];
        for (const out of script.outputs) {
          const varId = '$' + out.name;
          if (!this.scenario.customVariables.find(v => v.id === varId)) {
            this.scenario.customVariables.push({ id: varId, name: varId, formula: '', type: out.type || 'number', readonly: true });
          }
        }
        EnderTrack.VariableManager?.init?.(this.scenario);
      }
    }
    EnderTrack.TreeUtils.insertNode(this.scenario.tree, node, this.selectedPath);
    this._refresh();
  }

  addPluginAction(actionId) {
    this.addAction(actionId);
  }

  addCondition() {
    this._saveUndo();
    const condDef = EnderTrack.ConditionTypesRegistry?.get('default');
    const node = condDef ? condDef.create() : {
      type: 'condition', params: { label: 'Condition' },
      branches: [{ condition: '$x > 0', actions: [] }]
    };
    EnderTrack.TreeUtils.insertNode(this.scenario.tree, node, this.selectedPath);
    this._refresh();
  }

  addMacroFromLibrary(macroId) {
    this._saveUndo();
    const node = EnderTrack.MacroRegistry?.instantiate(macroId);
    if (!node) return;
    EnderTrack.TreeUtils.insertNode(this.scenario.tree, node, this.selectedPath);
    this._refresh();
  }

  deleteSelected() {
    if (!this.selectedPath) return;
    this._saveUndo();
    EnderTrack.TreeUtils.deleteNode(this.scenario.tree, this.selectedPath);
    this.selectedPath = null;
    this._cleanOrphanScriptVars();
    this._refresh();
  }

  _cleanOrphanScriptVars() {
    if (!this.scenario?.customVariables?.length) return;
    // Collect all output var ids from pyscript actions still in tree
    const usedVars = new Set();
    const walk = (node) => {
      if (node.type === 'action' && node.actionId?.startsWith('pyscript_')) {
        const scriptId = node.actionId.replace('pyscript_', '');
        const script = EnderTrack.ScriptRegistry?.get(scriptId);
        script?.outputs?.forEach(o => usedVars.add('$' + o.name));
      }
      if (node.children) node.children.forEach(walk);
      if (node.branches) node.branches.forEach(b => { if (b.actions) b.actions.forEach(walk); });
    };
    walk(this.scenario.tree);
    this.scenario.customVariables = this.scenario.customVariables.filter(v => !v.readonly || usedVars.has(v.id));
    EnderTrack.VariableManager?.init?.(this.scenario);
  }

  moveSelected(direction) {
    if (!this.selectedPath) return;
    this._saveUndo();
    EnderTrack.TreeUtils.moveNode(this.scenario.tree, this.selectedPath, direction);
    const parts = this.selectedPath.split('.');
    const idx = parseInt(parts[parts.length - 1]);
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    parts[parts.length - 1] = String(newIdx);
    this.selectedPath = parts.join('.');
    this._refresh();
  }

  collapseSelected() {
    if (!this.selectedPath) return;
    const name = prompt('Nom de la fonction :', 'Ma Fonction');
    if (!name) return;
    this._saveUndo();
    const macro = EnderTrack.TreeUtils.collapseToMacro(this.scenario.tree, this.selectedPath, name);
    if (macro) {
      EnderTrack.MacroRegistry?.save(macro);
      this._editingMacroId = macro.macroId;
      this._refresh();
      this._setMode("helper"); this._setHelperTab("fonctions");
    } else {
      this._refresh();
    }
  }

  expandSelected() {
    if (!this.selectedPath) return;
    this._saveUndo();
    EnderTrack.TreeUtils.expandMacro(this.scenario.tree, this.selectedPath);
    this._refresh();
  }

  updateParam(pathStr, paramName, value) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (node?.params) {
      node.params[paramName] = value;
      // When switching to relative, reset absolute sub-params
      if (paramName === 'moveType' && value === 'relative') {
        node.params.absSource = 'manual';
      }
      // When switching absSource to list, auto-set listIndex
      if (paramName === 'absSource' && value === 'list') {
        node.params.listIndex = this._getClosestLoopVar(pathStr);
      }
      this._refresh();
    }
  }

  selectNode(pathStr) {
    this.selectedPath = pathStr;
    this._selectedWatcherIdx = null;
    this._refreshTree();
    this._refreshProperties();
  }

  _deselectNode(event) {
    // Only deselect if click was directly on the tree zone, not on a node
    if (event.target.id === 'sbTree' || event.target.classList.contains('sb-tree-empty')) {
      this.selectedPath = null;
      this._refreshTree();
      this._refreshProperties();
    }
  }

  // === MODAL RENDERING ===

  _renderModal() {
    document.getElementById('sbModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'sbModal';
    modal.innerHTML = `
      <div class="sb-split-modal">
        <div class="sb-header">
          <div class="sb-mode-toggle">
            <button onclick="EnderTrack.ScenarioBuilder._setMode('build')" class="sb-mode-btn ${this._mode !== 'helper' ? 'active' : ''}">🎬 Scénario</button>
            <button onclick="EnderTrack.ScenarioBuilder._setMode('helper')" class="sb-mode-btn ${this._mode === 'helper' ? 'active' : ''}">🎩 Accessoires</button>
          </div>
          <span style="flex:1"></span>
          <button onclick="EnderTrack.ScenarioBuilder.close()" class="sb-header-close" title="Fermer">✕</button>
        </div>
        <div id="sbScenarioBar" class="sb-scenario-bar" style="display:${this._mode !== 'helper' ? 'flex' : 'none'};">
          <span class="sb-header-name">${this._escapeHtml(this.scenario.name)}</span>
          <button onclick="EnderTrack.ScenarioBuilder._showScenarioDropdown(event)" class="sb-mini-btn" title="Changer de scénario">▼</button>
          <span style="flex:1"></span>
          <button onclick="EnderTrack.ScenarioBuilder._showFileMenu(event)" class="sb-mini-btn" title="Menu">☰</button>
        </div>
        <div class="sb-body">
          <!-- === BUILD SECTION === -->
          <div id="sbBuildSection" style="display:${this._mode !== 'helper' ? 'flex' : 'none'}; flex-direction:column; flex:1; overflow:hidden;">
          <div class="sb-tabs">
            <button onclick="EnderTrack.ScenarioBuilder._setView('props')" class="sb-tab-btn ${this._viewMode === 'props' ? 'active' : ''}">📋 Propriétés</button>
            <button onclick="EnderTrack.ScenarioBuilder._setView('build')" class="sb-tab-btn ${this._viewMode === 'build' ? 'active' : ''}">🌳 Constructeur</button>
            <button onclick="EnderTrack.ScenarioBuilder._setView('vars')" class="sb-tab-btn ${this._viewMode === 'vars' ? 'active' : ''}">📊 Variables</button>
            <button onclick="EnderTrack.ScenarioBuilder._setView('code')" class="sb-tab-btn ${this._viewMode === 'code' ? 'active' : ''}">📝 Code</button>
          </div>
          <!-- Build view: 3 columns -->
          <div id="sbBuildView" class="sb-build-view" style="display:${this._viewMode === 'build' ? 'grid' : 'none'};">
            <div id="sbPalette" class="sb-palette"></div>
            <div class="sb-center">
              <div class="sb-sub-toggle">
                <button onclick="EnderTrack.ScenarioBuilder._setBuildSub('tree')" class="sb-toggle-btn ${this._buildSubView === 'tree' ? 'active' : ''}">🌳 Séquence</button>
                <button onclick="EnderTrack.ScenarioBuilder._setBuildSub('watchers')" class="sb-toggle-btn ${this._buildSubView === 'watchers' ? 'active' : ''}">👁️ Watchers</button>
              </div>
              <div id="sbTree" class="sb-tree-zone" onclick="EnderTrack.ScenarioBuilder._deselectNode(event)"></div>
            </div>
            <div id="sbProps" class="sb-props"></div>
          </div>
          <!-- Vars view: full width -->
          <div id="sbVarsView" class="sb-full-view" style="display:${this._viewMode === 'vars' ? 'block' : 'none'};"></div>
          <!-- Code view: full width -->
          <div id="sbCodeView" class="sb-full-view" style="display:${this._viewMode === 'code' ? 'block' : 'none'};"></div>
          <!-- Props view: full width -->
          <div id="sbPropsView" class="sb-full-view" style="display:${this._viewMode === 'props' ? 'block' : 'none'};"></div>
          </div>
          <!-- === HELPER SECTION === -->
          <div id="sbHelperSection" style="display:${this._mode === 'helper' ? 'flex' : 'none'}; flex-direction:column; flex:1; overflow:hidden;">
            <div class="sb-tabs">
              <button onclick="EnderTrack.ScenarioBuilder._setHelperTab('globals')" class="sb-tab-btn ${this._helperTab === 'globals' ? 'active' : ''}">🌐 Variables globales</button>
              <button onclick="EnderTrack.ScenarioBuilder._setHelperTab('scripts')" class="sb-tab-btn ${this._helperTab === 'scripts' ? 'active' : ''}">🐍 Scripts Python</button>
              <button onclick="EnderTrack.ScenarioBuilder._setHelperTab('fonctions')" class="sb-tab-btn ${this._helperTab === 'fonctions' ? 'active' : ''}">📦 Fonctionothèque</button>
            </div>
            <div id="sbHelperContent" style="flex:1; overflow-y:auto; padding:12px;"></div>
          </div>
        <div class="sb-footer">
          <button onclick="EnderTrack.ScenarioBuilder.close()" class="sb-footer-btn sb-footer-cancel">Annuler</button>
          <button onclick="EnderTrack.ScenarioBuilder.save()" class="sb-footer-btn sb-footer-save">✔ Enregistrer</button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    this._refreshPalette();
    this._refreshTree();
    this._refreshProperties();
    if (this._mode === 'helper') {
      this._renderHelperView();
    } else {
      if (this._viewMode === 'vars') this._renderVarsView();
      if (this._viewMode === 'code') this._renderCodeView();
      if (this._viewMode === 'props') this._renderPropsView();
    }
    this._bindKeyboard();
  }

  _bindKeyboard() {
    this._unbindKeyboard();
    this._keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Delete' && this.selectedPath) { e.preventDefault(); this.deleteSelected(); }
      else if (e.key === 'ArrowUp' && e.altKey && this.selectedPath) { e.preventDefault(); this.moveSelected('up'); }
      else if (e.key === 'ArrowDown' && e.altKey && this.selectedPath) { e.preventDefault(); this.moveSelected('down'); }
      else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); this.undo(); }
      else if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) { e.preventDefault(); this.redo(); }
      else if (e.key === 'Enter') { e.preventDefault(); this.save(); }
      else if (e.key === 'Escape') {
        if (document.getElementById('sbAutocomplete')) { this._closeAutocomplete(); }
        else { e.preventDefault(); this.close(); }
      }
    };
    this._inputHandler = (e) => {
      const el = e.target;
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
      if (!el.closest('#sbModal')) return;
      const val = el.value;
      const cursor = el.selectionStart;
      // Find $ token at cursor
      const before = val.substring(0, cursor);
      const match = before.match(/\$(\w*)$/);
      if (match) {
        this._showAutocomplete(el, match[1]);
      } else {
        this._closeAutocomplete();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
    document.addEventListener('input', this._inputHandler);
  }

  _unbindKeyboard() {
    if (this._keyHandler) { document.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
    if (this._inputHandler) { document.removeEventListener('input', this._inputHandler); this._inputHandler = null; }
    this._closeAutocomplete();
  }

  _getAllVariableIds() {
    const vars = [];
    // System + loop
    const vm = EnderTrack.VariableManager;
    if (vm?.systemVariables) vm.systemVariables.forEach(v => vars.push(v.id));
    // Global custom
    if (vm?.globalVariables) vm.globalVariables.forEach(v => vars.push(v.id));
    // Scenario custom
    if (this.scenario?.customVariables) this.scenario.customVariables.forEach(v => vars.push(v.id));
    return [...new Set(vars)];
  }

  _showAutocomplete(inputEl, filter) {
    this._closeAutocomplete();
    const all = this._getAllVariableIds();
    const filtered = all.filter(v => v.toLowerCase().includes('$' + filter.toLowerCase()));
    if (!filtered.length) return;

    this._acFiltered = filtered;
    this._acIndex = -1;
    this._acFilter = filter;

    const rect = inputEl.getBoundingClientRect();
    const div = document.createElement('div');
    div.id = 'sbAutocomplete';
    div.className = 'sb-autocomplete';
    div.style.top = (rect.bottom + 2) + 'px';
    div.style.left = rect.left + 'px';
    div.style.minWidth = rect.width + 'px';
    filtered.forEach((v, i) => {
      const item = document.createElement('div');
      item.className = 'sb-autocomplete-item';
      item.textContent = v;
      item.onmousedown = (e) => {
        e.preventDefault();
        this._applyAutocomplete(inputEl, v, filter);
      };
      div.appendChild(item);
    });
    document.body.appendChild(div);
    this._acInput = inputEl;
    this._acBlur = () => setTimeout(() => this._closeAutocomplete(), 150);
    inputEl.addEventListener('blur', this._acBlur);
    this._acKeyNav = (e) => {
      const popup = document.getElementById('sbAutocomplete');
      if (!popup) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._acIndex = Math.min(this._acIndex + 1, this._acFiltered.length - 1);
        this._highlightAcItem();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._acIndex = Math.max(this._acIndex - 1, 0);
        this._highlightAcItem();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (this._acIndex >= 0) {
          e.preventDefault();
          this._applyAutocomplete(inputEl, this._acFiltered[this._acIndex], this._acFilter);
        }
      }
    };
    inputEl.addEventListener('keydown', this._acKeyNav);
  }

  _highlightAcItem() {
    const items = document.querySelectorAll('#sbAutocomplete .sb-autocomplete-item');
    items.forEach((el, i) => {
      el.classList.toggle('sb-autocomplete-active', i === this._acIndex);
    });
    items[this._acIndex]?.scrollIntoView({ block: 'nearest' });
  }

  _applyAutocomplete(inputEl, varId, filter) {
    const cursor = inputEl.selectionStart;
    const val = inputEl.value;
    const start = cursor - filter.length - 1;
    inputEl.value = val.substring(0, start) + varId + val.substring(cursor);
    inputEl.selectionStart = inputEl.selectionEnd = start + varId.length;
    inputEl.focus();
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    this._closeAutocomplete();
  }

  _closeAutocomplete() {
    document.getElementById('sbAutocomplete')?.remove();
    if (this._acInput) {
      if (this._acBlur) this._acInput.removeEventListener('blur', this._acBlur);
      if (this._acKeyNav) this._acInput.removeEventListener('keydown', this._acKeyNav);
    }
    this._acInput = null;
    this._acBlur = null;
    this._acKeyNav = null;
    this._acFiltered = null;
    this._acIndex = -1;
  }

  // === VIEW TOGGLE ===

  _setView(mode) {
    this._viewMode = mode;
    ['sbBuildView', 'sbVarsView', 'sbCodeView', 'sbPropsView'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const activeId = { build: 'sbBuildView', vars: 'sbVarsView', code: 'sbCodeView', props: 'sbPropsView' }[mode];
    const activeEl = document.getElementById(activeId);
    if (activeEl) activeEl.style.display = mode === 'build' ? 'grid' : 'block';
    document.querySelectorAll('#sbBuildSection > .sb-tabs .sb-tab-btn').forEach(b => b.classList.remove('active'));
    const idx = { props: 0, build: 1, vars: 2, code: 3 }[mode] || 0;
    document.querySelectorAll('#sbBuildSection > .sb-tabs .sb-tab-btn')[idx]?.classList.add('active');
    if (mode === 'vars') this._renderVarsView();
    else if (mode === 'code') this._renderCodeView();
    else if (mode === 'props') this._renderPropsView();
  }

  _setBuildSub(sub) {
    this._buildSubView = sub;
    document.querySelectorAll('.sb-sub-toggle .sb-toggle-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sb-sub-toggle .sb-toggle-btn')[sub === 'tree' ? 0 : 1]?.classList.add('active');
    this._refreshTree();
    this._refreshProperties();
  }

  _setMode(mode) {
    this._mode = mode;
    document.querySelectorAll('.sb-mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sb-mode-btn')[mode === 'build' ? 0 : 1]?.classList.add('active');
    const buildSection = document.getElementById('sbBuildSection');
    const helperSection = document.getElementById('sbHelperSection');
    if (buildSection) buildSection.style.display = mode === 'build' ? 'flex' : 'none';
    if (helperSection) helperSection.style.display = mode === 'helper' ? 'flex' : 'none';
    const scenarioBar = document.getElementById('sbScenarioBar');
    if (scenarioBar) scenarioBar.style.display = mode === 'build' ? 'flex' : 'none';
    if (mode === 'helper') this._renderHelperView();
  }

  _helperTab = 'globals';

  _setHelperTab(tab) {
    this._helperTab = tab;
    document.querySelectorAll('#sbHelperSection .sb-tab-btn').forEach(b => b.classList.remove('active'));
    const idx = { globals: 0, scripts: 1, fonctions: 2 }[tab] || 0;
    document.querySelectorAll('#sbHelperSection .sb-tab-btn')[idx]?.classList.add('active');
    this._renderHelperView();
  }

  _renderHelperView() {
    const el = document.getElementById('sbHelperContent');
    if (!el) return;
    el.style.padding = '12px';
    el.style.overflow = 'auto';
    if (this._helperTab === 'globals') {
      el.innerHTML = this._renderHelperGlobals();
    } else if (this._helperTab === 'scripts') {
      el.style.padding = '0';
      el.style.overflow = 'hidden';
      el.innerHTML = this._renderScriptsView();
    } else if (this._helperTab === 'fonctions') {
      this._renderMacrosContent();
      return;
    }
  }

  _renderHelperGlobals() {
    const vm = window.EnderTrack?.VariableManager;
    const values = vm?.getContext?.() || {};
    const cats = vm?.variableCategories || [];
    const sysVars = (vm?.systemVariables || []).filter(v => !v.isLoopVar);
    const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
    const state = window.EnderTrack?.State?.get?.() || {};
    const homeXY = state.homePositions?.xy || { x: 0, y: 0 };
    const homeXYZ = state.homePositions?.xyz || { x: 0, y: 0, z: 0 };

    let html = '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">';

    // Col 1: Variables système + personnalisées
    html += '<div>';
    html += '<div style="font-size:12px; color:var(--text-selected); font-weight:600; margin-bottom:8px;">Variables système</div>';
    cats.forEach(cat => {
      const vars = sysVars.filter(v => v.category === cat.id);
      if (!vars.length) return;
      html += `<div style="margin-bottom:10px;"><div style="font-size:10px; color:var(--text-general); font-weight:600; margin-bottom:3px;">${cat.label}</div>`;
      vars.forEach(v => {
        html += `<div style="display:flex; justify-content:space-between; padding:2px 4px;" title="${v.description || ''}">
          <span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">${v.id}</span>
          <span style="font-size:9px; color:var(--text-general);">${v.description || v.name}</span>
        </div>`;
      });
      html += '</div>';
    });
    // Loop vars
    const loopVars = sysVars.filter(v => v.category === 'loop');
    if (loopVars.length) {
      html += '<div style="margin-bottom:10px;"><div style="font-size:10px; color:var(--text-general); font-weight:600; margin-bottom:3px;">🔁 Flux</div>';
      loopVars.forEach(v => {
        html += `<div style="display:flex; justify-content:space-between; padding:2px 4px;"><span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">${v.id}</span><span style="font-size:9px; color:var(--text-general);">${v.name}</span></div>`;
      });
      html += '</div>';
    }
    // Global custom variables
    const globalVars = vm?.globalVariables || [];
    html += `<div style="margin-top:12px; border-top:1px solid #333; padding-top:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-size:10px; color:var(--text-general); font-weight:600;">✏️ Globales personnalisées</span>
        <button onclick="window.EnderTrack.VariableManager.addGlobalVariable({id:'$gvar'}); EnderTrack.ScenarioBuilder._renderHelperView();" class="sb-mini-btn" style="font-size:9px; padding:1px 6px;">+</button>
      </div>`;
    if (globalVars.length === 0) {
      html += '<div style="font-size:9px; color:var(--text-general); opacity:0.4;">Aucune</div>';
    } else {
      const allValues = vm?.getAllValues?.() || {};
      globalVars.forEach(v => {
        const val = vm?.formatValue?.(allValues[v.id]) ?? '-';
        html += `<div style="display:flex; align-items:center; gap:4px; padding:3px 0; border-bottom:1px solid var(--border);">
          <span style="color:var(--text-general); font-size:9px;">$</span>
          <input type="text" value="${v.id.replace('$', '')}" 
            onchange="window.EnderTrack.VariableManager.renameGlobalVariable('${v.id}', '$' + this.value); EnderTrack.ScenarioBuilder._renderHelperView();"
            style="width:50px; padding:2px 3px; background:var(--app-bg); border:1px solid var(--border); border-radius:3px; color:var(--coordinates-color); font-family:monospace; font-size:9px;">
          <span style="color:var(--text-general); font-size:9px;">=</span>
          <input type="text" value="${v.formula || ''}" placeholder="0"
            onchange="window.EnderTrack.VariableManager.updateGlobalVariable('${v.id}', {formula: this.value}); EnderTrack.ScenarioBuilder._renderHelperView();"
            style="flex:1; padding:2px 3px; background:var(--app-bg); border:1px solid var(--border); border-radius:3px; color:var(--coordinates-color); font-family:monospace; font-size:9px;">
          <span style="min-width:35px; text-align:right; font-size:9px; color:var(--text-general); font-family:monospace;">${val}</span>
          <button onclick="window.EnderTrack.VariableManager.removeGlobalVariable('${v.id}'); EnderTrack.ScenarioBuilder._renderHelperView();" style="padding:1px 3px; background:transparent; border:1px solid var(--border); border-radius:3px; color:var(--text-general); cursor:pointer; font-size:8px;">✕</button>
        </div>`;
      });
    }
    html += '</div></div>';

    // Col 2: Listes
    html += '<div>';
    html += '<div style="font-size:12px; color:var(--text-selected); font-weight:600; margin-bottom:8px;">📋 Listes</div>';
    if (lists.length === 0) {
      html += '<div style="font-size:10px; color:var(--text-general); opacity:0.4;">Aucune liste</div>';
    } else {
      lists.forEach(list => {
        const count = list.positions?.length || 0;
        html += `<div style="background:var(--app-bg); border-radius:4px; padding:6px; margin-bottom:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:10px; color:var(--text-selected);">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${list.color || '#4f9eff'}; margin-right:4px;"></span>
              ${list.name}</span>
            <span style="font-size:9px; color:var(--coordinates-color); font-family:monospace;">${count} pos</span>
          </div>
          <div style="font-size:9px; color:var(--coordinates-color); opacity:0.5; font-family:monospace;">${list.name}[$i]</div>
        </div>`;
      });
    }
    html += '</div>';

    // Col 3: Positions stratégiques
    html += '<div>';
    html += '<div style="font-size:12px; color:var(--text-selected); font-weight:600; margin-bottom:8px;">🚩 Positions stratégiques</div>';
    html += `<div style="display:flex; flex-direction:column; gap:4px;">
      <div style="display:flex; justify-content:space-between; padding:4px 6px; background:var(--app-bg); border-radius:4px;">
        <span style="font-size:10px; color:var(--text-general);">🏠 HOME XY</span>
        <span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">(${homeXY.x?.toFixed(1)}, ${homeXY.y?.toFixed(1)})</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 6px; background:var(--app-bg); border-radius:4px;">
        <span style="font-size:10px; color:var(--text-general);">🏠 HOME XYZ</span>
        <span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">(${homeXYZ.x?.toFixed(1)}, ${homeXYZ.y?.toFixed(1)}, ${homeXYZ.z?.toFixed(1)})</span>
      </div>
    </div>`;
    html += '</div></div>';
    return html;
  }

  _renderPropsView() {
    const el = document.getElementById('sbPropsView');
    if (!el || !this.scenario) return;
    const s = this.scenario;
    const customFields = s.customFields || [];

    let fieldsHtml = customFields.map((f, i) => `
      <div style="display:flex; gap:4px; align-items:center; margin-bottom:4px;">
        <input type="text" value="${this._escapeAttr(f.label)}" placeholder="Label"
          onchange="EnderTrack.ScenarioBuilder._updateCustomField(${i}, 'label', this.value)"
          style="width:100px; padding:3px 5px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;">
        <input type="text" value="${this._escapeAttr(f.value)}" placeholder="Valeur"
          onchange="EnderTrack.ScenarioBuilder._updateCustomField(${i}, 'value', this.value)"
          style="flex:1; padding:3px 5px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:10px;">
        <button onclick="EnderTrack.ScenarioBuilder._removeCustomField(${i})" class="sb-mini-btn sb-btn-danger" style="padding:2px 5px; font-size:9px;">✕</button>
      </div>`).join('');

    el.innerHTML = `
      <div style="max-width:480px; margin:0 auto;">
        <div style="font-size:13px; color:var(--text-selected); font-weight:600; margin-bottom:16px;">Propriétés du scénario</div>
        <div class="sb-param"><label class="sb-param-label">Nom</label>
          <input type="text" value="${this._escapeAttr(s.name)}" onchange="EnderTrack.ScenarioBuilder._updateScenarioProp('name', this.value)" class="sb-input"></div>
        <div class="sb-param"><label class="sb-param-label">Icône (emoji)</label>
          <input type="text" value="${this._escapeAttr(s.icon || '🎬')}" onchange="EnderTrack.ScenarioBuilder._updateScenarioProp('icon', this.value)" class="sb-input" style="width:60px;"></div>
        <div class="sb-param"><label class="sb-param-label">Description</label>
          <textarea onchange="EnderTrack.ScenarioBuilder._updateScenarioProp('description', this.value)" class="sb-input" rows="3" style="resize:vertical;">${this._escapeHtml(s.description || '')}</textarea></div>
        <div style="border-top:1px solid #333; margin-top:12px; padding-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:11px; color:var(--text-selected); font-weight:600;">Champs personnalisés</span>
            <button onclick="EnderTrack.ScenarioBuilder._addCustomField()" class="sb-mini-btn">+</button>
          </div>
          ${fieldsHtml || '<div style="font-size:10px; color:var(--text-general); opacity:0.4;">Aucun champ. Ces champs apparaissent sur le volet gauche.</div>'}
        </div>
      </div>`;
  }

  _updateScenarioProp(prop, value) {
    if (!this.scenario) return;
    this.scenario[prop] = value;
    if (prop === 'name') {
      const nameEl = document.querySelector('.sb-header-name');
      if (nameEl) nameEl.textContent = value;
    }
  }

  _addCustomField() {
    if (!this.scenario.customFields) this.scenario.customFields = [];
    this.scenario.customFields.push({ label: '', value: '' });
    this._renderPropsView();
  }

  _updateCustomField(idx, prop, value) {
    if (!this.scenario.customFields?.[idx]) return;
    this.scenario.customFields[idx][prop] = value;
  }

  _removeCustomField(idx) {
    if (!this.scenario.customFields) return;
    this.scenario.customFields.splice(idx, 1);
    this._renderPropsView();
  }

  _renderVarsView() {
    const el = document.getElementById('sbVarsView');
    if (!el) return;
    if (window.EnderTrack?.VariableManager) {
      try {
        EnderTrack.VariableManager.init(this.scenario);
        el.innerHTML = EnderTrack.VariableManager.getVariablesHTML();
      } catch { el.innerHTML = '<div class="sb-tree-empty">Erreur variables</div>'; }
    } else {
      el.innerHTML = '<div class="sb-tree-empty">Variable Manager non charg\u00e9</div>';
    }
  }

  _renderCodeView() {
    const el = document.getElementById('sbCodeView');
    if (!el) return;
    let js = '// Aucun sc\u00e9nario';
    let py = '# Aucun sc\u00e9nario';
    try { if (window.EnderTrack?.CodeGenerator) js = EnderTrack.CodeGenerator.generate(this.scenario); } catch {}
    try { if (window.EnderTrack?.PythonGenerator) py = EnderTrack.PythonGenerator.generate(this.scenario); } catch {}
    el.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; height:100%;">
        <div>
          <div style="font-size:10px; color:var(--text-general); margin-bottom:4px; font-weight:600;">JavaScript</div>
          <pre class="sb-code-view">${this._escapeHtml(js)}</pre>
        </div>
        <div>
          <div style="font-size:10px; color:var(--text-general); margin-bottom:4px; font-weight:600;">Python</div>
          <pre class="sb-code-view">${this._escapeHtml(py)}</pre>
        </div>
      </div>`;
  }

  // === SCRIPTS PYTHON ===

  _editingScriptId = null;

  _renderScriptsView() {
    const scripts = EnderTrack.ScriptRegistry?.getAll() || [];
    const s = this._editingScriptId ? EnderTrack.ScriptRegistry?.get(this._editingScriptId) : null;

    let html = `<div style="display:grid; grid-template-columns:220px 1fr; gap:0; height:100%; overflow:hidden;">`;

    // Col 1: Liste
    html += `<div style="overflow-y:auto; border-right:1px solid #333; padding:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:11px; color:var(--text-selected); font-weight:600;">Scripts</span>
        <button onclick="EnderTrack.ScenarioBuilder._newScript()" class="sb-mini-btn">+</button>
      </div>`;
    if (scripts.length === 0) {
      html += '<div style="font-size:10px; color:var(--text-general); opacity:0.4; padding:12px; text-align:center;">Aucun script</div>';
    } else {
      scripts.forEach(sc => {
        const active = this._editingScriptId === sc.id;
        html += `<div onclick="EnderTrack.ScenarioBuilder._selectScript('${sc.id}')" style="padding:6px 8px; margin-bottom:2px; background:${active ? 'var(--active-element)' : 'transparent'}; border-radius:4px; cursor:pointer; border-left:3px solid ${active ? 'var(--coordinates-color)' : 'transparent'};">
          <div style="font-size:10px; color:var(--text-selected);">🐍 ${this._escapeHtml(sc.name)}</div>
          <div style="font-size:9px; color:var(--text-general); opacity:0.5;">${sc.inputs.length} in → ${sc.outputs.length} out</div>
        </div>`;
      });
    }
    html += `<div style="margin-top:8px; display:flex; flex-direction:column; gap:4px;">
      <button onclick="EnderTrack.ScenarioBuilder._syncScripts()" class="sb-mini-btn" style="width:100%;">🔄 Sync serveur</button>
      <button onclick="EnderTrack.ScriptRegistry.importFromFile().then(s=>{if(s){EnderTrack.ScenarioBuilder._editingScriptId=s.id; EnderTrack.ScenarioBuilder._renderHelperView();}})" class="sb-mini-btn" style="width:100%;">📂 Importer</button>
    </div></div>`;

    // Col 2: Éditeur
    html += `<div style="display:flex; flex-direction:column; overflow:hidden;">`;
    if (s) {
      html += this._renderScriptEditor(s);
    } else {
      html += '<div style="font-size:11px; color:var(--text-general); opacity:0.3; padding:20px; text-align:center;">Sélectionnez un script</div>';
    }
    html += `</div></div>`;
    return html;
  }

  _renderScriptEditor(s) {
    let html = `<div style="padding:10px; border-bottom:1px solid #333; flex-shrink:0;">
      <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
        <input type="text" value="${this._escapeAttr(s.name)}" onchange="EnderTrack.ScenarioBuilder._updateScript('${s.id}', 'name', this.value)" class="sb-input" style="flex:1; font-weight:600;">
        <button onclick="EnderTrack.ScriptRegistry.exportToFile('${s.id}')" class="sb-mini-btn">💾</button>
        <button onclick="if(confirm('Supprimer ?')){EnderTrack.ScriptRegistry.delete('${s.id}'); EnderTrack.ScenarioBuilder._editingScriptId=null; EnderTrack.ScenarioBuilder._renderHelperView();}" class="sb-mini-btn sb-btn-danger">✕</button>
      </div>
      <input type="text" value="${this._escapeAttr(s.description || '')}" placeholder="Description..." onchange="EnderTrack.ScenarioBuilder._updateScript('${s.id}', 'description', this.value)" class="sb-input" style="font-size:10px; margin-bottom:6px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">`;

    // Inputs
    html += `<div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-size:9px; color:var(--text-general); font-weight:600;">Entrées</span>
        <button onclick="EnderTrack.ScenarioBuilder._addScriptIO('${s.id}', 'input')" class="sb-mini-btn" style="font-size:8px; padding:1px 4px;">+</button>
      </div>`;
    s.inputs.forEach((inp, i) => {
      html += `<div style="display:flex; gap:3px; align-items:center; margin-bottom:2px;">
        <input type="text" value="${this._escapeAttr(inp.name)}" onchange="EnderTrack.ScenarioBuilder._updateScriptIO('${s.id}', 'inputs', ${i}, 'name', this.value)" style="flex:1; padding:2px 3px; background:var(--app-bg); border:1px solid var(--border); border-radius:3px; color:var(--coordinates-color); font-family:monospace; font-size:9px;">
        <select onchange="EnderTrack.ScenarioBuilder._updateScriptIO('${s.id}', 'inputs', ${i}, 'type', this.value)" style="padding:2px; background:var(--app-bg); border:1px solid var(--border); border-radius:3px; color:var(--text-general); font-size:8px;">
          <option value="number" ${inp.type === 'number' ? 'selected' : ''}>num</option>
          <option value="string" ${inp.type === 'string' ? 'selected' : ''}>str</option>
          <option value="list" ${inp.type === 'list' ? 'selected' : ''}>list</option>
        </select>
        <button onclick="EnderTrack.ScriptRegistry.removeInput('${s.id}', ${i}); EnderTrack.ScenarioBuilder._renderHelperView();" class="sb-mini-btn" style="font-size:8px; padding:1px 3px;">✕</button>
      </div>`;
    });
    html += `</div>`;

    // Outputs
    html += `<div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-size:9px; color:var(--text-general); font-weight:600;">Sorties</span>
        <button onclick="EnderTrack.ScenarioBuilder._addScriptIO('${s.id}', 'output')" class="sb-mini-btn" style="font-size:8px; padding:1px 4px;">+</button>
      </div>`;
    s.outputs.forEach((out, i) => {
      html += `<div style="display:flex; gap:3px; align-items:center; margin-bottom:2px;">
        <input type="text" value="${this._escapeAttr(out.name)}" onchange="EnderTrack.ScenarioBuilder._updateScriptIO('${s.id}', 'outputs', ${i}, 'name', this.value)" style="flex:1; padding:2px 3px; background:var(--app-bg); border:1px solid var(--border); border-radius:3px; color:var(--coordinates-color); font-family:monospace; font-size:9px;">
        <select onchange="EnderTrack.ScenarioBuilder._updateScriptIO('${s.id}', 'outputs', ${i}, 'type', this.value)" style="padding:2px; background:var(--app-bg); border:1px solid var(--border); border-radius:3px; color:var(--text-general); font-size:8px;">
          <option value="number" ${out.type === 'number' ? 'selected' : ''}>num</option>
          <option value="string" ${out.type === 'string' ? 'selected' : ''}>str</option>
          <option value="list" ${out.type === 'list' ? 'selected' : ''}>list</option>
        </select>
        <button onclick="EnderTrack.ScriptRegistry.removeOutput('${s.id}', ${i}); EnderTrack.ScenarioBuilder._renderHelperView();" class="sb-mini-btn" style="font-size:8px; padding:1px 3px;">✕</button>
      </div>`;
    });
    html += `</div></div></div>`;

    // Code editor
    html += `<textarea id="sbScriptCode" onchange="EnderTrack.ScenarioBuilder._updateScript('${s.id}', 'code', this.value)" 
      style="flex:1; padding:10px; background:var(--app-bg); border:none; color:var(--coordinates-color); font-family:monospace; font-size:11px; resize:none; outline:none; tab-size:4;">${this._escapeHtml(s.code || '')}</textarea>`;

    return html;
  }

  _newScript() {
    const s = EnderTrack.ScriptRegistry?.create();
    if (s) { this._editingScriptId = s.id; this._renderHelperView(); }
  }

  async _syncScripts() {
    const result = await EnderTrack.ScriptRegistry?.syncFromServer();
    if (result?.error) {
      alert('Sync: ' + result.error);
    } else {
      this._renderHelperView();
      this._refreshPalette();
    }
  }

  _selectScript(id) {
    this._editingScriptId = id;
    this._renderHelperView();
  }

  _updateScript(id, prop, value) {
    EnderTrack.ScriptRegistry?.update(id, { [prop]: value });
    // Re-render list only (not the editor to avoid losing cursor)
    if (prop === 'name') this._renderHelperView();
  }

  _addScriptIO(scriptId, type) {
    if (type === 'input') EnderTrack.ScriptRegistry?.addInput(scriptId, { name: 'param', type: 'number' });
    else EnderTrack.ScriptRegistry?.addOutput(scriptId, { name: 'result', type: 'number' });
    this._renderHelperView();
  }

  _updateScriptIO(scriptId, arrayName, idx, prop, value) {
    const s = EnderTrack.ScriptRegistry?.get(scriptId);
    if (s?.[arrayName]?.[idx]) { s[arrayName][idx][prop] = value; EnderTrack.ScriptRegistry.persist(); }
  }

  _renderMacrosContent() {
    const el = document.getElementById('sbFoncContent') || document.getElementById('sbHelperContent');
    if (!el) return;
    el.style.padding = '0';
    el.style.overflow = 'hidden';
    const macros = EnderTrack.MacroRegistry?.getAll() || [];
    this._editingMacroId = this._editingMacroId || null;
    const m = this._editingMacroId ? EnderTrack.MacroRegistry?.get(this._editingMacroId) : null;

    let html = `<div style="display:grid; grid-template-columns:200px 1fr 260px; gap:0; height:100%; overflow:hidden;">`;

    // Col 1: Liste
    html += `<div style="overflow-y:auto; border-right:1px solid #333; padding:10px;">
      <div style="font-size:11px; color:var(--text-selected); font-weight:600; margin-bottom:8px;">Fonctionothèque</div>`;
    if (macros.length === 0) {
      html += '<div style="font-size:10px; color:var(--text-general); opacity:0.4; padding:12px; text-align:center;">Aucune fonction.<br>Utilisez 📦 Collapse dans le Constructeur.</div>';
    } else {
      macros.forEach(macro => {
        const active = this._editingMacroId === macro.macroId;
        html += `<div onclick="EnderTrack.ScenarioBuilder._editMacro('${macro.macroId}')" style="padding:6px 8px; margin-bottom:2px; background:${active ? 'var(--active-element)' : 'transparent'}; border-radius:4px; cursor:pointer; border-left:3px solid ${active ? 'var(--coordinates-color)' : 'transparent'};">
          <span style="font-size:11px; color:var(--text-selected);">${macro.icon || '📦'} ${this._escapeHtml(macro.name)}</span>
          ${macro.description ? `<div style="font-size:9px; color:var(--text-general); opacity:0.5; margin-top:1px;">${this._escapeHtml(macro.description.substring(0, 40))}</div>` : ''}
        </div>`;
      });
    }
    html += `<div style="margin-top:8px;">
      <button onclick="EnderTrack.MacroRegistry.importFromFile().then(m=>{if(m)EnderTrack.ScenarioBuilder._renderMacrosContent()})" class="sb-mini-btn" style="width:100%;">📂 Importer</button>
    </div></div>`;

    // Col 2: Séquence preview (lecture seule)
    html += `<div style="overflow-y:auto; padding:10px; background:var(--column-bg);">`;
    if (m) {
      html += `<div style="font-size:10px; color:var(--text-general); margin-bottom:6px; font-weight:600;">Séquence</div>`;
      html += this._renderMacroTree(m.children || []);
    } else {
      html += '<div style="font-size:11px; color:var(--text-general); opacity:0.3; padding:20px; text-align:center;">Sélectionnez une fonction</div>';
    }
    html += `</div>`;

    // Col 3: Propriétés
    html += `<div style="overflow-y:auto; border-left:1px solid #333; padding:10px;">`;
    if (m) {
      html += this._renderMacroEditor(m);
    } else {
      html += '<div style="font-size:11px; color:var(--text-general); opacity:0.3; padding:20px; text-align:center;"></div>';
    }
    html += `</div></div>`;

    el.innerHTML = html;
  }

  _renderMacroTree(children, indent = 0) {
    const sp = 'padding-left:' + (indent * 12) + 'px;';
    let html = '';
    for (const node of children) {
      if (node.type === 'action') {
        const def = EnderTrack.ActionRegistry?.get(node.actionId);
        const summary = this._actionSummary(node);
        html += `<div style="${sp} padding:3px 0; font-size:10px; color:var(--text-general);">${def?.label || node.actionId}${summary ? ` <span style="opacity:0.5;">${this._escapeHtml(summary)}</span>` : ''}</div>`;
      } else if (node.type === 'loop') {
        const def = EnderTrack.LoopTypesRegistry?.get(node.loopId);
        html += `<div style="${sp} padding:3px 0; font-size:10px; color:var(--text-selected); font-weight:500;">${def?.label || '🔁'} ${this._escapeHtml(node.params?.label || '')}</div>`;
        if (node.children) html += this._renderMacroTree(node.children, indent + 1);
      } else if (node.type === 'condition') {
        html += `<div style="${sp} padding:3px 0; font-size:10px; color:var(--coordinates-color);">👁️ ${this._escapeHtml(node.params?.label || 'Condition')}</div>`;
        (node.branches || []).forEach(b => {
          const lbl = b.condition === null ? 'SINON' : `SI ${b.condition}`;
          html += `<div style="padding-left:${(indent+1)*12}px; padding:2px 0; font-size:9px; color:var(--coordinates-color); opacity:0.7;">${this._escapeHtml(lbl)}</div>`;
          if (b.actions) html += this._renderMacroTree(b.actions, indent + 2);
        });
      } else if (node.type === 'macro') {
        html += `<div style="${sp} padding:3px 0; font-size:10px; color:var(--text-selected);">${node.icon || '📦'} ${this._escapeHtml(node.name || 'Macro')}</div>`;
        if (node.children && !node.collapsed) html += this._renderMacroTree(node.children, indent + 1);
      }
    }
    return html || `<div style="font-size:9px; color:var(--text-general); opacity:0.3; padding:4px;">vide</div>`;
  }

  _renderMacroEditor(m) {
    const inputs = m.inputs || [];
    let html = `
      <div style="font-size:11px; color:var(--text-selected); font-weight:600; margin-bottom:10px;">Propriétés</div>
      <div class="sb-param"><label class="sb-param-label">Nom</label>
        <input type="text" value="${this._escapeAttr(m.name)}" onchange="EnderTrack.ScenarioBuilder._saveMacroProp('${m.macroId}', 'name', this.value)" class="sb-input"></div>
      <div class="sb-param"><label class="sb-param-label">Icône</label>
        <input type="text" value="${this._escapeAttr(m.icon || '📦')}" onchange="EnderTrack.ScenarioBuilder._saveMacroProp('${m.macroId}', 'icon', this.value)" class="sb-input" style="width:50px;"></div>
      <div class="sb-param"><label class="sb-param-label">Description</label>
        <textarea onchange="EnderTrack.ScenarioBuilder._saveMacroProp('${m.macroId}', 'description', this.value)" class="sb-input" rows="2" style="resize:vertical;">${this._escapeHtml(m.description || '')}</textarea></div>`;

    // Inputs
    html += `<div style="border-top:1px solid #333; margin-top:8px; padding-top:8px;">
      <div style="font-size:10px; color:var(--text-selected); font-weight:600; margin-bottom:6px;">Paramètres (${inputs.length})</div>`;
    if (inputs.length === 0) {
      html += '<div style="font-size:9px; color:var(--text-general); opacity:0.4; padding:6px;">Aucun paramètre</div>';
    } else {
      inputs.forEach((inp, idx) => {
        html += `<div style="background:var(--app-bg); border-radius:4px; padding:5px 6px; margin-bottom:3px;">
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="text" value="${this._escapeAttr(inp.label)}" 
              onchange="EnderTrack.ScenarioBuilder._saveMacroInputProp('${m.macroId}', ${idx}, 'label', this.value)"
              style="flex:1; padding:2px 4px; background:transparent; border:1px solid var(--border); border-radius:3px; color:var(--text-selected); font-size:9px;">
            <label style="display:flex; align-items:center; gap:3px; font-size:8px; color:var(--text-general); cursor:pointer; white-space:nowrap;">
              <input type="checkbox" ${inp.hidden ? '' : 'checked'}
                onchange="EnderTrack.ScenarioBuilder._saveMacroInputProp('${m.macroId}', ${idx}, 'hidden', !this.checked)"> visible
            </label>
          </div>
          <div style="font-size:8px; color:var(--text-general); opacity:0.4; margin-top:2px;">Défaut: ${this._escapeHtml(String(inp.default ?? ''))} • ${inp.type}</div>
        </div>`;
      });
    }
    html += `</div>`;

    // Actions
    html += `<div style="display:flex; gap:4px; margin-top:10px; padding-top:8px; border-top:1px solid #333;">
      <button onclick="EnderTrack.ScenarioBuilder._editMacroInConstructor('${m.macroId}')" class="sb-mini-btn" style="flex:1; background:var(--active-element); color:var(--text-selected);">✏️ Éditer</button>
      <button onclick="EnderTrack.MacroRegistry.exportToFile('${m.macroId}')" class="sb-mini-btn">💾</button>
      <button onclick="if(confirm('Supprimer ?')){EnderTrack.MacroRegistry.delete('${m.macroId}'); EnderTrack.ScenarioBuilder._editingMacroId=null; EnderTrack.ScenarioBuilder._renderMacrosContent(); EnderTrack.ScenarioBuilder._refreshPalette();}" class="sb-mini-btn sb-btn-danger">✕</button>
    </div>`;
    return html;
  }

  _editMacro(macroId) {
    this._editingMacroId = macroId;
    this._renderMacrosContent();
  }

  _editMacroInConstructor(macroId) {
    const m = EnderTrack.MacroRegistry?.get(macroId);
    if (!m) return;
    // Store original scenario and macro editing state
    this._macroEditMode = {
      macroId: macroId,
      originalScenario: this.scenario,
      originalSnapshot: this._snapshot
    };
    // Create a temporary scenario from the macro
    this.scenario = {
      id: 'macro_edit_temp',
      name: `✏️ ${m.name}`,
      tree: { type: 'root', children: JSON.parse(JSON.stringify(m.children || [])) },
      watchers: []
    };
    this._snapshot = JSON.stringify(this.scenario);
    this.selectedPath = null;
    this._undoStack = [];
    this._redoStack = [];
    // Update header name
    const nameEl = document.querySelector('.sb-header-name');
    if (nameEl) nameEl.textContent = this.scenario.name;
    // Switch to Constructeur
    this._setMode('build');
    this._setView('build');
    this._refreshPalette();
    this._refreshTree();
    this._refreshProperties();
  }

  _saveMacroProp(macroId, prop, value) {
    const m = EnderTrack.MacroRegistry?.get(macroId);
    if (!m) return;
    m[prop] = value;
    EnderTrack.MacroRegistry.persist();
    this._renderMacrosContent();
    this._refreshPalette();
  }

  _saveMacroInputProp(macroId, inputIdx, prop, value) {
    const m = EnderTrack.MacroRegistry?.get(macroId);
    if (!m?.inputs?.[inputIdx]) return;
    m.inputs[inputIdx][prop] = value;
    EnderTrack.MacroRegistry.persist();
    this._renderMacrosContent();
  }

  // === REFRESH ===

  _refresh() {
    EnderTrack.Scenario?.manager?.save?.();
    EnderTrack.Scenario?.updateCanvasOverlay?.();
    this._refreshTree();
    this._refreshProperties();
    if (this._viewMode === 'code') this._renderCodeView();
    if (this._viewMode === 'vars') this._renderVarsView();
    if (this._viewMode === 'props') this._renderPropsView();
  }

  // === PALETTE ===

  _toggleAccordion(key) {
    this._openAccordions[key] = !this._openAccordions[key];
    this._refreshPalette();
  }

  _refreshPalette() {
    const el = document.getElementById('sbPalette');
    if (!el) return;

    const loops = EnderTrack.LoopTypesRegistry?.getAll() || [];
    const coreActions = EnderTrack.ActionRegistry?.getByCategory('core') || [];
    const pluginActions = this._getPluginActions();
    const customActions = EnderTrack.ActionRegistry?.getByCategory('custom') || [];
    const macros = EnderTrack.MacroRegistry?.getAll() || [];

    const item = (label, onclick) =>
      `<div class="sb-palette-item" onclick="${onclick}">${label}</div>`;

    const accordion = (key, icon, title, content, count) => {
      const open = this._openAccordions[key];
      const badge = count ? `<span class="sb-badge">${count}</span>` : '';
      return `<div class="sb-accordion">
        <div class="sb-accordion-header" onclick="EnderTrack.ScenarioBuilder._toggleAccordion('${key}')">
          <span>${open ? '▾' : '▸'} ${icon} ${title}</span>${badge}
        </div>
        ${open ? `<div class="sb-accordion-body">${content}</div>` : ''}
      </div>`;
    };

    const flowItems =
      loops.map(l => item(l.label, `EnderTrack.ScenarioBuilder.addLoop('${l.id}')`)).join('') +
      item('👁️ Condition SI/SINON', `EnderTrack.ScenarioBuilder.addCondition()`);

    const actionItems = coreActions.map(a =>
      item(a.label, `EnderTrack.ScenarioBuilder.addAction('${a.id}')`)
    ).join('');

    const pluginItems = pluginActions.length
      ? pluginActions.map(a => item(`${a.icon} ${a.label}`, `EnderTrack.ScenarioBuilder.addPluginAction('${a.id}')`)).join('')
      : '<div class="sb-palette-empty">Aucun plugin actif avec actions</div>';

    const customItems = customActions.length
      ? customActions.map(a => item(a.label, `EnderTrack.ScenarioBuilder.addAction('${a.id}')`)).join('')
      : '<div class="sb-palette-empty">Aucune action custom</div>';

    const scriptActions = this._getScriptActions();
    const pythonItems = scriptActions.length
      ? scriptActions.map(a => item(`🐍 ${this._escapeHtml(a.label)}`, `EnderTrack.ScenarioBuilder.addAction('${a.id}')`)).join('')
      : '<div class="sb-palette-empty">Aucun script</div>';

    const macroItems =
      (macros.map(m => item(`${m.icon || '📦'} ${m.name}`, `EnderTrack.ScenarioBuilder.addMacroFromLibrary('${m.macroId}')`)).join('') || '') +
      item('📂 Importer macro...', `EnderTrack.ScenarioBuilder._importMacro()`);

    el.innerHTML =
      accordion('flow', '🔄', 'Flux', flowItems, loops.length + 1) +
      accordion('actions', '⚡', 'Actions de base', actionItems, coreActions.length) +
      accordion('plugins', '🔌', 'Plugins', pluginItems, pluginActions.length || null) +
      accordion('custom', '✏️', 'Custom', customItems) +
      accordion('python', '🐍', 'Python', pythonItems, scriptActions.length || null) +
      accordion('macros', '📦', 'Macros', macroItems, macros.length || null);
  }

  // === PLUGIN ACTION DISCOVERY ===

  _getPluginActions() {
    const actions = [];
    const pm = EnderTrack.PluginManager?.plugins;
    if (!pm) return actions;
    pm.forEach((plugin, id) => {
      if (!plugin.isActive || !plugin.bridge?.scenarioActions) return;
      for (const action of plugin.bridge.scenarioActions) {
        if (!EnderTrack.ActionRegistry.get(action.id)) {
          EnderTrack.ActionRegistry.register({ ...action, category: 'plugin' });
        }
        actions.push(action);
      }
    });
    return actions;
  }

  _getScriptActions() {
    const scripts = EnderTrack.ScriptRegistry?.getAll() || [];
    const actions = [];
    for (const s of scripts) {
      const actionId = 'pyscript_' + s.id;
      if (!EnderTrack.ActionRegistry.get(actionId)) {
        EnderTrack.ActionRegistry.register({
          id: actionId,
          label: '\ud83d\udc0d ' + s.name,
          icon: '\ud83d\udc0d',
          category: 'python',
          params: s.inputs.map(inp => ({
            id: inp.name,
            label: inp.name,
            type: 'text',
            default: inp.default ?? (inp.type === 'number' ? '0' : ''),
            placeholder: inp.type === 'number' ? '0 ou $x' : ''
          })),
          execute: async (params) => {
            const es = window.EnderTrack?.Enderscope;
            const baseUrl = es?.serverUrl || 'http://127.0.0.1:5000';
            const vars = window.EnderTrack?.Scenario?.executor?.context?.variables || {};
            const resolved = {};
            for (const [k, v] of Object.entries(params)) {
              resolved[k] = _evalExpr(v, vars);
            }
            try {
              const resp = await fetch(baseUrl + '/api/macro/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script: s.name + '.py', input: resolved }),
                signal: AbortSignal.timeout(30000)
              });
              const data = await resp.json();
              // Inject outputs into scenario variables
              if (data.success && data.result) {
                const ctx = window.EnderTrack?.Scenario?.executor?.context;
                if (ctx?.variables) {
                  for (const [k, v] of Object.entries(data.result)) {
                    ctx.variables['$' + k] = v;
                  }
                }
              }
              window.EnderTrack?.Scenario?.addLog?.(`\ud83d\udc0d ${s.name}: ${JSON.stringify(data.result || data)}`, 'info');
              return { success: data.success, data };
            } catch (e) {
              window.EnderTrack?.Scenario?.addLog?.(`\ud83d\udc0d ${s.name}: erreur - ${e.message}`, 'error');
              return { success: false };
            }
          }
        });
      }
      actions.push({ id: actionId, label: s.name, icon: '\ud83d\udc0d' });
    }
    return actions;
  }

  // === TREE / CODE / VARS ZONE ===

  _refreshTree() {
    const el = document.getElementById('sbTree');
    if (!el) return;

    if (this._buildSubView === 'watchers') {
      el.innerHTML = this._renderWatchersView();
      return;
    }

    // Tree view
    el.innerHTML = this._renderNode(this.scenario.tree, '');
  }

  _renderNode(node, path) {
    if (!node) return '';
    const isSelected = this.selectedPath === path;
    const selClass = isSelected ? ' sb-node-selected' : '';
    const click = path ? `onclick="event.stopPropagation(); EnderTrack.ScenarioBuilder.selectNode('${path}')"` : '';

    if (node.type === 'root') {
      const children = (node.children || []).map((c, i) => this._renderNode(c, `children.${i}`)).join('');
      return children || '<div class="sb-tree-empty">Cliquez sur un élément de la palette pour commencer</div>';
    }

    if (node.type === 'loop') {
      const loopDef = EnderTrack.LoopTypesRegistry?.get(node.loopId);
      const label = node.params?.label || loopDef?.label || 'Boucle';
      const children = (node.children || []).map((c, i) => this._renderNode(c, `${path}.children.${i}`)).join('');
      return `<div ${click} class="sb-node sb-node-loop${selClass}">
        <div class="sb-node-header">🔁 ${this._escapeHtml(label)}</div>
        <div class="sb-node-children sb-children-loop">${children || '<div class="sb-node-empty">vide</div>'}</div>
      </div>`;
    }

    if (node.type === 'condition') {
      const branches = (node.branches || []).map((b, bi) => {
        const bLabel = b.condition === null ? 'SINON' : (bi === 0 ? `SI ${b.condition}` : `OU SI ${b.condition}`);
        const actions = (b.actions || []).map((a, ai) => this._renderNode(a, `${path}.branches.${bi}.actions.${ai}`)).join('');
        return `<div class="sb-branch">
          <div class="sb-branch-label">${this._escapeHtml(bLabel)}</div>
          <div class="sb-node-children sb-children-cond">${actions || '<div class="sb-node-empty">vide</div>'}</div>
        </div>`;
      }).join('');
      return `<div ${click} class="sb-node sb-node-condition${selClass}">
        <div class="sb-node-header">👁️ ${this._escapeHtml(node.params?.label || 'Condition')}</div>
        ${branches}
      </div>`;
    }

    if (node.type === 'macro') {
      if (node.collapsed) {
        return `<div ${click} class="sb-node sb-node-macro${selClass}">
          <span>${node.icon || '📦'} ${this._escapeHtml(node.name || 'Macro')}</span>
          <span class="sb-node-meta">${EnderTrack.TreeUtils.countActions(node)} actions</span>
        </div>`;
      }
      const children = (node.children || []).map((c, i) => this._renderNode(c, `${path}.children.${i}`)).join('');
      return `<div ${click} class="sb-node sb-node-macro${selClass}">
        <div class="sb-node-header">${node.icon || '📦'} ${this._escapeHtml(node.name || 'Macro')}</div>
        <div class="sb-node-children sb-children-macro">${children}</div>
      </div>`;
    }

    if (node.type === 'action') {
      const actionDef = EnderTrack.ActionRegistry?.get(node.actionId);
      const label = actionDef?.label || node.actionId;
      const summary = this._actionSummary(node);
      return `<div ${click} class="sb-node sb-node-action${selClass}">
        ${this._escapeHtml(label)}${summary ? `<span class="sb-node-meta">${this._escapeHtml(summary)}</span>` : ''}
      </div>`;
    }

    return '';
  }

  _renderParams(paramDefs, values, pathStr) {
    if (!paramDefs?.length) return '';
    // Check if this node is inside a loop (for 'inLoop' showIf)
    const inLoop = this._isInsideLoop(pathStr);
    return paramDefs.map(p => {
      const name = p.id || p.name;
      const val = values?.[name] ?? p.default ?? '';

      // showIf logic: comma-separated conditions
      if (p.showIf) {
        const visible = p.showIf.split(',').every(cond => {
          cond = cond.trim();
          if (cond === 'inLoop') return inLoop;
          if (cond.startsWith('!')) return !values?.[cond.slice(1)];
          if (cond.includes('=')) {
            const [k, v] = cond.split('=');
            return String(values?.[k] ?? '') === v;
          }
          return !!values?.[cond];
        });
        if (!visible) return '';
      }

      // Disable field not needed anymore (showIf handles visibility)
      const disabled = '';

      const oc = `EnderTrack.ScenarioBuilder.updateParam('${pathStr}', '${name}', this.${p.type === 'checkbox' ? 'checked' : 'value'})`;

      if (p.type === 'checkbox') {
        return `<label class="sb-param sb-param-check">
          <input type="checkbox" ${val ? 'checked' : ''} onchange="${oc}" style="accent-color:var(--coordinates-color);">
          ${this._escapeHtml(p.label)}</label>`;
      }
      if (p.type === 'select') {
        const opts = (p.options || []).map(o =>
          `<option value="${o.value}" ${String(val) === String(o.value) ? 'selected' : ''}>${o.label}</option>`
        ).join('');
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <select onchange="${oc}" class="sb-input">${opts}</select></div>`;
      }
      if (p.type === 'list-select') {
        const lists = EnderTrack.Lists?.manager?.getAllLists?.() || [];
        const lastId = lists.length ? lists[lists.length - 1].id : '';
        const selected = val || lastId;
        // Auto-save if val is empty but a list exists
        if (!val && selected && values) { values[name] = selected; }
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <select onchange="${oc}" class="sb-input">
            ${lists.map(l => `<option value="${l.id}" ${String(selected) === String(l.id) ? 'selected' : ''}>${l.name} (${l.positions?.length || 0})</option>`).join('')}
          </select></div>`;
      }
      if (p.type === 'list-position-select') {
        const listId = values?.listId;
        const list = listId ? EnderTrack.Lists?.manager?.getList?.(listId) : null;
        const positions = list?.positions || [];
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <select onchange="${oc}" class="sb-input">
            ${positions.map((pos, idx) => `<option value="${idx}" ${String(val) === String(idx) ? 'selected' : ''}>#${idx} (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})</option>`).join('') || '<option value="">Aucune position</option>'}
          </select></div>`;
      }
      if (p.type === 'strategic-select') {
        const state = EnderTrack.State?.get?.() || {};
        const opts = [
          { value: 'homeXY', label: '\ud83c\udfe0 HOME XY' },
          { value: 'homeXYZ', label: '\ud83c\udfe0 HOME XYZ' }
        ];
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <select onchange="${oc}" class="sb-input">
            ${opts.map(o => `<option value="${o.value}" ${String(val) === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select></div>`;
      }
      if (p.type === 'number') {
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <input type="text" value="${this._escapeAttr(val)}" placeholder="${p.default ?? 0}" onchange="${oc}" class="sb-input sb-input-num" ${disabled}></div>`;
      }
      if (p.readonly) {
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <input type="text" value="${this._escapeAttr(val)}" class="sb-input" readonly style="opacity:0.6;"></div>`;
      }
      return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
        <input type="text" value="${this._escapeAttr(val)}" placeholder="${this._escapeAttr(p.placeholder || '')}" onchange="${oc}" class="sb-input" ${disabled}></div>`;
    }).join('');
  }

  _renderConditionProps(node) {
    const branches = node.branches || [];
    return branches.map((b, i) => {
      const label = b.condition === null ? 'SINON' : (i === 0 ? 'SI' : 'OU SI');
      return `<div class="sb-param">
        <label class="sb-param-label" style="color:var(--coordinates-color);">${label}</label>
        ${b.condition !== null ? `<input type="text" value="${this._escapeAttr(b.condition)}" onchange="EnderTrack.ScenarioBuilder._updateBranchCondition('${this.selectedPath}', ${i}, this.value)" class="sb-input" style="font-family:monospace;">` : ''}
      </div>`;
    }).join('') + `
      <div style="display:flex; gap:4px; padding:4px 8px;">
        <button onclick="EnderTrack.ScenarioBuilder._addBranch('ouSi')" class="sb-mini-btn">+ OU SI</button>
        ${!branches.some(b => b.condition === null) ? `<button onclick="EnderTrack.ScenarioBuilder._addBranch('sinon')" class="sb-mini-btn">+ SINON</button>` : ''}
      </div>`;
  }

  // === INTERNAL ===

  _updateBranchCondition(pathStr, branchIdx, value) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (node?.branches?.[branchIdx]) {
      node.branches[branchIdx].condition = value;
      this._refresh();
    }
  }

  _addBranch(type) {
    if (!this.selectedPath) return;
    this._saveUndo();
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, this.selectedPath);
    if (!node?.branches) return;
    const condDef = EnderTrack.ConditionTypesRegistry?.get('default');
    if (type === 'sinon') condDef?.addSinon?.(node) || node.branches.push({ condition: null, actions: [] });
    else condDef?.addOuSi?.(node) || node.branches.push({ condition: '$x > 0', actions: [] });
    this._refresh();
  }

  _updateMacroProp(pathStr, prop, value) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (node) { node[prop] = value; this._refresh(); }
  }

  _updateMacroInput(pathStr, inputId, value) {
    const macro = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (!macro?.inputs) return;
    // Store the value
    if (!macro.inputValues) macro.inputValues = {};
    macro.inputValues[inputId] = value;
    // Propagate to the actual node param inside children
    const input = macro.inputs.find(i => i.id === inputId);
    if (input?.nodePath && input?.paramName) {
      // Navigate inside macro children
      const innerNode = EnderTrack.TreeUtils.getNodeByPath({ children: macro.children }, 'children.' + input.nodePath);
      if (innerNode?.params) {
        innerNode.params[input.paramName] = value;
      }
    }
    this._refresh();
  }

  async _importMacro() {
    const macro = await EnderTrack.MacroRegistry?.importFromFile();
    if (macro) {
      this._refreshPalette();
      EnderTrack.Scenario?.addLog?.(`📦 Macro "${macro.name}" importée`, 'info');
    }
  }

  _countLoops(node) {
    if (!node) return 0;
    let count = node.type === 'loop' ? 1 : 0;
    if (node.children) for (const c of node.children) count += this._countLoops(c);
    return count;
  }

  _isInsideLoop(pathStr) {
    if (!pathStr) return false;
    const parts = pathStr.split('.');
    for (let i = parts.length - 1; i >= 0; i--) {
      const parentPath = parts.slice(0, i).join('.');
      if (!parentPath) continue;
      const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, parentPath);
      if (node?.type === 'loop') return true;
    }
    return false;
  }

  _getClosestLoopVar(pathStr) {
    if (!pathStr) return null;
    const parts = pathStr.split('.');
    for (let i = parts.length - 1; i >= 0; i--) {
      const parentPath = parts.slice(0, i).join('.');
      if (!parentPath) continue;
      const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, parentPath);
      if (node?.type === 'loop') return node.params?.loopVar || '$i';
    }
    return '$i';
  }

  _getClosestLoopListId(pathStr) {
    if (!pathStr) return null;
    const parts = pathStr.split('.');
    for (let i = parts.length - 1; i >= 0; i--) {
      const parentPath = parts.slice(0, i).join('.');
      if (!parentPath) continue;
      const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, parentPath);
      if (node?.type === 'loop' && node.params?.countMode === 'list' && node.params?.countListId) {
        return node.params.countListId;
      }
    }
    return null;
  }

  _actionSummary(node) {
    const p = node.params || {};
    if (node.actionId === 'move') {
      if (p.moveType === 'relative') return `Δ(${p.dx || 0}, ${p.dy || 0}, ${p.dz || 0})`;
      if (p.absSource === 'list') {
        if (p.listPickMode === 'pick') return `→ liste[#${p.listPick || 0}]`;
        return `→ liste[${p.listIndex || '$i'}]`;
      }
      if (p.absSource === 'strategic') return `→ ${p.strategicId || 'home'}`;
      return `→(${p.x || 0}, ${p.y || 0}, ${p.z || 0})`;
    }
    if (node.actionId === 'wait') return `${p.duration || 0}s`;
    if (node.actionId === 'log') return `"${(p.message || '').substring(0, 20)}"`;
    return '';
  }

  // === WATCHERS ===

  _renderWatchersView() {
    const watchers = this.scenario.watchers || [];
    let html = `<div style="padding:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:11px; color:var(--text-selected); font-weight:500;">Surveillants (${watchers.length})</span>
        <button onclick="EnderTrack.ScenarioBuilder._addWatcher()" class="sb-mini-btn">+ Ajouter</button>
      </div>`;

    if (watchers.length === 0) {
      html += '<div class="sb-tree-empty">Aucun watcher.<br>Les watchers surveillent des conditions en continu pendant l\'exécution.</div>';
    } else {
      html += watchers.map((w, wi) => {
        const sel = this._selectedWatcherIdx === wi ? ' sb-node-selected' : '';
        const enabledIcon = w.enabled !== false ? '🟢' : '⚫';
        const branchCount = w.branches?.length || 0;
        return `<div class="sb-node sb-node-condition${sel}" onclick="event.stopPropagation(); EnderTrack.ScenarioBuilder._selectWatcher(${wi})">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11px; color:var(--text-selected);">${enabledIcon} ${this._escapeHtml(w.label || 'Watcher ' + (wi + 1))}</span>
            <span class="sb-node-meta">${branchCount} branche${branchCount > 1 ? 's' : ''}</span>
          </div>
          ${(w.branches || []).map((b, bi) => {
            const bLabel = b.condition === null ? 'SINON' : (bi === 0 ? `SI ${b.condition}` : `OU SI ${b.condition}`);
            const actionCount = b.actions?.length || 0;
            return `<div style="padding:2px 0 0 12px; font-size:10px;">
              <span style="color:var(--coordinates-color);">${this._escapeHtml(bLabel)}</span>
              <span style="color:var(--text-general); opacity:0.5;"> → ${actionCount} action${actionCount > 1 ? 's' : ''}</span>
            </div>`;
          }).join('')}
        </div>`;
      }).join('');
    }

    html += '</div>';
    return html;
  }

  _addWatcher() {
    if (!this.scenario.watchers) this.scenario.watchers = [];
    this.scenario.watchers.push({
      label: `Watcher ${this.scenario.watchers.length + 1}`,
      enabled: true,
      branches: [{ condition: '$temp > 40', actions: [] }]
    });
    this._selectedWatcherIdx = this.scenario.watchers.length - 1;
    this._refresh();
  }

  _selectWatcher(idx) {
    this._selectedWatcherIdx = idx;
    this.selectedPath = null; // deselect tree node
    this._refreshTree();
    this._refreshProperties();
  }

  _deleteWatcher(idx) {
    if (!this.scenario.watchers) return;
    this.scenario.watchers.splice(idx, 1);
    this._selectedWatcherIdx = null;
    this._refresh();
  }

  _toggleWatcherEnabled(idx) {
    const w = this.scenario.watchers?.[idx];
    if (w) { w.enabled = !w.enabled; this._refresh(); }
  }

  _updateWatcherLabel(idx, value) {
    const w = this.scenario.watchers?.[idx];
    if (w) { w.label = value; this._refresh(); }
  }

  _updateWatcherBranchCondition(wi, bi, value) {
    const w = this.scenario.watchers?.[wi];
    if (w?.branches?.[bi]) { w.branches[bi].condition = value; this._refresh(); }
  }

  _addWatcherBranch(wi, type) {
    const w = this.scenario.watchers?.[wi];
    if (!w) return;
    if (!w.branches) w.branches = [];
    if (type === 'sinon') w.branches.push({ condition: null, actions: [] });
    else w.branches.push({ condition: '$x > 0', actions: [] });
    this._refresh();
  }

  _addWatcherAction(wi, bi, actionId) {
    const w = this.scenario.watchers?.[wi];
    if (!w?.branches?.[bi]) return;
    const actionDef = EnderTrack.ActionRegistry?.get(actionId);
    if (!actionDef) return;
    const node = { type: 'action', actionId, params: {} };
    if (actionDef.params) actionDef.params.forEach(p => { node.params[p.id || p.name] = p.default; });
    if (!w.branches[bi].actions) w.branches[bi].actions = [];
    w.branches[bi].actions.push(node);
    this._refresh();
  }

  _removeWatcherAction(wi, bi, ai) {
    const w = this.scenario.watchers?.[wi];
    if (w?.branches?.[bi]?.actions) {
      w.branches[bi].actions.splice(ai, 1);
      this._refresh();
    }
  }

  _updateWatcherActionParam(wi, bi, ai, paramName, value) {
    const w = this.scenario.watchers?.[wi];
    const action = w?.branches?.[bi]?.actions?.[ai];
    if (action?.params) { action.params[paramName] = value; this._refresh(); }
  }

  // Override _refreshProperties to handle watcher selection
  _refreshProperties() {
    const el = document.getElementById('sbProps');
    if (!el) return;

    // Watcher selected?
    if (this._buildSubView === 'watchers' && this._selectedWatcherIdx !== null) {
      el.innerHTML = this._renderWatcherProps(this._selectedWatcherIdx);
      return;
    }

    // Tree node selected?
    if (!this.selectedPath) {
      el.innerHTML = '<div class="sb-props-empty">Sélectionnez un nœud</div>';
      return;
    }

    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, this.selectedPath);
    if (!node) { el.innerHTML = ''; return; }

    let html = `<div class="sb-props-actions">
      <button onclick="EnderTrack.ScenarioBuilder.moveSelected('up')" class="sb-mini-btn" title="Monter">▲</button>
      <button onclick="EnderTrack.ScenarioBuilder.moveSelected('down')" class="sb-mini-btn" title="Descendre">▼</button>
      <button onclick="EnderTrack.ScenarioBuilder.deleteSelected()" class="sb-mini-btn sb-btn-danger" title="Supprimer">✕</button>
      ${node.type === 'macro' && node.collapsed
        ? `<button onclick="EnderTrack.ScenarioBuilder.expandSelected()" class="sb-mini-btn" title="Expand">📂</button>
           <button onclick="EnderTrack.MacroRegistry.exportToFile('${node.macroId}')" class="sb-mini-btn" title="Export">💾</button>`
        : `<button onclick="EnderTrack.ScenarioBuilder.collapseSelected()" class="sb-mini-btn" title="Collapse">📦</button>`}
    </div>`;

    if (node.type === 'loop') {
      const loopDef = EnderTrack.LoopTypesRegistry?.get(node.loopId);
      html += this._renderParams(loopDef?.params || [], node.params, this.selectedPath);
    } else if (node.type === 'action') {
      const actionDef = EnderTrack.ActionRegistry?.get(node.actionId);
      html += this._renderParams(actionDef?.params || [], node.params, this.selectedPath);
    } else if (node.type === 'condition') {
      html += this._renderConditionProps(node);
    } else if (node.type === 'macro') {
      html += `<div class="sb-param">
        <label class="sb-param-label">Nom</label>
        <input type="text" value="${this._escapeAttr(node.name || '')}" onchange="EnderTrack.ScenarioBuilder._updateMacroProp('${this.selectedPath}', 'name', this.value)" class="sb-input">
      </div>
      <div class="sb-param-hint">${EnderTrack.TreeUtils.countActions(node)} actions à l'intérieur</div>`;
      // Macro inputs
      if (node.inputs?.length) {
        html += `<div style="border-top:1px solid #333; margin-top:6px; padding-top:6px;">
          <div class="sb-param-label" style="font-weight:600; margin-bottom:4px;">Paramètres</div>`;
        node.inputs.forEach(inp => {
          const val = node.inputValues?.[inp.id] ?? inp.default ?? '';
          const oc = `EnderTrack.ScenarioBuilder._updateMacroInput('${this.selectedPath}', '${inp.id}', this.value)`;
          if (inp.type === 'number') {
            html += `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(inp.label)}</label>
              <input type="text" value="${this._escapeAttr(val)}" placeholder="0" onchange="${oc}" class="sb-input sb-input-num"></div>`;
          } else if (inp.type === 'checkbox') {
            html += `<label class="sb-param sb-param-check">
              <input type="checkbox" ${val ? 'checked' : ''} onchange="EnderTrack.ScenarioBuilder._updateMacroInput('${this.selectedPath}', '${inp.id}', this.checked)" style="accent-color:var(--coordinates-color);">
              ${this._escapeHtml(inp.label)}</label>`;
          } else if (inp.type === 'list-select') {
            const lists = EnderTrack.Lists?.manager?.getAllLists?.() || [];
            html += `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(inp.label)}</label>
              <select onchange="${oc}" class="sb-input">
                ${lists.map(l => `<option value="${l.id}" ${String(val) === String(l.id) ? 'selected' : ''}>${l.name}</option>`).join('')}
              </select></div>`;
          } else {
            html += `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(inp.label)}</label>
              <input type="text" value="${this._escapeAttr(val)}" onchange="${oc}" class="sb-input"></div>`;
          }
        });
        html += `</div>`;
      }
    }

    el.innerHTML = html;
  }

  _renderWatcherProps(wi) {
    const w = this.scenario.watchers?.[wi];
    if (!w) return '';

    const allActions = EnderTrack.ActionRegistry?.getAllActions?.() || [];
    const actionOptions = allActions.map(a => `<option value="${a.id}">${a.label}</option>`).join('');

    let html = `<div class="sb-props-actions">
      <button onclick="EnderTrack.ScenarioBuilder._toggleWatcherEnabled(${wi})" class="sb-mini-btn" title="Activer/Désactiver">${w.enabled !== false ? '🟢' : '⚫'}</button>
      <button onclick="EnderTrack.ScenarioBuilder._deleteWatcher(${wi})" class="sb-mini-btn sb-btn-danger" title="Supprimer">✕</button>
    </div>`;

    // Label
    html += `<div class="sb-param">
      <label class="sb-param-label">Nom</label>
      <input type="text" value="${this._escapeAttr(w.label || '')}" onchange="EnderTrack.ScenarioBuilder._updateWatcherLabel(${wi}, this.value)" class="sb-input">
    </div>`;

    // Branches
    (w.branches || []).forEach((b, bi) => {
      const bLabel = b.condition === null ? 'SINON' : (bi === 0 ? 'SI' : 'OU SI');
      html += `<div style="border-top:1px solid #333; padding:6px 8px; margin-top:4px;">
        <label class="sb-param-label" style="color:var(--coordinates-color);">${bLabel}</label>
        ${b.condition !== null ? `<input type="text" value="${this._escapeAttr(b.condition)}" onchange="EnderTrack.ScenarioBuilder._updateWatcherBranchCondition(${wi}, ${bi}, this.value)" class="sb-input" style="font-family:monospace; margin-bottom:4px;">` : ''}
        <div style="font-size:10px; color:var(--text-general); margin:4px 0 2px;">Actions :</div>`;

      // Actions in this branch
      (b.actions || []).forEach((a, ai) => {
        const aDef = EnderTrack.ActionRegistry?.get(a.actionId);
        html += `<div style="display:flex; align-items:center; gap:4px; padding:2px 0;">
          <span style="font-size:10px; color:var(--text-general); flex:1;">${aDef?.label || a.actionId}</span>
          <button onclick="EnderTrack.ScenarioBuilder._removeWatcherAction(${wi}, ${bi}, ${ai})" class="sb-mini-btn sb-btn-danger" style="padding:1px 4px; font-size:9px;">✕</button>
        </div>`;
        // Inline params for watcher actions
        if (aDef?.params) {
          html += aDef.params.filter(p => (p.id || p.name) !== 'label' && (p.id || p.name) !== 'showInLog').map(p => {
            const name = p.id || p.name;
            const val = a.params?.[name] ?? p.default ?? '';
            const oc = `EnderTrack.ScenarioBuilder._updateWatcherActionParam(${wi}, ${bi}, ${ai}, '${name}', this.${p.type === 'checkbox' ? 'checked' : 'value'})`;
            if (p.type === 'number') return `<div style="padding:0 0 2px 8px;"><label class="sb-param-label">${this._escapeHtml(p.label)}</label><input type="text" value="${this._escapeAttr(val)}" placeholder="${p.default ?? 0}" onchange="${oc}" class="sb-input sb-input-num" style="font-size:11px;"></div>`;
            if (p.type === 'checkbox') return `<label style="display:flex; align-items:center; gap:4px; padding:0 0 2px 8px; font-size:10px; color:var(--text-general);"><input type="checkbox" ${val ? 'checked' : ''} onchange="${oc}" style="accent-color:var(--coordinates-color);">${this._escapeHtml(p.label)}</label>`;
            return `<div style="padding:0 0 2px 8px;"><label class="sb-param-label">${this._escapeHtml(p.label)}</label><input type="text" value="${this._escapeAttr(val)}" onchange="${oc}" class="sb-input" style="font-size:10px;"></div>`;
          }).join('');
        }
      });

      // Add action dropdown
      html += `<div style="margin-top:4px;">
        <select onchange="if(this.value){EnderTrack.ScenarioBuilder._addWatcherAction(${wi}, ${bi}, this.value); this.value='';}" class="sb-input" style="font-size:10px;">
          <option value="">+ Ajouter action...</option>
          ${actionOptions}
        </select>
      </div></div>`;
    });

    // Add branch buttons
    const hasSinon = w.branches?.some(b => b.condition === null);
    html += `<div style="display:flex; gap:4px; padding:6px 8px;">
      <button onclick="EnderTrack.ScenarioBuilder._addWatcherBranch(${wi}, 'ouSi')" class="sb-mini-btn">+ OU SI</button>
      ${!hasSinon ? `<button onclick="EnderTrack.ScenarioBuilder._addWatcherBranch(${wi}, 'sinon')" class="sb-mini-btn">+ SINON</button>` : ''}
    </div>`;

    return html;
  }

  // === FILE MENU ===

  _showFileMenu(event) {
    document.getElementById('sbFileMenu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'sbFileMenu';
    menu.className = 'sb-file-menu';
    menu.innerHTML = `
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._newScenario()">➕ Nouveau</div>
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._importScenario()">📂 Charger (JSON)</div>
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._renameScenario()">✏️ Renommer</div>
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._exportScenario()">💾 Sauvegarder (JSON)</div>
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._duplicateScenario()">📋 Copier</div>
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._collapseScenarioToFunction()">📦 Créer une fonction</div>
      <div class="sb-menu-item sb-menu-danger" onclick="EnderTrack.ScenarioBuilder._deleteScenario()">🗑️ Supprimer</div>
    `;
    const rect = event.currentTarget.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
    document.body.appendChild(menu);
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  _showScenarioDropdown(event) {
    document.getElementById('sbFileMenu')?.remove();
    const scenarios = EnderTrack.Scenario?.manager?.getAllScenarios?.() || [];
    if (scenarios.length <= 1) return;
    const menu = document.createElement('div');
    menu.id = 'sbFileMenu';
    menu.className = 'sb-file-menu';
    menu.innerHTML = scenarios.map(s =>
      `<div class="sb-menu-item${s.id === this.scenario.id ? ' sb-menu-active' : ''}" onclick="EnderTrack.ScenarioBuilder._switchToScenario('${s.id}')">${this._escapeHtml(s.name)}</div>`
    ).join('');
    const rect = event.currentTarget.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.left = rect.left + 'px';
    document.body.appendChild(menu);
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  _switchToScenario(id) {
    document.getElementById('sbFileMenu')?.remove();
    const mgr = EnderTrack.Scenario?.manager;
    if (!mgr) return;
    mgr.setCurrentScenario(id);
    this.scenario = mgr.getCurrentScenario();
    this.selectedPath = null;
    this._selectedWatcherIdx = null;
    this._undoStack = [];
    this._redoStack = [];
    document.querySelector('.sb-header-name').textContent = this.scenario.name;
    EnderTrack.VariableManager?.init?.(this.scenario);
    EnderTrack.Scenario?.updateCanvasOverlay?.();
    this._refreshPalette();
    this._refreshTree();
    this._refreshProperties();
    if (this._viewMode === 'vars') this._renderVarsView();
    if (this._viewMode === 'code') this._renderCodeView();
    if (this._viewMode === 'props') this._renderPropsView();
  }

  _newScenario() {
    document.getElementById('sbFileMenu')?.remove();
    const name = prompt('Nom du scénario :');
    if (!name) return;
    EnderTrack.Scenario?.manager?.createScenario?.(name);
    const s = EnderTrack.Scenario?.manager?.getCurrentScenario();
    if (s) this._switchToScenario(s.id);
  }

  _renameScenario() {
    document.getElementById('sbFileMenu')?.remove();
    const name = prompt('Nouveau nom :', this.scenario.name);
    if (!name || name === this.scenario.name) return;
    this.scenario.name = name;
    EnderTrack.Scenario?.manager?.save?.();
    document.querySelector('.sb-header-name').textContent = name;
  }

  _exportScenario() {
    document.getElementById('sbFileMenu')?.remove();
    EnderTrack.Scenario?.manager?.exportScenarioToFile?.(this.scenario.id);
  }

  async _importScenario() {
    document.getElementById('sbFileMenu')?.remove();
    const s = await EnderTrack.Scenario?.manager?.importScenarioFromFile?.();
    if (s) this._switchToScenario(s.id);
  }

  _duplicateScenario() {
    document.getElementById('sbFileMenu')?.remove();
    const dup = EnderTrack.Scenario?.manager?.duplicateScenario?.(this.scenario.id);
    if (dup) this._switchToScenario(dup.id);
  }

  _deleteScenario() {
    document.getElementById('sbFileMenu')?.remove();
    if (!confirm(`Supprimer "${this.scenario.name}" ?`)) return;
    const mgr = EnderTrack.Scenario?.manager;
    if (mgr.getAllScenarios().length <= 1) { alert('Impossible de supprimer le dernier scénario.'); return; }
    mgr.deleteScenario(this.scenario.id);
    const s = mgr.getCurrentScenario();
    if (s) this._switchToScenario(s.id);
    else this.close();
  }

  _collapseScenarioToFunction() {
    document.getElementById('sbFileMenu')?.remove();
    const tree = this.scenario?.tree;
    if (!tree?.children?.length) { alert('Le scénario est vide.'); return; }
    const name = prompt('Nom de la fonction :', this.scenario.name);
    if (!name) return;
    const children = EnderTrack.TreeUtils.clone(tree.children);
    const inputs = EnderTrack.TreeUtils.extractMacroInputs(children);
    const macro = {
      type: 'macro',
      macroId: 'macro_' + Date.now(),
      name,
      icon: '📦',
      collapsed: true,
      children,
      inputs,
      inputValues: {}
    };
    inputs.forEach(inp => { macro.inputValues[inp.id] = inp.default; });
    EnderTrack.MacroRegistry?.save(macro);
    this._editingMacroId = macro.macroId;
    this._refreshPalette();
    this._setMode("helper"); this._setHelperTab("fonctions");
  }

  _resetScenario() {
    document.getElementById('sbFileMenu')?.remove();
    if (!confirm('Réinitialiser le scénario ? Tout sera effacé.')) return;
    EnderTrack.Scenario?.manager?.resetScenario?.(this.scenario.id);
    this.scenario = EnderTrack.Scenario?.manager?.getCurrentScenario();
    this.selectedPath = null;
    this._selectedWatcherIdx = null;
    this._undoStack = [];
    this._redoStack = [];
    this._refreshPalette();
    this._refreshTree();
    this._refreshProperties();
  }

  _escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  _escapeAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ScenarioBuilder = new ScenarioBuilder();
