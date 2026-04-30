// modules/canvas/interactions/click-handler.js - Gestion des clics et navigation

class ClickHandler {
  constructor(interactions) {
    this.interactions = interactions;
  }

  handleClick(screenX, screenY, event) {
    // Block everything during scenario execution
    if (window.EnderTrack?.Scenario?.isExecuting) {
      return;
    }
    
    // Auto-switch to Navigation tab if clicking canvas from a passive tab
    // Exclude: lists, acquisition (own click behavior), settings when overlays active (image manipulation)
    const activeTab = window.EnderTrack?.State?.get()?.activeTab;
    if (activeTab && activeTab !== 'navigation' && activeTab !== 'lists' && activeTab !== 'acquisition') {
      if (activeTab === 'settings' && window.EnderTrack?.Overlays?.isActive) {
        return; // Let overlay handle the click (drag, resize, etc.)
      }
      if (typeof switchTab === 'function') {
        switchTab('navigation');
      }
      // Force crosshair cursor immediately
      const canvas = this.interactions.canvas;
      if (canvas) {
        canvas.style.cursor = '';
        canvas.classList.add('crosshair-cursor');
      }
      // Continue to process the click-and-go below
    }
    
    // Block click-and-go if Overlays module is active
    if (window.EnderTrack?.Overlays?.isActive) {
      return;
    }
    
    // Block click-and-go if disabled
    if (window.EnderTrack?.Canvas?.clickAndGoEnabled === false) {
      return;
    }
    

    
    const canvasPos = this.interactions.screenToCanvas(screenX, screenY);
    
    // Check if this was a drag operation
    const dragDistance = Math.sqrt(
      Math.pow(screenX - this.interactions.dragStartPos.x, 2) + 
      Math.pow(screenY - this.interactions.dragStartPos.y, 2)
    );
    
    if (dragDistance > 5) return; // This was a drag, not a click
    
    // Check compass click
    if (this.checkCompassClick(canvasPos)) return;
    
    // Check mini-preview click
    if (this.checkMiniPreviewClick(screenX, screenY)) return;
    
    // Check mini-Z-preview click
    if (this.checkMiniZPreviewClick(screenX, screenY)) return;
    
    // Calculate map position
    const mapPos = this.calculateMapPosition(canvasPos);
    
    // Check if on plateau
    if (!this.isOnPlateau(mapPos)) return;
    
    // Handle different click modes
    if (this.handleSpecialModes(mapPos, canvasPos, screenX, screenY)) return;
    
    // Handle normal click-to-move
    this.handleNormalClick(mapPos, screenX, screenY);
    
    // Emit event
    EnderTrack.Events.emit('canvas:clicked', {
      screen: { x: screenX, y: screenY },
      canvas: canvasPos,
      map: mapPos,
      originalEvent: event
    });
  }

  checkCompassClick(canvasPos) {

    if (window.EnderTrack?.UIRenderer?.compassBounds) {
      const bounds = window.EnderTrack.UIRenderer.compassBounds;

      if (canvasPos.cx >= bounds.x && canvasPos.cx <= bounds.x + bounds.width &&
          canvasPos.cy >= bounds.y && canvasPos.cy <= bounds.y + bounds.height) {

        this.interactions.zoomPanHandler.fitToView();
        return true;
      }
    }
    
    // Fallback: check if click is in compass area (top-right corner)
    const compassArea = {
      x: this.interactions.canvas.width - 90,
      y: 5,
      width: 80,
      height: 80
    };
    
    if (canvasPos.cx >= compassArea.x && canvasPos.cx <= compassArea.x + compassArea.width &&
        canvasPos.cy >= compassArea.y && canvasPos.cy <= compassArea.y + compassArea.height) {

      this.interactions.zoomPanHandler.fitToView();
      return true;
    }
    
    return false;
  }

  checkMiniPreviewClick(screenX, screenY) {
    if (window.EnderTrack?.MiniPreview) {
      const canvasPos = this.interactions.screenToCanvas(screenX, screenY);
      const state = EnderTrack.State.get();
      return window.EnderTrack.MiniPreview.handleClick(
        canvasPos.cx, canvasPos.cy, 
        this.interactions.canvas.width, 
        this.interactions.canvas.height, 
        state
      );
    }
    return false;
  }

  checkMiniZPreviewClick(screenX, screenY) {
    if (window.EnderTrack?.MiniZPreview) {
      const canvasPos = this.interactions.screenToCanvas(screenX, screenY);
      const state = EnderTrack.State.get();
      return window.EnderTrack.MiniZPreview.handleClick(
        canvasPos.cx, canvasPos.cy, 
        this.interactions.canvas.width, 
        this.interactions.canvas.height, 
        state
      );
    }
    return false;
  }

  calculateMapPosition(canvasPos) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return { x: 0, y: 0 };
    
    return coords.canvasToMap(canvasPos.cx, canvasPos.cy);
  }

  isOnPlateau(mapPos) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return false;
    
    const bounds = coords.getCoordinateBounds();
    return mapPos.x >= bounds.minX && mapPos.x <= bounds.maxX &&
           mapPos.y >= bounds.minY && mapPos.y <= bounds.maxY;
  }

  handleSpecialModes(mapPos, canvasPos, screenX, screenY) {
    const state = EnderTrack.State.get();
    
    // Check strategic positions click (includes list points if locked)
    const strategicClick = this.checkStrategicPositionClick(canvasPos, screenX, screenY);

    if (strategicClick) {
      return true;
    }
    
    // Lists mode - block click-and-go when Lists module is active
    if (window.EnderTrack?.Lists?.isActive) {

      return true; // Lists module handles clicks for adding points only
    }
    
    // History mode - click on existing points
    if (state.historyMode && state.positionHistory) {
      return this.handleHistoryClick(canvasPos, state);
    }
    
    return false;
  }

  checkStrategicPositionClick(canvasPos, screenX, screenY) {
    if (!window.EnderTrack?.StrategicPositions) return false;
    
    const sp = window.EnderTrack.StrategicPositions;
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return false;
    
    const clickRadius = 15;

    
    // Check custom positions
    for (const pos of sp.customPositions) {
      if (!pos || !pos.show) continue;
      
      const posCanvas = coords.mapToCanvas(pos.x, pos.y);
      const distance = Math.sqrt(
        Math.pow(canvasPos.cx - posCanvas.cx, 2) + 
        Math.pow(canvasPos.cy - posCanvas.cy, 2)
      );
      
      if (distance <= clickRadius) {
        this.showStrategicPositionDialog(pos, screenX, screenY);
        return true;
      }
    }
    
    // Check HOME positions
    const homeXY_X = parseFloat(document.getElementById('homeXY_X')?.value || 0);
    const homeXY_Y = parseFloat(document.getElementById('homeXY_Y')?.value || 0);
    const homeXYZ_X = parseFloat(document.getElementById('homeXYZ_X')?.value || 0);
    const homeXYZ_Y = parseFloat(document.getElementById('homeXYZ_Y')?.value || 0);
    const homeXYZ_Z = parseFloat(document.getElementById('homeXYZ_Z')?.value || 0);
    
    const homePositions = [
      { x: homeXY_X, y: homeXY_Y, z: null, label: 'HOME XY', emoji: '🏠', includeZ: false },
      { x: homeXYZ_X, y: homeXYZ_Y, z: homeXYZ_Z, label: 'HOME XYZ', emoji: '🏠', includeZ: true }
    ];
    
    for (const pos of homePositions) {
      const posCanvas = coords.mapToCanvas(pos.x, pos.y);
      const distance = Math.sqrt(
        Math.pow(canvasPos.cx - posCanvas.cx, 2) + 
        Math.pow(canvasPos.cy - posCanvas.cy, 2)
      );
      
      if (distance <= clickRadius) {
        this.showStrategicPositionDialog(pos, screenX, screenY);
        return true;
      }
    }
    
    // Check list points (only if showOnNavigation is enabled)
    if (window.EnderTrack?.Lists) {
      const Lists = window.EnderTrack.Lists;
      const allLists = Lists.manager?.getAllLists?.() || [];

      
      for (const list of allLists) {
        if (list.showOnNavigation !== false && list.positions) {

          for (let i = 0; i < list.positions.length; i++) {
            const point = list.positions[i];
            const posCanvas = coords.mapToCanvas(point.x, point.y);
            const distance = Math.sqrt(
              Math.pow(canvasPos.cx - posCanvas.cx, 2) + 
              Math.pow(canvasPos.cy - posCanvas.cy, 2)
            );

            
            if (distance <= clickRadius) {

              
              // Switch to absolute mode if in relative mode
              const state = EnderTrack.State.get();
              if (state.inputMode === 'relative' && EnderTrack.Navigation) {
                EnderTrack.Navigation.setInputMode('absolute');
              }
              
              // Wait for mode switch, then update inputs
              setTimeout(() => {
                const updatedState = EnderTrack.State.get();
                const inputX = document.getElementById('inputX');
                const inputY = document.getElementById('inputY');
                const inputZ = document.getElementById('inputZ');
                
                if (inputX) {
                  inputX.value = point.x.toFixed(2);
                  inputX.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (inputY) {
                  inputY.value = point.y.toFixed(2);
                  inputY.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (inputZ && point.z !== undefined) {
                  inputZ.value = point.z.toFixed(2);
                  inputZ.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                // Force canvas render to show potential position
                if (window.EnderTrack?.Canvas?.requestRender) {
                  window.EnderTrack.Canvas.requestRender();
                }
              }, 50);
              
              const listPos = {
                x: point.x,
                y: point.y,
                z: point.z || 0,
                label: `${list.name} - ${point.name}`,
                emoji: '📍',
                includeZ: point.z !== undefined
              };
              this.showStrategicPositionDialog(listPos, screenX, screenY);
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  showStrategicPositionDialog(pos, screenX, screenY) {
    const existingDialog = document.querySelector('.click-and-go-dialog');
    if (existingDialog) existingDialog.remove();
    
    const dialog = document.createElement('div');
    dialog.className = 'click-and-go-dialog';
    dialog.style.cssText = `position: fixed; left: ${screenX + 10}px; top: ${screenY - 60}px; z-index: 10000;`;
    
    this.addDialogStyles();
    
    const includeZ = pos.includeZ !== false;
    dialog.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 600; color: var(--text-selected);">${pos.emoji || '📍'} ${pos.label || 'Position'}</div>
      <div class="coords">
        <span>X</span><b>${pos.x.toFixed(2)}</b>
        <span>Y</span><b>${pos.y.toFixed(2)}</b>
        ${includeZ ? `<span>Z</span><b>${pos.z.toFixed(2)}</b>` : ''}
      </div>
      <div class="btns">
        <button class="go">Go</button>
      </div>
    `;
    
    this.positionDialog(dialog, screenX, screenY);
    
    const goBtn = dialog.querySelector('.go');
    
    goBtn.addEventListener('click', () => {
      if (EnderTrack.Movement) {
        const state = EnderTrack.State.get();
        const z = includeZ ? pos.z : state.pos.z;
        EnderTrack.Movement.moveAbsolute(pos.x, pos.y, z);
      }
      dialog.remove();
    });
    
    const closeDialog = (e) => {
      if ((e.type === 'keydown' && e.key === 'Escape') || 
          (e.type === 'click' && !dialog.contains(e.target))) {
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

  handleHistoryClick(canvasPos, state) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return true;
    
    const finalPositions = state.positionHistory.filter(p => p.isFinalPosition);
    const clickRadius = 12;
    
    for (let i = 0; i < finalPositions.length; i++) {
      const pos = finalPositions[i];
      const mapped = coords.mapToCanvas(pos.x, pos.y);
      
      const distance = Math.sqrt(Math.pow(canvasPos.cx - mapped.cx, 2) + Math.pow(canvasPos.cy - mapped.cy, 2));
      if (distance <= clickRadius) {
        EnderTrack.State.goToHistoryPosition(i);
        return true;
      }
    }
    
    return true; // In history mode, don't allow click-and-go on empty areas
  }

  handleNormalClick(mapPos, screenX, screenY) {
    const state = EnderTrack.State.get();
    
    // Block click if both X and Y are locked
    if (state.lockX && state.lockY) return;
    
    if (!isPositionWithinSafetyLimits(mapPos.x, mapPos.y, state.pos.z)) {
      EnderTrack.UI?.showNotification?.('Position en dehors des limites de sécurité', 'error');
      return;
    }
    
    const targetPosition = this.calculateTargetPosition(mapPos, state);
    this.updateInputs(targetPosition, state);
    this.forceCanvasRender();
    
    if (!state.historyMode) {
      this.showClickAndGoDialog(targetPosition, screenX, screenY);
    }
  }

  calculateTargetPosition(mapPos, state) {
    const inputX = document.getElementById('inputX');
    const inputY = document.getElementById('inputY');
    const inputZ = document.getElementById('inputZ');
    
    return {
      x: state.lockX ? parseFloat(inputX?.value || 0) : mapPos.x,
      y: state.lockY ? parseFloat(inputY?.value || 0) : mapPos.y,
      z: state.lockZ ? parseFloat(inputZ?.value || 0) : state.pos.z
    };
  }

  updateInputs(targetPosition, state) {
    const inputX = document.getElementById('inputX');
    const inputY = document.getElementById('inputY');
    const inputZ = document.getElementById('inputZ');
    
    if (inputX && !state.lockX) {
      inputX.value = targetPosition.x.toFixed(2);
      inputX.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (inputY && !state.lockY) {
      inputY.value = targetPosition.y.toFixed(2);
      inputY.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (inputZ && !state.lockZ) {
      inputZ.value = (targetPosition.z ?? state.pos?.z ?? 0).toFixed(2);
      inputZ.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    if (window.updateGetButtonStates) {
      window.updateGetButtonStates();
    }
  }

  forceCanvasRender() {
    if (EnderTrack.Canvas) {
      EnderTrack.Canvas.requestRender();
    }
  }

  showClickAndGoDialog(mapPos, screenX, screenY) {
    const existingDialog = document.querySelector('.click-and-go-dialog');
    if (existingDialog) existingDialog.remove();
    
    const dialog = document.createElement('div');
    dialog.className = 'click-and-go-dialog';
    dialog.style.cssText = `position: fixed; left: ${screenX + 10}px; top: ${screenY - 60}px; z-index: 10000;`;
    
    this.addDialogStyles();
    
    dialog.innerHTML = `
      <div class="coords">
        <span>X</span><b>${mapPos.x.toFixed(2)}</b>
        <span>Y</span><b>${mapPos.y.toFixed(2)}</b>
      </div>
      <div class="btns">
        <button class="go">Go</button>
      </div>
    `;
    
    this.positionDialog(dialog, screenX, screenY);
    this.setupDialogHandlers(dialog, mapPos);
  }

  addDialogStyles() {
    if (document.querySelector('#click-and-go-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'click-and-go-styles';
    style.textContent = `
      .click-and-go-dialog {
        background: var(--container-bg);
        border: 1px solid #666;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        padding: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        min-width: 180px;
      }
      .click-and-go-dialog .coords {
        display: grid;
        grid-template-columns: 20px 1fr;
        gap: 4px 8px;
        margin-bottom: 10px;
        font-size: 12px;
        color: var(--text-general);
      }
      .click-and-go-dialog .coords b {
        font-family: monospace;
        color: var(--coordinates-color);
        font-weight: 500;
      }
      .click-and-go-dialog .btns {
        display: flex;
        gap: 6px;
      }
      .click-and-go-dialog button {
        flex: 1;
        padding: 6px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      .click-and-go-dialog .go {
        background: var(--active-element);
        color: var(--text-selected);
      }
      .click-and-go-dialog .go:hover {
        background: var(--coordinates-color);
        color: #000;
      }
      .click-and-go-dialog .cancel {
        background: #444;
        color: var(--text-general);
      }
      .click-and-go-dialog .cancel:hover {
        background: #555;
      }
    `;
    document.head.appendChild(style);
  }

  positionDialog(dialog, screenX, screenY) {
    document.body.appendChild(dialog);
    const rect = dialog.getBoundingClientRect();
    
    let adjustedX = screenX + 10;
    let adjustedY = screenY - 60;
    
    if (rect.right > window.innerWidth) adjustedX = screenX - rect.width - 10;
    if (rect.top < 0) adjustedY = screenY + 10;
    if (rect.bottom > window.innerHeight) adjustedY = window.innerHeight - rect.height - 10;
    
    dialog.style.left = adjustedX + 'px';
    dialog.style.top = adjustedY + 'px';
  }

  setupDialogHandlers(dialog, mapPos) {
    const goBtn = dialog.querySelector('.go');
    
    goBtn.addEventListener('click', () => {
      this.handleClickToMove(mapPos);
      dialog.remove();
    });
    
    const closeDialog = (e) => {
      if ((e.type === 'keydown' && e.key === 'Escape') || 
          (e.type === 'click' && !dialog.contains(e.target))) {
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

  handleClickToMove(mapPos) {
    if (!EnderTrack.Movement) {
      console.warn('Movement system not available');
      return;
    }
    
    const state = EnderTrack.State.get();
    EnderTrack.Movement.moveAbsolute(mapPos.x, mapPos.y, state.pos.z);
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ClickHandler = ClickHandler;