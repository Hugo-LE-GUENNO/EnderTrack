// plugins/scenario-builder/src/nodes/loop-types.js - Loop Types Registry

class LoopTypesRegistry {
  constructor() {
    this.loopTypes = new Map();
    this.registerCoreLoops();
  }

  registerCoreLoops() {
    // Repeat
    this.register({
      id: 'simple',
      label: 'Repeat',
      icon: '↺',
      params: [
        { name: 'label', label: 'Label', type: 'text', default: 'Repeat' },
        { name: 'countMode', label: 'Iterations', type: 'select', options: [
          { value: 'number',   label: 'Fixed count' },
          { value: 'list',     label: 'List length' },
          { value: 'infinite', label: 'Infinite' }
        ], default: 'number' },
        { name: 'count',       label: 'Count',    type: 'number', default: 5, min: 1, showIf: 'countMode=number' },
        { name: 'countListId', label: 'List',     type: 'list-select', default: '', showIf: 'countMode=list' },
        { name: 'loopVar',     label: 'Variable', type: 'text', default: '$i', readonly: true },
        { name: 'showInLog',   label: 'Log',      type: 'checkbox', default: false },
        { name: 'logMessage',  label: 'Message',  type: 'text', default: '', placeholder: 'Iteration $i', showIf: 'showInLog' }
      ],
      getIterationCount: (params) => {
        if (params.countMode === 'infinite') return Infinity;
        if (params.countMode === 'list') {
          let list = window.EnderTrack?.Lists?.manager?.getList?.(params.countListId);
          if (!list) {
            const all = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
            list = all[0];
          }
          return list?.positions?.length || 0;
        }
        return Math.max(1, Math.floor(Number(params.count) || 1));
      },
      getDefaultLogMessage: (params) => `↺ ${params.label || 'Repeat'} — iteration ${params.loopVar || '$i'}`
    });

    // Group
    this.register({
      id: 'group',
      label: 'Group',
      icon: '▤',
      params: [
        { name: 'label', label: 'Label', type: 'text', default: 'Group' }
      ],
      getIterationCount: () => 1,
      getDefaultLogMessage: (params) => `▤ ${params.label || 'Group'}`
    });

    // While
    this.register({
      id: 'while',
      label: 'While',
      icon: '⇄',
      params: [
        { name: 'label',         label: 'Label',              type: 'text',   default: 'While' },
        { name: 'condition',     label: 'Condition',          type: 'text',   default: '$i < 10', placeholder: '$temp < 40' },
        { name: 'maxIterations', label: 'Max iterations',     type: 'number', default: 100, min: 1 },
        { name: 'loopVar',       label: 'Variable',           type: 'text',   default: '$i', readonly: true },
        { name: 'showInLog',     label: 'Log',                type: 'checkbox', default: false },
        { name: 'logMessage',    label: 'Message',            type: 'text',   default: '', placeholder: 'Iteration $i', showIf: 'showInLog' }
      ],
      getIterationCount: (params) => params.maxIterations || 100,
      getDefaultLogMessage: (params) => `⇄ ${params.label || 'While'} — iteration ${params.loopVar || '$i'}`
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
