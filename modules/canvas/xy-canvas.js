// modules/canvas/xy-canvas.js - Main XY Canvas orchestrator
// Simplified canvas management using specialized renderers

class XYCanvasManager {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isInitialized = false;
    this.renderRequested = false;
    this.lastRenderTime = 0;
    this.targetFPS = 60;
    this.frameInterval = 1000 / this.targetFPS;
    this.compassHovered = false;
    this.compassBounds = null;
  }

  async init(canvasId) {

    
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas element with id '${canvasId}' not found`);
    }
    
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    
    this.setupCanvas();
    this.updateCoordinateSystem();
    this.setupEventListeners();
    this.requestRender();
    
    this.isInitialized = true;

    
    return true;
  }

  setupCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    
    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    if (dpr > 1) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.ctx.scale(dpr, dpr);
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';
    }
    
    // Rendering properties
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  setupEventListeners() {
    window.EnderTrack.Events.on('state:changed', (newState, oldState) => {
      if (this.shouldUpdateCoordinates(newState, oldState)) {
        this.updateCoordinateSystem();
      }
      this.requestRender();
    });
    
    window.addEventListener('resize', () => this.handleResize());
    
    // Input listeners for coordinate changes
    setTimeout(() => {
      let renderTimeout;
      const debouncedRender = () => {
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => {
          this.updateCoordinateSystem();
          this.requestRender();
        }, 50);
      };
      
      const inputs = ['inputX', 'inputY', 'inputZ', 'sensitivityX', 'sensitivityY', 'sensitivityZ', 'sensitivityXY', 'plateauX', 'plateauY', 'plateauZ', 'xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'];
      inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
          input.addEventListener('input', () => {
            this.updateCoordinateSystem();
            debouncedRender();
          });
        }
      });
      
      ['relativeTab', 'absoluteTab'].forEach(id => {
        const tab = document.getElementById(id);
        if (tab) {
          tab.addEventListener('click', () => {
            setTimeout(() => {
              this.updateCoordinateSystem();
              this.requestRender();
            }, 50);
          });
        }
      });
      
      // Listen for coordinate config changes
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('preset-btn') || e.target.classList.contains('axis-btn')) {
          setTimeout(() => {
            this.updateCoordinateSystem();
            this.requestRender();
          }, 100);
        }
      });
    }, 1000);
  }

  shouldUpdateCoordinates(newState, oldState) {
    return newState.mapSizeMm !== oldState.mapSizeMm ||
           newState.zoom !== oldState.zoom ||
           newState.panX !== oldState.panX ||
           newState.panY !== oldState.panY ||
           JSON.stringify(newState.coordinateBounds) !== JSON.stringify(oldState.coordinateBounds) ||
           JSON.stringify(newState.axisOrientation) !== JSON.stringify(oldState.axisOrientation) ||
           JSON.stringify(newState.plateauDimensions) !== JSON.stringify(oldState.plateauDimensions);
  }

  updateCoordinateSystem() {
    const state = window.EnderTrack.State.get();
    
    window.EnderTrack.Coordinates.updateParameters({
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      mapSizeMm: state.mapSizeMm,
      plateauDimensions: state.plateauDimensions,
      coordinateBounds: state.coordinateBounds,
      axisOrientation: state.axisOrientation,
      zoom: state.zoom || 1,
      panX: state.panX || 0,
      panY: state.panY || 0
    });
  }

  handleResize() {
    this.setupCanvas();
    this.updateCoordinateSystem();
    this.requestRender();
  }

  requestRender() {
    if (this.renderRequested) return;
    
    this.renderRequested = true;
    requestAnimationFrame((timestamp) => {
      if (timestamp - this.lastRenderTime >= this.frameInterval) {
        this.render();
        this.lastRenderTime = timestamp;
      }
      this.renderRequested = false;
    });
  }

  render() {
    if (!this.isInitialized) return;
    
    const state = window.EnderTrack.State.get();
    
    this.clear();
    
    // === RENDER ORDER (DO NOT CHANGE) ===
    // 1. Background + Grid (base layer)
    // 2. Overlays/Calques (images, always behind interactive elements)
    // 3. Tracks + Positions + Curseur (interactive, always on top of overlays)
    // 4. UI elements (compass, info, always topmost)
    
    // Layer 1: Background
    window.EnderTrack.BackgroundRenderer.render(this.ctx, this.canvas, state);
    window.EnderTrack.GridRenderer.render(this.ctx, this.canvas, state);
    
    // Layer 2: Overlays/Calques (ALWAYS behind positions and cursor)
    if (window.EnderTrack?.Overlays && window.EnderTrack.Coordinates) {
      window.EnderTrack.Overlays.renderOverlays(this.ctx, window.EnderTrack.Coordinates);
    }
    
    // Layer 3: Interactive elements (ALWAYS on top of overlays)
    window.EnderTrack.TrackRenderer.render(this.ctx, this.canvas, state);
    window.EnderTrack.PositionRenderer.render(this.ctx, this.canvas, state);
    
    if (window.EnderTrack?.StrategicPositions && window.EnderTrack.Coordinates) {
      window.EnderTrack.StrategicPositions.renderOnCanvas(this.ctx, window.EnderTrack.Coordinates);
    }
    
    if (window.EnderTrack?.Lists?.renderOnCanvas && window.EnderTrack.Coordinates) {
      window.EnderTrack.Lists.renderOnCanvas(this.ctx, window.EnderTrack.Coordinates);
    }
    
    // Layer 4: UI (topmost)
    window.EnderTrack.UIRenderer.render(this.ctx, this.canvas, state);
    
    window.EnderTrack.Events.notifyListeners('canvas:rendered', this.ctx, state);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Utility methods for external use
  drawCircle(x, y, radius, color, fill = true) {
    window.EnderTrack.CanvasUtils.drawCircle(this.ctx, x, y, radius, color, fill);
  }

  drawLine(x1, y1, x2, y2, color, width = 1) {
    window.EnderTrack.CanvasUtils.drawLine(this.ctx, x1, y1, x2, y2, color, width);
  }

  drawText(x, y, text, color, font = '12px sans-serif') {
    window.EnderTrack.CanvasUtils.drawText(this.ctx, x, y, text, color, font);
  }

  getCanvas() { return this.canvas; }
  getContext() { return this.ctx; }

  exportAsImage(filename = 'endertrack_canvas.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = this.canvas.toDataURL();
    link.click();
  }

  centerView(worldX, worldY) {
    const state = window.EnderTrack.State.get();
    const zoom = state.zoom || 1;
    
    // Calculate new pan to center the view on the given world coordinates
    const newPanX = -worldX * zoom;
    const newPanY = -worldY * zoom;
    
    window.EnderTrack.State.update({
      panX: newPanX,
      panY: newPanY
    });
    
    this.requestRender();
  }

  getDebugInfo() {
    return {
      canvasSize: `${this.canvas.width}x${this.canvas.height}`,
      isInitialized: this.isInitialized,
      lastRenderTime: this.lastRenderTime,
      coordinates: window.EnderTrack.Coordinates.getDebugInfo()
    };
  }
}

// Global instance - maintain compatibility
window.EnderTrack = window.EnderTrack || {};
// Sauvegarder les overlays avant d'écraser Canvas
const compassOverlay = window.EnderTrack.Canvas?.CompassOverlay;
const compassZOverlay = window.EnderTrack.Canvas?.CompassZOverlay;
window.EnderTrack.Canvas = new XYCanvasManager();
// Restaurer les overlays
if (compassOverlay) window.EnderTrack.Canvas.CompassOverlay = compassOverlay;
if (compassZOverlay) window.EnderTrack.Canvas.CompassZOverlay = compassZOverlay;