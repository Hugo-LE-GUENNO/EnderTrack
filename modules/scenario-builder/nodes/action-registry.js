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
        { id: 'speedRate', label: 'Speed', type: 'feedrate', default: 0 },
        { id: 'showInLog', label: 'Log', type: 'checkbox', default: false },
      ],
      execute: async (params, context) => {
        const vars = context?.variables || {};
        const baseFeedrate = window.EnderTrack?.State?.get()?.feedrate || 3000;
        const srRaw = _evalAny(params.speedRate, context?.variables || {});
        const sr = typeof srRaw === 'number' ? srRaw : parseInt(srRaw) || 0;
        const feedrate = (sr > 0) ? Math.max(100, Math.min(10000, sr)) : baseFeedrate;
        let x = 0, y = 0, z = 0;
        if (params.moveType === 'relative') {
          x = _evalExpr(params.dx, vars); y = _evalExpr(params.dy, vars); z = _evalExpr(params.dz, vars);
          const r1 = await window.EnderTrack?.Movement?.moveRelative(x, y, z, feedrate);
          context._lastMoveDuration = (typeof r1 === 'object' && r1?.duration) ? r1.duration * 1000 : 0;
        } else if (params.moveType === 'list') {
          const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
          const list = lists.find(l => String(l.id) === String(params.listId)) || lists[0];
          const idx = Math.floor(_evalExpr(params.listIndex, vars));
          const pos = list?.positions?.[idx];
          if (pos) { x = pos.x; y = pos.y; z = pos.z; const r2 = await window.EnderTrack?.Movement?.moveAbsolute(x, y, z, feedrate); context._lastMoveDuration = (typeof r2 === 'object' && r2?.duration) ? r2.duration * 1000 : 0; }
          else { await new Promise(r => setTimeout(r, 0)); context._lastMoveDuration = 0; }
        } else {
          x = _evalExpr(params.x, vars); y = _evalExpr(params.y, vars); z = _evalExpr(params.z, vars);
          const r3 = await window.EnderTrack?.Movement?.moveAbsolute(x, y, z, feedrate);
          context._lastMoveDuration = (typeof r3 === 'object' && r3?.duration) ? r3.duration * 1000 : 0;
        }
        if (params.showInLog) window.EnderTrack?.Scenario?.addLog?.(`🎯 (${x}, ${y}, ${z}) @${feedrate}mm/min`, 'info');
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
        if (params.showInLog) window.EnderTrack?.Scenario?.addLog?.(`\u23f1 Wait ${d}s`, 'info');
        window.EnderTrack?.Scenario?._showWaitTimer?.(d);
        const end = Date.now() + d * 1000;
        while (Date.now() < end) {
          if (!window.EnderTrack?.Scenario?.isExecuting) break;
          while (window.EnderTrack?.Scenario?._executor?.isPaused) {
            await new Promise(r => setTimeout(r, 100));
          }
          await new Promise(r => setTimeout(r, 100));
        }
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

    // Set variable
    this.register({
      id: 'setvar',
      label: 'Set variable',
      icon: '=',
      category: 'core',
      params: [
        { id: 'varId',     label: 'Variable',    type: 'text', default: '$result', placeholder: '$myVar' },
        { id: 'value',     label: 'Value',        type: 'text', default: '0',       placeholder: '0 or $x + 1' },
        { id: 'showInLog', label: 'Log',          type: 'checkbox', default: false },
      ],
      execute: async (params, context) => {
        const vars = context?.variables || {};
        const varId = String(params.varId || '').trim();
        if (!varId.startsWith('$')) return { success: false };
        const result = _evalAny(params.value, vars);
        vars[varId] = result;
        // Persist into VariableManager so the value survives updateVariables() calls
        const vm = window.EnderTrack?.VariableManager;
        if (vm) {
          const isSystem = vm.systemVariables?.find(v => v.id === varId);
          const isGlobal = vm.globalVariables?.find(v => v.id === varId);
          if (isGlobal) {
            isGlobal.formula = String(result);
          } else if (!isSystem) {
            // Create/update as local variable on the current scenario
            const scenario = window.EnderTrack?.Scenario?.manager?.getCurrentScenario();
            if (scenario) {
              if (!scenario.customVariables) scenario.customVariables = [];
              const local = scenario.customVariables.find(v => v.id === varId);
              if (local) local.formula = String(result);
              else scenario.customVariables.push({ id: varId, name: varId, formula: String(result), type: 'number' });
              window.EnderTrack.Scenario.manager.save?.();
            }
            // Keep VariableManager in sync
            const vmLocal = vm.customVariables?.find(v => v.id === varId);
            if (vmLocal) vmLocal.formula = String(result);
          }
        }
        if (params.showInLog) window.EnderTrack?.Scenario?.addLog?.(`= ${varId} ← ${result}`, 'info');
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
        { id: 'camera',     label: 'Camera',        type: 'camera-select', default: '' },
        { id: 'resolution', label: 'Definition',    type: 'select', options: () => {
          const cam = (window._cameras || []).find(c => c.type === 'picamera2');
          const liveRes = window.EnderTrack?.Camera?.picamConfig?.resolution || [640,480];
          const all = cam?.available_resolutions || [];
          const max = all[0];
          const opts = [{ value: '', label: `Current live (${liveRes[0]}×${liveRes[1]})` }];
          all.forEach(r => {
            if (r[0] === liveRes[0] && r[1] === liveRes[1]) return;
            opts.push({ value: r.join(','), label: `${r[0]}×${r[1]}${max && r[0]===max[0] ? ' (Full)' : ''}` });
          });
          opts.push({ value: 'custom', label: 'Custom…' });
          return opts;
        }, default: '',
          onchange: (val, values, pathStr) => {
            if (val === 'custom' || val === '') return;
            const ps = window._capPixelSize?.(val);
            if (ps != null) EnderTrack.ScenarioBuilder.updateParam(pathStr, 'pixel_size', ps);
          }
        },
        { id: 'resolution_custom', label: 'Custom W×H', type: 'text', default: '512,512', placeholder: 'W,H', showIf: 'resolution=custom' },
        { id: 'pixel_size', label: 'Pixel size (µm/px)', type: 'number', default: () => window.EnderTrack?.Camera?.getEffectivePixelSize?.() || 1.0, step: 0.001, getLive: '() => window.EnderTrack?.Camera?.getEffectivePixelSize?.()', note: (values) => values.resolution && values.resolution !== '' && values.resolution !== 'custom' ? '⚠ estimated — not calibrated at this definition' : null },
        { id: 'exposure',   label: 'Exposure (µs)', type: 'number', default: () => window.EnderTrack?.Camera?.picamConfig?.exposure || 0, min: 0, placeholder: '0 = current', getLive: '() => window.EnderTrack?.Camera?.picamConfig?.exposure' },
        { id: 'gain',       label: 'Gain',          type: 'number', default: () => window.EnderTrack?.Camera?.picamConfig?.gain || 0, min: 0, step: 0.1, placeholder: '0 = current', getLive: '() => window.EnderTrack?.Camera?.picamConfig?.gain' },
        { id: 'format',     label: 'Format',        type: 'select', options: [
          { value: 'tiff', label: 'TIFF' },
          { value: 'png',  label: 'PNG'  },
          { value: 'jpeg', label: 'JPEG' },
        ], default: 'tiff' },
        { id: 'image_type', label: 'Image type', type: 'select', options: [
          { value: 'gray', label: '8-bit' },
          { value: 'rgb',  label: () => { const sf = window.EnderTrack?.Camera?.picamConfig?.stream_format || 'RGB888'; return sf === 'RGB888' ? 'RGB (BGR order)' : 'RGB'; } },
        ], default: 'gray', showIf: '!format=jpeg' },
        { id: 'path',       label: 'Folder',        type: 'text', default: './captures', placeholder: './captures' },
        { id: 'filename',   label: 'Filename',      type: 'text', default: 'img_$date',  placeholder: '$date, $i, $x, $y, $z' },
        { id: 'apply_rotation',  label: 'Apply rotation', type: 'checkbox', default: false },
        { id: 'save_metadata',   label: 'Save metadata',   type: 'checkbox', default: true, showIf: '!format=jpeg' },
        { id: 'custom_metadata', label: '+ Custom fields', type: 'checkbox', default: false, showIf: 'save_metadata' },
        { id: 'metadata', label: 'Custom fields', type: 'textarea', rows: 4, showIf: 'save_metadata,custom_metadata', default: `sample=my_sample
notes=`, placeholder: 'key=value per line' },
        { id: 'showInLog',  label: 'Log',           type: 'checkbox', default: true },
      ],
      execute: async (params, context) => {
        const vars = context?.variables || {};
        const camera = window.EnderTrack?.Camera;
        if (!camera) return { success: false, error: 'No camera' };
        const base = window.ENDERTRACK_SERVER || 'http://localhost:5000';
        const liveExpo = camera.picamConfig?.exposure || 0;
        const liveGain = camera.picamConfig?.gain || 0;
        const expo = parseInt(params.exposure) || 0;
        const gain = parseFloat(params.gain) || 0;
        const cam = (window._cameras || []).find(c => c.type === 'picamera2');
        // Enrich vars with camera/stage values for metadata
        const metaVars = {
          ...vars,
          $exposure: expo > 0 ? expo : liveExpo,
          $gain: (gain > 0 ? gain : liveGain).toFixed(2),
          $sensor: cam?.sensor || '',
          $pixel_size: camera.getEffectivePixelSize?.()?.toFixed(4) || cam?.pixel_size || '',
          $rotation: camera.picamConfig?.rotation || 0,
          $resolution: params.resolution === 'custom' ? (params.resolution_custom||'') : (params.resolution || camera.picamConfig?.resolution?.join(',') || ''),
        };
        const name = _evalStr(params.filename || 'img_$date', metaVars);
        const fullPath = `${params.path || './captures'}/${name}.${params.format || 'tiff'}`;
        const body = { path: fullPath, format: params.format || 'tiff' };
        if (expo > 0) body.exposure = expo;
        if (gain > 0) body.gain = gain;
        let resVal = params.resolution;
        if (resVal === 'custom') resVal = params.resolution_custom || '';
        if (resVal) body.resolution = resVal.split(',').map(Number);
        if (params.apply_rotation) body.apply_rotation = true;
        if (params.image_type) body.color_mode = params.image_type;
        const pos = window.EnderTrack?.State?.get?.()?.position;
        if (pos) body.stage = { x: pos.x, y: pos.y, z: pos.z };
        if (params.pixel_size) body.pixel_size = parseFloat(params.pixel_size);
        body.save_metadata = params.save_metadata !== false;
        if (params.custom_metadata && params.metadata) {
          const meta = {};
          _evalStr(params.metadata, metaVars).split('\n').forEach(line => {
            const eq = line.indexOf('=');
            if (eq > 0) meta[line.slice(0,eq).trim()] = line.slice(eq+1).trim();
          });
          if (Object.keys(meta).length) body.metadata = meta;
        }
        const res = await fetch(base + '/api/camera/picam/capture', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const result = await res.json();
        if (expo > 0 || gain > 0) {
          fetch(base + '/api/camera/picam/config', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...(expo > 0 ? { exposure: liveExpo } : {}), ...(gain > 0 ? { gain: liveGain } : {}) })
          });
        }
        if (params.showInLog) window.EnderTrack?.Scenario?.addLog?.(`📷 ${result.path || fullPath}`, 'info');
        if (camera.navigatorMode && camera.live && window._tilesEnabled) {
          const f = await camera.getFrame();
          if (f?.frame) camera._addTile(f);
        }
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
        const sid = typeof light.serverId === 'number' ? light.serverId : null;
        const body = sid != null ? { id: sid } : {};
        if (on) { body.r = (Number.isFinite(parseInt(params.r)) ? parseInt(params.r) : 255); body.g = (Number.isFinite(parseInt(params.g)) ? parseInt(params.g) : 255); body.b = (Number.isFinite(parseInt(params.b)) ? parseInt(params.b) : 255); }
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

function _evalAny(expr, vars) {
  if (expr === undefined || expr === null || expr === '') return 0;
  const s = String(expr);
  // Pure number
  const num = Number(s.replace(',', '.'));
  if (!isNaN(num)) return num;
  // Resolve variables first
  let resolved = s;
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    resolved = resolved.replace(new RegExp(key.replace(/\$/g, '\\$'), 'g'), vars[key]);
  }
  // Try numeric expression
  try {
    const r = Function('"use strict"; return (' + resolved + ')')();
    if (r !== undefined && r !== null && !isNaN(Number(r))) return Number(r);
    return r;
  } catch { return resolved; }
}

function _evalStr(expr, vars) {
  if (!expr) return '';
  let e = String(expr);
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  e = e.replace(/\$date/g, `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`);
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
window.EnderTrack._evalAny  = _evalAny;
window.EnderTrack._evalStr  = _evalStr;
window.EnderTrack._resolveVars = _resolveVars;

// Helper: compute pixel size for a given capture resolution string e.g. '4608,2592'
window._capPixelSize = (resVal) => {
  const cam = window.EnderTrack?.Camera;
  if (!cam) return null;
  const r = resVal.split(',').map(Number);
  if (!r[0]) return null;
  const livePS = cam.getEffectivePixelSize?.() || 1.0;
  const liveW = cam.picamConfig?.resolution?.[0] || 640;
  return parseFloat((livePS * (liveW / r[0])).toFixed(4));
};
