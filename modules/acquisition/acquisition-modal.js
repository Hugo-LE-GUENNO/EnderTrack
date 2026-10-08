// modules/acquisition/acquisition-modal.js — Acquisition wizard modal

class AcquisitionModal {
  constructor() {
    this._selectedType = 'timelapse';
    this._params = {};
    this._combos = { zstack: false, timelapse: false };
  }

  open() {
    this._resetParams();
    this._render();
  }

  close() {
    document.getElementById('acqModal')?.remove();
  }

  _resetParams() {
    const pos = window.EnderTrack?.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
    this._params = {
      // Timelapse
      interval: 10, count: 10,
      // Z-Stack
      zStart: Math.max(0, pos.z - 0.5), zEnd: pos.z + 0.5, zStep: 0.05,
      // Multi-pos
      listId: '', delay: 0.5,
      // Mosaic
      gridX: 3, gridY: 3, overlap: 10, direction: 'snake',
      // Common
      format: 'tiff', lightChannel: '', prefix: 'acq',
      // Combos
      enableTimelapse: false, enableZStack: false
    };
  }

  _render() {
    document.getElementById('acqModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'acqModal';
    modal.style.cssText = 'position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6);';
    modal.innerHTML = `
      <div style="background:var(--container-bg); border-radius:8px; width:420px; max-height:80vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <div style="padding:12px 16px; border-bottom:1px solid #333; display:flex; align-items:center; justify-content:space-between;">
          <span style="font-size:13px; font-weight:600; color:var(--text-selected);">Nouvelle acquisition</span>
          <button onclick="EnderTrack.AcquisitionModal.close()" style="background:none; border:none; color:var(--text-general); cursor:pointer; font-size:16px;">✕</button>
        </div>
        <div style="padding:12px 16px;">
          ${this._renderTypeSelector()}
          <div id="acqModalParams" style="margin-top:12px;">
            ${this._renderParams()}
          </div>
          ${this._renderCombos()}
          ${this._renderCommon()}
          ${this._renderPreview()}
        </div>
        <div style="padding:12px 16px; border-top:1px solid #333; display:flex; gap:8px; justify-content:flex-end;">
          <button onclick="EnderTrack.AcquisitionModal.close()" style="padding:8px 16px; border:none; border-radius:4px; cursor:pointer; font-size:11px; background:var(--app-bg); color:var(--text-general);">Annuler</button>
          <button onclick="EnderTrack.AcquisitionModal._generate()" style="padding:8px 16px; border:none; border-radius:4px; cursor:pointer; font-size:11px; background:var(--active-element); color:var(--text-selected); font-weight:600;">▶ Générer</button>
        </div>
      </div>`;

    modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });
    document.body.appendChild(modal);
  }

  _renderTypeSelector() {
    const types = [
      { id: 'timelapse', icon: '⏱️', name: 'Time-lapse' },
      { id: 'zstack', icon: '📚', name: 'Z-Stack' },
      { id: 'multipos', icon: '📍', name: 'Multi-pos' },
      { id: 'mosaic', icon: '🧩', name: 'Mosaïque' }
    ];
    return `<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px;">
      ${types.map(t => `
        <button onclick="EnderTrack.AcquisitionModal._setType('${t.id}')"
          style="padding:8px 4px; border:${this._selectedType === t.id ? '2px solid var(--active-element)' : '1px solid #444'}; border-radius:6px; cursor:pointer; font-size:10px; background:${this._selectedType === t.id ? 'var(--app-bg)' : 'transparent'}; color:var(--text-selected); text-align:center;">
          <div style="font-size:16px;">${t.icon}</div>${t.name}
        </button>
      `).join('')}
    </div>`;
  }

  _renderParams() {
    const p = this._params;
    switch (this._selectedType) {
      case 'timelapse': return this._fieldGroup([
        this._field('Intervalle (s)', 'number', 'interval', p.interval, { min: 0.1, step: 0.1 }),
        this._field('Nombre d\'images', 'number', 'count', p.count, { min: 1 })
      ]);
      case 'zstack': return this._fieldGroup([
        this._field('Z début (mm)', 'number', 'zStart', p.zStart, { step: 0.01 }),
        this._field('Z fin (mm)', 'number', 'zEnd', p.zEnd, { step: 0.01 }),
        this._field('Pas Z (mm)', 'number', 'zStep', p.zStep, { min: 0.001, step: 0.005 })
      ]);
      case 'multipos': return this._fieldGroup([
        this._fieldListSelect('Liste', 'listId', p.listId),
        this._field('Délai entre pos (s)', 'number', 'delay', p.delay, { min: 0, step: 0.1 })
      ]);
      case 'mosaic': return this._fieldGroup([
        this._field('Colonnes', 'number', 'gridX', p.gridX, { min: 1 }),
        this._field('Lignes', 'number', 'gridY', p.gridY, { min: 1 }),
        this._field('Overlap (%)', 'number', 'overlap', p.overlap, { min: 0, max: 50 }),
        this._fieldSelect('Direction', 'direction', p.direction, [
          { value: 'snake', label: 'Serpentin' },
          { value: 'raster', label: 'Raster' },
          { value: 'spiral', label: 'Spirale' }
        ])
      ]);
      default: return '';
    }
  }

  _renderCombos() {
    if (this._selectedType === 'timelapse' || this._selectedType === 'zstack') return '';
    const p = this._params;
    let html = '<div style="margin-top:12px; padding-top:8px; border-top:1px solid #333;">';
    html += '<div style="font-size:10px; color:var(--text-general); margin-bottom:6px;">Combiner avec :</div>';
    html += '<div style="display:flex; gap:12px;">';

    if (this._selectedType !== 'zstack') {
      html += `<label style="font-size:10px; cursor:pointer; display:flex; align-items:center; gap:4px;">
        <input type="checkbox" ${p.enableZStack ? 'checked' : ''} onchange="EnderTrack.AcquisitionModal._setParam('enableZStack', this.checked); EnderTrack.AcquisitionModal._refresh()">
        <span style="color:var(--text-general);">📚 Z-Stack</span>
      </label>`;
    }
    if (this._selectedType !== 'timelapse') {
      html += `<label style="font-size:10px; cursor:pointer; display:flex; align-items:center; gap:4px;">
        <input type="checkbox" ${p.enableTimelapse ? 'checked' : ''} onchange="EnderTrack.AcquisitionModal._setParam('enableTimelapse', this.checked); EnderTrack.AcquisitionModal._refresh()">
        <span style="color:var(--text-general);">⏱️ Time-lapse</span>
      </label>`;
    }
    html += '</div>';

    // Show combo params
    if (p.enableZStack && this._selectedType !== 'zstack') {
      html += '<div style="margin-top:8px; padding:8px; background:var(--app-bg); border-radius:4px;">';
      html += this._fieldGroup([
        this._field('Z début', 'number', 'zStart', p.zStart, { step: 0.01 }),
        this._field('Z fin', 'number', 'zEnd', p.zEnd, { step: 0.01 }),
        this._field('Pas Z', 'number', 'zStep', p.zStep, { min: 0.001, step: 0.005 })
      ]);
      html += '</div>';
    }
    if (p.enableTimelapse && this._selectedType !== 'timelapse') {
      html += '<div style="margin-top:8px; padding:8px; background:var(--app-bg); border-radius:4px;">';
      html += this._fieldGroup([
        this._field('Intervalle (s)', 'number', 'interval', p.interval, { min: 0.1, step: 0.1 }),
        this._field('Répétitions', 'number', 'count', p.count, { min: 1 })
      ]);
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  _renderCommon() {
    const p = this._params;
    const channels = window.EnderTrack?.Light?.getChannels() || [];
    const channelOpts = [{ value: '', label: '— Aucun —' }, ...channels.map(c => ({ value: c.id, label: c.name }))];
    return `
      <div style="margin-top:12px; padding-top:8px; border-top:1px solid #333;">
        <div style="font-size:10px; color:var(--text-general); margin-bottom:6px;">Options communes</div>
        ${this._fieldGroup([
          this._fieldSelect('Format', 'format', p.format, [
            { value: 'tiff', label: 'TIFF' },
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPEG' }
          ]),
          this._fieldSelect('Éclairage', 'lightChannel', p.lightChannel, channelOpts),
          this._field('Préfixe fichier', 'text', 'prefix', p.prefix)
        ])}
      </div>`;
  }

  _renderPreview() {
    const est = this._estimateStats();
    return `
      <div style="margin-top:12px; padding:8px; background:var(--app-bg); border-radius:4px;">
        <div style="font-size:10px; color:var(--text-general); display:flex; justify-content:space-between;">
          <span>📊 Estimation</span>
          <span style="color:var(--coordinates-color); font-family:monospace;">${est.images} images · ~${est.duration}</span>
        </div>
      </div>`;
  }

  _estimateStats() {
    const p = this._params;
    let images = 1, seconds = 0;
    switch (this._selectedType) {
      case 'timelapse':
        images = p.count;
        seconds = p.count * p.interval;
        break;
      case 'zstack':
        images = Math.max(1, Math.round(Math.abs(p.zEnd - p.zStart) / Math.max(0.001, p.zStep)) + 1);
        seconds = images * 1;
        break;
      case 'multipos': {
        const list = window.EnderTrack?.Lists?.manager?.getList?.(p.listId);
        const n = list?.positions?.length || 1;
        images = n;
        seconds = n * (p.delay + 1);
        break;
      }
      case 'mosaic':
        images = p.gridX * p.gridY;
        seconds = images * 2;
        break;
    }
    // Combos multiply
    if (p.enableZStack && this._selectedType !== 'zstack') {
      const zSteps = Math.max(1, Math.round(Math.abs(p.zEnd - p.zStart) / Math.max(0.001, p.zStep)) + 1);
      images *= zSteps;
      seconds *= zSteps;
    }
    if (p.enableTimelapse && this._selectedType !== 'timelapse') {
      images *= p.count;
      seconds = p.count * Math.max(p.interval, seconds);
    }
    const dur = seconds < 60 ? `${Math.round(seconds)}s` : seconds < 3600 ? `${Math.round(seconds / 60)}min` : `${(seconds / 3600).toFixed(1)}h`;
    return { images, duration: dur };
  }

  // === FIELD HELPERS ===

  _fieldGroup(fields) {
    return `<div style="display:flex; flex-direction:column; gap:6px;">${fields.join('')}</div>`;
  }

  _field(label, type, key, value, opts = {}) {
    const attrs = Object.entries(opts).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<div style="display:flex; align-items:center; gap:8px;">
      <label style="font-size:10px; color:var(--text-general); width:110px;">${label}</label>
      <input type="${type}" value="${value}" ${attrs}
        onchange="EnderTrack.AcquisitionModal._setParam('${key}', ${type === 'number' ? 'parseFloat(this.value)' : 'this.value'}); EnderTrack.AcquisitionModal._refreshPreview()"
        style="flex:1; padding:4px 6px; background:var(--app-bg); border:1px solid #444; border-radius:4px; color:var(--coordinates-color); font-size:11px; font-family:monospace;">
    </div>`;
  }

  _fieldSelect(label, key, value, options) {
    return `<div style="display:flex; align-items:center; gap:8px;">
      <label style="font-size:10px; color:var(--text-general); width:110px;">${label}</label>
      <select onchange="EnderTrack.AcquisitionModal._setParam('${key}', this.value); EnderTrack.AcquisitionModal._refreshPreview()"
        style="flex:1; padding:4px 6px; background:var(--app-bg); border:1px solid #444; border-radius:4px; color:var(--text-selected); font-size:11px;">
        ${options.map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
    </div>`;
  }

  _fieldListSelect(label, key, value) {
    const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
    const options = lists.map(l => ({ value: String(l.id), label: `${l.name} (${l.positions?.length || 0} pts)` }));
    if (!value && options.length) { value = options[0].value; this._params[key] = value; }
    return this._fieldSelect(label, key, value, options);
  }

  // === ACTIONS ===

  _setType(type) {
    this._selectedType = type;
    this._render();
  }

  _setParam(key, value) {
    this._params[key] = value;
  }

  _refresh() {
    this._render();
  }

  _refreshPreview() {
    // Just update the preview section without full re-render
    const est = this._estimateStats();
    const el = document.querySelector('#acqModal [style*="Estimation"]')?.parentElement;
    if (el) {
      el.innerHTML = `<div style="font-size:10px; color:var(--text-general); display:flex; justify-content:space-between;">
        <span>📊 Estimation</span>
        <span style="color:var(--coordinates-color); font-family:monospace;">${est.images} images · ~${est.duration}</span>
      </div>`;
    }
  }

  _generate() {
    const p = this._params;
    let templateId = this._selectedType;

    // Handle combos
    if (this._selectedType === 'multipos' && p.enableZStack) templateId = 'multipos_zstack';

    // For mosaic, generate the list first then use multipos
    if (this._selectedType === 'mosaic') {
      this._generateMosaicList();
      templateId = p.enableZStack ? 'multipos_zstack' : 'multipos';
    }

    // Wrap in timelapse if enabled
    if (p.enableTimelapse && this._selectedType !== 'timelapse') {
      // Generate inner scenario first
      const inner = window.EnderTrack.Acquisition.templates.get(templateId)?.generate(p);
      if (inner) {
        const tree = {
          type: 'root',
          children: [{
            type: 'loop', loopId: 'simple',
            params: { count: p.count, countMode: 'number', loopVar: '$t', label: `Time-lapse (${p.count}x)`, showInLog: true, logMessage: '⏱️ Cycle $t' },
            children: [
              ...inner.children,
              { type: 'action', actionId: 'wait', params: { duration: p.interval, showInLog: false, label: 'Intervalle' } }
            ]
          }]
        };
        this._injectScenario(`⏱️+${this._selectedType}`, tree);
        this.close();
        return;
      }
    }

    window.EnderTrack.Acquisition.generate(templateId, p);
    this.close();
  }

  _generateMosaicList() {
    const p = this._params;
    const pos = window.EnderTrack?.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
    const camera = window.EnderTrack?.Camera;
    // Estimate FOV from camera config
    const pixelSize = camera?.config?.pixelSize || 7.12; // µm/px
    const res = camera?.config?.resolution || [640, 480];
    const fovX = (res[0] * pixelSize) / 1000; // mm
    const fovY = (res[1] * pixelSize) / 1000; // mm
    const stepX = fovX * (1 - p.overlap / 100);
    const stepY = fovY * (1 - p.overlap / 100);

    // Generate grid positions
    const positions = [];
    for (let row = 0; row < p.gridY; row++) {
      const cols = p.direction === 'snake' && row % 2 === 1
        ? Array.from({ length: p.gridX }, (_, i) => p.gridX - 1 - i)
        : Array.from({ length: p.gridX }, (_, i) => i);
      for (const col of cols) {
        positions.push({
          x: pos.x + col * stepX,
          y: pos.y + row * stepY,
          z: pos.z
        });
      }
    }

    // Create list
    const listManager = window.EnderTrack?.Lists?.manager;
    if (listManager) {
      const list = listManager.createList?.(`Mosaïque ${p.gridX}×${p.gridY}`) ||
        { id: 'mosaic_' + Date.now(), name: `Mosaïque ${p.gridX}×${p.gridY}`, positions: [] };
      if (list.positions !== undefined) {
        list.positions = positions;
        listManager.save?.();
      }
      this._params.listId = String(list.id);
    }
  }

  _injectScenario(name, tree) {
    const manager = window.EnderTrack?.Scenario?.manager;
    if (!manager) return;
    const scenario = manager.createScenario(name);
    scenario.tree = tree;
    manager.save();
    window.EnderTrack.Scenario.updateCanvasOverlay();
    window.EnderTrack.Scenario.createUI();
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.AcquisitionModal = new AcquisitionModal();
