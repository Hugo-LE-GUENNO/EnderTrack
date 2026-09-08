// scenario-manager.js — Save/load scenarios (localStorage + server)

class ScenarioManager {
  constructor() {
    this._scenarios = [];
    this._currentId = null;
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem('et_scenarios_v2');
      if (raw) {
        const data = JSON.parse(raw);
        this._scenarios = data.scenarios || [];
        this._currentId = data.currentId || null;
      }
    } catch {}
    if (!this._scenarios.length) this._scenarios = [this._blank('Mon scénario')];
    if (!this._currentId) this._currentId = this._scenarios[0].id;
  }

  _blank(name) {
    return { id: 'sc_' + Date.now(), name, steps: [] };
  }

  save() {
    localStorage.setItem('et_scenarios_v2', JSON.stringify({
      scenarios: this._scenarios,
      currentId: this._currentId
    }));
  }

  getAll() { return this._scenarios; }
  getCurrent() { return this._scenarios.find(s => s.id === this._currentId) || this._scenarios[0]; }

  setCurrent(id) {
    this._currentId = id;
    this.save();
  }

  create(name = 'Nouveau') {
    const s = this._blank(name);
    this._scenarios.push(s);
    this._currentId = s.id;
    this.save();
    return s;
  }

  delete(id) {
    if (this._scenarios.length <= 1) return;
    this._scenarios = this._scenarios.filter(s => s.id !== id);
    if (this._currentId === id) this._currentId = this._scenarios[0].id;
    this.save();
  }

  duplicate(id) {
    const src = this._scenarios.find(s => s.id === id);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = 'sc_' + Date.now();
    copy.name = src.name + ' (copie)';
    this._scenarios.push(copy);
    this._currentId = copy.id;
    this.save();
    return copy;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ScenarioManager = new ScenarioManager();
