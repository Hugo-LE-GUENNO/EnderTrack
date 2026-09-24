// plugins/smart-vision/ui.js

window.SmartVisionPluginUI = class SmartVisionPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
    this._running = false;
    this._cachedScript = '';
    this._cmEditor = null;       // modal editor
    this._prevLayout = 1;
  }

  init() {
    this._renderLeftPanel();
    this._renderRightPanel();
    this._loadScript();
  }

  onTabEnter() {
    this._onTabActivate();
  }
  onTabLeave() {
    this._restoreLayout();
  }

  destroy() {
    this._stopLoop();
    this._restoreLayout();
    document.getElementById('svScriptPanel').innerHTML = '';
    document.getElementById('svRightPanel')?.remove();
    document.getElementById('svEditorModal')?.remove();
  }

  // ── Tab activate ──────────────────────────────────────────────────────────

  _onTabActivate() {
    const d = window.EnderTrack?.Display;
    if (!d) return;
    this._prevLayout = d.viewports.length;
    d.setLayout(2);
    d.assignSource(0, 'stage');
    d.assignSource(1, 'camera:0');
    this._injectOverlay();
    document.getElementById('svRightPanel').style.display = 'flex';
  }

  _restoreLayout() {
    const d = window.EnderTrack?.Display;
    if (!d) return;
    this._removeOverlay();
    d.setLayout(this._prevLayout);
    document.getElementById('svRightPanel').style.display = 'none';
  }

  // ── Overlay on camera cell ────────────────────────────────────────────────

  _injectOverlay() {
    this._removeOverlay();
    const d = window.EnderTrack?.Display;
    const cell = d?._cells?.get(1) || d?._stageWrap;
    if (!cell) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'svOverlay';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    cell.appendChild(canvas);
    this._resizeObs = new ResizeObserver(() => { canvas.width = cell.clientWidth; canvas.height = cell.clientHeight; });
    this._resizeObs.observe(cell);
    canvas.width = cell.clientWidth; canvas.height = cell.clientHeight;
  }

  _removeOverlay() {
    document.getElementById('svOverlay')?.remove();
    this._resizeObs?.disconnect();
  }

  // ── Left panel ────────────────────────────────────────────────────────────

  _renderLeftPanel() {
    const el = document.getElementById('svScriptPanel');
    if (!el) return;
    el.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;gap:0;';

    const cameras = (window._cameras || []).map((c, i) => `<option value="${i}">${c.label}</option>`).join('');

    el.innerHTML = `
      <!-- Camera live toggle -->
      <div class="sv-section">
        <div class="sv-section-label">Camera live</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <select id="svCameraToggle" class="sv-select" onchange="window.SmartVisionPlugin?.ui?._onCameraToggle(this.value)">
            <option value="off">Off</option>
            ${cameras || '<option value="0">Camera 0</option>'}
          </select>
        </div>
      </div>

      <!-- Script -->
      <div class="sv-section" style="flex:1;min-height:0;display:flex;flex-direction:column;">
        <div class="sv-section-label">Python script</div>
        <div id="svScriptPreview" onclick="window.SmartVisionPlugin?.ui?._openEditor()"
          style="flex:1;min-height:60px;max-height:120px;padding:8px;background:#0d1117;border:1px solid #333;border-radius:4px;
                 font-family:monospace;font-size:11px;color:#94a3b8;cursor:pointer;overflow:hidden;
                 white-space:pre;line-height:1.5;position:relative;">
          <span id="svScriptPreviewText" style="pointer-events:none;"></span>
          <div style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:flex-end;padding:6px;
                      background:linear-gradient(to bottom,transparent 40%,#0d1117 100%);pointer-events:none;">
            <span style="font-size:10px;color:#3b82f6;background:#0d1117;padding:2px 6px;border:1px solid #3b82f6;border-radius:3px;">Edit ✎</span>
          </div>
        </div>
      </div>

      <!-- Run / Stop -->
      <div class="sv-section" style="flex-direction:row;gap:6px;">
        <button class="action-btn" style="flex:1;" id="svRunBtn" onclick="window.SmartVisionPlugin?.ui?._toggleLoop()">▶ RUN</button>
        <button class="action-btn" style="flex:1;border-color:#ef4444;color:#f87171;" onclick="window.SmartVisionPlugin?.ui?._stopLoop()">■ STOP</button>
      </div>

      <!-- Interval -->
      <div class="sv-section" style="flex-direction:row;align-items:center;gap:6px;">
        <span style="font-size:10px;color:#64748b;white-space:nowrap;">Loop interval</span>
        <input type="range" id="svInterval" min="100" max="5000" step="100" value="500"
          style="flex:1;accent-color:var(--active-element);"
          oninput="document.getElementById('svIntervalVal').textContent=this.value+'ms'">
        <span id="svIntervalVal" style="font-size:10px;color:#cbd5e1;min-width:36px;">500ms</span>
      </div>`;
  }

  _onCameraToggle(val) {
    const d = window.EnderTrack?.Display;
    if (!d) return;
    if (val === 'off') {
      d.setLayout(1);
      this._removeOverlay();
    } else {
      d.setLayout(2);
      d.assignSource(0, 'stage');
      d.assignSource(1, `camera:${val}`);
      this._injectOverlay();
    }
  }

  // ── Right panel ───────────────────────────────────────────────────────────

  _renderRightPanel() {
    let el = document.getElementById('svRightPanel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'svRightPanel';
      el.style.cssText = 'display:none;flex-direction:column;overflow:hidden;';
      document.getElementById('rightPluginZone')?.prepend(el);
    }
    el.innerHTML = `
      <div style="padding:5px 8px;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #333;flex-shrink:0;">Smart Vision</div>

      <!-- Status -->
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #222;flex-shrink:0;">
        <div id="svStatusDot" style="width:8px;height:8px;border-radius:50%;background:#555;flex-shrink:0;"></div>
        <span id="svStatusLabel" style="font-size:11px;color:var(--text-general);">Idle</span>
      </div>

      <!-- Log -->
      <div style="padding:5px 8px;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #333;flex-shrink:0;margin-top:4px;">Log</div>
      <div id="svLog" style="flex:1;overflow-y:auto;padding:6px 8px;font-size:11px;font-family:monospace;color:#94a3b8;white-space:pre-wrap;"></div>`;
  }

  // ── Script editor modal ───────────────────────────────────────────────────

  _openEditor() {
    document.getElementById('svEditorModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'svEditorModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:6000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
    modal.innerHTML = `
      <div style="width:80vw;max-width:900px;height:80vh;background:var(--column-bg);border-radius:8px;
                  box-shadow:0 8px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--container-bg);border-bottom:1px solid #333;flex-shrink:0;">
          <span style="font-size:13px;font-weight:600;flex:1;">Python script editor</span>
          <button onclick="window.SmartVisionPlugin?.ui?._saveAndCloseEditor()" 
            style="padding:4px 14px;border:none;border-radius:4px;background:var(--active-element);color:var(--text-selected);cursor:pointer;font-size:12px;">Save</button>
          <button onclick="document.getElementById('svEditorModal').remove()"
            style="padding:4px 10px;border:1px solid #444;border-radius:4px;background:transparent;color:var(--text-general);cursor:pointer;font-size:12px;">Close</button>
        </div>
        <div id="svCMWrap" style="flex:1;overflow:hidden;min-height:0;"></div>
      </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('mousedown', e => { if (e.target === modal) modal.remove(); });

    this._initCM(document.getElementById('svCMWrap'), this._cachedScript);
  }

  _saveAndCloseEditor() {
    if (this._cmEditor) {
      this._cachedScript = this._cmEditor.getValue();
      this._updatePreview();
      this.bridge.setScript(this._cachedScript);
    }
    document.getElementById('svEditorModal')?.remove();
    this._cmEditor = null;
  }

  _initCM(wrap, value) {
    if (window.CodeMirror) {
      this._cmEditor = window.CodeMirror(wrap, {
        value: value || '',
        mode: 'python',
        theme: 'dracula',
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: false,
        autofocus: true,
        extraKeys: { Tab: cm => cm.replaceSelection('    ') }
      });
      this._cmEditor.setSize('100%', '100%');
    } else {
      wrap.innerHTML = `<textarea spellcheck="false"
        style="width:100%;height:100%;padding:12px;background:#0d1117;color:#e2e8f0;border:none;
               font-family:monospace;font-size:12px;line-height:1.7;resize:none;box-sizing:border-box;outline:none;tab-size:4;"
        oninput="window.SmartVisionPlugin.ui._cmEditor={getValue:()=>this.value}"
        >${value || ''}</textarea>`;
      const ta = wrap.querySelector('textarea');
      this._cmEditor = { getValue: () => ta.value };
    }
  }

  _updatePreview() {
    const el = document.getElementById('svScriptPreviewText');
    if (el) el.textContent = (this._cachedScript || '').split('\n').slice(0, 8).join('\n');
  }

  // ── Script load ───────────────────────────────────────────────────────────

  async _loadScript() {
    const res = await this.bridge.getScript();
    this._cachedScript = res.script || '';
    this._updatePreview();
  }

  _getScript() { return this._cachedScript || ''; }

  // ── Run / Stop ────────────────────────────────────────────────────────────

  _toggleLoop() {
    if (this._running) { this._stopLoop(); return; }
    this._running = true;
    this._setStatus(true);
    const btn = document.getElementById('svRunBtn');
    if (btn) btn.textContent = '▶ RUNNING…';
    const interval = parseInt(document.getElementById('svInterval')?.value || '500');
    this.bridge.startLoop(this._getScript(), interval, res => this._handleResult(res));
  }

  _stopLoop() {
    this._running = false;
    this.bridge.stopLoop();
    this._setStatus(false);
    const btn = document.getElementById('svRunBtn');
    if (btn) btn.textContent = '▶ RUN';
    this._log('— stopped —');
  }

  _setStatus(running) {
    const dot   = document.getElementById('svStatusDot');
    const label = document.getElementById('svStatusLabel');
    if (dot)   dot.style.background   = running ? '#22c55e' : '#555';
    if (label) label.textContent      = running ? 'Running' : 'Idle';
  }

  // ── Result ────────────────────────────────────────────────────────────────

  _handleResult(res) {
    if (!res.success) { this._log('❌ ' + (res.error?.split('\n').pop() || 'Error')); return; }
    if (res.log) this._log(res.log);
    if (document.getElementById('svShowOverlay')?.checked !== false) this._drawOverlay(res.overlay || []);
    if (res.move) this.bridge.applyMove(res.move);
  }

  // ── Overlay ───────────────────────────────────────────────────────────────

  _drawOverlay(items) {
    const canvas = document.getElementById('svOverlay');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!items?.length) return;
    const liveImg = document.querySelector('#liveDisplayCanvas') || document.querySelector('img[src*="stream"]');
    const nw = liveImg?.naturalWidth || liveImg?.videoWidth || canvas.width;
    const nh = liveImg?.naturalHeight || liveImg?.videoHeight || canvas.height;
    const sx = canvas.width / nw, sy = canvas.height / nh;
    for (const item of items) {
      ctx.strokeStyle = item.color || '#00ff88';
      ctx.fillStyle   = (item.color || '#00ff88') + '33';
      ctx.lineWidth   = 2;
      if (item.type === 'circle') { ctx.beginPath(); ctx.arc(item.x*sx, item.y*sy, (item.r||10)*Math.min(sx,sy), 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
      else if (item.type === 'rect')  { ctx.fillRect(item.x*sx, item.y*sy, item.w*sx, item.h*sy); ctx.strokeRect(item.x*sx, item.y*sy, item.w*sx, item.h*sy); }
      else if (item.type === 'point') { ctx.beginPath(); ctx.arc(item.x*sx, item.y*sy, 4, 0, Math.PI*2); ctx.fill(); }
      else if (item.type === 'line')  { ctx.beginPath(); ctx.moveTo(item.x1*sx, item.y1*sy); ctx.lineTo(item.x2*sx, item.y2*sy); ctx.stroke(); }
      if (item.label) { ctx.fillStyle = item.color||'#00ff88'; ctx.font='11px monospace'; ctx.fillText(item.label, item.x*sx+6, item.y*sy-6); }
    }
  }

  // ── Log ───────────────────────────────────────────────────────────────────

  _log(msg) {
    const el = document.getElementById('svLog');
    if (!el) return;
    const ts = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.textContent += `[${ts}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
  }
};
