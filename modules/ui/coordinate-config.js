// modules/ui/coordinate-config.js - Coordinate Configuration System
// Inspired by test_coords.html functionality

class CoordinateConfig {
  constructor() {
    this.isInitialized = false;
    this.coordinateBounds = {
      x: { min: -100, max: 100 },
      y: { min: -100, max: 100 },
      z: { min: 0, max: 100 }
    };
    this.axisOrientation = {
      x: 'right',
      y: 'up',
      z: 'up'
    };
    this.plateauSize = 200;
  }

  init() {
    // console.log('🎯 Initializing Coordinate Configuration...');
    this.setupEventListeners();
    this.loadFromState();
    this.updateUI();
    this.isInitialized = true;
    // console.log('✅ Coordinate Configuration initialized');
  }

  setupEventListeners() {
    // Plateau dimension changes
    ['plateauX', 'plateauY', 'plateauZ'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', () => this.handlePlateauDimensionChange());
        input.addEventListener('input', () => this.handlePlateauDimensionChange());
      }
    });

    // Coordinate range inputs
    ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', (e) => this.handleRangeChange(e));
        input.addEventListener('input', (e) => this.handleRangeChange(e));
      }
    });

    // Preset buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('preset-btn')) {
        this.handlePresetClick(e.target);
      }
    });
  }

  loadFromState() {
    if (!window.EnderTrack?.State) return;
    
    const state = window.EnderTrack.State.get();
    
    // Load coordinate bounds
    if (state.coordinateBounds) {
      this.coordinateBounds = { ...state.coordinateBounds };
    }
    
    // Load axis orientation
    if (state.axisOrientation) {
      this.axisOrientation = { ...state.axisOrientation };
    }
    
    // Load plateau dimensions
    if (state.plateauDimensions) {
      this.plateauSize = Math.max(state.plateauDimensions.x, state.plateauDimensions.y);
    }
  }

  updateUI() {
    // Update plateau dimensions
    const plateauDims = this.getPlateauDimensions();
    const plateauXInput = document.getElementById('plateauX');
    const plateauYInput = document.getElementById('plateauY');
    const plateauZInput = document.getElementById('plateauZ');
    
    if (plateauXInput) plateauXInput.value = plateauDims.x;
    if (plateauYInput) plateauYInput.value = plateauDims.y;
    if (plateauZInput) plateauZInput.value = plateauDims.z;

    // Update coordinate inputs
    this.updateRangeInputs();
    
    // Update axis orientation buttons
    this.updateAxisButtons();
    
    // Update preset button states
    this.updatePresetButtons();
  }

  updateRangeInputs() {
    const inputs = {
      'xMin': this.coordinateBounds.x.min,
      'xMax': this.coordinateBounds.x.max,
      'yMin': this.coordinateBounds.y.min,
      'yMax': this.coordinateBounds.y.max,
      'zMin': this.coordinateBounds.z.min,
      'zMax': this.coordinateBounds.z.max
    };

    Object.entries(inputs).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) {
        input.value = value.toFixed(1);
      }
    });
  }

  updateOrientationSelectors() {
    const selectors = {
      'xDirection': this.axisOrientation.x,
      'yDirection': this.axisOrientation.y,
      'zDirection': this.axisOrientation.z
    };

    Object.entries(selectors).forEach(([id, value]) => {
      const select = document.getElementById(id);
      if (select) {
        select.value = value;
      }
    });
  }

  updateAxisButtons() {
    // Update axis orientation buttons if they exist (from test_coords.html style)
    const buttons = document.querySelectorAll('.axis-btn');
    buttons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.x === this.axisOrientation.x && 
          btn.dataset.y === this.axisOrientation.y) {
        btn.classList.add('active');
      }
    });
  }

  updatePresetButtons() {
    ['x', 'y', 'z'].forEach(axis => {
      const plateauDim = parseFloat(document.getElementById(`plateau${axis.toUpperCase()}`)?.value) || 100;
      const min = this.coordinateBounds[axis].min;
      const max = this.coordinateBounds[axis].max;
      
      // Check if current values match presets (with small tolerance for floating point)
      const tolerance = 0.01;
      const isCentered = (Math.abs(min - (-plateauDim / 2)) < tolerance && Math.abs(max - (plateauDim / 2)) < tolerance);
      const isPositive = (Math.abs(min - 0) < tolerance && Math.abs(max - plateauDim) < tolerance);
      
      // Find buttons by their onclick attribute
      const buttons = document.querySelectorAll('.preset-btn');
      buttons.forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (onclick && onclick.includes(`'${axis}'`)) {
          if (onclick.includes("'centered'")) {
            btn.classList.toggle('active', isCentered);
          } else if (onclick.includes("'positive'")) {
            btn.classList.toggle('active', isPositive);
          }
        }
      });
    });
  }

  handlePlateauDimensionChange() {
    const plateauX = parseFloat(document.getElementById('plateauX')?.value) || 200;
    const plateauY = parseFloat(document.getElementById('plateauY')?.value) || 200;
    const plateauZ = parseFloat(document.getElementById('plateauZ')?.value) || 100;
    
    // Check which presets are currently active before changing dimensions
    const activePresets = {};
    ['x', 'y', 'z'].forEach(axis => {
      const buttons = document.querySelectorAll('.preset-btn');
      buttons.forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (onclick && onclick.includes(`'${axis}'`) && btn.classList.contains('active')) {
          if (onclick.includes("'centered'")) {
            activePresets[axis] = 'centered';
          } else if (onclick.includes("'positive'")) {
            activePresets[axis] = 'positive';
          }
        }
      });
    });
    
    // Apply new dimensions based on active presets
    if (activePresets.x === 'centered') {
      this.coordinateBounds.x.min = -plateauX / 2;
      this.coordinateBounds.x.max = plateauX / 2;
    } else if (activePresets.x === 'positive') {
      this.coordinateBounds.x.min = 0;
      this.coordinateBounds.x.max = plateauX;
    }
    
    if (activePresets.y === 'centered') {
      this.coordinateBounds.y.min = -plateauY / 2;
      this.coordinateBounds.y.max = plateauY / 2;
    } else if (activePresets.y === 'positive') {
      this.coordinateBounds.y.min = 0;
      this.coordinateBounds.y.max = plateauY;
    }
    
    if (activePresets.z === 'centered') {
      this.coordinateBounds.z.min = -plateauZ / 2;
      this.coordinateBounds.z.max = plateauZ / 2;
    } else if (activePresets.z === 'positive') {
      this.coordinateBounds.z.min = 0;
      this.coordinateBounds.z.max = plateauZ;
    }
    
    this.updateRangeInputs();
    this.updatePresetButtons();
    this.saveToState();
    this.requestRender();
  }

  handleRangeChange(event) {
    const id = event.target.id;
    const newValue = parseFloat(event.target.value);
    
    // Determine error element
    let errorElement;
    if (id.startsWith('x')) {
      errorElement = document.getElementById('xRangeError');
    } else if (id.startsWith('y')) {
      errorElement = document.getElementById('yRangeError');
    } else if (id.startsWith('z')) {
      errorElement = document.getElementById('zRangeError');
    }
    
    // Clear previous errors
    if (errorElement) errorElement.textContent = '';
    
    // Validation
    if (isNaN(newValue)) {
      if (errorElement) errorElement.textContent = 'Veuillez entrer un nombre valide';
      return;
    }
    
    // Update coordinates directly
    if (id === 'xMin') {
      this.coordinateBounds.x.min = newValue;
    } else if (id === 'xMax') {
      this.coordinateBounds.x.max = newValue;
    } else if (id === 'yMin') {
      this.coordinateBounds.y.min = newValue;
    } else if (id === 'yMax') {
      this.coordinateBounds.y.max = newValue;
    } else if (id === 'zMin') {
      this.coordinateBounds.z.min = newValue;
    } else if (id === 'zMax') {
      this.coordinateBounds.z.max = newValue;
    }
    
    this.updatePresetButtons(); // Update preset button states
    this.saveToState();
    this.requestRender();
  }

  handleOrientationChange() {
    const xDirection = document.getElementById('xDirection');
    const yDirection = document.getElementById('yDirection');
    const zDirection = document.getElementById('zDirection');
    
    if (xDirection) this.axisOrientation.x = xDirection.value;
    if (yDirection) this.axisOrientation.y = yDirection.value;
    if (zDirection) this.axisOrientation.z = zDirection.value;
    
    this.updateAxisButtons();
    this.saveToState();
    this.requestRender();
  }

  handlePresetClick(button) {
    const target = button.dataset.target;
    const value = parseFloat(button.dataset.value);
    
    if (!target || isNaN(value)) return;
    
    const input = document.getElementById(target);
    if (input) {
      input.value = value;
      
      // Trigger change event
      const event = new Event('change');
      input.dispatchEvent(event);
    }
  }

  // Axis orientation button handlers (for test_coords.html style interface)
  setAxisOrientation(x, y, z) {
    this.axisOrientation.x = x;
    this.axisOrientation.y = y;
    if (z !== undefined) this.axisOrientation.z = z;
    this.updateAxisButtons();
    this.saveToState();
    this.requestRender();
    
  }

  createAxisOrientationButtons() {
    const orientations = [
      { key: 'standard', label: '↗', xDir: 'right', yDir: 'up' },
      { key: 'xFlipped', label: 'X←Y↑', xDir: 'left', yDir: 'up' },
      { key: 'yFlipped', label: 'X→Y↓', xDir: 'right', yDir: 'down' },
      { key: 'bothFlipped', label: 'X←Y↓', xDir: 'left', yDir: 'down' }
    ];

    const container = document.querySelector('.axis-buttons');
    if (!container) return;

    container.innerHTML = '';
    orientations.forEach(orientation => {
      const button = document.createElement('button');
      button.className = 'axis-btn';
      button.dataset.x = orientation.xDir;
      button.dataset.y = orientation.yDir;
      button.textContent = orientation.label;
      button.onclick = () => this.setAxisOrientation(orientation.xDir, orientation.yDir);
      container.appendChild(button);
    });

    this.updateAxisButtons();
  }

  saveToState() {
    if (!window.EnderTrack?.State) return;
    
    // Calculate plateau dimensions
    const plateauDimensions = {
      x: Math.abs(this.coordinateBounds.x.max - this.coordinateBounds.x.min),
      y: Math.abs(this.coordinateBounds.y.max - this.coordinateBounds.y.min),
      z: Math.abs(this.coordinateBounds.z.max - this.coordinateBounds.z.min)
    };
    
    window.EnderTrack.State.update({
      coordinateBounds: this.coordinateBounds,
      axisOrientation: this.axisOrientation,
      plateauDimensions: plateauDimensions,
      mapSizeMm: Math.max(plateauDimensions.x, plateauDimensions.y)
    });
    
    // Update coordinate system
    if (window.EnderTrack?.Coordinates) {
      window.EnderTrack.Coordinates.updateParameters({
        plateauDimensions: plateauDimensions
      });
    }
    
    // Update platform size display
    const platformSize = document.getElementById('platformSize');
    if (platformSize) {
      platformSize.textContent = `${plateauDimensions.x}×${plateauDimensions.y}×${plateauDimensions.z}mm`;
    }
  }

  requestRender() {
    // Update coordinate system first
    if (window.EnderTrack?.Coordinates) {
      window.EnderTrack.Coordinates.updateParameters({
        axisOrientation: this.axisOrientation
      });
    }
    
    // Force minimap redraw
    if (window.EnderTrack?.MiniPreview) {
      const state = window.EnderTrack.State?.get();
      if (state) {
        window.EnderTrack.MiniPreview.renderInHeader('miniPreviewXY', state);
      }
    }
    
    // Request canvas re-render
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
    
    // Request Z visualization re-render
    if (window.EnderTrack?.ZVisualization?.render) {
      window.EnderTrack.ZVisualization.render();
    }
  }

  // API methods for external use
  getCoordinateBounds() {
    return { ...this.coordinateBounds };
  }

  getAxisOrientation() {
    return { ...this.axisOrientation };
  }



  setCoordinateBounds(bounds) {
    this.coordinateBounds = { ...bounds };
    this.updateUI();
    this.saveToState();
    this.requestRender();
  }

  setAxisOrientation(orientation) {
    this.axisOrientation = { ...orientation };
    this.updateUI();
    this.saveToState();
    this.requestRender();
  }

  setPlateauDimensions(x, y, z) {
    // Update coordinate bounds based on new dimensions
    this.coordinateBounds.x.min = -x / 2;
    this.coordinateBounds.x.max = x / 2;
    this.coordinateBounds.y.min = -y / 2;
    this.coordinateBounds.y.max = y / 2;
    this.coordinateBounds.z.min = 0;
    this.coordinateBounds.z.max = z;
    
    this.updateUI();
    this.saveToState();
    this.requestRender();
  }
  
  getPlateauDimensions() {
    return {
      x: Math.abs(this.coordinateBounds.x.max - this.coordinateBounds.x.min),
      y: Math.abs(this.coordinateBounds.y.max - this.coordinateBounds.y.min),
      z: Math.abs(this.coordinateBounds.z.max - this.coordinateBounds.z.min)
    };
  }

  // Validation methods
  validateCoordinates(x, y, z) {
    const bounds = this.coordinateBounds;
    
    return {
      x: x >= bounds.x.min && x <= bounds.x.max,
      y: y >= bounds.y.min && y <= bounds.y.max,
      z: z >= bounds.z.min && z <= bounds.z.max,
      valid: x >= bounds.x.min && x <= bounds.x.max &&
             y >= bounds.y.min && y <= bounds.y.max &&
             z >= bounds.z.min && z <= bounds.z.max
    };
  }

  clampCoordinates(x, y, z) {
    const bounds = this.coordinateBounds;
    
    return {
      x: Math.max(bounds.x.min, Math.min(bounds.x.max, x)),
      y: Math.max(bounds.y.min, Math.min(bounds.y.max, y)),
      z: Math.max(bounds.z.min, Math.min(bounds.z.max, z))
    };
  }

  // Transform coordinates based on axis orientation
  transformCoordinates(x, y, z) {
    let transformedX = x;
    let transformedY = y;
    let transformedZ = z;
    
    // Apply X axis orientation
    if (this.axisOrientation.x === 'left') {
      transformedX = -x;
    }
    
    // Apply Y axis orientation
    if (this.axisOrientation.y === 'down') {
      transformedY = -y;
    }
    
    // Apply Z axis orientation
    if (this.axisOrientation.z === 'down') {
      transformedZ = -z;
    }
    
    return {
      x: transformedX,
      y: transformedY,
      z: transformedZ
    };
  }

  // Get debug information
  getDebugInfo() {
    return {
      coordinateBounds: this.coordinateBounds,
      axisOrientation: this.axisOrientation,
      plateauSize: this.plateauSize,
      isInitialized: this.isInitialized
    };
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.CoordinateConfig = new CoordinateConfig();

// Global functions for HTML interface
window.setAxisOrientation = function(x, y, z) {
  if (window.EnderTrack?.CoordinateConfig) {
    // Update the internal object first
    window.EnderTrack.CoordinateConfig.axisOrientation.x = x;
    window.EnderTrack.CoordinateConfig.axisOrientation.y = y;
    if (z !== undefined) window.EnderTrack.CoordinateConfig.axisOrientation.z = z;
    
    // Then update UI and state
    window.EnderTrack.CoordinateConfig.updateAxisButtons();
    window.EnderTrack.CoordinateConfig.saveToState();
    
    // Force immediate minimap redraw with updated state
    setTimeout(() => {
      window.EnderTrack.CoordinateConfig.requestRender();
    }, 10);
    
  }
};

// Range preset function
window.setRangePreset = function(axis, preset) {
  if (!window.EnderTrack?.CoordinateConfig) return;
  
  // Get plateau dimensions from inputs, not current bounds
  const plateauX = parseFloat(document.getElementById('plateauX')?.value) || 200;
  const plateauY = parseFloat(document.getElementById('plateauY')?.value) || 200;
  const plateauZ = parseFloat(document.getElementById('plateauZ')?.value) || 100;
  
  let minValue, maxValue;
  
  if (preset === 'centered') {
    // Centered preset: -half to +half
    if (axis === 'x') {
      minValue = -plateauX / 2;
      maxValue = plateauX / 2;
    } else if (axis === 'y') {
      minValue = -plateauY / 2;
      maxValue = plateauY / 2;
    } else if (axis === 'z') {
      minValue = -plateauZ / 2;
      maxValue = plateauZ / 2;
    }
  } else if (preset === 'positive') {
    // Positive preset: 0 to max
    minValue = 0;
    if (axis === 'x') {
      maxValue = plateauX;
    } else if (axis === 'y') {
      maxValue = plateauY;
    } else if (axis === 'z') {
      maxValue = plateauZ;
    }
  }
  
  // Update inputs
  const minInput = document.getElementById(axis + 'Min');
  const maxInput = document.getElementById(axis + 'Max');
  
  if (minInput && maxInput) {
    minInput.value = minValue.toFixed(1);
    maxInput.value = maxValue.toFixed(1);
    
    // Trigger change events
    minInput.dispatchEvent(new Event('change'));
    maxInput.dispatchEvent(new Event('change'));
  }
};

// Save manual profile function
window.saveManualProfile = function() {
  if (!window.EnderTrack?.CoordinateConfig) return;
  
  const coordConfig = window.EnderTrack.CoordinateConfig;
  
  // Create manual profile from current settings
  const manualProfile = {
    id: 'manual_profile',
    name: 'Profil Manuel',
    brand: 'Custom',
    dimensions: coordConfig.getPlateauDimensions(),
    coordinateBounds: coordConfig.getCoordinateBounds(),
    axisOrientation: coordConfig.getAxisOrientation(),
    description: 'Configuration manuelle personnalisée',
    category: 'Manual',
    gcode: true,
    timestamp: new Date().toISOString()
  };
  
  // Save to localStorage
  localStorage.setItem('endertrack_manual_profile', JSON.stringify(manualProfile));
  
  // Add to templates list if not already present
  if (window.PlateauTemplates) {
    const existingIndex = window.PlateauTemplates.templates.findIndex(t => t.id === 'manual_profile');
    if (existingIndex >= 0) {
      window.PlateauTemplates.templates[existingIndex] = manualProfile;
    } else {
      window.PlateauTemplates.templates.unshift(manualProfile); // Add at beginning
    }
  }
  
  if (window.EnderTrack?.Notifications) {
    window.EnderTrack.Notifications.show('Profil manuel sauvegardé', 'success');
  }
};

// Reset manual profile function
window.resetManualProfile = function() {
  if (!confirm('Réinitialiser le profil manuel aux valeurs par défaut ?')) return;
  
  // Reset to default values
  document.getElementById('plateauX').value = 200;
  document.getElementById('plateauY').value = 200;
  document.getElementById('plateauZ').value = 100;
  document.getElementById('xMin').value = -100;
  document.getElementById('xMax').value = 100;
  document.getElementById('yMin').value = -100;
  document.getElementById('yMax').value = 100;
  document.getElementById('zMin').value = 0;
  document.getElementById('zMax').value = 100;
  
  // Reset axis orientation
  const buttons = document.querySelectorAll('.axis-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  const defaultBtn = document.querySelector('.axis-btn[data-x="right"][data-y="up"]');
  if (defaultBtn) defaultBtn.classList.add('active');
  
  // Trigger updates
  if (window.EnderTrack?.CoordinateConfig) {
    window.EnderTrack.CoordinateConfig.handlePlateauDimensionChange();
    window.EnderTrack.CoordinateConfig.setAxisOrientation('right', 'up');
  }
  
  if (window.EnderTrack?.Notifications) {
    window.EnderTrack.Notifications.show('Profil manuel réinitialisé', 'info');
  }
};

window.validateAxisConfig = function() {
  if (window.EnderTrack?.CoordinateConfig) {
    // This function is called from the existing HTML
    // We'll integrate with the existing validateAxisConfig function
    const coordConfig = window.EnderTrack.CoordinateConfig;
    
    // Get values from existing inputs
    const xMin = parseFloat(document.getElementById('xMin')?.value) || -100;
    const xMax = parseFloat(document.getElementById('xMax')?.value) || 100;
    const yMin = parseFloat(document.getElementById('yMin')?.value) || -100;
    const yMax = parseFloat(document.getElementById('yMax')?.value) || 100;
    const zMin = parseFloat(document.getElementById('zMin')?.value) || 0;
    const zMax = parseFloat(document.getElementById('zMax')?.value) || 100;
    
    const xDirection = document.getElementById('xDirection')?.value || 'right';
    const yDirection = document.getElementById('yDirection')?.value || 'up';
    const zDirection = document.getElementById('zDirection')?.value || 'up';
    
    // Update coordinate config
    coordConfig.setCoordinateBounds({
      x: { min: xMin, max: xMax },
      y: { min: yMin, max: yMax },
      z: { min: zMin, max: zMax }
    });
    
    coordConfig.setAxisOrientation({
      x: xDirection,
      y: yDirection,
      z: zDirection
    });
    
    // Force canvas update
    setTimeout(() => {
      if (window.EnderTrack?.Canvas) {
        window.EnderTrack.Canvas.updateCoordinateSystem();
        window.EnderTrack.Canvas.requestRender();
      }
    }, 50);
    
  }
};