// modules/scenario/variable-manager.js - Variable Management System
class VariableManager {
  constructor() {
    this.systemVariables = [
      // Position
      { id: '$x', name: 'Position X', description: 'Position actuelle en X (mm)', category: 'position' },
      { id: '$y', name: 'Position Y', description: 'Position actuelle en Y (mm)', category: 'position' },
      { id: '$z', name: 'Position Z', description: 'Position actuelle en Z (mm)', category: 'position' },
      // Temps
      { id: '$time', name: 'Temps scénario', description: 'Temps depuis le début du scénario (s)', category: 'time' },
      { id: '$iteration', name: 'Itération', description: 'Index de boucle courant', category: 'time' },
      { id: '$feedrate', name: 'Vitesse', description: 'Vitesse de déplacement (mm/min)', category: 'time' }
    ];
    
    this.variableCategories = [
      { id: 'position', label: '📍 Position', icon: '📍' },
      { id: 'time', label: '⏱️ Temps & Exécution', icon: '⏱️' },
      { id: 'plugin', label: '🔌 Plugins', icon: '🔌' }
    ];
    
    this.customVariables = [];
    this.globalVariables = this._loadGlobalVariables();
  }
  
  init(scenario) {
    this.scenario = scenario;
    this.customVariables = scenario.customVariables || [];
    this.updateLoopVariables();
    this._discoverPluginVariables();
  }

  _discoverPluginVariables() {
    // Remove old plugin variables
    this.systemVariables = this.systemVariables.filter(v => v.category !== 'plugin');
    const pm = window.EnderTrack?.PluginManager?.plugins;
    if (!pm) return;
    pm.forEach((plugin) => {
      if (!plugin.isActive || !plugin.bridge?.scenarioVariables) return;
      for (const v of plugin.bridge.scenarioVariables) {
        if (!this.systemVariables.find(sv => sv.id === v.id)) {
          this.systemVariables.push({ ...v, category: 'plugin' });
        }
      }
    });
  }

  _loadGlobalVariables() {
    try {
      const raw = localStorage.getItem('endertrack_global_variables');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _saveGlobalVariables() {
    try { localStorage.setItem('endertrack_global_variables', JSON.stringify(this.globalVariables)); }
    catch {}
  }

  addGlobalVariable(variable) {
    if (!variable.id?.startsWith('$')) variable.id = '$' + (variable.id || 'gvar');
    if (this.globalVariables.find(v => v.id === variable.id)) return;
    this.globalVariables.push({ id: variable.id, name: variable.id, formula: variable.formula || '0' });
    this._saveGlobalVariables();
  }

  updateGlobalVariable(id, updates) {
    const v = this.globalVariables.find(v => v.id === id);
    if (v) { Object.assign(v, updates); this._saveGlobalVariables(); }
  }

  removeGlobalVariable(id) {
    this.globalVariables = this.globalVariables.filter(v => v.id !== id);
    this._saveGlobalVariables();
  }

  renameGlobalVariable(oldId, newId) {
    if (!newId.startsWith('$')) newId = '$' + newId;
    if (oldId === newId) return;
    if (this.globalVariables.find(v => v.id === newId) || this.systemVariables.find(v => v.id === newId)) return;
    const v = this.globalVariables.find(v => v.id === oldId);
    if (v) { v.id = newId; v.name = newId; this._saveGlobalVariables(); }
  }
  
  updateLoopVariables() {
    // Supprimer les anciennes variables de boucle
    this.systemVariables = this.systemVariables.filter(v => !v.isLoopVar);
    
    if (!this.scenario?.tree) return;
    
    // Extraire toutes les boucles
    const loops = this.extractLoops(this.scenario.tree);
    
    // Créer une variable pour chaque boucle
    loops.forEach((loop, index) => {
      const varName = loop.params?.loopVar || this.getDefaultLoopVar(index);
      const loopLabel = loop.params?.label || `Boucle ${index + 1}`;
      
      this.systemVariables.push({
        id: varName,
        name: `Index ${loopLabel}`,
        description: `Index de la boucle "${loopLabel}"`,
        category: 'loop',
        isLoopVar: true
      });
    });
  }
  
  extractLoops(node, loops = []) {
    if (!node) return loops;
    
    if (node.type === 'loop') loops.push(node);
    
    if (node.children) node.children.forEach(child => this.extractLoops(child, loops));
    if (node.then) node.then.forEach(child => this.extractLoops(child, loops));
    if (node.else) node.else.forEach(child => this.extractLoops(child, loops));
    if (node.branches) {
      node.branches.forEach(branch => {
        if (branch.actions) branch.actions.forEach(a => this.extractLoops(a, loops));
      });
    }
    
    return loops;
  }
  
  getDefaultLoopVar(index) {
    const letters = ['$i', '$j', '$k', '$l', '$m', '$n'];
    return letters[index] || `$loop${index + 1}`;
  }
  
  saveToScenario() {
    if (this.scenario) {
      this.scenario.customVariables = this.customVariables;
    }
  }
  
  addCustomVariable(variable) {
    if (!variable.id || !variable.id.startsWith('$')) {
      variable.id = '$' + (variable.id || 'var');
    }
    
    if (this.systemVariables.find(v => v.id === variable.id)) {
      throw new Error('Cette variable système existe déjà');
    }
    if (this.customVariables.find(v => v.id === variable.id)) {
      throw new Error('Cette variable personnalisée existe déjà');
    }
    
    this.customVariables.push({
      id: variable.id,
      name: variable.name || variable.id,
      description: variable.description || '',
      type: variable.type || 'number',
      formula: variable.formula || '',
      readonly: false
    });
    this.saveToScenario();
  }
  
  removeCustomVariable(id) {
    const index = this.customVariables.findIndex(v => v.id === id);
    if (index !== -1) {
      this.customVariables.splice(index, 1);
      this.saveToScenario();
    }
  }
  
  updateCustomVariable(id, updates) {
    const variable = this.customVariables.find(v => v.id === id);
    if (variable) {
      Object.assign(variable, updates);
      this.saveToScenario();
    }
  }
  
  getAllVariables() {
    return [...this.systemVariables, ...this.customVariables];
  }
  
  getVariablesList() {
    return this.getAllVariables().map(v => v.id);
  }
  
  getVariablesOptionsHTML() {
    return this.getAllVariables().map(v => 
      `<option value="${v.id}">${v.id} - ${v.name}</option>`
    ).join('');
  }
  
  getVariablesHelperHTML() {
    const vars = this.getAllVariables();
    if (vars.length === 0) return '';
    
    return `
      <div style="font-size: 10px; color: var(--text-general); margin-top: 4px; padding: 6px; background: rgba(255,193,7,0.1); border-radius: 3px;">
        <div style="font-weight: 600; margin-bottom: 2px;">📊 Variables disponibles:</div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
          ${vars.map(v => `<code style="background: var(--app-bg); padding: 2px 4px; border-radius: 2px; cursor: help;" title="${v.description || v.name}">${v.id}</code>`).join('')}
        </div>
      </div>
    `;
  }
  
  getCustomVariables() {
    return this.customVariables;
  }
  
  getContext() {
    const state = window.EnderTrack?.State?.get();
    const pos = state?.pos || { x: 0, y: 0, z: 0 };
    const executor = window.EnderTrack?.Scenario?.executor;
    
    const context = {
      $x: pos.x,
      $y: pos.y,
      $z: pos.z,
      $time: executor?.getElapsedTime?.() || 0,
      $feedrate: state?.feedrate || 3000,
      $iteration: executor?.currentLoopIndex || 0
    };
    
    // Plugin variables (dynamic)
    const pm = window.EnderTrack?.PluginManager?.plugins;
    if (pm) {
      pm.forEach((plugin) => {
        if (!plugin.isActive || !plugin.bridge?.scenarioVariables) return;
        for (const v of plugin.bridge.scenarioVariables) {
          if (v.getValue) context[v.id] = v.getValue();
        }
      });
    }
    
    // Loop variables from executor
    if (executor?.context?.variables) {
      for (const [key, val] of Object.entries(executor.context.variables)) {
        if (key.startsWith('$')) context[key] = val;
      }
    }
    
    return context;
  }
  
  getAllValues() {
    const context = this.getContext();
    const globalValues = this._evaluateVarList(this.globalVariables, context);
    const customValues = this._evaluateVarList(this.customVariables, { ...context, ...globalValues });
    return { ...context, ...globalValues, ...customValues };
  }

  _evaluateVarList(vars, context) {
    const values = {};
    const keys = Object.keys(context).sort((a, b) => b.length - a.length);
    for (const v of vars) {
      if (v.formula) {
        try {
          let expr = v.formula;
          for (const key of keys) {
            expr = expr.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), context[key]);
          }
          values[v.id] = Function('"use strict"; return (' + expr + ')')();
        } catch { values[v.id] = '\u26a0\ufe0f'; }
      } else {
        values[v.id] = 0;
      }
    }
    return values;
  }
  
  getVariablesHTML() {
    const values = this.getAllValues();

    return `
      <div style="padding:10px; height:100%; overflow-y:auto;">
        <div style="font-size:12px; color:var(--text-selected); font-weight:600; margin-bottom:8px;">Variables du scénario</div>
        ${this._getLoopVariablesHTML(values)}
        <div style="display:flex; justify-content:space-between; align-items:center; margin:12px 0 4px;">
          <span style="font-size:10px; color:var(--text-general); font-weight:600;">✏️ Personnalisées</span>
          <button onclick="window.EnderTrack.VariableManager.addInline()" style="padding:2px 8px; background:var(--active-element); border:none; border-radius:3px; color:var(--text-selected); cursor:pointer; font-size:10px;">+</button>
        </div>
        <div id="custom-variables-container">
          ${this.getCustomVariablesRows()}
        </div>
        <div style="margin-top:16px; font-size:9px; color:var(--text-general); opacity:0.4;">Variables système et globales dans 🎩 Accessoires > Variables globales</div>
      </div>
    `;
  }
  
  getSystemVariablesGrid() {
    const values = this.getContext();
    return this.variableCategories.map(cat => {
      const vars = this.systemVariables.filter(v => v.category === cat.id);
      if (vars.length === 0) return '';
      return `
        <div style="margin-bottom:12px;">
          <div style="font-size:10px; color:var(--text-general); margin-bottom:4px; font-weight:600;">${cat.label}</div>
          ${vars.map(v => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:2px 6px;" title="${v.description}">
              <div>
                <span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">${v.id}</span>
                <span style="font-size:9px; color:var(--text-general); margin-left:6px;">${v.name}</span>
              </div>
              <span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">${this.formatValue(values[v.id])}</span>
            </div>
          `).join('')}
        </div>`;
    }).join('');
  }
  
  getCustomVariablesRows() {
    const allValues = this.getAllValues();
    if (this.customVariables.length === 0) {
      return '<div style="font-size:10px; color:var(--text-general); opacity:0.4; padding:8px; text-align:center;">Aucune variable</div>';
    }
    return this.customVariables.map((v, index) => {
      const val = this.formatValue(allValues[v.id]);
      return `<div style="display:flex; align-items:center; gap:4px; padding:3px 0; border-bottom:1px solid var(--border);">
        <span style="color:var(--text-general); font-size:10px;">$</span>
        <input type="text" value="${v.id.replace('$', '')}" 
          onchange="window.EnderTrack.VariableManager._renameVariable('${v.id}', '$' + this.value)"
          style="width:55px; padding:2px 3px; background:var(--app-bg); border:1px solid var(--border); border-radius:3px; color:var(--coordinates-color); font-family:monospace; font-size:10px; box-sizing:border-box;">
        <span style="color:var(--text-general); font-size:10px;">=</span>
        <input type="text" value="${v.formula || ''}" placeholder="0"
          onchange="window.EnderTrack.VariableManager.updateCustomVariable('${v.id}', {formula: this.value}); window.EnderTrack.VariableManager.refreshVariablesPanel();"
          style="flex:1; padding:2px 3px; background:var(--app-bg); border:1px solid var(--border); border-radius:3px; color:var(--coordinates-color); font-family:monospace; font-size:10px; box-sizing:border-box;">
        <span style="min-width:45px; text-align:right; font-size:10px; color:var(--text-general); font-family:monospace;">${val}</span>
        <button onclick="window.EnderTrack.VariableManager.deleteVariable('${v.id}')" style="padding:1px 4px; background:transparent; border:1px solid var(--border); border-radius:3px; color:var(--text-general); cursor:pointer; font-size:9px;">✕</button>
      </div>`;
    }).join('');
  }
  
  formatValue(value) {
    if (value === undefined || value === null) return '-';
    if (value === '⚠️') return '⚠️';
    if (typeof value === 'number') return value.toFixed(2);
    return String(value);
  }

  _getLoopVariablesHTML(values) {
    const loopVars = this.systemVariables.filter(v => v.category === 'loop');
    if (loopVars.length === 0) return '';
    return `
      <div style="margin-bottom:12px;">
        <div style="font-size:10px; color:var(--text-general); margin-bottom:4px; font-weight:600;">🔁 Flux (boucles)</div>
        ${loopVars.map(v => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:2px 6px;" title="${v.description}">
            <div>
              <span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">${v.id}</span>
              <span style="font-size:9px; color:var(--text-general); margin-left:6px;">${v.name}</span>
            </div>
            <span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">${this.formatValue(values[v.id])}</span>
          </div>
        `).join('')}
      </div>`;
  }

  _getListsHTML() {
    const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
    return `
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; color:var(--text-selected); font-weight:600; margin-bottom:8px;">📋 Listes</div>
        ${lists.length === 0
          ? '<div style="font-size:10px; color:var(--text-general); opacity:0.4; padding:8px;">Aucune liste</div>'
          : lists.map(list => {
            const count = list.positions?.length || 0;
            return `<div style="background:var(--app-bg); border-radius:4px; padding:8px; margin-bottom:4px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                <span style="font-size:11px; color:var(--text-selected); font-weight:500;">
                  <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${list.color || '#4f9eff'}; margin-right:6px;"></span>
                  ${list.name}
                </span>
                <span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">${count} pos</span>
              </div>
              <div style="font-size:9px; color:var(--coordinates-color); opacity:0.5; margin-bottom:4px; font-family:monospace;">${list.name}[$i]</div>
              ${count > 0 ? `<div style="max-height:80px; overflow-y:auto; font-size:9px; color:var(--text-general); font-family:monospace;">
                ${list.positions.slice(0, 10).map((p, i) => 
                  `<div style="padding:1px 0;">#${i} (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})</div>`
                ).join('')}${count > 10 ? `<div style="opacity:0.5;">... +${count - 10}</div>` : ''}
              </div>` : ''}
            </div>`;
          }).join('')}
      </div>`;
  }

  _getStrategicPositionsHTML() {
    const state = window.EnderTrack?.State?.get?.() || {};
    const homeXY = state.homePositions?.xy || { x: 0, y: 0 };
    const homeXYZ = state.homePositions?.xyz || { x: 0, y: 0, z: 0 };
    return `
      <div>
        <div style="font-size:12px; color:var(--text-selected); font-weight:600; margin-bottom:8px;">🚩 Positions stratégiques</div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; padding:4px 6px; background:var(--app-bg); border-radius:4px;">
            <span style="font-size:10px; color:var(--text-general);">🏠 HOME XY</span>
            <span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">(${homeXY.x.toFixed(1)}, ${homeXY.y.toFixed(1)})</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:4px 6px; background:var(--app-bg); border-radius:4px;">
            <span style="font-size:10px; color:var(--text-general);">🏠 HOME XYZ</span>
            <span style="font-size:10px; color:var(--coordinates-color); font-family:monospace;">(${homeXYZ.x.toFixed(1)}, ${homeXYZ.y.toFixed(1)}, ${homeXYZ.z.toFixed(1)})</span>
          </div>
        </div>
      </div>`;
  }
  
  refreshValues() {
    const sysGrid = document.getElementById('system-variables-grid');
    if (sysGrid) sysGrid.innerHTML = this.getSystemVariablesGrid();
    const customContainer = document.getElementById('custom-variables-container');
    if (customContainer) customContainer.innerHTML = this.getCustomVariablesRows();
  }

  _renameVariable(oldId, newId) {
    newId = newId.trim();
    if (!newId.startsWith('$')) newId = '$' + newId;
    if (newId === oldId) return;
    if (this.systemVariables.find(v => v.id === newId) || this.customVariables.find(v => v.id === newId)) {
      alert('Ce nom existe déjà');
      this.refreshVariablesPanel();
      return;
    }
    const v = this.customVariables.find(v => v.id === oldId);
    if (v) { v.id = newId; v.name = newId; this.saveToScenario(); this.refreshVariablesPanel(); }
  }
  
  addVariableModal() { this.addInline(); }

  addInline() {
    let idx = this.customVariables.length + 1;
    let id = '$var' + idx;
    while (this.customVariables.find(v => v.id === id)) { idx++; id = '$var' + idx; }
    this.addCustomVariable({ id, name: id, description: '', formula: '0', type: 'number' });
    this.refreshVariablesPanel();
  }
  
  editVariable(id) { /* inline now */ }
  saveEditVariable(id) { /* inline now */ }
  
  deleteVariable(id) {
    if (confirm(`Supprimer la variable ${id} ?`)) {
      this.removeCustomVariable(id);
      this.refreshVariablesPanel();
    }
  }
  
  moveVariable(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.customVariables.length) return;
    
    [this.customVariables[index], this.customVariables[newIndex]] = 
    [this.customVariables[newIndex], this.customVariables[index]];
    
    this.saveToScenario();
    this.refreshVariablesPanel();
  }
  
  refreshVariablesPanel() {
    this.updateLoopVariables();
    // Try dedicated panel first, then builder vars view
    const container = document.getElementById('variables-panel');
    if (container) {
      container.innerHTML = this.getVariablesHTML();
      return;
    }
    // If in builder vars view, re-render
    if (window.EnderTrack?.ScenarioBuilder?._viewMode === 'vars') {
      const el = document.getElementById('sbVarsView');
      if (el) {
        window.EnderTrack.ScenarioBuilder._renderVarsView();
      }
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.VariableManager = new VariableManager();
