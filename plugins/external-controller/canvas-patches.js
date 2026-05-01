// plugins/controller-v2/canvas-patches.js
// Monkey-patches core renderers for continuous mode visuals.
// install() saves originals + patches, uninstall() restores them.

const CV2Patches = {
  _origXY: null,   // original PositionRenderer methods
  _origZ: null,    // original ZPositionRenderer methods
  _installed: false,

  install() {
    if (this._installed) return;
    const PR = window.EnderTrack?.PositionRenderer;
    const ZR = window.EnderTrack?.ZPositionRenderer;
    if (!PR || !ZR) return;

    // --- Save originals ---
    this._origXY = {
      renderNavigationOverlays: PR.renderNavigationOverlays,
      renderMovementVector: PR.renderMovementVector,
      renderCurrentPosition: PR.renderCurrentPosition
    };
    this._origZ = {
      drawCurrentPosition: ZR.drawCurrentPosition,
      drawMovementVector: ZR.drawMovementVector,
      drawPotentialPositions: ZR.drawPotentialPositions
    };

    const self = this;

    // --- XY: hide step overlays in continuous mode ---
    PR.renderNavigationOverlays = function(ctx, state, coords) {
      if (self._isContinuousMode()) return;
      self._origXY.renderNavigationOverlays.call(this, ctx, state, coords);
    };

    // --- XY: scaled arrow + speed-proportional size ---
    PR.renderMovementVector = function(ctx, state, posX, posY) {
      if (!window.continuousVector?.xy) return;
      const v = window.continuousVector.xy;
      const len = 30 + (v.speed / 100) * 50;
      const endX = posX + v.dx * len;
      const endY = posY + v.dy * len;
      const color = getComputedStyle(document.documentElement).getPropertyValue('--pos-potential').trim();
      const lw = 2 + (v.speed / 100) * 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(posX, posY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      const angle = Math.atan2(v.dy, v.dx);
      const as = 6 + (v.speed / 100) * 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - as * Math.cos(angle - Math.PI / 6), endY - as * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - as * Math.cos(angle + Math.PI / 6), endY - as * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    };

    // --- XY: grey crosshair during estimation ---
    PR.renderCurrentPosition = function(ctx, state, posX, posY) {
      if (window.continuousEstimating) {
        const coords = window.EnderTrack?.Coordinates;
        if (!coords) return;
        const bounds = coords.getCoordinateBounds();
        if (state.pos.x < bounds.minX || state.pos.x > bounds.maxX ||
            state.pos.y < bounds.minY || state.pos.y > bounds.maxY) return;
        if (posX < -50 || posX > ctx.canvas.width + 50 ||
            posY < -50 || posY > ctx.canvas.height + 50) return;
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(posX - 10, posY); ctx.lineTo(posX + 10, posY);
        ctx.moveTo(posX, posY - 10); ctx.lineTo(posX, posY + 10);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      }
      self._origXY.renderCurrentPosition.call(this, ctx, state, posX, posY);
    };

    // --- Z: grey line during estimation ---
    ZR.drawCurrentPosition = function(ctx, canvas, state, zPan, zRange, zInverted) {
      const halfRange = zRange / 2;
      const currentY = canvas.height / 2 - (zInverted * (state.pos.z - zPan) / halfRange) * (canvas.height / 2);
      // Z arrow
      if (window.continuousVector?.z) {
        ZR.drawMovementVector(ctx, canvas, currentY, window.continuousVector.z, zInverted);
      }
      if (currentY < 0 || currentY > canvas.height) return;
      const est = window.continuousEstimating;
      ctx.strokeStyle = est ? '#666666' : (getComputedStyle(document.documentElement).getPropertyValue('--pos-current').trim() || '#ffffff');
      ctx.lineWidth = 1.5;
      if (est) ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, currentY);
      ctx.lineTo(canvas.width, currentY);
      ctx.stroke();
      if (est) ctx.globalAlpha = 1;
    };

    // --- Z: scaled arrow ---
    ZR.drawMovementVector = function(ctx, canvas, currentY, vector, zInverted) {
      const len = 30 + (vector.speed / 5) * 50;
      const endY = currentY - (zInverted * vector.dz * len);
      const color = getComputedStyle(document.documentElement).getPropertyValue('--pos-potential').trim() || '#ffc107';
      const lw = 2 + (vector.speed / 5) * 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, currentY);
      ctx.lineTo(canvas.width / 2, endY);
      ctx.stroke();
      const as = 6 + (vector.speed / 5) * 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, endY);
      if ((vector.dz * zInverted) > 0) {
        ctx.lineTo(canvas.width / 2 - as / 2, endY + as);
        ctx.lineTo(canvas.width / 2 + as / 2, endY + as);
      } else {
        ctx.lineTo(canvas.width / 2 - as / 2, endY - as);
        ctx.lineTo(canvas.width / 2 + as / 2, endY - as);
      }
      ctx.closePath();
      ctx.fill();
    };

    // --- Z: hide step potentials in continuous mode ---
    ZR.drawPotentialPositions = function(ctx, canvas, state, zPan, zRange, zInverted) {
      if (self._isContinuousMode()) return;
      self._origZ.drawPotentialPositions.call(this, ctx, canvas, state, zPan, zRange, zInverted);
    };

    this._installed = true;
  },

  uninstall() {
    if (!this._installed) return;
    const PR = window.EnderTrack?.PositionRenderer;
    const ZR = window.EnderTrack?.ZPositionRenderer;
    if (PR && this._origXY) {
      PR.renderNavigationOverlays = this._origXY.renderNavigationOverlays;
      PR.renderMovementVector = this._origXY.renderMovementVector;
      PR.renderCurrentPosition = this._origXY.renderCurrentPosition;
    }
    if (ZR && this._origZ) {
      ZR.drawCurrentPosition = this._origZ.drawCurrentPosition;
      ZR.drawMovementVector = this._origZ.drawMovementVector;
      ZR.drawPotentialPositions = this._origZ.drawPotentialPositions;
    }
    this._origXY = null;
    this._origZ = null;
    this._installed = false;
    window.continuousVector = null;
    window.continuousEstimating = false;
  },

  _isContinuousMode() {
    const cv2 = window.PiloteMoiPlugin?.bridge;
    return cv2?.isActive && cv2?.mode === 'continuous';
  }
};

window.CV2Patches = CV2Patches;
