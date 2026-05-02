// modules/canvas/interactions/ui-helpers.js - UI helpers for canvas interactions

class UIHelpers {
  constructor(interactions) {
    this.interactions = interactions;
  }

  updateMouseCoordinates(canvasPos, event = null) {
    const state = EnderTrack.State.get();
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;

    const mapPos = coords.canvasToMap(canvasPos.cx, canvasPos.cy);

    // Pan display
    const panX = document.getElementById('panX');
    const panY = document.getElementById('panY');
    if (panX) panX.textContent = (state.panX || 0).toFixed(0);
    if (panY) panY.textContent = (state.panY || 0).toFixed(0);

    // Mouse position display
    const bounds = coords.getCoordinateBounds();
    const onPlateau = mapPos.x >= bounds.minX && mapPos.x <= bounds.maxX &&
                      mapPos.y >= bounds.minY && mapPos.y <= bounds.maxY;

    EnderTrack.State.update({ mouseWorldPos: { x: mapPos.x, y: mapPos.y } });

    const mouseX = document.getElementById('mouseX');
    const mouseY = document.getElementById('mouseY');
    if (onPlateau) {
      if (mouseX) mouseX.textContent = mapPos.x.toFixed(1);
      if (mouseY) mouseY.textContent = mapPos.y.toFixed(1);
    } else {
      if (mouseX) mouseX.textContent = '----';
      if (mouseY) mouseY.textContent = '----';
    }

    this._updateCursor(onPlateau, event);
  }

  clearMouseCoordinates() {
    const mouseX = document.getElementById('mouseX');
    const mouseY = document.getElementById('mouseY');
    if (mouseX) mouseX.textContent = '----';
    if (mouseY) mouseY.textContent = '----';
    EnderTrack.State.update({ mouseWorldPos: { x: null, y: null } });
  }

  checkCompassHover(canvasPos) {
    const was = this.interactions.compassHovered || false;

    if (EnderTrack.Canvas?.compassBounds) {
      const b = EnderTrack.Canvas.compassBounds;
      this.interactions.compassHovered = canvasPos.cx >= b.x && canvasPos.cx <= b.x + b.width &&
                                         canvasPos.cy >= b.y && canvasPos.cy <= b.y + b.height;
    } else {
      this.interactions.compassHovered = false;
    }

    if (EnderTrack.Canvas) {
      EnderTrack.Canvas.compassHovered = this.interactions.compassHovered;
      if (was !== this.interactions.compassHovered) EnderTrack.Canvas.requestRender();
    }
  }

  showContextMenu() {
    // No context menu in basic version
  }

  _updateCursor(onPlateau, event) {
    const canvas = this.interactions.canvas;
    const state = EnderTrack.State.get();
    const tab = state.activeTab;

    // Scenario executing
    if (window.EnderTrack?.Scenario?.isExecuting) {
      canvas.style.cursor = 'not-allowed';
      canvas.classList.remove('crosshair-cursor');
      return;
    }

    // Overlays active — let overlay control cursor
    if (tab === 'settings' && window.EnderTrack?.Overlays?.isActive) return;
    if (window.EnderTrack?.Overlays?.isActive) return;

    // Compass hover
    if (this.interactions.compassHovered) {
      canvas.style.cursor = 'pointer';
      canvas.classList.remove('crosshair-cursor');
      return;
    }

    // Shift = grab
    if (!this.interactions.isDragging && event?.shiftKey) {
      canvas.style.cursor = 'grab';
      canvas.classList.remove('crosshair-cursor');
      return;
    }

    // Strategic position hover
    if (state.hoveredPosition) {
      canvas.style.cursor = 'pointer';
      canvas.classList.remove('crosshair-cursor');
      return;
    }

    // Lists click mode
    if (onPlateau && window.EnderTrack?.Lists?.isActive && window.EnderTrack.Lists.currentMode === 'click') {
      canvas.style.cursor = 'copy';
      canvas.classList.remove('crosshair-cursor');
      return;
    }

    // Default
    canvas.style.cursor = onPlateau ? '' : 'default';
    canvas.classList.toggle('crosshair-cursor', onPlateau);
  }
}

// ── Position display updates ─────────────────────────────────

function _updateCurrentPos() {
  const state = EnderTrack.State.get();
  const ids = { currentX: 'x', currentY: 'y', currentZ: 'z' };
  for (const [id, axis] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = (state.pos?.[axis] || 0).toFixed(1);
  }
}

window.updatePositionDisplays = function() {
  const state = EnderTrack.State.get();
  for (const axis of ['X', 'Y', 'Z']) {
    const el = document.getElementById('potential' + axis);
    if (el) el.textContent = state.targetPosition?.[axis.toLowerCase()] !== undefined
      ? state.targetPosition[axis.toLowerCase()].toFixed(1) : '--';
  }
};

if (window.EnderTrack?.Events) {
  EnderTrack.Events.on('state:changed', _updateCurrentPos);
  EnderTrack.Events.on('position:changed', _updateCurrentPos);
  EnderTrack.Events.on('movement:completed', _updateCurrentPos);
  EnderTrack.Events.on('state:changed', (newState, oldState) => {
    if (newState.targetPosition !== oldState.targetPosition) window.updatePositionDisplays();
  });
}

setTimeout(_updateCurrentPos, 500);

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.UIHelpers = UIHelpers;
