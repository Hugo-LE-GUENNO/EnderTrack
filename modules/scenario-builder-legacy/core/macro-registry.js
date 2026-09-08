// plugins/scenario-builder/src/core/macro-registry.js — Macro storage & sharing

class MacroRegistry {
  constructor() {
    this.macros = new Map();
    this.loadFromStorage();
  }

  save(macro) {
    if (!macro?.macroId) return false;
    const entry = {
      macroId: macro.macroId,
      name: macro.name || 'Macro',
      icon: macro.icon || '📦',
      description: macro.description || '',
      children: JSON.parse(JSON.stringify(macro.children || [])),
      inputs: JSON.parse(JSON.stringify(macro.inputs || [])),
      createdAt: macro.createdAt || new Date().toISOString()
    };
    this.macros.set(entry.macroId, entry);
    this.persist();
    return true;
  }

  get(macroId) { return this.macros.get(macroId) || null; }

  getAll() { return Array.from(this.macros.values()); }

  delete(macroId) {
    const ok = this.macros.delete(macroId);
    if (ok) this.persist();
    return ok;
  }

  rename(macroId, name, icon) {
    const m = this.macros.get(macroId);
    if (!m) return false;
    if (name) m.name = name;
    if (icon) m.icon = icon;
    this.persist();
    return true;
  }

  // Create a tree node from a saved macro
  instantiate(macroId) {
    const m = this.get(macroId);
    if (!m) return null;
    const inputs = JSON.parse(JSON.stringify(m.inputs || []));
    const inputValues = {};
    inputs.forEach(inp => { inputValues[inp.id] = inp.default; });
    return {
      type: 'macro',
      macroId: 'macro_' + Date.now(),
      sourceMacroId: m.macroId,
      name: m.name,
      icon: m.icon,
      collapsed: true,
      children: JSON.parse(JSON.stringify(m.children)),
      inputs,
      inputValues
    };
  }

  // Export macro as JSON string
  exportJSON(macroId) {
    const m = this.get(macroId);
    if (!m) return null;
    return JSON.stringify(m, null, 2);
  }

  // Import macro from JSON string
  importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.name || !data.children) throw new Error('Invalid macro format');
      data.macroId = data.macroId || 'macro_' + Date.now();
      this.save(data);
      return data;
    } catch (e) {
      console.error('[MacroRegistry] Import error:', e);
      return null;
    }
  }

  // Import from file picker
  async importFromFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return resolve(null);
        try {
          const text = await file.text();
          resolve(this.importJSON(text));
        } catch { resolve(null); }
      };
      input.click();
    });
  }

  // Export to file download
  exportToFile(macroId) {
    const json = this.exportJSON(macroId);
    if (!json) return;
    const m = this.get(macroId);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `macro-${(m.name || 'macro').toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  persist() {
    try {
      localStorage.setItem('endertrack_macros', JSON.stringify(Array.from(this.macros.entries())));
    } catch (e) { console.error('[MacroRegistry] Save error:', e); }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem('endertrack_macros');
      if (raw) this.macros = new Map(JSON.parse(raw));
    } catch { /* fresh start */ }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.MacroRegistry = new MacroRegistry();
