// plugins/scenario-builder/src/nodes/action-registry.js - Central Action Registry

class ActionRegistry {
  constructor() {
    this.actions = new Map();
    this.categories = new Map();
    this.registerCoreActions();
  }

  registerCoreActions() {
    // ⏱️ Attendre
    this.register({
      id: 'wait',
      label: '⏱️ Attendre',
      icon: '⏱️',
      category: 'core',
      params: [
        { id: 'label', label: 'Label', type: 'text', default: 'Attendre' },
        { id: 'duration', label: 'Durée (s)', type: 'number', default: 1, min: 0, step: 0.1 },
        { id: 'showInLog', label: 'Afficher dans log', type: 'checkbox', default: false },
        { id: 'logMessage', label: 'Message', type: 'text', default: '', placeholder: 'Attente $duration s', showIf: 'showInLog' }
      ],
      execute: async (params, context) => {
        const vars = context?.variables || {};
        const duration = _evalExpr(params.duration, vars);
        if (params.showInLog && window.EnderTrack?.Scenario?.addLog) {
          window.EnderTrack.Scenario.addLog(_resolveVars(params.logMessage || `⏱️ Attendre ${duration}s`, context), 'info');
        }
        await new Promise(r => setTimeout(r, duration * 1000));
        return { success: true };
      }
    });

    // 🎯 Se déplacer
    this.register({
      id: 'move',
      label: '🎯 Se déplacer',
      icon: '🎯',
      category: 'core',
      params: [
        { id: 'label', label: 'Label', type: 'text', default: 'Se déplacer' },
        { id: 'moveType', label: 'Mode', type: 'select', options: [
          { value: 'absolute', label: 'Absolu' },
          { value: 'relative', label: 'Relatif' }
        ], default: 'absolute' },
        // Absolu — source
        { id: 'absSource', label: 'Source', type: 'select', options: [
          { value: 'manual', label: '✏️ Coordonnées' },
          { value: 'list', label: '📍 Liste' },
          { value: 'strategic', label: '🚩 Position stratégique' }
        ], default: 'manual', showIf: 'moveType=absolute' },
        // Absolu manual
        { id: 'x', label: 'X (mm)', type: 'text', default: '0', placeholder: '0 ou $x+5', showIf: 'moveType=absolute,absSource=manual' },
        { id: 'y', label: 'Y (mm)', type: 'text', default: '0', placeholder: '0', showIf: 'moveType=absolute,absSource=manual' },
        { id: 'z', label: 'Z (mm)', type: 'text', default: '0', placeholder: '0', showIf: 'moveType=absolute,absSource=manual' },
        // Absolu list
        { id: 'listId', label: 'Liste', type: 'list-select', default: '', showIf: 'moveType=absolute,absSource=list' },
        { id: 'listPickMode', label: 'Sélection', type: 'select', options: [
          { value: 'index', label: '🔢 Par indice (variable)' },
          { value: 'pick', label: '📌 Choisir une position' }
        ], default: 'index', showIf: 'moveType=absolute,absSource=list' },
        { id: 'listIndex', label: 'Indice', type: 'text', default: '$i', placeholder: '$i', showIf: 'moveType=absolute,absSource=list,listPickMode=index' },
        { id: 'listPick', label: 'Position', type: 'list-position-select', default: '', showIf: 'moveType=absolute,absSource=list,listPickMode=pick' },
        // Absolu strategic
        { id: 'strategicId', label: 'Position', type: 'strategic-select', default: 'homeXY', showIf: 'moveType=absolute,absSource=strategic' },
        // Relatif
        { id: 'dx', label: 'Delta X (mm)', type: 'text', default: '0', showIf: 'moveType=relative' },
        { id: 'dy', label: 'Delta Y (mm)', type: 'text', default: '0', showIf: 'moveType=relative' },
        { id: 'dz', label: 'Delta Z (mm)', type: 'text', default: '0', showIf: 'moveType=relative' },
        // Log
        { id: 'showInLog', label: 'Afficher dans log', type: 'checkbox', default: false },
        { id: 'logMessage', label: 'Message', type: 'text', default: '', placeholder: 'Déplacement...', showIf: 'showInLog' }
      ],
      execute: async (params, context) => {
        const vars = context?.variables || {};
        let x = 0, y = 0, z = 0;

        if (params.moveType === 'relative') {
          x = _evalExpr(params.dx, vars);
          y = _evalExpr(params.dy, vars);
          z = _evalExpr(params.dz, vars);
          if (window.EnderTrack?.Movement) {
            await window.EnderTrack.Movement.moveRelative(x, y, z);
          }
        } else {
          // Absolu
          const src = params.absSource || 'manual';
          console.log('[MOVE] src=', src, 'listId=', params.listId, 'moveType=', params.moveType, 'allParams=', JSON.stringify(params));
          let resolvedListId = params.listId;
          if (src === 'list' && !resolvedListId) {
            // Fallback: find listId from executor loop context
            const loopListId = context?.loopListId;
            if (loopListId) resolvedListId = loopListId;
          }
          if (src === 'list' && resolvedListId) {
            const list = window.EnderTrack?.Lists?.manager?.getList?.(resolvedListId);
            console.log('[MOVE]', { resolvedListId, listFound: !!list, count: list?.positions?.length, pickMode: params.listPickMode, listIndex: params.listIndex, vars });
            if (params.listPickMode === 'pick') {
              const pos = list?.positions?.[parseInt(params.listPick) || 0];
              if (pos) { x = pos.x; y = pos.y; z = pos.z; }
            } else {
              const idx = _evalExpr(params.listIndex, vars);
              const pos = list?.positions?.[Math.floor(idx)];
              console.log('[MOVE] idx=', idx, 'pos=', pos);
              if (pos) { x = pos.x; y = pos.y; z = pos.z; }
            }
          } else if (src === 'strategic') {
            const state = window.EnderTrack?.State?.get?.();
            const id = params.strategicId || 'homeXY';
            if (id === 'homeXY') {
              const h = state?.homePositions?.xy || { x: 0, y: 0 };
              x = h.x; y = h.y; z = state?.pos?.z || 0;
            } else if (id === 'homeXYZ') {
              const h = state?.homePositions?.xyz || { x: 0, y: 0, z: 0 };
              x = h.x; y = h.y; z = h.z;
            }
          } else {
            x = _evalExpr(params.x, vars);
            y = _evalExpr(params.y, vars);
            z = _evalExpr(params.z, vars);
          }
          if (window.EnderTrack?.Movement) {
            console.log('[MOVE] final →', x, y, z);
            await window.EnderTrack.Movement.moveAbsolute(x, y, z);
          }
        }

        if (params.showInLog && window.EnderTrack?.Scenario?.addLog) {
          const msg = params.logMessage || `🎯 ${params.moveType === 'relative' ? 'Δ' : '→'}(${x}, ${y}, ${z})`;
          window.EnderTrack.Scenario.addLog(_resolveVars(msg, context), 'info');
        }
        return { success: true };
      }
    });

    // 📝 Message log
    this.register({
      id: 'log',
      label: '📝 Message log',
      icon: '📝',
      category: 'core',
      params: [
        { id: 'message', label: 'Message', type: 'text', default: '', placeholder: 'Position: $x, $y' }
      ],
      execute: async (params, context) => {
        const msg = _resolveVars(params.message || '', context);
        console.log(`📝 [Scenario] ${msg}`);
        window.EnderTrack?.Scenario?.addLog?.(msg, 'info');
        return { success: true };
      }
    });

    // 💡 LED
    this.register({
      id: 'led',
      label: '💡 LED',
      icon: '💡',
      category: 'core',
      params: [
        { id: 'label', label: 'Label', type: 'text', default: 'LED' },
        { id: 'ledColor', label: 'Couleur', type: 'select', options: [
          { value: 'green', label: '🟢 Vert' },
          { value: 'orange', label: '🟠 Orange' },
          { value: 'red', label: '🔴 Rouge' }
        ], default: 'green' },
        { id: 'showInLog', label: 'Afficher dans log', type: 'checkbox', default: false },
        { id: 'logMessage', label: 'Message', type: 'text', default: '', showIf: 'showInLog' }
      ],
      execute: async (params, context) => {
        const color = params.ledColor || 'green';
        const el = (id) => document.getElementById(id);
        const colors = { green: '#22c55e', orange: '#f59e0b', red: '#ef4444' };
        ['green', 'orange', 'red'].forEach(c => {
          const led = el('status-light-' + c);
          if (!led) return;
          const on = c === color;
          led.style.opacity = on ? '1' : '0.2';
          led.style.boxShadow = on ? `0 0 12px ${colors[c]}` : 'none';
        });
        await new Promise(r => setTimeout(r, 50));
        if (params.showInLog && window.EnderTrack?.Scenario?.addLog) {
          window.EnderTrack.Scenario.addLog(_resolveVars(params.logMessage || `💡 LED ${color}`, context), 'info');
        }
        return { success: true };
      }
    });

    // 🛑 STOP
    this.register({
      id: 'stop',
      label: '🛑 STOP',
      icon: '🛑',
      category: 'core',
      params: [
        { id: 'label', label: 'Label', type: 'text', default: 'STOP' },
        { id: 'condition', label: 'Condition (vide = stop immédiat)', type: 'text', default: '', placeholder: '$z < 1.20' },
        { id: 'showInLog', label: 'Afficher dans log', type: 'checkbox', default: false },
        { id: 'logMessage', label: 'Message', type: 'text', default: '', showIf: 'showInLog' }
      ],
      execute: async (params, context) => {
        let shouldStop = true;
        if (params.condition) {
          shouldStop = window.EnderTrack.ConditionEvaluator.evaluate(params.condition, context?.variables || {});
        }
        if (shouldStop) {
          if (params.showInLog && window.EnderTrack?.Scenario?.addLog) {
            window.EnderTrack.Scenario.addLog(_resolveVars(params.logMessage || `🛑 STOP${params.condition ? ': ' + params.condition : ''}`, context), 'warning');
          }
          window.EnderTrack?.Scenario?.executor?.stop?.();
        }
        return { success: true, stopped: shouldStop };
      }
    });
  }

  register(actionDef) {
    if (!actionDef.id || !actionDef.label || !actionDef.icon) return false;
    this.actions.set(actionDef.id, actionDef);
    const cat = actionDef.category || 'custom';
    if (!this.categories.has(cat)) this.categories.set(cat, []);
    this.categories.get(cat).push(actionDef.id);
    return true;
  }

  getAllActions() { return Array.from(this.actions.values()); }
  getByCategory(cat) { return (this.categories.get(cat) || []).map(id => this.actions.get(id)); }
  get(id) { return this.actions.get(id); }
  getCategories() { return Array.from(this.categories.keys()); }

  unregister(id) {
    const a = this.actions.get(id);
    if (!a) return false;
    this.actions.delete(id);
    const cat = a.category || 'custom';
    if (this.categories.has(cat)) {
      const ids = this.categories.get(cat);
      const idx = ids.indexOf(id);
      if (idx > -1) ids.splice(idx, 1);
    }
    return true;
  }
}

// === Helpers ===

// Substitute $variables in a string, return string
function _resolveVars(msg, context) {
  if (!msg || !context?.variables) return msg || '';
  let out = String(msg);
  // Sort keys longest-first to avoid $x matching before $xSlice
  const keys = Object.keys(context.variables).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const val = context.variables[key];
    const re = new RegExp(key.replace(/\$/g, '\\$'), 'g');
    if (typeof val === 'object' && val !== null) {
      out = out.replace(re, `(${val.x}, ${val.y}, ${val.z})`);
    } else {
      out = out.replace(re, val);
    }
  }
  return out;
}

// Evaluate expression to number, substituting $variables. Returns 0 on failure.
function _evalExpr(expr, vars) {
  if (expr === undefined || expr === null || expr === '') return 0;
  let s = String(expr).replace(',', '.');
  const num = Number(s);
  if (!isNaN(num)) return num;
  try {
    let e = s;
    // Sort keys longest-first
    const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      const val = vars[key];
      if (typeof val === 'number') {
        e = e.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), val);
      }
    }
    return Number(Function('"use strict"; return (' + e + ')')()) || 0;
  } catch { return 0; }
}

// Evaluate expression as string (for filenames, messages with mixed text+vars)
// e.g. "img_$i_z$k.tif" → "img_3_z5.tif"
function _evalStr(expr, vars) {
  if (expr === undefined || expr === null) return '';
  let e = String(expr);
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const val = vars[key];
    if (typeof val === 'object' && val !== null) {
      e = e.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), `${val.x}_${val.y}_${val.z}`);
    } else {
      e = e.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), val);
    }
  }
  return e;
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ActionRegistry = new ActionRegistry();
window.EnderTrack._evalExpr = _evalExpr;
window.EnderTrack._evalStr = _evalStr;
window.EnderTrack._resolveVars = _resolveVars;
