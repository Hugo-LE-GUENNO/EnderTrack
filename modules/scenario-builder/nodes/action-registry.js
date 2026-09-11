// modules/scenario-builder/nodes/action-registry.js

class ActionRegistry {
  constructor() {
    this.actions = new Map();
    this.categories = new Map();
    this._registerCoreActions();
  }

  _registerCoreActions() {

    // Move
    this.register({
      id: 'move',
      label: 'Move',
      icon: '→',
      category: 'core',
      params: [
        { id: 'moveType', label: 'Mode', type: 'select', options: [
          { value: 'absolute', label: 'Absolute' },
          { value: 'relative', label: 'Relative' },
          { value: 'list',     label: 'List' }
        ], default: 'absolute' },
        { id: 'x', label: 'X (mm)', type: 'text', default: '0', showIf: 'moveType=absolute' },
        { id: 'y', label: 'Y (mm)', type: 'text', default: '0', showIf: 'moveType=absolute' },
        { id: 'z', label: 'Z (mm)', type: 'text', default: '0', showIf: 'moveType=absolute' },
        { id: 'dx', label: 'ΔX (mm)', type: 'text', default: '0', showIf: 'moveType=relative' },
        { id: 'dy', label: 'ΔY (mm)', type: 'text', default: '0', showIf: 'moveType=relative' },
        { id: 'dz', label: 'ΔZ (mm)', type: 'text', default: '0', showIf: 'moveType=relative' },
        { id: 'listId',    label: 'List',  type: 'list-select', default: '', showIf: 'moveType=list' },
        { id: 'listIndex', label: 'Index', type: 'text', default: '$i', placeholder: '$i', showIf: 'moveType=list' },
        { id: 'showInLog', label: 'Log', type: 'checkbox', default: false },
      ],
      execute: async (params, context) => {
        const vars = context?.variables || {};
        let x = 0, y = 0, z = 0;
        if (params.moveType === 'relative') {
          x = _evalExpr(params.dx, vars); y = _evalExpr(params.dy, vars); z = _evalExpr(params.dz, vars);
          await window.EnderTrack?.Movement?.moveRelative(x, y, z);
        } else if (params.moveType === 'list') {
          const list = window.EnderTrack?.Lists?.manager?.getList?.(params.listId);
          const idx = Math.floor(_evalExpr(params.listIndex, vars));
          const pos = list?.positions?.[idx];
          if (pos) { x = pos.x; y = pos.y; z = pos.z; await window.EnderTrack?.Movement?.moveAbsolute(x, y, z); }
        } else {
          x = _evalExpr(params.x, vars); y = _evalExpr(params.y, vars); z = _evalExpr(params.z, vars);
          await window.EnderTrack?.Movement?.moveAbsolute(x, y, z);
        }
        if (params.showInLog) window.EnderTrack?.Scenario?.addLog?.(`🎯 (${x}, ${y}, ${z})`, 'info');
        return { success: true };
      }
    });

    // Wait
    this.register({
      id: 'wait',
      label: 'Wait',
      icon: '⏱',
      category: 'core',
      params: [
        { id: 'duration', label: 'Duration (s)', type: 'number', default: 1, min: 0, step: 0.1 },
        { id: 'showInLog', label: 'Log', type: 'checkbox', default: false },
      ],
      execute: async (params, context) => {
        const d = _evalExpr(params.duration, context?.variables || {});
        if (params.showInLog) window.EnderTrack?.Scenario?.addLog?.(`⏱️ Attendre ${d}s`, 'info');
        await new Promise(r => setTimeout(r, d * 1000));
        return { success: true };
      }
    });

    // Log
    this.register({
      id: 'log',
      label: 'Log message',
      icon: '✏',
      category: 'core',
      params: [
        { id: 'message', label: 'Message', type: 'text', default: '', placeholder: 'Position: $x, $y' },
      ],
      execute: async (params, context) => {
        const msg = _resolveVars(params.message || '', context);
        window.EnderTrack?.Scenario?.addLog?.(msg, 'info');
        return { success: true };
      }
    });

    // Capture
    this.register({
      id: 'capture',
      label: 'Capture',
      icon: '◎',
      category: 'core',
      params: [
        { id: 'camera',   label: 'Camera',          type: 'camera-select', default: '' },
        { id: 'exposure', label: 'Exposure (µs)',    type: 'number', default: 0,   min: 0, placeholder: '0 = auto' },
        { id: 'gain',     label: 'Gain',             type: 'number', default: 1.0, min: 1, step: 0.1 },
        { id: 'format',   label: 'Format',           type: 'select', options: [
          { value: 'tiff', label: 'TIFF' },
          { value: 'png',  label: 'PNG'  },
          { value: 'jpeg', label: 'JPEG' },
        ], default: 'tiff' },
        { id: 'path',      label: 'Folder',      type: 'text', default: './captures', placeholder: './captures' },
        { id: 'filename',  label: 'Filename',    type: 'text', default: 'img_$i',    placeholder: 'img_$i' },
        { id: 'showInLog', label: 'Log',         type: 'checkbox', default: true },
      ],
      execute: async (params, context) => {
        const vars = context?.variables || {};
        const camera = window.EnderTrack?.Camera;
        if (!camera) return { success: false, error: 'No camera' };
        const expo = parseInt(params.exposure) || 0;
        const gain = parseFloat(params.gain) || 1.0;
        if (expo > 0 || gain !== 1.0) await camera.setPicamConfig?.({ exposure: expo || undefined, gain });
        const name = _evalStr(params.filename || 'img_$i', vars);
        const fullPath = `${params.path || './captures'}/${name}.${params.format || 'tiff'}`;
        const result = await camera.capture({ format: params.format || 'tiff', path: fullPath, cameraId: params.camera });
        if (params.showInLog) window.EnderTrack?.Scenario?.addLog?.(`📷 ${result.path || fullPath}`, 'info');
        return { success: !!result.path, path: result.path };
      }
    });

    // Light
    this.register({
      id: 'led',
      label: 'Light',
      icon: '○',
      category: 'core',
      params: [
        { id: 'ledId', label: 'Light', type: 'light-select', default: '' },
        { id: 'on',    label: 'On',    type: 'checkbox', default: true },
        { id: 'r',     label: 'R (0-255)', type: 'number', default: 255, min: 0, max: 255, showIf: 'on' },
        { id: 'g',     label: 'G (0-255)', type: 'number', default: 255, min: 0, max: 255, showIf: 'on' },
        { id: 'b',     label: 'B (0-255)', type: 'number', default: 255, min: 0, max: 255, showIf: 'on' },
        { id: 'showInLog', label: 'Log', type: 'checkbox', default: false },
      ],
      execute: async (params, context) => {
        const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
        const lights = window._lights || [];
        const light = lights.find(l => String(l.id) === String(params.ledId)) || lights[0];
        if (!light) return { success: false, error: 'No light configured' };
        const on = params.on !== false;
        const body = { id: light.id, on, r: parseInt(params.r) || 0, g: parseInt(params.g) || 0, b: parseInt(params.b) || 0 };
        try {
          await fetch(base + '/api/light/' + (on ? 'on' : 'off'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
          });
        } catch (e) { console.warn('[led]', e); }
        if (params.showInLog) window.EnderTrack?.Scenario?.addLog?.(`💡 ${light.name || light.id} ${on ? 'ON' : 'OFF'}`, 'info');
        return { success: true };
      }
    });

  }

  register(def) {
    if (!def.id || !def.label) return false;
    this.actions.set(def.id, def);
    const cat = def.category || 'custom';
    if (!this.categories.has(cat)) this.categories.set(cat, []);
    this.categories.get(cat).push(def.id);
    return true;
  }

  getAllActions()      { return Array.from(this.actions.values()); }
  getByCategory(cat)  { return (this.categories.get(cat) || []).map(id => this.actions.get(id)); }
  get(id)             { return this.actions.get(id); }
  getCategories()     { return Array.from(this.categories.keys()); }

  unregister(id) {
    const a = this.actions.get(id);
    if (!a) return false;
    this.actions.delete(id);
    const ids = this.categories.get(a.category || 'custom') || [];
    const idx = ids.indexOf(id);
    if (idx > -1) ids.splice(idx, 1);
    return true;
  }
}

// === Helpers ===

function _resolveVars(msg, context) {
  if (!msg || !context?.variables) return msg || '';
  let out = String(msg);
  const keys = Object.keys(context.variables).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const val = context.variables[key];
    const re = new RegExp(key.replace(/\$/g, '\\$'), 'g');
    out = out.replace(re, typeof val === 'object' ? `(${val.x},${val.y},${val.z})` : val);
  }
  return out;
}

function _evalExpr(expr, vars) {
  if (expr === undefined || expr === null || expr === '') return 0;
  const num = Number(String(expr).replace(',', '.'));
  if (!isNaN(num)) return num;
  try {
    let e = String(expr);
    const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (typeof vars[key] === 'number')
        e = e.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), vars[key]);
    }
    return Number(Function('"use strict"; return (' + e + ')')()) || 0;
  } catch { return 0; }
}

function _evalStr(expr, vars) {
  if (!expr) return '';
  let e = String(expr);
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const val = vars[key];
    e = e.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'),
      typeof val === 'object' ? `${val.x}_${val.y}_${val.z}` : val);
  }
  return e;
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ActionRegistry = new ActionRegistry();
window.EnderTrack._evalExpr = _evalExpr;
window.EnderTrack._evalStr  = _evalStr;
window.EnderTrack._resolveVars = _resolveVars;
