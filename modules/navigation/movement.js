// modules/navigation/movement.js - Movement calculations and execution

class MovementEngine {
  constructor() {
    this.isMoving = false;
    this.currentAnimation = null;
    this.emergencyStop = false;
  }

  async moveAbsolute(targetX, targetY, targetZ) {
    const state = EnderTrack.State.get();
    if (state.isMoving && !this.emergencyStop) return false;

    const target = this.validateCoordinates(targetX, targetY, targetZ);
    if (!target) return false;
    if (!this.checkSafetyLimits(target.x, target.y, target.z)) return false;

    return await this.executeMovement(this.calculateMovement(state.pos, target));
  }

  async moveRelative(dx, dy, dz) {
    const state = EnderTrack.State.get();
    return await this.moveAbsolute(
      state.pos.x + Number(dx),
      state.pos.y + Number(dy),
      state.pos.z + Number(dz)
    );
  }

  async moveDirection(direction, customDistance = null) {
    const state = EnderTrack.State.get();
    if (state.isMoving || this.isMoving) return false;

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
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > 0) {
        const sens = Math.max(sensX, sensY);
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

      this.stopMovement();
      EnderTrack.State.update({ isMoving: true });
      this.isMoving = true;
      this.emergencyStop = false;

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
    // Sync absolute inputs to final position (clears yellow cross)
    const ix = document.getElementById('inputX');
    const iy = document.getElementById('inputY');
    const iz = document.getElementById('inputZ');
    if (ix) ix.value = roundedPos.x.toFixed(2);
    if (iy) iy.value = roundedPos.y.toFixed(2);
    if (iz) iz.value = roundedPos.z.toFixed(2);
    EnderTrack.Events.notifyListeners('position:changed', roundedPos);
    if (success) EnderTrack.State.recordFinalPosition?.(roundedPos);
    this.isMoving = false;
    EnderTrack.Events.notifyListeners('movement:completed', { position: finalPos, success });
  }

  stopMovement() {
    this._cancelAnim();
    if (this.isMoving) this.completeMovement(EnderTrack.State.get().pos, false);
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
