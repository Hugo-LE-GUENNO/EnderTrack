// modules/state/persistence.js - Save/load functionality

class PersistenceManager {
  constructor() {
    this.isInitialized = false;
    this.storageKey = 'endertrack_state';
    this.backupKey = 'endertrack_state_backup';
    this.autoSaveInterval = null;
    this.autoSaveDelay = 30000; // 30 seconds
  }

  init() {
    // console.log('💾 Initializing Persistence Manager...');
    
    // Setup auto-save
    this.setupAutoSave();
    
    // Setup event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
    // console.log('✅ Persistence Manager initialized');
    
    return true;
  }

  setupAutoSave() {
    // Auto-save every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      this.autoSave();
    }, this.autoSaveDelay);
    
    // Save on page unload
    window.addEventListener('beforeunload', () => {
      this.saveState();
    });
    
    // Save on visibility change (when tab becomes hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.saveState();
      }
    });
  }

  setupEventListeners() {
    // Listen to significant state changes
    EnderTrack.Events?.on?.('state:changed', (newState, oldState) => {
      if (this.isSignificantChange(newState, oldState)) {
        this.scheduleAutoSave();
      }
    });
    
    // Listen to position changes
    EnderTrack.Events?.on?.('movement:completed', () => {
      this.scheduleAutoSave();
    });
  }

  // Auto-save management
  scheduleAutoSave() {
    // Debounce auto-save to avoid too frequent saves
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      this.autoSave();
    }, 5000); // Save 5 seconds after last change
  }

  autoSave() {
    try {
      this.saveState();
      // console.log('💾 Auto-saved state');
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }

  // Core save/load functionality
  saveState() {
    if (localStorage.getItem('endertrack_state_enabled') !== 'true') return false;
    
    const state = EnderTrack.State?.get?.();
    if (!state) {
      console.warn('No state to save');
      return false;
    }
    
    try {
      // Create backup of current state
      this.createBackup();
      
      // Prepare state for saving
      const stateToSave = this.prepareStateForSaving(state);
      
      // Save to localStorage
      localStorage.setItem(this.storageKey, JSON.stringify(stateToSave));
      
      // Emit save event
      EnderTrack.Events?.emit?.('persistence:saved', {
        timestamp: Date.now(),
        size: JSON.stringify(stateToSave).length
      });
      
      return true;
      
    } catch (error) {
      console.error('Failed to save state:', error);
      
      // Try to restore from backup if save failed
      this.restoreFromBackup();
      
      return false;
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) {
        return false;
      }
      
      const parsedState = JSON.parse(saved);
      
      // Validate loaded state
      const validatedState = this.validateLoadedState(parsedState);
      
      // Merge with current state
      const currentState = EnderTrack.State?.get?.() || {};
      const mergedState = this.mergeStates(currentState, validatedState);
      
      // Update state
      if (EnderTrack.State) {
        // Reset to default first to ensure clean state
        EnderTrack.State.state = EnderTrack.State.getDefaultState();
        
        // Apply loaded state
        EnderTrack.State.update(mergedState);
        
        // Synchronize customColors with window.customColors
        if (mergedState.customColors) {
          window.customColors = { ...mergedState.customColors };
        }
      }
      
      // Emit load event
      EnderTrack.Events?.emit?.('persistence:loaded', {
        timestamp: Date.now(),
        version: parsedState.version || 'unknown'
      });
      
      // console.log('💾 State loaded successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to load state:', error);
      
      // Try to load from backup
      return this.loadFromBackup();
    }
  }

  // State preparation and validation
  prepareStateForSaving(state) {
    const stateToSave = {
      version: '2.0.0',
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      ...state
    };
    
    // Remove runtime-only properties
    delete stateToSave.isMoving;
    delete stateToSave.animationId;
    delete stateToSave.isDragging;
    delete stateToSave.lastMouseX;
    delete stateToSave.lastMouseY;
    
    // Limit history size for storage
    if (stateToSave.positionHistory && stateToSave.positionHistory.length > 500) {
      stateToSave.positionHistory = stateToSave.positionHistory.slice(-500);
    }
    
    if (stateToSave.track && stateToSave.track.length > 200) {
      stateToSave.track = stateToSave.track.slice(-200);
    }
    
    return stateToSave;
  }

  validateLoadedState(loadedState) {
    const defaultState = EnderTrack.State?.getDefaultState?.() || {};
    
    // Ensure all required properties exist
    const validatedState = { ...defaultState };
    
    // Copy valid properties from loaded state
    Object.keys(loadedState).forEach(key => {
      if (key in defaultState) {
        // Validate specific properties
        switch (key) {
          case 'pos':
            if (this.isValidPosition(loadedState[key])) {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'mapSizeMm':
            if (typeof loadedState[key] === 'number' && loadedState[key] >= 50 && loadedState[key] <= 1000) {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'plateauDimensions':
            if (loadedState[key] && 
                typeof loadedState[key].x === 'number' && loadedState[key].x >= 50 && loadedState[key].x <= 1000 &&
                typeof loadedState[key].y === 'number' && loadedState[key].y >= 50 && loadedState[key].y <= 1000 &&
                typeof loadedState[key].z === 'number' && loadedState[key].z >= 10 && loadedState[key].z <= 500) {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'coordinateBounds':
            if (loadedState[key] && 
                loadedState[key].x && typeof loadedState[key].x.min === 'number' && typeof loadedState[key].x.max === 'number' &&
                loadedState[key].y && typeof loadedState[key].y.min === 'number' && typeof loadedState[key].y.max === 'number' &&
                loadedState[key].z && typeof loadedState[key].z.min === 'number' && typeof loadedState[key].z.max === 'number') {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'safetyLimits':
            if (loadedState[key] && 
                loadedState[key].x && typeof loadedState[key].x.min === 'number' && typeof loadedState[key].x.max === 'number' &&
                loadedState[key].y && typeof loadedState[key].y.min === 'number' && typeof loadedState[key].y.max === 'number' &&
                loadedState[key].z && typeof loadedState[key].z.min === 'number' && typeof loadedState[key].z.max === 'number') {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'axisOrientation':
            if (loadedState[key] && 
                (loadedState[key].x === 'left' || loadedState[key].x === 'right') &&
                (loadedState[key].y === 'up' || loadedState[key].y === 'down') &&
                (loadedState[key].z === 'up' || loadedState[key].z === 'down')) {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'zoom':
            if (typeof loadedState[key] === 'number' && loadedState[key] >= 0.1 && loadedState[key] <= 10) {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'sensitivityX':
          case 'sensitivityY':
          case 'sensitivityZ':
            if (typeof loadedState[key] === 'number' && loadedState[key] >= 0.01 && loadedState[key] <= 50) {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'moveSpeed':
            if (typeof loadedState[key] === 'number' && loadedState[key] >= 1 && loadedState[key] <= 1000) {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'inputMode':
            if (loadedState[key] === 'relative' || loadedState[key] === 'absolute') {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'theme':
            if (loadedState[key] === 'dark' || loadedState[key] === 'light') {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'colors':
          case 'customColors':
            if (loadedState[key] && typeof loadedState[key] === 'object') {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'stepPresets':
          case 'homePositions':
          case 'showButtons':
            if (loadedState[key] && typeof loadedState[key] === 'object') {
              validatedState[key] = loadedState[key];
            }
            break;
            
          case 'positionHistory':
            if (Array.isArray(loadedState[key])) {
              validatedState[key] = loadedState[key].filter(entry => 
                this.isValidHistoryEntry(entry)
              );
            }
            break;
            
          case 'track':
            if (Array.isArray(loadedState[key])) {
              validatedState[key] = loadedState[key].filter(point => 
                this.isValidPosition(point)
              );
            }
            break;
            
          default:
            // For other properties, do basic type checking
            if (typeof loadedState[key] === typeof defaultState[key]) {
              validatedState[key] = loadedState[key];
            }
        }
      }
    });
    
    return validatedState;
  }

  isValidPosition(pos) {
    return pos && 
           typeof pos.x === 'number' && 
           typeof pos.y === 'number' && 
           typeof pos.z === 'number' &&
           !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
           isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z);
  }

  isValidHistoryEntry(entry) {
    return entry &&
           this.isValidPosition(entry) &&
           typeof entry.timestamp === 'number' &&
           entry.timestamp > 0;
  }

  mergeStates(currentState, loadedState) {
    // Merge states, giving preference to loaded state for most properties
    const merged = { ...currentState };
    
    Object.keys(loadedState).forEach(key => {
      // Skip certain properties that shouldn't be restored
      const skipProperties = ['version', 'timestamp', 'userAgent'];
      
      if (!skipProperties.includes(key)) {
        merged[key] = loadedState[key];
      }
    });
    
    return merged;
  }

  isSignificantChange(newState, oldState) {
    const significantKeys = [
      'pos', 'mapSizeMm', 'plateauDimensions', 'coordinateBounds', 'safetyLimits', 'axisOrientation',
      'zoom', 'panX', 'panY',
      'sensitivityX', 'sensitivityY', 'sensitivityZ',
      'lockX', 'lockY', 'lockZ', 'lockXY', 'lockHomeXY', 'lockHomeXYZ',
      'inputMode', 'activeTab', 'moveSpeed', 'feedrate', 'theme',
      'showNavigationTrack', 'showTargetPreview', 'showZVisualization',
      'enableClickGo', 'enableMapInteraction', 'enableSnakeMode',
      'colors', 'customColors', 'stepPresets', 'homePositions', 'showButtons'
    ];
    
    return significantKeys.some(key => {
      const newVal = newState[key];
      const oldVal = oldState[key];
      
      if (typeof newVal === 'object' && typeof oldVal === 'object') {
        return JSON.stringify(newVal) !== JSON.stringify(oldVal);
      }
      
      return newVal !== oldVal;
    });
  }

  // Backup management
  createBackup() {
    try {
      const current = localStorage.getItem(this.storageKey);
      if (current) {
        localStorage.setItem(this.backupKey, current);
      }
    } catch (error) {
      console.warn('Failed to create backup:', error);
    }
  }

  restoreFromBackup() {
    try {
      const backup = localStorage.getItem(this.backupKey);
      if (backup) {
        localStorage.setItem(this.storageKey, backup);
        return true;
      }
    } catch (error) {
      console.warn('Failed to restore from backup:', error);
    }
    return false;
  }

  loadFromBackup() {
    try {
      const backup = localStorage.getItem(this.backupKey);
      if (!backup) {
        return false;
      }
      
      const parsedState = JSON.parse(backup);
      const validatedState = this.validateLoadedState(parsedState);
      
      if (EnderTrack.State) {
        EnderTrack.State.state = { ...EnderTrack.State.getDefaultState(), ...validatedState };
      }
      
      return true;
      
    } catch (error) {
      console.error('Failed to load from backup:', error);
      return false;
    }
  }

  // Export/Import functionality
  exportState() {
    const state = EnderTrack.State?.get?.();
    if (!state) {
      throw new Error('No state to export');
    }
    
    const exportData = {
      version: '2.0.0',
      timestamp: Date.now(),
      application: 'EnderTrack',
      state: this.prepareStateForSaving(state),
      metadata: {
        userAgent: navigator.userAgent,
        exportedBy: 'EnderTrack Persistence Manager',
        positionCount: state.positionHistory?.length || 0,
        trackLength: state.track?.length || 0
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `endertrack_state_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    EnderTrack.Events?.emit?.('persistence:exported', exportData.metadata);
  }

  async importState(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.state) {
        throw new Error('Invalid export file format');
      }
      
      // Validate imported state
      const validatedState = this.validateLoadedState(importData.state);
      
      // Create backup before import
      this.createBackup();
      
      // Apply imported state
      if (EnderTrack.State) {
        EnderTrack.State.state = { ...EnderTrack.State.getDefaultState(), ...validatedState };
        EnderTrack.State.saveState();
      }
      
      EnderTrack.Events?.emit?.('persistence:imported', {
        version: importData.version,
        timestamp: importData.timestamp,
        metadata: importData.metadata
      });
      
      return true;
      
    } catch (error) {
      console.error('Import failed:', error);
      
      // Restore from backup if import failed
      this.restoreFromBackup();
      
      throw error;
    }
  }

  // Storage management
  getStorageInfo() {
    try {
      const state = localStorage.getItem(this.storageKey);
      const backup = localStorage.getItem(this.backupKey);
      
      return {
        hasState: !!state,
        hasBackup: !!backup,
        stateSize: state ? state.length : 0,
        backupSize: backup ? backup.length : 0,
        totalSize: (state?.length || 0) + (backup?.length || 0),
        lastSaved: state ? JSON.parse(state).timestamp : null
      };
    } catch (error) {
      return {
        hasState: false,
        hasBackup: false,
        stateSize: 0,
        backupSize: 0,
        totalSize: 0,
        lastSaved: null,
        error: error.message
      };
    }
  }

  clearStorage() {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.backupKey);
      
      EnderTrack.Events?.emit?.('persistence:cleared');
      
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }

  // Configuration
  setAutoSaveDelay(delay) {
    this.autoSaveDelay = Math.max(5000, delay); // Minimum 5 seconds
    
    // Restart auto-save with new delay
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.setupAutoSave();
    }
  }

  setStorageKeys(stateKey, backupKey) {
    this.storageKey = stateKey || 'endertrack_state';
    this.backupKey = backupKey || 'endertrack_state_backup';
  }

  // Cleanup
  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    
    // Final save
    this.saveState();
    
    this.isInitialized = false;
  }




}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Persistence = new PersistenceManager();