// plugins/enderpicam/histogram.js
// Left click = drag nearest min/max handle
// Middle click+drag = slide window
// Right click = LUT + options menu
// Wheel = widen/narrow, Shift+wheel = slide
// Auto mode = locked, no interactions

class CameraHistogram {
  constructor() {
    this.el = null;
    this.canvas = null;
    this.ctx = null;
    this.mode = 'auto';
    this.logScale = true; // default on for microscopy
    this.manualMin = 0;
    this.manualMax = 255;
    this.autoMin = 0;
    this.autoMax = 255;
    this._grayscale = true;
    this._dragging = null;
    this._slideStart = null;
    this._histR = null;
    this._histG = null;
    this._histB = null;
    this._histL = null;
    this._offscreen = document.createElement('canvas');
    this._offCtx = this._offscreen.getContext('2d', { willReadFrequently: true });
  }

  inject() {
    const zone = document.getElementById('rightPluginZone');
    if (!zone) return;
    this.el = document.createElement('div');
    this.el.id = 'enderpicam-histogram';
    this.el.style.cssText = 'background:var(--container-bg); border-radius:var(--radius); padding:8px; margin-top:8px;';
    this.el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-size:11px; color:var(--text-selected); font-weight:500;">Histogram</span>
        <span style="font-size:8px; color:var(--text-general); opacity:0.6; margin-left:4px;">RAW</span>
        <div style="display:flex; gap:2px; align-items:center;">
          <span id="enderpicam-hist-info"
            onclick="EnderTrack.Camera.histogram.showValueInput()"
            style="font-family:var(--font-mono); font-size:9px; color:var(--text-general); cursor:pointer; padding:1px 4px; border-radius:3px;"
            title="Click to edit values">—</span>
          <button id="enderpicam-hist-auto" onclick="EnderTrack.Camera.histogram.setMode('auto')"
            style="font-size:9px; padding:2px 6px; border:none; border-radius:3px; cursor:pointer; background:var(--active-element); color:var(--text-selected);">A</button>
          <button id="enderpicam-hist-manual" onclick="EnderTrack.Camera.histogram.setMode('manual')"
            style="font-size:9px; padding:2px 6px; border:none; border-radius:3px; cursor:pointer; background:var(--app-bg); color:var(--text-general);">M</button>
        </div>
      </div>
      <canvas id="enderpicam-hist-canvas" width="220" height="80"
        style="width:100%; height:80px; border-radius:4px; background:#111; cursor:default;"></canvas>
    `;
    zone.appendChild(this.el);
    this.canvas = document.getElementById('enderpicam-hist-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._setupEvents();
  }

  _setupEvents() {
    if (!this.canvas) return;
    const c = this.canvas;

    c.addEventListener('contextmenu', (e) => e.preventDefault());

    c.addEventListener('mousedown', (e) => {
      e.preventDefault();

      // Right click = options menu (LUT + log)
      if (e.button === 2) {
        this._showOptionsMenu(e.clientX, e.clientY);
        return;
      }

      // Auto mode = locked
      if (this.mode === 'auto') return;

      // Middle click = slide window
      if (e.button === 1) {
        this._dragging = 'slide';
        this._slideStart = { x: e.clientX, min: this.manualMin, max: this.manualMax };
        c.style.cursor = 'grabbing';
        return;
      }

      // Left click = grab nearest handle
      const val = this._eventToValue(e);
      const distMin = Math.abs(val - this.manualMin);
      const distMax = Math.abs(val - this.manualMax);
      this._dragging = distMin <= distMax ? 'min' : 'max';
      this._applyDrag(val);
      c.style.cursor = 'ew-resize';
    });

    c.addEventListener('mousemove', (e) => {
      if (this._dragging === 'slide') {
        const dx = e.clientX - this._slideStart.x;
        const rect = this.canvas.getBoundingClientRect();
        const dVal = Math.round((dx / rect.width) * 255);
        const span = this._slideStart.max - this._slideStart.min;
        let newMin = this._slideStart.min + dVal;
        let newMax = this._slideStart.max + dVal;
        if (newMin < 0) { newMin = 0; newMax = span; }
        if (newMax > 255) { newMax = 255; newMin = 255 - span; }
        this.manualMin = newMin;
        this.manualMax = newMax;
        this._redraw();
      } else if (this._dragging === 'min' || this._dragging === 'max') {
        this._applyDrag(this._eventToValue(e));
      } else {
        c.style.cursor = this.mode === 'manual' ? 'crosshair' : 'default';
      }
    });

    const stopDrag = () => {
      this._dragging = null;
      this._slideStart = null;
      if (this.canvas) this.canvas.style.cursor = this.mode === 'manual' ? 'crosshair' : 'default';
    };
    c.addEventListener('mouseup', stopDrag);
    c.addEventListener('mouseleave', stopDrag);

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.mode === 'auto') return;
      const step = 1;
      const dir = e.deltaY > 0 ? -1 : 1; // down = narrow, up = widen
      if (e.shiftKey) {
        // Shift+wheel = slide window
        const span = this.manualMax - this.manualMin;
        let newMin = this.manualMin + dir * step;
        let newMax = this.manualMax + dir * step;
        if (newMin < 0) { newMin = 0; newMax = span; }
        if (newMax > 255) { newMax = 255; newMin = 255 - span; }
        this.manualMin = newMin;
        this.manualMax = newMax;
      } else {
        // Wheel = widen/narrow
        this.manualMin = Math.max(0, Math.min(253, this.manualMin - dir * step));
        this.manualMax = Math.min(255, Math.max(this.manualMin + 2, this.manualMax + dir * step));
      }
      this._redraw();
    }, { passive: false });
  }

  _eventToValue(e) {
    const rect = this.canvas.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(255, ((e.clientX - rect.left) / rect.width) * 255)));
  }

  _applyDrag(val) {
    if (this._dragging === 'min') {
      this.manualMin = Math.min(val, this.manualMax - 1);
    } else if (this._dragging === 'max') {
      this.manualMax = Math.max(val, this.manualMin + 1);
    }
    this._redraw();
  }

  _redraw() {
    if (this._histR) this._draw(this._histR, this._histG, this._histB, this._histL);
  }

  // Right-click menu: LUT + Log toggle
  _showOptionsMenu(x, y) {
    document.getElementById('enderpicam-options-menu')?.remove();
    const luts = window.CameraLUTs || {};
    const currentLut = window.EnderpicamPlugin?.ui?.lutId || 'gray';

    const menu = document.createElement('div');
    menu.id = 'enderpicam-options-menu';
    menu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:10000;
      background:var(--container-bg); border:1px solid #555; border-radius:6px;
      box-shadow:0 4px 12px rgba(0,0,0,0.4); padding:4px 0; min-width:120px;`;

    // Log toggle
    const logRow = document.createElement('div');
    logRow.style.cssText = 'padding:4px 10px; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:6px; color:var(--text-general);';
    logRow.innerHTML = `<span style="width:14px; text-align:center;">${this.logScale ? '✓' : ''}</span>Log scale`;
    logRow.addEventListener('mouseenter', () => logRow.style.background = 'var(--app-bg)');
    logRow.addEventListener('mouseleave', () => logRow.style.background = '');
    logRow.addEventListener('click', () => {
      this.logScale = !this.logScale;
      this._redraw();
      menu.remove();
    });
    menu.appendChild(logRow);

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px; background:#444; margin:4px 8px;';
    menu.appendChild(sep);

    // LUT options
    for (const [id, def] of Object.entries(luts)) {
      const row = document.createElement('div');
      row.style.cssText = `padding:4px 10px; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:6px;
        color:${id === currentLut ? 'var(--text-selected)' : 'var(--text-general)'};
        background:${id === currentLut ? 'var(--active-element)' : 'transparent'};`;
      const swatch = document.createElement('canvas');
      swatch.width = 20; swatch.height = 8;
      swatch.style.cssText = 'border-radius:2px; flex-shrink:0;';
      const sCtx = swatch.getContext('2d');
      const colors = def.generate();
      for (let i = 0; i < 20; i++) {
        const c = colors[Math.round((i / 19) * 255)];
        sCtx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        sCtx.fillRect(i, 0, 1, 8);
      }
      row.appendChild(swatch);
      row.appendChild(document.createTextNode(def.name));
      row.addEventListener('mouseenter', () => { if (id !== currentLut) row.style.background = 'var(--app-bg)'; });
      row.addEventListener('mouseleave', () => { if (id !== currentLut) row.style.background = ''; });
      row.addEventListener('click', () => {
        window.EnderpicamPlugin?.ui?.setLut(id);
        const sel = document.getElementById('enderpicam-lut');
        if (sel) sel.value = id;
        menu.remove();
      });
      menu.appendChild(row);
    }

    document.body.appendChild(menu);
    setTimeout(() => {
      const close = (e) => {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close); }
      };
      document.addEventListener('mousedown', close);
    }, 0);
  }

  // Value input popup
  showValueInput() {
    if (this.mode === 'auto') return;
    document.getElementById('enderpicam-hist-input')?.remove();
    const info = document.getElementById('enderpicam-hist-info');
    if (!info) return;
    const rect = info.getBoundingClientRect();
    const range = this.getContrastRange();
    const popup = document.createElement('div');
    popup.id = 'enderpicam-hist-input';
    popup.style.cssText = `position:fixed; left:${rect.left - 60}px; top:${rect.bottom + 4}px; z-index:10000;
      background:var(--container-bg); border:1px solid #555; border-radius:6px; padding:6px;
      box-shadow:0 4px 12px rgba(0,0,0,0.4); display:flex; gap:4px; align-items:center;`;
    popup.innerHTML = `
      <input id="enderpicam-hist-input-min" type="number" min="0" max="254" value="${range.min}"
        style="width:40px; padding:2px 4px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:11px; text-align:center; font-family:var(--font-mono);">
      <span style="font-size:10px; color:var(--text-general);">–</span>
      <input id="enderpicam-hist-input-max" type="number" min="1" max="255" value="${range.max}"
        style="width:40px; padding:2px 4px; background:var(--app-bg); border:1px solid #444; border-radius:3px; color:var(--text-selected); font-size:11px; text-align:center; font-family:var(--font-mono);">
      <button onclick="EnderTrack.Camera.histogram.applyValueInput()"
        style="padding:2px 6px; border:none; border-radius:3px; background:var(--active-element); color:var(--text-selected); font-size:10px; cursor:pointer;">OK</button>
    `;
    document.body.appendChild(popup);
    document.getElementById('enderpicam-hist-input-min')?.focus();
    popup.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.applyValueInput();
      if (e.key === 'Escape') popup.remove();
    });
    setTimeout(() => {
      const close = (e) => {
        if (!popup.contains(e.target) && e.target !== info) {
          popup.remove(); document.removeEventListener('mousedown', close);
        }
      };
      document.addEventListener('mousedown', close);
    }, 0);
  }

  applyValueInput() {
    const minEl = document.getElementById('enderpicam-hist-input-min');
    const maxEl = document.getElementById('enderpicam-hist-input-max');
    if (minEl && maxEl) {
      let mn = Math.max(0, Math.min(254, parseInt(minEl.value) || 0));
      let mx = Math.max(mn + 1, Math.min(255, parseInt(maxEl.value) || 255));
      this.manualMin = mn;
      this.manualMax = mx;
      this._redraw();
    }
    document.getElementById('enderpicam-hist-input')?.remove();
  }

  destroy() {
    document.getElementById('enderpicam-hist-input')?.remove();
    document.getElementById('enderpicam-options-menu')?.remove();
    this.el?.remove();
    this.el = null;
    this.canvas = null;
    this.ctx = null;
  }

  setMode(mode) {
    this.mode = mode;
    const autoBtn = document.getElementById('enderpicam-hist-auto');
    const manualBtn = document.getElementById('enderpicam-hist-manual');
    if (autoBtn) {
      autoBtn.style.background = mode === 'auto' ? 'var(--active-element)' : 'var(--app-bg)';
      autoBtn.style.color = mode === 'auto' ? 'var(--text-selected)' : 'var(--text-general)';
    }
    if (manualBtn) {
      manualBtn.style.background = mode === 'manual' ? 'var(--active-element)' : 'var(--app-bg)';
      manualBtn.style.color = mode === 'manual' ? 'var(--text-selected)' : 'var(--text-general)';
    }
    if (this.canvas) this.canvas.style.cursor = mode === 'manual' ? 'crosshair' : 'default';
    this._redraw();
  }

  getContrastRange() {
    if (this.mode === 'manual') return { min: this.manualMin, max: this.manualMax };
    return { min: this.autoMin, max: this.autoMax };
  }

  updateFromBase64(b64) {
    if (!this.canvas || !this.ctx) return;
    const img = new Image();
    img.onload = () => {
      const w = Math.min(img.width, 320);
      const h = Math.min(img.height, 240);
      this._offscreen.width = w;
      this._offscreen.height = h;
      this._offCtx.drawImage(img, 0, 0, w, h);
      this._compute(this._offCtx.getImageData(0, 0, w, h).data);
    };
    img.src = 'data:image/jpeg;base64,' + b64;
  }

  updateFromImageData(data, grayscale) {
    if (!this.canvas || !this.ctx) return;
    this._grayscale = !!grayscale;
    this._compute(data);
  }

  _compute(data) {
    const histR = new Uint32Array(256);
    const histG = new Uint32Array(256);
    const histB = new Uint32Array(256);
    const histL = new Uint32Array(256);

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      histR[r]++;
      histG[g]++;
      histB[b]++;
      histL[Math.round(0.299 * r + 0.587 * g + 0.114 * b)]++;
    }

    const total = data.length / 16;
    let cumul = 0;
    this.autoMin = 0;
    this.autoMax = 255;
    for (let i = 0; i < 256; i++) {
      cumul += histL[i];
      if (cumul >= total * 0.003 && this.autoMin === 0) this.autoMin = i;
      if (cumul >= total * 0.997) { this.autoMax = i; break; }
    }

    this._histR = histR;
    this._histG = histG;
    this._histB = histB;
    this._histL = histL;
    this._draw(histR, histG, histB, histL);

    const info = document.getElementById('enderpicam-hist-info');
    const range = this.getContrastRange();
    if (info) info.textContent = `${range.min} – ${range.max}`;
  }

  _draw(histR, histG, histB, histL) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const lutBarH = 5;
    const graphH = H - lutBarH;
    ctx.clearRect(0, 0, W, H);

    const log = this.logScale;
    let maxVal = 1;
    for (let i = 1; i < 255; i++) {
      const v = this._grayscale ? histL[i] : Math.max(histR[i], histG[i], histB[i]);
      maxVal = Math.max(maxVal, log ? Math.log1p(v) : v);
    }

    const barW = W / 256;
    const range = this.getContrastRange();

    // Dimmed zones outside range
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, range.min * barW, graphH);
    ctx.fillRect(range.max * barW, 0, W - range.max * barW, graphH);

    // Histogram — always white/RGB
    if (this._grayscale) {
      this._drawChannel(ctx, histL, maxVal, W, graphH, barW, 'rgba(255,255,255,0.6)');
    } else {
      ctx.globalCompositeOperation = 'lighter';
      this._drawChannel(ctx, histR, maxVal, W, graphH, barW, 'rgba(255,60,60,0.5)');
      this._drawChannel(ctx, histG, maxVal, W, graphH, barW, 'rgba(60,255,60,0.5)');
      this._drawChannel(ctx, histB, maxVal, W, graphH, barW, 'rgba(60,100,255,0.5)');
      ctx.globalCompositeOperation = 'source-over';
    }

    // LUT gradient bar at bottom — stretched to min/max range
    const lut = this._getCurrentLut();
    const rMin = range.min, rMax = range.max, rSpan = Math.max(1, rMax - rMin);
    if (lut) {
      for (let i = 0; i < 256; i++) {
        const t = Math.max(0, Math.min(255, Math.round(((i - rMin) / rSpan) * 255)));
        const c = lut[t];
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(i * barW, graphH, Math.ceil(barW), lutBarH);
      }
    } else if (this._grayscale) {
      const grad = ctx.createLinearGradient(rMin * barW, 0, rMax * barW, 0);
      grad.addColorStop(0, '#000'); grad.addColorStop(1, '#fff');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, graphH, rMin * barW, lutBarH);
      ctx.fillStyle = grad;
      ctx.fillRect(rMin * barW, graphH, rSpan * barW, lutBarH);
      ctx.fillStyle = '#fff';
      ctx.fillRect(rMax * barW, graphH, W - rMax * barW, lutBarH);
    } else {
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, '#f44'); grad.addColorStop(0.5, '#4f4'); grad.addColorStop(1, '#48f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, graphH, W, lutBarH);
    }

    // Dim outside range
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, graphH, range.min * barW, lutBarH);
    ctx.fillRect(range.max * barW, graphH, W - range.max * barW, lutBarH);

    // Min/max lines
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    const minX = range.min * barW;
    const maxX = range.max * barW;
    ctx.beginPath();
    ctx.moveTo(minX, 0); ctx.lineTo(minX, H);
    ctx.moveTo(maxX, 0); ctx.lineTo(maxX, H);
    ctx.stroke();

    // Value labels
    ctx.font = '8px var(--font-mono, monospace)';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textBaseline = 'top';
    ctx.textAlign = range.min < 40 ? 'left' : 'right';
    ctx.fillText(range.min, minX + (range.min < 40 ? 2 : -2), 2);
    ctx.textBaseline = 'bottom';
    ctx.textAlign = range.max > 215 ? 'right' : 'left';
    ctx.fillText(range.max, maxX + (range.max > 215 ? -2 : 2), graphH - 2);
  }

  _getCurrentLut() {
    const lutId = window.EnderpicamPlugin?.ui?.lutId;
    if (!lutId || lutId === 'gray' || lutId === 'none') return null;
    const def = window.CameraLUTs?.[lutId];
    return def ? def.generate() : null;
  }

  _drawChannel(ctx, hist, maxVal, W, H, barW, color) {
    const log = this.logScale;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < 256; i++) {
      const v = log ? Math.log1p(hist[i]) : hist[i];
      ctx.lineTo(i * barW, H - (v / maxVal) * H);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }
}

window.CameraHistogram = CameraHistogram;
