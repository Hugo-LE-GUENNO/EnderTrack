// modules/lists/lists.js - Main Lists Module (orchestrator)
class ListsModule {
  constructor() {
    this.name = 'lists';
    this.isActive = false;
    this.ui = null;
    this.currentMode = 'manual';
    this.previewPositions = [];
    this.canvasClickHandler = null;
    this.offsetDetectionHandler = null;
    this.positionUpdateHandler = null;
    this.selectedCustomColor = null;
    
    // Initialize sub-modules
    this.manager = new window.EnderTrack.AdvancedListManager();
    this.executor = new window.EnderTrack.ListExecutor();
  }

  async init() {

    this.createUI();
    this.manager.load();
    this.updateListSelector();
    
    // Select first list by default
    const firstListId = this.manager.lists.keys().next().value;
    if (firstListId) {
      this.selectList(firstListId);
      const selector = this.ui.querySelector('#list-selector');
      if (selector) selector.value = firstListId;
    }
    

    return true;
  }

  async activate() {
    this.isActive = true;
    this.setupCanvasClick();
    this.setupPositionListener();
    setTimeout(() => {
      this.showUI();
      // Update lists overlay in Navigation tab
      if (window.ListsOverlayManager) {
        window.ListsOverlayManager.updateListsDisplay();
      }
      // Force canvas re-render to show overlays
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    }, 100);
    return true;
  }

  deactivate() {
    this.isActive = false;
    this.removeCanvasClick();
    this.stopOffsetDetection();
    this.removePositionListener();
    this.hideUI();
    
    // Always force re-render when deactivating to update overlays
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }

  // Canvas interaction
  setupCanvasClick() {
    const canvas = document.getElementById('mapCanvas');
    if (canvas) {
      this.canvasClickHandler = (event) => {
        if (event.type !== 'click') return;
        
        if (this.isActive && this.currentMode === 'manual' && this.manager.getCurrentList()) {
          if (event.target !== canvas) return;
          
          event.stopPropagation();
          event.preventDefault();
          
          const rect = canvas.getBoundingClientRect();
          const canvasX = event.clientX - rect.left;
          const canvasY = event.clientY - rect.top;
          
          // Use new coordinate system
          const coords = window.EnderTrack?.Coordinates;
          if (!coords) return;
          
          const worldPos = coords.canvasToMap(canvasX, canvasY);
          const bounds = coords.getCoordinateBounds();
          
          // Check if click is within plateau bounds
          const isOnPlateau = worldPos.x >= bounds.minX && worldPos.x <= bounds.maxX &&
                             worldPos.y >= bounds.minY && worldPos.y <= bounds.maxY;
          
          if (isOnPlateau) {
            // Check if clicking on existing point
            const currentList = this.manager.getCurrentList();
            const clickRadius = 15;
            let clickedPointIndex = -1;
            
            for (let i = 0; i < currentList.positions.length; i++) {
              const point = currentList.positions[i];
              const posCanvas = coords.mapToCanvas(point.x, point.y);
              const distance = Math.sqrt(
                Math.pow(canvasX - posCanvas.cx, 2) + 
                Math.pow(canvasY - posCanvas.cy, 2)
              );
              
              if (distance <= clickRadius) {
                clickedPointIndex = i;
                break;
              }
            }
            
            if (clickedPointIndex >= 0) {
              // Open settings modal at this point
              this.showListSettings();
              // Scroll to the point in the table
              setTimeout(() => {
                const rows = document.querySelectorAll('.positions-table table tbody tr');
                if (rows[clickedPointIndex]) {
                  rows[clickedPointIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                  rows[clickedPointIndex].style.background = 'rgba(255, 193, 7, 0.2)';
                  setTimeout(() => {
                    rows[clickedPointIndex].style.background = '';
                  }, 1000);
                }
              }, 100);
            } else {
              // Add new point
              const zValue = parseFloat(this.ui.querySelector('#canvas-z')?.value) || 0;
              this.addPosition(worldPos.x, worldPos.y, zValue, `Clic ${currentList.positions.length + 1}`);
              if (window.EnderTrack?.Canvas?.requestRender) {
                window.EnderTrack.Canvas.requestRender();
              }
            }
          }
        }
      };
      canvas.addEventListener('click', this.canvasClickHandler, false);
      
      // Add mousemove handler for cursor change
      this.canvasMouseMoveHandler = (event) => {
        if (!this.isActive || this.currentMode !== 'manual') return;
        
        const rect = canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        
        const coords = window.EnderTrack?.Coordinates;
        if (!coords) return;
        
        const worldPos = coords.canvasToMap(canvasX, canvasY);
        const bounds = coords.getCoordinateBounds();
        
        const isOnPlateau = worldPos.x >= bounds.minX && worldPos.x <= bounds.maxX &&
                           worldPos.y >= bounds.minY && worldPos.y <= bounds.maxY;
        
        if (isOnPlateau) {
          const currentList = this.manager.getCurrentList();
          const hoverRadius = 15;
          let isOverPoint = false;
          
          for (let i = 0; i < currentList.positions.length; i++) {
            const point = currentList.positions[i];
            const posCanvas = coords.mapToCanvas(point.x, point.y);
            const distance = Math.sqrt(
              Math.pow(canvasX - posCanvas.cx, 2) + 
              Math.pow(canvasY - posCanvas.cy, 2)
            );
            
            if (distance <= hoverRadius) {
              isOverPoint = true;
              break;
            }
          }
          
          // Change cursor: pointer on point, crosshair cyan with + on empty area
          if (isOverPoint) {
            canvas.style.cursor = 'pointer';
            canvas.classList.remove('crosshair-cursor-add');
          } else {
            canvas.style.cursor = '';
            canvas.classList.add('crosshair-cursor-add');
          }
        } else {
          canvas.style.cursor = 'default';
          canvas.classList.remove('crosshair-cursor-add');
        }
      };
      canvas.addEventListener('mousemove', this.canvasMouseMoveHandler, false);
    }
  }

  removeCanvasClick() {
    const canvas = document.getElementById('mapCanvas');
    if (canvas && this.canvasClickHandler) {
      canvas.removeEventListener('click', this.canvasClickHandler, false);
      this.canvasClickHandler = null;
    }
    if (canvas && this.canvasMouseMoveHandler) {
      canvas.removeEventListener('mousemove', this.canvasMouseMoveHandler, false);
      this.canvasMouseMoveHandler = null;
    }
    if (canvas && this.offsetDetectionHandler) {
      canvas.removeEventListener('click', this.offsetDetectionHandler, false);
      this.offsetDetectionHandler = null;
    }
    // Reset cursor and classes
    if (canvas) {
      canvas.style.cursor = '';
      canvas.classList.remove('crosshair-cursor-add');
    }
  }

  startOffsetDetection() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas || this.offsetDetectionHandler) return;
    
    this.offsetDetectionHandler = (event) => {
      if (event.type !== 'click') return;
      
      if (this.currentMode !== 'auto' || !this.isActive) return;
      
      if (event.target !== canvas) return;
      
      event.stopPropagation();
      event.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;
      
      // Use new coordinate system
      const coords = window.EnderTrack?.Coordinates;
      if (!coords) return;
      
      const worldPos = coords.canvasToMap(canvasX, canvasY);
      
      const offsetXInput = this.ui.querySelector('#pattern-offsetx');
      const offsetYInput = this.ui.querySelector('#pattern-offsety');
      
      if (offsetXInput && offsetYInput) {
        offsetXInput.value = worldPos.x.toFixed(1);
        offsetYInput.value = worldPos.y.toFixed(1);
        this.updatePreview();
      }
    };
    
    canvas.addEventListener('click', this.offsetDetectionHandler, false);
  }
  
  stopOffsetDetection() {
    const canvas = document.getElementById('mapCanvas');
    if (canvas && this.offsetDetectionHandler) {
      canvas.removeEventListener('click', this.offsetDetectionHandler, false);
      this.offsetDetectionHandler = null;
    }
  }

  setupPositionListener() {
    this.positionUpdateHandler = () => {
      if (this.isActive && this.ui) {
        const state = window.EnderTrack.State?.get?.() || {};
        const currentZ = (state.pos || { z: 0 }).z;
        
        // Mode manuel - input canvas-z
        if (this.ui.querySelector('#use-current-z')?.checked) {
          const canvasZInput = this.ui.querySelector('#canvas-z');
          if (canvasZInput) {
            canvasZInput.value = currentZ.toFixed(1);
          }
        }
        
        // Mode auto - input auto-z
        if (this.ui.querySelector('#use-current-z-auto')?.checked) {
          const autoZInput = this.ui.querySelector('#auto-z');
          if (autoZInput) {
            autoZInput.value = currentZ.toFixed(1);
          }
        }
      }
    };
    
    if (window.EnderTrack?.State?.addListener) {
      window.EnderTrack.State.addListener('position', this.positionUpdateHandler);
    }
  }

  removePositionListener() {
    if (this.positionUpdateHandler && window.EnderTrack?.State?.removeListener) {
      window.EnderTrack.State.removeListener('position', this.positionUpdateHandler);
      this.positionUpdateHandler = null;
    }
  }

  // Public API for canvas rendering
  shouldShowOverlays() {
    return this.isActive || this.manager.hasLockedPreview();
  }

  // Check if Lists should block other overlays
  shouldBlockOtherOverlays() {
    return this.isActive;
  }

  getAllListsPositions() {
    return this.manager.getAllListsPositions();
  }

  getPreviewPositions() {
    return this.previewPositions.map(pos => ({ 
      ...pos, 
      color: pos.type === 'pattern' ? 'rgba(255, 193, 7, 0.6)' : 'rgba(255, 255, 255, 0.7)',
      isPreview: true
    }));
  }

  getPreviewTracks() {
    if (this.previewPositions.length < 2) return [];
    
    const segments = [];
    for (let i = 0; i < this.previewPositions.length - 1; i++) {
      segments.push({
        from: this.previewPositions[i],
        to: this.previewPositions[i + 1],
        color: 'rgba(255, 193, 7, 0.8)',
        isPreview: true
      });
    }
    
    return [{
      listId: 'preview',
      segments: segments,
      color: 'rgba(255, 193, 7, 0.8)',
      name: 'Aperçu',
      isPreview: true
    }];
  }

  getListTracks() {
    const tracks = [];
    const isListsActive = this.isActive;
    const currentList = this.manager.getCurrentList();
    
    this.manager.getAllLists().forEach(list => {
      if (!list.showTrack || list.positions.length < 2) return;
      
      // Check visibility: current list in Lists tab OR visible in Navigation tab
      const isCurrentList = currentList?.id === list.id;
      const showInNavigation = list.showOnNavigation !== false;
      const shouldShow = (isListsActive && isCurrentList) || (!isListsActive && showInNavigation);
      
      if (!shouldShow) return;
      
      const color = list.color || this.manager.getListColor(list.id);
      const trackSegments = [];
      
      for (let i = 0; i < list.positions.length - 1; i++) {
        trackSegments.push({
          from: list.positions[i],
          to: list.positions[i + 1],
          color: color,
          listId: list.id
        });
      }
      
      tracks.push({
        listId: list.id,
        segments: trackSegments,
        color: color,
        name: list.name
      });
    });
    return tracks;
  }

  deleteCurrentList() {
    const currentList = this.manager.getCurrentList();
    // Il y a toujours au moins une liste
    
    // Empêcher la suppression s'il n'y a qu'une seule liste
    if (this.manager.lists.size <= 1) {
      alert('Impossible de supprimer la dernière liste. Il doit toujours y avoir au moins une liste active.');
      return;
    }
    
    if (confirm(`Supprimer la liste "${currentList.name}" ?\n\nCette action est irréversible.`)) {
      this.manager.deleteList(currentList.id);
      
      // Sélectionner la première liste disponible
      const firstList = this.manager.getAllLists()[0];
      if (firstList) {
        this.manager.setCurrentList(firstList.id);
        const selector = this.ui.querySelector('#list-selector');
        if (selector) selector.value = firstList.id;
      }
      
      this.updateListSelector();
      this.updatePositionsDisplay();
      this.manager.save();
      
      // Update lists overlay in Navigation tab
      if (window.ListsOverlayManager) {
        window.ListsOverlayManager.updateListsDisplay();
      }
      
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    }
  }

  // List operations
  createNewList() {
    const newList = this.manager.createList(`Liste ${this.manager.lists.size + 1}`);
    this.updateListSelector();
    this.selectList(newList.id);
    this.manager.save();
    
    // Update lists overlay in Navigation tab
    if (window.ListsOverlayManager) {
      window.ListsOverlayManager.updateListsDisplay();
    }
    
    // Ouvrir directement les paramètres
    setTimeout(() => this.showListSettings(), 100);
  }

  selectList(listId) {
    this.manager.setCurrentList(listId);
    this.updatePositionsDisplay();
    
    // Update color indicator
    const colorIndicator = this.ui.querySelector('.list-color-indicator');
    const currentList = this.manager.getCurrentList();
    if (currentList && colorIndicator) {
      const color = currentList.color || this.manager.getListColor(currentList.id);
      colorIndicator.style.setProperty('--list-color', color);
    }
    
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }

  // Position operations
  addCurrentPosition() {
    const currentList = this.manager.getCurrentList();
    // Il y a toujours au moins une liste
    const state = window.EnderTrack.State?.get?.() || {};
    const pos = state.pos || { x: 0, y: 0, z: 0 };
    this.addPosition(pos.x, pos.y, pos.z, `Position ${currentList.positions.length + 1}`);
  }

  addManualPosition() {
    const currentList = this.manager.getCurrentList();
    // Il y a toujours au moins une liste
    const x = parseFloat(this.ui.querySelector('#manual-x').value) || 0;
    const y = parseFloat(this.ui.querySelector('#manual-y').value) || 0;
    const z = parseFloat(this.ui.querySelector('#manual-z').value) || 0;
    
    this.addPosition(x, y, z, `Manuel ${currentList.positions.length + 1}`);
    
    this.ui.querySelector('#manual-x').value = '';
    this.ui.querySelector('#manual-y').value = '';
    this.ui.querySelector('#manual-z').value = '';
    
    // Force canvas re-render to update overlays
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }

  addPatternPositions() {
    const currentList = this.manager.getCurrentList();
    // Il y a toujours au moins une liste
    
    try {
      const type = this.ui.querySelector('#pattern-type').value;
      const offsetX = parseFloat(this.ui.querySelector('#pattern-offsetx').value) || 0;
      const offsetY = parseFloat(this.ui.querySelector('#pattern-offsety').value) || 0;
      const zValue = parseFloat(this.ui.querySelector('#auto-z')?.value) || 0;
      
      let positions = [];
      
      if (type === 'grid') {
        const cols = parseInt(this.ui.querySelector('#pattern-cols').value) || 3;
        const rows = parseInt(this.ui.querySelector('#pattern-rows').value) || 3;
        const stepX = parseFloat(this.ui.querySelector('#pattern-stepx').value) || 5;
        const stepY = parseFloat(this.ui.querySelector('#pattern-stepy').value) || 5;
        const sweep = this.ui.querySelector('#pattern-sweep')?.value || 'normal';
        positions = window.EnderTrack.PatternGenerator.generatePattern(cols, rows, stepX, stepY, type, offsetX, offsetY, { sweep });
      } else if (type === 'random') {
        const points = parseInt(this.ui.querySelector('#pattern-points').value) || 10;
        const width = parseFloat(this.ui.querySelector('#pattern-width').value) || 20;
        const height = parseFloat(this.ui.querySelector('#pattern-height').value) || 20;
        const order = this.ui.querySelector('#pattern-order')?.value || 'random';
        positions = window.EnderTrack.PatternGenerator.generatePattern(points, width, height, 0, type, offsetX, offsetY, { order });
      } else if (type === 'spiral') {
        const turns = parseInt(this.ui.querySelector('#pattern-turns').value) || 3;
        const radius = parseFloat(this.ui.querySelector('#pattern-radius').value) || 15;
        const points = parseInt(this.ui.querySelector('#pattern-points').value) || 30;
        const direction = this.ui.querySelector('#pattern-direction')?.value || 'outward';
        positions = window.EnderTrack.PatternGenerator.generatePattern(turns, radius, points, 0, type, offsetX, offsetY, { direction });
      }
      
      positions.forEach((pos, index) => {
        this.addPosition(pos.x, pos.y, zValue, `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`);
      });
      
      this.clearPreview();
    } catch (error) {
      alert(error.message);
    }
  }
  
  toggleGridPreview(show) {
    // Aperçu toujours activé
    this.updatePreview();
  }

  addPosition(x, y, z, name) {
    const position = this.manager.addPosition(x, y, z, name);
    if (position) {
      this.updatePositionsDisplay();
      this.manager.save();
      // Update lists overlay in Navigation tab
      if (window.ListsOverlayManager) {
        window.ListsOverlayManager.updateListsDisplay();
      }
    }
  }

  removePosition(positionId) {
    if (this.manager.removePosition(positionId)) {
      this.updatePositionsDisplay();
      this.manager.save();
      // Update lists overlay in Navigation tab
      if (window.ListsOverlayManager) {
        window.ListsOverlayManager.updateListsDisplay();
      }
    }
  }

  goToPosition(positionId) {
    const position = this.manager.getPosition(positionId);
    if (position) {
      const menu = document.getElementById(`menu-${positionId}`);
      if (menu) menu.classList.remove('show');
      
      this.executor.goToPosition(position);
    }
  }

  updatePatternInputs() {
    const type = this.ui.querySelector('#pattern-type').value;
    const container = this.ui.querySelector('#pattern-inputs');
    
    // Use external template
    container.innerHTML = window.ListsUITemplates.getPatternInputsHTML(type);
    
    // Add event listeners to new inputs
    setTimeout(() => {
      const newInputs = container.querySelectorAll('input, select');
      newInputs.forEach(input => {
        input.addEventListener('input', () => {
          if (this.currentMode === 'auto') this.updatePreview();
        });
        input.addEventListener('change', () => {
          if (this.currentMode === 'auto') this.updatePreview();
        });
      });
    }, 10);
    
    this.updatePreview();
  }

  switchMode(mode) {
    this.ui.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
    this.ui.querySelectorAll('.mode-interface').forEach(iface => iface.classList.remove('active'));
    
    this.ui.querySelector(`#mode-${mode}`).classList.add('active');
    this.ui.querySelector(`#interface-${mode}`).classList.add('active');
    
    this.currentMode = mode;
    
    // Gérer les modes de clic canvas
    if (mode === 'auto') {
      // Initialize pattern inputs first
      setTimeout(() => {
        this.updatePatternInputs();
        this.startOffsetDetection();
        this.updatePreview();
      }, 50);
    } else {
      this.stopOffsetDetection();
      this.updatePreview();
    }
  }

  // Preview management
  updatePreview() {
    this.previewPositions = [];

    if (this.currentMode === 'manual') {
      const xInput = this.ui.querySelector('#manual-x');
      const yInput = this.ui.querySelector('#manual-y');
      const zInput = this.ui.querySelector('#manual-z');
      
      if (!xInput || !yInput || !zInput) return;
      
      const x = parseFloat(xInput.value) || 0;
      const y = parseFloat(yInput.value) || 0;
      const z = parseFloat(zInput.value) || 0;
      
      if (x !== 0 || y !== 0 || z !== 0) {
        this.previewPositions.push({ x, y, z, type: 'single' });
      }
    } else if (this.currentMode === 'auto') {
      // Aperçu toujours activé en mode auto
      const typeInput = this.ui.querySelector('#pattern-type');
      if (!typeInput) return;
      
      try {
        const type = typeInput.value;
        const offsetX = parseFloat(this.ui.querySelector('#pattern-offsetx')?.value) || 0;
        const offsetY = parseFloat(this.ui.querySelector('#pattern-offsety')?.value) || 0;
        
        let positions = [];
        
        if (type === 'grid') {
          const cols = parseInt(this.ui.querySelector('#pattern-cols')?.value) || 3;
          const rows = parseInt(this.ui.querySelector('#pattern-rows')?.value) || 3;
          const stepX = parseFloat(this.ui.querySelector('#pattern-stepx')?.value) || 5;
          const stepY = parseFloat(this.ui.querySelector('#pattern-stepy')?.value) || 5;
          const sweep = this.ui.querySelector('#pattern-sweep')?.value || 'normal';
          positions = window.EnderTrack.PatternGenerator.generatePattern(cols, rows, stepX, stepY, type, offsetX, offsetY, { sweep });
        } else if (type === 'random') {
          const points = parseInt(this.ui.querySelector('#pattern-points')?.value) || 10;
          const width = parseFloat(this.ui.querySelector('#pattern-width')?.value) || 20;
          const height = parseFloat(this.ui.querySelector('#pattern-height')?.value) || 20;
          const order = this.ui.querySelector('#pattern-order')?.value || 'random';
          positions = window.EnderTrack.PatternGenerator.generatePattern(points, width, height, 0, type, offsetX, offsetY, { order });
        } else if (type === 'spiral') {
          const turns = parseInt(this.ui.querySelector('#pattern-turns')?.value) || 3;
          const radius = parseFloat(this.ui.querySelector('#pattern-radius')?.value) || 15;
          const points = parseInt(this.ui.querySelector('#pattern-points')?.value) || 30;
          const direction = this.ui.querySelector('#pattern-direction')?.value || 'outward';
          positions = window.EnderTrack.PatternGenerator.generatePattern(turns, radius, points, 0, type, offsetX, offsetY, { direction });
        }
        
        this.previewPositions = positions.map(pos => ({ ...pos, z: 0, type: 'pattern' }));
      } catch (error) {
        // Si erreur de limites, pas d'aperçu
        this.previewPositions = [];
      }
    }

    this.drawPreview();
  }

  drawPreview() {
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }

  clearPreview() {
    this.previewPositions = [];
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }

  // Import/Export
  exportLists() {
    window.EnderTrack.ListIO.exportLists(this.manager.lists);
  }

  importLists() {
    window.EnderTrack.ListIO.importLists((lists, error) => {
      if (error) {
        alert(error);
        return;
      }
      this.manager.lists = lists;
      this.updateListSelector();
      this.manager.save();
      console.log('📎 Listes importées avec succès');
    });
  }

  resetLists() {
    if (confirm('Supprimer toutes les listes ? Cette action est irréversible.')) {
      this.manager.clear();
      this.updateListSelector();
      this.updatePositionsDisplay();
      console.log('🔄 Listes réinitialisées');
    }
  }

  // Settings and UI management
  toggleLockPreview(isLocked) {
    const currentList = this.manager.getCurrentList();
    if (!currentList) return;
    
    this.manager.toggleLockPreview(currentList.id, isLocked);
    console.log(`[Lists] Preview lock for "${currentList.name}": ${isLocked ? 'ON' : 'OFF'}`);
    
    this.manager.save();
    
    if (!isLocked && !this.isActive && !this.manager.hasLockedPreview()) {
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    }
  }

  showListSettings() {
    const currentList = this.manager.getCurrentList();

    const positionsTable = currentList.positions.length > 0 ? `
      <div class="edit-field">
        <label>Positions (${currentList.positions.length}):</label>
        <div style="margin-bottom: 8px;">
          <label style="font-size: 11px; color: var(--text-general);">Marqueur par défaut pour tous les points:</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <select id="defaultMarkerType" style="flex: 1; padding: 6px; font-size: 11px;">
              <option value="circle">⚫ Point</option>
              <option value="cross">✖️ Croix</option>
              <option value="emoji">😀 Emoji</option>
            </select>
            <button id="defaultMarkerEmojiBtn" onclick="EnderTrack.Lists.selectDefaultEmoji()" style="display: none; font-size: 16px; padding: 4px 8px; border: none; background: var(--container-bg); cursor: pointer; border-radius: 3px;">📍</button>
            <button onclick="EnderTrack.Lists.applyDefaultMarker()" style="padding: 6px 12px; font-size: 11px; background: var(--active-element); color: var(--text-selected); border: none; border-radius: 4px; cursor: pointer;">Appliquer à tous</button>
          </div>
        </div>
        <div class="positions-table">
          ${window.ListsUITemplates.getPositionsTableHTML(currentList.positions)}
        </div>
      </div>
      ${window.ListsUITemplates.getListOptionsHTML(currentList)}
    ` : '';

    const modal = document.createElement('div');
    modal.className = 'edit-modal-overlay';
    modal.innerHTML = `
      <div class="edit-modal">
        <div class="edit-modal-header">
          <h3>⚙️ Paramètres de la liste</h3>
          <button class="close-btn">×</button>
        </div>
        <div class="edit-modal-body">
          <div class="edit-field">
            <div class="name-color-row">
              <input type="text" id="list-name" value="${currentList.name}" placeholder="Nom de la liste">
              <input type="color" id="custom-color" value="${currentList.color || this.manager.getListColor(currentList.id)}">
            </div>
          </div>
          ${positionsTable}
          <div class="table-actions">
            <button class="btn-small" onclick="EnderTrack.Lists.saveListFromSettings()">Sauver</button>
            <button class="btn-small" onclick="EnderTrack.Lists.loadListFromSettings()">Charger</button>
          </div>
          <div class="edit-field">
            <label class="checkbox-label">
              <input type="checkbox" id="show-track-edit" ${currentList.showTrack ? 'checked' : ''} onchange="EnderTrack.Lists.toggleShowTrack(this.checked)">
              Associer track
            </label>
          </div>
        </div>
        <div class="edit-modal-footer">
          <button class="btn-save" style="width: 100%;">Valider</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup default marker type change handler
    const defaultMarkerSelect = modal.querySelector('#defaultMarkerType');
    const defaultEmojiBtn = modal.querySelector('#defaultMarkerEmojiBtn');
    if (defaultMarkerSelect && defaultEmojiBtn) {
      defaultMarkerSelect.addEventListener('change', () => {
        defaultEmojiBtn.style.display = defaultMarkerSelect.value === 'emoji' ? 'inline-block' : 'none';
      });
    }
    
    modal.querySelector('#list-name').focus();
    modal.querySelector('#list-name').select();
    
    const closeModal = () => document.body.removeChild(modal);
    
    const saveChanges = () => {
      const newName = modal.querySelector('#list-name').value.trim();
      const customColor = modal.querySelector('#custom-color').value;
      
      if (newName) currentList.name = newName;
      currentList.color = customColor;
      
      // Sauvegarder les modifications du tableau
      const posEdits = modal.querySelectorAll('.pos-edit');
      posEdits.forEach(input => {
        const posId = input.dataset.posId;
        const field = input.dataset.field;
        let value;
        
        if (field === 'name' || field === 'markerType') {
          value = input.value.trim();
        } else {
          value = parseFloat(input.value) || 0;
        }
        
        const position = currentList.positions.find(p => p.id === posId);
        if (position) {
          position[field] = value;
        }
      });
      
      // Save and update only when validating
      this.manager.save();
      this.updateListSelector();
      this.updatePositionsDisplay();
      
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
      
      closeModal();
    };
    
    modal.querySelector('.close-btn').addEventListener('click', closeModal);
    modal.querySelector('.btn-save').addEventListener('click', saveChanges);
    
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter') saveChanges();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  selectColor(color) {
    document.querySelectorAll('.color-option').forEach(option => {
      option.classList.remove('selected');
    });
    const colorOption = document.querySelector(`[style*="${color}"]`);
    if (colorOption) {
      colorOption.classList.add('selected');
    }
    const customColorPicker = document.getElementById('custom-color');
    if (customColorPicker) {
      customColorPicker.value = color;
    }
  }

  selectCustomColor(color) {
    document.querySelectorAll('.color-option').forEach(option => {
      option.classList.remove('selected');
    });
    this.selectedCustomColor = color;
  }

  movePositionUp(positionId) {
    const currentList = this.manager.getCurrentList();
    if (!currentList) return;
    
    const index = currentList.positions.findIndex(p => p.id === positionId);
    if (index > 0) {
      [currentList.positions[index], currentList.positions[index - 1]] = 
      [currentList.positions[index - 1], currentList.positions[index]];
      
      this.updateModalTable(currentList);
    }
  }

  movePositionDown(positionId) {
    const currentList = this.manager.getCurrentList();
    if (!currentList) return;
    
    const index = currentList.positions.findIndex(p => p.id === positionId);
    if (index >= 0 && index < currentList.positions.length - 1) {
      [currentList.positions[index], currentList.positions[index + 1]] = 
      [currentList.positions[index + 1], currentList.positions[index]];
      
      this.updateModalTable(currentList);
    }
  }

  deletePositionFromModal(positionId) {
    const currentList = this.manager.getCurrentList();
    if (!currentList) return;
    
    const position = currentList.positions.find(p => p.id === positionId);
    if (!position) return;
    
    if (confirm(`Supprimer "${position.name}" ?`)) {
      currentList.positions = currentList.positions.filter(p => p.id !== positionId);
      
      this.manager.save();
      this.updatePositionsDisplay();
      
      const modal = document.querySelector('.edit-modal-overlay');
      if (modal) {
        const tableContainer = modal.querySelector('.positions-table');
        if (tableContainer && currentList.positions.length > 0) {
          tableContainer.innerHTML = window.ListsUITemplates.getPositionsTableHTML(currentList.positions);
        } else if (tableContainer) {
          const field = tableContainer.closest('.edit-field');
          if (field) field.style.display = 'none';
        }
        
        const label = modal.querySelector('.edit-field label');
        if (label) {
          label.textContent = `Positions (${currentList.positions.length}):`;
        }
      }
      
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    }
  }
  
  updateModalTable(currentList) {
    const modal = document.querySelector('.edit-modal-overlay');
    if (modal) {
      const tableContainer = modal.querySelector('.positions-table');
      if (tableContainer) {
        tableContainer.innerHTML = window.ListsUITemplates.getPositionsTableHTML(currentList.positions);
      }
    }
  }

  updatePositionMarker(positionId, markerType) {
    const currentList = this.manager.getCurrentList();
    if (!currentList) return;
    
    const position = currentList.positions.find(p => p.id === positionId);
    if (position) {
      position.markerType = markerType;
      if (markerType !== 'emoji') {
        delete position.markerEmoji;
      }
      this.updateModalTable(currentList);
      
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    }
  }

  selectPositionEmoji(positionId) {
    const currentList = this.manager.getCurrentList();
    if (!currentList) return;
    
    const position = currentList.positions.find(p => p.id === positionId);
    if (!position) return;
    
    this.showEmojiModal((emoji) => {
      position.markerEmoji = emoji;
      this.updateModalTable(currentList);
      
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    });
  }

  selectDefaultEmoji() {
    const btn = document.querySelector('#defaultMarkerEmojiBtn');
    if (!btn) return;
    
    this.showEmojiModal((emoji) => {
      btn.textContent = emoji;
      btn.dataset.emoji = emoji;
    });
  }

  showEmojiModal(callback) {
    const modal = document.createElement('div');
    modal.className = 'emoji-modal-overlay';
    modal.innerHTML = `
      <div class="emoji-modal">
        <div class="emoji-modal-header">
          <h3>😀 Sélectionner un emoji</h3>
          <button class="close-btn">×</button>
        </div>
        <div class="emoji-modal-body">
          <div class="emoji-grid">
            ${['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '👁️‍🗨️', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧'].map(e => `<button class="emoji-btn" data-emoji="${e}">${e}</button>`).join('')}
          </div>
          <div class="emoji-custom">
            <label>Ou collez un emoji personnalisé:</label>
            <input type="text" id="customEmojiInput" placeholder="Collez un emoji ici" maxlength="2">
          </div>
        </div>
        <div class="emoji-modal-footer">
          <button class="btn-cancel">Annuler</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => document.body.removeChild(modal);
    
    modal.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        callback(btn.dataset.emoji);
        closeModal();
      });
    });
    
    const customInput = modal.querySelector('#customEmojiInput');
    customInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && customInput.value.trim()) {
        callback(customInput.value.trim());
        closeModal();
      }
    });
    
    modal.querySelector('.close-btn').addEventListener('click', closeModal);
    modal.querySelector('.btn-cancel').addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    // Add styles
    if (!document.querySelector('#emoji-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'emoji-modal-styles';
      style.textContent = `
        .emoji-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }
        .emoji-modal {
          background: var(--container-bg);
          border-radius: 8px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
        }
        .emoji-modal-header {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .emoji-modal-header h3 {
          margin: 0;
          font-size: 16px;
          color: var(--text-selected);
        }
        .emoji-modal-body {
          padding: 16px;
          overflow-y: auto;
        }
        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
          gap: 4px;
          margin-bottom: 16px;
        }
        .emoji-btn {
          width: 40px;
          height: 40px;
          border: none;
          background: var(--app-bg);
          border-radius: 4px;
          font-size: 24px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .emoji-btn:hover {
          background: var(--active-element);
          transform: scale(1.2);
        }
        .emoji-custom {
          padding: 12px;
          background: var(--app-bg);
          border-radius: 4px;
        }
        .emoji-custom label {
          display: block;
          margin-bottom: 8px;
          font-size: 12px;
          color: var(--text-general);
        }
        .emoji-custom input {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--border);
          background: var(--container-bg);
          color: var(--text-selected);
          border-radius: 4px;
          font-size: 24px;
          text-align: center;
        }
        .emoji-modal-footer {
          padding: 16px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
        }
        .btn-cancel {
          padding: 8px 16px;
          border: none;
          background: var(--container-bg);
          color: var(--text-general);
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-cancel:hover {
          background: var(--active-element);
          color: var(--text-selected);
        }
      `;
      document.head.appendChild(style);
    }
  }

  applyDefaultMarker() {
    const currentList = this.manager.getCurrentList();
    if (!currentList) return;
    
    const markerType = document.querySelector('#defaultMarkerType')?.value;
    const emojiBtn = document.querySelector('#defaultMarkerEmojiBtn');
    const emoji = emojiBtn?.dataset.emoji || '📍';
    
    if (!markerType) return;
    
    currentList.positions.forEach(pos => {
      pos.markerType = markerType;
      if (markerType === 'emoji') {
        pos.markerEmoji = emoji;
      } else {
        delete pos.markerEmoji;
      }
    });
    
    this.updateModalTable(currentList);
    
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }

  saveListFromSettings() {
    const currentList = this.manager.getCurrentList();
    if (!currentList) {
      alert('Aucune liste à sauvegarder');
      return;
    }
    
    // Créer un objet avec juste la liste actuelle
    const listToSave = new Map();
    listToSave.set(currentList.id, currentList);
    
    // Utiliser la fonction d'export existante
    window.EnderTrack.ListIO.exportLists(listToSave);
  }

  loadListFromSettings() {
    window.EnderTrack.ListIO.loadListFromFile((importedLists, error) => {
      if (error) {
        alert(error);
        return;
      }
      
      importedLists.forEach((list, id) => {
        this.manager.lists.set(id, list);
      });
      
      this.updateListSelector();
      this.manager.save();
      
      const modal = document.querySelector('.edit-modal-overlay');
      if (modal) modal.remove();
      
      console.log('📁 Listes chargées avec succès');
    });
  }

  deleteListFromSettings() {
    const currentList = this.manager.getCurrentList();
    if (confirm(`Supprimer la liste "${currentList.name}" ?\\n\\nCette action est irréversible.`)) {
      this.manager.deleteList(currentList.id);
      
      // Sélectionner la première liste disponible
      const firstList = this.manager.getAllLists()[0];
      if (firstList) {
        this.manager.setCurrentList(firstList.id);
        const selector = this.ui.querySelector('#list-selector');
        if (selector) selector.value = firstList.id;
      }
      
      this.updateListSelector();
      this.updatePositionsDisplay();
      this.manager.save();
      
      const modal = document.querySelector('.edit-modal-overlay');
      if (modal) modal.remove();
      
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    }
  }

  adjustValue(inputId, delta) {
    const input = this.ui.querySelector(`#${inputId}`);
    if (input) {
      const currentValue = parseFloat(input.value) || 0;
      const min = parseFloat(input.min) || -Infinity;
      const max = parseFloat(input.max) || Infinity;
      const newValue = Math.max(min, Math.min(max, currentValue + delta));
      input.value = newValue;
      
      if (this.currentMode === 'auto') {
        this.updatePreview();
      }
    }
  }

  toggleShowTrack(show) {
    const currentList = this.manager.getCurrentList();
    if (currentList) {
      currentList.showTrack = show;
      this.manager.save();
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    }
  }

  toggleListTrack(show) {
    const currentList = this.manager.getCurrentList();
    if (currentList) {
      currentList.showTrack = show;
      this.manager.save();
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
    }
  }

  // Position editing
  editPosition(positionId) {
    const position = this.manager.getPosition(positionId);
    if (!position) return;
    
    const menu = document.getElementById(`menu-${positionId}`);
    if (menu) menu.classList.remove('show');
    
    this.showEditModal(position);
  }

  showEditModal(position) {
    const modal = document.createElement('div');
    modal.className = 'edit-modal-overlay';
    modal.innerHTML = `
      <div class="edit-modal">
        <div class="edit-modal-header">
          <h3>✏️ Éditer Position</h3>
          <button class="close-btn">×</button>
        </div>
        <div class="edit-modal-body">
          <div class="edit-field">
            <label>Nom:</label>
            <input type="text" id="edit-name" value="${position.name}">
          </div>
          <div class="edit-field">
            <label>X (mm):</label>
            <input type="number" id="edit-x" value="${position.x}" step="0.1">
          </div>
          <div class="edit-field">
            <label>Y (mm):</label>
            <input type="number" id="edit-y" value="${position.y}" step="0.1">
          </div>
          <div class="edit-field">
            <label>Z (mm):</label>
            <input type="number" id="edit-z" value="${position.z}" step="0.1">
          </div>
        </div>
        <div class="edit-modal-footer">
          <button class="btn-cancel">Annuler</button>
          <button class="btn-save">💾 Sauvegarder</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#edit-name').focus();
    modal.querySelector('#edit-name').select();
    
    const closeModal = () => document.body.removeChild(modal);
    
    const saveChanges = () => {
      const newName = modal.querySelector('#edit-name').value.trim();
      const newX = parseFloat(modal.querySelector('#edit-x').value) || 0;
      const newY = parseFloat(modal.querySelector('#edit-y').value) || 0;
      const newZ = parseFloat(modal.querySelector('#edit-z').value) || 0;
      
      this.manager.updatePosition(position.id, {
        name: newName || position.name,
        x: newX,
        y: newY,
        z: newZ
      });
      
      this.updatePositionsDisplay();
      this.manager.save();
      closeModal();
    };
    
    modal.querySelector('.close-btn').addEventListener('click', closeModal);
    modal.querySelector('.btn-cancel').addEventListener('click', closeModal);
    modal.querySelector('.btn-save').addEventListener('click', saveChanges);
    
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter') saveChanges();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  confirmRemovePosition(positionId) {
    const position = this.manager.getPosition(positionId);
    if (!position) return;
    
    const menu = document.getElementById(`menu-${positionId}`);
    if (menu) menu.classList.remove('show');
    
    if (confirm(`Supprimer la position "${position.name}" ?\\n\\nCette action est irréversible.`)) {
      this.removePosition(positionId);
    }
  }

  toggleMenu(positionId) {
    document.querySelectorAll('.menu-dropdown').forEach(menu => {
      if (menu.id !== `menu-${positionId}`) {
        menu.classList.remove('show');
      }
    });
    
    const menu = document.getElementById(`menu-${positionId}`);
    if (menu) {
      menu.classList.toggle('show');
      
      // Position menu to avoid being cut off
      if (menu.classList.contains('show')) {
        const button = menu.previousElementSibling;
        const rect = button.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        
        let top = rect.bottom + 2;
        let left = rect.right - menuRect.width;
        
        // Adjust if menu goes off screen
        if (left < 0) left = rect.left;
        if (top + menuRect.height > window.innerHeight) {
          top = rect.top - menuRect.height - 2;
        }
        
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
      }
    }
  }

  // UI Management
  updateListSelector() {
    const selector = this.ui.querySelector('#list-selector');
    const colorIndicator = this.ui.querySelector('.list-color-indicator');
    selector.innerHTML = '';

    this.manager.getAllLists().forEach(list => {
      const option = document.createElement('option');
      option.value = list.id;
      option.textContent = `${list.name} (${list.positions.length})`;
      selector.appendChild(option);
    });
    
    // Update color indicator
    const currentList = this.manager.getCurrentList();
    if (currentList && colorIndicator) {
      const color = currentList.color || this.manager.getListColor(currentList.id);
      colorIndicator.style.setProperty('--list-color', color);
    }
  }

  updatePositionsDisplay() {
    const container = this.ui.querySelector('#positions-list');
    
    const currentList = this.manager.getCurrentList();
    if (!currentList) {
      container.innerHTML = '<div class="text-muted">Aucune liste sélectionnée</div>';
      container.className = 'positions-container-fixed';
      return;
    }

    const count = currentList.positions.length;

    if (count === 0) {
      container.innerHTML = '<div class="text-muted">Aucune position dans cette liste</div>';
      container.className = 'positions-container-fixed';
      return;
    }

    // Tableau avec actions intégrées
    container.className = 'table-view';
    container.innerHTML = `
      <table>
        <thead>
          <tr><th>#</th><th>Nom</th><th>X</th><th>Y</th><th>Z</th><th></th></tr>
        </thead>
        <tbody>
          ${currentList.positions.map((pos, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${pos.name}</td>
              <td class="coordinates">${pos.x.toFixed(1)}</td>
              <td class="coordinates">${pos.y.toFixed(1)}</td>
              <td class="coordinates">${pos.z.toFixed(1)}</td>
              <td>
                <button class="btn-goto" onclick="EnderTrack.Lists.goToPosition('${pos.id}')" title="Aller à cette position">🎯</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    // Scroll to bottom to show new addition
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);
  }

  createUI() {
    this.ui = document.createElement('div');
    this.ui.id = 'lists-panel';
    this.ui.className = 'module-panel';
    this.ui.innerHTML = `
      <div class="config-actions">
        <button id="new-list-btn">Ajouter</button>
        <button id="load-btn">Charger</button>
        <button id="reset-btn">Réinitialiser</button>
        <button id="save-btn">Sauver</button>
      </div>
      
      <div class="lists-container">
        <div class="list-selector-group">
          <div class="list-selector-row">
            <div class="list-color-indicator"></div>
            <select id="list-selector" class="form-control">
            </select>
            <button id="list-settings-btn" class="btn-icon" title="Paramètres de la liste">⚙️</button>
            <button id="delete-list-btn" class="btn-icon" title="Supprimer la liste">🗑️</button>
          </div>
        </div>
        <div class="positions-section">
          <div id="positions-list" class="positions-container-fixed">
            <div class="text-muted">Aucune position dans cette liste</div>
          </div>
        </div>
        
        <div class="add-modes" style="margin-top: 16px;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-muted);">Ajouter position</h4>
          <div class="mode-toggle">
            <button id="mode-manual" class="toggle-btn active">Manuel</button>
            <button id="mode-auto" class="toggle-btn">Motif</button>
          </div>
          
          <div id="interface-manual" class="mode-interface active">
            <div class="manual-methods">
              <button id="add-current-btn" class="btn-method">Position actuelle</button>
              <div class="method-box">
                <div class="xyz-inputs-compact">
                  <input type="number" id="manual-x" step="0.1" placeholder="X">
                  <input type="number" id="manual-y" step="0.1" placeholder="Y">
                  <input type="number" id="manual-z" step="0.1" placeholder="Z">
                  <button id="add-manual-btn" class="btn-compact">+</button>
                </div>
              </div>
              <div class="method-box">
                <div class="canvas-click-info">Cliquez sur le canvas pour ajouter</div>
                <div class="xyz-inputs-compact">
                  <span style="font-size: 11px; color: var(--text-muted);">Z:</span>
                  <input type="number" id="canvas-z" step="0.1" placeholder="Z" value="0">
                  <button id="use-current-z-btn" class="btn-compact" title="Utiliser Z actuel">🚩</button>
                </div>
              </div>
            </div>
          </div>
          
          <div id="interface-auto" class="mode-interface">
            <div class="auto-controls-compact">
              <div class="auto-params">
                <div class="param-row">
                  <span class="param-label">Type:</span>
                  <select id="pattern-type" onchange="EnderTrack.Lists.updatePatternInputs()">
                    <option value="grid">Grille</option>
                    <option value="random">Aléatoire</option>
                    <option value="spiral">Spirale</option>
                  </select>
                </div>
                
                <table class="params-table">
                  <thead>
                    <tr>
                      <th>Offset</th>
                      <th>X</th>
                      <th>Y</th>
                      <th>Z <button id="use-current-z-auto-btn" class="btn-flag" title="Utiliser Z actuel">🚩</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td></td>
                      <td><input type="number" id="pattern-offsetx" value="0" step="0.1" placeholder="X"></td>
                      <td><input type="number" id="pattern-offsety" value="0" step="0.1" placeholder="Y"></td>
                      <td><input type="number" id="auto-z" step="0.1" placeholder="Z" value="0"></td>
                    </tr>
                    <tbody id="pattern-inputs">
                      <!-- Inputs dynamiques selon le type -->
                    </tbody>
                  </tbody>
                </table>
              </div>
              
              <div class="auto-actions">
                <button id="add-pattern-btn" class="btn-generate">Générer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.ui.querySelector('#new-list-btn').addEventListener('click', () => this.createNewList());
    this.ui.querySelector('#list-selector').addEventListener('change', (e) => this.selectList(e.target.value));
    this.ui.querySelector('#list-settings-btn').addEventListener('click', () => this.showListSettings());
    this.ui.querySelector('#delete-list-btn').addEventListener('click', () => this.deleteCurrentList());
    
    this.ui.querySelector('#save-btn').addEventListener('click', () => this.exportLists());
    this.ui.querySelector('#load-btn').addEventListener('click', () => this.importLists());
    this.ui.querySelector('#reset-btn').addEventListener('click', () => this.resetLists());
    
    this.ui.querySelector('#mode-manual').addEventListener('click', () => this.switchMode('manual'));
    this.ui.querySelector('#mode-auto').addEventListener('click', () => this.switchMode('auto'));
    
    this.ui.querySelector('#add-current-btn').addEventListener('click', () => this.addCurrentPosition());
    this.ui.querySelector('#add-manual-btn').addEventListener('click', () => this.addManualPosition());
    this.ui.querySelector('#add-pattern-btn').addEventListener('click', () => this.addPatternPositions());
    
    ['#manual-x', '#manual-y', '#manual-z'].forEach(selector => {
      this.ui.querySelector(selector).addEventListener('input', () => {
        if (this.currentMode === 'manual') this.updatePreview();
      });
    });
    
    this.ui.querySelector('#use-current-z-auto-btn').addEventListener('click', () => {
      const state = window.EnderTrack.State?.get?.() || {};
      const currentZ = (state.pos || { z: 0 }).z;
      this.ui.querySelector('#auto-z').value = currentZ.toFixed(1);
    });
    
    // Initialize pattern inputs after UI is ready
    setTimeout(() => {
      if (this.currentMode === 'auto') {
        this.updatePatternInputs();
      }
    }, 100);
    
    this.ui.querySelector('#use-current-z-btn').addEventListener('click', () => {
      const state = window.EnderTrack.State?.get?.() || {};
      const currentZ = (state.pos || { z: 0 }).z;
      this.ui.querySelector('#canvas-z').value = currentZ.toFixed(1);
    });
    
    ['#pattern-offsetx', '#pattern-offsety', '#pattern-type'].forEach(selector => {
      const element = this.ui.querySelector(selector);
      if (element) {
        element.addEventListener('input', () => {
          if (this.currentMode === 'auto') this.updatePreview();
        });
      }
    });
    

    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.position-menu')) {
        document.querySelectorAll('.menu-dropdown').forEach(menu => {
          menu.classList.remove('show');
        });
      }
    });
  }

  showUI() {
    const listsPanel = document.getElementById('listsTabContent');
    if (listsPanel) {
      listsPanel.innerHTML = '';
      listsPanel.appendChild(this.ui);

    }
  }

  hideUI() {
    if (this.ui && this.ui.parentNode) {
      this.ui.parentNode.removeChild(this.ui);
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Lists = new ListsModule();