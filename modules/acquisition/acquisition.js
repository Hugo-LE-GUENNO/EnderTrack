// modules/acquisition/acquisition.js — Acquisition wizards (generate scenarios)

class AcquisitionModule {
  constructor() {
    this.templates = new Map();
    this._registerCoreTemplates();
  }

  _registerCoreTemplates() {
    // === TIMELAPSE ===
    this.templates.set('timelapse', {
      id: 'timelapse',
      name: 'Time-lapse',
      icon: '⏱️',
      description: 'Capture à intervalle régulier',
      params: [
        { id: 'interval', label: 'Intervalle (s)', type: 'number', default: 10, min: 0.1 },
        { id: 'count', label: 'Nombre d\'images', type: 'number', default: 10, min: 1 },
        { id: 'format', label: 'Format', type: 'select', options: ['tiff', 'png', 'jpeg'], default: 'tiff' },
        { id: 'lightChannel', label: 'Éclairage', type: 'text', default: '', placeholder: 'vide = pas de light' }
      ],
      generate: (params) => this._generateTimelapse(params)
    });

    // === Z-STACK ===
    this.templates.set('zstack', {
      id: 'zstack',
      name: 'Z-Stack',
      icon: '📚',
      description: 'Pile Z (balayage en profondeur)',
      params: [
        { id: 'zStart', label: 'Z début (mm)', type: 'number', default: 0, step: 0.1 },
        { id: 'zEnd', label: 'Z fin (mm)', type: 'number', default: 1, step: 0.1 },
        { id: 'zStep', label: 'Pas Z (mm)', type: 'number', default: 0.05, min: 0.001, step: 0.01 },
        { id: 'format', label: 'Format', type: 'select', options: ['tiff', 'png', 'jpeg'], default: 'tiff' },
        { id: 'lightChannel', label: 'Éclairage', type: 'text', default: '', placeholder: 'vide = pas de light' }
      ],
      generate: (params) => this._generateZStack(params)
    });

    // === MULTI-POSITION ===
    this.templates.set('multipos', {
      id: 'multipos',
      name: 'Multi-positions',
      icon: '📍',
      description: 'Capture à chaque position d\'une liste',
      params: [
        { id: 'listId', label: 'Liste', type: 'list-select', default: '' },
        { id: 'delay', label: 'Délai entre positions (s)', type: 'number', default: 0.5, min: 0 },
        { id: 'format', label: 'Format', type: 'select', options: ['tiff', 'png', 'jpeg'], default: 'tiff' },
        { id: 'lightChannel', label: 'Éclairage', type: 'text', default: '', placeholder: 'vide = pas de light' }
      ],
      generate: (params) => this._generateMultiPos(params)
    });

    // === MULTI-POS + Z-STACK ===
    this.templates.set('multipos_zstack', {
      id: 'multipos_zstack',
      name: 'Multi-pos + Z-Stack',
      icon: '🔬',
      description: 'Z-Stack à chaque position d\'une liste',
      params: [
        { id: 'listId', label: 'Liste', type: 'list-select', default: '' },
        { id: 'zStart', label: 'Z début (mm)', type: 'number', default: 0, step: 0.1 },
        { id: 'zEnd', label: 'Z fin (mm)', type: 'number', default: 1, step: 0.1 },
        { id: 'zStep', label: 'Pas Z (mm)', type: 'number', default: 0.05, min: 0.001, step: 0.01 },
        { id: 'format', label: 'Format', type: 'select', options: ['tiff', 'png', 'jpeg'], default: 'tiff' },
        { id: 'lightChannel', label: 'Éclairage', type: 'text', default: '', placeholder: 'vide = pas de light' }
      ],
      generate: (params) => this._generateMultiPosZStack(params)
    });
  }

  getTemplates() { return Array.from(this.templates.values()); }

  // Generate a scenario tree from template + params, inject into ScenarioManager
  generate(templateId, params) {
    const tpl = this.templates.get(templateId);
    if (!tpl) return null;
    const tree = tpl.generate(params);
    const manager = window.EnderTrack?.Scenario?.manager;
    if (!manager) return null;
    const scenario = manager.createScenario(`${tpl.icon} ${tpl.name}`);
    scenario.tree = tree;
    scenario.description = tpl.description;
    scenario.icon = tpl.icon;
    manager.save();
    window.EnderTrack.Scenario.updateCanvasOverlay();
    window.EnderTrack.Scenario.createUI();
    return scenario;
  }

  // === GENERATORS ===

  _lightActions(channel, on) {
    if (!channel) return [];
    return [{ type: 'action', actionId: 'light_set', params: { channel, action: on ? 'on' : 'off', showInLog: false } }];
  }

  _generateTimelapse(p) {
    const children = [];
    children.push(...this._lightActions(p.lightChannel, true));
    children.push({ type: 'action', actionId: 'capture', params: { format: p.format, showInLog: true, label: 'Capture' } });
    children.push(...this._lightActions(p.lightChannel, false));
    if (p.interval > 0) {
      children.push({ type: 'action', actionId: 'wait', params: { duration: p.interval, showInLog: false, label: 'Intervalle' } });
    }
    return {
      type: 'root',
      children: [{
        type: 'loop', loopId: 'simple',
        params: { count: p.count, countMode: 'number', loopVar: '$i', label: `Time-lapse (${p.count}x)`, showInLog: true, logMessage: '⏱️ Frame $i' },
        children
      }]
    };
  }

  _generateZStack(p) {
    const steps = Math.max(1, Math.round(Math.abs(p.zEnd - p.zStart) / p.zStep));
    const children = [];
    children.push({ type: 'action', actionId: 'move', params: { moveType: 'absolute', absSource: 'manual', x: '$x', y: '$y', z: `${p.zStart} + $i * ${p.zStep}`, showInLog: false, label: 'Move Z' } });
    children.push({ type: 'action', actionId: 'wait', params: { duration: 0.1, showInLog: false, label: 'Settle' } });
    children.push(...this._lightActions(p.lightChannel, true));
    children.push({ type: 'action', actionId: 'capture', params: { format: p.format, showInLog: true, label: 'Capture Z' } });
    children.push(...this._lightActions(p.lightChannel, false));
    return {
      type: 'root',
      children: [{
        type: 'loop', loopId: 'simple',
        params: { count: steps + 1, countMode: 'number', loopVar: '$i', label: `Z-Stack (${steps + 1} plans)`, showInLog: true, logMessage: '📚 Z=$i' },
        children
      }]
    };
  }

  _generateMultiPos(p) {
    const children = [];
    children.push({ type: 'action', actionId: 'move', params: { moveType: 'absolute', absSource: 'list', listId: p.listId, listPickMode: 'index', listIndex: '$i', showInLog: true, logMessage: '📍 Position $i', label: 'Move' } });
    if (p.delay > 0) {
      children.push({ type: 'action', actionId: 'wait', params: { duration: p.delay, showInLog: false, label: 'Settle' } });
    }
    children.push(...this._lightActions(p.lightChannel, true));
    children.push({ type: 'action', actionId: 'capture', params: { format: p.format, showInLog: true, label: 'Capture' } });
    children.push(...this._lightActions(p.lightChannel, false));
    return {
      type: 'root',
      children: [{
        type: 'loop', loopId: 'simple',
        params: { count: 0, countMode: 'list', countListId: p.listId, loopVar: '$i', label: 'Multi-positions', showInLog: true, logMessage: '📍 Position $i' },
        children
      }]
    };
  }

  _generateMultiPosZStack(p) {
    const steps = Math.max(1, Math.round(Math.abs(p.zEnd - p.zStart) / p.zStep));
    const zChildren = [];
    zChildren.push({ type: 'action', actionId: 'move', params: { moveType: 'relative', dx: '0', dy: '0', dz: `${p.zStep}`, showInLog: false, label: 'Step Z' } });
    zChildren.push({ type: 'action', actionId: 'wait', params: { duration: 0.1, showInLog: false, label: 'Settle' } });
    zChildren.push(...this._lightActions(p.lightChannel, true));
    zChildren.push({ type: 'action', actionId: 'capture', params: { format: p.format, showInLog: true, label: 'Capture' } });
    zChildren.push(...this._lightActions(p.lightChannel, false));

    const posChildren = [];
    posChildren.push({ type: 'action', actionId: 'move', params: { moveType: 'absolute', absSource: 'list', listId: p.listId, listPickMode: 'index', listIndex: '$i', showInLog: true, logMessage: '📍 Position $i', label: 'Move XY' } });
    posChildren.push({ type: 'action', actionId: 'move', params: { moveType: 'absolute', absSource: 'manual', x: '$x', y: '$y', z: `${p.zStart}`, showInLog: false, label: 'Go Z start' } });
    posChildren.push({
      type: 'loop', loopId: 'simple',
      params: { count: steps, countMode: 'number', loopVar: '$j', label: `Z-Stack (${steps}x)`, showInLog: false },
      children: zChildren
    });

    return {
      type: 'root',
      children: [{
        type: 'loop', loopId: 'simple',
        params: { count: 0, countMode: 'list', countListId: p.listId, loopVar: '$i', label: 'Multi-pos + Z-Stack', showInLog: true, logMessage: '🔬 Position $i' },
        children: posChildren
      }]
    };
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Acquisition = new AcquisitionModule();
