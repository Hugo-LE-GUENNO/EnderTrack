// plugins/automate-python/index.js
// Ajoute un onglet "Python" dans le ScenarioBuilder
// Permet de créer des blocs qui appellent des scripts .py côté serveur

(function () {

  // Script registry (stored in localStorage)
  const STORAGE_KEY = 'et_python_scripts';

  function getScripts() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  }
  function saveScripts(scripts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
  }
  function newScript() {
    return { id: 'py_' + Date.now(), name: 'mon_script', description: '', params: [] };
  }

  // Step handler: call server /api/python/run
  const handler = async (step, exec) => {
    exec._log(`🐍 ${step.scriptName}(${JSON.stringify(step.params || {})})`, 'info');
    const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    try {
      const res = await fetch(base + '/api/python/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: step.scriptName, params: step.params || {} })
      });
      const data = await res.json();
      if (data.success) exec._log(`✅ ${step.scriptName}: ${JSON.stringify(data.result)}`, 'info');
      else exec._log(`❌ ${step.scriptName}: ${data.error}`, 'error');
    } catch (e) {
      exec._log(`❌ ${step.scriptName}: ${e.message}`, 'error');
    }
  };

  // Tab UI
  function renderTab(scenario) {
    const scripts = getScripts();
    return `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; color:var(--text-selected); font-weight:600;">Scripts Python</span>
          <button onclick="window._pyPlugin.newScript()" class="sb-add-btn">+ Nouveau</button>
        </div>
        ${scripts.length === 0
          ? '<div style="color:#555; font-size:11px; padding:12px; text-align:center;">Aucun script. Créez-en un ou déposez un .py dans <code>scripts/</code> sur le serveur.</div>'
          : scripts.map(s => `
            <div style="background:var(--app-bg); border-radius:5px; padding:8px 10px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="font-size:16px;">🐍</span>
                <input type="text" value="${s.name}" onchange="window._pyPlugin.renameScript('${s.id}', this.value)"
                  style="flex:1; padding:3px 6px; background:var(--container-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:11px;">
                <button onclick="window._pyPlugin.addToSequence('${s.id}')" class="sb-btn-primary" style="font-size:10px; padding:3px 8px;">+ Séquence</button>
                <button onclick="window._pyPlugin.deleteScript('${s.id}')" style="border:none; background:transparent; color:#ef4444; cursor:pointer; font-size:12px;">✕</button>
              </div>
              <input type="text" value="${s.description || ''}" placeholder="Description..."
                onchange="window._pyPlugin.updateDesc('${s.id}', this.value)"
                style="width:100%; padding:2px 6px; background:var(--container-bg); border:1px solid #333; border-radius:3px; color:#888; font-size:10px; box-sizing:border-box;">
              <div style="margin-top:6px;">
                <div style="font-size:10px; color:#666; margin-bottom:3px;">Paramètres :</div>
                ${(s.params || []).map((p, i) => `
                  <div style="display:flex; gap:4px; margin-bottom:2px;">
                    <input type="text" value="${p.name}" placeholder="nom"
                      onchange="window._pyPlugin.updateParam('${s.id}', ${i}, 'name', this.value)"
                      style="width:80px; padding:2px 4px; background:var(--container-bg); border:1px solid #333; border-radius:3px; color:var(--coordinates-color); font-size:10px; font-family:monospace;">
                    <input type="text" value="${p.default ?? ''}" placeholder="défaut"
                      onchange="window._pyPlugin.updateParam('${s.id}', ${i}, 'default', this.value)"
                      style="flex:1; padding:2px 4px; background:var(--container-bg); border:1px solid #333; border-radius:3px; color:#888; font-size:10px;">
                    <button onclick="window._pyPlugin.removeParam('${s.id}', ${i})" style="border:none; background:transparent; color:#666; cursor:pointer;">✕</button>
                  </div>`).join('')}
                <button onclick="window._pyPlugin.addParam('${s.id}')" style="font-size:9px; padding:2px 6px; border:none; border-radius:3px; background:var(--container-bg); color:#888; cursor:pointer; margin-top:2px;">+ param</button>
              </div>
            </div>`).join('')}
      </div>`;
  }

  // Plugin actions (called from inline onclick)
  window._pyPlugin = {
    newScript() {
      const scripts = getScripts();
      scripts.push(newScript());
      saveScripts(scripts);
      window.EnderTrack.ScenarioBuilder._renderTab('python', window.EnderTrack.ScenarioManager.getCurrent());
    },
    deleteScript(id) {
      if (!confirm('Supprimer ce script ?')) return;
      saveScripts(getScripts().filter(s => s.id !== id));
      window.EnderTrack.ScenarioBuilder._renderTab('python', window.EnderTrack.ScenarioManager.getCurrent());
    },
    renameScript(id, name) {
      const scripts = getScripts();
      const s = scripts.find(s => s.id === id);
      if (s) { s.name = name; saveScripts(scripts); }
      // Also update step defs
      _refreshStepDefs();
    },
    updateDesc(id, desc) {
      const scripts = getScripts();
      const s = scripts.find(s => s.id === id);
      if (s) { s.description = desc; saveScripts(scripts); }
    },
    addParam(id) {
      const scripts = getScripts();
      const s = scripts.find(s => s.id === id);
      if (s) { s.params.push({ name: 'param', default: '' }); saveScripts(scripts); }
      window.EnderTrack.ScenarioBuilder._renderTab('python', window.EnderTrack.ScenarioManager.getCurrent());
    },
    removeParam(id, idx) {
      const scripts = getScripts();
      const s = scripts.find(s => s.id === id);
      if (s) { s.params.splice(idx, 1); saveScripts(scripts); }
      window.EnderTrack.ScenarioBuilder._renderTab('python', window.EnderTrack.ScenarioManager.getCurrent());
    },
    updateParam(id, idx, key, val) {
      const scripts = getScripts();
      const s = scripts.find(s => s.id === id);
      if (s?.params?.[idx]) { s.params[idx][key] = val; saveScripts(scripts); }
    },
    addToSequence(id) {
      const s = getScripts().find(s => s.id === id);
      if (!s) return;
      const params = {};
      s.params.forEach(p => { params[p.name] = p.default ?? ''; });
      const mgr = window.EnderTrack.ScenarioManager;
      const scenario = mgr.getCurrent();
      scenario.steps.push({ type: 'python', scriptId: id, scriptName: s.name, params });
      mgr.save();
      // Switch to sequence tab to show it
      document.querySelector('.sb-tab[data-tab="sequence"]')?.click();
    }
  };

  function _refreshStepDefs() {
    const scripts = getScripts();
    window.EnderTrack.ScenarioStepDefs = (window.EnderTrack.ScenarioStepDefs || [])
      .filter(d => d.type !== 'python');
    // One generic 'python' type handles all scripts via scriptId
  }

  const register = () => {
    window.EnderTrack = window.EnderTrack || {};
    window.EnderTrack.ScenarioStepDefs = window.EnderTrack.ScenarioStepDefs || [];
    window.EnderTrack.ScenarioStepHandlers = window.EnderTrack.ScenarioStepHandlers || {};
    window.EnderTrack.ScenarioStepHandlers['python'] = handler;

    // Step def for display in sequence
    window.EnderTrack.ScenarioStepDefs.push({
      type: 'python',
      icon: '🐍',
      label: 'Script Python',
      summary: (s) => `🐍 ${s.scriptName || '?'}(${Object.entries(s.params || {}).map(([k,v]) => `${k}=${v}`).join(', ')})`,
      fields: (s) => {
        const params = s.params || {};
        return Object.entries(params).map(([k, v]) => `
          <label>${k} <input type="text" name="param_${k}" value="${v}"></label>`).join('');
      },
      onSave: (step, editor) => {
        editor.querySelectorAll('[name^="param_"]').forEach(input => {
          const key = input.name.replace('param_', '');
          step.params[key] = input.value;
        });
      }
    });

    window.EnderTrack.ScenarioBuilder?.registerTab({
      id: 'python',
      label: '🐍 Python',
      render: renderTab
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register);
  else setTimeout(register, 0);
})();
