// core/renderer.js - Render coordination engine
// Coordinates rendering requests across modules

class RenderEngine {
  constructor() {
    this.isInitialized = false;
    this.renderQueue = [];
    this.isRendering = false;
    this.lastRenderTime = 0;
    this.targetFPS = 60;
    this.frameInterval = 1000 / this.targetFPS;
  }

  static init() {
    
    this.setupEventListeners();
    this.startRenderLoop();
    
    this.isInitialized = true;
    
    return true;
  }

  static setupEventListeners() {
    const renderTriggerEvents = [
      'state:changed',
      'movement:started',
      'movement:completed',
      'canvas:clicked',
      'canvas:dragged',
      'position:changed'
    ];
    
    renderTriggerEvents.forEach(event => {
      EnderTrack.Events?.on?.(event, () => {
        this.requestRender('event', event);
      });
    });
    
    window.addEventListener('resize', () => {
      this.requestRender('resize');
    });
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.requestRender('visibility');
      }
    });
  }

  static startRenderLoop() {
    const renderLoop = (timestamp) => {
      if (timestamp - this.lastRenderTime >= this.frameInterval) {
        this.processRenderQueue(timestamp);
        this.lastRenderTime = timestamp;
      }
      
      requestAnimationFrame(renderLoop);
    };
    
    requestAnimationFrame(renderLoop);
  }

  static requestRender(source = 'unknown', details = null) {
    this.renderQueue.push({
      source,
      details,
      timestamp: performance.now()
    });
  }

  static processRenderQueue(timestamp) {
    if (this.renderQueue.length === 0 || this.isRendering) {
      return;
    }
    
    this.isRendering = true;
    
    try {
      // Delegate to Canvas for actual rendering
      if (EnderTrack.Canvas) {
        EnderTrack.Canvas.requestRender();
      }
      
      this.renderQueue = [];
      
      EnderTrack.Events?.emit?.('render:completed', {
        timestamp
      });
      
    } catch (error) {
      console.error('Render coordination error:', error);
      
      EnderTrack.Events?.emit?.('render:error', {
        error: error.message,
        timestamp
      });
      
    } finally {
      this.isRendering = false;
    }
  }

  static setTargetFPS(fps) {
    this.targetFPS = Math.max(1, Math.min(120, fps));
    this.frameInterval = 1000 / this.targetFPS;
  }

  static getRenderStats() {
    return {
      targetFPS: this.targetFPS,
      queueLength: this.renderQueue.length,
      isRendering: this.isRendering
    };
  }
}

// Global registration
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Renderer = RenderEngine;