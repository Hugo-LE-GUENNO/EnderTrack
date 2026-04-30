// modules/canvas/canvas-manager.js - Core canvas management
class CanvasManager {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isInitialized = false;
    this.renderRequested = false;
    this.lastRenderTime = 0;
    this.targetFPS = 60;
    this.frameInterval = 1000 / this.targetFPS;
    this.clickAndGoEnabled = true;
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
    
    const width = Math.floor(rect.width - 16);
    const height = Math.floor(rect.height - 16);
    
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
    
    // Debounced input listeners
    setTimeout(() => {
      let renderTimeout;
      const debouncedRender = () => {
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => this.requestRender(), 100);
      };
      
      const inputs = ['inputX', 'inputY', 'inputZ', 'sensitivityX', 'sensitivityY', 'sensitivityZ', 'sensitivityXY'];
      inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('input', debouncedRender);
      });
      
      ['relativeTab', 'absoluteTab'].forEach(id => {
        const tab = document.getElementById(id);
        if (tab) {
          tab.addEventListener('click', () => {
            setTimeout(() => this.requestRender(), 50);
          });
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
    
    // Render using specialized renderers
    window.EnderTrack.BackgroundRenderer.render(this.ctx, this.canvas, state);
    window.EnderTrack.GridRenderer.render(this.ctx, this.canvas, state);
    window.EnderTrack.TrackRenderer.render(this.ctx, this.canvas, state);
    window.EnderTrack.PositionRenderer.render(this.ctx, this.canvas, state);
    window.EnderTrack.UIRenderer.render(this.ctx, this.canvas, state);
    
    window.EnderTrack.Events.notifyListeners('canvas:rendered', this.ctx, state);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Utility methods
  getCanvas() { return this.canvas; }
  getContext() { return this.ctx; }

  exportAsImage(filename = 'endertrack_canvas.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = this.canvas.toDataURL();
    link.click();
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

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Canvas = new CanvasManager();