// modules/ui/color-manager.js - Color management system

class ColorManager {
  constructor() {
    this.savedColors = null;
    this.savedInputValues = null;
    this.savedInterfaceSettings = null;
    this.savedAdvancedSettings = null;
  }

  updateDisplayColor(colorType, value) {
    if (!window.customColors) {
      window.customColors = {};
    }
    
    window.customColors[colorType] = value;
    
    // Synchronize with state for persistence
    if (window.EnderTrack?.State) {
      window.EnderTrack.State.update({ customColors: { ...window.customColors } });
    }
    
    // Force canvas re-render
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
    
    // Force Z canvas re-render for preview
    if (window.EnderTrack?.ZVisualization?.render) {
      window.EnderTrack.ZVisualization.render();
    }
  }

  openDisplayModal() {
    const modal = document.getElementById('displayModal');
    if (modal) {
      modal.style.display = 'block';
      
      // Save current state for cancel functionality
      this.savedColors = window.customColors ? {...window.customColors} : {};
      this.savedInputValues = {};
      this.savedInterfaceSettings = {};
      this.savedAdvancedSettings = {};
      
      // Save color inputs
      const colorInputs = [
        'colorCurrentPosition', 'colorFuturePosition', 'colorTrackPath', 
        'colorGrid', 'colorOriginAxes', 'colorMapBackground',
        'colorTrackFree', 'colorHistoryPositions', 'colorAxisX', 
        'colorAxisY', 'colorOutside', 'colorScaleBar', 'colorZOrigin', 'colorZScale',
        'colorZBackground', 'colorZCurrentPosition', 'colorZHistory',
        'colorMiniOrigin', 'colorMiniPosition', 'colorMiniViewport', 
        'colorMiniTrack', 'colorMiniBackground', 'colorMiniBorder'
      ];
      
      colorInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
          this.savedInputValues[inputId] = input.value;
        }
      });
      
      // Read current state of interface elements
      const interfaceCheckboxes = [
        'showZPanel', 'showStatusSection', 'showOthersTab', 'showControllerLog', 'showFuturePositionsXY', 'showFuturePositionsZ',
        'showHistoryPanel', 'showGraphs'
        // SUPPRIMÉ - Ces checkboxes sont gérées par ui-settings.js
        // 'showPositionXYHistory', 'showPositionZHistory', 'showTrackPositions', 'showTrackFree'
      ];
      
      interfaceCheckboxes.forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          this.savedInterfaceSettings[checkboxId] = checkbox.checked;
          // Set checkbox to match current element visibility or default state
          const currentState = this.getElementVisibility(checkboxId);
          checkbox.checked = currentState;
        }
      });
      
      // Initialize snake mode settings
      const enableSnakeMode = document.getElementById('enableSnakeMode');
      const snakeSlider = document.getElementById('snakePointsSlider');
      const snakeValue = document.getElementById('snakePointsValue');
      const snakeModeGroup = document.getElementById('snakeModeGroup');
      
      if (enableSnakeMode && window.EnderTrack?.State) {
        const state = window.EnderTrack.State.get();
        this.savedAdvancedSettings.enableSnakeMode = enableSnakeMode.checked;
        enableSnakeMode.checked = state.enableSnakeMode !== false;
      }
      
      if (snakeSlider && snakeValue && window.EnderTrack?.State) {
        const state = window.EnderTrack.State.get();
        const currentPoints = state.maxContinuousTrackPoints || 2000;
        this.savedAdvancedSettings.snakePointsValue = snakeSlider.value;
        snakeSlider.value = currentPoints;
        snakeValue.textContent = currentPoints;
      }
      
      // Show/hide snake mode group based on track free state
      const showTrackFree = document.getElementById('showTrackFree');
      if (snakeModeGroup && showTrackFree) {
        snakeModeGroup.style.display = showTrackFree.checked ? 'block' : 'none';
      }
      
      this.initializeColorInputs();
    }
  }

  closeDisplayModal() {
    // Restore all saved states on cancel
    if (this.savedColors) {
      window.customColors = {...this.savedColors};
    }
    
    if (this.savedInputValues) {
      Object.entries(this.savedInputValues).forEach(([inputId, value]) => {
        const input = document.getElementById(inputId);
        if (input) {
          input.value = value;
          const preview = input.parentElement.querySelector('.color-preview');
          if (preview) {
            preview.style.background = value;
          }
        }
      });
    }
    
    if (this.savedInterfaceSettings) {
      Object.entries(this.savedInterfaceSettings).forEach(([checkboxId, checked]) => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
          checkbox.checked = checked;
          this.applyInterfaceSetting(checkboxId, checked);
        }
      });
    }
    
    if (this.savedAdvancedSettings) {
      Object.entries(this.savedAdvancedSettings).forEach(([key, value]) => {
        if (key === 'snakePointsValue') {
          const slider = document.getElementById('snakePointsSlider');
          const valueSpan = document.getElementById('snakePointsValue');
          if (slider && valueSpan) {
            slider.value = value;
            valueSpan.textContent = value;
          }
        } else {
          const checkbox = document.getElementById(key);
          if (checkbox) {
            checkbox.checked = value;
            this.applyAdvancedSetting(key, value);
          }
        }
      });
    }
    
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
    
    const modal = document.getElementById('displayModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  applyDisplaySettings() {
    // Sauvegarder l'état des checkboxes dans localStorage
    const checkboxes = [
      'showZPanel', 'showStatusSection', 'showOthersTab', 'showControllerLog', 'showFuturePositionsXY', 'showFuturePositionsZ',
      'showHistoryPanel', 'showGraphs'
      // SUPPRIMÉ - Ces checkboxes sont gérées par ui-settings.js
      // 'showPositionXYHistory', 'showPositionZHistory', 'showTrackPositions', 'showTrackFree'
    ];
    
    checkboxes.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        localStorage.setItem(`endertrack_ui_${id}`, checkbox.checked.toString());
      }
    });
    
    // Sauvegarder aussi enableSnakeMode
    const snakeMode = document.getElementById('enableSnakeMode');
    if (snakeMode) {
      localStorage.setItem('endertrack_ui_enableSnakeMode', snakeMode.checked.toString());
    }
    
    // Clear saved state since we're applying changes
    this.savedColors = null;
    this.savedInputValues = null;
    this.savedInterfaceSettings = null;
    this.savedAdvancedSettings = null;
    
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
    
    if (window.EnderTrack?.ZVisualization?.render) {
      window.EnderTrack.ZVisualization.render();
    }
    
    const modal = document.getElementById('displayModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  getElementVisibility(settingId) {
    // Récupérer la valeur sauvegardée
    const savedState = localStorage.getItem(`endertrack_ui_${settingId}`);
    if (savedState !== null) {
      return savedState === 'true';
    }
    
    // Valeurs par défaut - toutes cochées
    return true;
  }

  initializeColorInputs() {
    const colorMappings = {
      'colorCurrentPosition': 'positionColor',
      'colorFuturePosition': 'futurePosition',
      'colorTrackPath': 'trackColor',
      'colorGrid': 'gridColor',
      'colorOriginAxes': 'originAxes',
      'colorMapBackground': 'mapBackground',
      'colorTrackFree': 'trackFreeColor',
      'colorHistoryPositions': 'historyPositionsColor',
      'colorAxisX': 'axisXColor',
      'colorAxisY': 'axisYColor',
      'colorOutside': 'outsideColor',
      'colorScaleBar': 'scaleBarColor',
      'colorZOrigin': 'zOriginColor',
      'colorZScale': 'zScaleColor',
      'colorZBackground': 'zBackground',
      'colorZCurrentPosition': 'zCurrentPosition',
      'colorZHistory': 'zHistoryPosition',
      'colorMiniOrigin': 'miniOriginColor',
      'colorMiniPosition': 'miniPositionColor',
      'colorMiniViewport': 'miniViewportColor',
      'colorMiniTrack': 'miniTrackColor',
      'colorMiniBackground': 'miniBackgroundColor',
      'colorMiniBorder': 'miniBorderColor'
    };
    
    Object.entries(colorMappings).forEach(([inputId, colorType]) => {
      const input = document.getElementById(inputId);
      const preview = input?.parentElement?.querySelector('.color-preview');
      if (input && preview) {
        preview.style.background = input.value;
      }
    });
  }

  resetDisplayColors() {
    const defaultColors = {
      'colorCurrentPosition': '#4f9eff',
      'colorFuturePosition': 'var(--coordinates-color)', 
      'colorTrackPath': 'var(--success)',
      'colorGrid': 'var(--border)',
      'colorOriginAxes': 'var(--danger)',
      'colorMapBackground': 'var(--app-bg)',
      'colorTrackFree': 'var(--warning)',
      'colorHistoryPositions': 'var(--success)',
      'colorAxisX': 'var(--danger)',
      'colorAxisY': 'var(--success)',
      'colorOutside': 'var(--container-bg)',
      'colorScaleBar': 'var(--text-selected)',
      'colorZOrigin': 'var(--danger)',
      'colorZScale': 'var(--text-selected)',
      'colorZBackground': 'var(--app-bg)',
      'colorZCurrentPosition': '#4f9eff',
      'colorZHistory': 'var(--success)',
      'colorMiniOrigin': 'var(--danger)',
      'colorMiniPosition': '#4f9eff',
      'colorMiniViewport': 'var(--active-element)',
      'colorMiniTrack': 'var(--success)',
      'colorMiniBackground': 'var(--app-bg)',
      'colorMiniBorder': 'var(--text-general)'
    };
    
    Object.entries(defaultColors).forEach(([inputId, value]) => {
      const input = document.getElementById(inputId);
      if (input) {
        input.value = value;
        const preview = input.parentElement.querySelector('.color-preview');
        if (preview) {
          preview.style.background = value;
        }
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);
      }
    });
  }

  randomizeDisplayColors() {
    const inputIds = [
      'colorCurrentPosition', 'colorFuturePosition', 'colorTrackPath', 
      'colorGrid', 'colorOriginAxes', 'colorMapBackground',
      'colorTrackFree', 'colorHistoryPositions', 'colorAxisX', 
      'colorAxisY', 'colorOutside', 'colorScaleBar', 'colorZOrigin', 'colorZScale',
      'colorZBackground', 'colorZCurrentPosition', 'colorZHistory',
      'colorMiniOrigin', 'colorMiniPosition', 'colorMiniViewport', 
      'colorMiniTrack', 'colorMiniBackground', 'colorMiniBorder'
    ];
    
    inputIds.forEach(inputId => {
      const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
      const input = document.getElementById(inputId);
      if (input) {
        input.value = randomColor;
        const preview = input.parentElement.querySelector('.color-preview');
        if (preview) {
          preview.style.background = randomColor;
        }
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);
      }
    });
  }
  
  applyInterfaceSetting(settingId, value) {
    // Apply interface settings with immediate preview
    const elementMappings = {
      'showNavigationTab': '.left-panel',
      'showZPanel': '.z-visualization-panel', 
      'showStatusSection': '.status-section',
      'showOthersTab': '#othersTab',
      'showHistoryPanel': '.history-section',
      'showGraphs': '.graphs-section',
      'showTrackPositions': null, // Handled by canvas
      'showTrackFree': null // Handled by canvas
    };
    

    
    const selector = elementMappings[settingId];
    if (selector) {
      const element = document.querySelector(selector);
      if (element) {
        if (settingId === 'showZPanel') {
          if (value) {
            // Use force function when showing Z panel
            if (window.forceZPanelVisible) {
              window.forceZPanelVisible();
            } else {
              element.style.display = 'flex';
            }
          } else {
            element.style.display = 'none';
          }
        } else {
          element.style.display = value ? 'block' : 'none';
        }
      }
    }
    
    // Special cases for canvas-related settings and navigation panel
    if (settingId === 'showTrackPositions' || settingId === 'showTrackFree' || settingId === 'showPositionXYHistory' || settingId === 'showPositionZHistory' || settingId === 'showFuturePositionsXY' || settingId === 'showFuturePositionsZ') {
      if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
      }
      if (window.EnderTrack?.ZVisualization?.render) {
        window.EnderTrack.ZVisualization.render();
      }
    }
    
    // Navigation panel is always visible - this checkbox is just for UI consistency
    if (settingId === 'showNavigationPanel') {
      return;
    }
  }
  
  applyAdvancedSetting(settingId, value) {
    // Apply advanced settings with immediate preview
    switch(settingId) {
      case 'showHistoryZ':
        // Toggle Z history display in Z visualization
        if (window.EnderTrack?.ZVisualization?.render) {
          window.EnderTrack.ZVisualization.render();
        }
        break;
        
      case 'showHistoryXY':
        // Toggle XY history display in main canvas
        if (window.EnderTrack?.Canvas?.requestRender) {
          window.EnderTrack.Canvas.requestRender();
        }
        break;
        
      case 'showControllerLog':
        // Toggle navigation log visibility
        const navLog = document.getElementById('navigationLog');
        if (navLog) {
          navLog.style.display = value ? 'block' : 'none';
        }
        break;
        
      case 'enableSnakeMode':
        // Toggle snake mode for position tracking
        if (window.EnderTrack?.Canvas?.requestRender) {
          window.EnderTrack.Canvas.requestRender();
        }
        break;
    }
  }
}

// Global instance
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ColorManager = new ColorManager();

// Global functions for HTML compatibility
window.updateDisplayColor = (colorType, value) => window.EnderTrack.ColorManager.updateDisplayColor(colorType, value);
window.openDisplayModal = () => window.EnderTrack.ColorManager.openDisplayModal();
window.closeDisplayModal = () => window.EnderTrack.ColorManager.closeDisplayModal();
window.applyDisplaySettings = () => window.EnderTrack.ColorManager.applyDisplaySettings();
window.initializeColorInputs = () => window.EnderTrack.ColorManager.initializeColorInputs();
window.resetDisplayColors = () => window.EnderTrack.ColorManager.resetDisplayColors();
window.randomizeDisplayColors = () => window.EnderTrack.ColorManager.randomizeDisplayColors();
window.resetColors = () => window.EnderTrack.ColorManager.resetDisplayColors();
window.randomizeColors = () => window.EnderTrack.ColorManager.randomizeDisplayColors();
window.resetInterface = () => {
    const checkboxes = ['showZPanel', 'showStatusSection', 'showOthersTab', 'showFuturePositionsXY', 'showFuturePositionsZ', 'showHistoryPanel', 'showGraphs', 'showPositionXYHistory', 'showPositionZHistory', 'showTrackPositions', 'showTrackFree', 'enableSnakeMode', 'showControllerLog'];
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = true;
            if (window.EnderTrack?.ColorManager?.applyInterfaceSetting) {
                window.EnderTrack.ColorManager.applyInterfaceSetting(id, true);
            }
        }
    });
    // Reset snake slider
    const slider = document.getElementById('snakePointsSlider');
    const value = document.getElementById('snakePointsValue');
    if (slider && value) {
        slider.value = '2000';
        value.textContent = '2000';
    }
};


// Functions to handle checkbox changes with preview

window.toggleZPanel = () => {
  const checked = document.getElementById('showZPanel').checked;
  window.EnderTrack.ColorManager.applyInterfaceSetting('showZPanel', checked);
  
  // Force Z panel visibility using the force function
  if (checked && window.forceZPanelVisible) {
    setTimeout(() => window.forceZPanelVisible(), 50);
  }
};
window.toggleStatusSection = () => window.EnderTrack.ColorManager.applyInterfaceSetting('showStatusSection', document.getElementById('showStatusSection').checked);
window.toggleOthersTab = () => window.EnderTrack.ColorManager.applyInterfaceSetting('showOthersTab', document.getElementById('showOthersTab').checked);


window.toggleHistoryPanel = () => window.EnderTrack.ColorManager.applyInterfaceSetting('showHistoryPanel', document.getElementById('showHistoryPanel').checked);
window.toggleGraphs = () => window.EnderTrack.ColorManager.applyInterfaceSetting('showGraphs', document.getElementById('showGraphs').checked);
// SUPPRIMÉ - Causait des conflits avec la synchronisation
// window.togglePositionXYHistory = () => {
// window.togglePositionZHistory = () => {
// window.toggleTrackPositions = () => {
// window.toggleTrackFree = () => {

window.toggleFuturePositionsXY = () => {
  const checked = document.getElementById('showFuturePositionsXY').checked;
  window.EnderTrack.ColorManager.applyInterfaceSetting('showFuturePositionsXY', checked);
};

window.toggleFuturePositionsZ = () => {
  const checked = document.getElementById('showFuturePositionsZ').checked;
  window.EnderTrack.ColorManager.applyInterfaceSetting('showFuturePositionsZ', checked);
};

window.toggleControllerLog = () => window.EnderTrack.ColorManager.applyAdvancedSetting('showControllerLog', document.getElementById('showControllerLog').checked);
window.toggleSnakeMode = () => {
  const checked = document.getElementById('enableSnakeMode').checked;
  if (window.EnderTrack?.State) {
    window.EnderTrack.State.update({ enableSnakeMode: checked });
  }
};

window.toggleGraphHistory = () => {
  const modalCheckbox = document.getElementById('showGraphHistory');
  const mainCheckbox = document.getElementById('showGraphHistoryMain');
  const checked = modalCheckbox?.checked || mainCheckbox?.checked || false;
  
  if (modalCheckbox) modalCheckbox.checked = checked;
  if (mainCheckbox) mainCheckbox.checked = checked;
  
  const graphsSection = document.querySelector('.graphs-section');
  if (graphsSection) {
    graphsSection.style.display = checked ? 'block' : 'none';
  }
  if (window.EnderTrack?.State) {
    window.EnderTrack.State.update({ showGraphHistory: checked });
  }
};

window.updateSnakePoints = () => {
  const slider = document.getElementById('snakePointsSlider');
  const value = document.getElementById('snakePointsValue');
  if (slider && value && window.EnderTrack?.State) {
    const points = parseInt(slider.value);
    value.textContent = points;
    
    // Get current state and apply limitation immediately
    const state = window.EnderTrack.State.get();
    const newTrack = [...state.continuousTrack];
    
    // Trim track to new limit
    while (newTrack.length > points) {
      newTrack.shift();
    }
    
    // Update state with new limit and trimmed track
    window.EnderTrack.State.update({ 
      maxContinuousTrackPoints: points,
      continuousTrack: newTrack
    });
  }
};