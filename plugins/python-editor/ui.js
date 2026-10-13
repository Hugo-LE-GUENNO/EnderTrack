window._peShowExamples = async function(ui) {
  document.getElementById('peExamplesModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'peExamplesModal';
  modal.className = 'enderscope-modal-backdrop';
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  const inner = document.createElement('div');
  inner.className = 'enderscope-modal';
  inner.style.maxWidth = '420px';
  const header = document.createElement('div');
  header.className = 'enderscope-modal-header';
  header.innerHTML = '<h3>📚 Examples</h3>';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u2715';
  closeBtn.onclick = () => modal.remove();
  header.appendChild(closeBtn);
  inner.appendChild(header);

  const body = document.createElement('div');
  body.className = 'enderscope-modal-body';
  body.style.fontSize = '11px';

  const hint = document.createElement('div');
  hint.style.cssText = 'margin-bottom:6px; opacity:0.6; font-size:12px;';
  hint.textContent = 'Current cells will be replaced.';
  body.appendChild(hint);

  const credit = document.createElement('div');
  credit.style.cssText = 'margin-bottom:12px; font-size:13px;';
  credit.innerHTML = 'Examples adapted from <a href="https://github.com/mutterer/enderscopy" target="_blank" style="color:#aad4f5; text-decoration:none;">github.com/mutterer/enderscopy ↗</a>';
  body.appendChild(credit);

  // Fetch example list
  const files = [
    { file: 'examples/02_stage_basics.json',  label: 'Stage basics' },
    { file: 'examples/03_advanced_stage.json', label: 'Advanced stage' },
    { file: 'examples/06_scan_grid.json',      label: 'Scan grid (12 wells)' },
    { file: 'examples/07_scan_patterns.json',  label: 'Scan patterns' },
  ];

  for (const f of files) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:4px; cursor:pointer; color:var(--text-general); border:1px solid transparent;';
    row.onmouseover = () => row.style.borderColor = 'var(--active-element)';
    row.onmouseout  = () => row.style.borderColor = 'transparent';
    row.onclick = async () => {
      try {
        const base = window.location.origin;
        const pluginBase = '/plugins/python-editor/';
        const resp = await fetch(base + pluginBase + f.file);
        const data = await resp.json();
        modal.remove();
        ui._loadExample(data);
      } catch(e) {
        console.error('Failed to load example:', e);
      }
    };
    const label = document.createElement('span');
    label.style.cssText = 'flex:1; font-size:13px;';
    label.textContent = f.label;
    const arrow = document.createElement('span');
    arrow.style.cssText = 'font-size:9px; opacity:0.4;';
    arrow.textContent = 'load';
    row.appendChild(label);
    row.appendChild(arrow);
    body.appendChild(row);
  }

  inner.appendChild(body);
  modal.appendChild(inner);
  document.body.appendChild(modal);
};

const _PE_COMPLETIONS = [
  { label: 'stage.get_position()',                    insert: 'x, y, z = stage.get_position()\nprint(x, y, z)' },
  { label: 'stage.move_absolute(x, y, z)',            insert: 'stage.move_absolute(10, 20, 0)' },
  { label: 'stage.move_relative(dx, dy, dz)',         insert: 'stage.move_relative(1, 0, 0)' },
  { label: 'stage.move_towards(direction, distance)', insert: "stage.move_towards('north', 5)" },
  { label: 'stage.move_axis(axis, distance)',         insert: "stage.move_axis('x', 5)" },
  { label: 'stage.home()',                            insert: 'stage.home()' },
  { label: 'stage.safe_home()',                       insert: 'stage.safe_home()' },
  { label: 'stage.set_speed(speed)',                  insert: 'stage.set_speed(3000)' },
  { label: 'stage.finish_moves()',                    insert: 'stage.finish_moves()' },
  { label: 'stage.send_gcode(cmd)',                   insert: 'print(stage.send_gcode("M114"))' },
];

window._peAutocomplete = function(cm) {
  document.getElementById('peAcDropdown')?.remove();
  if (!cm) return;

  const cur = cm.getCursor();
  const prefix = cm.getLine(cur.line).slice(0, cur.ch).match(/[\w.]*$/)[0];
  if (!prefix) return;
  const matches = _PE_COMPLETIONS.filter(c => c.label.startsWith(prefix));
  if (!matches.length) return;

  const coords = cm.cursorCoords(true, 'window');
  const dd = document.createElement('div');
  dd.id = 'peAcDropdown';
  dd.style.cssText = `position:fixed; left:${coords.left}px; top:${coords.bottom + 2}px;
    background:var(--container-bg); border:1px solid var(--active-element); border-radius:4px;
    z-index:9999; min-width:260px; box-shadow:0 4px 12px #0008; font-size:11px; font-family:monospace;`;

  let selected = 0;

  const rows = matches.map((c, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:5px 10px; cursor:pointer; color:var(--text-general);';
    row.textContent = c.label;
    row.onmouseover = () => { selected = i; _highlight(); };
    row.onmousedown = e => { e.preventDefault(); _apply(i); };
    dd.appendChild(row);
    return row;
  });

  function _highlight() {
    rows.forEach((r, i) => r.style.background = i === selected ? 'var(--active-element)' : '');
  }

  function _apply(i) {
    dd.remove();
    document.removeEventListener('keydown', _onKey, true);
    document.removeEventListener('mousedown', _onOutside);
    const wordStart = cm.getLine(cur.line).slice(0, cur.ch).search(/[\w.]*$/);
    cm.replaceRange(matches[i].insert, { line: cur.line, ch: wordStart }, cur);
    cm.focus();
  }

  function _onKey(e) {
    if (!document.getElementById('peAcDropdown')) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); selected = (selected + 1) % rows.length; _highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selected = (selected - 1 + rows.length) % rows.length; _highlight(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); _apply(selected); }
    else if (e.key === 'Escape') { dd.remove(); document.removeEventListener('keydown', _onKey, true); }
  }

  function _onOutside(e) { if (!dd.contains(e.target)) { dd.remove(); document.removeEventListener('mousedown', _onOutside); document.removeEventListener('keydown', _onKey, true); } }

  _highlight();
  document.body.appendChild(dd);
  document.addEventListener('keydown', _onKey, true);
  setTimeout(() => document.addEventListener('mousedown', _onOutside), 0);
};

window.PythonEditorPluginUI = class PythonEditorPluginUI {
  constructor(manifest, bridge) {
    this.manifest = manifest;
    this.bridge = bridge;
    this._cells = [];
    this._focusedCell = null;
    this._running = false;
    this._counter = 0;
  }

  init() {}

  onTabEnter() {
    this._build();
    this._buildRightPanel();
    this._showRightPanel(true);
  }

  onTabLeave() {
    this._showRightPanel(false);
  }

  destroy() {
    this._running = false;
    document.getElementById('peRightPanel')?.remove();
  }

  // ── Main layout ────────────────────────────────────────────────────────────

  _build() {
    const panel = document.getElementById('pythonEditorTabContent');
    if (!panel) return;
    if (panel._peInit) return;
    panel._peInit = true;
    panel.style.cssText = 'flex-direction:column; height:100%; overflow:hidden;';

    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex; gap:4px; padding:6px; flex-shrink:0; border-bottom:1px solid var(--border); align-items:center;';
    toolbar.innerHTML =
      '<button id="peAddBtn" style="padding:4px 10px; border:1px solid #444; border-radius:var(--radius-small); cursor:pointer; font-size:11px; background:var(--app-bg); color:var(--text-general);">+ Cell</button>' +
      '<div style="flex:1"></div>' +
      '<button id="peExamplesBtn" style="padding:4px 8px; border:1px solid #444; border-radius:var(--radius-small); cursor:pointer; font-size:11px; background:var(--app-bg); color:var(--text-general);">📚</button>' +
      '<button id="pePopoutBtn" title="Popout" style="padding:4px 8px; border:1px solid #444; border-radius:var(--radius-small); cursor:pointer; font-size:11px; background:var(--app-bg); color:var(--text-general);">⤢</button>' +
      '<button id="peResetBtn" style="padding:4px 10px; border:none; border-radius:var(--radius-small); cursor:pointer; font-size:11px; background:var(--app-bg); color:var(--text-general);">Reset kernel</button>';
    panel.appendChild(toolbar);

    const container = document.createElement('div');
    container.id = 'peCellsContainer';
    container.style.cssText = 'flex:1; overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:8px;';
    panel.appendChild(container);

    document.getElementById('peAddBtn').onclick = () => this._addCell();
    document.getElementById('peResetBtn').onclick = () => this._resetKernel();
    document.getElementById('peExamplesBtn').onclick = () => window._peShowExamples(this);
    document.getElementById('pePopoutBtn').onclick = () => this._togglePopout();

    this._restoreCells();
  }

  // ── Cell ──────────────────────────────────────────────────────────────────

  _addCell(code, savedHeight) {
    const container = document.getElementById('peCellsContainer');
    if (!container) return null;

    const id = ++this._counter;
    const cell = { id, cm: null, wrap: null };
    const height = savedHeight || 120;

    const wrap = document.createElement('div');
    wrap.dataset.cellId = id;
    wrap.style.cssText = 'border:1px solid #333; border-radius:4px; overflow:hidden; flex-shrink:0; display:flex; flex-direction:column;';

    // Cell toolbar
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex; align-items:center; gap:4px; padding:3px 6px; background:var(--container-bg); border-bottom:1px solid #333; flex-shrink:0;';
    bar.innerHTML =
      '<button class="peRunCell" style="padding:2px 10px; border:none; border-radius:var(--radius-small); cursor:pointer; font-size:10px; background:var(--active-element); color:var(--text-selected);">Run</button>' +
      '<div style="flex:1"></div>' +
      '<button class="peDelCell" style="padding:2px 6px; border:none; background:none; cursor:pointer; font-size:12px; color:#555;">\u2715</button>';
    wrap.appendChild(bar);

    // Editor area — resizable via handle
    const editorWrap = document.createElement('div');
    editorWrap.style.cssText = 'height:' + height + 'px; overflow:hidden; position:relative;';
    wrap.appendChild(editorWrap);

    // Resize handle
    const handle = document.createElement('div');
    handle.style.cssText = 'height:5px; background:#222; cursor:ns-resize; flex-shrink:0; border-top:1px solid #333;';
    handle.title = 'Drag to resize';
    wrap.appendChild(handle);

    container.appendChild(wrap);

    // CodeMirror
    if (window.CodeMirror) {
      cell.cm = CodeMirror(editorWrap, {
        value: code || '',
        mode: 'python',
        theme: 'dracula',
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: false,
        extraKeys: {
          'Ctrl-Enter': () => this._runCell(cell),
          'Cmd-Enter':  () => this._runCell(cell),
          'Tab': cm => cm.replaceSelection('    '),
          'Ctrl-Space': cm => window._peAutocomplete(cm)
        }
      });
      cell.cm.setSize('100%', '100%');
      cell.cm.on('focus', () => { this._focusedCell = cell; this._highlightCell(wrap); });
      cell.cm.on('change', (cm, change) => {
        if (change.origin === '+input') window._peAutocomplete(cm);
      });
    }

    cell.wrap = wrap;
    cell.editorWrap = editorWrap;

    bar.querySelector('.peRunCell').onclick = () => this._runCell(cell);
    bar.querySelector('.peDelCell').onclick = () => this._deleteCell(cell);

    // Resize drag
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = editorWrap.offsetHeight;
      const onMove = ev => {
        const newH = Math.max(60, startH + ev.clientY - startY);
        editorWrap.style.height = newH + 'px';
        cell.cm?.setSize('100%', '100%');
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        this._saveCells();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    this._cells.push(cell);
    this._focusedCell = cell;
    this._highlightCell(wrap);
    this._saveCells();
    return cell;
  }

  _highlightCell(wrap) {
    document.querySelectorAll('#peCellsContainer > div').forEach(el => el.style.borderColor = '#333');
    if (wrap) wrap.style.borderColor = 'var(--active-element)';
  }

  _deleteCell(cell) {
    cell.wrap.remove();
    this._cells = this._cells.filter(c => c !== cell);
    if (this._focusedCell === cell) this._focusedCell = this._cells[this._cells.length - 1] || null;
    if (this._cells.length === 0) this._addCell();
    this._saveCells();
  }

  // ── Run ───────────────────────────────────────────────────────────────────

  async _runCell(cell) {
    if (this._running) return;
    this._running = true;
    const btn = cell.wrap.querySelector('.peRunCell');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    const script = cell.cm ? cell.cm.getValue() : '';
    this._logRight('[' + (cell.id) + '] Running...\n', '#888');
    try {
      const data = await this.bridge.run(script);
      if (data.output) this._logRight(data.output);
      if (data.error)  this._logRight(data.error, '#ef4444');
      if (data.success && !data.error) this._logRight('Done\n', '#22c55e');
    } catch(e) {
      this._logRight(e.message + '\n', '#ef4444');
    } finally {
      this._running = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Run'; }
      this._saveCells();
    }
  }

  _loadExample(data) {
    // Clear existing cells
    const container = document.getElementById('peCellsContainer');
    if (!container) return;
    container.innerHTML = '';
    this._cells = [];
    this._focusedCell = null;
    this._counter = 0;
    // Load new cells
    for (const c of data.cells) {
      const comment = c.comment ? '# ' + c.comment.replace(/\n/g, '\n# ') + '\n' : '';
      this._addCell(comment + c.code);
    }
    this._logRight('Loaded: ' + data.title + '\n', '#888');
  }

  async _resetKernel() {
    await this.bridge.reset();
    const out = document.getElementById('peOutput');
    if (out) out.innerHTML = '';
    this._logRight('Kernel reset\n', '#888');
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  _saveCells() {
    const data = this._cells.map(c => ({
      code: c.cm?.getValue() || '',
      height: c.editorWrap?.offsetHeight || 120
    }));
    localStorage.setItem('pe_cells', JSON.stringify(data));
  }

  _restoreCells() {
    try {
      const saved = JSON.parse(localStorage.getItem('pe_cells') || '[]');
      if (saved.length) {
        saved.forEach(s => this._addCell(s.code, s.height));
        return;
      }
    } catch {}
    this._addCell('# stage, np, cv2 available\nx, y, z = stage.get_position()\nprint("Position:", x, y, z)');
  }

  // ── Right panel ───────────────────────────────────────────────────────────

  _buildRightPanel() {
    if (document.getElementById('peRightPanel')) return;
    const zone = document.getElementById('rightPluginZone');
    if (!zone) return;
    const el = document.createElement('div');
    el.id = 'peRightPanel';
    el.style.cssText = 'display:none; flex-direction:column; overflow:hidden; flex:1;';
    el.innerHTML =
      '<div style="padding:5px 8px; font-size:10px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid #333; flex-shrink:0;">Output</div>' +
      '<div style="display:flex; padding:4px 6px; flex-shrink:0; border-bottom:1px solid var(--border);">' +
        '<button onclick="document.getElementById(\'peOutput\').innerHTML=\'\'" style="padding:2px 8px; border:none; border-radius:var(--radius-small); cursor:pointer; font-size:10px; background:var(--app-bg); color:var(--text-general);">Clear</button>' +
      '</div>' +
      '<div id="peContext" style="flex-shrink:0; padding:6px 8px; font-size:10px; font-family:monospace; color:var(--text-general); border-bottom:1px solid var(--border); opacity:0.7;"></div>' +
      '<pre id="peOutput" style="flex:1; margin:0; padding:8px; overflow-y:auto; font-size:11px; font-family:monospace; color:var(--text-general); white-space:pre-wrap; word-break:break-all; background:transparent;"></pre>';
    zone.prepend(el);
  }

  _showRightPanel(visible) {
    const el = document.getElementById('peRightPanel');
    if (el) el.style.display = visible ? 'flex' : 'none';
    if (visible) this._refreshContext();
  }

  async _refreshContext() {
    try {
      const data = await this.bridge.context();
      const ctx = data.context;
      const el = document.getElementById('peContext');
      if (!el) return;
      const stageStr = ctx.stage_sim ? 'stage — simulator'
        : 'stage  ' + (ctx.stage_port || '') + '  X' + (ctx.stage_position?.X ?? '?') + ' Y' + (ctx.stage_position?.Y ?? '?') + ' Z' + (ctx.stage_position?.Z ?? '?');
      const extras = [ctx.np && 'np', ctx.cv2 && 'cv2', ...(ctx.user_vars || [])].filter(Boolean);
      el.textContent = stageStr + (extras.length ? '   |   ' + extras.join(', ') : '');
      el.style.color = ctx.stage_sim ? 'var(--text-general)' : 'var(--coordinates-color)';
    } catch {}
  }

  // ── Popout ────────────────────────────────────────────────────────────────

  _togglePopout() {
    if (document.getElementById('peFloatWin')) { this._closePopout(); return; }

    const container = document.getElementById('peCellsContainer');
    const panel = document.getElementById('pythonEditorTabContent');
    if (!container) return;

    const win = document.createElement('div');
    win.id = 'peFloatWin';
    win.style.cssText = 'position:fixed; top:60px; left:320px; width:640px; height:70vh; background:var(--column-bg); border:1px solid var(--active-element); border-radius:6px; box-shadow:0 8px 32px #000a; display:flex; flex-direction:column; z-index:8000; resize:both; overflow:hidden; min-width:320px; min-height:200px;';

    // Float toolbar
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex; align-items:center; padding:4px 8px; background:var(--container-bg); border-bottom:1px solid #333; flex-shrink:0; cursor:move; gap:6px;';
    bar.innerHTML = '<span style="flex:1; font-size:11px; color:var(--text-general); opacity:0.6;">Python Editor</span>';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'border:none; background:none; color:#888; cursor:pointer; font-size:12px; padding:0 4px;';
    closeBtn.onclick = () => this._closePopout();
    bar.appendChild(closeBtn);
    win.appendChild(bar);

    // Move the cells container into the float window
    container.style.flex = '1';
    win.appendChild(container);
    document.body.appendChild(win);

    // Show placeholder in original panel
    const placeholder = document.createElement('div');
    placeholder.id = 'pePopoutPlaceholder';
    placeholder.style.cssText = 'flex:1; display:flex; align-items:center; justify-content:center; color:var(--text-general); opacity:0.4; font-size:12px;';
    placeholder.textContent = 'Editor is open in floating window';
    panel.appendChild(placeholder);

    document.getElementById('pePopoutBtn').textContent = '⤡';

    // Drag
    let ox, oy;
    bar.addEventListener('mousedown', e => {
      if (e.target === closeBtn) return;
      ox = e.clientX - win.offsetLeft; oy = e.clientY - win.offsetTop;
      const onMove = ev => { win.style.left = (ev.clientX - ox) + 'px'; win.style.top = (ev.clientY - oy) + 'px'; };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  _closePopout() {
    const win = document.getElementById('peFloatWin');
    const container = document.getElementById('peCellsContainer');
    const panel = document.getElementById('pythonEditorTabContent');
    if (!win || !container || !panel) return;
    panel.appendChild(container);
    win.remove();
    document.getElementById('pePopoutPlaceholder')?.remove();
    document.getElementById('pePopoutBtn').textContent = '⤢';
    this._cells.forEach(c => c.cm?.refresh());
  }

  _logRight(text, color) {
    const out = document.getElementById('peOutput');
    if (!out) return;
    const span = document.createElement('span');
    if (color) span.style.color = color;
    span.textContent = text;
    out.appendChild(span);
    out.scrollTop = out.scrollHeight;
  }
};
