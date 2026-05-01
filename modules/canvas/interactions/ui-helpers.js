// modules/canvas/interactions/ui-helpers.js - Helpers pour l'interface utilisateur

class UIHelpers {
  constructor(interactions) {
    this.interactions = interactions;
  }

  updateMouseCoordinates(canvasPos, event = null) {
    const state = EnderTrack.State.get();
    const mouseX = document.getElementById('mouseX');
    const mouseY = document.getElementById('mouseY');
    const panXElement = document.getElementById('panX');
    const panYElement = document.getElementById('panY');
    
    // Use coordinate system for proper transformation
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    const mapPos = coords.canvasToMap(canvasPos.cx, canvasPos.cy);
    
    // Update pan offset display
    if (panXElement) {
      panXElement.textContent = (state.panX || 0).toFixed(0);
    }
    if (panYElement) {
      panYElement.textContent = (state.panY || 0).toFixed(0);
    }
    
    // Check if mouse is within coordinate bounds
    const bounds = coords.getCoordinateBounds();
    const isOnPlateau = mapPos.x >= bounds.minX && mapPos.x <= bounds.maxX &&
                       mapPos.y >= bounds.minY && mapPos.y <= bounds.maxY;
    
    // Update state with mouse world position
    EnderTrack.State.update({
      mouseWorldPos: { x: mapPos.x, y: mapPos.y }
    });
    
    this.updateMouseDisplay(mouseX, mouseY, mapPos.x, mapPos.y, isOnPlateau);
    this.updateCursor(isOnPlateau, event);
  }

  updatePositionDisplays(state) {
    // Update potential position (target from absolute mode)
    const potentialX = document.getElementById('potentialX');
    const potentialY = document.getElementById('potentialY');
    const potentialZ = document.getElementById('potentialZ');
    if (potentialX) potentialX.textContent = state.targetPosition?.x !== undefined ? state.targetPosition.x.toFixed(1) : '--';
    if (potentialY) potentialY.textContent = state.targetPosition?.y !== undefined ? state.targetPosition.y.toFixed(1) : '--';
    if (potentialZ) potentialZ.textContent = state.targetPosition?.z !== undefined ? state.targetPosition.z.toFixed(1) : '--';
  }

  updateMouseDisplay(mouseX, mouseY, mapX, mapY, isOnPlateau) {
    if (isOnPlateau) {
      if (mouseX) mouseX.textContent = mapX.toFixed(1);
      if (mouseY) mouseY.textContent = mapY.toFixed(1);
    } else {
      if (mouseX) mouseX.textContent = '----';
      if (mouseY) mouseY.textContent = '----';
    }
  }

  updateCursor(isOnPlateau, event) {
    const canvas = this.interactions.canvas;
    const state = EnderTrack.State.get();
    const activeTab = state.activeTab;
    
    // Blocked cursor during scenario execution
    if (window.EnderTrack?.Scenario?.isExecuting) {
      canvas.style.cursor = 'not-allowed';
      canvas.classList.remove('crosshair-cursor');
      return;
    }
    
    // Settings with overlays active: let overlay control cursor (drag, resize)
    if (activeTab === 'settings' && window.EnderTrack?.Overlays?.isActive) {
      return;
    }
    
    // For passive tabs (others, settings without overlays), show crosshair like navigation
    if (activeTab === 'settings' || activeTab === 'others') {
      if (isOnPlateau) {
        canvas.style.cursor = '';
        canvas.classList.add('crosshair-cursor');
      } else {
        canvas.style.cursor = 'default';
        canvas.classList.remove('crosshair-cursor');
      }
      return;
    }
    
    if (window.EnderTrack?.Overlays?.isActive) return;
    
    if (this.interactions.compassHovered) {
      canvas.style.cursor = 'pointer';
      canvas.classList.remove('crosshair-cursor');
      return;
    }
    
    if (!this.interactions.isDragging && event?.shiftKey) {
      canvas.style.cursor = 'grab';
      canvas.classList.remove('crosshair-cursor');
      return;
    }
    
    if (state.hoveredPosition) {
      canvas.style.cursor = 'pointer';
      canvas.classList.remove('crosshair-cursor');
      return;
    }
    
    if (isOnPlateau) {
      if (window.EnderTrack?.Lists?.isActive && window.EnderTrack.Lists.currentMode === 'click') {
        canvas.style.cursor = 'copy';
        canvas.classList.remove('crosshair-cursor');
      } else {
        canvas.style.cursor = '';
        canvas.classList.add('crosshair-cursor');
      }
    } else {
      canvas.style.cursor = 'default';
      canvas.classList.remove('crosshair-cursor');
    }
    
    this.checkHistoryHover(isOnPlateau);
  }

  checkHistoryHover(isOnPlateau) {
    const state = EnderTrack.State.get();
    if (!state.historyMode || !state.positionHistory) return;
    
    const finalPositions = state.positionHistory.filter(p => p.isFinalPosition);
    const clickRadius = 8;
    let overHistoryPoint = false;
    
    // This would need the current canvas position - simplified for now
    // In the full implementation, this would check if mouse is over any history point
    
    if (!this.interactions.compassHovered && !event?.shiftKey) {
      this.interactions.canvas.style.cursor = overHistoryPoint ? 'pointer' : (isOnPlateau ? 'crosshair' : 'default');
    }
  }

  clearMouseCoordinates() {
    const mouseX = document.getElementById('mouseX');
    const mouseY = document.getElementById('mouseY');
    if (mouseX) mouseX.textContent = '----';
    if (mouseY) mouseY.textContent = '----';
    
    // Clear mouse world position from state
    EnderTrack.State.update({
      mouseWorldPos: { x: null, y: null }
    });
  }

  checkCompassHover(canvasPos) {
    let wasHovered = this.interactions.compassHovered || false;
    
    if (EnderTrack.Canvas.compassBounds) {
      const bounds = EnderTrack.Canvas.compassBounds;
      this.interactions.compassHovered = canvasPos.cx >= bounds.x && canvasPos.cx <= bounds.x + bounds.width &&
                       canvasPos.cy >= bounds.y && canvasPos.cy <= bounds.y + bounds.height;
    } else {
      this.interactions.compassHovered = false;
    }
    
    // Update canvas hover state and request re-render if changed
    if (EnderTrack.Canvas) {
      EnderTrack.Canvas.compassHovered = this.interactions.compassHovered;
      if (wasHovered !== this.interactions.compassHovered) {
        EnderTrack.Canvas.requestRender();
      }
    }
  }

  showContextMenu(screenX, screenY, mapPos) {
    const menu = document.createElement('div');
    menu.className = 'canvas-context-menu';
    menu.style.cssText = `
      position: fixed; left: ${screenX}px; top: ${screenY}px;
      background: var(--container-bg, #2c2c2c); border: 1px solid #444; border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5); z-index: 10000; min-width: 150px;
    `;
    
    // No context menu in basic version
    return;
    const menuItems = [];
    
    this.buildContextMenu(menu, menuItems);
    this.setupContextMenuHandlers(menu);
  }

  buildContextMenu(menu, menuItems) {
    menuItems.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.style.cssText = 'height: 1px; background: #444; margin: 4px 0;';
        menu.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.textContent = item.label;
        menuItem.style.cssText = 'padding: 8px 12px; cursor: pointer; font-size: 12px; color: var(--text-selected, #fff);';
        
        menuItem.addEventListener('mouseenter', () => { menuItem.style.background = 'var(--active-element, #4a5568)'; });
        menuItem.addEventListener('mouseleave', () => { menuItem.style.background = ''; });
        menuItem.addEventListener('click', () => {
          item.action();
          menu.remove();
        });
        
        menu.appendChild(menuItem);
      }
    });
    
    document.body.appendChild(menu);
  }

  setupContextMenuHandlers(menu) {
    const removeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
    }, 0);
  }

  handleClickToMove(mapPos) {
    if (!EnderTrack.Movement) {
      console.warn('Movement system not available');
      return;
    }
    
    const state = EnderTrack.State.get();
    EnderTrack.Movement.moveAbsolute(mapPos.x, mapPos.y, state.pos.z);
  }

  addPositionAtLocation(mapPos) {
    EnderTrack.Events.emit('position:add_requested', {
      x: mapPos.x,
      y: mapPos.y,
      z: EnderTrack.State.get().pos.z
    });
  }
}

// Global helper function for updating position displays
window.updatePositionDisplays = function() {
  const state = EnderTrack.State.get();
  
  const potentialX = document.getElementById('potentialX');
  const potentialY = document.getElementById('potentialY');
  const potentialZ = document.getElementById('potentialZ');
  if (potentialX) potentialX.textContent = state.targetPosition?.x !== undefined ? state.targetPosition.x.toFixed(1) : '--';
  if (potentialY) potentialY.textContent = state.targetPosition?.y !== undefined ? state.targetPosition.y.toFixed(1) : '--';
  if (potentialZ) potentialZ.textContent = state.targetPosition?.z !== undefined ? state.targetPosition.z.toFixed(1) : '--';
};

// Listen to state changes to update displays
if (window.EnderTrack?.Events) {
  const updateCurrentPos = () => {
    const state = EnderTrack.State.get();
    const currentX = document.getElementById('currentX');
    const currentY = document.getElementById('currentY');
    const currentZ = document.getElementById('currentZ');
    if (currentX) currentX.textContent = (state.pos?.x || 0).toFixed(1);
    if (currentY) currentY.textContent = (state.pos?.y || 0).toFixed(1);
    if (currentZ) currentZ.textContent = (state.pos?.z || 0).toFixed(1);
  };
  
  EnderTrack.Events.on('state:changed', updateCurrentPos);
  EnderTrack.Events.on('position:changed', updateCurrentPos);
  EnderTrack.Events.on('movement:completed', updateCurrentPos);
  
  EnderTrack.Events.on('state:changed', (newState, oldState) => {
    if (newState.targetPosition !== oldState.targetPosition) {
      window.updatePositionDisplays();
    }
  });
}

// Initialize current position display on load
setTimeout(() => {
  const state = EnderTrack.State.get();
  const currentX = document.getElementById('currentX');
  const currentY = document.getElementById('currentY');
  const currentZ = document.getElementById('currentZ');
  if (currentX) currentX.textContent = (state.pos?.x || 0).toFixed(1);
  if (currentY) currentY.textContent = (state.pos?.y || 0).toFixed(1);
  if (currentZ) currentZ.textContent = (state.pos?.z || 0).toFixed(1);
}, 500);

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.UIHelpers = UIHelpers;