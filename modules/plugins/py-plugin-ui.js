// modules/plugins/py-plugin-ui.js
// Reçoit plugin:ui via SSE → génère et injecte le HTML dans les sections EnderTrack

class PyPluginUI {
  constructor() {
    this._plugins = {};  // { plugin_id: { ui_def, elements[] } }
  }

  init() {
    window.EnderTrack?.Events?.on?.('pyplugin:ui',               (data) => this._mount(data));
    window.EnderTrack?.Events?.on?.('pyplugin:removed',          (data) => this._unmount(data.plugin_id));
    window.EnderTrack?.Events?.on?.('pyplugin:output',           (data) => this._updateOutput(data));
    window.EnderTrack?.Events?.on?.('pyplugin:log',              (data) => this._appendLog(data));
    window.EnderTrack?.Events?.on?.('pyplugin:scenario_actions', (data) => this._registerScenarioActions(data));

    fetch((window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/pyplugins/list')
      .then(r => r.json())
      .then(data => {
        for (const id of (data.active || [])) {
          fetch(`${window.ENDERTRACK_SERVER || 'http://localhost:5000'}/api/pyplugins/${id}/ui`)
            .then(r => r.json())
            .then(ui => this._mount(ui))
            .catch(() => {});
        }
      }).catch(() => {});
  }

  // ── Mount ──────────────────────────────────────────────────────────────────

  _mount(ui) {
    const { plugin_id, name, sections, scenario_actions, extra_js } = ui;
    console.log('[PyPluginUI] _mount', plugin_id, Object.keys(sections || {}));
    this._unmount(plugin_id);
    const elements = [];

    if (scenario_actions?.length) {
      this._registerScenarioActions({ plugin_id, actions: scenario_actions });
    }

    // Charger les JS additionnels du plugin
    for (const src of (extra_js || [])) {
      if (!document.querySelector(`script[data-pyplugin-js="${src}"]`)) {
        const s = document.createElement('script');
        s.src = src;
        s.dataset.pypluginJs = src;
        document.head.appendChild(s);
      }
    }

    const leftMap = {
      navigation: 'navPluginZone',
      settings:   null,  // accordéon dans configPluginZone
      waypoints:  'listsPluginZone',
      automation: 'automationPluginZone',
    };
    const rightMap = {
      navigation: 'rightPluginZone-navigation',
      settings:   'rightPluginZone-settings',
      waypoints:  'rightPluginZone-lists',
      automation: 'rightPluginZone-acquisition',
    };

    for (const [section, def] of Object.entries(sections || {})) {
      // ── Inputs (gauche) ──
      if (def.inputs?.length) {
        let target;
        if (section === 'settings') {
          const settingsEl = document.getElementById('configPluginZone');
          if (settingsEl) {
            const details = document.createElement('details');
            details.id = `pyplugin-${plugin_id}-settings-inputs`;
            const summary = document.createElement('summary');
            summary.textContent = name;
            details.appendChild(summary);
            const body = document.createElement('div');
            body.style.cssText = 'display:flex; flex-direction:column; gap:4px; padding:8px 0;';
            for (const item of def.inputs) body.appendChild(this._buildInput(plugin_id, item));
            details.appendChild(body);
            settingsEl.appendChild(details);
            elements.push(details);
          }
        } else {
          target = document.getElementById(leftMap[section]);
          if (target) {
            const wrap = document.createElement('div');
            wrap.id = `pyplugin-${plugin_id}-${section}-inputs`;
            wrap.style.cssText = 'padding:8px 0; border-top:1px solid var(--border);';
            const lbl = document.createElement('div');
            lbl.textContent = name;
            lbl.style.cssText = 'font-size:10px; color:var(--text-general); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;';
            wrap.appendChild(lbl);
            const col = document.createElement('div');
            col.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
            for (const item of def.inputs) col.appendChild(this._buildInput(plugin_id, item));
            wrap.appendChild(col);
            target.appendChild(wrap);
            elements.push(wrap);
          }
        }
      }

      // ── Outputs (droite) ──
      if (def.outputs?.length) {
        const rightTarget = document.getElementById(rightMap[section]);
        if (rightTarget) {
          const wrap = document.createElement('div');
          wrap.id = `pyplugin-${plugin_id}-${section}-outputs`;
          wrap.style.cssText = 'padding:8px 0; border-top:1px solid var(--border);';
          const col = document.createElement('div');
          col.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
          for (const item of def.outputs) col.appendChild(this._buildOutput(plugin_id, item));
          wrap.appendChild(col);
          rightTarget.appendChild(wrap);
          elements.push(wrap);
        }
      }
    }

    this._plugins[plugin_id] = { ui, elements };
  }

  _unmount(plugin_id) {
    const entry = this._plugins[plugin_id];
    if (!entry) return;
    entry.elements.forEach(el => el.remove());
    delete this._plugins[plugin_id];
  }

  // ── Section targets ────────────────────────────────────────────────────────

  _registerScenarioActions(data) {
    const { plugin_id, actions } = data;
    if (!actions?.length) return;
    const baseUrl = window.ENDERTRACK_SERVER || 'http://localhost:5000';
    for (const action of actions) {
      const actionId = `pyplugin_${plugin_id}_${action.id}`;
      EnderTrack.ActionRegistry?.register({
        id:       actionId,
        label:    action.label,
        icon:     action.icon || '🐍',
        category: 'plugin',
        params:   (action.params || []).map(p => ({
          id:      p.id,
          label:   p.label,
          type:    p.type || 'number',
          default: p.default ?? 0,
          min:     p.min,
          max:     p.max,
          step:    p.step,
          options: p.options,
        })),
        execute: async (params) => {
          const resp = await fetch(`${baseUrl}/api/pyplugins/${plugin_id}/action/${action.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: AbortSignal.timeout(action.timeout_ms || 60000)
          });
          return await resp.json();
        }
      });
    }
    // Refresh scenario builder palette
    EnderTrack.ScenarioBuilder?._refreshPalette?.();
  }

  _getSectionTarget(section) { return null; }
  _getRightTarget(tab) { return null; }

  // ── Input builders ─────────────────────────────────────────────────────────

  _buildInput(plugin_id, item) {
    const wrap = document.createElement('div');

    switch (item.type) {
      case 'button': {
        const btn = document.createElement('button');
        btn.textContent = item.label;
        btn.className = item.style === 'primary' ? 'action-btn primary' : 'action-btn';
        btn.style.cssText = 'width:100%; font-size:11px;';
        btn.onclick = () => this._callAction(plugin_id, item.action);
        wrap.appendChild(btn);
        break;
      }
      case 'slider': {
        const row = document.createElement('div');
        row.className = 'axis-control';
        const lbl = document.createElement('label');
        lbl.textContent = item.label;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = `pyplugin-in-${plugin_id}-${item.id}`;
        slider.className = 'et-slider';
        slider.min = item.min ?? 0; slider.max = item.max ?? 100;
        slider.value = item.default ?? 50;
        const val = document.createElement('input');
        val.type = 'number';
        val.value = slider.value;
        val.min = slider.min; val.max = slider.max;
        slider.oninput = () => { val.value = slider.value; };
        val.onchange = () => { slider.value = val.value; };
        row.append(lbl, slider, val);
        wrap.appendChild(row);
        break;
      }
      case 'input': {
        const row = document.createElement('div');
        row.className = 'input-group';
        const lbl = document.createElement('label');
        lbl.textContent = item.label;
        const input = document.createElement('input');
        input.type = item.input_type || 'text';
        input.id = `pyplugin-in-${plugin_id}-${item.id}`;
        input.value = item.default ?? '';
        row.append(lbl, input);
        wrap.appendChild(row);
        break;
      }
      case 'folder': {
        const row = document.createElement('div');
        row.className = 'input-group';
        const lbl = document.createElement('label');
        lbl.textContent = item.label;
        const hidden = document.createElement('input');
        hidden.type = 'text';
        hidden.id = `pyplugin-in-${plugin_id}-${item.id}`;
        hidden.value = item.default ?? '';
        hidden.style.display = 'none';
        const display = document.createElement('div');
        display.style.cssText = 'font-size:10px; color:var(--coordinates-color); font-family:monospace; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        display.textContent = hidden.value || '—';
        const btn = document.createElement('button');
        btn.textContent = '📂';
        btn.className = 'action-btn';
        btn.style.cssText = 'padding:2px 6px; font-size:11px; flex-shrink:0;';
        btn.onclick = () => {
          const inp = document.createElement('input');
          inp.type = 'file';
          if (item.directory) inp.setAttribute('webkitdirectory', '');
          inp.onchange = () => {
            const f = inp.files[0];
            if (!f) return;
            const path = item.directory
              ? f.webkitRelativePath.split('/')[0]
              : (f.webkitRelativePath || f.name);
            hidden.value = path;
            display.textContent = path;
          };
          inp.click();
        };
        row.append(lbl, display, btn, hidden);
        wrap.appendChild(row);
        break;
      }
      case 'textarea': {
        const row = document.createElement('div');
        row.className = 'input-group';
        if (item.label) {
          const lbl = document.createElement('label');
          lbl.textContent = item.label;
          row.appendChild(lbl);
        }
        const ta = document.createElement('textarea');
        ta.id = `pyplugin-in-${plugin_id}-${item.id}`;
        ta.value = item.default ?? '';
        ta.placeholder = item.placeholder ?? '';
        ta.rows = item.rows ?? 6;
        ta.style.cssText = 'width:100%; font-family:monospace; font-size:11px; resize:vertical; background:var(--app-bg); color:var(--coordinates-color); border:1px solid var(--border); border-radius:var(--radius-sm); padding:4px 6px; box-sizing:border-box;';
        row.appendChild(ta);
        wrap.appendChild(row);
        break;
      }
      case 'dropdown': {
        const row = document.createElement('div');
        row.className = 'input-group';
        const lbl = document.createElement('label');
        lbl.textContent = item.label;
        const sel = document.createElement('select');
        sel.id = `pyplugin-in-${plugin_id}-${item.id}`;
        (item.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = typeof opt === 'object' ? opt.value : opt;
          o.textContent = typeof opt === 'object' ? opt.label : opt;
          sel.appendChild(o);
        });
        row.append(lbl, sel);
        wrap.appendChild(row);
        break;
      }
    }
    return wrap;
  }

  // ── Output builders ────────────────────────────────────────────────────────

  _buildOutput(plugin_id, item) {
    const wrap = document.createElement('div');

    if (item.label) {
      const lbl = document.createElement('div');
      lbl.textContent = item.label;
      lbl.style.cssText = 'font-size:9px; color:var(--text-general); margin-bottom:2px; text-transform:uppercase; letter-spacing:0.5px;';
      wrap.appendChild(lbl);
    }

    if (item.type === 'image' || item.type === 'image_click') {
      const img = document.createElement('img');
      img.id = `pyplugin-out-${plugin_id}-${item.id}`;
      img.style.cssText = 'width:100%; border-radius:4px; display:block; background:#111; min-height:60px;';
      if (item.type === 'image_click') {
        img.style.cursor = 'crosshair';
        img.addEventListener('click', (e) => {
          const rect = img.getBoundingClientRect();
          // Normalized coordinates [0,1] relative to the image
          const nx = (e.clientX - rect.left)  / rect.width;
          const ny = (e.clientY - rect.top)   / rect.height;
          // Store in hidden inputs so _callAction picks them up
          ['click_x', 'click_y'].forEach(k => {
            let inp = document.getElementById(`pyplugin-in-${plugin_id}-${k}`);
            if (!inp) {
              inp = document.createElement('input');
              inp.type = 'hidden';
              inp.id = `pyplugin-in-${plugin_id}-${k}`;
              document.body.appendChild(inp);
            }
            inp.value = k === 'click_x' ? nx : ny;
          });
          // Trigger the click action
          this._callAction(plugin_id, item.action || 'on_click');
        });
      }
      wrap.appendChild(img);
      return wrap;
    }

    if (item.type === 'graph') {
      const canvas = document.createElement('canvas');
      canvas.id = `pyplugin-out-${plugin_id}-${item.id}`;
      canvas.width = 220; canvas.height = 100;
      canvas.style.cssText = 'width:100%; height:100px; background:#111; border-radius:4px; display:block;';
      canvas.dataset.points = '[]';
      canvas.dataset.xlabel = item.xlabel || 'X';
      canvas.dataset.ylabel = item.ylabel || 'Y';
      wrap.appendChild(canvas);
      return wrap;
    }

    if (item.type === 'table') {
      const container = document.createElement('div');
      container.style.cssText = 'max-height:160px; overflow-y:auto; background:var(--app-bg); border-radius:var(--radius-sm);';
      const table = document.createElement('table');
      table.id = `pyplugin-out-${plugin_id}-${item.id}`;
      table.style.cssText = 'width:100%; border-collapse:collapse; font-size:10px; font-family:monospace; color:var(--coordinates-color);';
      if (item.columns?.length) {
        const thead = table.createTHead();
        const tr = thead.insertRow();
        item.columns.forEach(col => {
          const th = document.createElement('th');
          th.textContent = col;
          th.style.cssText = 'text-align:left; padding:3px 6px; color:var(--text-general); font-weight:normal; border-bottom:1px solid var(--border); position:sticky; top:0; background:var(--app-bg);';
          tr.appendChild(th);
        });
      }
      table.createTBody();
      container.appendChild(table);
      wrap.appendChild(container);
    } else {
      const el = document.createElement('div');
      el.id = `pyplugin-out-${plugin_id}-${item.id}`;
      el.style.cssText = 'padding:4px 6px; background:var(--app-bg); border-radius:var(--radius-sm); color:var(--coordinates-color); font-family:monospace; font-size:10px; min-height:20px; word-break:break-word;';
      el.textContent = '—';
      wrap.appendChild(el);
    }
    return wrap;
  }

  // ── Action call ────────────────────────────────────────────────────────────

  _callAction(plugin_id, action_name) {
    // Collecter tous les inputs du plugin
    const params = {};
    document.querySelectorAll(`[id^="pyplugin-in-${plugin_id}-"]`).forEach(el => {
      const key = el.id.replace(`pyplugin-in-${plugin_id}-`, '');
      params[key] = (el.type === 'range' || el.type === 'number') ? parseFloat(el.value) : el.value;
    });

    const url = `${window.ENDERTRACK_SERVER || 'http://localhost:5000'}/api/pyplugins/${plugin_id}/action/${action_name}`;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) })
      .then(r => r.json())
      .then(res => { if (!res.success) window.EnderTrack?.UI?.showNotification?.(res.error, 'error'); })
      .catch(e => console.error(`[PyPlugin ${plugin_id}]`, e));
  }

  // ── SSE updates ────────────────────────────────────────────────────────────

  _updateOutput(data) {
    const els = document.querySelectorAll(`[id="pyplugin-out-${data.plugin_id}-${data.id}"]`);
    if (!els.length) return;
    els.forEach(el => {
      if (el.tagName === 'IMG') {
        el.src = 'data:image/jpeg;base64,' + data.value;
      } else if (el.tagName === 'CANVAS' && el.dataset.points !== undefined) {
        // graph
        let points = JSON.parse(el.dataset.points || '[]');
        if (data.reset) points = [];
        if (data.value !== null && data.value !== undefined) {
          if (Array.isArray(data.value[0])) points = data.value;  // array complet
          else points.push(data.value);                           // point unique [x, y]
        }
        el.dataset.points = JSON.stringify(points);
        this._drawGraph(el, points);
      } else if (el.tagName === 'TABLE') {
        const tbody = el.tBodies[0];
        if (!tbody) return;
        const tr = tbody.insertRow();
        (data.value || []).forEach(cell => {
          const td = tr.insertCell();
          td.textContent = cell;
          td.style.cssText = 'padding:2px 4px; border-bottom:1px solid #222;';
        });
        tr.scrollIntoView({ block: 'nearest' });
      } else {
        el.textContent = data.value;
      }
    });
  }

  _drawGraph(canvas, points) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const PAD = { l: 32, r: 8, t: 8, b: 20 };
    const gW = W - PAD.l - PAD.r, gH = H - PAD.t - PAD.b;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    // axes
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.l, PAD.t); ctx.lineTo(PAD.l, PAD.t + gH);
    ctx.lineTo(PAD.l + gW, PAD.t + gH);
    ctx.stroke();

    if (!points.length) return;

    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    let xMin = Math.min(...xs), xMax = Math.max(...xs);
    let yMin = Math.min(...ys), yMax = Math.max(...ys);
    if (xMin === xMax) xMax = xMin + 1;
    if (yMin === yMax) yMax = yMin + 1;

    const px = x => PAD.l + (x - xMin) / (xMax - xMin) * gW;
    const py = y => PAD.t + gH - (y - yMin) / (yMax - yMin) * gH;

    // grid + labels Y (3 ticks)
    ctx.fillStyle = '#555'; ctx.font = '8px monospace'; ctx.textAlign = 'right';
    for (let i = 0; i <= 2; i++) {
      const v = yMin + (yMax - yMin) * i / 2;
      const y = py(v);
      ctx.fillStyle = '#333';
      ctx.fillRect(PAD.l + 1, y, gW, 1);
      ctx.fillStyle = '#666';
      ctx.fillText(v.toFixed(1), PAD.l - 3, y + 3);
    }
    // labels X (3 ticks)
    ctx.textAlign = 'center';
    for (let i = 0; i <= 2; i++) {
      const v = xMin + (xMax - xMin) * i / 2;
      ctx.fillStyle = '#666';
      ctx.fillText(v.toFixed(2), px(v), PAD.t + gH + 12);
    }
    // axis labels
    ctx.fillStyle = '#888'; ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(canvas.dataset.xlabel || 'X', PAD.l + gW / 2, H - 2);
    ctx.save(); ctx.translate(8, PAD.t + gH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(canvas.dataset.ylabel || 'Y', 0, 0); ctx.restore();

    // curve
    ctx.strokeStyle = '#ffc107'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      i === 0 ? ctx.moveTo(px(x), py(y)) : ctx.lineTo(px(x), py(y));
    });
    ctx.stroke();

    // peak dot
    const maxIdx = ys.indexOf(Math.max(...ys));
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(px(xs[maxIdx]), py(ys[maxIdx]), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  _appendLog(data) {
    document.querySelectorAll(`[id^="pyplugin-out-${data.plugin_id}-"]`).forEach(el => {
      el.textContent = data.message;
    });
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.PyPluginUI = new PyPluginUI();
