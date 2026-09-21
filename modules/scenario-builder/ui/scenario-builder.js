// plugins/scenario-builder/src/builder/scenario-builder.js — Split-screen Builder (v3)

class ScenarioBuilder {
  constructor() {
    this.scenario = null;
    this.selectedPath = null;
    this.selectedPaths = [];
    this._undoStack = [];
    this._redoStack = [];
    this._viewMode = 'build';
    this._openAccordions = { flow: false, actions: false, plugins: false, functions: false };
  }

  // === OPEN / CLOSE ===

  open(scenario) {
    this.scenario = scenario;
    this._snapshot = JSON.stringify(scenario);
    this.selectedPath = null;
    this.selectedPaths = [];
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
        const groupNode = this.scenario.tree.children?.[0];
        m.children = JSON.parse(JSON.stringify(groupNode?.children || this.scenario.tree.children || []));
        m.inputs = groupNode?._pendingInputs
          ? JSON.parse(JSON.stringify(groupNode._pendingInputs))
          : EnderTrack.TreeUtils.extractMacroInputs(m.children);
        EnderTrack.MacroRegistry.persist();
      }
      this.scenario = me.originalScenario;
      this._snapshot = me.originalSnapshot;
      this._macroEditMode = null;
      const nameEl = document.querySelector('.sb-header-name');
      if (nameEl) nameEl.textContent = this.scenario.name;
      this._refreshPalette();
      this._setView('build');
      this._refreshTree();
      this._refreshProperties();
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
      const nameEl = document.querySelector('.sb-header-name');
      if (nameEl) nameEl.textContent = this.scenario.name;
      this._refreshPalette();
      this._setView('build');
      this._refreshTree();
      this._refreshProperties();
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

  // Wrap selectedPaths into a container node (loop/condition). Returns true if wrapped, false if not applicable.
  _wrapSelected(containerNode, childrenKey) {
    if (this.selectedPaths.length < 2) return false;
    const allDomPaths = Array.from(document.querySelectorAll('#sbTree [data-path]')).map(el => el.dataset.path);
    const sorted = [...this.selectedPaths].sort((a, b) => allDomPaths.indexOf(a) - allDomPaths.indexOf(b));
    // All must share the same parent array
    const infos = sorted.map(p => EnderTrack.TreeUtils.getParentArray(this.scenario.tree, p));
    if (infos.some(i => !i) || infos.some(i => i.array !== infos[0].array)) return false;
    // Must be consecutive
    const indices = infos.map(i => i.index).sort((a, b) => a - b);
    for (let i = 1; i < indices.length; i++) if (indices[i] !== indices[i-1] + 1) return false;
    // Clone nodes into container
    const nodes = sorted.map(p => EnderTrack.TreeUtils.clone(EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, p)));
    containerNode[childrenKey] = nodes;
    // Delete originals (deepest first)
    [...sorted].sort((a, b) => b.localeCompare(a)).forEach(p => EnderTrack.TreeUtils.deleteNode(this.scenario.tree, p));
    // Insert container at first index
    infos[0].array.splice(indices[0], 0, containerNode);
    this.selectedPath = null;
    this.selectedPaths = [];
    return true;
  }

  addLoop(loopId) {
    this._saveUndo();
    const loopDef = EnderTrack.LoopTypesRegistry?.get(loopId);
    if (!loopDef) return;
    const node = { type: 'loop', loopId, params: {}, children: [] };
    loopDef.params.forEach(p => { node.params[p.name] = p.default; });
    const existing = this._countLoops(this.scenario.tree);
    node.params.loopVar = existing === 0 ? '$i' : `$${String.fromCharCode(105 + existing)}`;
    if (loopDef.onAdd) loopDef.onAdd(node);
    if (this._wrapSelected(node, 'children')) { this._refresh(); return; }
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
      const loopListId = this._getClosestLoopListId(this.selectedPath);
      if (loopListId) {
        node.params.moveType = 'list';
        node.params.listId = loopListId;
        node.params.listIndex = this._getClosestLoopVar(this.selectedPath);
      }
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
    if (this.selectedPaths.length > 1) {
      const allDomPaths = Array.from(document.querySelectorAll('#sbTree [data-path]')).map(el => el.dataset.path);
      const sorted = [...this.selectedPaths].sort((a, b) => allDomPaths.indexOf(a) - allDomPaths.indexOf(b));
      const infos = sorted.map(p => EnderTrack.TreeUtils.getParentArray(this.scenario.tree, p));
      if (infos.every(i => i) && infos.every(i => i.array === infos[0].array)) {
        const indices = infos.map(i => i.index).sort((a, b) => a - b);
        if (indices.every((v, i) => i === 0 || v === indices[i-1] + 1)) {
          const nodes = sorted.map(p => EnderTrack.TreeUtils.clone(EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, p)));
          if (!node.branches?.length) node.branches = [{ condition: '$x > 0', actions: [] }];
          node.branches[0].actions = nodes;
          [...sorted].sort((a, b) => b.localeCompare(a)).forEach(p => EnderTrack.TreeUtils.deleteNode(this.scenario.tree, p));
          infos[0].array.splice(indices[0], 0, node);
          this.selectedPath = null;
          this.selectedPaths = [];
          this._refresh();
          return;
        }
      }
    }
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
    const paths = this.selectedPaths.length > 1 ? this.selectedPaths : (this.selectedPath ? [this.selectedPath] : []);
    if (!paths.length) return;
    this._saveUndo();
    const sorted = [...paths].sort((a, b) => b.split('.').length - a.split('.').length || b.localeCompare(a));
    sorted.forEach(p => EnderTrack.TreeUtils.deleteNode(this.scenario.tree, p));
    this.selectedPath = null;
    this.selectedPaths = [];
    this._cleanOrphanScriptVars();
    this._refresh();
  }

  _nodeContextMenu(event, path) {
    document.getElementById('sbNodeCtxMenu')?.remove();
    this.selectNode(path);
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, path);
    const menu = document.createElement('div');
    menu.id = 'sbNodeCtxMenu';
    menu.style.cssText = 'position:fixed; z-index:9000; background:var(--column-bg); border:1px solid #444; border-radius:4px; padding:4px 0; box-shadow:0 4px 12px rgba(0,0,0,0.5); min-width:130px;';
    const item = (label, fn, danger) => {
      const d = document.createElement('div');
      d.textContent = label;
      d.style.cssText = `padding:6px 12px; font-size:11px; cursor:pointer; color:${danger ? '#ef4444' : 'var(--text-general)'};`;
      d.onmouseenter = () => d.style.background = 'var(--app-bg)';
      d.onmouseleave = () => d.style.background = '';
      d.onmousedown = (e) => { e.preventDefault(); menu.remove(); fn(); };
      return d;
    };
    if (node?.type === 'macro') {
      const srcId = node.sourceMacroId;
      if (srcId) {
        menu.appendChild(item('Edit', () => this._editMacroFromTree(srcId)));
        menu.appendChild(item('Export', () => EnderTrack.MacroRegistry.exportToFile(srcId)));
        menu.appendChild(item('Delete function', () => {
          if (confirm('Delete this function from library?')) {
            EnderTrack.MacroRegistry.delete(srcId);
            this._refreshPalette();
          }
        }, true));
      }
    } else {
      menu.appendChild(item('Copy', () => this._duplicateNode(path)));
      menu.appendChild(item('Delete', () => { this.selectedPath = path; this.selectedPaths = [path]; this.deleteSelected(); }, true));
    }
    menu.style.top = Math.min(event.clientY, window.innerHeight - 80) + 'px';
    menu.style.left = Math.min(event.clientX, window.innerWidth - 140) + 'px';
    document.body.appendChild(menu);
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  _macroContextMenu(event, macroId) {
    document.getElementById('sbMacroCtxMenu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'sbMacroCtxMenu';
    menu.style.cssText = 'position:fixed; z-index:9000; background:var(--column-bg); border:1px solid #444; border-radius:4px; padding:4px 0; box-shadow:0 4px 12px rgba(0,0,0,0.5); min-width:130px;';
    const item = (label, fn, danger) => {
      const d = document.createElement('div');
      d.textContent = label;
      d.style.cssText = `padding:6px 12px; font-size:11px; cursor:pointer; color:${danger ? '#ef4444' : 'var(--text-general)'};`;
      d.onmouseenter = () => d.style.background = 'var(--app-bg)';
      d.onmouseleave = () => d.style.background = '';
      d.onmousedown = (e) => { e.preventDefault(); menu.remove(); fn(); };
      return d;
    };
    menu.appendChild(item('Edit', () => this._editMacroFromTree(macroId)));
    menu.appendChild(item('Export', () => EnderTrack.MacroRegistry.exportToFile(macroId)));
    menu.appendChild(item('Delete', () => {
      if (confirm('Delete this function?')) {
        EnderTrack.MacroRegistry.delete(macroId);
        this._refreshPalette();
      }
    }, true));
    menu.style.top = Math.min(event.clientY, window.innerHeight - 100) + 'px';
    menu.style.left = Math.min(event.clientX, window.innerWidth - 140) + 'px';
    document.body.appendChild(menu);
    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  _editMacroFromTree(macroId) {
    const m = EnderTrack.MacroRegistry?.get(macroId);
    if (!m) return;
    // Build a group node with children + pendingInputs already set from saved inputs
    const groupNode = {
      type: 'loop', loopId: 'group',
      label: m.name, params: { label: m.name },
      children: JSON.parse(JSON.stringify(m.children || [])),
      _pendingInputs: JSON.parse(JSON.stringify(m.inputs || []))
    };
    // Store original state
    this._macroEditMode = {
      macroId,
      originalScenario: this.scenario,
      originalSnapshot: this._snapshot
    };
    this.scenario = {
      id: 'macro_edit_temp',
      name: m.name,
      tree: { type: 'root', children: [groupNode] },
      watchers: []
    };
    this._snapshot = JSON.stringify(this.scenario);
    this.selectedPath = 'children.0';
    this.selectedPaths = ['children.0'];
    this._undoStack = [];
    this._redoStack = [];
    const nameEl = document.querySelector('.sb-header-name');
    if (nameEl) nameEl.textContent = m.name;
    this._setView('build');
    this._refreshPalette();
    this._refreshTree();
    this._refreshProperties();
  }

  _duplicateNode(path) {
    this._saveUndo();
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, path);
    if (!node) return;
    const copy = JSON.parse(JSON.stringify(node));
    const result = EnderTrack.TreeUtils.getParentArray(this.scenario.tree, path);
    if (!result) return;
    result.array.splice(result.index + 1, 0, copy);
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
      this._setView("vars");
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
      // When switching absSource to list, auto-set listIndex
      if (paramName === 'moveType' && value === 'list') {
        node.params.listIndex = this._getClosestLoopVar(pathStr);
        const loopListId = this._getClosestLoopListId(pathStr);
        if (loopListId) node.params.listId = loopListId;
      }
      this._refresh();
    }
  }

  selectNode(pathStr, shiftKey, ctrlKey) {
    if (ctrlKey) {
      // Ctrl+click: toggle individual
      const idx = this.selectedPaths.indexOf(pathStr);
      if (idx >= 0) {
        this.selectedPaths.splice(idx, 1);
        this.selectedPath = this.selectedPaths[this.selectedPaths.length - 1] || null;
      } else {
        this.selectedPaths.push(pathStr);
        this.selectedPath = pathStr;
      }
    } else if (shiftKey && this.selectedPath) {
      // Shift+click: range selection using DOM order
      const allPaths = Array.from(document.querySelectorAll('#sbTree [data-path]')).map(el => el.dataset.path);
      const a = allPaths.indexOf(this.selectedPath);
      const b = allPaths.indexOf(pathStr);
      if (a >= 0 && b >= 0) {
        const [from, to] = a < b ? [a, b] : [b, a];
        this.selectedPaths = allPaths.slice(from, to + 1);
        this.selectedPath = pathStr;
      }
    } else {
      this.selectedPath = pathStr;
      this.selectedPaths = [pathStr];
    }
    this._refreshTree();
    this._refreshProperties();
  }

  _deselectNode(event) {
    // Only deselect if click was directly on the tree zone, not on a node
    if (event.target.id === 'sbTree' || event.target.classList.contains('sb-tree-empty')) {
      this.selectedPath = null;
      this.selectedPaths = [];
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
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0; margin:0 6px; opacity:0.6;">
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
          <div id="sbScenarioTabs" style="flex:1; display:flex; gap:2px; align-items:center; overflow-x:auto; padding:0 4px;"></div>
          <button onclick="EnderTrack.ScenarioBuilder.close()" class="sb-header-close" title="Close">\u2715</button>
        </div>
        <div class="sb-body">
          <!-- Manager view -->
          <div id="sbBuildView" class="sb-build-view" style="display:flex; flex-direction:column; overflow:hidden;">
            <div style="flex:1; display:grid; grid-template-columns:180px 1fr 200px; overflow:hidden;">
              <div id="sbPalette" class="sb-palette"></div>
              <div class="sb-center">
                <div id="sbTree" class="sb-tree-zone" onclick="EnderTrack.ScenarioBuilder._deselectNode(event)"></div>
              </div>
              <div id="sbProps" class="sb-props"></div>
            </div>
          </div>
        </div>
        <div class="sb-footer">
          <span style="flex:1"></span>
          <button onclick="EnderTrack.ScenarioBuilder.close()" class="sb-footer-btn sb-footer-cancel">Close</button>
          <button onclick="EnderTrack.ScenarioBuilder.save()" class="sb-footer-btn sb-footer-save">Save</button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    this._refreshPalette();
    this._refreshTree();
    this._refreshProperties();
    this._renderScenarioTabs();
    this._bindKeyboard();
  }

  _bindKeyboard() {
    this._unbindKeyboard();
    this._keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Delete' && (this.selectedPath || this.selectedPaths.length)) { e.preventDefault(); this.deleteSelected(); }
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

    // Col 1: System variables + personnalisées
    html += '<div>';
    html += '<div style="font-size:12px; color:var(--text-selected); font-weight:600; margin-bottom:8px;">System variables</div>';
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
        <span style="font-size:10px; color:var(--text-general); font-weight:600;">✏️ Custom globals</span>
        <button onclick="window.EnderTrack.VariableManager.addGlobalVariable({id:'$gvar'}); EnderTrack.ScenarioBuilder._renderHelperView();" class="sb-mini-btn" style="font-size:9px; padding:1px 6px;">+</button>
      </div>`;
    if (globalVars.length === 0) {
      html += '<div style="font-size:9px; color:var(--text-general); opacity:0.4;">None</div>';
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
      html += '<div style="font-size:10px; color:var(--text-general); opacity:0.4;">No list</div>';
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
    html += '<div style="font-size:12px; color:var(--text-selected); font-weight:600; margin-bottom:8px;">🚩 Strategic positions</div>';
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
        <div style="font-size:13px; color:var(--text-selected); font-weight:600; margin-bottom:16px;">Scenario properties</div>
        <div class="sb-param"><label class="sb-param-label">Name</label>
          <input type="text" value="${this._escapeAttr(s.name)}" onchange="EnderTrack.ScenarioBuilder._updateScenarioProp('name', this.value)" class="sb-input"></div>
        <div class="sb-param"><label class="sb-param-label">Icon (emoji)</label>
          <input type="text" value="${this._escapeAttr(s.icon || '🎬')}" onchange="EnderTrack.ScenarioBuilder._updateScenarioProp('icon', this.value)" class="sb-input" style="width:60px;"></div>
        <div class="sb-param"><label class="sb-param-label">Description</label>          <textarea onchange="EnderTrack.ScenarioBuilder._updateScenarioProp('description', this.value)" class="sb-input" rows="3" style="resize:vertical;">${this._escapeHtml(s.description || '')}</textarea></div>
        <div style="border-top:1px solid #333; margin-top:12px; padding-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:11px; color:var(--text-selected); font-weight:600;">Custom fields</span>
            <button onclick="EnderTrack.ScenarioBuilder._addCustomField()" class="sb-mini-btn">+</button>
          </div>
          ${fieldsHtml || '<div style="font-size:10px; color:var(--text-general); opacity:0.4;">No fields.</div>'}
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
      } catch { el.innerHTML = '<div class="sb-tree-empty">Error loading variables</div>'; }
    } else {
      el.innerHTML = '<div class="sb-tree-empty">Variable Manager non charg\u00e9</div>';
    }
  }

  _renderCodeView() {
    const el = document.getElementById('sbCodeView');
    if (!el) return;
    let js = '// Aucun sc\u00e9nario';
    let py = '# No scenario';
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
      html += '<div style="font-size:10px; color:var(--text-general); opacity:0.4; padding:12px; text-align:center;">No script</div>';
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
      html += '<div style="font-size:11px; color:var(--text-general); opacity:0.3; padding:20px; text-align:center;">Select a script</div>';
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
        <span style="font-size:9px; color:var(--text-general); font-weight:600;">Inputs</span>
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
      <div style="font-size:11px; color:var(--text-selected); font-weight:600; margin-bottom:8px;">Function library</div>`;
    if (macros.length === 0) {
      html += '<div style="font-size:10px; color:var(--text-general); opacity:0.4; padding:12px; text-align:center;">No function.</div>';
    } else {
      macros.forEach(macro => {
        const active = this._editingMacroId === macro.macroId;
        html += `<div onclick="EnderTrack.ScenarioBuilder._editMacro('${macro.macroId}')" style="padding:6px 8px; margin-bottom:2px; background:${active ? 'var(--active-element)' : 'transparent'}; border-radius:4px; cursor:pointer; border-left:3px solid ${active ? 'var(--coordinates-color)' : 'transparent'};">
          <span style="font-size:11px; color:var(--text-selected);">${this._escapeHtml(macro.name)}</span>
          ${macro.description ? `<div style="font-size:9px; color:var(--text-general); opacity:0.5; margin-top:1px;">${this._escapeHtml(macro.description.substring(0, 40))}</div>` : ''}
        </div>`;
      });
    }
    html += `<div style="margin-top:8px;">
      <button onclick="EnderTrack.MacroRegistry.importFromFile().then(m=>{if(m)EnderTrack.ScenarioBuilder._renderMacrosContent()})" class="sb-mini-btn" style="width:100%;">📂 Importer</button>
    </div></div>`;

    // Col 2: Sequence preview (lecture seule)
    html += `<div style="overflow-y:auto; padding:10px; background:var(--column-bg);">`;
    if (m) {
      html += `<div style="font-size:10px; color:var(--text-general); margin-bottom:6px; font-weight:600;">Sequence</div>`;
      html += this._renderMacroTree(m.children || []);
    } else {
      html += '<div style="font-size:11px; color:var(--text-general); opacity:0.3; padding:20px; text-align:center;">Select a function</div>';
    }
    html += `</div>`;

    // Col 3: Properties
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
        html += `<div style="${sp} padding:3px 0; font-size:10px; color:var(--text-general);">${def?.label || node.actionId}${summary ? ` <span style="opacity:0.5;">${summary}</span>` : ''}</div>`;
      } else if (node.type === 'loop') {
        const def = EnderTrack.LoopTypesRegistry?.get(node.loopId);
        html += `<div style="${sp} padding:3px 0; font-size:10px; color:var(--text-selected); font-weight:500;">${def?.label || '🔁'} ${this._escapeHtml(node.params?.label || '')}</div>`;
        if (node.children) html += this._renderMacroTree(node.children, indent + 1);
      } else if (node.type === 'condition') {
        html += `<div style="${sp} padding:3px 0; font-size:10px; color:var(--coordinates-color);">👁️ ${this._escapeHtml(node.params?.label || 'Condition')}</div>`;
        (node.branches || []).forEach(b => {
          const lbl = b.condition === null ? 'ELSE' : `IF ${b.condition}`;
          html += `<div style="padding-left:${(indent+1)*12}px; padding:2px 0; font-size:9px; color:var(--coordinates-color); opacity:0.7;">${this._escapeHtml(lbl)}</div>`;
          if (b.actions) html += this._renderMacroTree(b.actions, indent + 2);
        });
      } else if (node.type === 'macro') {
        html += `<div style="${sp} padding:3px 0; font-size:10px; color:var(--text-selected);">${this._escapeHtml(node.name || 'Macro')}</div>`;
        if (node.children && !node.collapsed) html += this._renderMacroTree(node.children, indent + 1);
      }
    }
    return html || `<div style="font-size:9px; color:var(--text-general); opacity:0.3; padding:4px;">empty</div>`;
  }

  _renderMacroEditor(m) {
    const inputs = m.inputs || [];
    const exposedCount = inputs.filter(i => i.exposed).length;
    let html = `
      <div style="font-size:11px; color:var(--text-selected); font-weight:600; margin-bottom:10px;">Properties</div>
      <div class="sb-param"><label class="sb-param-label">Name</label>
        <input type="text" value="${this._escapeAttr(m.name)}" onchange="EnderTrack.ScenarioBuilder._saveMacroProp('${m.macroId}', 'name', this.value)" class="sb-input"></div>
      <div class="sb-param"><label class="sb-param-label">Description</label>
        <textarea onchange="EnderTrack.ScenarioBuilder._saveMacroProp('${m.macroId}', 'description', this.value)" class="sb-input" rows="2" style="resize:vertical;">${this._escapeHtml(m.description || '')}</textarea></div>`;

    html += `<div style="border-top:1px solid #333; margin-top:8px; padding-top:8px;">
      <div style="font-size:10px; color:var(--text-selected); font-weight:600; margin-bottom:6px;">Parameters <span style="color:#666; font-weight:400;">(${exposedCount} exposed / ${inputs.length} total)</span></div>`;

    if (inputs.length === 0) {
      html += '<div style="font-size:9px; color:var(--text-general); opacity:0.4; padding:6px;">No parameters detected</div>';
    } else {
      inputs.forEach((inp, idx) => {
        const isExposed = !!inp.exposed;
        const constVal = inp.constantValue !== undefined ? inp.constantValue : inp.default ?? '';
        html += `<div style="background:var(--app-bg); border-radius:4px; padding:7px 8px; margin-bottom:5px;">
          <div style="display:flex; gap:6px; margin-bottom:${isExposed ? 6 : 0}px;">
            <button onmousedown="EnderTrack.ScenarioBuilder._saveMacroInputProp('${m.macroId}', ${idx}, 'exposed', ${!isExposed})"
              style="flex-shrink:0; padding:3px 8px; border:none; border-radius:3px; cursor:pointer; font-size:10px; font-weight:600;
                background:${isExposed ? 'rgba(245,158,11,0.25)' : 'var(--container-bg)'};
                color:${isExposed ? 'rgba(245,158,11,1)' : '#555'};
                border:1px solid ${isExposed ? 'rgba(245,158,11,0.5)' : '#333'};">${isExposed ? 'param' : 'const'}</button>
            <span style="flex:1; font-size:10px; color:${isExposed ? 'var(--text-selected)' : '#555'}; align-self:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this._escapeHtml(inp.label || inp.id)}</span>
          </div>
          ${isExposed ? `
          <div style="display:flex; flex-direction:column; gap:4px;">
            <input type="text" value="${this._escapeAttr(inp.label)}" placeholder="Label..."
              onchange="EnderTrack.ScenarioBuilder._saveMacroInputProp('${m.macroId}', ${idx}, 'label', this.value)"
              style="padding:4px 6px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:10px;">
            <input type="text" value="${this._escapeAttr(inp.default ?? '')}" placeholder="Default value"
              onchange="EnderTrack.ScenarioBuilder._saveMacroInputProp('${m.macroId}', ${idx}, 'default', this.value)"
              style="padding:4px 6px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:rgba(245,158,11,0.8); font-size:10px; font-family:monospace;">
          </div>` : `
          <input type="text" value="${this._escapeAttr(constVal)}" placeholder="fixed value"
            onchange="EnderTrack.ScenarioBuilder._saveMacroInputProp('${m.macroId}', ${idx}, 'constantValue', this.value)"
            style="width:100%; box-sizing:border-box; padding:4px 6px; background:var(--container-bg); border:1px solid #333; border-radius:3px; color:#555; font-size:10px; font-family:monospace;">`}
        </div>`;
      });
    }
    html += `</div>`;

    html += `<div style="display:flex; gap:4px; margin-top:10px; padding-top:8px; border-top:1px solid #333;">
      <button onclick="EnderTrack.ScenarioBuilder._editMacroInConstructor('${m.macroId}')" class="sb-mini-btn" style="flex:1; background:var(--active-element); color:var(--text-selected);">Edit</button>
      <button onclick="EnderTrack.MacroRegistry.exportToFile('${m.macroId}')" class="sb-mini-btn">💾</button>
      <button onclick="if(confirm('Delete?')){EnderTrack.MacroRegistry.delete('${m.macroId}'); EnderTrack.ScenarioBuilder._editingMacroId=null; EnderTrack.ScenarioBuilder._renderMacrosContent(); EnderTrack.ScenarioBuilder._refreshPalette();}" class="sb-mini-btn sb-btn-danger">✕</button>
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

  _renderScenarioTabs() {
    const el = document.getElementById('sbScenarioTabs');
    if (!el) return;
    const mgr = EnderTrack.Scenario?.manager;
    if (!mgr) return;
    const scenarios = mgr.getAllScenarios() || [];
    const current = mgr.getCurrentScenario();
    el.innerHTML = scenarios.map(s => {
      const active = s.id === current?.id;
      const dot = s.color ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${s.color};margin-right:5px;flex-shrink:0;vertical-align:middle;"></span>` : '';
      return `<button
        onclick="EnderTrack.ScenarioBuilder._switchToScenario('${s.id}')"
        oncontextmenu="event.preventDefault(); EnderTrack.ScenarioBuilder._scenarioTabContextMenu(event, '${s.id}')"
        style="padding:4px 10px; border:none; border-radius:4px; cursor:pointer; font-size:13px; white-space:nowrap; display:flex; align-items:center;
          background:${active ? 'var(--active-element)' : 'var(--app-bg)'};
          color:${active ? 'var(--text-selected)' : 'var(--text-general)'};"
      >${dot}${s.icon ? s.icon + ' ' : ''}${this._escapeHtml(s.name)}</button>`;
    }).join('') + `<button onclick="EnderTrack.ScenarioBuilder._newScenarioMenu(event)" style="padding:4px 10px; border:none; border-radius:4px; cursor:pointer; font-size:13px; background:var(--app-bg); color:var(--text-general);">+</button>`;
  }

  _newScenarioMenu(e) {
    document.getElementById('sbNewMenu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'sbNewMenu';
    menu.className = 'axis-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.innerHTML = `
      <button onmousedown="EnderTrack.ScenarioBuilder._newScenario(); this.parentElement.remove()">+ New</button>
      <button onmousedown="EnderTrack.ScenarioBuilder._importScenario(); this.parentElement.remove()">Load (JSON)</button>
    `;
    document.body.appendChild(menu);
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  _scenarioTabContextMenu(e, id) {
    document.getElementById('sbTabCtxMenu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'sbTabCtxMenu';
    menu.className = 'axis-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    const canDelete = (EnderTrack.Scenario?.manager?.getAllScenarios()?.length || 0) > 1;
    menu.innerHTML = `
      <button onmousedown="EnderTrack.ScenarioBuilder._editScenario('${id}'); this.parentElement.remove()">Edit</button>
      <button onmousedown="EnderTrack.ScenarioBuilder._exportById('${id}'); this.parentElement.remove()">Save (JSON)</button>
      <button onmousedown="EnderTrack.ScenarioBuilder._deleteById('${id}'); this.parentElement.remove()" style="color:#ef4444;" ${canDelete ? '' : 'disabled'}>✕ Delete</button>
    `;
    document.body.appendChild(menu);
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  _editScenario(id) {
    const mgr = EnderTrack.Scenario?.manager;
    const s = mgr?.getAllScenarios().find(s => s.id === id);
    if (!s) return;
    document.getElementById('sbEditPanel')?.remove();
    const icons = ['🔬','🧪','📷','🌟','💡','🧬','🧠','🌿','🐛','🔍','🎯','📊','📈','⭐','📚','📍','⏱️','🧩','🎬','🛠️','⚙️','🚀','🌊','🔥','❄️','🌈','💎','🧊','🍀'];
    const panel = document.createElement('div');
    panel.id = 'sbEditPanel';
    panel.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--column-bg); border:1px solid #444; border-radius:8px; padding:14px; z-index:6000; box-shadow:0 4px 20px rgba(0,0,0,0.5); min-width:260px; max-width:320px;';
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <input type="text" id="sbEditName" value="${this._escapeHtml(s.name)}" style="flex:1; padding:4px 6px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:12px; margin-right:8px;">
        <button onclick="document.getElementById('sbEditPanel').remove()" style="background:none; border:none; color:var(--text-general); cursor:pointer; font-size:14px;">✕</button>
      </div>
      <textarea id="sbEditDesc" placeholder="Description..." rows="2" style="width:100%; box-sizing:border-box; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-general); font-size:11px; padding:4px 6px; resize:vertical; margin-bottom:8px;">${s.description || ''}</textarea>
      <details style="margin-bottom:6px;">
        <summary style="font-size:10px; color:#666; cursor:pointer; user-select:none; padding:2px 0; list-style:none;">▸ Color &amp; Icon</summary>
        <div style="display:flex; gap:5px; align-items:center; margin:6px 0 4px; flex-wrap:wrap;">
          ${['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#6b7280',''].map(col => {
            const active = (s.color||'') === col;
            const bg = col || 'rgba(150,150,150,0.2)';
            return `<div onclick="EnderTrack.ScenarioBuilder._setCurrentColor('${col}'); this.closest('#sbEditPanel').querySelectorAll('.sb-color-swatch').forEach(d=>d.style.outline='none'); this.style.outline='2px solid #fff';" class="sb-color-swatch" style="width:16px;height:16px;border-radius:50%;background:${bg};cursor:pointer;flex-shrink:0;outline:${active?'2px solid #fff':'none'};outline-offset:2px;"></div>`;
          }).join('')}
        </div>
        <div style="display:grid; grid-template-columns:repeat(6,1fr); gap:3px; margin-bottom:4px;">
          ${icons.map(i => `<button onclick="EnderTrack.ScenarioBuilder._setCurrentIcon('${i}'); this.closest('#sbEditPanel').querySelectorAll('.sb-icon-btn').forEach(b=>b.style.outline='none'); this.style.outline='2px solid var(--coordinates-color)'" class="sb-icon-btn" style="padding:5px; border:none; border-radius:3px; cursor:pointer; font-size:18px; background:var(--app-bg); outline:${(s.icon||'🎬')===i?'2px solid var(--coordinates-color)':'none'};" onmouseenter="this.style.background='var(--active-element)'" onmouseleave="this.style.background='var(--app-bg)'">${i}</button>`).join('')}
        </div>
      </details>
      <details style="margin-bottom:8px;">
        <summary style="font-size:10px; color:#666; cursor:pointer; user-select:none; padding:2px 0; display:flex; justify-content:space-between; align-items:center; list-style:none;">
          <span>▸ Variables</span>
          <button onmousedown="event.preventDefault(); event.stopPropagation(); EnderTrack.ScenarioBuilder._addEditPanelVar('${id}')" class="sb-mini-btn" style="font-size:9px; padding:0px 5px;">+</button>
        </summary>
        <div id="sbEditVars" style="margin-top:4px;">${this._renderEditPanelVars(id)}</div>
      </details>
      <button onclick="
        const n=document.getElementById('sbEditName').value;
        const d=document.getElementById('sbEditDesc').value;
        if(n) EnderTrack.ScenarioBuilder._renameTo('${id}',n);
        EnderTrack.ScenarioBuilder._setDesc('${id}',d);
        document.getElementById('sbEditPanel').remove();
      " style="width:100%; padding:5px; border:none; border-radius:4px; cursor:pointer; background:var(--active-element); color:var(--text-selected); font-size:11px;">OK</button>
    `;
    document.body.appendChild(panel);
    const close = (e) => { if (!panel.contains(e.target)) { panel.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }
  _setDesc(id, desc) {
    const mgr = EnderTrack.Scenario?.manager;
    const s = mgr?.getAllScenarios().find(s => s.id === id);
    if (!s) return;
    s.description = desc;
    mgr.save();
  }

  _renderEditPanelVars(id) {
    const mgr = EnderTrack.Scenario?.manager;
    const s = mgr?.getAllScenarios().find(s => s.id === id);
    const local = s?.customVariables || [];
    const global = window.EnderTrack?.VariableManager?.globalVariables || [];
    const row = (v, i, isGlobal) => {
      const tag = isGlobal ? `<span style="font-size:8px;color:#f59e0b;border:1px solid rgba(245,158,11,0.4);border-radius:2px;padding:0 2px;">global</span>` : `<span style="font-size:8px;color:#666;border:1px solid #333;border-radius:2px;padding:0 2px;">local</span>`;
      const updateFn = isGlobal ? `EnderTrack.ScenarioBuilder._updateEditPanelGlobalVar(${i},'id','$'+this.value)` : `EnderTrack.ScenarioBuilder._updateEditPanelVar('${id}',${i},'id','$'+this.value)`;
      const updateFormula = isGlobal ? `EnderTrack.ScenarioBuilder._updateEditPanelGlobalVar(${i},'formula',this.value)` : `EnderTrack.ScenarioBuilder._updateEditPanelVar('${id}',${i},'formula',this.value)`;
      const removeFn = isGlobal ? `EnderTrack.ScenarioBuilder._removeEditPanelGlobalVar(${i})` : `EnderTrack.ScenarioBuilder._removeEditPanelVar('${id}',${i})`;
      return `<div style="display:flex; align-items:center; gap:4px; padding:2px 0; border-bottom:1px solid #2a2a2a;">
        ${tag}
        <input type="text" value="${v.id.replace('$','')}" placeholder="name"
          onchange="${updateFn}; document.getElementById('sbEditVars').innerHTML=EnderTrack.ScenarioBuilder._renderEditPanelVars('${id}')"
          style="width:55px; padding:2px 3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-family:monospace; font-size:10px;">
        <span style="color:#555; font-size:10px;">=</span>
        <input type="text" value="${v.formula || ''}" placeholder="0"
          onchange="${updateFormula}"
          style="flex:1; padding:2px 3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-family:monospace; font-size:10px;">
        <button onclick="${removeFn}; document.getElementById('sbEditVars').innerHTML=EnderTrack.ScenarioBuilder._renderEditPanelVars('${id}')" style="padding:1px 4px; background:transparent; border:1px solid #333; border-radius:3px; color:#555; cursor:pointer; font-size:9px;">✕</button>
      </div>`;
    };
    const rows = [...local.map((v,i) => row(v,i,false)), ...global.map((v,i) => row(v,i,true))];
    return rows.length ? rows.join('') : '<div style="font-size:10px; color:var(--text-general); opacity:0.4; padding:4px;">No variables</div>';
  }

  _addEditPanelVar(id) {
    const mgr = EnderTrack.Scenario?.manager;
    const s = mgr?.getAllScenarios().find(s => s.id === id);
    if (!s) return;
    if (!s.customVariables) s.customVariables = [];
    let idx = s.customVariables.length + 1;
    let varId = '$var' + idx;
    while (s.customVariables.find(v => v.id === varId)) { idx++; varId = '$var' + idx; }
    s.customVariables.push({ id: varId, name: varId, formula: '0', type: 'number' });
    mgr.save();
    const el = document.getElementById('sbEditVars');
    if (el) el.innerHTML = this._renderEditPanelVars(id);
  }

  _updateEditPanelVar(id, idx, prop, value) {
    const mgr = EnderTrack.Scenario?.manager;
    const s = mgr?.getAllScenarios().find(s => s.id === id);
    if (!s?.customVariables?.[idx]) return;
    if (prop === 'id') { s.customVariables[idx].id = value; s.customVariables[idx].name = value; }
    else s.customVariables[idx][prop] = value;
    mgr.save();
  }

  _removeEditPanelVar(id, idx) {
    const mgr = EnderTrack.Scenario?.manager;
    const s = mgr?.getAllScenarios().find(s => s.id === id);
    if (!s?.customVariables) return;
    s.customVariables.splice(idx, 1);
    mgr.save();
    const el = document.getElementById('sbEditVars');
    if (el) el.innerHTML = this._renderEditPanelVars(id);
  }

  _updateEditPanelGlobalVar(idx, prop, value) {
    const vm = window.EnderTrack?.VariableManager;
    if (!vm?.globalVariables?.[idx]) return;
    if (prop === 'id') { vm.globalVariables[idx].id = value; vm.globalVariables[idx].name = value; }
    else vm.globalVariables[idx][prop] = value;
    vm.save?.();
  }

  _removeEditPanelGlobalVar(idx) {
    const vm = window.EnderTrack?.VariableManager;
    if (!vm?.globalVariables) return;
    vm.globalVariables.splice(idx, 1);
    vm.save?.();
  }

  _renameTo(id, name) {
    const mgr = EnderTrack.Scenario?.manager;
    const s = mgr?.getAllScenarios().find(s => s.id === id);
    if (!s || !name) return;
    s.name = name;
    mgr.save();
    if (id === this.scenario?.id) this.scenario.name = name;
    this._renderScenarioTabs();
    EnderTrack.Scenario?.createUI?.();
  }

  _exportById(id) {
    EnderTrack.Scenario?.manager?.exportScenarioToFile?.(id);
  }

  _deleteById(id) {
    const mgr = EnderTrack.Scenario?.manager;
    if (!mgr || mgr.getAllScenarios().length <= 1) return;
    if (!confirm('Delete this scenario?')) return;
    const isCurrent = this.scenario?.id === id;
    mgr.deleteScenario(id);
    const s = mgr.getCurrentScenario();
    if (!s) { this.close(); return; }
    this._switchToScenario(s.id);
  }

  _renameCurrentTo(name) {
    if (!name) return;
    this._renameTo(this.scenario.id, name);
  }

  _setCurrentIcon(icon) {
    this.scenario.icon = icon;
    EnderTrack.Scenario?.manager?.save?.();
    this._renderScenarioTabs();
    EnderTrack.Scenario?.createUI?.();
  }

  _setCurrentColor(color) {
    this.scenario.color = color;
    EnderTrack.Scenario?.manager?.save?.();
    this._renderScenarioTabs();
    EnderTrack.Scenario?.createUI?.();
  }

  _showIconPicker() {
    document.getElementById('sbIconPicker')?.remove();
    const icons = [
      '\ud83d\udd2c', '\ud83e\uddea', '\ud83d\udcf7', '\ud83c\udf1f', '\ud83d\udca1',
      '\ud83e\uddb4', '\ud83e\udde0', '\ud83c\udf3f', '\ud83d\udc1b', '\ud83e\uddec',
      '\ud83d\udd0d', '\ud83c\udfaf', '\ud83d\udcca', '\ud83d\udcc8', '\u2b50',
      '\ud83d\udcda', '\ud83d\udccd', '\u23f1\ufe0f', '\ud83e\udde9', '\ud83c\udfac',
      '\ud83d\udee0\ufe0f', '\u2699\ufe0f', '\ud83d\ude80', '\ud83c\udf0a', '\ud83d\udd25',
      '\u2744\ufe0f', '\ud83c\udf08', '\ud83d\udc8e', '\ud83e\uddca', '\ud83c\udf40'
    ];
    const picker = document.createElement('div');
    picker.id = 'sbIconPicker';
    picker.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--column-bg); border:1px solid #444; border-radius:8px; padding:12px; z-index:6000; box-shadow:0 4px 20px rgba(0,0,0,0.5);';
    picker.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:10px; color:var(--text-general);">Ic\u00f4ne & couleur</span>
        <input type="color" value="${this.scenario.color || '#2a2a2a'}" onchange="EnderTrack.ScenarioBuilder._setCurrentColor(this.value)" style="width:24px; height:24px; padding:0; border:1px solid #444; border-radius:4px; cursor:pointer; background:none;">
      </div>
      <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:4px;">
        ${icons.map(i => `<button onclick="EnderTrack.ScenarioBuilder._setCurrentIcon('${i}'); document.getElementById('sbIconPicker').remove()" style="padding:8px; border:none; border-radius:4px; cursor:pointer; font-size:20px; background:var(--app-bg); transition:background 0.1s;" onmouseenter="this.style.background='var(--active-element)'" onmouseleave="this.style.background='var(--app-bg)'">${i}</button>`).join('')}
      </div>
      <div style="margin-top:8px; display:flex; gap:6px; align-items:center;">
        <input type="text" id="sbCustomIcon" placeholder="Coller ici" style="flex:1; padding:4px 6px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:14px; text-align:center;">
        <button onclick="const v=document.getElementById('sbCustomIcon').value; if(v) { EnderTrack.ScenarioBuilder._setCurrentIcon(v); document.getElementById('sbIconPicker').remove(); }" style="padding:4px 8px; border:none; border-radius:3px; cursor:pointer; font-size:10px; background:var(--active-element); color:var(--text-selected);">OK</button>
      </div>`;
    document.body.appendChild(picker);
    const close = (e) => { if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  _setCurrentDesc(desc) {
    this.scenario.description = desc;
    EnderTrack.Scenario?.manager?.save?.();
  }

  _addField() {
    if (!this.scenario.fields) this.scenario.fields = [];
    this.scenario.fields.push({ label: '', value: '' });
    EnderTrack.Scenario?.manager?.save?.();
  }

  _updateField(idx, key, val) {
    if (!this.scenario.fields?.[idx]) return;
    this.scenario.fields[idx][key] = val;
    EnderTrack.Scenario?.manager?.save?.();
  }

  _removeField(idx) {
    if (!this.scenario.fields) return;
    this.scenario.fields.splice(idx, 1);
    EnderTrack.Scenario?.manager?.save?.();
  }

  _saveGroupAsAction(pathStr) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (!node) return;
    const name = node.label || node.params?.label || 'Function';
    // Use inputs already stored on node (built live in props), or extract fresh
    const inputs = node._pendingInputs || EnderTrack.TreeUtils.extractMacroInputs(node.children || []);
    const macro = {
      type: 'macro',
      macroId: 'macro_' + Date.now(),
      name,
      collapsed: true,
      children: EnderTrack.TreeUtils.clone(node.children || []),
      inputs,
      inputValues: {}
    };
    inputs.forEach(inp => { macro.inputValues[inp.id] = inp.default; });
    EnderTrack.MacroRegistry?.save(macro);
    this._editingMacroId = macro.macroId;
    this._refreshPalette();
    this._setView('functions');
  }

  _toggleCode() {}
  _renderCodePanel() {}

    _refreshPalette() {
    const el = document.getElementById('sbPalette');
    if (!el) return;

    const loops = EnderTrack.LoopTypesRegistry?.getAll() || [];
    const coreActions = EnderTrack.ActionRegistry?.getByCategory('core') || [];
    const pluginActions = this._getPluginActions();

    const item = (label, onclick) =>
      `<div class="sb-palette-item" onclick="${onclick}">${label}</div>`;

    const accordion = (key, icon, title, content, count) => {
      const open = this._openAccordions[key];
      const badge = count ? `<span class="sb-badge">${count}</span>` : '';
      return `<div class="sb-accordion" data-key="${key}">
        <div class="sb-accordion-header" onclick="EnderTrack.ScenarioBuilder._toggleAccordion('${key}')">
          <span>${open ? '▾' : '▸'} ${title}</span>${badge}
        </div>
        ${open ? `<div class="sb-accordion-body">${content}</div>` : ''}
      </div>`;
    };

    const flowLoops = loops.filter(l => l.id !== 'group');
    const flowItems =
      flowLoops.map(l => item(l.label, `EnderTrack.ScenarioBuilder.addLoop('${l.id}')`)).join('') +
      item('If / Else', `EnderTrack.ScenarioBuilder.addCondition()`) +
      item('Function', `EnderTrack.ScenarioBuilder.addLoop('group')`);

    const actionItems = coreActions.map(a =>
      item(a.label, `EnderTrack.ScenarioBuilder.addAction('${a.id}')`)
    ).join('');

    const pluginItems = pluginActions.length
      ? pluginActions.map(a => item(`${a.icon} ${a.label}`, `EnderTrack.ScenarioBuilder.addPluginAction('${a.id}')`)).join('')
      : '';

    const macros = EnderTrack.MacroRegistry?.getAll() || [];
    const macroItems = macros.length
      ? macros.map(m => `<div class="sb-palette-item"
          onclick="EnderTrack.ScenarioBuilder.addMacroFromLibrary('${m.macroId}')"
          oncontextmenu="event.preventDefault(); EnderTrack.ScenarioBuilder._macroContextMenu(event,'${m.macroId}')">${this._escapeHtml(m.name)}</div>`).join('')
      : '<div class="sb-palette-empty">No functions yet</div>';

    el.innerHTML =
      accordion('flow', '', 'Structure', flowItems, flowLoops.length + 2) +
      accordion('actions', '', 'Actions', actionItems, coreActions.length) +
      (pluginActions.length ? accordion('plugins', '', 'Plugins', pluginItems, pluginActions.length) : '') +
      accordion('functions', '', 'Functions', macroItems, macros.length || null);
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
    el.innerHTML = this._renderNode(this.scenario.tree, '');
  }

  _setNodeProp(path, key, val) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, path);
    if (!node) return;
    node[key] = val;
    EnderTrack.Scenario?.manager?.save?.();
  }

  _setNodeLabel(path, val) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, path);
    if (!node) return;
    node.label = val;
    if (node.params) node.params.label = val;
    EnderTrack.Scenario?.manager?.save?.();
    this._refreshTree();
  }

  _toggleGroupInput(pathStr, idx, exposed) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (!node?._pendingInputs?.[idx]) return;
    node._pendingInputs[idx].exposed = exposed;
    this._refreshProperties();
  }

  _setGroupInputLabel(pathStr, idx, label) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (!node?._pendingInputs?.[idx]) return;
    node._pendingInputs[idx].label = label;
  }

  _setGroupInputDefault(pathStr, idx, value) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (!node?._pendingInputs?.[idx]) return;
    node._pendingInputs[idx].default = value;
  }

  _toggleMacroExpand(path) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, path);
    if (!node) return;
    node._uiExpanded = !node._uiExpanded;
    this._refreshTree();
  }

  _toggleNodeCollapse(path) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, path);
    if (!node) return;
    node._uiCollapsed = !node._uiCollapsed;
    this._refreshTree();
  }

  _renderNode(node, path) {
    if (!node) return '';
    const isSelected = this.selectedPaths.includes(path);
    const selClass = isSelected ? ' sb-node-selected' : '';
    const click = path ? `onclick="event.stopPropagation(); EnderTrack.ScenarioBuilder.selectNode('${path}', event.shiftKey, event.ctrlKey||event.metaKey)"` : '';
    const ctx = path ? `oncontextmenu="event.preventDefault(); event.stopPropagation(); EnderTrack.ScenarioBuilder._nodeContextMenu(event,'${path}')"` : '';
    const drag = path ? `draggable="true"
      ondragstart="event.stopPropagation(); event.dataTransfer.effectAllowed='move'; EnderTrack.ScenarioBuilder._dragStart('${path}', this);"
      ondragend="EnderTrack.ScenarioBuilder._dragCleanup(this)"` : '';
    const drop = path ? `
      ondragover="event.preventDefault(); event.stopPropagation(); EnderTrack.ScenarioBuilder._dragOver(event,this,'${path}');"
      ondragleave="EnderTrack.ScenarioBuilder._dragLeave(event,this);"
      ondrop="event.preventDefault(); event.stopPropagation(); EnderTrack.ScenarioBuilder._dragDrop(event,this,'${path}');"` : '';

    if (node.type === 'root') {
      const children = (node.children || []).map((c, i) => this._renderNode(c, `children.${i}`)).join('');
      return children || '<div class="sb-tree-empty">Click a palette item to start</div>';
    }

    if (node.type === 'loop') {
      const loopDef = EnderTrack.LoopTypesRegistry?.get(node.loopId);
      const title = node.label || node.params?.label || loopDef?.label || 'Loop';
      const collapsed = node._uiCollapsed;
      const count = (node.children || []).length;
      const countHint = node.loopId === 'simple'
        ? (() => {
            const cm = node.params?.countMode;
            const loopVar = node.params?.loopVar || '$i';
            if (cm === 'infinite') return `<span class="sb-node-meta sb-meta-var">${loopVar} ∞</span>`;
            if (cm === 'list') {
              const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
              const list = lists.find(l => String(l.id) === String(node.params?.countListId)) || lists[0];
              const n = list?.positions?.length ?? '?';
              const name = list?.name || 'List';
              return `<span class="sb-node-meta"><span class="sb-meta-var">${loopVar}</span> <span class="sb-meta-count">×${n}</span> <span class="sb-meta-list">(${name})</span></span>`;
            }
            const c = node.params?.count ?? '?';
            return `<span class="sb-node-meta"><span class="sb-meta-var">${loopVar}</span> <span class="sb-meta-count">×${c}</span></span>`;
          })()
        : node.loopId === 'while'
        ? (() => {
            const loopVar = node.params?.loopVar || '$i';
            const cond = node.params?.condition || '';
            return `<span class="sb-node-meta"><span class="sb-meta-var">${loopVar}</span>${cond ? ` <span class="sb-meta-list">${cond}</span>` : ''}</span>`;
          })()
        : '';
      const dotColor = node.loopId === 'group' && node.params?.color
        ? `<span style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${node.params.color};border-radius:2px 0 0 2px;"></span>` : '';
      const children = collapsed ? '' : (node.children || []).map((c, i) =>
        this._renderNode(c, `${path}.children.${i}`)
      ).join('');
      const emptyDrop = `<div class="sb-node-empty sb-empty-drop"
        ondragover="event.preventDefault(); event.stopPropagation(); this.style.background='rgba(245,158,11,0.15)';"
        ondragleave="this.style.background='';"
        ondrop="event.preventDefault(); event.stopPropagation(); this.style.background=''; EnderTrack.ScenarioBuilder._dragDropInto('${path}.children', 0);"
      >·</div>`;
      return `<div ${drag} ${drop} ${click} ${ctx} class="sb-node sb-node-loop${selClass}" data-loop="${node.loopId}" data-path="${path}">
        <div class="sb-node-header">
          <button onclick="event.stopPropagation(); EnderTrack.ScenarioBuilder._toggleNodeCollapse('${path}')" class="sb-collapse-btn">${collapsed ? '\u25b8' : '\u25be'}</button>
          ${dotColor}${this._escapeHtml(title)} ${countHint}
          ${collapsed ? `<span class="sb-node-meta">${count} items</span>` : ''}
        </div>
        ${collapsed ? '' : `<div class="sb-node-children sb-children-loop" data-loop="${node.loopId}">${children || emptyDrop}</div>`}
      </div>`;
    }

    if (node.type === 'condition') {
      const branches = (node.branches || []).map((b, bi) => {
        const bLabel = b.condition === null ? 'ELSE' : (bi === 0 ? `IF ${b.condition}` : `ELSE IF ${b.condition}`);
        const actions = (b.actions || []).map((a, ai) =>
          this._renderNode(a, `${path}.branches.${bi}.actions.${ai}`)
        ).join('');
        const emptyDrop = `<div class="sb-node-empty sb-empty-drop"
          ondragover="event.preventDefault(); event.stopPropagation(); this.style.background='rgba(245,158,11,0.15)';"
          ondragleave="this.style.background='';"
          ondrop="event.preventDefault(); event.stopPropagation(); this.style.background=''; EnderTrack.ScenarioBuilder._dragDropInto('${path}.branches.${bi}.actions', 0);"
        >·</div>`;
        return `<div class="sb-branch">
          <div class="sb-branch-label">${this._escapeHtml(bLabel)}</div>
          <div class="sb-node-children sb-children-cond">${actions || emptyDrop}</div>
        </div>`;
      }).join('');
      return `<div ${drag} ${drop} ${click} ${ctx} class="sb-node sb-node-condition${selClass}" data-path="${path}">
        <div class="sb-node-header">\u{1f441}\ufe0f ${this._escapeHtml(node.label || node.params?.label || 'Condition')}</div>
        ${branches}
      </div>`;
    }

    if (node.type === 'macro') {
      const collapsed = node.collapsed && !node._uiExpanded;
      const exposedInputs = (node.inputs || []).filter(i => i.exposed);
      const paramSummary = exposedInputs.map(i => {
        let v = node.inputValues?.[i.id] ?? i.default ?? '';
        if (i.type === 'list-select') {
          const l = EnderTrack.Lists?.manager?.getList?.(v);
          if (l) v = l.name;
        }
        return `${i.label || i.id}=${v}`;
      }).join(', ');
      if (collapsed) {
        return `<div ${drag} ${drop} ${click} ${ctx} class="sb-node sb-node-macro${selClass}" data-path="${path}">
          <div style="display:flex; align-items:center; gap:4px;">
            <button onclick="event.stopPropagation(); EnderTrack.ScenarioBuilder._toggleMacroExpand('${path}')" class="sb-collapse-btn">&#9658;</button>
            <span>${''} ${this._escapeHtml(node.name || 'Macro')}</span>
            ${paramSummary ? `<span class="sb-node-meta">${this._escapeHtml(paramSummary)}</span>` : `<span class="sb-node-meta">${EnderTrack.TreeUtils.countActions(node)} actions</span>`}
          </div>
        </div>`;
      }
      const children = (node.children || []).map((c, i) =>
        this._renderNode(c, `${path}.children.${i}`)
      ).join('');
      return `<div ${drag} ${drop} ${click} ${ctx} class="sb-node sb-node-macro${selClass}" data-path="${path}">
        <div class="sb-node-header" style="display:flex; align-items:center; gap:4px;">
          <button onclick="event.stopPropagation(); EnderTrack.ScenarioBuilder._toggleMacroExpand('${path}')" class="sb-collapse-btn">&#9660;</button>
          ${''} ${this._escapeHtml(node.label || node.name || 'Macro')}
          ${paramSummary ? `<span class="sb-node-meta">${this._escapeHtml(paramSummary)}</span>` : ''}
        </div>
        <div class="sb-node-children sb-children-macro">${children}</div>
      </div>`;
    }

    if (node.type === 'action') {
      const actionDef = EnderTrack.ActionRegistry?.get(node.actionId);
      const name = actionDef?.label || node.actionId;
      const display = node.label || name;
      const summary = this._actionSummary(node);
      return `<div ${drag} ${drop} ${click} ${ctx} class="sb-node sb-node-action${selClass}" data-action="${node.actionId}" data-path="${path}">
        ${this._escapeHtml(display)}${summary ? `<span class="sb-node-meta">${summary}</span>` : ''}
      </div>`;
    }

    return '';
  }

  _dragStart(path, el) {
    this._dragFrom = path;
    // If dragged node is part of multi-selection, drag all; otherwise drag only this one
    this._dragFromPaths = this.selectedPaths.includes(path) && this.selectedPaths.length > 1
      ? [...this.selectedPaths]
      : [path];
    el.style.opacity = '0.4';
  }

  _dragOver(e, el, path) {
    if (!this._dragFrom || this._dragFrom === path) return;
    if (path.startsWith(this._dragFrom + '.')) return;
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    el.style.borderTop = e.clientY < mid ? '2px solid #f59e0b' : '';
    el.style.borderBottom = e.clientY >= mid ? '2px solid #f59e0b' : '';
  }

  _dragLeave(e, el) {
    // Only clear if leaving to outside the element (not into a child)
    if (el.contains(e.relatedTarget)) return;
    el.style.borderTop = '';
    el.style.borderBottom = '';
  }

  _dragCleanup(el) {
    this._dragFrom = null;
    if (el) el.style.opacity = '';
    document.querySelectorAll('[data-path]').forEach(n => {
      n.style.borderTop = '';
      n.style.borderBottom = '';
    });
  }

  _dragDrop(e, el, toPath) {
    el.style.borderTop = '';
    el.style.borderBottom = '';
    const fromPaths = this._dragFromPaths || [this._dragFrom];
    this._dragFrom = null;
    this._dragFromPaths = null;
    if (!fromPaths.length || fromPaths.includes(toPath)) return;
    if (fromPaths.some(p => toPath.startsWith(p + '.'))) return;

    const insertAfter = e.clientY >= el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2;
    this._saveUndo();

    // Sort by DOM order (deepest last, then by path string)
    const allDomPaths = Array.from(document.querySelectorAll('#sbTree [data-path]')).map(el => el.dataset.path);
    const sorted = [...fromPaths].sort((a, b) => allDomPaths.indexOf(a) - allDomPaths.indexOf(b));

    const nodes = sorted.map(p => EnderTrack.TreeUtils.clone(EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, p))).filter(Boolean);

    const toInfo = EnderTrack.TreeUtils.getParentArray(this.scenario.tree, toPath);
    if (!toInfo) return;

    // Delete all from paths (sort deepest first to avoid index shift)
    const sortedForDelete = [...sorted].sort((a, b) => b.split('.').length - a.split('.').length || b.localeCompare(a));
    sortedForDelete.forEach(p => EnderTrack.TreeUtils.deleteNode(this.scenario.tree, p));

    // Re-resolve toInfo after deletions
    const toInfo2 = EnderTrack.TreeUtils.getParentArray(this.scenario.tree, toPath);
    if (!toInfo2) { this._refresh(); return; }
    const { array, index } = toInfo2;
    let insertIdx = insertAfter ? index + 1 : index;
    nodes.forEach((node, i) => array.splice(insertIdx + i, 0, node));

    this.selectedPath = null;
    this.selectedPaths = [];
    this._refresh();
  }

  _dragDropInto(arrayPath, idx) {
    const fromPaths = this._dragFromPaths || [this._dragFrom];
    this._dragFrom = null;
    this._dragFromPaths = null;
    if (!fromPaths.length) return;
    if (fromPaths.some(p => arrayPath.startsWith(p + '.'))) return;
    this._saveUndo();

    const allDomPaths = Array.from(document.querySelectorAll('#sbTree [data-path]')).map(el => el.dataset.path);
    const sorted = [...fromPaths].sort((a, b) => allDomPaths.indexOf(a) - allDomPaths.indexOf(b));
    const nodes = sorted.map(p => EnderTrack.TreeUtils.clone(EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, p))).filter(Boolean);

    const parts = arrayPath.split('.');
    const arrKey = parts.pop();
    const parentPath = parts.join('.');
    const parent = parentPath ? EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, parentPath) : this.scenario.tree;
    if (!parent?.[arrKey]) return;
    const array = parent[arrKey];

    const sortedForDelete = [...sorted].sort((a, b) => b.split('.').length - a.split('.').length || b.localeCompare(a));
    sortedForDelete.forEach(p => EnderTrack.TreeUtils.deleteNode(this.scenario.tree, p));

    nodes.forEach((node, i) => array.splice(Math.max(0, idx + i), 0, node));

    this.selectedPath = null;
    this.selectedPaths = [];
    this._refresh();
  }

  _renderParams(paramDefs, values, pathStr, parentMacro = null) {
    if (!paramDefs?.length) return '';
    // Check if this node is inside a loop (for 'inLoop' showIf)
    const inLoop = this._isInsideLoop(pathStr);
    return paramDefs.map(p => {
      const name = p.id || p.name;
      const val = values?.[name] ?? p.default ?? '';

      // If inside a macro, lock params that are not exposed
      let forcedReadonly = false;
      if (parentMacro) {
        const inputId = `${parentMacro.relativePath}.${name}`.replace(/\./g, '_');
        const exposed = parentMacro.macro.inputs?.find(i => i.id === inputId && i.exposed);
        if (!exposed) forcedReadonly = true;
      }

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

      const disabled = '';
      const oc = forcedReadonly ? '' : `EnderTrack.ScenarioBuilder.updateParam('${pathStr}', '${name}', this.${p.type === 'checkbox' ? 'checked' : 'value'})`;
      const ocSelect = forcedReadonly ? '' : (parentMacro
        ? `EnderTrack.ScenarioBuilder.updateParam('${pathStr}','${name}',this.value); EnderTrack.ScenarioBuilder._syncExposedToMacro('${parentMacro.macroPath}','${pathStr}','${name}')`
        : `EnderTrack.ScenarioBuilder.updateParam('${pathStr}','${name}',this.value)`);

      if (p.type === 'checkbox') {
        return `<label class="sb-param sb-param-check" style="${forcedReadonly ? 'opacity:0.4; pointer-events:none;' : ''}">
          <input type="checkbox" ${val ? 'checked' : ''} ${forcedReadonly ? 'disabled' : `onchange="${oc}"`}>
          ${this._escapeHtml(p.label)}</label>`;
      }
      if (p.type === 'select') {
        const opts = (p.options || []).map(o =>
          `<option value="${o.value}" ${String(val) === String(o.value) ? 'selected' : ''}>${o.label}</option>`
        ).join('');
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <select ${forcedReadonly ? 'disabled style="opacity:0.4;"' : `onchange="${ocSelect}"`} class="sb-input">${opts}</select></div>`;
      }
      if (p.type === 'list-select') {
        const lists = EnderTrack.Lists?.manager?.getAllLists?.() || [];
        const lastId = lists.length ? lists[lists.length - 1].id : '';
        const selected = val || lastId;
        // Auto-save if val is empty but a list exists
        if (!val && selected && values) { values[name] = selected; }
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <select onchange="${ocSelect}" class="sb-input">
            ${lists.map(l => `<option value="${l.id}" ${String(selected) === String(l.id) ? 'selected' : ''}>${l.name} (${l.positions?.length || 0})</option>`).join('')}
          </select></div>`;
      }
      if (p.type === 'list-position-select') {
        const listId = values?.listId;
        const list = listId ? EnderTrack.Lists?.manager?.getList?.(listId) : null;
        const positions = list?.positions || [];
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <select onchange="${ocSelect}" class="sb-input">
            ${positions.map((pos, idx) => `<option value="${idx}" ${String(val) === String(idx) ? 'selected' : ''}>#${idx} (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})</option>`).join('') || '<option value="">No position</option>'}
          </select></div>`;
      }
      if (p.type === 'strategic-select') {
        const state = EnderTrack.State?.get?.() || {};
        const opts = [
          { value: 'homeXY', label: '\ud83c\udfe0 HOME XY' },
          { value: 'homeXYZ', label: '\ud83c\udfe0 HOME XYZ' }
        ];
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <select onchange="${ocSelect}" class="sb-input">
            ${opts.map(o => `<option value="${o.value}" ${String(val) === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select></div>`;
      }
      if (p.type === 'camera-select') {
        const cameras = window._cameras || [];
        const opts = cameras.length
          ? cameras.map(c => `<option value="${c.id}" ${String(val) === String(c.id) ? 'selected' : ''}>${c.label || c.type} (${c.id})</option>`).join('')
          : `<option value="">— Not configured —</option>`;
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <select onchange="${ocSelect}" class="sb-input">${opts}</select></div>`;
      }
      if (p.type === 'light-select') {
        const lights = window._lights || [];
        const opts = lights.length
          ? lights.map(l => `<option value="${l.id}" ${String(val) === String(l.id) ? 'selected' : ''}>${l.name || l.id}</option>`).join('')
          : `<option value="">— Not configured —</option>`;
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <select onchange="${ocSelect}" class="sb-input">${opts}</select></div>`;
      }
      if (p.type === 'feedrate') {
        if (forcedReadonly) {
          const curVal = values?.[name] ?? p.default ?? 0;
          const displayVal = (!curVal || curVal === '0' || curVal === 0) ? 'global' : String(curVal);
          return `<div class="sb-param"><label class="sb-param-label" style="opacity:0.4;">${this._escapeHtml(p.label)}</label>
            <span style="font-size:11px; color:#555; font-family:monospace; opacity:0.4;">${this._escapeHtml(displayVal)}</span></div>`;
        }
        const globalFr = window.EnderTrack?.State?.get()?.feedrate || 3000;
        const curVal = values?.[name] ?? p.default ?? 0;
        const isVar = String(curVal).startsWith('$');
        const numVal = isVar ? globalFr : (parseInt(curVal) || 0);
        const useGlobal = !isVar && numVal === 0;
        const displayVal = useGlobal ? globalFr : numVal;
        const sliderId = `frs_${pathStr}_${name}`.replace(/[^a-zA-Z0-9_]/g, '_');
        const inputId = `fr_${pathStr}_${name}`.replace(/[^a-zA-Z0-9_]/g, '_');
        const dim = useGlobal ? 'opacity:0.4;' : '';
        const ocFr = parentMacro
          ? `EnderTrack.ScenarioBuilder.updateParam('${pathStr}','${name}',parseInt(this.value)); EnderTrack.ScenarioBuilder._syncExposedToMacro('${parentMacro.macroPath}','${pathStr}','${name}')`
          : `EnderTrack.ScenarioBuilder.updateParam('${pathStr}','${name}',parseInt(this.value))`;
        if (isVar) {
          return `<div class="sb-param">
            <label class="sb-param-label">${this._escapeHtml(p.label)}</label>
            <input type="text" value="${this._escapeAttr(curVal)}" placeholder="$mySpeed"
              onchange="EnderTrack.ScenarioBuilder.updateParam('${pathStr}','${name}',this.value)${parentMacro ? `; EnderTrack.ScenarioBuilder._syncExposedToMacro('${parentMacro.macroPath}','${pathStr}','${name}')` : ''}"
              oninput="this.classList.toggle('sb-var',this.value.startsWith('$'))"
              class="sb-input sb-var" style="font-family:monospace;">
            <button title="Reset" onmousedown="EnderTrack.ScenarioBuilder.updateParam('${pathStr}','${name}',0); EnderTrack.ScenarioBuilder._refresh()" style="flex-shrink:0; border:none; background:none; color:#666; cursor:pointer; font-size:12px; padding:0 2px;">↺</button>
          </div>`;
        }
        return `<div class="sb-param">
          <label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <input type="range" id="${sliderId}" min="100" max="10000" step="100" value="${displayVal}"
            oninput="document.getElementById('${inputId}').value=this.value;"
            onchange="${ocFr}"
            style="flex:1; height:4px; accent-color:var(--coordinates-color); min-width:0; ${dim}">
          <input type="number" id="${inputId}" value="${displayVal}" min="100" max="10000" step="100"
            oninput="document.getElementById('${sliderId}').value=this.value;"
            onchange="${ocFr}"
            style="width:48px; flex-shrink:0; padding:2px 3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:11px; text-align:center; font-family:monospace; height:22px; ${dim}">
          ${!useGlobal ? `<button title="Reset" onmousedown="EnderTrack.ScenarioBuilder.updateParam('${pathStr}','${name}',0); EnderTrack.ScenarioBuilder._refresh()" style="flex-shrink:0; border:none; background:none; color:#666; cursor:pointer; font-size:12px; padding:0 2px;">↺</button>` : ''}
          <button title="Use variable" onmousedown="EnderTrack.ScenarioBuilder.updateParam('${pathStr}','${name}','$'); EnderTrack.ScenarioBuilder._refresh()" style="flex-shrink:0; border:none; background:none; color:#666; cursor:pointer; font-size:11px; padding:0 2px;">$</button>
        </div>`;
      }
      if (p.type === 'number') {
        const isVar = String(val).startsWith('$');
        const ocNum = forcedReadonly ? '' : (parentMacro
          ? `EnderTrack.ScenarioBuilder.updateParam('${pathStr}','${name}',this.value); EnderTrack.ScenarioBuilder._syncExposedToMacro('${parentMacro.macroPath}','${pathStr}','${name}')`
          : oc);
        return `<div class="sb-param"><label class="sb-param-label" style="${forcedReadonly?'opacity:0.4;':''}">${this._escapeHtml(p.label)}</label>
          <input type="text" value="${this._escapeAttr(val)}" placeholder="${p.default ?? 0}" ${forcedReadonly ? 'readonly style="opacity:0.4; pointer-events:none;"' : `onchange="${ocNum}" oninput="this.classList.toggle('sb-var',this.value.startsWith('$'))"`} class="sb-input sb-input-num${isVar ? ' sb-var' : ''}"></div>`;
      }
      if (p.readonly) {
        return `<div class="sb-param"><label class="sb-param-label">${this._escapeHtml(p.label)}</label>
          <input type="text" value="${this._escapeAttr(val)}" class="sb-input sb-var" readonly style="opacity:0.8;"></div>`;
      }
      const isVarText = String(val).startsWith('$');
      const ocText = forcedReadonly ? '' : (parentMacro
        ? `EnderTrack.ScenarioBuilder.updateParam('${pathStr}','${name}',this.value); EnderTrack.ScenarioBuilder._syncExposedToMacro('${parentMacro.macroPath}','${pathStr}','${name}')`
        : oc);
      return `<div class="sb-param"><label class="sb-param-label" style="${forcedReadonly?'opacity:0.4;':''}">${this._escapeHtml(p.label)}</label>
        <input type="text" value="${this._escapeAttr(val)}" placeholder="${this._escapeAttr(p.placeholder || '')}" ${forcedReadonly ? 'readonly style="opacity:0.4; pointer-events:none;"' : `onchange="${ocText}" oninput="this.classList.toggle('sb-var',this.value.startsWith('$'))"`} class="sb-input${isVarText ? ' sb-var' : ''}"></div>`;
    }).join('');
  }

  _renderConditionProps(node) {
    const branches = node.branches || [];
    return branches.map((b, i) => {
      const label = b.condition === null ? 'ELSE' : (i === 0 ? 'IF' : 'ELSE IF');
      return `<div class="sb-param">
        <label class="sb-param-label" style="color:var(--coordinates-color);">${label}</label>
        ${b.condition !== null ? `<input type="text" value="${this._escapeAttr(b.condition)}" onchange="EnderTrack.ScenarioBuilder._updateBranchCondition('${this.selectedPath}', ${i}, this.value)" class="sb-input" style="font-family:monospace;">` : '<span style="flex:1;"></span>'}
        ${i > 0 ? `<button onmousedown="EnderTrack.ScenarioBuilder._removeBranch('${this.selectedPath}',${i})" style="flex-shrink:0; border:none; background:none; color:#666; cursor:pointer; font-size:13px; padding:0 2px;" onmouseenter="this.style.color='#e25555'" onmouseleave="this.style.color='#666'">✕</button>` : ''}
      </div>`;
    }).join('') + `
      <div style="display:flex; gap:4px; padding:4px 8px;">
        <button onclick="EnderTrack.ScenarioBuilder._addBranch('ouSi')" class="sb-mini-btn">+ ELSE IF</button>
        ${!branches.some(b => b.condition === null) ? `<button onclick="EnderTrack.ScenarioBuilder._addBranch('sinon')" class="sb-mini-btn">+ ELSE</button>` : ''}
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
    if (type === 'sinon') {
      if (condDef?.addSinon) condDef.addSinon(node);
      else node.branches.push({ condition: null, actions: [] });
    } else {
      if (condDef?.addOuSi) condDef.addOuSi(node);
      else node.branches.push({ condition: '$x > 0', actions: [] });
    }
    this._refresh();
  }

  _removeBranch(pathStr, branchIndex) {
    this._saveUndo();
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (!node?.branches || branchIndex === 0) return;
    node.branches.splice(branchIndex, 1);
    this.selectedPath = pathStr;
    this._refresh();
  }

  _updateMacroProp(pathStr, prop, value) {
    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (node) { node[prop] = value; this._refresh(); }
  }

  _updateMacroInput(pathStr, inputId, value) {
    const macro = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, pathStr);
    if (!macro?.inputs) return;
    if (!macro.inputValues) macro.inputValues = {};
    macro.inputValues[inputId] = value;
    // Propagate to children param in-place
    const input = macro.inputs.find(i => i.id === inputId);
    if (input?.nodePath && input?.paramName) {
      const innerNode = EnderTrack.TreeUtils.getNodeByPath({ type: 'root', children: macro.children }, input.nodePath);
      if (innerNode?.params) innerNode.params[input.paramName] = value;
    }
    this._refresh();
  }

  async _importMacro() {
    const macro = await EnderTrack.MacroRegistry?.importFromFile();
    if (macro) {
      this._refreshPalette();
      EnderTrack.Scenario?.addLog?.(`Function "${macro.name}" imported`, 'info');
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

  _syncExposedToMacro(macroPath, nodePath, paramName) {
    const macro = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, macroPath);
    if (!macro?.inputs) return;
    
    // relativePath = nodePath stripped of macroPath + '.children.'
    const prefix = macroPath + '.children.';
    const relativePath = nodePath.startsWith(prefix) ? nodePath.slice(prefix.length) : nodePath;
    const inputId = `${relativePath}.${paramName}`.replace(/\./g, '_');
    const input = macro.inputs.find(i => i.id === inputId);
    if (!input) return;
    const innerNode = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, nodePath);
    if (!innerNode?.params) return;
    const newVal = innerNode.params[paramName];
    if (!macro.inputValues) macro.inputValues = {};
    macro.inputValues[inputId] = newVal;
    input.default = newVal;
    this._refresh();
  }

  _getParentMacro(pathStr) {
    if (!pathStr) return null;
    const parts = pathStr.split('.');
    for (let i = parts.length - 1; i >= 1; i--) {
      // Skip if this part is 'children'/'branches'/'actions' — not a real node
      if (parts[i - 1] === 'children' || parts[i - 1] === 'branches' || parts[i - 1] === 'actions') continue;
      const parentPath = parts.slice(0, i).join('.');
      const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, parentPath);
      if (node?.type === 'macro') {
        const afterMacro = parts.slice(i).join('.');
        const relativePath = afterMacro.replace(/^children\./, '');
        return { macro: node, macroPath: parentPath, relativePath };
      }
    }
    return null;
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
    const v = s => String(s || '');
    const wVar = s => `<span class="sb-meta-var">${this._escapeHtml(v(s))}</span>`;
    const w = s => v(s).startsWith('$') ? wVar(s) : `<span class="sb-meta-value">${this._escapeHtml(v(s))}</span>`;
    if (node.actionId === 'move') {
      if (p.moveType === 'relative') return `<span class="sb-meta-value">Δ(${w(p.dx||0)}, ${w(p.dy||0)}, ${w(p.dz||0)})</span>`;
      if (p.moveType === 'list') {
        const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
        const list = lists.find(l => String(l.id) === String(p.listId)) || lists[0];
        const listName = list?.name || 'List';
        return `→ <span class="sb-meta-list">${this._escapeHtml(listName)}</span>[${wVar(p.listIndex||'$i')}]`;
      }
      return `<span class="sb-meta-value">→(${w(p.x||0)}, ${w(p.y||0)}, ${w(p.z||0)})</span>`;
    }
    if (node.actionId === 'wait') return `<span class="sb-meta-value">${w(p.duration||0)}s</span>`;
    if (node.actionId === 'log') return `<span class="sb-meta-value">"${this._escapeHtml((p.message||'').substring(0,20))}"</span>`;
    return '';
  }

  _refreshProperties() {
    const el = document.getElementById('sbProps');
    if (!el) return;

    if (this.selectedPaths.length > 1) {
      const allDomPaths = Array.from(document.querySelectorAll('#sbTree [data-path]')).map(e => e.dataset.path);
      const sorted = [...this.selectedPaths].sort((a, b) => allDomPaths.indexOf(a) - allDomPaths.indexOf(b));
      const items = sorted.map(p => {
        const n = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, p);
        if (!n) return '';
        let label = n.label || n.params?.label || '';
        let type = '';
        if (n.type === 'action') type = EnderTrack.ActionRegistry?.get(n.actionId)?.label || n.actionId;
        else if (n.type === 'loop') type = EnderTrack.LoopTypesRegistry?.get(n.loopId)?.label || 'Loop';
        else if (n.type === 'condition') type = 'Condition';
        const display = label || type;
        return `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:3px;background:var(--app-bg);margin-bottom:3px;">
          <span style="font-size:10px;color:var(--text-selected);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this._escapeHtml(display)}</span>
          <span style="font-size:9px;color:#666;">${this._escapeHtml(type !== display ? type : n.type)}</span>
        </div>`;
      }).join('');
      el.innerHTML = `<div style="padding:8px;">
        <div style="font-size:10px;color:#666;margin-bottom:6px;">${sorted.length} nodes selected</div>
        ${items}
        <div style="margin-top:8px;">
          <button onclick="EnderTrack.ScenarioBuilder.deleteSelected()" style="width:100%;padding:4px;border:none;border-radius:3px;cursor:pointer;font-size:10px;background:transparent;color:#ef4444;">Delete all</button>
        </div>
      </div>`;
      return;
    }

    if (!this.selectedPath) {
      el.innerHTML = '<div class="sb-props-empty">Select a node</div>';
      return;
    }

    const node = EnderTrack.TreeUtils.getNodeByPath(this.scenario.tree, this.selectedPath);
    if (!node) { el.innerHTML = ''; return; }

    // Detect if selected node is inside a macro
    const parentMacro = this._getParentMacro(this.selectedPath);

    let html = '';
    if (parentMacro) {
      html += `<div style="font-size:9px; color:rgba(245,158,11,0.6); padding:3px 8px; border-bottom:1px solid #2a2a2a; margin-bottom:2px;">Inside — ${this._escapeHtml(parentMacro.macro.name || 'Function')}</div>`;
    }
    html += `<div class="sb-props-actions">
      ${node.type === 'loop' && node.loopId === 'group'
        ? `<button onclick="EnderTrack.ScenarioBuilder._saveGroupAsAction('${this.selectedPath}')" class="sb-mini-btn">Save as function</button>`
        : ''}
    </div>
    <div class="sb-props-label-section">
      <div class="sb-param">
        <label class="sb-param-label">Label</label>
        <input type="text" value="${this._escapeAttr(node.label || node.params?.label || '')}" placeholder="${this._escapeAttr(node.type === 'action' ? (EnderTrack.ActionRegistry?.get(node.actionId)?.label || node.actionId) : node.type === 'loop' ? (EnderTrack.LoopTypesRegistry?.get(node.loopId)?.label || 'Function') : 'Condition')}"
          onchange="EnderTrack.ScenarioBuilder._setNodeLabel('${this.selectedPath}', this.value)"
          class="sb-input">
      </div>
    </div>
    <div class="sb-props-divider"></div>`;

    if (node.type === 'loop') {
      if (node.loopId === 'group') {
        const inputs = EnderTrack.TreeUtils.extractMacroInputs(node.children || []);
        // Restore exposed/label state from previously saved _pendingInputs
        if (node._pendingInputs) {
          inputs.forEach(inp => {
            const saved = node._pendingInputs.find(s => s.id === inp.id);
            if (saved) { inp.exposed = saved.exposed; inp.label = saved.label ?? inp.label; }
          });
        }
        node._pendingInputs = inputs;
        if (inputs.length) {
          html += `<div style="margin-bottom:6px;">`;
          // Group by source node (nodePath)
          let lastNodePath = null;
          inputs.forEach((inp, idx) => {
            // Section separator when source node changes
            if (inp.nodePath !== lastNodePath) {
              lastNodePath = inp.nodePath;
              const sectionLabel = inp.label.includes('→') ? inp.label.split('→')[0].trim() : '';
              if (sectionLabel) html += `<div class="sb-props-section-label">${this._escapeHtml(sectionLabel)}</div>`;
            }
            const isExposed = !!inp.exposed;
            const shortLabel = inp.label.includes('→') ? inp.label.split('→').pop().trim() : inp.label;
            // Add index if multiple inputs share same shortLabel
            const sameCount = inputs.filter(i => (i.label.includes('→') ? i.label.split('→').pop().trim() : i.label) === shortLabel);
            const displayLabel = sameCount.length > 1 ? `${shortLabel} ${sameCount.indexOf(inp) + 1}` : shortLabel;
            const defDisplay = (inp.type === 'feedrate' && (inp.default === 0 || inp.default === '0' || inp.default === '')) ? 'global' : String(inp.default ?? '');
            html += `<div style="display:flex; align-items:center; gap:4px; padding:2px 6px; margin-bottom:1px;">
              <button onmousedown="EnderTrack.ScenarioBuilder._toggleGroupInput('${this.selectedPath}', ${idx}, ${!isExposed})"
                title="${isExposed ? 'Lock' : 'Expose as parameter'}"
                style="flex-shrink:0; padding:0px 4px; border:none; border-radius:2px; cursor:pointer; font-size:9px;
                  background:${isExposed ? 'rgba(245,158,11,0.15)' : 'transparent'};
                  color:${isExposed ? 'rgba(245,158,11,0.9)' : '#3a3a3a'};
                  border:1px solid ${isExposed ? 'rgba(245,158,11,0.3)' : '#2e2e2e'};">${isExposed ? 'param' : '—'}</button>
              <span style="flex:1; font-size:10px; color:${isExposed ? 'var(--text-selected)' : '#666'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this._escapeHtml(displayLabel)}</span>
              ${!isExposed
                ? `<span style="font-size:10px; color:#555; font-family:monospace;">${this._escapeHtml(defDisplay)}</span>`
                : `<input type="text" value="${this._escapeAttr(inp.label || displayLabel)}" placeholder="Label"
                    onchange="EnderTrack.ScenarioBuilder._setGroupInputLabel('${this.selectedPath}', ${idx}, this.value)"
                    style="width:60px; padding:1px 4px; background:var(--app-bg); border:1px solid rgba(245,158,11,0.3); border-radius:3px; color:var(--text-selected); font-size:10px;">
                  <input type="text" value="${this._escapeAttr(defDisplay)}"
                    onchange="EnderTrack.ScenarioBuilder._setGroupInputDefault('${this.selectedPath}', ${idx}, this.value)"
                    placeholder="default"
                    style="width:40px; padding:1px 4px; background:var(--app-bg); border:1px solid rgba(245,158,11,0.3); border-radius:3px; color:rgba(245,158,11,0.9); font-size:10px; font-family:monospace;">`
              }
            </div>`;
          });
          html += `</div>`;
        } else {
          html += `<div style="font-size:9px; color:#555; padding:4px 0;">No parameters detected</div>`;
        }
        html += `<label class="sb-param sb-param-check">
          <input type="checkbox" ${node.params?.showInLog ? 'checked' : ''} onchange="EnderTrack.ScenarioBuilder.updateParam('${this.selectedPath}','showInLog',this.checked)" style="accent-color:var(--coordinates-color);">
          Log</label>`;
      } else {
        const loopDef = EnderTrack.LoopTypesRegistry?.get(node.loopId);
        const filteredParams = (loopDef?.params || []).filter(p => p.name !== 'label');
        if (filteredParams.length) {
          html += `<div class="sb-props-section-label">${this._escapeHtml(loopDef?.label || 'Loop')}</div>`;
          html += this._renderParams(filteredParams, node.params, this.selectedPath, parentMacro);
        }
      }
    } else if (node.type === 'action') {
      const actionDef = EnderTrack.ActionRegistry?.get(node.actionId);
      if (actionDef?.params?.length) {
        html += `<div class="sb-props-section-label">${this._escapeHtml(actionDef.label)}</div>`;
        html += this._renderParams(actionDef.params, node.params, this.selectedPath, parentMacro);
      }
    } else if (node.type === 'condition') {
      html += this._renderConditionProps(node);
      html += `<label class="sb-param sb-param-check">
        <input type="checkbox" ${node.params?.showInLog ? 'checked' : ''} onchange="EnderTrack.ScenarioBuilder.updateParam('${this.selectedPath}','showInLog',this.checked)">
        Log
      </label>`;
    } else if (node.type === 'macro') {
      const srcId = node.sourceMacroId;
      const exposedInputs = (node.inputs || []).filter(i => i.exposed);
      html += `<div class="sb-param-hint">${EnderTrack.TreeUtils.countActions(node)} actions inside</div>`;
      if (exposedInputs.length) {
        html += `<div style="border-top:1px solid #333; margin-top:6px; padding-top:6px;">
          <div class="sb-param-label" style="font-weight:600; margin-bottom:4px;">Parameters</div>`;
        exposedInputs.forEach(inp => {
          const val = node.inputValues?.[inp.id] ?? inp.default ?? '';
          const oc = `EnderTrack.ScenarioBuilder._updateMacroInput('${this.selectedPath}', '${inp.id}', this.value)`;
          const label = this._escapeHtml(inp.label || inp.id);
          if (inp.type === 'feedrate') {
            const globalFr = window.EnderTrack?.State?.get?.()?.feedrate || 3000;
            const isVar = String(val).startsWith('$');
            const numVal = isVar ? globalFr : (parseInt(val) || 0);
            const useGlobal = !isVar && numVal === 0;
            const displayVal = useGlobal ? globalFr : numVal;
            const sliderId = `frs_mi_${inp.id}`.replace(/[^a-zA-Z0-9_]/g, '_');
            const inputId = `fr_mi_${inp.id}`.replace(/[^a-zA-Z0-9_]/g, '_');
            const dim = useGlobal ? 'opacity:0.4;' : '';
            const ocFr = `EnderTrack.ScenarioBuilder._updateMacroInput('${this.selectedPath}','${inp.id}',parseInt(this.value))`;
            if (isVar) {
              html += `<div class="sb-param">
                <label class="sb-param-label">${label}</label>
                <input type="text" value="${this._escapeAttr(val)}" placeholder="$mySpeed"
                  onchange="EnderTrack.ScenarioBuilder._updateMacroInput('${this.selectedPath}','${inp.id}',this.value)"
                  oninput="this.classList.toggle('sb-var',this.value.startsWith('$'))"
                  class="sb-input sb-var" style="font-family:monospace;">
                <button title="Reset" onmousedown="EnderTrack.ScenarioBuilder._updateMacroInput('${this.selectedPath}','${inp.id}',0); EnderTrack.ScenarioBuilder._refresh()" style="flex-shrink:0; border:none; background:none; color:#666; cursor:pointer; font-size:12px; padding:0 2px;">↺</button>
              </div>`;
            } else {
            html += `<div class="sb-param">
              <label class="sb-param-label">${label}</label>
              <input type="range" id="${sliderId}" min="100" max="10000" step="100" value="${displayVal}"
                oninput="document.getElementById('${inputId}').value=this.value;"
                onchange="${ocFr}"
                style="flex:1; height:4px; accent-color:var(--coordinates-color); min-width:0; ${dim}">
              <input type="number" id="${inputId}" value="${displayVal}" min="100" max="10000" step="100"
                oninput="document.getElementById('${sliderId}').value=this.value;"
                onchange="${ocFr}"
                style="width:48px; flex-shrink:0; padding:2px 3px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--coordinates-color); font-size:11px; text-align:center; font-family:monospace; height:22px; ${dim}">
              ${!useGlobal ? `<button title="Reset" onmousedown="EnderTrack.ScenarioBuilder._updateMacroInput('${this.selectedPath}','${inp.id}',0); EnderTrack.ScenarioBuilder._refresh()" style="flex-shrink:0; border:none; background:none; color:#666; cursor:pointer; font-size:12px; padding:0 2px;">↺</button>` : ''}
              <button title="Use variable" onmousedown="EnderTrack.ScenarioBuilder._updateMacroInput('${this.selectedPath}','${inp.id}','$'); EnderTrack.ScenarioBuilder._refresh()" style="flex-shrink:0; border:none; background:none; color:#666; cursor:pointer; font-size:11px; padding:0 2px;">$</button>
            </div>`;
            }
          } else if (inp.type === 'list-select') {
            const lists = EnderTrack.Lists?.manager?.getAllLists?.() || [];
            html += `<div class="sb-param"><label class="sb-param-label">${label}</label>
              <select onchange="${oc}" class="sb-input">
                ${lists.map(l => `<option value="${l.id}" ${String(val) === String(l.id) ? 'selected' : ''}>${l.name} (${l.positions?.length || 0})</option>`).join('')}
              </select></div>`;
          } else {
            html += `<div class="sb-param"><label class="sb-param-label">${label}</label>
              <input type="text" value="${this._escapeAttr(val)}" placeholder="${this._escapeAttr(String(inp.default ?? ''))}" onchange="${oc}" class="sb-input"></div>`;
          }
        });
        html += `</div>`;
      }
      html += `<label class="sb-param sb-param-check" style="margin-top:6px;">
        <input type="checkbox" ${node.showInLog ? 'checked' : ''} onchange="EnderTrack.ScenarioBuilder._setNodeProp('${this.selectedPath}','showInLog',this.checked)">
        Log
      </label>`;
      if (srcId) {
        html += `<div style="display:flex; gap:4px; margin-top:10px; padding-top:8px; border-top:1px solid #333;">
          <button onclick="EnderTrack.ScenarioBuilder._editMacroInConstructor('${srcId}')" class="sb-mini-btn" style="flex:1;">Edit function</button>
          <button onclick="if(confirm('Delete function from library?')){EnderTrack.MacroRegistry.delete('${srcId}'); EnderTrack.ScenarioBuilder._refreshPalette();}" class="sb-mini-btn sb-btn-danger">✕</button>
        </div>`;
      }
    }

    el.innerHTML = html;
  }

  // === FILE MENU ===

  _showFileMenu(event) {
    document.getElementById('sbFileMenu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'sbFileMenu';
    menu.className = 'sb-file-menu';
    menu.innerHTML = `
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._newScenario()">New</div>
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._importScenario()">Load (JSON)</div>
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._renameScenario()">Rename</div>
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._exportScenario()">💾 Sauvegarder (JSON)</div>
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._duplicateScenario()">📋 Copier</div>
      <div class="sb-menu-item" onclick="EnderTrack.ScenarioBuilder._collapseScenarioToFunction()">Create function</div>
      <div class="sb-menu-item sb-menu-danger" onclick="EnderTrack.ScenarioBuilder._deleteScenario()">Delete</div>
      <div class="sb-menu-item sb-menu-danger" onclick="EnderTrack.ScenarioBuilder._deleteAllScenarios()">💥 Tout supprimer</div>
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
    this._undoStack = [];
    this._redoStack = [];
    const _n = document.querySelector('.sb-header-name'); if (_n) _n.textContent = this.scenario.name;
    EnderTrack.VariableManager?.init?.(this.scenario);
    EnderTrack.Scenario?.updateCanvasOverlay?.();
    this._refreshPalette();
    this._refreshTree();
    this._refreshProperties();
    this._renderScenarioTabs();
    EnderTrack.Scenario?.createUI?.();
  }

  _newScenario() {
    document.getElementById('sbFileMenu')?.remove();
    document.getElementById('sbNewMenu')?.remove();
    EnderTrack.Scenario?.manager?.createScenario?.('New scenario');
    const s = EnderTrack.Scenario?.manager?.getCurrentScenario();
    if (s) { this._switchToScenario(s.id); this._editScenario(s.id); }
  }

  _renameScenario() {
    const name = prompt('Nouveau nom :', this.scenario.name);
    if (!name || name === this.scenario.name) return;
    this._renameTo(this.scenario.id, name);
  }

  _exportScenario() {
    this._exportById(this.scenario.id);
  }

  async _importScenario() {
    const s = await EnderTrack.Scenario?.manager?.importScenarioFromFile?.();
    if (s) this._switchToScenario(s.id);
  }

  _duplicateScenario() {
    const dup = EnderTrack.Scenario?.manager?.duplicateScenario?.(this.scenario.id);
    if (dup) this._switchToScenario(dup.id);
  }

  _deleteScenario() {
    this._deleteById(this.scenario.id);
  }


  _deleteAllScenarios() {
    document.getElementById('sbFileMenu')?.remove();
    if (!confirm('Delete ALL scenarios?')) return;
    const mgr = EnderTrack.Scenario?.manager;
    if (!mgr) return;
    const all = mgr.getAllScenarios();
    all.forEach(s => mgr.deleteScenario(s.id));
    const s = mgr.getCurrentScenario();
    if (s) this._switchToScenario(s.id);
  }

  _collapseScenarioToFunction() {
    document.getElementById('sbFileMenu')?.remove();
    const tree = this.scenario?.tree;
    if (!tree?.children?.length) { alert('Scenario is empty.'); return; }
    const name = prompt('Nom de la fonction :', this.scenario.name);
    if (!name) return;
    const children = EnderTrack.TreeUtils.clone(tree.children);
    const inputs = EnderTrack.TreeUtils.extractMacroInputs(children);
    const macro = {
      type: 'macro',
      macroId: 'macro_' + Date.now(),
      name,
      icon: '',
      collapsed: true,
      children,
      inputs,
      inputValues: {}
    };
    inputs.forEach(inp => { macro.inputValues[inp.id] = inp.default; });
    EnderTrack.MacroRegistry?.save(macro);
    this._editingMacroId = macro.macroId;
    this._refreshPalette();
    this._setView("vars");
  }

  _resetScenario() {
    document.getElementById('sbFileMenu')?.remove();
    if (!confirm('Reset scenario? Everything will be erased.')) return;
    EnderTrack.Scenario?.manager?.resetScenario?.(this.scenario.id);
    this.scenario = EnderTrack.Scenario?.manager?.getCurrentScenario();
    this.selectedPath = null;
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
