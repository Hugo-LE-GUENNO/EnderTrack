// plugins/python-notebook/notebook.js
class PythonNotebook {
  constructor() {
    this.cells = [];
    this.baseUrl = 'http://127.0.0.1:5000';
    this.kernelAlive = false;
    this._cmLoaded = false;
  }

  async init(baseUrl) {
    this.baseUrl = baseUrl || this.baseUrl;
    if (!this._cmLoaded) {
      await this._loadCodeMirror();
      this._cmLoaded = true;
    }
    // Show the tab
    const tab = document.getElementById('pythonTab');
    if (tab) tab.style.display = '';
    await this._checkKernel();
    this.createUI();
  }

  destroy() {
    const tab = document.getElementById('pythonTab');
    if (tab) tab.style.display = 'none';
    document.getElementById('pythonRightPanel').style.display = 'none';
  }

  // === LEFT PANEL UI ===

  createUI() {
    const container = document.getElementById('pythonTabContent');
    if (!container) return;

    container.innerHTML = `
      <div style="padding:8px; display:flex; flex-direction:column; height:100%;">
        <div style="display:flex; gap:4px; margin-bottom:8px; flex-shrink:0;">
          <button onclick="EnderTrack.PythonNotebook._addCell()" class="pynb-tb">+ Cellule</button>
          <button onclick="EnderTrack.PythonNotebook._runAll()" class="pynb-tb pynb-tb-run">▶ Tout</button>
          <span style="flex:1"></span>
          <span id="pynbKernelStatus" class="pynb-kernel-dot" title="Kernel"></span>
          <button onclick="EnderTrack.PythonNotebook._restartKernel()" class="pynb-tb">⟳</button>
        </div>
        <div id="pynbCells" style="flex:1; overflow-y:auto;"></div>
      </div>`;

    this._updateKernelDot();
    if (this.cells.length === 0) this._addCell();
    else this.cells.forEach((_, i) => this._renderCell(i));
  }

  // === CELLS ===

  _addCell(code = '') {
    const idx = this.cells.length;
    this.cells.push({ code, output: '', running: false });
    this._renderCell(idx);
    return idx;
  }

  _renderCell(idx) {
    const container = document.getElementById('pynbCells');
    if (!container) return;

    let cellEl = document.getElementById('pynbCell_' + idx);
    if (!cellEl) {
      cellEl = document.createElement('div');
      cellEl.id = 'pynbCell_' + idx;
      cellEl.className = 'pynb-cell';
      cellEl.innerHTML = `
        <div class="pynb-cell-header">
          <span class="pynb-cell-idx">[${idx + 1}]</span>
          <div class="pynb-cell-actions">
            <button onclick="EnderTrack.PythonNotebook._runCell(${idx})" class="pynb-tb pynb-tb-run" title="Shift+Enter">▶</button>
            <button onclick="EnderTrack.PythonNotebook._moveCell(${idx}, -1)" class="pynb-tb" title="Monter">▲</button>
            <button onclick="EnderTrack.PythonNotebook._moveCell(${idx}, 1)" class="pynb-tb" title="Descendre">▼</button>
            <button onclick="EnderTrack.PythonNotebook._insertCellAfter(${idx})" class="pynb-tb" title="Insérer après">+</button>
            <button onclick="EnderTrack.PythonNotebook._deleteCell(${idx})" class="pynb-tb pynb-tb-danger" title="Supprimer">✕</button>
          </div>
        </div>
        <div id="pynbEditor_${idx}" class="pynb-editor"></div>
        <pre id="pynbCellOut_${idx}" class="pynb-cell-output"></pre>`;
      container.appendChild(cellEl);
    }

    const editorEl = document.getElementById('pynbEditor_' + idx);
    if (editorEl && !editorEl._cm) {
      const cm = CodeMirror(editorEl, {
        value: this.cells[idx].code,
        mode: 'python',
        theme: 'monokai',
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: true,
        extraKeys: {
          'Shift-Enter': () => { this._runCell(idx).then(() => this._focusNextOrCreate(idx)); },
          'Ctrl-Enter': () => { this._runCell(idx); },
          'Ctrl-Space': 'autocomplete',
          'Tab': (cm) => {
            if (cm.somethingSelected()) { cm.indentSelection('add'); }
            else {
              const cur = cm.getCursor();
              const line = cm.getLine(cur.line);
              const before = line.slice(0, cur.ch);
              if (before.match(/\S$/)) { cm.showHint(); }
              else { cm.replaceSelection('    '); }
            }
          }
        },
        hintOptions: { hint: this._pythonHint.bind(this) }
      });
      cm.on('change', () => { this.cells[idx].code = cm.getValue(); });
      editorEl._cm = cm;
      setTimeout(() => cm.refresh(), 10);
    }

    const outEl = document.getElementById('pynbCellOut_' + idx);
    if (outEl) {
      outEl.textContent = this.cells[idx].output;
      outEl.style.display = this.cells[idx].output ? 'block' : 'none';
    }
  }

  _deleteCell(idx) {
    if (this.cells.length <= 1) return;
    this.cells.splice(idx, 1);
    this._rebuildCells();
  }

  _moveCell(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= this.cells.length) return;
    [this.cells[idx], this.cells[newIdx]] = [this.cells[newIdx], this.cells[idx]];
    this._rebuildCells();
  }

  _insertCellAfter(idx) {
    this.cells.splice(idx + 1, 0, { code: '', output: '', running: false });
    this._rebuildCells();
    setTimeout(() => {
      const ed = document.getElementById('pynbEditor_' + (idx + 1));
      if (ed?._cm) ed._cm.focus();
    }, 50);
  }

  _focusNextOrCreate(idx) {
    const next = idx + 1;
    if (next >= this.cells.length) this._addCell();
    else setTimeout(() => {
      const ed = document.getElementById('pynbEditor_' + next);
      if (ed?._cm) ed._cm.focus();
    }, 50);
  }

  _rebuildCells() {
    const container = document.getElementById('pynbCells');
    if (container) container.innerHTML = '';
    this.cells.forEach((_, i) => this._renderCell(i));
  }

  // === EXECUTION ===

  async _runCell(idx) {
    const cell = this.cells[idx];
    if (!cell || cell.running) return;

    cell.running = true;
    const cellOut = document.getElementById('pynbCellOut_' + idx);
    if (cellOut) { cellOut.textContent = '⏳...'; cellOut.style.display = 'block'; }
    const cellEl = document.getElementById('pynbCell_' + idx);
    cellEl?.classList.add('pynb-cell-running');

    // Show right panel
    const rightPanel = document.getElementById('pythonRightPanel');
    if (rightPanel) rightPanel.style.display = 'block';

    try {
      const resp = await fetch(this.baseUrl + '/api/kernel/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cell.code, timeout: 30 }),
        signal: AbortSignal.timeout(35000)
      });
      const data = await resp.json();
      cell.output = data.output || '';
      this.kernelAlive = data.alive !== false;
    } catch (e) {
      cell.output = '❌ ' + e.message;
    }

    cell.running = false;
    cellEl?.classList.remove('pynb-cell-running');

    // Update cell inline output
    if (cellOut) {
      cellOut.textContent = cell.output;
      cellOut.style.display = cell.output ? 'block' : 'none';
      cellOut.classList.toggle('pynb-output-error', cell.output.includes('Error') || cell.output.includes('Traceback'));
    }

    // Sync position with EnderTrack simulator
    await this._syncPosition();
    // Refresh variables in right panel
    await this._refreshVars();
    this._updateKernelDot();
  }

  async _syncPosition() {
    try {
      const resp = await fetch(this.baseUrl + '/api/kernel/sync', { signal: AbortSignal.timeout(2000) });
      const data = await resp.json();
      if (data.success && data.events?.length) {
        for (const evt of data.events) {
          const x = evt.x, y = evt.y, z = evt.z;
          if (window.EnderTrack?.Movement) {
            await window.EnderTrack.Movement.moveAbsolute(x, y, z);
          } else if (window.EnderTrack?.State) {
            window.EnderTrack.State.update({ pos: { x, y, z } });
            window.EnderTrack.Canvas?.requestRender?.();
          }
        }
      }
    } catch {}
  }

  async _refreshVars() {
    const panel = document.getElementById('pythonRightPanel');
    if (panel) panel.style.display = 'block';
    const el = document.getElementById('pynbVarsPanel');
    if (!el) return;
    try {
      const resp = await fetch(this.baseUrl + '/api/kernel/variables', { signal: AbortSignal.timeout(3000) });
      const data = await resp.json();
      if (data.success && data.variables) {
        const entries = Object.entries(data.variables);
        if (entries.length === 0) {
          el.innerHTML = '<div style="opacity:0.4; padding:4px;">Aucune variable</div>';
        } else {
          el.innerHTML = entries.map(([k, v]) =>
            `<div style="display:flex; justify-content:space-between; padding:2px 4px; border-bottom:1px solid #333;"><span style="color:var(--coordinates-color); font-family:monospace;">${k}</span><span style="font-family:monospace; opacity:0.6; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${v}</span></div>`
          ).join('');
        }
      }
    } catch { el.innerHTML = '<div style="opacity:0.4; padding:4px;">Serveur non connect\u00e9</div>'; }
  }

  async _runAll() {
    for (let i = 0; i < this.cells.length; i++) {
      await this._runCell(i);
      if (!this.kernelAlive) break;
    }
  }

  async _restartKernel() {
    try {
      await fetch(this.baseUrl + '/api/kernel/stop', { method: 'POST' });
      await fetch(this.baseUrl + '/api/kernel/start', { method: 'POST' });
      this.kernelAlive = true;
    } catch { this.kernelAlive = false; }
    this._updateKernelDot();
    this.cells.forEach((c, i) => {
      c.output = '';
      const out = document.getElementById('pynbCellOut_' + i);
      if (out) { out.textContent = ''; out.style.display = 'none'; }
    });
    this._refreshVars();
  }

  async _checkKernel() {
    try {
      const resp = await fetch(this.baseUrl + '/api/kernel/status', { signal: AbortSignal.timeout(3000) });
      const data = await resp.json();
      this.kernelAlive = data.alive;
    } catch { this.kernelAlive = false; }
  }

  _updateKernelDot() {
    const color = this.kernelAlive ? '#22c55e' : '#ef4444';
    const title = this.kernelAlive ? 'Kernel actif' : 'Kernel arrêté';
    ['pynbKernelStatus', 'pynbKernelDot'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.background = color; el.title = title; }
    });
  }

  // === AUTOCOMPLETE ===

  _pythonHint(cm) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const end = cursor.ch;
    let start = end;
    while (start > 0 && /[\w.]/.test(line.charAt(start - 1))) start--;
    const token = line.slice(start, end);

    const keywords = [
      'import', 'from', 'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while',
      'try', 'except', 'finally', 'with', 'as', 'pass', 'break', 'continue', 'print',
      'range', 'len', 'int', 'float', 'str', 'list', 'dict', 'True', 'False', 'None',
      'time.sleep', 'math.sqrt', 'math.abs', 'json.dumps', 'json.loads',
      'stage', 'stage.move_absolute', 'stage.move_relative', 'stage.move_position',
      'stage.get_position', 'stage.home', 'stage.send_gcode', 'stage.close',
      'Stage', 'SimStage', 'ScanPatterns',
      'ScanPatterns.raster', 'ScanPatterns.snake', 'ScanPatterns.spiral',
      'numpy', 'np', 'np.array', 'np.zeros', 'np.ones', 'np.arange', 'np.linspace',
    ];

    const matches = keywords.filter(k => k.startsWith(token));
    return { list: matches, from: CodeMirror.Pos(cursor.line, start), to: CodeMirror.Pos(cursor.line, end) };
  }

  // === CODEMIRROR LOADER ===

  async _loadCodeMirror() {
    const cdnBase = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16';
    const load = (url) => new Promise((resolve, reject) => {
      if (url.endsWith('.css')) {
        if (document.querySelector(`link[href="${url}"]`)) return resolve();
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = url;
        link.onload = resolve; link.onerror = reject;
        document.head.appendChild(link);
      } else {
        if (document.querySelector(`script[src="${url}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = url; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      }
    });

    await load(cdnBase + '/codemirror.min.css');
    await load(cdnBase + '/theme/monokai.min.css');
    await load(cdnBase + '/codemirror.min.js');
    await load(cdnBase + '/mode/python/python.min.js');
    await load(cdnBase + '/addon/hint/show-hint.min.css');
    await load(cdnBase + '/addon/hint/show-hint.min.js');
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.PythonNotebook = new PythonNotebook();
