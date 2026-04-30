// modules/navigation/positioning.js - Absolute/relative positioning logic

class PositioningSystem {
  constructor() {
    this.isInitialized = false;
    this.currentMode = 'relative';
    this.targetPosition = { x: 0, y: 0, z: 0 };
    this.positionHistory = [];
    this.maxHistorySize = 1000;
  }

  init() {
    
    // Setup event listeners
    this.setupEventListeners();
    
    this.isInitialized = true;
    
    return true;
  }

  setupEventListeners() {
    // Listen to position changes
    EnderTrack.Events?.on?.('movement:completed', (result) => {
      if (result.success) {
        this.recordPosition(result.position);
      }
    });
    
    // Listen to mode changes
    EnderTrack.Events?.on?.('state:changed', (newState, oldState) => {
      if (newState.inputMode !== oldState.inputMode) {
        this.onModeChanged(newState.inputMode);
      }
    });
  }

  // Mode management
  setMode(mode) {
    if (mode !== 'relative' && mode !== 'absolute') {
      throw new Error(`Invalid positioning mode: ${mode}`);
    }
    
    this.currentMode = mode;
    EnderTrack.State?.update?.({ inputMode: mode });
    
    EnderTrack.Events?.emit?.('positioning:mode_changed', {
      mode,
      timestamp: Date.now()
    });
  }

  getMode() {
    return this.currentMode;
  }

  onModeChanged(newMode) {
    this.currentMode = newMode;
    
    // Update UI based on mode
    this.updateModeUI(newMode);
    
    // Reset target position when switching to absolute
    if (newMode === 'absolute') {
      const currentPos = EnderTrack.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
      this.setTargetPosition(currentPos.x, currentPos.y, currentPos.z);
    }
  }

  updateModeUI(mode) {
    // This would be handled by the UI system
    // Just emit an event for UI components to react
    EnderTrack.Events?.emit?.('positioning:ui_update_required', { mode });
  }

  // Absolute positioning
  setTargetPosition(x, y, z) {
    // Validate coordinates
    const validated = this.validateCoordinates(x, y, z);
    if (!validated.valid) {
      throw new Error(`Invalid coordinates: ${validated.error}`);
    }
    
    this.targetPosition = {
      x: validated.x,
      y: validated.y,
      z: validated.z
    };
    
    EnderTrack.Events?.emit?.('positioning:target_changed', {
      target: this.targetPosition,
      timestamp: Date.now()
    });
  }

  getTargetPosition() {
    return { ...this.targetPosition };
  }

  async moveToTarget() {
    if (this.currentMode !== 'absolute') {
      throw new Error('Cannot move to target in relative mode');
    }
    
    if (!EnderTrack.Movement) {
      throw new Error('Movement system not available');
    }
    
    return await EnderTrack.Movement.moveAbsolute(
      this.targetPosition.x,
      this.targetPosition.y,
      this.targetPosition.z
    );
  }

  async moveToPosition(x, y, z) {
    this.setTargetPosition(x, y, z);
    return await this.moveToTarget();
  }

  // Relative positioning
  async moveRelative(dx, dy, dz) {
    if (!EnderTrack.Movement) {
      throw new Error('Movement system not available');
    }
    
    // Validate relative movement
    const validated = this.validateRelativeMovement(dx, dy, dz);
    if (!validated.valid) {
      throw new Error(`Invalid relative movement: ${validated.error}`);
    }
    
    return await EnderTrack.Movement.moveRelative(
      validated.dx,
      validated.dy,
      validated.dz
    );
  }

  // Coordinate validation
  validateCoordinates(x, y, z) {
    const state = EnderTrack.State?.get?.() || {};
    const dimensions = state.plateauDimensions || { x: 200, y: 200, z: 100 };
    
    // Use actual plateau dimensions
    const bounds = {
      minX: -dimensions.x / 2,
      maxX: dimensions.x / 2,
      minY: -dimensions.y / 2,
      maxY: dimensions.y / 2,
      minZ: -dimensions.z / 2,
      maxZ: dimensions.z / 2
    };
    
    // Sanitize inputs
    const numX = Number(x);
    const numY = Number(y);
    const numZ = Number(z);
    
    if (isNaN(numX) || isNaN(numY) || isNaN(numZ)) {
      return {
        valid: false,
        error: 'Coordinates must be numbers'
      };
    }
    
    // Check bounds
    if (numX < bounds.minX || numX > bounds.maxX) {
      return {
        valid: false,
        error: `X coordinate must be between ${bounds.minX} and ${bounds.maxX}`
      };
    }
    
    if (numY < bounds.minY || numY > bounds.maxY) {
      return {
        valid: false,
        error: `Y coordinate must be between ${bounds.minY} and ${bounds.maxY}`
      };
    }
    
    if (numZ < bounds.minZ || numZ > bounds.maxZ) {
      return {
        valid: false,
        error: `Z coordinate must be between ${bounds.minZ} and ${bounds.maxZ}`
      };
    }
    
    return {
      valid: true,
      x: numX,
      y: numY,
      z: numZ,
      bounds
    };
  }

  validateRelativeMovement(dx, dy, dz) {
    const numDx = Number(dx) || 0;
    const numDy = Number(dy) || 0;
    const numDz = Number(dz) || 0;
    
    // Check for reasonable movement limits
    const maxMovement = 100; // mm
    
    if (Math.abs(numDx) > maxMovement || 
        Math.abs(numDy) > maxMovement || 
        Math.abs(numDz) > maxMovement) {
      return {
        valid: false,
        error: `Movement too large (max ${maxMovement}mm per axis)`
      };
    }
    
    // Check if movement would exceed bounds
    const currentPos = EnderTrack.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
    const newPos = {
      x: currentPos.x + numDx,
      y: currentPos.y + numDy,
      z: currentPos.z + numDz
    };
    
    const validation = this.validateCoordinates(newPos.x, newPos.y, newPos.z);
    if (!validation.valid) {
      return {
        valid: false,
        error: `Movement would exceed bounds: ${validation.error}`
      };
    }
    
    return {
      valid: true,
      dx: numDx,
      dy: numDy,
      dz: numDz
    };
  }

  // Position history
  recordPosition(position) {
    const entry = {
      x: Number(position.x.toFixed(3)),
      y: Number(position.y.toFixed(3)),
      z: Number(position.z.toFixed(3)),
      timestamp: Date.now(),
      mode: this.currentMode
    };
    
    this.positionHistory.push(entry);
    
    // Limit history size
    if (this.positionHistory.length > this.maxHistorySize) {
      this.positionHistory.shift();
    }
    
    EnderTrack.Events?.emit?.('positioning:position_recorded', entry);
  }

  getPositionHistory(limit = null) {
    if (limit) {
      return this.positionHistory.slice(-limit);
    }
    return [...this.positionHistory];
  }

  clearPositionHistory() {
    this.positionHistory = [];
    EnderTrack.Events?.emit?.('positioning:history_cleared');
  }

  // Position analysis
  getMovementStatistics() {
    if (this.positionHistory.length < 2) {
      return {
        totalDistance: 0,
        totalTime: 0,
        averageSpeed: 0,
        pointCount: this.positionHistory.length,
        bounds: null
      };
    }
    
    let totalDistance = 0;
    let minX = this.positionHistory[0].x;
    let maxX = this.positionHistory[0].x;
    let minY = this.positionHistory[0].y;
    let maxY = this.positionHistory[0].y;
    let minZ = this.positionHistory[0].z;
    let maxZ = this.positionHistory[0].z;
    
    for (let i = 1; i < this.positionHistory.length; i++) {
      const prev = this.positionHistory[i - 1];
      const curr = this.positionHistory[i];
      
      // Calculate distance
      const distance = EnderTrack.Math?.distance3D?.(
        prev.x, prev.y, prev.z,
        curr.x, curr.y, curr.z
      ) || 0;
      
      totalDistance += distance;
      
      // Update bounds
      minX = Math.min(minX, curr.x);
      maxX = Math.max(maxX, curr.x);
      minY = Math.min(minY, curr.y);
      maxY = Math.max(maxY, curr.y);
      minZ = Math.min(minZ, curr.z);
      maxZ = Math.max(maxZ, curr.z);
    }
    
    const totalTime = this.positionHistory[this.positionHistory.length - 1].timestamp - 
                     this.positionHistory[0].timestamp;
    
    const averageSpeed = totalTime > 0 ? (totalDistance / totalTime) * 1000 : 0; // mm/s
    
    return {
      totalDistance: Number(totalDistance.toFixed(2)),
      totalTime,
      averageSpeed: Number(averageSpeed.toFixed(2)),
      pointCount: this.positionHistory.length,
      bounds: {
        minX: Number(minX.toFixed(3)),
        maxX: Number(maxX.toFixed(3)),
        minY: Number(minY.toFixed(3)),
        maxY: Number(maxY.toFixed(3)),
        minZ: Number(minZ.toFixed(3)),
        maxZ: Number(maxZ.toFixed(3))
      }
    };
  }

  // Preset positions
  savePresetPosition(name, position = null) {
    const pos = position || EnderTrack.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
    
    const presets = this.getPresetPositions();
    presets[name] = {
      x: Number(pos.x.toFixed(3)),
      y: Number(pos.y.toFixed(3)),
      z: Number(pos.z.toFixed(3)),
      timestamp: Date.now()
    };
    
    this.savePresetPositions(presets);
    
    EnderTrack.Events?.emit?.('positioning:preset_saved', {
      name,
      position: presets[name]
    });
  }

  async goToPresetPosition(name) {
    const presets = this.getPresetPositions();
    const preset = presets[name];
    
    if (!preset) {
      throw new Error(`Preset position '${name}' not found`);
    }
    
    return await this.moveToPosition(preset.x, preset.y, preset.z);
  }

  deletePresetPosition(name) {
    const presets = this.getPresetPositions();
    
    if (presets[name]) {
      delete presets[name];
      this.savePresetPositions(presets);
      
      EnderTrack.Events?.emit?.('positioning:preset_deleted', { name });
      return true;
    }
    
    return false;
  }

  getPresetPositions() {
    try {
      const saved = localStorage.getItem('endertrack_preset_positions');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.warn('Failed to load preset positions:', error);
      return {};
    }
  }

  savePresetPositions(presets) {
    try {
      localStorage.setItem('endertrack_preset_positions', JSON.stringify(presets));
    } catch (error) {
      console.warn('Failed to save preset positions:', error);
    }
  }

  // Coordinate transformations
  screenToMap(screenX, screenY, canvasElement) {
    if (!EnderTrack.Coordinates) {
      throw new Error('Coordinate system not available');
    }
    
    const canvasPos = EnderTrack.Coordinates.screenToCanvas(screenX, screenY, canvasElement);
    return EnderTrack.Coordinates.canvasToMap(canvasPos.cx, canvasPos.cy);
  }

  mapToScreen(mapX, mapY, canvasElement) {
    if (!EnderTrack.Coordinates) {
      throw new Error('Coordinate system not available');
    }
    
    const canvasPos = EnderTrack.Coordinates.mapToCanvas(mapX, mapY);
    return EnderTrack.Coordinates.canvasToScreen(canvasPos.cx, canvasPos.cy, canvasElement);
  }

  // Distance calculations
  distanceTo(x, y, z = null) {
    const currentPos = EnderTrack.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
    
    if (z !== null) {
      return EnderTrack.Math?.distance3D?.(
        currentPos.x, currentPos.y, currentPos.z,
        x, y, z
      ) || 0;
    } else {
      return EnderTrack.Math?.distance2D?.(
        currentPos.x, currentPos.y,
        x, y
      ) || 0;
    }
  }

  distanceBetween(pos1, pos2) {
    if (pos1.z !== undefined && pos2.z !== undefined) {
      return EnderTrack.Math?.distance3D?.(
        pos1.x, pos1.y, pos1.z,
        pos2.x, pos2.y, pos2.z
      ) || 0;
    } else {
      return EnderTrack.Math?.distance2D?.(
        pos1.x, pos1.y,
        pos2.x, pos2.y
      ) || 0;
    }
  }

  // Utility methods
  getCurrentPosition() {
    return EnderTrack.State?.get?.()?.pos || { x: 0, y: 0, z: 0 };
  }

  isAtPosition(x, y, z, tolerance = 0.1) {
    const currentPos = this.getCurrentPosition();
    
    return Math.abs(currentPos.x - x) <= tolerance &&
           Math.abs(currentPos.y - y) <= tolerance &&
           Math.abs(currentPos.z - z) <= tolerance;
  }

  isAtTarget(tolerance = 0.1) {
    return this.isAtPosition(
      this.targetPosition.x,
      this.targetPosition.y,
      this.targetPosition.z,
      tolerance
    );
  }

  // Export/Import
  exportPositionHistory() {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      mode: this.currentMode,
      targetPosition: this.targetPosition,
      history: this.positionHistory,
      statistics: this.getMovementStatistics(),
      presets: this.getPresetPositions()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `endertrack_positioning_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importPositionHistory(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.version && data.history) {
        this.positionHistory = data.history;
        
        if (data.targetPosition) {
          this.targetPosition = data.targetPosition;
        }
        
        if (data.presets) {
          this.savePresetPositions(data.presets);
        }
        
        EnderTrack.Events?.emit?.('positioning:data_imported', data);
        return true;
      }
      
      throw new Error('Invalid file format');
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  }

  // Debug information
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      currentMode: this.currentMode,
      targetPosition: this.targetPosition,
      historySize: this.positionHistory.length,
      statistics: this.getMovementStatistics(),
      presetCount: Object.keys(this.getPresetPositions()).length
    };
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.Positioning = new PositioningSystem();