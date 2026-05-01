// plugins/scenario-builder/src/nodes/loop-types.js - Loop Types Registry

class LoopTypesRegistry {
  constructor() {
    this.loopTypes = new Map();
    this.registerCoreLoops();
  }

  registerCoreLoops() {
    // 🔁 Répéter
    this.register({
      id: 'simple',
      label: '🔁 Répéter',
      icon: '🔁',
      params: [
        { name: 'label', label: 'Label', type: 'text', default: 'Répéter' },
        { name: 'countMode', label: 'Répétitions', type: 'select', options: [
          { value: 'number', label: '🔢 Nombre fixe' },
          { value: 'list', label: '📍 Longueur de liste' },
          { value: 'infinite', label: '♾️ Infini' }
        ], default: 'number' },
        { name: 'count', label: 'Nombre', type: 'number', default: 5, min: 1, showIf: 'countMode=number' },
        { name: 'countListId', label: 'Liste', type: 'list-select', default: '', showIf: 'countMode=list' },
        { name: 'loopVar', label: 'Variable', type: 'text', default: '$i', readonly: true },
        { name: 'showInLog', label: 'Afficher dans log', type: 'checkbox', default: false },
        { name: 'logMessage', label: 'Message', type: 'text', default: '', placeholder: 'Tour $i', showIf: 'showInLog' }
      ],
      getIterationCount: (params) => {
        if (params.countMode === 'infinite') return Infinity;
        if (params.countMode === 'list') {
          const list = window.EnderTrack?.Lists?.manager?.getList?.(params.countListId);
          return list?.positions?.length || 0;
        }
        return Math.max(1, Math.floor(Number(params.count) || 1));
      },
      getDefaultLogMessage: (params) => `🔁 ${params.label || 'Répéter'} — tour ${params.loopVar || '$i'}`
    });

    // ⚡ Tant que
    this.register({
      id: 'while',
      label: '⚡ Tant que',
      icon: '⚡',
      params: [
        { name: 'label', label: 'Label', type: 'text', default: 'Tant que' },
        { name: 'condition', label: 'Condition', type: 'text', default: '$i < 10', placeholder: '$temp < 40' },
        { name: 'maxIterations', label: 'Max itérations (sécurité)', type: 'number', default: 100, min: 1 },
        { name: 'loopVar', label: 'Variable', type: 'text', default: '$i', readonly: true },
        { name: 'showInLog', label: 'Afficher dans log', type: 'checkbox', default: false },
        { name: 'logMessage', label: 'Message', type: 'text', default: '', placeholder: 'Tour $i', showIf: 'showInLog' }
      ],
      getIterationCount: (params) => params.maxIterations || 100,
      getDefaultLogMessage: (params) => `⚡ ${params.label || 'Tant que'} — tour ${params.loopVar || '$i'}`
    });
  }

  register(def) {
    if (!def.id || !def.label) return false;
    this.loopTypes.set(def.id, def);
    return true;
  }

  get(id) { return this.loopTypes.get(id); }
  getAll() { return Array.from(this.loopTypes.values()); }
  unregister(id) { return this.loopTypes.delete(id); }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.LoopTypesRegistry = new LoopTypesRegistry();
