// plugins/scenario-builder/src/core/script-registry.js — Python Script Registry

class ScriptRegistry {
  constructor() {
    this.scripts = new Map();
    this.loadFromStorage();
  }

  create(name = 'Nouveau script') {
    const id = 'script_' + Date.now();
    const script = {
      id,
      name,
      description: '',
      code: `# ${name}\nimport json, sys\n\n# Lire les entrées\ndata = json.loads(sys.stdin.read())\n\n# Traitement\nresult = {}\n\n# Retourner les sorties\nprint(json.dumps(result))`,
      inputs: [],
      outputs: [],
      createdAt: new Date().toISOString()
    };
    this.scripts.set(id, script);
    this.persist();
    return script;
  }

  get(id) { return this.scripts.get(id) || null; }
  getAll() { return Array.from(this.scripts.values()); }

  update(id, updates) {
    const s = this.scripts.get(id);
    if (!s) return false;
    Object.assign(s, updates);
    this.persist();
    return true;
  }

  delete(id) {
    const ok = this.scripts.delete(id);
    if (ok) this.persist();
    return ok;
  }

  addInput(scriptId, input) {
    const s = this.scripts.get(scriptId);
    if (!s) return;
    s.inputs.push({
      name: input.name || 'param',
      type: input.type || 'number',
      default: input.default ?? 0,
      description: input.description || ''
    });
    this.persist();
  }

  removeInput(scriptId, idx) {
    const s = this.scripts.get(scriptId);
    if (s?.inputs) { s.inputs.splice(idx, 1); this.persist(); }
  }

  addOutput(scriptId, output) {
    const s = this.scripts.get(scriptId);
    if (!s) return;
    s.outputs.push({
      name: output.name || 'result',
      type: output.type || 'number',
      description: output.description || ''
    });
    this.persist();
  }

  removeOutput(scriptId, idx) {
    const s = this.scripts.get(scriptId);
    if (s?.outputs) { s.outputs.splice(idx, 1); this.persist(); }
  }

  exportToFile(id) {
    const s = this.get(id);
    if (!s) return;
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `script-${s.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async importFromFile() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.py';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return resolve(null);
        try {
          const text = await file.text();
          if (file.name.endsWith('.py')) {
            const s = this.create(file.name.replace('.py', ''));
            s.code = text;
            this.persist();
            resolve(s);
          } else {
            const data = JSON.parse(text);
            data.id = 'script_' + Date.now();
            this.scripts.set(data.id, data);
            this.persist();
            resolve(data);
          }
        } catch { resolve(null); }
      };
      input.click();
    });
  }

  persist() {
    try {
      localStorage.setItem('endertrack_scripts', JSON.stringify(Array.from(this.scripts.entries())));
    } catch {}
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem('endertrack_scripts');
      if (raw) this.scripts = new Map(JSON.parse(raw));
    } catch {}
  }

  async syncFromServer() {
    const es = window.EnderTrack?.Enderscope;
    const baseUrl = es?.serverUrl || 'http://127.0.0.1:5000';
    try {
      const resp = await fetch(baseUrl + '/api/macro/list', { signal: AbortSignal.timeout(5000) });
      const data = await resp.json();
      if (!data.success) return { added: 0, error: data.error };
      let added = 0;
      for (const s of data.scripts) {
        const existing = this.getAll().find(sc => sc.name === s.name);
        if (existing) {
          existing.description = s.description || existing.description;
          existing.inputs = s.inputs.length ? s.inputs : existing.inputs;
          existing.outputs = s.outputs.length ? s.outputs : existing.outputs;
          if (s.code) existing.code = s.code;
        } else {
          const id = 'script_' + Date.now() + '_' + added;
          this.scripts.set(id, {
            id, name: s.name,
            description: s.description || '',
            code: s.code || '',
            inputs: s.inputs || [],
            outputs: s.outputs || [],
            createdAt: new Date().toISOString()
          });
          added++;
        }
      }
      this.persist();
      return { added, total: data.scripts.length };
    } catch (e) {
      return { added: 0, error: e.message };
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ScriptRegistry = new ScriptRegistry();
