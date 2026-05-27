// modules/camera/fast-explore.js — Fast Exploration (select region → grid → explore)
// Fast Exploration: select region → generate grid → create list → run scenario

class EnderpicamFastExplore {
  constructor() {
    this.active = false;
    this.selecting = false;
    this.startPos = null;
    this.endPos = null;
    this.overlap = 0.1;
    this.sweep = 'random';
    this.afEnabled = false;
    this.listOnly = false;
    this.positions = [];
    this._renderBound = this._renderOverlay.bind(this);
  }

  getFOV() {
    const cfg = EnderTrack.Camera.picamConfig;
    const res = cfg.resolution || [640, 480];
    const ps = EnderTrack.Camera.getEffectivePixelSize();
    return { x: (res[0] * ps) / 1000, y: (res[1] * ps) / 1000 };
  }

  getStep() {
    const fov = this.getFOV();
    return { x: fov.x * (1 - this.overlap), y: fov.y * (1 - this.overlap) };
  }

  activate() {
    this.active = true;
    this.selecting = false;
    this.startPos = null;
    this.endPos = null;
    this.positions = [];

    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    canvas.style.cursor = 'cell';
    canvas.classList.add('enderpicam-selecting');

    this._onDown = (e) => {
      if (!this.active || e.button !== 0) return;
      e.stopPropagation();
      const coords = window.EnderTrack?.Coordinates;
      if (!coords) return;
      const rect = canvas.getBoundingClientRect();
      const map = coords.canvasToMap(e.clientX - rect.left, e.clientY - rect.top);
      this.startPos = { x: map.x, y: map.y };
      this.endPos = { x: map.x, y: map.y };
      this.selecting = true;
    };

    this._onMove = (e) => {
      if (!this.selecting) return;
      const coords = window.EnderTrack?.Coordinates;
      if (!coords) return;
      const rect = canvas.getBoundingClientRect();
      const map = coords.canvasToMap(e.clientX - rect.left, e.clientY - rect.top);
      this.endPos = { x: map.x, y: map.y };
      window.EnderTrack?.Canvas?.requestRender?.();
    };

    this._onUp = () => {
      if (!this.selecting) return;
      this.selecting = false;
      if (this.startPos && this.endPos) {
        const dx = Math.abs(this.endPos.x - this.startPos.x);
        const dy = Math.abs(this.endPos.y - this.startPos.y);
        if (dx > 0.01 && dy > 0.01) {
          this._generateGrid();
          this._showConfirmDialog();
        }
      }
    };

    canvas.addEventListener('mousedown', this._onDown, true);
    canvas.addEventListener('mousemove', this._onMove, true);
    canvas.addEventListener('mouseup', this._onUp, true);
    window.EnderTrack?.Events?.on?.('canvas:rendered', this._renderBound);
  }

  deactivate() {
    this.active = false;
    this.selecting = false;
    const canvas = document.getElementById('mapCanvas');
    if (canvas) {
      canvas.style.cursor = '';
      canvas.classList.remove('enderpicam-selecting');
      canvas.removeEventListener('mousedown', this._onDown, true);
      canvas.removeEventListener('mousemove', this._onMove, true);
      canvas.removeEventListener('mouseup', this._onUp, true);
    }
    window.EnderTrack?.Events?.off?.('canvas:rendered', this._renderBound);
    window.EnderTrack?.Canvas?.requestRender?.();
    EnderTrack.Camera.createUI?.();
  }

  _generateGrid() {
    if (!this.startPos || !this.endPos) return;
    const fov = this.getFOV();
    const step = this.getStep();
    const rot = -(EnderTrack.Camera.camRotation || 0) * Math.PI / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    // The user draws a rectangle on the stage canvas.
    // We need to figure out how many camera frames fit in that rectangle.
    // The camera axes are rotated by 'rot' relative to stage axes.
    //
    // Camera X-axis in stage coords: (cos, sin)
    // Camera Y-axis in stage coords: (-sin, cos)
    //
    // Project the selection vector onto camera axes:
    const dx = this.endPos.x - this.startPos.x;
    const dy = this.endPos.y - this.startPos.y;
    const projX = dx * cos + dy * sin;   // along camera X
    const projY = -dx * sin + dy * cos;  // along camera Y

    // Use absolute values for grid size, keep signs for direction
    const localW = Math.abs(projX);
    const localH = Math.abs(projY);
    const centerX = (this.startPos.x + this.endPos.x) / 2;
    const centerY = (this.startPos.y + this.endPos.y) / 2;

    // cols = number of frames along camera X (FOV width)
    // rows = number of frames along camera Y (FOV height)
    const cols = Math.max(1, Math.ceil(localW / step.x) + 1);
    const rows = Math.max(1, Math.ceil(localH / step.y) + 1);

    // Generate grid in camera-local frame
    const pg = window.EnderTrack?.PatternGenerator;
    let localPositions;
    if (pg) {
      try {
        localPositions = pg.generateGrid(cols, rows, step.x, step.y, this.sweep);
      } catch (e) {
        console.warn('PatternGenerator error:', e);
        localPositions = null;
      }
    }
    if (!localPositions) {
      localPositions = [];
      const ox = -(cols - 1) * step.x / 2;
      const oy = -(rows - 1) * step.y / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          localPositions.push({ x: ox + c * step.x, y: oy + r * step.y });
        }
      }
      if (this.sweep === 'random') {
        for (let i = localPositions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [localPositions[i], localPositions[j]] = [localPositions[j], localPositions[i]];
        }
      }
    }

    // Rotate from camera frame back to stage coordinates
    // Camera X-axis = (cos, sin), Camera Y-axis = (-sin, cos)
    this.positions = localPositions.map(p => ({
      x: Math.round((centerX + p.x * cos - p.y * sin) * 1000) / 1000,
      y: Math.round((centerY + p.x * sin + p.y * cos) * 1000) / 1000
    }));
  }

  _showConfirmDialog() {
    document.getElementById('enderpicam-explore-dialog')?.remove();
    const fov = this.getFOV();
    const step = this.getStep();
    const n = this.positions.length;
    const rot = -(EnderTrack.Camera.camRotation || 0) * Math.PI / 180;
    const dx = this.endPos.x - this.startPos.x;
    const dy = this.endPos.y - this.startPos.y;
    const localW = Math.abs(dx * Math.cos(rot) + dy * Math.sin(rot));
    const localH = Math.abs(-dx * Math.sin(rot) + dy * Math.cos(rot));
    const cols = Math.max(1, Math.ceil(localW / step.x) + 1);
    const rows = Math.max(1, Math.ceil(localH / step.y) + 1);
    const expMs = (EnderTrack.Camera.picamConfig.exposure || 100000) / 1000;
    const delayPerPos = Math.max(2000, Math.ceil(expMs) * 2 + 1500);
    const estSec = Math.round(n * delayPerPos / 1000);
    const tooMany = n > 1000;

    const dialog = document.createElement('div');
    dialog.id = 'enderpicam-explore-dialog';
    dialog.className = 'enderscope-modal-backdrop';
    dialog.onclick = (e) => { if (e.target === dialog) { dialog.remove(); this.deactivate(); } };
    dialog.innerHTML = `
      <div class="enderscope-modal" style="max-width:320px;">
        <div class="enderscope-modal-header">
          <h3>🔲 Fast Exploration</h3>
          <button onclick="document.getElementById('enderpicam-explore-dialog').remove(); EnderTrack.Camera.fastExplore.deactivate()">✕</button>
        </div>
        <div class="enderscope-modal-body" style="font-size:11px;">
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="color:var(--text-general);">
              FOV X: ${fov.x.toFixed(3)} mm · Y: ${fov.y.toFixed(3)} mm
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <label style="width:60px;">Overlap</label>
              <input type="range" id="explore-overlap" min="0" max="50" value="${this.overlap * 100}" step="1"
                oninput="EnderTrack.Camera.fastExplore._onOverlapChange(this.value)"
                style="flex:1; height:4px; -webkit-appearance:none; background:#404040; border-radius:2px;">
              <span id="explore-overlap-val" style="font-family:var(--font-mono); font-size:10px; color:var(--coordinates-color); width:28px; text-align:right;">${Math.round(this.overlap * 100)}%</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <label style="width:60px;">Pattern</label>
              <select id="explore-sweep" onchange="EnderTrack.Camera.fastExplore._onSweepChange(this.value)"
                style="flex:1; padding:3px 6px; background:var(--app-bg); border:1px solid #444; border-radius:4px; color:var(--text-selected); font-size:11px;">
                <option value="random" ${this.sweep === 'random' ? 'selected' : ''}>🎲 Random</option>
                <option value="snake" ${this.sweep === 'snake' ? 'selected' : ''}>🐍 Snake</option>
                <option value="normal" ${this.sweep === 'normal' ? 'selected' : ''}>➡ Row by row</option>
                <option value="reverse" ${this.sweep === 'reverse' ? 'selected' : ''}>⬅ Reverse</option>
                <option value="snake-reverse" ${this.sweep === 'snake-reverse' ? 'selected' : ''}>🐍 Snake reverse</option>
                <option value="spiral-out" ${this.sweep === 'spiral-out' ? 'selected' : ''}>🌀 Spiral out</option>
                <option value="spiral-in" ${this.sweep === 'spiral-in' ? 'selected' : ''}>🌀 Spiral in</option>
              </select>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <label style="width:60px;">Autofocus</label>
              <label style="font-size:10px; cursor:pointer; display:flex; align-items:center; gap:4px;">
                <input type="checkbox" id="explore-af" ${this.afEnabled ? 'checked' : ''}
                  onchange="EnderTrack.Camera.fastExplore.afEnabled = this.checked">
                <span style="color:var(--text-general);">🔬 AF at each position</span>
              </label>
            </div>
            <div id="explore-info" style="color:var(--text-general);">
              Step: ${step.x.toFixed(3)} × ${step.y.toFixed(3)} mm
            </div>
            <div id="explore-count" style="color:var(--coordinates-color); font-weight:500;">
              ${n} positions (${cols} × ${rows}) · ~${estSec}s
            </div>
          </div>
        </div>
        <div class="enderscope-modal-footer">
          <button class="enderscope-btn-secondary" onclick="document.getElementById('enderpicam-explore-dialog').remove(); EnderTrack.Camera.fastExplore.deactivate()">Annuler</button>
          <button class="enderscope-btn-primary" onclick="EnderTrack.Camera.fastExplore.startExploration()" ${tooMany ? 'disabled style="opacity:0.4"' : ''}>▶ Explorer</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
  }

  _onOverlapChange(val) {
    this.overlap = parseInt(val) / 100;
    document.getElementById('explore-overlap-val').textContent = val + '%';
    this._generateGrid();
    this._updateDialogInfo();
    window.EnderTrack?.Canvas?.requestRender?.();
  }

  _onSweepChange(val) {
    this.sweep = val;
    this._generateGrid();
    this._updateDialogInfo();
    window.EnderTrack?.Canvas?.requestRender?.();
  }

  _updateDialogInfo() {
    const step = this.getStep();
    const n = this.positions.length;
    let cols = 1, rows = 1;
    if (this.startPos && this.endPos) {
      const rot = -(EnderTrack.Camera.camRotation || 0) * Math.PI / 180;
      const dx = this.endPos.x - this.startPos.x;
      const dy = this.endPos.y - this.startPos.y;
      const localW = Math.abs(dx * Math.cos(rot) + dy * Math.sin(rot));
      const localH = Math.abs(-dx * Math.sin(rot) + dy * Math.cos(rot));
      cols = Math.max(1, Math.ceil(localW / step.x) + 1);
      rows = Math.max(1, Math.ceil(localH / step.y) + 1);
    }
    const info = document.getElementById('explore-info');
    const count = document.getElementById('explore-count');
    if (info) info.textContent = `Step X: ${step.x.toFixed(3)} mm · Y: ${step.y.toFixed(3)} mm`;
    if (count) count.textContent = `${n} positions (${cols} × ${rows})`;
  }

  startExploration() {
    document.getElementById('enderpicam-explore-dialog')?.remove();
    if (this.positions.length === 0) return;
    document.body.style.cursor = 'wait';
    const listOnly = this._listOnlyMode;
    this._listOnlyMode = false;

    const lists = window.EnderTrack?.Lists;
    if (!lists) { console.warn('Lists module not available'); return; }

    // 1. Create a new list with the grid positions
    lists.addGroup('🗺 Exploration');
    const z = window.EnderTrack?.State?.get?.()?.pos?.z || 0;
    for (const pos of this.positions) {
      lists.addPosition(pos.x, pos.y, z);
    }

    if (listOnly) {
      document.body.style.cursor = '';
      this.deactivate();
      window.switchTab?.('lists');
      if (window.EnderTrack?.UI?.showSuccess) {
        window.EnderTrack.UI.showSuccess(`🗺 ${this.positions.length} positions générées`);
      }
      return;
    }

    // 2. Enable navigator mode for tile capture
    EnderTrack.Camera.navigatorMode = true;
    EnderTrack.Camera.showMosaic = true;
    EnderTrack.Camera.createUI?.();

    // 3. Select the list in scenario and configure
    const scenario = window.EnderTrack?.Scenario;
    if (!scenario) { console.warn('Scenario module not available'); this.deactivate(); return; }
    const activeList = lists._activeGroup();
    if (activeList) {
      scenario.selectedListId = String(activeList.id);
      // Delay = settle(500ms) + exposure×2 + capture(500ms) + margin
      const expUs = EnderTrack.Camera.picamConfig.exposure || 100000;
      const expDelay = Math.ceil(expUs / 1000) * 2;
      const afDelay = this.afEnabled ? 20000 : 0; // AF can take up to 20s
      scenario.delay = Math.max(2000, expDelay + 1500 + afDelay);
      scenario.loops = 1;
    }

    // 5. Switch to scenario tab and run
    window.switchTab?.('acquisition');
    setTimeout(() => scenario.run(), 300);

    document.body.style.cursor = '';
    this.deactivate();
  }

  // Draw selection rectangle + grid preview on canvas
  _renderOverlay(ctx) {
    if (!this.active) return;
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;

    if (this.startPos && this.endPos) {
      const rot = -(EnderTrack.Camera.camRotation || 0) * Math.PI / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);

      // Draw rotated selection rectangle
      const cx = (this.startPos.x + this.endPos.x) / 2;
      const cy = (this.startPos.y + this.endPos.y) / 2;
      const dx = this.endPos.x - this.startPos.x;
      const dy = this.endPos.y - this.startPos.y;
      const localW = Math.abs(dx * cos + dy * sin);
      const localH = Math.abs(-dx * sin + dy * cos);
      const hw = localW / 2, hh = localH / 2;

      // 4 corners of rotated rect in stage coords
      const corners = [
        { x: cx + (-hw) * cos - (-hh) * sin, y: cy + (-hw) * sin + (-hh) * cos },
        { x: cx + ( hw) * cos - (-hh) * sin, y: cy + ( hw) * sin + (-hh) * cos },
        { x: cx + ( hw) * cos - ( hh) * sin, y: cy + ( hw) * sin + ( hh) * cos },
        { x: cx + (-hw) * cos - ( hh) * sin, y: cy + (-hw) * sin + ( hh) * cos },
      ].map(p => coords.mapToCanvas(p.x, p.y));

      ctx.save();
      ctx.strokeStyle = 'rgba(255,193,7,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(corners[0].cx, corners[0].cy);
      for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].cx, corners[i].cy);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,193,7,0.08)';
      ctx.fill();
      ctx.setLineDash([]);

      // Grid preview: rotated FOV rectangles at each position
      if (this.positions.length > 0 && this.positions.length < 500) {
        const fov = this.getFOV();
        const fwH = fov.x / 2, fhH = fov.y / 2;

        for (let i = 0; i < this.positions.length; i++) {
          const pos = this.positions[i];
          const cp = coords.mapToCanvas(pos.x, pos.y);

          // Draw rotated FOV rectangle
          const fc = [
            coords.mapToCanvas(pos.x + (-fwH)*cos - (-fhH)*sin, pos.y + (-fwH)*sin + (-fhH)*cos),
            coords.mapToCanvas(pos.x + ( fwH)*cos - (-fhH)*sin, pos.y + ( fwH)*sin + (-fhH)*cos),
            coords.mapToCanvas(pos.x + ( fwH)*cos - ( fhH)*sin, pos.y + ( fwH)*sin + ( fhH)*cos),
            coords.mapToCanvas(pos.x + (-fwH)*cos - ( fhH)*sin, pos.y + (-fwH)*sin + ( fhH)*cos),
          ];
          ctx.strokeStyle = 'rgba(255,193,7,0.2)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(fc[0].cx, fc[0].cy);
          for (let j = 1; j < 4; j++) ctx.lineTo(fc[j].cx, fc[j].cy);
          ctx.closePath();
          ctx.stroke();

          // Dot
          ctx.fillStyle = 'rgba(255,193,7,0.5)';
          ctx.beginPath();
          ctx.arc(cp.cx, cp.cy, 3, 0, Math.PI * 2);
          ctx.fill();

          // Number
          if (this.positions.length < 100) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '8px var(--font-mono, monospace)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(i + 1, cp.cx, cp.cy - 5);
          }
        }
      }
      ctx.restore();
    }
  }
}

window.EnderTrack.FastExplore = EnderpicamFastExplore;
