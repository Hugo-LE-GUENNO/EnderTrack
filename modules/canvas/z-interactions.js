// modules/canvas/z-interactions.js - Z canvas interactions
class ZInteractions {
  constructor(zVisualization) {
    this.zVis = zVisualization;
    this.isDragging = false;
    this.lastMouseY = 0;
  }

  setupEventListeners() {
    if (!this.zVis.canvas) {
      console.warn('⚠️ Z-canvas not found for event listeners');
      return;
    }

    // console.log('🎯 Setting up Z-canvas event listeners on:', this.zVis.canvas);
    
    // Wheel events with passive: false to allow preventDefault
    this.zVis.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    this.zVis.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.zVis.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.zVis.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.zVis.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    let _zClickTimer = null;
    this.zVis.canvas.addEventListener('click', (e) => {
      if (_zClickTimer) { clearTimeout(_zClickTimer); _zClickTimer = null; return; }
      _zClickTimer = setTimeout(() => { _zClickTimer = null; this.handleClick(e); }, 250);
    });
    this.zVis.canvas.addEventListener('dblclick', (e) => {
      if (_zClickTimer) { clearTimeout(_zClickTimer); _zClickTimer = null; }
    });
    
    this.zVis.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    
    // console.log('✅ Z-canvas event listeners configured');
  }

  handleWheel(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Trackpad 2-finger scroll → pan Z
    if (!e.ctrlKey && !e.metaKey && e.deltaMode === 0 && Math.abs(e.deltaY) < 50 && !Number.isInteger(e.deltaY)) {
      this.zVis.zPan -= e.deltaY * 0.1;
      window.EnderTrack.State.update({ zPan: this.zVis.zPan });
      this.zVis.render();
      return;
    }
    
    const state = window.EnderTrack.State.get();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const dimensions = state.plateauDimensions || { x: 200, y: 200, z: 100 };
    
    const minZoom = this.zVis.canvas.height / dimensions.z;
    const currentZoom = state.zZoom || minZoom;
    const newZoom = Math.max(minZoom, Math.min(1000, currentZoom * delta));
    
    // Center zoom on current Z position (cursor), not mouse
    const cursorZ = state.pos?.z || 0;
    
    // Update zoom and range
    const newRange = this.zVis.canvas.height / newZoom;
    
    // Adjust pan so cursor Z stays centered
    this.zVis.zPan = cursorZ;
    
    window.EnderTrack.State.update({ zZoom: newZoom, zPan: this.zVis.zPan });
    this.zVis.zRange = newRange;
    this.zVis.render();
    // Z sensitivity handled by NavigationControls.updateSliderRanges via state:changed
  }

  handleMouseDown(e) {
    this.isDragging = true;
    this._zDragMoved = false;
    this._zPanning = false;
    this.lastMouseY = e.clientY;
    this.dragStartY = e.clientY;
  }

  handleMouseMove(e) {
    const rect = this.zVis.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    if (!this.isDragging) {
      this.updateMouseZ(canvasY);
    }
    
    this.checkZCompassHover(canvasX, canvasY);
    this._checkListPointHover(canvasX, canvasY);
    this.updateZCursor(canvasY);
    
    if (this.isDragging) {
      const totalDist = Math.abs(e.clientY - this.dragStartY);
      if (!this._zPanning && totalDist > 3) {
        this._zPanning = true;
        this._zDragMoved = true;
        this.zVis.canvas.style.cursor = 'grabbing';
      }
      if (this._zPanning) this.handlePan(e);
    } else {
      this.zVis.updateZInfo(window.EnderTrack.State.get());
    }
  }

  handleMouseUp(e) {
    if (this._zPanning) this.zVis.canvas.style.cursor = '';
    this.isDragging = false;
    this._zPanning = false;
  }

  handleMouseLeave() {
    this.isDragging = false;
    this.zVis.canvas.style.cursor = '';
    this.zVis.canvas.classList.add('crosshair-cursor');
    this.zVis.mouseZ = null;
    this.zVis.updateZInfo(window.EnderTrack.State.get());
  }

  handleClick(e) {
    if (this._zDragMoved) { this._zDragMoved = false; return; }
    if (e.button === 0) {
      const rect = this.zVis.canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      
      if (this.handleCompassClick(canvasX, canvasY)) return;
      if (this.handleHistoryClick(canvasY)) return;
      
      // Hit test list points on Z canvas
      const hitPos = this._hitTestListPoint(canvasX, canvasY);
      if (hitPos) {
        if (window.EnderTrack?.Lists?.isActive && window.EnderTrack.Lists.currentMode === 'click') {
          return; // Don't navigate in click-to-add mode
        }
        window.EnderTrack?.Movement?.moveAbsolute?.(hitPos.x, hitPos.y, hitPos.z);
        return;
      }
      
      // Lists mode: add point with current XY + clicked Z
      if (window.EnderTrack?.Lists?.isActive && window.EnderTrack.Lists.currentMode === 'click') {
        const ci = window.EnderTrack?.CanvasInteractions;
        if (ci?._dragMoved || Date.now() - (ci?._lastPanTime || 0) < 500) return;
        if (this.zVis.mouseZ !== null && this.isMouseZValid()) {
          const pos = window.EnderTrack.State.get().pos;
          window.EnderTrack.Lists.addPosition(pos.x, pos.y, this.zVis.mouseZ);
        }
        return;
      }
      
      if (window.EnderTrack?.Scenario?.isExecuting) return;
      
      this.handleZClickAndGo(e);
    }
  }

  _hitTestListPoint(canvasX, canvasY) {
    const Lists = window.EnderTrack?.Lists;
    if (!Lists) return null;
    const canvas = this.zVis.canvas;
    const state = window.EnderTrack.State.get();
    const zOrientation = state.axisOrientation?.z || 'up';
    const zInverted = zOrientation === 'down' ? -1 : 1;
    const halfRange = this.zVis.zRange / 2;
    const r = 10; // hit radius
    
    for (const g of Lists.groups) {
      if (!g.positions?.length) continue;
      const byZ = new Map();
      g.positions.forEach((p, idx) => {
        const zKey = Math.round(p.z * 100);
        if (!byZ.has(zKey)) byZ.set(zKey, []);
        byZ.get(zKey).push({ p, idx });
      });
      for (const [zKey, points] of byZ) {
        const z = zKey / 100;
        const y = canvas.height / 2 - (zInverted * (z - this.zVis.zPan) / halfRange) * (canvas.height / 2);
        const spacing = Math.min(12.5, (canvas.width - 20) / Math.max(points.length, 1));
        const startX = canvas.width / 2 - ((points.length - 1) * spacing) / 2;
        for (let i = 0; i < points.length; i++) {
          const cx = startX + i * spacing;
          if (Math.hypot(canvasX - cx, canvasY - y) <= r) {
            return points[i].p;
          }
        }
      }
    }
    return null;
  }

  _checkListPointHover(canvasX, canvasY) {
    const hit = this._hitTestListPoint(canvasX, canvasY);
    this._hoveredListPoint = hit;
    // Update Lists hoveredIdx for visual feedback
    const Lists = window.EnderTrack?.Lists;
    if (Lists && hit) {
      const g = Lists._activeGroup?.();
      if (g) {
        const idx = g.positions.findIndex(p => p.x === hit.x && p.y === hit.y && p.z === hit.z);
        if (idx >= 0) Lists.hoverPoint(idx);
      }
    } else if (Lists) {
      Lists.hoverPoint(null);
    }
    this.zVis.render();
  }

  updateMouseZ(canvasY) {
    const state = window.EnderTrack.State.get();
    const zOrientation = state.axisOrientation?.z || 'up';
    const zInverted = zOrientation === 'down' ? -1 : 1;
    
    const rawZ = this.zVis.zPan + zInverted * (0.5 - canvasY / this.zVis.canvas.height) * this.zVis.zRange;
    this.zVis.mouseZ = Math.round(rawZ * 100) / 100;
  }

  checkZCompassHover(canvasX, canvasY) {
    const wasHovered = this.zVis.zCompassHovered || false;
    
    if (this.zVis.zCompassBounds) {
      const bounds = this.zVis.zCompassBounds;
      this.zVis.zCompassHovered = canvasX >= bounds.x && canvasX <= bounds.x + bounds.width &&
                                  canvasY >= bounds.y && canvasY <= bounds.y + bounds.height;
    } else {
      this.zVis.zCompassHovered = false;
    }
    
    if (wasHovered !== this.zVis.zCompassHovered) {
      requestAnimationFrame(() => this.zVis.render());
    }
  }

  updateZCursor(canvasY) {
    const canvas = this.zVis.canvas;
    const state = window.EnderTrack.State.get();
    
    if (window.EnderTrack?.Scenario?.isExecuting) {
      canvas.style.cursor = 'not-allowed';
      return;
    }
    
    if (this.zVis.zCompassHovered) {
      canvas.style.cursor = 'pointer';
      return;
    }
    
    // Hover on list point → pointer
    if (this._hoveredListPoint) {
      canvas.style.cursor = 'pointer';
      return;
    }
    
    // Lists click mode
    if (window.EnderTrack?.Lists?.isActive && window.EnderTrack.Lists.currentMode === 'click') {
      const isValid = this.isMouseZValid();
      if (isValid) {
        canvas.style.cursor = 'copy';
      } else {
        canvas.style.cursor = 'not-allowed';
        canvas.classList.remove('crosshair-cursor');
      }
      return;
    }
    
    const zOrientation = state.axisOrientation?.z || 'up';
    const zInverted = zOrientation === 'down' ? -1 : 1;
    
    if (state.historyMode && state.positionHistory) {
      const finalPositions = state.positionHistory.filter(p => p.isFinalPosition);
      const clickRadius = 8;
      const halfRange = this.zVis.zRange / 2;
      let overHistoryZ = false;
      
      for (const pos of finalPositions) {
        const posY = this.zVis.canvas.height/2 - (zInverted * (pos.z - this.zVis.zPan) / halfRange) * (this.zVis.canvas.height/2);
        if (Math.abs(canvasY - posY) <= clickRadius) {
          overHistoryZ = true;
          break;
        }
      }
      
      canvas.style.cursor = overHistoryZ ? 'pointer' : '';
      if (overHistoryZ) {
        canvas.classList.remove('crosshair-cursor');
      } else {
        canvas.classList.add('crosshair-cursor');
      }
    } else {
      const isValid = this.isMouseZValid();
      if (isValid) {
        canvas.style.cursor = '';
        canvas.classList.add('crosshair-cursor');
      } else {
        canvas.style.cursor = 'not-allowed';
        canvas.classList.remove('crosshair-cursor');
      }
    }
  }

  handlePan(e) {
    const state = window.EnderTrack.State.get();
    const zOrientation = state.axisOrientation?.z || 'up';
    const zInverted = zOrientation === 'down' ? -1 : 1;
    
    const deltaY = e.clientY - this.lastMouseY;
    const zMovement = zInverted * (deltaY / this.zVis.canvas.height) * this.zVis.zRange;
    const newPan = this.zVis.zPan + zMovement;
    
    const bounds = state.coordinateBounds || { z: { min: -20, max: 80 } };
    const maxPan = bounds.z.max - this.zVis.zRange / 4;
    const minPan = bounds.z.min + this.zVis.zRange / 4;
    
    const clampedPan = Math.max(minPan, Math.min(maxPan, newPan));
    this.zVis.zPan = clampedPan;
    
    window.EnderTrack.State.update({ zPan: clampedPan });
    
    this.lastMouseY = e.clientY;
    this.zVis.render();
  }

  handleCompassClick(canvasX, canvasY) {
    if (this.zVis.zCompassBounds && 
        canvasX >= this.zVis.zCompassBounds.x && canvasX <= this.zVis.zCompassBounds.x + this.zVis.zCompassBounds.width &&
        canvasY >= this.zVis.zCompassBounds.y && canvasY <= this.zVis.zCompassBounds.y + this.zVis.zCompassBounds.height) {
      
      this.zFitToView();
      return true;
    }
    return false;
  }

  zFitToView() {
    const state = window.EnderTrack.State.get();
    const bounds = state.coordinateBounds || { z: { min: -20, max: 80 } };
    const zMin = bounds.z.min;
    const zMax = bounds.z.max;
    const zRange = zMax - zMin;
    
    // Calculer le zoom pour que toute la plage soit visible avec une marge
    const margin = 0.05; // 5% de marge en haut et bas
    const effectiveHeight = this.zVis.canvas.height * (1 - 2 * margin);
    const optimalZoom = effectiveHeight / zRange;
    
    // Centrer sur la plage du plateau
    const centerZ = (zMin + zMax) / 2;
    
    this.zVis.zPan = centerZ;
    window.EnderTrack.State.update({ 
      zZoom: optimalZoom, 
      zPan: centerZ 
    });
    
    this.zVis.zRange = this.zVis.canvas.height / optimalZoom;
    this.zVis.render();
  }

  handleHistoryClick(canvasY) {
    const state = window.EnderTrack.State.get();
    const zOrientation = state.axisOrientation?.z || 'up';
    const zInverted = zOrientation === 'down' ? -1 : 1;
    
    if (state.historyMode && state.positionHistory) {
      const finalPositions = state.positionHistory.filter(p => p.isFinalPosition);
      const clickRadius = 8;
      const halfRange = this.zVis.zRange / 2;
      
      for (let i = 0; i < finalPositions.length; i++) {
        const pos = finalPositions[i];
        const posY = this.zVis.canvas.height/2 - (zInverted * (pos.z - this.zVis.zPan) / halfRange) * (this.zVis.canvas.height/2);
        
        if (Math.abs(canvasY - posY) <= clickRadius) {
          window.EnderTrack.State.goToHistoryPosition(i);
          return true;
        }
      }
    }
    return false;
  }

  handleZClickAndGo(e) {
    const state = window.EnderTrack.State.get();
    
    if (state.historyMode || state.lockZ) return;
    
    if (!this.isMouseZValid()) {
      window.EnderTrack?.UI?.showNotification?.('Position Z non autorisée', 'warning');
      return;
    }
    
    if (this.zVis.mouseZ !== null) {
      const inputZ = document.getElementById('inputZ');
      if (inputZ) {
        inputZ.value = this.zVis.mouseZ.toFixed(2);
        inputZ.dispatchEvent(new Event('input', { bubbles: true }));
        
        if (window.updateGetButtonStates) {
          window.updateGetButtonStates();
        }
        
        setTimeout(() => this.zVis.render(), 10);
      }
      
      this.zVis.showZClickDialog(this.zVis.mouseZ, e.clientX, e.clientY);
    }
  }
  
  isMouseZValid() {
    if (this.zVis.mouseZ === null) return false;
    
    const state = window.EnderTrack.State.get();
    const bounds = state.coordinateBounds || { z: { min: 0, max: 100 } };
    
    // 1. Vérifier les bornes du plateau
    if (this.zVis.mouseZ < bounds.z.min || this.zVis.mouseZ > bounds.z.max) {
      return false;
    }
    
    // 2. Vérifier les limites de sécurité (si définies)
    if (window.EnderTrack?.StrategicPositions) {
      const limits = window.EnderTrack.StrategicPositions.getLimits();
      if (limits.zMin !== null && limits.zMax !== null) {
        if (this.zVis.mouseZ < limits.zMin || this.zVis.mouseZ > limits.zMax) {
          return false;
        }
      }
    }
    
    return true;
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ZInteractions = ZInteractions;