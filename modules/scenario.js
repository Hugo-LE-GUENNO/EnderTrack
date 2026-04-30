// modules/scenario.js - Simple scenario runner

class ScenarioRunner {
  constructor() {
    this.isActive = false;
    this.isExecuting = false;
    this.isPaused = false;
    this.selectedListId = null;
    this.delay = 1000;
    this.loops = 1;
    this._currentLoop = 0;
    this._currentIdx = 0;
    this._stopped = false;
    this._startTime = 0;
    this._pausedTime = 0;
    this._pauseStart = 0;
    this._positionTimes = [];
    this._timerInterval = null;
    this.scenarioTrack = { enabled: true, visited: [], current: null, remaining: [] };
    // Re-render when active list changes
    window.EnderTrack?.Events?.on?.('lists:rendered', () => {
      if (!this.isExecuting) this.renderUI();
    });
  }

  activate() {
    this.isActive = true;
    this.renderUI();
    EnderTrack.Canvas?.requestRender?.();
  }

  deactivate() {
    this.isActive = false;
    // Don't stop if executing — user just switched tabs
    if (!this.isExecuting) {
      EnderTrack.Canvas?.requestRender?.();
    }
  }

  stop() {
    this._stopped = true;
    this.isExecuting = false;
    this.isPaused = false;
    this._clearTimer();
    this._resumePause(); // resolve any pending pause
    this.scenarioTrack = { enabled: true, visited: [], current: null, remaining: [] };
    this._updateTabIndicator(false);
    this.renderUI();
    EnderTrack.Canvas?.requestRender?.();
    EnderTrack.Events?.emit?.('scenario:deactivated');
  }

  pause() {
    if (!this.isExecuting || this.isPaused) return;
    this.isPaused = true;
    this._pauseStart = Date.now();
    this.renderUI();
  }

  resume() {
    if (!this.isPaused) return;
    this._pausedTime += Date.now() - this._pauseStart;
    this.isPaused = false;
    this._resumePause();
    this.renderUI();
  }

  // Pause mechanics: resolve a promise when resumed
  _waitIfPaused() {
    if (!this.isPaused) return Promise.resolve();
    return new Promise(r => { this._resumePause = r; });
  }

  _resumePause() {} // overwritten by _waitIfPaused

  _elapsed() {
    if (!this._startTime) return 0;
    const paused = this.isPaused ? (Date.now() - this._pauseStart) : 0;
    return Date.now() - this._startTime - this._pausedTime - paused;
  }

  _totalPositions() {
    const list = this._getList();
    return (list?.positions?.length || 0) * this.loops;
  }

  _donePositions() {
    const list = this._getList();
    const perLoop = list?.positions?.length || 0;
    return this._currentLoop * perLoop + this._currentIdx;
  }

  _getList() {
    const lists = EnderTrack.Lists?.manager?.getAllLists?.() || [];
    return lists.find(l => String(l.id) === String(this.selectedListId));
  }

  _startTimer() {
    this._clearTimer();
    this._timerInterval = setInterval(() => {
      if (this.isActive) this._updateTimerDisplay();
    }, 500);
  }

  _clearTimer() {
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
  }

  _updateTimerDisplay() {
    const el = document.getElementById('scenarioTimer');
    if (!el) return;
    el.textContent = this._fmt(this._elapsed());
  }

  _fmt(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  _updateTabIndicator(active) {
    const btn = document.getElementById('acquisitionTab');
    if (!btn) return;
    if (active) {
      btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
      btn.style.color = '#10b981';
    } else {
      btn.style.color = '';
    }
  }

  async run() {
    const list = this._getList();
    if (!list?.positions?.length) return;

    this.isExecuting = true;
    this.isPaused = false;
    this._stopped = false;
    this._currentLoop = 0;
    this._currentIdx = 0;
    this._startTime = Date.now();
    this._pausedTime = 0;
    this._updateTabIndicator(true);
    this._startTimer();
    this.renderUI();
    EnderTrack.Events?.emit?.('scenario:activated');

    for (let loop = 0; loop < this.loops && !this._stopped; loop++) {
      this._currentLoop = loop;
      for (let i = 0; i < list.positions.length && !this._stopped; i++) {
        await this._waitIfPaused();
        if (this._stopped) break;

        this._currentIdx = i;
        const p = list.positions[i];

        this.scenarioTrack.current = { x: p.x, y: p.y, z: p.z };
        this.scenarioTrack.remaining = list.positions.slice(i + 1);
        this.renderUI();
        EnderTrack.Canvas?.requestRender?.();

        try {
          await EnderTrack.Movement?.moveAbsolute(p.x, p.y, p.z);
        } catch { break; }

        this.scenarioTrack.visited.push({ x: p.x, y: p.y, z: p.z });
        EnderTrack.Events?.emit?.('scenario:position_reached', { position: p, index: i, loop });

        if (i < list.positions.length - 1 && this.delay > 0 && !this._stopped) {
          await this._waitIfPaused();
          if (this._stopped) break;
          await new Promise(r => setTimeout(r, this.delay));
        }
      }

      if (loop < this.loops - 1 && !this._stopped && this.delay > 0) {
        await this._waitIfPaused();
        if (this._stopped) break;
        await new Promise(r => setTimeout(r, this.delay));
      }
    }

    const duration = this._elapsed();
    this._clearTimer();
    this._updateTabIndicator(false);

    EnderTrack.Events?.emit?.('scenario:completed', {
      scenarioName: list.name, duration,
      listId: list.id, listName: list.name,
      loopCount: this.loops
    });

    this.isExecuting = false;
    this.isPaused = false;
    this.renderUI();
  }

  // === UI ===

  renderUI() {
    const container = document.getElementById('acquisitionTabContent');
    if (!container) return;

    const lists = EnderTrack.Lists?.manager?.getAllLists?.() || [];
    if (!this.selectedListId && lists.length) this.selectedListId = String(lists[0].id);

    if (this.isExecuting) {
      const list = this._getList();
      const total = this._totalPositions();
      const done = this._donePositions();
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const perLoop = list?.positions?.length || 0;
      const loopPct = perLoop > 0 ? Math.round((this._currentIdx / perLoop) * 100) : 0;

      container.innerHTML = `
        <div style="padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:12px; color:var(--text-selected);">${list?.name || '?'}</span>
            <span id="scenarioTimer" style="font-size:11px; color:var(--coordinates-color); font-family:monospace;">0:00</span>
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-general); margin-bottom:2px;">
              <span>Total ${done}/${total}</span><span>${pct}%</span>
            </div>
            <div style="width:100%; height:5px; background:var(--app-bg); border-radius:3px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background:var(--coordinates-color); transition:width 0.3s;"></div>
            </div>
          </div>
          ${this.loops > 1 ? `
          <div>
            <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-general); margin-bottom:2px;">
              <span>Boucle ${this._currentLoop + 1}/${this.loops} — pos ${this._currentIdx + 1}/${perLoop}</span><span>${loopPct}%</span>
            </div>
            <div style="width:100%; height:3px; background:var(--app-bg); border-radius:2px; overflow:hidden;">
              <div style="width:${loopPct}%; height:100%; background:var(--active-element); transition:width 0.3s;"></div>
            </div>
          </div>` : `
          <div style="font-size:10px; color:var(--text-general);">Position ${this._currentIdx + 1}/${perLoop}</div>` }
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button onclick="EnderTrack.Scenario.${this.isPaused ? 'resume' : 'pause'}()" style="padding:7px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:var(--active-element); color:var(--text-selected);">${this.isPaused ? '▶ Reprendre' : '⏸ Pause'}</button>
            <button onclick="EnderTrack.Scenario.stop()" style="padding:7px; border:none; border-radius:4px; cursor:pointer; font-size:12px; background:#ef4444; color:#fff;">■ Stop</button>
          </div>
        </div>
      `;
      this._updateTimerDisplay();
      return;
    }

    // Auto-select active list
    const activeList = EnderTrack.Lists?._activeGroup?.();
    if (activeList) this.selectedListId = String(activeList.id);
    const listName = activeList?.name || '—';
    const posCount = activeList?.positions?.length || 0;

    container.innerHTML = `
      <div style="padding:8px; display:flex; flex-direction:column; gap:6px;">
        <div style="font-size:11px; color:var(--text-general);">Exploration de la liste</div>
        <div style="display:flex; gap:8px; align-items:center;">
          <label style="font-size:10px; color:var(--text-general); width:50px;">Intervalle</label>
          <input type="number" id="scenarioDelay" value="${this.delay}" min="0" step="100"
            style="width:60px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:var(--radius-small); color:var(--coordinates-color); font-size:10px; font-family:monospace; text-align:center;">
          <span style="font-size:9px; color:var(--text-general);">ms</span>
          <label style="font-size:10px; color:var(--text-general); margin-left:8px;">Boucles</label>
          <input type="number" id="scenarioLoops" value="${this.loops}" min="1" step="1"
            style="width:40px; padding:3px; background:var(--app-bg); border:1px solid #444; border-radius:var(--radius-small); color:var(--coordinates-color); font-size:10px; font-family:monospace; text-align:center;">
        </div>
        <button onclick="EnderTrack.Scenario._startFromUI()" style="width:100%; padding:6px; border:none; border-radius:var(--radius-small); cursor:pointer; font-size:11px; background:var(--active-element); color:var(--text-selected);" ${posCount === 0 ? 'disabled style="width:100%; padding:6px; border:none; border-radius:var(--radius-small); font-size:11px; opacity:0.4;"' : ''}>▶ Explorer</button>
      </div>
    `;

    document.getElementById('scenarioDelay')?.addEventListener('change', (e) => {
      this.delay = Math.max(0, parseInt(e.target.value) || 0);
    });
    document.getElementById('scenarioLoops')?.addEventListener('change', (e) => {
      this.loops = Math.max(1, parseInt(e.target.value) || 1);
    });
  }

  _startFromUI() {
    // Auto-select active list
    const activeList = EnderTrack.Lists?._activeGroup?.();
    if (activeList) this.selectedListId = String(activeList.id);
    this.delay = Math.max(0, parseInt(document.getElementById('scenarioDelay')?.value) || 0);
    this.loops = Math.max(1, parseInt(document.getElementById('scenarioLoops')?.value) || 1);
    if (!this.selectedListId) return;
    this.run();
  }

  // === COMPAT API for renderers/canvas ===

  get executor() {
    return { isExecuting: this.isExecuting, stop: () => this.stop() };
  }

  get manager() {
    return {
      getCurrentScenario: () => ({
        id: 'simple',
        name: 'Simple',
        positionListId: this.selectedListId
      }),
      getScenario: () => this.manager.getCurrentScenario()
    };
  }

  getSelectedList() {
    if (!this.selectedListId) return null;
    return EnderTrack.Lists?.manager?.getList?.(this.selectedListId) || null;
  }

  getSelectedListPositions() {
    return this.getSelectedList()?.positions || [];
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Scenario = new ScenarioRunner();
