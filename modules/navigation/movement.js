// modules/navigation/movement.js - Movement calculations and execution

class MovementEngine {
  constructor() {
    this.isMoving = false;
    this.currentAnimation = null;
    this.emergencyStop = false;
    this._clientId = Math.random().toString(36).slice(2, 8);
    this._currentResolve = null;
    window.addEventListener('load', () => this._setupSSE());
  }

  _setupSSE() {
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
    // Load tracks from server on init
    fetch(url + '/api/sync/tracks').then(r => r.json()).then(data => {
      if (data?.positionHistory?.length || data?.continuousTrack?.length) {
        EnderTrack.State.update({ positionHistory: data.positionHistory || [], continuousTrack: data.continuousTrack || [] });
        setTimeout(() => EnderTrack.Canvas?.requestRender?.(), 200);
      }
    }).catch(() => {});
    try {
      const es = new EventSource(url + '/api/events');
      this._sse = es;
      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          if (evt.data?._from === this._clientId) return;
          if (evt.type === 'position:moving') {
            if (!this._isLocalMove) this._remoteMove(evt.data);
          } else if (evt.type === 'position:moved') {
            // Server-side move completed — snap to final position
            if (!this._isLocalMove) this._remoteArrive(evt.data);
          } else if (evt.type === 'position:arrived') {
            if (!this._isLocalMove) this._remoteArrive(evt.data);
          } else if (evt.type === 'sync:overlays') {
            if (window.EnderTrack?.Overlays) {
              window.EnderTrack.Overlays._loadFromData(evt.data);
              window.EnderTrack.Overlays.renderUI();
              EnderTrack.Canvas?.requestRender?.();
            }
          } else if (evt.type === 'sync:tracks') {
            if (evt.data) {
              EnderTrack.State.update({
                positionHistory: evt.data.positionHistory || [],
                continuousTrack: evt.data.continuousTrack || []
              });
              EnderTrack.Canvas?.requestRender?.();
            }
          } else if (evt.type === 'sync:config') {
            if (evt.data?.plateauDimensions) {
              EnderTrack.State?.update?.({
                plateauDimensions: evt.data.plateauDimensions,
                coordinateBounds: evt.data.coordinateBounds,
                axisOrientation: evt.data.axisOrientation,
                feedrate: evt.data.feedrate
              });
              if (typeof EnderTrackBootstrap?.syncUIWithState === 'function') {
                EnderTrackBootstrap.syncUIWithState();
              }
              EnderTrack.Canvas?.requestRender?.();
            }
          } else if (evt.type === 'sync:lists') {
            if (window.EnderTrack?.Lists?._applyData) {
              window.EnderTrack.Lists._applyData(evt.data);
              window.EnderTrack.Lists.renderUI();
              EnderTrack.Canvas?.requestRender?.();
            }
          }
        } catch {}
      };
    } catch {}
  }

  _remoteMove(data) {
    this._cancelAnim();
    this.isMoving = true;
    const start = { x: data.sx, y: data.sy, z: data.sz };
    const target = { x: data.x, y: data.y, z: data.z };
    const duration = data.duration || 1000;
    const startTime = Date.now();
    EnderTrack.State.update({ pos: start, isMoving: true });
    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const tXY = EnderTrack.Math.easeTrapezoidalXY(progress);
      const tZ = EnderTrack.Math.easeTrapezoidalZ(progress);
      const pos = {
        x: start.x + (target.x - start.x) * tXY,
        y: start.y + (target.y - start.y) * tXY,
        z: start.z + (target.z - start.z) * tZ
      };
      this._updatePos(pos);
      if (progress < 1) {
        this.currentAnimation = requestAnimationFrame(animate);
      } else {
        this.isMoving = false;
        EnderTrack.State.update({ pos: target, isMoving: false });
        const ix = document.getElementById('inputX');
        const iy = document.getElementById('inputY');
        const iz = document.getElementById('inputZ');
        if (ix) ix.value = target.x.toFixed(2);
        if (iy) iy.value = target.y.toFixed(2);
        if (iz) iz.value = target.z.toFixed(2);
      }
    };
    this.currentAnimation = requestAnimationFrame(animate);
  }

  _remoteArrive(data) {
    // Don't cancel animation - just ensure final position when it ends
    this.isMoving = false;
    const pos = { x: data.x, y: data.y, z: data.z };
    EnderTrack.State.update({ pos, isMoving: false });
    EnderTrack.Events.notifyListeners('position:changed', pos);
    // Sync inputs
    const ix = document.getElementById('inputX');
    const iy = document.getElementById('inputY');
    const iz = document.getElementById('inputZ');
    if (ix) ix.value = pos.x.toFixed(2);
    if (iy) iy.value = pos.y.toFixed(2);
    if (iz) iz.value = pos.z.toFixed(2);
  }

  _broadcast(type, data) {
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/events/publish';
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data: { ...data, _from: this._clientId } })
    }).catch(() => {});
  }

  async moveAbsolute(targetX, targetY, targetZ) {
    const state = EnderTrack.State.get();

    const target = this.validateCoordinates(targetX, targetY, targetZ);
    if (!target) return false;
    if (!this.checkSafetyLimits(target.x, target.y, target.z)) return false;
    return await this.executeMovement(this.calculateMovement(state.pos, target));
  }

  async moveRelative(dx, dy, dz) {
    const state = EnderTrack.State.get();
    const tx = state.pos.x + Number(dx);
    const ty = state.pos.y + Number(dy);
    const tz = state.pos.z + Number(dz);

    // Hardware: use real relative G-code (G91 + G1 + G90)
    const enderscope = window.EnderTrack?.Enderscope;
    if (enderscope?.isConnected) {
      const target = this.validateCoordinates(tx, ty, tz);
      if (!target) return false;
      if (!this.checkSafetyLimits(target.x, target.y, target.z)) return false;
      if (this.isMoving) return false;

      const movement = this.calculateMovement(state.pos, target);
      this.isMoving = true;
      this._isLocalMove = true;
      EnderTrack.State.update({ isMoving: true });

      // Animate locally
      movement.startTime = Date.now();
      const animateHw = () => {
        if (!this.isMoving) return;
        const progress = Math.min((Date.now() - movement.startTime) / movement.duration, 1);
        const tXY = EnderTrack.Math.easeTrapezoidalXY(progress);
        const tZ = EnderTrack.Math.easeTrapezoidalZ(progress);
        this._updatePos({
          x: EnderTrack.Math.lerp(movement.start.x, movement.target.x, tXY),
          y: EnderTrack.Math.lerp(movement.start.y, movement.target.y, tXY),
          z: EnderTrack.Math.lerp(movement.start.z, movement.target.z, tZ)
        });
        if (progress < 1) this.currentAnimation = requestAnimationFrame(animateHw);
      };
      this.currentAnimation = requestAnimationFrame(animateHw);

      try {
        const ok = await window.EnderTrack.EnderscopeMovement.moveRelative(Number(dx), Number(dy), Number(dz));
        this._cancelAnim();
        if (ok) { this.completeMovement(target, true); return true; }
        else { this.completeMovement(state.pos, false); return false; }
      } catch (e) {
        this._cancelAnim();
        this.completeMovement(state.pos, false);
        return false;
      }
    }

    // Simulation: convert to absolute
    return await this.moveAbsolute(tx, ty, tz);
  }

  async moveDirection(direction, customDistance = null) {
    const state = EnderTrack.State.get();

    // Read sensitivity from sliders directly
    let sensX = state.sensitivityX || 1;
    let sensY = state.sensitivityY || 1;
    let sensZ = state.sensitivityZ || 0.5;

    if (state.lockXY) {
      const v = parseFloat(document.getElementById('sensitivityXY')?.value);
      if (!isNaN(v)) { sensX = v; sensY = v; }
    } else {
      const vx = parseFloat(document.getElementById('sensitivityX')?.value);
      const vy = parseFloat(document.getElementById('sensitivityY')?.value);
      if (!isNaN(vx)) sensX = vx;
      if (!isNaN(vy)) sensY = vy;
    }
    const vz = parseFloat(document.getElementById('sensitivityZ')?.value);
    if (!isNaN(vz)) sensZ = vz;

    let dx = 0, dy = 0, dz = 0;
    const DIAG = 1 / Math.sqrt(2);
    const axisOrientation = state.axisOrientation || { x: 'right', y: 'up' };

    switch (direction) {
      case 'up': case 'north': dy = customDistance || sensY; break;
      case 'down': case 'south': dy = -(customDistance || sensY); break;
      case 'left': case 'west': dx = -(customDistance || sensX); break;
      case 'right': case 'east': dx = customDistance || sensX; break;
      case 'upLeft': dx = -(customDistance || sensX) * DIAG; dy = (customDistance || sensY) * DIAG; break;
      case 'upRight': dx = (customDistance || sensX) * DIAG; dy = (customDistance || sensY) * DIAG; break;
      case 'downLeft': dx = -(customDistance || sensX) * DIAG; dy = -(customDistance || sensY) * DIAG; break;
      case 'downRight': dx = (customDistance || sensX) * DIAG; dy = -(customDistance || sensY) * DIAG; break;
      case 'zUp': if (!state.lockZ) dz = customDistance || sensZ; break;
      case 'zDown': if (!state.lockZ) dz = -(customDistance || sensZ); break;
    }

    if (axisOrientation.x === 'left') dx = -dx;
    if (axisOrientation.y === 'down') dy = -dy;
    if (state.lockX) dx = 0;
    if (state.lockY) dy = 0;
    if (state.lockZ) dz = 0;

    if (state.lockXY && (dx !== 0 || dy !== 0)) {
      // Coupled XY: normalize diagonal to same distance as cardinal
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > 0) {
        const sens = parseFloat(document.getElementById('sensitivityXY')?.value) || Math.max(sensX, sensY);
        dx = (dx / mag) * sens;
        dy = (dy / mag) * sens;
      }
    }

    if (dx === 0 && dy === 0 && dz === 0) return false;
    return await this.moveRelative(dx, dy, dz);
  }

  calculateMovement(start, target) {
    const distXY = Math.sqrt((target.x - start.x) ** 2 + (target.y - start.y) ** 2);
    const distZ = Math.abs(target.z - start.z);
    const feedrate = EnderTrack.State.get().feedrate || 3000;
    const speedXY = feedrate / 60; // mm/s
    const speedZ = Math.min(feedrate / 60, 5); // Z capped at 5 mm/s (~300 mm/min)
    const timeXY = distXY > 0 ? distXY / speedXY : 0;
    const timeZ = distZ > 0 ? distZ / speedZ : 0;
    const duration = Math.max(timeXY, timeZ) * 1000; // longest axis dictates duration
    return {
      start: { ...start },
      target: { ...target },
      distance: Math.sqrt(distXY ** 2 + distZ ** 2),
      duration: Math.max(duration, 200),
      startTime: null
    };
  }

  async executeMovement(movement) {
    return new Promise(async (resolve, reject) => {
      const state = EnderTrack.State.get();
      if (state.emergencyStopActive) {
        reject(new Error('Emergency stop active'));
        return;
      }

      // Block if already moving (no interruption)
      if (this.isMoving) {
        resolve(false);
        return;
      }

      EnderTrack.State.update({ isMoving: true });
      this.isMoving = true;
      this._isLocalMove = true;
      this.emergencyStop = false;
      this._currentResolve = resolve;

      // Hardware path
      const enderscope = window.EnderTrack?.Enderscope;
      if (enderscope?.isConnected) {
        movement.startTime = Date.now();
        const animateHw = () => {
          if (this.emergencyStop || !this.isMoving) return;
          const progress = Math.min((Date.now() - movement.startTime) / movement.duration, 1);
          const tXY = EnderTrack.Math.easeTrapezoidalXY(progress);
          const tZ = EnderTrack.Math.easeTrapezoidalZ(progress);
          const pos = {
            x: EnderTrack.Math.lerp(movement.start.x, movement.target.x, tXY),
            y: EnderTrack.Math.lerp(movement.start.y, movement.target.y, tXY),
            z: EnderTrack.Math.lerp(movement.start.z, movement.target.z, tZ)
          };
          this._updatePos(pos);
          if (progress < 1) this.currentAnimation = requestAnimationFrame(animateHw);
        };
        this.currentAnimation = requestAnimationFrame(animateHw);

        try {
          const ok = await window.EnderTrack.EnderscopeMovement.moveAbsolute(movement.target.x, movement.target.y, movement.target.z);
          this._cancelAnim();
          if (ok) { this.completeMovement(movement.target, true); resolve(true); }
          else { this.completeMovement(EnderTrack.State.get().pos, false); reject(new Error('Hardware movement failed')); }
        } catch (error) {
          this._cancelAnim();
          this.completeMovement(EnderTrack.State.get().pos, false);
          reject(error);
        }
        return;
      }

      // Simulation path
      movement.startTime = Date.now();
      const animate = () => {
        if (this.emergencyStop) {
          this.completeMovement(EnderTrack.State.get().pos, false);
          reject(new Error('Emergency stop'));
          return;
        }
        const progress = Math.min((Date.now() - movement.startTime) / movement.duration, 1);
        const tXY = EnderTrack.Math.easeTrapezoidalXY(progress);
        const tZ = EnderTrack.Math.easeTrapezoidalZ(progress);
        const pos = {
          x: EnderTrack.Math.lerp(movement.start.x, movement.target.x, tXY),
          y: EnderTrack.Math.lerp(movement.start.y, movement.target.y, tXY),
          z: EnderTrack.Math.lerp(movement.start.z, movement.target.z, tZ)
        };
        this._updatePos(pos);

        if (window.EnderTrack?.Scenario?.executor?.isExecuting) {
          const track = window.EnderTrack.Scenario.scenarioTrack;
          if (track?.current) {
            track.visited.push({ x: pos.x, y: pos.y, z: pos.z });
            window.EnderTrack?.Canvas?.requestRender?.();
          }
        }

        if (progress < 1) {
          this.currentAnimation = requestAnimationFrame(animate);
        } else {
          this.completeMovement(movement.target, true);
          resolve(true);
        }
      };
      this.currentAnimation = requestAnimationFrame(animate);
      EnderTrack.Events.notifyListeners('movement:started', movement);
      this._broadcast('position:moving', { x: movement.target.x, y: movement.target.y, z: movement.target.z, sx: movement.start.x, sy: movement.start.y, sz: movement.start.z, duration: movement.duration });
    });
  }

  _updatePos(pos) {
    const ct = EnderTrack.State.get().continuousTrack || [];
    ct.push({ x: pos.x, y: pos.y, z: pos.z, timestamp: Date.now() });
    EnderTrack.State.update({ pos, continuousTrack: ct });
  }

  _cancelAnim() {
    if (this.currentAnimation) {
      cancelAnimationFrame(this.currentAnimation);
      this.currentAnimation = null;
    }
  }

  completeMovement(finalPos, success = true) {
    this._cancelAnim();
    const roundedPos = EnderTrack.Math.roundPoint(finalPos);
    EnderTrack.State.update({ pos: roundedPos, isMoving: false });
    this.isMoving = false;
    // Keep _isLocalMove true briefly to ignore late SSE events
    setTimeout(() => { this._isLocalMove = false; }, 500);    // Sync absolute inputs to final position (clears yellow cross)
    const ix = document.getElementById('inputX');
    const iy = document.getElementById('inputY');
    const iz = document.getElementById('inputZ');
    if (ix) ix.value = roundedPos.x.toFixed(2);
    if (iy) iy.value = roundedPos.y.toFixed(2);
    if (iz) iz.value = roundedPos.z.toFixed(2);
    EnderTrack.Events.notifyListeners('position:changed', roundedPos);
    if (success) EnderTrack.State.recordFinalPosition?.(roundedPos);
    this._broadcast('position:arrived', { x: roundedPos.x, y: roundedPos.y, z: roundedPos.z });
    // Persist position to server
    const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/state/patch';
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: { x: roundedPos.x, y: roundedPos.y, z: roundedPos.z } })
    }).catch(() => {});
    EnderTrack.Events.notifyListeners('movement:completed', { position: finalPos, success });
    // Sync tracks to server (debounced)
    if (this._trackSyncTimer) clearTimeout(this._trackSyncTimer);
    this._trackSyncTimer = setTimeout(() => {
      const state = EnderTrack.State.get();
      const url = (window.ENDERTRACK_SERVER || 'http://localhost:5000');
      fetch(url + '/api/sync/tracks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionHistory: state.positionHistory || [],
          continuousTrack: state.continuousTrack || []
        })
      }).catch(() => {});
    }, 100);
  }

  stopMovement(silent = false) {
    this._cancelAnim();
    if (this.isMoving) {
      const enderscope = window.EnderTrack?.Enderscope;
      if (enderscope?.isConnected) {
        fetch((window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/emergency_stop', { method: 'POST' }).catch(() => {});
      }
      const pos = EnderTrack.State.get().pos;
      const roundedPos = EnderTrack.Math.roundPoint(pos);
      EnderTrack.State.update({ pos: roundedPos, isMoving: false });
      this.isMoving = false;
      // Resolve pending Promise so next movement can start
      if (this._currentResolve) { this._currentResolve(false); this._currentResolve = null; }
      if (!silent) {
        EnderTrack.Events.notifyListeners('movement:completed', { position: roundedPos, success: false });
      }
    }
  }

  emergencyStopMovement() {
    this.emergencyStop = true;
    const currentPos = EnderTrack.State.get().pos;
    this.stopMovement();
    EnderTrack.State.update({ pos: currentPos, isMoving: false, emergencyStopActive: true });
    if (window.EnderTrack?.Enderscope?.isConnected) this.sendEmergencyStopGcode();
    EnderTrack.Events.notifyListeners('movement:emergency_stop');
  }

  async sendEmergencyStopGcode() {
    try {
      await fetch((window.ENDERTRACK_SERVER || 'http://localhost:5000') + '/api/emergency_stop', {
        method: 'POST'
      });
    } catch (e) { /* hardware offline */ }
  }

  validateCoordinates(x, y, z) {
    const state = EnderTrack.State.get();
    const target = {
      x: EnderTrack.Math.sanitizeNumber(x, 0),
      y: EnderTrack.Math.sanitizeNumber(y, 0),
      z: EnderTrack.Math.sanitizeNumber(z, 0)
    };
    const bounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 }, z: { min: 0, max: 100 } };
    target.x = EnderTrack.Math.clamp(target.x, bounds.x.min, bounds.x.max);
    target.y = EnderTrack.Math.clamp(target.y, bounds.y.min, bounds.y.max);
    target.z = EnderTrack.Math.clamp(target.z, bounds.z.min, bounds.z.max);
    return EnderTrack.Math.isValidPoint(target) ? target : null;
  }

  async goHome(mode = 'xy') {
    const state = EnderTrack.State.get();
    if (mode === 'xy' && state.lockHomeXY) return false;
    if (mode === 'xyz' && state.lockHomeXYZ) return false;

    const homePos = state.homePositions[mode] || { x: 0, y: 0, z: 0 };
    switch (mode) {
      case 'xy': return await this.moveAbsolute(homePos.x, homePos.y, state.pos.z);
      case 'xyz': return await this.moveAbsolute(homePos.x, homePos.y, homePos.z);
      case 'z': return await this.moveAbsolute(state.pos.x, state.pos.y, homePos.z);
      default: return false;
    }
  }

  setSpeed(speed) {
    EnderTrack.State.update({ moveSpeed: EnderTrack.Math.clamp(speed, 1, 1000) });
  }

  estimateMovementTime(targetX, targetY, targetZ, fromPos = null) {
    const start = fromPos || EnderTrack.State.get().pos;
    const feedrate = EnderTrack.State.get().feedrate || 3000;
    const distXY = Math.sqrt((targetX - start.x) ** 2 + (targetY - start.y) ** 2);
    const distZ = Math.abs(targetZ - start.z);
    const timeXY = distXY / (feedrate / 60);
    const timeZ = distZ / Math.min(feedrate / 60, 5);
    return Math.max(timeXY, timeZ) * 1000;
  }

  getStatistics() {
    const history = EnderTrack.State.get().positionHistory;
    if (history.length < 2) return { totalDistance: 0, totalTime: 0, averageSpeed: 0, pointCount: history.length };
    let totalDistance = 0;
    for (let i = 1; i < history.length; i++) {
      const p = history[i - 1], c = history[i];
      totalDistance += EnderTrack.Math.distance3D(p.x, p.y, p.z, c.x, c.y, c.z);
    }
    const totalTime = history[history.length - 1].timestamp - history[0].timestamp;
    return {
      totalDistance: EnderTrack.Math.round(totalDistance, 2),
      totalTime,
      averageSpeed: EnderTrack.Math.round(totalTime > 0 ? (totalDistance / totalTime) * 1000 : 0, 2),
      pointCount: history.length
    };
  }

  checkSafetyLimits(x, y, z) {
    const limits = window.EnderTrack?.StrategicPositions?.getLimits();
    if (!limits) return true;
    for (const [axis, val] of [['x', x], ['y', y], ['z', z]]) {
      const key = axis.toUpperCase();
      const min = limits[`${axis}Min`], max = limits[`${axis}Max`];
      if (min !== null && max !== null && (val < min || val > max)) {
        EnderTrack.UI?.showNotification?.(`Limite ${key} dépassée (${min} à ${max}mm)`, 'error');
        return false;
      }
    }
    return true;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Movement = new MovementEngine();
