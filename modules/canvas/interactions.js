// modules/canvas/interactions.js - Canvas interactions orchestrator (version modulaire)

class CanvasInteractions {
  constructor() {
    this.canvas = null;
    this.isInitialized = false;
    this.isDragging = false;
    this.isPanning = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.dragStartPos = { x: 0, y: 0 };
    this.touchStartDistance = 0;
    this.touchStartZoom = 1;
    this.compassHovered = false;
    
    // Initialize sub-modules
    this.eventHandlers = new window.EnderTrack.EventHandlers(this);
    this.clickHandler = new window.EnderTrack.ClickHandler(this);
    this.zoomPanHandler = new window.EnderTrack.ZoomPanHandler(this);
    this.uiHelpers = new window.EnderTrack.UIHelpers(this);
  }

  init(canvas) {
    this.canvas = canvas;
    
    // Setup all event listeners through sub-modules
    this.eventHandlers.setupMouseEvents(canvas);
    this.eventHandlers.setupTouchEvents(canvas);
    this.eventHandlers.setupKeyboardEvents(canvas);
    this.eventHandlers.setupWheelEvents(canvas);
    
    this.isInitialized = true;
    return true;
  }

  // Pointer event handlers (delegated to sub-modules)
  handlePointerStart(screenX, screenY, event) {
    const canvasPos = this.screenToCanvas(screenX, screenY);
    
    this.isDragging = true;
    this.isPanning = !!this._dblClickPan;
    this._dragMoved = false;
    this.lastMousePos = { x: screenX, y: screenY };
    this.dragStartPos = { x: screenX, y: screenY };
    if (this.isPanning) this.canvas.style.cursor = 'grabbing';
    
    EnderTrack.State.update({
      isDragging: true,
      isPanning: this.isPanning,
      lastMouseX: screenX,
      lastMouseY: screenY
    });
    
    EnderTrack.Events.emit('canvas:pointer:start', {
      screen: { x: screenX, y: screenY },
      canvas: canvasPos,
      isPanning: this.isPanning,
      originalEvent: event
    });
  }

  handlePointerMove(screenX, screenY, event) {
    const canvasPos = this.screenToCanvas(screenX, screenY);
    
    if (!this.isPanning) {
      this.uiHelpers.checkCompassHover(canvasPos);
      this.checkStrategicPositionHover(canvasPos);
      this.uiHelpers.updateMouseCoordinates(canvasPos, event);
    }
    
    if (this.isDragging) {
      const deltaX = screenX - this.lastMousePos.x;
      const deltaY = screenY - this.lastMousePos.y;
      const totalDist = Math.hypot(screenX - this.dragStartPos.x, screenY - this.dragStartPos.y);
      // Start panning after 3px of movement (distinguish from click)
      if (!this.isPanning && totalDist > 3) {
        this.isPanning = true;
        this._dragMoved = true;
        this.canvas.style.cursor = 'grabbing';
        if (this._dblClickCenterTimeout) { clearTimeout(this._dblClickCenterTimeout); this._dblClickCenterTimeout = null; }
      }
      if (this.isPanning) {
        this.zoomPanHandler.handlePan(deltaX, deltaY);
        this._lastPanTime = Date.now();
      }
    }
    
    this.lastMousePos = { x: screenX, y: screenY };
    
    EnderTrack.State.update({
      lastMouseX: screenX,
      lastMouseY: screenY
    });
    
    EnderTrack.Events.emit('canvas:pointer:move', {
      screen: { x: screenX, y: screenY },
      canvas: canvasPos,
      isDragging: this.isDragging,
      isPanning: this.isPanning,
      originalEvent: event
    });
  }

  checkStrategicPositionHover(canvasPos) {
    const sp = window.EnderTrack?.StrategicPositions;
    const coords = window.EnderTrack?.Coordinates;
    if (!sp || !coords) return;

    const mapPos = coords.canvasToMap(canvasPos.cx, canvasPos.cy);
    const bounds = coords.getCoordinateBounds();
    const onPlateau = mapPos.x >= bounds.minX && mapPos.x <= bounds.maxX &&
                      mapPos.y >= bounds.minY && mapPos.y <= bounds.maxY;

    let hoveredPosition = null;
    if (onPlateau) hoveredPosition = this._findHoveredPosition(canvasPos, coords, sp);

    EnderTrack.State.update({ hoveredPosition });
    EnderTrack.Canvas?.requestRender();
  }

  _findHoveredPosition(canvasPos, coords, sp) {
    const R = 15;
    const dist = (cx, cy, pos) => {
      const p = coords.mapToCanvas(pos.x, pos.y);
      return Math.hypot(canvasPos.cx - p.cx, canvasPos.cy - p.cy);
    };

    // Custom positions
    for (const pos of sp.customPositions) {
      if (pos?.show && dist(0, 0, pos) <= R) return { type: 'custom', data: pos };
    }

    // HOME positions
    const homes = [
      { x: parseFloat(document.getElementById('homeXY_X')?.value || 0), y: parseFloat(document.getElementById('homeXY_Y')?.value || 0), type: 'homeXY' },
      { x: parseFloat(document.getElementById('homeXYZ_X')?.value || 0), y: parseFloat(document.getElementById('homeXYZ_Y')?.value || 0), type: 'homeXYZ' }
    ];
    for (const pos of homes) {
      if (dist(0, 0, pos) <= R) return { type: 'home', data: pos };
    }

    // List points
    const lists = window.EnderTrack?.Lists?.manager?.getAllLists?.() || [];
    for (const list of lists) {
      if (list.showOnNavigation === false || !list.positions) continue;
      for (let i = 0; i < list.positions.length; i++) {
        if (dist(0, 0, list.positions[i]) <= R) {
          return { type: 'list', data: { ...list.positions[i], index: i, listId: list.id } };
        }
      }
    }
    return null;
  }

  handlePointerEnd(screenX, screenY, event) {
    const canvasPos = this.screenToCanvas(screenX, screenY);
    
    if (this.isPanning) {
      this.canvas.style.cursor = '';
      this._lastPanTime = Date.now();
    }
    this.isDragging = false;
    this.isPanning = false;
    this._dblClickPan = false;
    
    EnderTrack.State.update({
      isDragging: false,
      isPanning: false
    });
    
    EnderTrack.Events.emit('canvas:pointer:end', {
      screen: { x: screenX, y: screenY },
      canvas: canvasPos,
      originalEvent: event
    });
  }

  // Delegate click handling to ClickHandler
  handleClick(screenX, screenY, event) {
    this.clickHandler.handleClick(screenX, screenY, event);
  }

  handleDoubleClick(screenX, screenY, event) {
    const canvasPos = this.screenToCanvas(screenX, screenY);
    const mapPos = EnderTrack.Coordinates.canvasToMap(canvasPos.cx, canvasPos.cy);
    
    // Don't center immediately — wait to see if user drags
    this._dblClickCenterTimeout = setTimeout(() => {
      if (!this._dragMoved) this.zoomPanHandler.centerOnPosition(mapPos.x, mapPos.y);
    }, 200);
    
    EnderTrack.Events.emit('canvas:double_clicked', {
      screen: { x: screenX, y: screenY },
      canvas: canvasPos,
      map: mapPos,
      originalEvent: event
    });
  }

  handleRightClick(screenX, screenY, event) {
    const canvasPos = this.screenToCanvas(screenX, screenY);
    const mapPos = EnderTrack.Coordinates.canvasToMap(canvasPos.cx, canvasPos.cy);
    
    this.uiHelpers.showContextMenu(screenX, screenY, mapPos);
    
    EnderTrack.Events.emit('canvas:right_clicked', {
      screen: { x: screenX, y: screenY },
      canvas: canvasPos,
      map: mapPos,
      originalEvent: event
    });
  }

  // Touch handlers (delegated to ZoomPanHandler)
  handlePinchStart(event) {
    this.zoomPanHandler.handlePinchStart(event);
  }

  handlePinchMove(event) {
    this.zoomPanHandler.handlePinchMove(event);
  }

  // Keyboard handlers
  handleKeyDown(event) {
    const keyName = event.key;
    const modifiers = {
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey
    };
    
    if (this.handleNavigationKey(keyName, modifiers) || 
        this.zoomPanHandler.handleZoomKey(keyName, modifiers)) {
      event.preventDefault();
      return;
    }
    
    EnderTrack.Events.emit('canvas:key_down', {
      key: keyName,
      modifiers,
      originalEvent: event
    });
  }

  handleKeyUp(event) {
    const keyName = event.key;
    const modifiers = {
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey
    };
    
    EnderTrack.Events.emit('canvas:key_up', {
      key: keyName,
      modifiers,
      originalEvent: event
    });
  }

  handleNavigationKey(key, modifiers) {
    // Block navigation during scenario execution
    if (window.EnderTrack?.Scenario?.isExecuting) return false;
    
    const state = EnderTrack.State.get();
    const shortcuts = state.keyboardShortcuts;
    
    const keyToDirection = {
      [shortcuts.up]: 'up',
      [shortcuts.down]: 'down',
      [shortcuts.left]: 'left',
      [shortcuts.right]: 'right',
      [shortcuts.zUp]: 'zUp',
      [shortcuts.zDown]: 'zDown'
    };
    
    const direction = keyToDirection[key];
    if (!direction) return false;
    
    if (EnderTrack.Navigation) {
      EnderTrack.Navigation.moveDirection(direction);
    }
    
    return true;
  }

  // Wheel handler (delegated to ZoomPanHandler)
  handleWheel(event) {
    this.zoomPanHandler.handleWheel(event);
  }

  // Public API methods (delegated to appropriate handlers)
  fitToView() {
    this.zoomPanHandler.fitToView();
  }

  centerOnPosition(x, y) {
    this.zoomPanHandler.centerOnPosition(x, y);
  }

  clearMouseCoordinates() {
    this.uiHelpers.clearMouseCoordinates();
  }

  // Utility methods
  screenToCanvas(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      cx: screenX - rect.left,
      cy: screenY - rect.top
    };
  }

  canvasToScreen(canvasX, canvasY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: canvasX + rect.left,
      y: canvasY + rect.top
    };
  }

  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      isDragging: this.isDragging,
      lastMousePos: { ...this.lastMousePos },
      touchStartDistance: this.touchStartDistance,
      touchStartZoom: this.touchStartZoom
    };
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.CanvasInteractions = new CanvasInteractions();

// Global functions for HTML buttons
window.fitToView = function() {
  if (window.EnderTrack.CanvasInteractions.isInitialized) {
    window.EnderTrack.CanvasInteractions.fitToView();
  }
};

window.xyFitToView = function() {
  if (window.EnderTrack.CanvasInteractions.isInitialized) {
    window.EnderTrack.CanvasInteractions.zoomPanHandler.xyFitToView();
  }
};

window.zFitToView = function() {
  if (window.EnderTrack.ZVisualization?.interactions?.fitToView) {
    window.EnderTrack.ZVisualization.interactions.fitToView();
  }
};