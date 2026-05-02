// modules/state/state.js - Central state management
// Pure state management with no UI dependencies

class StateManager {
  constructor() {
    this.state = this.getDefaultState();
    this.listeners = new Map();
    this.history = [];
    this.maxHistorySize = 1000;
  }

  getDefaultState() {
    return {
      // Map configuration - Ender 2 defaults
      mapSizeMm: 220, // Kept for backward compatibility
      plateauDimensions: { x: 220, y: 220, z: 250 },
      coordinateBounds: {
        x: { min: 0, max: 220 },
        y: { min: 0, max: 220 },
        z: { min: 0, max: 250 }
      },
      safetyLimits: {
        x: { min: 0, max: 220 },
        y: { min: 0, max: 220 },
        z: { min: 0, max: 250 }
      },
      axisOrientation: {
        x: 'right',
        y: 'up',
        z: 'up'
      },
      axisConfig: {
        x: { min: 0, max: 220, origin: 0, direction: 'right' },
        y: { min: 0, max: 220, origin: 0, direction: 'up' },
        z: { min: 0, max: 250, origin: 0, direction: 'up' }
      },
      canvasPx: { w: 600, h: 600 },
      
      // Position tracking
      pos: { x: 0, y: 0, z: 0 },
      track: [],
      continuousTrack: [], // Track pour le mode continu (couleur différente)
      positionHistory: [],
      positionHistoryXY: [], // XY-only history (unique XY positions)
      historyIndex: -1, // Current position in history (-1 = live position)
      historyMode: false, // When true, freeze history recording
      historyViewMode: 'XYZ', // 'XY' or 'XYZ' - which history to display
      
      // UI modes
      clickMode: 'navigate',
      inputMode: 'relative', // Default to relative mode
      leftPanelMode: 'navigation',
      
      // Display options
      showNavigationTrack: true,
      showTargetPreview: true,
      showZVisualization: true,
      
      // Axis controls
      lockXY: true,  // XY coupled by default
      lockX: false,
      lockY: false,
      lockZ: !!window.EnderTrack?.Enderscope?.isConnected,   // Z locked only if hardware connected
      lockHomeXY: false,  // Home XY unlocked by default
      lockHomeXYZ: false, // Home XYZ unlocked by default
      
      // Interaction settings
      enableClickGo: false,
      enableMapInteraction: true,
      
      // Visual settings
      colors: {
        mapBackground: '#2d3748',
        gridColor: '#4a5568',
        positionColor: '#0b84ff',
        trackColor: '#10b981'
      },
      
      // Custom colors from color manager
      customColors: {},
      
      // Scale bar settings
      scaleBarMultiplier: 1, // Fraction of canvas width (1/3 by default)
      
      // Control ranges
      sliderMin: 0.01,
      sliderMax: 50,
      
      // Movement presets
      stepPresets: {
        fine: 0.1,
        coarse: 5
      },
      
      // Sensitivity defaults
      sensitivityX: 10,
      sensitivityY: 10,
      sensitivityZ: 1,
      
      // Home positions
      homePositions: {
        xyz: { x: 0, y: 0, z: 0 },
        xy: { x: 0, y: 0 }
      },
      
      // UI button visibility
      showButtons: {
        homeXYZ: false,
        homeXY: true,
        presetButtons: true,
        resetTrack: true
      },
      
      // Movement settings
      xyzSameStep: false,
      isMoving: false,
      moveSpeed: 50,
      feedrate: 3000,
      animationId: null,
      
      // Sequence control
      sequenceQueue: [],
      sequenceIndex: 0,
      
      // Tab management
      activeTab: 'navigation',
      availableTabs: ['navigation', 'settings'],
      pluginTabs: [],
      
      // Map interaction
      panX: 0,
      panY: 0,
      zoom: 1,
      zZoom: 1,
      zPan: 0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0,
      
      // Grid and template interaction
      gridOffsetX: 0,
      gridOffsetY: 0,
      isDraggingGrid: false,
      wasPanning: false,
      selectedTemplateIndex: -1,
      
      // Keyboard controls
      keyboardShortcuts: {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
        zUp: 'PageUp',
        zDown: 'PageDown'
      },
      
      // AI integration
      aiAgent: {
        serverUrl: 'http://localhost:3002',
        isConnected: false,
        isProcessing: false,
        lastCommand: null
      },
      
      // Voice integration
      voice: {
        serviceUrl: 'http://localhost:3001',
        isRecording: false,
        isEnabled: true,
        language: 'fr-FR'
      },
      
      // Theme
      theme: 'dark',
      
      // Snake mode for continuous track
      enableSnakeMode: true,
      maxContinuousTrackPoints: 2000
    };
  }

  async init() {
    // Apply theme
    this.applyTheme(this.state.theme);
    
    // Load plateau dimensions if enabled
    if (localStorage.getItem('endertrack_plateau_dimensions_enabled') === 'true') {
      const saved = localStorage.getItem('endertrack_plateau_dimensions');
      if (saved) {
        try {
          this.state.plateauDimensions = JSON.parse(saved);
          // Mettre à jour les inputs HTML
          document.getElementById('plateauX').value = this.state.plateauDimensions.x;
          document.getElementById('plateauY').value = this.state.plateauDimensions.y;
          document.getElementById('plateauZ').value = this.state.plateauDimensions.z;
        } catch (e) {
          console.warn('Failed to load plateau dimensions:', e);
        }
      }
    } else {
      localStorage.removeItem('endertrack_plateau_dimensions');
    }
    
    // Load coordinate bounds if enabled
    if (localStorage.getItem('endertrack_coordinate_bounds_enabled') === 'true') {
      const saved = localStorage.getItem('endertrack_coordinate_bounds');
      if (saved) {
        try {
          this.state.coordinateBounds = JSON.parse(saved);
          // Mettre à jour les inputs HTML
          document.getElementById('xMin').value = this.state.coordinateBounds.x.min;
          document.getElementById('xMax').value = this.state.coordinateBounds.x.max;
          document.getElementById('yMin').value = this.state.coordinateBounds.y.min;
          document.getElementById('yMax').value = this.state.coordinateBounds.y.max;
          document.getElementById('zMin').value = this.state.coordinateBounds.z.min;
          document.getElementById('zMax').value = this.state.coordinateBounds.z.max;
        } catch (e) {
          console.warn('Failed to load coordinate bounds:', e);
        }
      }
    } else {
      localStorage.removeItem('endertrack_coordinate_bounds');
    }
    
    // Load axis orientation if enabled
    if (localStorage.getItem('endertrack_axis_orientation_enabled') === 'true') {
      const saved = localStorage.getItem('endertrack_axis_orientation');
      if (saved) {
        try {
          this.state.axisOrientation = JSON.parse(saved);
          // Mettre à jour les boutons d'orientation
          document.querySelectorAll('.axis-btn[data-x]').forEach(btn => btn.classList.remove('active'));
          const btn = document.querySelector(`[data-x="${this.state.axisOrientation.x}"][data-y="${this.state.axisOrientation.y}"]`);
          if (btn) btn.classList.add('active');
        } catch (e) {
          console.warn('Failed to load axis orientation:', e);
        }
      }
    } else {
      localStorage.removeItem('endertrack_axis_orientation');
    }
    
    // Load safety limits if enabled
    if (localStorage.getItem('endertrack_safety_limits_enabled') === 'true') {
      const saved = localStorage.getItem('endertrack_safety_limits');
      if (saved) {
        try {
          this.state.safetyLimits = JSON.parse(saved);
        } catch (e) {
          console.warn('Failed to load safety limits:', e);
        }
      }
    } else {
      localStorage.removeItem('endertrack_safety_limits');
    }
    
    // Load feedrate
    const savedFeedrate = localStorage.getItem('endertrack_feedrate');
    if (savedFeedrate) {
      const fr = parseInt(savedFeedrate);
      if (fr >= 100 && fr <= 10000) {
        this.state.feedrate = fr;
        setTimeout(() => {
          const slider = document.getElementById('feedrateSlider');
          const input = document.getElementById('feedrateInput');
          if (slider) slider.value = fr;
          if (input) input.value = fr;
        }, 500);
      }
    }
    
    // Load history from localStorage ONLY if enabled
    if (localStorage.getItem('endertrack_history_enabled') === 'true') {
      const savedHistory = localStorage.getItem('endertrack_history');
      if (savedHistory) {
        try {
          this.state.positionHistory = JSON.parse(savedHistory);
        } catch (e) {
          console.warn('Failed to load history:', e);
        }
      }
    } else {
      localStorage.removeItem('endertrack_history');
    }
    
    if (localStorage.getItem('endertrack_track_enabled') === 'true') {
      const savedTrack = localStorage.getItem('endertrack_track');
      if (savedTrack) {
        try {
          this.state.track = JSON.parse(savedTrack);
        } catch (e) {
          console.warn('Failed to load track:', e);
        }
      }
    } else {
      localStorage.removeItem('endertrack_track');
    }
    
    // Initialize default UI state
    this.initializeDefaultUI();
    
    return true;
  }

  initializeDefaultUI() {
    // 1. UI setup first
    const navTab = document.getElementById('navigationTab');
    const relativeTab = document.getElementById('relativeTab');
    
    if (navTab && !navTab.classList.contains('active')) {
      if (typeof switchTab === 'function') switchTab('navigation');
    }
    
    if (relativeTab && !relativeTab.classList.contains('active')) {
      if (typeof setInputMode === 'function') setInputMode('relative');
    }
  }

  // Called after all modules are initialized - COMPLETE initialization
  applyInitialZoom() {
    // 1. Apply compass zoom first (this changes zoom values)
    if (window.EnderTrack?.CanvasInteractions?.zoomPanHandler?.xyFitToView) {
      window.EnderTrack.CanvasInteractions.zoomPanHandler.xyFitToView();
    }
    
    setTimeout(() => {
      if (window.EnderTrack?.ZVisualization?.interactions?.fitToView) {
        window.EnderTrack.ZVisualization.interactions.fitToView();
      }
      
      // 2. THEN initialize sensitivity based on NEW zoom values
      setTimeout(() => {
        this.initializeSensitivity();
      }, 50);
    }, 50);
  }

  initializeSensitivity() {
    if (EnderTrack.Navigation?.setPreset) {
      EnderTrack.Navigation.setPreset('coarse');
    }
  }

  // Get current state (read-only)
  get() {
    return { ...this.state };
  }

  // Update state and notify listeners
  update(changes) {
    const oldState = { ...this.state };
    
    // Apply changes
    this.state = { ...this.state, ...changes };
    
    // Position changes are now only recorded when explicitly marked as final
    // This prevents intermediate movement points from cluttering the history
    
    // Notify listeners
    this.notifyListeners('state:changed', this.state, oldState);
    
    // Update UI displays
    if (EnderTrack.UI?.History) {
      EnderTrack.UI.History.updateHistoryUI(this.state);
    }
    
    // Force immediate render for real-time feedback
    this.requestCanvasRender();
    if (window.EnderTrack?.ZVisualization?.requestRender) {
      window.EnderTrack.ZVisualization.requestRender();
    } else if (window.EnderTrack?.ZVisualization?.render) {
      window.EnderTrack.ZVisualization.render();
    }
    
    // Delegate persistence to Persistence module
    if (EnderTrack.Persistence?.scheduleAutoSave) {
      EnderTrack.Persistence.scheduleAutoSave();
    }
  }

  // Set specific property
  set(key, value) {
    this.update({ [key]: value });
  }

  // Get specific property
  getProperty(key) {
    return this.state[key];
  }

  // Record position in history
  recordPosition(pos, isFinalPosition = false) {
    const timestamp = Date.now();
    const entry = {
      timestamp,
      x: Number(pos.x.toFixed(3)),
      y: Number(pos.y.toFixed(3)),
      z: Number(pos.z.toFixed(3)),
      isFinalPosition
    };
    
    // Only add to history if it's a final position or first entry
    if (isFinalPosition || this.state.positionHistory.length === 0) {
      this.state.positionHistory.push(entry);
      
      // Limit history size
      if (this.state.positionHistory.length > this.maxHistorySize) {
        this.state.positionHistory.shift();
      }
    }
    
    // Add to track immediately for final positions
    if (isFinalPosition) {
      const lastTrackPoint = this.state.track[this.state.track.length - 1];
      if (!lastTrackPoint || 
          Math.abs(lastTrackPoint.x - pos.x) > 0.01 || 
          Math.abs(lastTrackPoint.y - pos.y) > 0.01 || 
          Math.abs(lastTrackPoint.z - pos.z) > 0.01) {
        
        this.state.track.push({ x: pos.x, y: pos.y, z: pos.z });
        
        // Limit track points
        if (this.state.track.length > 1000) {
          this.state.track.shift();
        }
        
        // Force immediate render for track update
        this.requestCanvasRender();
      }
    }
  }

  // Mark final position when movement completes
  recordFinalPosition(pos) {
    // Only record if not in history mode
    if (!this.state.historyMode) {
      this.recordPosition(pos, true);
      this.recordXYPosition(pos);
      // Reset to live position when new position is recorded
      this.state.historyIndex = -1;
      
      // Sauvegarder l'historique si activé
      if (localStorage.getItem('endertrack_history_enabled') === 'true') {
        localStorage.setItem('endertrack_history', JSON.stringify(this.state.positionHistory));
      }
    }
    
    // Force immediate update of all displays
    if (EnderTrack.UI?.History) {
      EnderTrack.UI.History.updateHistoryUI(this.state);
    }
    this.requestCanvasRender();
    if (window.EnderTrack?.ZVisualization?.render) {
      window.EnderTrack.ZVisualization.render();
    }
  }

  // Toggle history mode
  toggleHistoryMode() {
    const newMode = !this.state.historyMode;
    this.update({ 
      historyMode: newMode,
      historyIndex: newMode ? (this.state.positionHistory.filter(p => p.isFinalPosition).length - 1) : -1
    });
    
    // Afficher/masquer les contrôles d'affichage historique
    const historyControls = document.getElementById('historyDisplayControls');
    if (historyControls) {
      historyControls.style.display = newMode ? 'block' : 'none';
    }
    
  }
  
  // Go to specific history position by index
  async goToHistoryPosition(index) {
    const currentHistory = this.getCurrentHistory();
    if (index < 0 || index >= currentHistory.length) return;
    
    const targetPos = currentHistory[index];
    
    // Use movement system to physically move to position
    if (window.EnderTrack?.Movement) {
      if (this.state.historyViewMode === 'XY') {
        // XY mode: go to XY position but keep current Z
        await EnderTrack.Movement.moveAbsolute(targetPos.x, targetPos.y, this.state.pos.z);
      } else {
        // XYZ mode: go to full XYZ position
        await EnderTrack.Movement.moveAbsolute(targetPos.x, targetPos.y, targetPos.z);
      }
    }
    
    this.update({ historyIndex: index });
  }

  // Record XY-only position (unique XY positions)
  recordXYPosition(pos) {
    const timestamp = Date.now();
    const entry = {
      timestamp,
      x: Number(pos.x.toFixed(3)),
      y: Number(pos.y.toFixed(3)),
      z: Number(pos.z.toFixed(3)),
      isFinalPosition: true
    };
    
    // Check if XY position is significantly different from last XY entry
    const lastXYEntry = this.state.positionHistoryXY[this.state.positionHistoryXY.length - 1];
    if (!lastXYEntry || 
        Math.abs(lastXYEntry.x - pos.x) > 0.01 || 
        Math.abs(lastXYEntry.y - pos.y) > 0.01) {
      
      this.state.positionHistoryXY.push(entry);
      
      // Limit XY history size
      if (this.state.positionHistoryXY.length > this.maxHistorySize) {
        this.state.positionHistoryXY.shift();
      }
    }
  }
  
  // Toggle history view mode
  toggleHistoryViewMode() {
    const newMode = this.state.historyViewMode === 'XYZ' ? 'XY' : 'XYZ';
    this.update({ 
      historyViewMode: newMode,
      historyIndex: -1 // Reset to live when switching modes
    });
  }
  
  // Get current history based on view mode
  getCurrentHistory() {
    return this.state.historyViewMode === 'XY' ? 
           this.state.positionHistoryXY.filter(p => p.isFinalPosition) :
           this.state.positionHistory.filter(p => p.isFinalPosition);
  }

  // Add point to continuous track
  addContinuousTrackPoint(x, y, z) {
    this.state.continuousTrack.push({ x, y, z });
    
    // Limit continuous track points only if snake mode is enabled
    if (this.state.enableSnakeMode !== false) {
      const maxPoints = this.state.maxContinuousTrackPoints || 2000;
      
      // Debug log
      if (this.state.continuousTrack.length > maxPoints) {
      }
      
      while (this.state.continuousTrack.length > maxPoints) {
        this.state.continuousTrack.shift();
      }
      
      // Force canvas re-render when track is trimmed
      this.requestCanvasRender();
    }
  }

  // Clear position history
  clearHistory() {
    this.update({
      positionHistory: [],
      positionHistoryXY: [],
      track: [],
      continuousTrack: [],
      historyIndex: -1,
      historyMode: false
    });
    
    // Supprimer du localStorage
    localStorage.removeItem('endertrack_history');
    localStorage.removeItem('endertrack_track');
    
    // Add current position as first entry
    this.recordFinalPosition(this.state.pos);
    
    // Force Z visualization update
    if (EnderTrack.ZVisualization && EnderTrack.ZVisualization.render) {
      EnderTrack.ZVisualization.render();
    }
    
    this.notifyListeners('history:cleared');
  }

  // Event system
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  notifyListeners(event, ...args) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }





  shouldRenderCanvas(changes, oldState) {
    const renderKeys = [
      'pos', 'zoom', 'panX', 'panY', 'showGrid', 'track', 'mapSizeMm'
    ];
    
    return Object.keys(changes).some(key => renderKeys.includes(key));
  }

  requestCanvasRender() {
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }



  // Track management
  saveTrack() {
    if (this.state.positionHistory.length === 0) {
      console.warn('No track data to save');
      return;
    }
    
    const trackData = {
      version: '1.0',
      timestamp: Date.now(),
      positions: this.state.positionHistory,
      metadata: {
        totalPoints: this.state.positionHistory.length,
        duration: this.state.positionHistory.length > 0 ? 
          this.state.positionHistory[this.state.positionHistory.length - 1].timestamp - 
          this.state.positionHistory[0].timestamp : 0
      }
    };
    
    const blob = new Blob([JSON.stringify(trackData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `endertrack_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async loadTrack() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    return new Promise((resolve) => {
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return resolve(false);
        
        try {
          const text = await file.text();
          const trackData = JSON.parse(text);
          
          if (trackData.positions && Array.isArray(trackData.positions)) {
            this.update({
              positionHistory: trackData.positions,
              track: trackData.positions.map(p => ({ x: p.x, y: p.y, z: p.z }))
            });
            
            this.notifyListeners('track:loaded', trackData);
            resolve(true);
          } else {
            throw new Error('Invalid track file format');
          }
        } catch (error) {
          console.error('Failed to load track:', error);
          resolve(false);
        }
      };
      
      input.click();
    });
  }

  // Debug helpers
  debug() {
    return {
      inputMode: this.state.inputMode,
      sensitivity: {
        x: this.state.sensitivityX,
        y: this.state.sensitivityY,
        z: this.state.sensitivityZ
      },
      locks: {
        x: this.state.lockX,
        y: this.state.lockY,
        z: this.state.lockZ,
        xy: this.state.lockXY
      }
    };
  }


  

  

  


  // Theme management
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update theme selector if it exists
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector && themeSelector.value !== theme) {
      themeSelector.value = theme;
    }
  }

  setTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') {
      console.warn('Invalid theme:', theme);
      return;
    }
    
    this.update({ theme });
    this.applyTheme(theme);
    
  }

  // History navigation
  async goToPreviousPosition() {
    const currentHistory = this.getCurrentHistory();
    if (currentHistory.length === 0) return;
    
    let newIndex = this.state.historyIndex;
    if (newIndex === -1) {
      newIndex = currentHistory.length - 2; // Go to second-to-last
    } else if (newIndex > 0) {
      newIndex--;
    }
    
    if (newIndex >= 0) {
      const targetPos = currentHistory[newIndex];
      
      // Use movement system to physically move to position
      if (window.EnderTrack?.Movement) {
        if (this.state.historyViewMode === 'XY') {
          await EnderTrack.Movement.moveAbsolute(targetPos.x, targetPos.y, this.state.pos.z);
        } else {
          await EnderTrack.Movement.moveAbsolute(targetPos.x, targetPos.y, targetPos.z);
        }
      }
      
      this.update({ historyIndex: newIndex });
    }
  }
  
  async goToNextPosition() {
    const currentHistory = this.getCurrentHistory();
    if (currentHistory.length === 0) return;
    
    let newIndex = this.state.historyIndex;
    if (newIndex < currentHistory.length - 1) {
      newIndex++;
      const targetPos = currentHistory[newIndex];
      
      // Use movement system to physically move to position
      if (window.EnderTrack?.Movement) {
        if (this.state.historyViewMode === 'XY') {
          await EnderTrack.Movement.moveAbsolute(targetPos.x, targetPos.y, this.state.pos.z);
        } else {
          await EnderTrack.Movement.moveAbsolute(targetPos.x, targetPos.y, targetPos.z);
        }
      }
      
      this.update({ historyIndex: newIndex });
    } else {
      // Go back to live position
      this.update({ historyIndex: -1 });
    }
  }
  




  saveState() {
    // Delegate to Persistence module if available
    if (EnderTrack.Persistence?.saveState) {
      EnderTrack.Persistence.saveState(this.state);
    }
  }

  reset() {
    this.state = this.getDefaultState();
    this.applyTheme(this.state.theme);
    this.notifyListeners('state:reset', this.state);
    this.saveState();
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.State = new StateManager();
window.EnderTrack.Events = window.EnderTrack.State; // Alias for event system