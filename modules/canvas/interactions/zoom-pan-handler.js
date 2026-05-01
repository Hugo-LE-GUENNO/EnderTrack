// modules/canvas/interactions/zoom-pan-handler.js - Gestion du zoom et du pan

class ZoomPanHandler {
  constructor(interactions) {
    this.interactions = interactions;
  }

  // Pan simple et direct
  handlePan(deltaX, deltaY) {
    const state = EnderTrack.State.get();
    
    EnderTrack.State.update({
      panX: (state.panX || 0) + deltaX,
      panY: (state.panY || 0) + deltaY
    });
    
    // Force update
    window.EnderTrack.Canvas.updateCoordinateSystem();
    window.EnderTrack.Canvas.requestRender();
  }

  // Zoom avec limites intelligentes
  handleZoom(newZoom, mousePos = null) {
    const state = EnderTrack.State.get();
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    // Limites de zoom ergonomiques basées sur la taille du plateau
    const bounds = coords.getCoordinateBounds();
    const plateauSizeX = bounds.maxX - bounds.minX;
    const plateauSizeY = bounds.maxY - bounds.minY;
    const canvasWidth = this.interactions.canvas.width;
    const canvasHeight = this.interactions.canvas.height;
    
    // Adapter la bordure selon le layout viewport
    const viewportManager = window.EnderTrack?.Viewport?.Manager;
    const currentLayout = viewportManager?.activeLayout || 'single';
    let borderFactor = 0.9;
    
    if (currentLayout === 'single') {
      borderFactor = 0.8;
    } else if (currentLayout === '50-50') {
      borderFactor = 0.6;
    } else if (currentLayout === '2x2') {
      borderFactor = 0.4;
    }
    
    // Zoom min = plateau entier visible avec bordure adaptative
    const minZoomX = (canvasWidth * borderFactor) / (plateauSizeX * coords.pxPerMm());
    const minZoomY = (canvasHeight * borderFactor) / (plateauSizeY * coords.pxPerMm());
    const minZoom = Math.min(minZoomX, minZoomY);
    const maxZoom = 100000; // Zoom max pour précision microscopique (1 µm)
    const clampedZoom = EnderTrack.Math.clamp(newZoom, minZoom, maxZoom);
    
    if (mousePos) {
      this.zoomAtPoint(clampedZoom, mousePos, state);
    } else {
      EnderTrack.State.update({ zoom: clampedZoom });
      window.EnderTrack.Canvas.updateCoordinateSystem();
      window.EnderTrack.Canvas.requestRender();
      }
  }

  // Zoom précis au niveau de la souris
  zoomAtPoint(newZoom, mousePos, state) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    // Position canvas de la souris
    const rect = this.interactions.canvas.getBoundingClientRect();
    const canvasX = mousePos.x - rect.left;
    const canvasY = mousePos.y - rect.top;
    
    // Position monde avant zoom
    const oldWorldPos = coords.canvasToMap(canvasX, canvasY);
    
    // Appliquer le nouveau zoom
    EnderTrack.State.update({ zoom: newZoom });
    window.EnderTrack.Canvas.updateCoordinateSystem();
    
    // Recalculer la position canvas après zoom
    const newCanvasPos = coords.mapToCanvas(oldWorldPos.x, oldWorldPos.y);
    
    // Ajuster le pan pour garder le point sous la souris
    const panAdjustX = canvasX - newCanvasPos.cx;
    const panAdjustY = canvasY - newCanvasPos.cy;
    
    EnderTrack.State.update({
      panX: (state.panX || 0) + panAdjustX,
      panY: (state.panY || 0) + panAdjustY
    });
    
    // Force update
    window.EnderTrack.Canvas.updateCoordinateSystem();
    window.EnderTrack.Canvas.requestRender();
  }

  // Molette de la souris avec facteur adaptatif
  handleWheel(event) {
    const currentZoom = EnderTrack.State.get().zoom || 1;
    
    // Facteur adaptatif selon le niveau de zoom
    let zoomFactor;
    if (currentZoom < 1) {
      zoomFactor = event.deltaY > 0 ? 0.8 : 1.25; // Plus rapide pour zoom out
    } else if (currentZoom < 10) {
      zoomFactor = event.deltaY > 0 ? 0.85 : 1.18;
    } else if (currentZoom < 100) {
      zoomFactor = event.deltaY > 0 ? 0.9 : 1.11;
    } else {
      zoomFactor = event.deltaY > 0 ? 0.95 : 1.05; // Plus fin pour zoom élevé
    }
    
    this.handleZoom(currentZoom * zoomFactor, {
      x: event.clientX,
      y: event.clientY
    });
  }

  // Ajuster à la vue
  fitToView(customBorderFactor = null) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    const bounds = coords.getCoordinateBounds();
    const plateauSizeX = bounds.maxX - bounds.minX;
    const plateauSizeY = bounds.maxY - bounds.minY;
    
    // Obtenir les dimensions réelles du canvas actif
    const viewportManager = window.EnderTrack?.Viewport?.Manager;
    const dimensions = viewportManager?.getActiveWidgetDimensions();
    
    if (!dimensions) {
      console.warn('Cannot get canvas dimensions for fitToView');
      return;
    }
    
    const canvasWidth = dimensions.width;
    const canvasHeight = dimensions.height;
    
    // Utiliser le borderFactor personnalisé ou calculer selon le layout
    let borderFactor = customBorderFactor;
    if (borderFactor === null) {
      const currentLayout = viewportManager?.activeLayout || 'single';
      
      if (currentLayout === 'single') {
        borderFactor = 0.8;
      } else if (currentLayout === '50-50') {
        borderFactor = 0.6;
      } else if (currentLayout === '2x2') {
        borderFactor = 0.4;
      } else {
        borderFactor = 0.8;
      }
    }
    
    // Calculer le zoom pour que le plateau soit visible avec la bordure
    const zoomX = (canvasWidth * borderFactor) / (plateauSizeX * coords.pxPerMm());
    const zoomY = (canvasHeight * borderFactor) / (plateauSizeY * coords.pxPerMm());
    const optimalZoom = Math.min(zoomX, zoomY);
    
    // Centrer sur le centre du plateau
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    EnderTrack.State.update({
      zoom: optimalZoom,
      panX: 0,
      panY: 0
    });
    
    // Force update
    window.EnderTrack.Canvas.updateCoordinateSystem();
    
    // Centrer sur le centre du plateau
    this.centerOnPosition(centerX, centerY);
    
    window.EnderTrack.Canvas.requestRender();
  }

  // Centrer sur une position
  centerOnPosition(x, y) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    const centerX = this.interactions.canvas.width / 2;
    const centerY = this.interactions.canvas.height / 2;
    
    const targetPos = coords.mapToCanvas(x, y);
    const state = EnderTrack.State.get();
    
    EnderTrack.State.update({
      panX: (state.panX || 0) + (centerX - targetPos.cx),
      panY: (state.panY || 0) + (centerY - targetPos.cy)
    });
  }

  // Touch/pinch pour mobile
  handlePinchStart(event) {
    if (event.touches.length !== 2) return;
    
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    
    this.interactions.touchStartDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    this.interactions.touchStartZoom = EnderTrack.State.get().zoom || 1;
  }

  handlePinchMove(event) {
    if (event.touches.length !== 2 || !this.interactions.touchStartDistance) return;
    
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    
    const currentDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    
    const zoomFactor = currentDistance / this.interactions.touchStartDistance;
    const newZoom = this.interactions.touchStartZoom * zoomFactor;
    
    this.handleZoom(newZoom, {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    });
  }

  // Raccourcis clavier avec facteur adaptatif
  handleZoomKey(key, modifiers) {
    if (!modifiers.ctrl) return false;
    
    const currentZoom = EnderTrack.State.get().zoom || 1;
    let factor = currentZoom < 10 ? 1.5 : (currentZoom < 100 ? 1.2 : 1.1);
    
    switch (key) {
      case '=':
      case '+':
        this.handleZoom(currentZoom * factor);
        return true;
      case '-':
        this.handleZoom(currentZoom / factor);
        return true;
      case '0':
        this.fitToView();
        return true;
    }
    return false;
  }

  updateSensitivity(zoom) {
    // Handled by NavigationControls.updateSliderRanges via state:changed event
  }

  // Alias pour compatibilité
  xyFitToView() {
    this.fitToView();
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ZoomPanHandler = ZoomPanHandler;