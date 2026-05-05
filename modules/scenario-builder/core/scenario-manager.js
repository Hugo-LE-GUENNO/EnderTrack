// modules/scenario/scenario-manager.js - Scenario Manager
class ScenarioManager {
  constructor() {
    this.scenarios = new Map();
    this.currentScenarioId = null;
    this.loadFromStorage();
  }

  createScenario(name = 'Nouveau scénario') {
    const id = 'scenario_' + Date.now();
    const scenario = {
      id,
      name,
      color: this.generateColor(),
      description: '',
      tree: { type: 'root', children: [] }, // Structure arborescente
      createdAt: new Date().toISOString()
    };
    
    this.scenarios.set(id, scenario);
    this.currentScenarioId = id;
    this.save();
    return scenario;
  }

  getScenario(id) {
    return this.scenarios.get(id);
  }

  getCurrentScenario() {
    return this.scenarios.get(this.currentScenarioId);
  }

  setCurrentScenario(id) {
    if (this.scenarios.has(id)) {
      this.currentScenarioId = id;
      return true;
    }
    return false;
  }

  updateScenario(id, updates) {
    const scenario = this.scenarios.get(id);
    if (scenario) {
      Object.assign(scenario, updates);
      this.save();
      return true;
    }
    return false;
  }

  deleteScenario(id) {
    if (this.scenarios.size <= 1) return false;
    
    const deleted = this.scenarios.delete(id);
    if (deleted && this.currentScenarioId === id) {
      this.currentScenarioId = this.scenarios.keys().next().value;
    }
    this.save();
    return deleted;
  }

  resetScenario(id) {
    const s = this.scenarios.get(id);
    if (!s) return false;
    s.tree = { type: 'root', children: [] };
    s.watchers = [];
    s.customVariables = [];
    this.save();
    return true;
  }

  duplicateScenario(id) {
    const src = this.scenarios.get(id);
    if (!src) return null;
    const dup = JSON.parse(JSON.stringify(src));
    dup.id = 'scenario_' + Date.now();
    dup.name = src.name + ' (copie)';
    dup.createdAt = new Date().toISOString();
    this.scenarios.set(dup.id, dup);
    this.currentScenarioId = dup.id;
    this.save();
    return dup;
  }

  exportScenarioJSON(id) {
    const s = this.scenarios.get(id);
    if (!s) return null;
    return JSON.stringify(s, null, 2);
  }

  exportScenarioToFile(id) {
    const json = this.exportScenarioJSON(id);
    if (!json) return;
    const s = this.scenarios.get(id);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scenario-${(s.name || 'scenario').toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  importScenarioJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.tree) throw new Error('Invalid scenario format');
      data.id = 'scenario_' + Date.now();
      data.name = data.name || 'Scénario importé';
      data.createdAt = new Date().toISOString();
      this.scenarios.set(data.id, data);
      this.currentScenarioId = data.id;
      this.save();
      return data;
    } catch (e) {
      console.error('[ScenarioManager] Import error:', e);
      return null;
    }
  }

  async importScenarioFromFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return resolve(null);
        try {
          const text = await file.text();
          resolve(this.importScenarioJSON(text));
        } catch { resolve(null); }
      };
      input.click();
    });
  }

  getAllScenarios() {
    return Array.from(this.scenarios.values());
  }

  getAdjacentScenarioId(direction) {
    const ids = Array.from(this.scenarios.keys());
    const idx = ids.indexOf(this.currentScenarioId);
    if (idx === -1) return null;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= ids.length) return null;
    return ids[newIdx];
  }

  generateColor() {
    const colors = ['#4f9eff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  save() {
    try {
      const data = {
        scenarios: Array.from(this.scenarios.entries()),
        currentScenarioId: this.currentScenarioId
      };
      localStorage.setItem('endertrack_scenarios', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save scenarios:', error);
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('endertrack_scenarios');
      if (stored) {
        const data = JSON.parse(stored);
        this.scenarios = new Map(data.scenarios);
        this.currentScenarioId = data.currentScenarioId;
      }
      
      // Créer un scénario par défaut si aucun n'existe
      if (this.scenarios.size === 0) {
        this.createScenario('Scénario 1');
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error);
      this.createScenario('Scénario 1');
    }
  }

  clear() {
    this.scenarios.clear();
    this.createScenario('Scénario 1');
    this.save();
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ScenarioManager = ScenarioManager;
