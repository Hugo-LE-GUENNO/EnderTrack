// plugins/controller-v2/continuous-move.js
// G91 relative mode + trapezoidal motion estimation
// Auto-calibrates from firmware M503 at init

class ContinuousMove {
  constructor() {
    this._moving = false;
    this._raf = null;
    this._startPos = null;
    this._dir = null;
    this._startTime = 0;
    // Firmware defaults (Ender-3 stock)
    this._maxSpeed = { x: 500, y: 500, z: 5 };       // M203 mm/s
    this._maxAccel = { x: 500, y: 500, z: 100 };      // M201 mm/s² per-axis cap
    this._travelAccel = 1000;                           // M204 T mm/s²
    this._jerk = { x: 8, y: 8, z: 0.3 };              // M205 mm/s instant start speed
    this._calibrated = false;
  }

  // --- Auto-calibrate from firmware M503 ---

  async calibrate() {
    const es = window.EnderTrack?.Enderscope;
    if (!es?.isConnected) {
      return;
    }
    try {
      const r = await fetch(es.serverUrl + '/api/gcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'M503' }),
        signal: AbortSignal.timeout(5000)
      });
      const data = await r.json();
      if (!data.response) return;
      for (const line of data.response) {
        // M203 — Max feedrate per axis (mm/s)
        if (line.includes('M203')) {
          const mx = line.match(/X([\d.]+)/); if (mx) this._maxSpeed.x = parseFloat(mx[1]);
          const my = line.match(/Y([\d.]+)/); if (my) this._maxSpeed.y = parseFloat(my[1]);
          const mz = line.match(/Z([\d.]+)/); if (mz) this._maxSpeed.z = parseFloat(mz[1]);
        }
        // M201 — Max acceleration per axis (mm/s²)
        if (line.includes('M201')) {
          const mx = line.match(/X([\d.]+)/); if (mx) this._maxAccel.x = parseFloat(mx[1]);
          const my = line.match(/Y([\d.]+)/); if (my) this._maxAccel.y = parseFloat(my[1]);
          const mz = line.match(/Z([\d.]+)/); if (mz) this._maxAccel.z = parseFloat(mz[1]);
        }
        // M204 — Travel acceleration (mm/s²)
        if (line.includes('M204')) {
          const mt = line.match(/T([\d.]+)/); if (mt) this._travelAccel = parseFloat(mt[1]);
        }
        // M205 — Jerk / instant start speed per axis (mm/s)
        if (line.includes('M205')) {
          const mx = line.match(/X([\d.]+)/); if (mx) this._jerk.x = parseFloat(mx[1]);
          const my = line.match(/Y([\d.]+)/); if (my) this._jerk.y = parseFloat(my[1]);
          const mz = line.match(/Z([\d.]+)/); if (mz) this._jerk.z = parseFloat(mz[1]);
        }
      }
      this._calibrated = true;
    } catch (e) {}
  }

  // --- Movement commands ---

  start(dir) {
    this._doStart(dir);
  }

  _doStart(dir) {
    const move = this._dirToRelative(dir);
    if (!move) return;
    this._moving = true;
    const es = window.EnderTrack?.Enderscope;
    if (es?.isConnected) {
      this._sendRaw('G91\nG1 ' + move.gcode + ' F' + this._getFeedrate(), () => {
        if (this._moving) this._startEstimation(dir);
      });
    } else {
      this._startEstimation(dir);
    }
    this._publishVector(dir);
  }

  redirect(dir) {
    const move = this._dirToRelative(dir);
    if (!move) return;
    const es = window.EnderTrack?.Enderscope;
    if (es?.isConnected) {
      this._sendRaw('M410\nG91\nG1 ' + move.gcode + ' F' + this._getFeedrate(), () => {
        if (this._moving) this._startEstimation(dir);
      });
    } else {
      this._startEstimation(dir);
    }
    this._publishVector(dir);
  }

  stop(onRealPosition) {
    if (!this._moving) { onRealPosition?.(); return; }
    this._moving = false;
    this._stopEstimation();
    this._clearVector();
    const es = window.EnderTrack?.Enderscope;
    if (!es?.isConnected) { onRealPosition?.(); return; }
    // M410+G90 fires immediately (non-blocking)
    fetch(es.serverUrl + '/api/move/stop', {
      method: 'POST',
      signal: AbortSignal.timeout(5000)
    }).then(() => {
      // M114 in background — doesn't block next start
      return fetch(es.serverUrl + '/api/position/real');
    }).then(r => r.json()).then(data => {
      if (data?.position) {
        const pos = {
          x: Math.round(data.position.x * 1000) / 1000,
          y: Math.round(data.position.y * 1000) / 1000,
          z: Math.round(data.position.z * 1000) / 1000
        };
        window.EnderTrack.State.update({ pos });
        if (es.position) { es.position.x = pos.x; es.position.y = pos.y; es.position.z = pos.z; }
        window.EnderTrack.Events?.notifyListeners?.('position:changed', pos);
        window.EnderTrack.State?.recordFinalPosition?.(pos);
      }
      onRealPosition?.();
    }).catch(() => { onRealPosition?.(); });
  }

  // --- Direction vector for canvas arrow ---

  _publishVector(dir) {
    const d = dir.toLowerCase();
    let dx = 0, dy = 0, dz = 0;
    if (d.includes('right')) dx = 1; else if (d.includes('left')) dx = -1;
    if (d.startsWith('up')) dy = -1; else if (d.startsWith('down')) dy = 1;
    if (d.includes('zup')) dz = 1; else if (d.includes('zdown')) dz = -1;
    const feedrate = this._getFeedrate() / 60; // mm/s
    window.continuousVector = {
      xy: (dx || dy) ? { dx, dy, speed: feedrate } : null,
      z: dz ? { dz, speed: Math.min(feedrate, this._maxSpeed.z) } : null
    };
    window.continuousEstimating = true;
    window.EnderTrack?.Canvas?.requestRender?.();
  }

  _clearVector() {
    window.continuousVector = null;
    // continuousEstimating stays true until M114 callback clears it
    window.EnderTrack?.Canvas?.requestRender?.();
  }

  // --- Estimation: trapezoidal motion profile ---

  _startEstimation(dir) {
    this._stopEstimation();
    const pos = window.EnderTrack?.State?.get()?.pos;
    if (!pos) return;
    this._startPos = { x: pos.x, y: pos.y, z: pos.z };
    const d = dir.toLowerCase();
    // Raw unit direction per axis
    let vx = 0, vy = 0, vz = 0;
    if (d.includes('right')) vx = 1; else if (d.includes('left')) vx = -1;
    if (d.startsWith('up')) vy = 1; else if (d.startsWith('down')) vy = -1;
    if (d.includes('zup')) vz = 1; else if (d.includes('zdown')) vz = -1;
    // Normalize XY vector (Z is independent)
    const xyMag = Math.sqrt(vx * vx + vy * vy);
    this._dir = {
      x: xyMag > 0 ? vx / xyMag : 0,
      y: xyMag > 0 ? vy / xyMag : 0,
      z: vz
    };
    this._hasXY = xyMag > 0;
    this._hasZ = vz !== 0;
    this._startTime = performance.now();
    this._raf = requestAnimationFrame(() => this._tick());
  }

  _stopEstimation() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  // Trapezoidal profile with jerk (instant start speed)
  // Returns distance traveled after t seconds
  _distanceAtTime(t, maxSpeed, accel, jerk) {
    // Start at jerk speed, accelerate to maxSpeed
    const v0 = jerk;  // instant start velocity
    if (v0 >= maxSpeed) {
      // Already at max speed from the start
      return maxSpeed * t;
    }
    const tAccel = (maxSpeed - v0) / accel;  // time to reach maxSpeed
    if (t <= tAccel) {
      // Still accelerating: d = v0*t + 0.5*a*t²
      return v0 * t + 0.5 * accel * t * t;
    }
    // Accel phase distance + cruise phase
    const dAccel = v0 * tAccel + 0.5 * accel * tAccel * tAccel;
    return dAccel + maxSpeed * (t - tAccel);
  }

  _tick() {
    if (!this._moving || !this._startPos || !this._dir) { this._raf = null; return; }
    const elapsed = (performance.now() - this._startTime) / 1000;
    const b = window.EnderTrack?.Coordinates?.getCoordinateBounds?.()
      || { minX: -100, maxX: 100, minY: -100, maxY: 100, minZ: -50, maxZ: 50 };
    const feedrate = this._getFeedrate() / 60; // mm/s
    const dx = this._dir.x, dy = this._dir.y, dz = this._dir.z;

    let px = this._startPos.x, py = this._startPos.y, pz = this._startPos.z;

    // --- XY: Marlin limits resultant speed/accel/jerk by per-axis caps ---
    if (this._hasXY) {
      // Per-axis limiting on the resultant vector (like Marlin planner)
      // Resultant speed limited so each axis component stays under its max
      let xySpeed = feedrate;
      if (dx !== 0) xySpeed = Math.min(xySpeed, this._maxSpeed.x / Math.abs(dx));
      if (dy !== 0) xySpeed = Math.min(xySpeed, this._maxSpeed.y / Math.abs(dy));

      let xyAccel = this._travelAccel;
      if (dx !== 0) xyAccel = Math.min(xyAccel, this._maxAccel.x / Math.abs(dx));
      if (dy !== 0) xyAccel = Math.min(xyAccel, this._maxAccel.y / Math.abs(dy));

      let xyJerk = Infinity;
      if (dx !== 0) xyJerk = Math.min(xyJerk, this._jerk.x / Math.abs(dx));
      if (dy !== 0) xyJerk = Math.min(xyJerk, this._jerk.y / Math.abs(dy));
      if (!isFinite(xyJerk)) xyJerk = 0;

      const dist = this._distanceAtTime(elapsed, xySpeed, xyAccel, xyJerk);
      px = this._startPos.x + dx * dist;
      py = this._startPos.y + dy * dist;
    }

    // --- Z: independent profile ---
    if (this._hasZ) {
      const zSpeed = Math.min(feedrate, this._maxSpeed.z);
      const zAccel = Math.min(this._travelAccel, this._maxAccel.z);
      const zDist = this._distanceAtTime(elapsed, zSpeed, zAccel, this._jerk.z);
      pz = this._startPos.z + dz * zDist;
    }

    const pos = {
      x: Math.round(Math.max(b.minX, Math.min(b.maxX, px)) * 1000) / 1000,
      y: Math.round(Math.max(b.minY, Math.min(b.maxY, py)) * 1000) / 1000,
      z: Math.round(Math.max(b.minZ, Math.min(b.maxZ, pz)) * 1000) / 1000
    };

    window.EnderTrack.State.update({ pos });
    window.EnderTrack.Events?.notifyListeners?.('position:changed', pos);
    if (this._moving) {
      this._raf = requestAnimationFrame(() => this._tick());
    } else {
      this._raf = null;
    }
  }

  // --- Direction to relative G-code ---

  _dirToRelative(dir) {
    const FAR = 9999;
    let x = '', y = '', z = '';
    const d = dir.toLowerCase();
    if (d.includes('right'))     x = 'X' + FAR;
    else if (d.includes('left')) x = 'X-' + FAR;
    if (d.startsWith('up'))      y = 'Y' + FAR;
    else if (d.startsWith('down')) y = 'Y-' + FAR;
    if (d.includes('zup'))       z = 'Z' + FAR;
    else if (d.includes('zdown')) z = 'Z-' + FAR;
    const gcode = [x, y, z].filter(Boolean).join(' ');
    return gcode ? { gcode: gcode } : null;
  }

  _getFeedrate() {
    return window.EnderTrack?.State?.get()?.feedrate || 3000;
  }

  // --- Hardware ---

  _sendRaw(gcode, onDone) {
    const es = window.EnderTrack?.Enderscope;
    if (!es?.isConnected) return;
    fetch(es.serverUrl + '/api/move/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gcode: gcode }),
      signal: AbortSignal.timeout(2000)
    }).then(() => { if (onDone) onDone(); }).catch(() => { if (onDone) onDone(); });
  }
}

window.ContinuousMove = ContinuousMove;
