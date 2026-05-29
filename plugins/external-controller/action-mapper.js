// plugins/pilote-moi-plus/action-mapper.js
// Manages gamepad button → action mapping with persistence

class ActionMapper {
  constructor() {
    this._storageKey = 'piloteMoiPlus_mapping';
    // Available actions
    this.actions = {
      home_xy:      { label: '🏠 Home XY',       fn: () => window.goHome?.('xy') },
      home_xyz:     { label: '🏠 Home XYZ',      fn: () => window.goHome?.('xyz') },
      stop:         { label: '🛑 Arrêt urgence', fn: () => window.EnderTrack?.App?.emergencyStop?.() },
      add_pos:      { label: '➕ Ajouter pos.',  fn: () => window.EnderTrack?.Lists?.addCurrentPosition?.() },
      toggle_mode:  { label: '⚡ Step/Continu',  fn: () => {
        const b = window.PiloteMoiPlusPlugin?.bridge;
        if (b) window.PiloteMoiPlusPlugin?.ui?.setMode(b.mode === 'step' ? 'continuous' : 'step');
      }},
      preset_fine:  { label: '🎯 Preset Fine',   fn: () => window.PiloteMoiPlusPlugin?.ui?.setStepPreset('fine') },
      preset_coarse:{ label: '🔧 Preset Coarse', fn: () => window.PiloteMoiPlusPlugin?.ui?.setStepPreset('coarse') },
      toggle_preset:{ label: '⚡ Fine/Coarse',   fn: () => {
        const ui = window.PiloteMoiPlusPlugin?.ui;
        if (ui) ui.setStepPreset(ui._activeStepPreset === 'fine' ? 'coarse' : 'fine');
      }},
      toggle_speed: { label: '🚀 Slow/Fast',     fn: () => {
        const ui = window.PiloteMoiPlusPlugin?.ui;
        if (!ui) return;
        const cur = window.EnderTrack?.State?.get()?.feedrate || 3000;
        ui.setFeedrate(cur <= ui.getSlow() ? ui.getFast() : ui.getSlow());
      }},
      save_track:   { label: '💾 Sauver track',  fn: () => window.saveTrack?.() },
      load_track:   { label: '📂 Charger track', fn: () => window.loadTrack?.() },
      history_mode: { label: '📜 Historique',     fn: () => window.EnderTrack?.State?.toggleHistoryMode?.() },
      hist_prev:    { label: '⬅️ Hist. précéd.',  fn: () => window.EnderTrack?.State?.goToPreviousPosition?.() },
      hist_next:    { label: '➡️ Hist. suivante', fn: () => window.EnderTrack?.State?.goToNextPosition?.() },
      list_prev:    { label: '⬅️ Liste précéd.',  fn: () => window.EnderTrack?.Lists?.previousPosition?.() },
      list_next:    { label: '➡️ Liste suivante', fn: () => window.EnderTrack?.Lists?.nextPosition?.() },
      none:         { label: '— Aucune —',       fn: () => {} },
    };

    // Default gamepad mapping (PS4/Xbox standard)
    this._defaults = {
      0: 'add_pos',      // Cross / A
      1: 'stop',         // Circle / B
      2: 'toggle_mode',  // Square / X
      3: 'home_xy',      // Triangle / Y
      8: 'toggle_preset',// Share / Back
      9: 'home_xyz',     // Options / Start
    };

    // Default keyboard mapping
    this._keyDefaults = {};

    // Keyboard direction mapping
    this._kbDirDefaults = {
      up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
      zUp: 'PageUp', zDown: 'PageDown'
    };
    this._kbDirMapping = null;

    this._btnMapping = null;
    this._keyMapping = null;

    // Direction mapping: which buttons/axes control movement
    this._dirDefaults = {
      up: { type: 'button', index: 12 },
      down: { type: 'button', index: 13 },
      left: { type: 'button', index: 14 },
      right: { type: 'button', index: 15 },
      zUp: { type: 'button', index: 5 },   // RB
      zDown: { type: 'button', index: 4 }, // LB
    };
    this._dirMapping = null;

    // Analog axis mapping: axis index → action with value
    this._axisDefaults = {};
    this._axisMapping = null;

    this.load();
  }

  // --- Persistence ---

  load() {
    try {
      const saved = localStorage.getItem(this._storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        this._btnMapping = data.buttons || { ...this._defaults };
        this._keyMapping = data.keys || { ...this._keyDefaults };
        this._dirMapping = data.dirs || { ...this._dirDefaults };
        this._axisMapping = data.axes || { ...this._axisDefaults };
        this._kbDirMapping = data.kbDirs || { ...this._kbDirDefaults };
      } else {
        this._btnMapping = { ...this._defaults };
        this._keyMapping = { ...this._keyDefaults };
        this._dirMapping = { ...this._dirDefaults };
        this._axisMapping = { ...this._axisDefaults };
        this._kbDirMapping = { ...this._kbDirDefaults };
      }
    } catch {
      this._btnMapping = { ...this._defaults };
      this._keyMapping = { ...this._keyDefaults };
      this._dirMapping = { ...this._dirDefaults };
      this._axisMapping = { ...this._axisDefaults };
      this._kbDirMapping = { ...this._kbDirDefaults };
    }
  }

  save() {
    localStorage.setItem(this._storageKey, JSON.stringify({
      buttons: this._btnMapping,
      keys: this._keyMapping,
      dirs: this._dirMapping,
      axes: this._axisMapping,
      kbDirs: this._kbDirMapping
    }));
  }

  reset() {
    this._btnMapping = { ...this._defaults };
    this._keyMapping = { ...this._keyDefaults };
    this._dirMapping = { ...this._dirDefaults };
    this._axisMapping = { ...this._axisDefaults };
    this._kbDirMapping = { ...this._kbDirDefaults };
    this.save();
  }

  // --- Gamepad button mapping ---

  getMapping() { return { ...this._btnMapping }; }

  setButton(btnIndex, actionId) {
    if (actionId === 'none') {
      delete this._btnMapping[btnIndex];
    } else {
      this._btnMapping[btnIndex] = actionId;
    }
    this.save();
    // Live-update gamepad
    const gp = window.PiloteMoiPlusPlugin?.bridge?._gp;
    if (gp) gp._btnActions = this.getMapping();
  }

  getButtonAction(btnIndex) {
    return this._btnMapping[btnIndex] || 'none';
  }

  // --- Keyboard mapping ---

  setKey(code, actionId) {
    if (actionId === 'none') {
      delete this._keyMapping[code];
    } else {
      this._keyMapping[code] = actionId;
    }
    this.save();
  }

  getKeyAction(code) {
    return this._keyMapping[code] || null;
  }

  execKey(code) {
    const actionId = this._keyMapping[code];
    if (actionId) this.exec(actionId);
  }

  // --- Execute action ---

  // Actions that require navigation tab
  static NAV_ACTIONS = new Set(['home_xy','home_xyz','stop','toggle_mode','preset_fine','preset_coarse','toggle_preset','toggle_speed']);
  // Actions that need list visible on canvas
  static LIST_ACTIONS = new Set(['add_pos','list_prev','list_next']);

  exec(actionId) {
    // Auto-switch to navigation tab for nav actions
    if (ActionMapper.NAV_ACTIONS.has(actionId) || ActionMapper.LIST_ACTIONS.has(actionId)) {
      const state = window.EnderTrack?.State?.get();
      if (state?.activeTab !== 'navigation') window.switchTab?.('navigation');
    }
    // Auto-pin active list for list actions
    if (ActionMapper.LIST_ACTIONS.has(actionId)) {
      const lists = window.EnderTrack?.Lists;
      if (lists) {
        const g = lists.groups?.find(g => g.id === lists.activeGroupId);
        if (g && !g.pinned) { lists.toggleGroupPinned(g.id); }
      }
    }
    const action = this.actions[actionId];
    if (action) { action.fn(); return; }
    if (actionId && actionId !== 'none') {
      try { new Function(actionId)(); } catch {}
    }
  }

  // --- Keyboard direction mapping ---

  getKbDirMapping() { return { ...this._kbDirMapping }; }

  setKbDir(dirName, code) {
    this._kbDirMapping[dirName] = code;
    this.save();
  }

  // Returns direction name for a key code, or null
  getKeyDir(code) {
    for (const [dir, mapped] of Object.entries(this._kbDirMapping || {})) {
      if (mapped === code) return dir;
    }
    return null;
  }

  // All key codes used for directions
  getDirKeyCodes() {
    return new Set(Object.values(this._kbDirMapping || {}));
  }

  // --- Direction mapping ---

  getDirMapping() { return { ...this._dirMapping }; }

  setDir(dirName, type, index) {
    this._dirMapping[dirName] = { type, index };
    this.save();
  }

  // Read direction state from gamepad using current mapping
  readDirections(gp) {
    let dx = 0, dy = 0, dz = 0;
    const m = this._dirMapping;
    const read = (cfg) => {
      if (!cfg) return false;
      if (cfg.type === 'button') return gp.buttons[cfg.index]?.pressed || false;
      if (cfg.type === 'axis') return Math.abs(gp.axes[cfg.index]) > 0.5 ? (gp.axes[cfg.index] > 0 ? true : false) : false;
      if (cfg.type === 'axis+') return (gp.axes[cfg.index] || 0) > 0.5;
      if (cfg.type === 'axis-') return (gp.axes[cfg.index] || 0) < -0.5;
      return false;
    };
    if (read(m.up)) dy = 1;
    if (read(m.down)) dy = -1;
    if (read(m.right)) dx = 1;
    if (read(m.left)) dx = -1;
    if (read(m.zUp)) dz = 1;
    if (read(m.zDown)) dz = -1;
    return { dx, dy, dz };
  }

  // --- Axis mapping ---

  getAxisMapping() { return { ...this._axisMapping }; }

  setAxis(axisIndex, actionId) {
    if (actionId === 'none') delete this._axisMapping[axisIndex];
    else this._axisMapping[axisIndex] = actionId;
    this.save();
  }

  // --- Action list for UI ---

  getActionList() {
    return Object.entries(this.actions).map(([id, a]) => ({ id, label: a.label }));
  }

  // --- Export / Import JSON ---

  exportJSON() {
    const data = {
      buttons: this._btnMapping,
      keys: this._keyMapping,
      dirs: this._dirMapping,
      axes: this._axisMapping,
      kbDirs: this._kbDirMapping
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pilotemoi-mapping.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (data.buttons) this._btnMapping = data.buttons;
          if (data.keys) this._keyMapping = data.keys;
          if (data.dirs) this._dirMapping = data.dirs;
          if (data.axes) this._axisMapping = data.axes;
          if (data.kbDirs) this._kbDirMapping = data.kbDirs;
          this.save();
          // Live update gamepad
          const gp = window.PiloteMoiPlusPlugin?.bridge?._gp;
          if (gp) gp._btnActions = this.getMapping();
        } catch {}
      };
      reader.readAsText(file);
    };
    input.click();
  }
}

window.ActionMapper = ActionMapper;
