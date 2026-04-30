// modules/canvas/z-canvas.js - Main Z Canvas orchestrator
// Simplified Z-axis visualization using specialized renderers

class ZVisualization {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isInitialized = false;
    this.zRange = 200;
    this.zPan = 0;
    this.mouseZ = null;
    this.resizePending = false;
    this.zCompassHovered = false;
    this.zCompassBounds = null;
    
    this.interactions = new window.EnderTrack.ZInteractions(this);
  }

  init() {

    
    const zPanel = document.getElementById('zVisualizationPanel');
    if (!zPanel) {
      console.error('❌ Z panel element not found!');
      return false;
    }
    
    zPanel.style.display = 'flex';
    zPanel.style.visibility = 'visible';
    // console.log('✅ Z panel visible in init()');
    
    this.setupCanvas(zPanel);
    this.setupEventListeners();
    this.initializeZoom();
    this.addInitialPosition();
    
    this.isInitialized = true;
    setTimeout(() => this.render(), 100);
    
    return true;
  }

  setupCanvas(zPanel) {
    const zScale = document.getElementById('zScale');
    if (!zScale) {
      console.warn('zScale element not found');
      return;
    }
    
    zScale.innerHTML = '';
    
    this.canvas = document.createElement('canvas');
    this.canvas.width = 80;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.cursor = 'crosshair';
    
    this.ctx = this.canvas.getContext('2d');
    zScale.appendChild(this.canvas);
    
    // Set canvas height after DOM is ready
    setTimeout(() => {
      const actualHeight = zScale.offsetHeight;
      this.canvas.height = actualHeight;
      this.render();
    }, 50);
  }

  setupEventListeners() {
    // State change listeners
    window.EnderTrack.Events?.on?.('state:changed', () => this.render());
    window.EnderTrack.Events?.on?.('position:changed', () => this.render());
    window.EnderTrack.Events?.on?.('movement:started', () => this.render());
    window.EnderTrack.Events?.on?.('movement:completed', () => this.render());
    window.EnderTrack.Events?.on?.('history:cleared', () => {
      const state = window.EnderTrack.State.get();
      this.zRange = 50 / (state.zZoom || 1);
      setTimeout(() => this.render(), 50);
    });
    
    // Listener pour changements de dimensions plateau
    window.EnderTrack.Events?.on?.('plateau:changed', () => {
      this.updatePlateauDimensions();
    });
    
    // Input listeners
    const inputs = ['inputZ', 'sensitivityZ'];
    inputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.addEventListener('input', () => this.render());
    });
    
    // Mode change listeners
    ['relativeTab', 'absoluteTab'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          setTimeout(() => this.render(), 50);
        });
      }
    });
    
    // Resize observer
    if (this.canvas && window.ResizeObserver) {
      const canvasContent = document.querySelector('.canvas-content');
      if (canvasContent) {
        this.resizeObserver = new ResizeObserver(() => {
          if (!this.resizePending) {
            this.resizePending = true;
            requestAnimationFrame(() => {
              this.resize();
              this.resizePending = false;
            });
          }
        });
        this.resizeObserver.observe(canvasContent);
      }
    }
    
    // Mouse interactions
    this.interactions.setupEventListeners();
  }

  updatePlateauDimensions() {
    const state = window.EnderTrack.State.get();
    const bounds = state.coordinateBounds || { z: { min: -20, max: 80 } };
    const zRange = bounds.z.max - bounds.z.min;
    
    // Recalculer le zoom minimum
    const minZoom = this.canvas.height / zRange;
    
    // Réinitialiser le zoom et centrer
    const centerZ = (bounds.z.min + bounds.z.max) / 2;
    this.zPan = centerZ;
    
    window.EnderTrack.State.update({ 
      zZoom: minZoom, 
      zPan: centerZ 
    });
    
    this.zRange = this.canvas.height / minZoom;
    
    // Forcer le rendu immédiat
    setTimeout(() => {
      this.render();
    }, 50);
  }

  initializeZoom() {
    const state = window.EnderTrack.State.get();
    const bounds = state.coordinateBounds || { z: { min: -20, max: 80 } };
    const zRange = bounds.z.max - bounds.z.min;
    
    const minZoom = this.canvas.height / zRange;
    if (!state.zZoom || state.zZoom < minZoom) {
      window.EnderTrack.State.update({ zZoom: minZoom });
    }
    
    const currentZoom = state.zZoom || minZoom;
    this.zRange = this.canvas.height / currentZoom;
    
    // Centrer sur la plage du plateau
    const centerZ = (bounds.z.min + bounds.z.max) / 2;
    this.zPan = centerZ;
    window.EnderTrack.State.update({ zPan: centerZ });
  }

  addInitialPosition() {
    const state = window.EnderTrack.State.get();
    if (state.positionHistory.length === 0) {
      window.EnderTrack.State.recordFinalPosition(state.pos);
    }
  }

  render() {
    if (!this.isInitialized || !this.ctx) return;
    
    const state = window.EnderTrack.State.get();
    
    this.clear();
    
    // Synchroniser zPan local avec l'état global
    this.zPan = state.zPan || 0;
    
    // Render using specialized renderers
    if (!window.EnderTrack.ZGridRenderer || !window.EnderTrack.ZPositionRenderer || !window.EnderTrack.ZUIRenderer) return;
    window.EnderTrack.ZGridRenderer.render(this.ctx, this.canvas, state, this.zPan, this.zRange);
    window.EnderTrack.ZPositionRenderer.render(this.ctx, this.canvas, state, this.zPan, this.zRange);
    this.zCompassBounds = window.EnderTrack.ZUIRenderer.render(this.ctx, this.canvas, state, this.zPan, this.zRange, this.zCompassHovered, this.zCompassBounds);
    
    this.updateZInfo(state);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const backgroundColor = window.customColors?.zBackground || '#1a1a1a';
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  updateZInfo(state) {
    const zPosition = document.getElementById('zPosition');
    const zZoomLevel = document.getElementById('zZoomLevel');
    const zPanLevel = document.getElementById('zPanLevel');
    
    if (zPosition) {
      // Afficher mouseZ seulement si présent, sinon afficher '----'
      const mouseZText = this.mouseZ !== null ? this.mouseZ.toFixed(1) : '----';
      zPosition.textContent = mouseZText;
    }
    
    if (zZoomLevel) {
      const dimensions = state.plateauDimensions || { x: 200, y: 200, z: 100 };
      const minZoom = this.canvas.height / dimensions.z;
      const zZoom = state.zZoom || minZoom;
      zZoomLevel.textContent = zZoom.toFixed(1) + 'x';
    }
    
    if (zPanLevel) {
      // Utiliser state.zPan au lieu de this.zPan pour la synchronisation
      const zPan = state.zPan || 0;
      zPanLevel.textContent = zPan.toFixed(1);
    }
  }

  showZClickDialog(targetZ, screenX, screenY) {
    this.showClickAndGoDialog({ z: targetZ }, screenX, screenY);
  }
  
  showClickAndGoDialog(pos, screenX, screenY) {
    const existingDialog = document.querySelector('.click-and-go-dialog');
    if (existingDialog) existingDialog.remove();
    
    // Ensure shared styles exist (same as XY click-and-go)
    if (window.EnderTrack?.ClickHandler?.prototype?.addDialogStyles) {
      window.EnderTrack.ClickHandler.prototype.addDialogStyles();
    } else if (!document.querySelector('#click-and-go-styles')) {
      const style = document.createElement('style');
      style.id = 'click-and-go-styles';
      style.textContent = `
        .click-and-go-dialog { background: var(--container-bg); border: 1px solid #666; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 180px; }
        .click-and-go-dialog .coords { display: grid; grid-template-columns: 20px 1fr; gap: 4px 8px; margin-bottom: 10px; font-size: 12px; color: var(--text-general); }
        .click-and-go-dialog .coords b { font-family: monospace; color: var(--coordinates-color); font-weight: 500; }
        .click-and-go-dialog .btns { display: flex; gap: 6px; }
        .click-and-go-dialog button { flex: 1; padding: 6px; border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
        .click-and-go-dialog .go { background: var(--active-element); color: var(--text-selected); }
        .click-and-go-dialog .go:hover { background: var(--coordinates-color); color: #000; }
        .click-and-go-dialog .cancel { background: #444; color: var(--text-general); }
        .click-and-go-dialog .cancel:hover { background: #555; }
      `;
      document.head.appendChild(style);
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'click-and-go-dialog';
    dialog.style.cssText = `position: fixed; left: ${screenX + 10}px; top: ${screenY - 60}px; z-index: 10000;`;
    
    dialog.innerHTML = `
      <div class="coords">
        <span>Z</span><b>${pos.z.toFixed(2)}</b>
      </div>
      <div class="btns">
        <button class="go">Go</button>
      </div>
    `;
    
    document.body.appendChild(dialog);
    this.positionDialog(dialog, screenX, screenY);
    this.setupDialogHandlers(dialog, pos);
  }

  positionDialog(dialog, screenX, screenY) {
    const rect = dialog.getBoundingClientRect();
    
    let adjustedX = screenX + 10;
    let adjustedY = screenY - 60;
    
    if (rect.right > window.innerWidth) {
      adjustedX = screenX - rect.width - 10;
    }
    if (rect.top < 0) {
      adjustedY = screenY + 10;
    }
    if (rect.bottom > window.innerHeight) {
      adjustedY = window.innerHeight - rect.height - 10;
    }
    
    dialog.style.left = adjustedX + 'px';
    dialog.style.top = adjustedY + 'px';
  }

  setupDialogHandlers(dialog, pos) {
    const goBtn = dialog.querySelector('.go');
    
    goBtn.addEventListener('click', () => {
      if (window.EnderTrack.Movement) {
        const state = window.EnderTrack.State.get();
        window.EnderTrack.Movement.moveAbsolute(state.pos.x, state.pos.y, pos.z);
      }
      dialog.remove();
    });
    
    const closeDialog = (e) => {
      if (e.type === 'keydown' && e.key === 'Escape') {
        dialog.remove();
        document.removeEventListener('keydown', closeDialog);
        document.removeEventListener('click', closeDialog);
      } else if (e.type === 'click' && !dialog.contains(e.target)) {
        dialog.remove();
        document.removeEventListener('keydown', closeDialog);
        document.removeEventListener('click', closeDialog);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('keydown', closeDialog);
      document.addEventListener('click', closeDialog);
    }, 100);
    
    goBtn.focus();
  }

  resize() {
    if (this.canvas) {
      const zScale = document.getElementById('zScale');
      
      if (zScale) {
        const newHeight = zScale.offsetHeight;
        const newWidth = 80;
        
        if (this.canvas.height !== newHeight || this.canvas.width !== newWidth) {
          this.canvas.width = newWidth;
          this.canvas.height = newHeight;
          
          const state = window.EnderTrack.State.get();
          const bounds = state.coordinateBounds || { z: { min: -20, max: 80 } };
          const zRange = bounds.z.max - bounds.z.min;
          const minZoom = newHeight / zRange;
          
          if (state.zZoom < minZoom) {
            window.EnderTrack.State.update({ zZoom: minZoom });
          }
          
          this.zRange = newHeight / (state.zZoom || minZoom);
          setTimeout(() => this.render(), 10);
        }
      }
    }
  }

  // Public API
  update() {
    this.render();
  }
}

// Global instance - maintain compatibility
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ZVisualization = new ZVisualization();