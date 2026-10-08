// core/app.js - Application lifecycle management
// Main application controller

class EnderTrackApp {
  constructor() {
    this.isInitialized = false;
    this.isRunning = false;
    this.version = '2.0.0';
    this.buildDate = '2024-12-19';
  }

  static start() {
    // Initialize all subsystems
    this.initializeSubsystems();
    
    // Setup global event handlers
    this.setupGlobalEvents();
    
    // Setup UI event handlers
    this.setupUIHandlers();
    
    // Start render loop
    this.startRenderLoop();
    
    // Initialize plugins
    this.initializePlugins();
    
    this.isRunning = true;
    
    // Show startup notification
    setTimeout(() => {
      EnderTrack.UI.showNotification('EnderTrack initialisé avec succès !', 'success');
    }, 500);
  }

  static initializeSubsystems() {
    // Initialize UI components
    if (EnderTrack.UI.Tabs) {
      EnderTrack.UI.Tabs.init();
    }
    
    // Initialize navigation system
    if (EnderTrack.Navigation) {
      EnderTrack.Navigation.init();
    }
    
    // Initialize Z visualization - force visible
    if (EnderTrack.ZVisualization) {
      EnderTrack.ZVisualization.init();
      // Force Z panel visible after init
      setTimeout(() => {
        const zPanel = document.querySelector('.z-visualization-panel');
        if (zPanel) {
          zPanel.style.display = 'flex';
        }
      }, 100);
    }
    
    // Initialize Enderscope connection
    if (EnderTrack.Enderscope) {
      EnderTrack.Enderscope.init();
    }
  }

  static setupGlobalEvents() {
    // Blocage clavier en mode urgence
    window.addEventListener('keydown', (e) => {
      const state = EnderTrack.State?.get();
      if (state?.emergencyStopActive) {
        // Bloquer TOUTES les touches en mode urgence
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);
    
    // State changes trigger renders
    EnderTrack.Events.on('state:changed', (newState, oldState) => {
      this.onStateChanged(newState, oldState);
    });
    
    // Movement events
    EnderTrack.Events.on('movement:started', (movement) => {
      this.onMovementStarted(movement);
    });
    
    EnderTrack.Events.on('movement:completed', (result) => {
      this.onMovementCompleted(result);
    });
    
    // Error handling
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.handleUnhandledRejection(event);
    });
  }

  static setupUIHandlers() {

    
    // Speed slider
    const speedSlider = document.getElementById('moveSpeed');
    const speedValue = document.getElementById('speedValue');
    
    if (speedSlider && speedValue) {
      speedSlider.addEventListener('input', (e) => {
        const speed = parseInt(e.target.value);
        speedValue.textContent = speed;
        EnderTrack.Movement.setSpeed(speed);
      });
    }
    
    // Sensitivity sliders
    this.setupSensitivitySliders();
    
    // Settings checkboxes
    this.setupSettingsHandlers();
    

  }

  static setupSensitivitySliders() {
    const axes = ['X', 'Y', 'Z'];
    
    axes.forEach(axis => {
      const slider = document.getElementById(`sensitivity${axis}`);
      const input = document.getElementById(`sensitivity${axis}Input`);
      
      if (slider && input) {
        // Sync slider and input
        slider.addEventListener('input', (e) => {
          const value = parseFloat(e.target.value);
          input.value = value;
          EnderTrack.State.update({ [`sensitivity${axis}`]: value });
        });
        
        input.addEventListener('input', (e) => {
          const value = parseFloat(e.target.value);
          if (!isNaN(value) && value >= 0.01) {
            slider.value = value;
            EnderTrack.State.update({ [`sensitivity${axis}`]: value });
          }
        });
      }
    });
  }

  static setupSettingsHandlers() {
    // Map size
    const mapSizeInput = document.getElementById('mapSize');
    if (mapSizeInput) {
      mapSizeInput.addEventListener('change', (e) => {
        const size = parseInt(e.target.value);
        if (size >= 50 && size <= 1000) {
          EnderTrack.State.update({ mapSizeMm: size });
        }
      });
    }
    
    // Show grid checkbox
    const showGridCheckbox = document.getElementById('showGrid');
    if (showGridCheckbox) {
      showGridCheckbox.addEventListener('change', (e) => {
        EnderTrack.State.update({ showGrid: e.target.checked });
      });
    }
    
    // Show track checkbox
    const showTrackCheckbox = document.getElementById('showTrack');
    if (showTrackCheckbox) {
      showTrackCheckbox.addEventListener('change', (e) => {
        EnderTrack.State.update({ showNavigationTrack: e.target.checked });
      });
    }
  }

  static startRenderLoop() {
    // The render loop is handled by the Canvas manager
    // This just ensures it's running
    if (EnderTrack.Canvas) {
      EnderTrack.Canvas.requestRender();
    }
  }

  static async initializePlugins() {
    if (!EnderTrack.PluginManager) return;
    EnderTrack.PluginManager.init();
    EnderTrack.PluginManager.renderPluginList();
  }

  // Event handlers
  static onStateChanged(newState, oldState) {
    // Update UI elements that depend on state
    this.updateUIFromState(newState, oldState);
    
    // Request canvas render
    if (EnderTrack.Canvas) {
      EnderTrack.Canvas.requestRender();
    }
  }

  static updateUIFromState(newState, oldState) {
    // Update position display
    const posLabel = document.getElementById('posLabel');
    if (posLabel) {
      posLabel.textContent = `X:${newState.pos.x.toFixed(1)} Y:${newState.pos.y.toFixed(1)} Z:${newState.pos.z.toFixed(1)}`;
    }
    
    // Update individual position displays
    const posX = document.getElementById('posX');
    const posY = document.getElementById('posY');
    const posZ = document.getElementById('posZ');
    
    if (posX) posX.textContent = newState.pos.x.toFixed(1);
    if (posY) posY.textContent = newState.pos.y.toFixed(1);
    if (posZ) posZ.textContent = newState.pos.z.toFixed(1);
    
    // Update status light
    const statusLight = document.getElementById('statusLight');
    if (statusLight) {
      statusLight.className = 'status-light';
      if (newState.isMoving) {
        statusLight.classList.add('moving');
      } else {
        statusLight.classList.add('ready');
      }
    }
    

    
    // Update history table
    if (newState.positionHistory !== oldState.positionHistory) {
      this.updateHistoryTable(newState.positionHistory);
    }
  }



  static updateHistoryTable(history) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Show last 10 entries
    const recentHistory = history.slice(-10);
    
    recentHistory.forEach(entry => {
      const row = document.createElement('tr');
      const time = new Date(entry.timestamp).toLocaleTimeString();
      
      row.innerHTML = `
        <td>${time}</td>
        <td>${entry.x.toFixed(1)}</td>
        <td>${entry.y.toFixed(1)}</td>
        <td>${entry.z.toFixed(1)}</td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Update point count
    const pointCount = document.getElementById('pointCount');
    if (pointCount) {
      pointCount.textContent = history.length;
    }
  }

  static onMovementStarted(movement) {
    // Update UI to show movement in progress
    const statusLight = document.getElementById('statusLight');
    if (statusLight) {
      statusLight.className = 'status-light moving';
    }
  }

  static onMovementCompleted(result) {
    // Update UI to show movement complete
    const statusLight = document.getElementById('statusLight');
    if (statusLight) {
      statusLight.className = 'status-light ready';
    }
    
    // Show notification if movement failed
    if (!result.success) {
      EnderTrack.UI.showNotification('Mouvement interrompu', 'warning');
    }
  }

  // Emergency stop functionality
  static emergencyStop() {
    const state = EnderTrack.State?.get();
    
    if (state?.emergencyStopActive) {
      // Confirmation avant désactivation
      if (confirm('⚠️ Êtes-vous sûr de vouloir réactiver le système ?\n\nCette action va débloquer tous les mouvements.')) {
        this.resetEmergencyMode();
      }
    } else {
      // Sauvegarde automatique avant arrêt d'urgence
      this.saveEmergencyState();
      
      // Activer le mode d'urgence (premier clic)
      if (EnderTrack.Movement) {
        EnderTrack.Movement.emergencyStopMovement();
      }
      
      this.activateEmergencyMode();
      EnderTrack.UI.showNotification('Arrêt d\'urgence activé !', 'error');
    }
  }
  
  static activateEmergencyMode() {
    // Bouton enfoncé
    const emergencyBtn = document.getElementById('emergencyStop');
    if (emergencyBtn) {
      emergencyBtn.classList.add('emergency-active');
    }
    
    // Activer le mode d'urgence sur l'app container
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.classList.add('emergency-mode');
    }
    
    const statusTitle = document.getElementById('mainStatusLabel');
    if (statusTitle) {
      statusTitle.textContent = '🛑 ÉTAT ACTUEL - EMERGENCY STOP';
    }
    
    // Mettre à jour l'état
    if (EnderTrack.State) {
      EnderTrack.State.update({ emergencyStopActive: true });
    }
  }
  

  
  static resetEmergencyMode() {
    // Reset l'état d'urgence
    if (EnderTrack.State) {
      EnderTrack.State.update({ emergencyStopActive: false });
    }
    if (EnderTrack.Movement) {
      EnderTrack.Movement.emergencyStop = false;
    }
    
    // Désactiver le mode d'urgence
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.classList.remove('emergency-mode');
    }
    
    // Reset bouton
    const emergencyBtn = document.getElementById('emergencyStop');
    if (emergencyBtn) {
      emergencyBtn.classList.remove('emergency-active');
    }
    
    // Restaurer le titre normal via Enderscope indicator
    if (EnderTrack.Enderscope) {
      EnderTrack.Enderscope.updateMainModeIndicator();
    }
    
    // Envoyer M999 si connecté
    if (EnderTrack.Enderscope?.isConnected) {
      resetEnderscope();
    }
    
    EnderTrack.UI.showNotification('Système débloqué', 'success');
  }
  
  // Sauvegarde d'urgence
  static saveEmergencyState() {
    try {
      const currentState = EnderTrack.State?.get();
      if (currentState) {
        const emergencyBackup = {
          timestamp: new Date().toISOString(),
          position: { ...currentState.pos },
          settings: {
            sensitivityX: currentState.sensitivityX,
            sensitivityY: currentState.sensitivityY,
            sensitivityZ: currentState.sensitivityZ,
            inputMode: currentState.inputMode
          },
          reason: 'emergency_stop'
        };
        
        localStorage.setItem('endertrack_emergency_backup', JSON.stringify(emergencyBackup));
      }
    } catch (error) {
      console.warn('Erreur sauvegarde d\'urgence:', error);
    }
  }

  // Error handling
  static handleGlobalError(event) {
    console.error('Global error:', event.error);
    
    const errorMessage = event.error?.message || 'Unknown error';
    
    // Show user-friendly error
    if (EnderTrack.UI && EnderTrack.UI.showNotification) {
      EnderTrack.UI.showNotification(`Erreur: ${errorMessage}`, 'error');
    }
    
    // Log detailed error for debugging
    this.logError('Global Error', event.error);
  }

  static handleUnhandledRejection(event) {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Show user-friendly error
    if (EnderTrack.UI && EnderTrack.UI.showNotification) {
      EnderTrack.UI.showNotification('Erreur de traitement asynchrone', 'error');
    }
    
    // Log detailed error
    this.logError('Unhandled Rejection', event.reason);
    
    // Prevent default browser behavior
    event.preventDefault();
  }

  static logError(type, error) {
    const errorLog = {
      type,
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // Store in localStorage for debugging
    try {
      const existingLogs = JSON.parse(localStorage.getItem('endertrack_errors') || '[]');
      existingLogs.push(errorLog);
      
      // Keep only last 50 errors
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
      }
      
      localStorage.setItem('endertrack_errors', JSON.stringify(existingLogs));
    } catch (e) {
      console.warn('Failed to store error log:', e);
    }
  }

  // Application info and debugging
  static getInfo() {
    return {
      version: this.version,
      buildDate: this.buildDate,
      isRunning: this.isRunning,
      isInitialized: this.isInitialized,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
  }

  static getDebugInfo() {
    const info = {
      app: this.getInfo(),
      state: EnderTrack.State?.debug(),
      canvas: EnderTrack.Canvas?.getDebugInfo(),
      movement: EnderTrack.Movement?.getStatistics(),
      tabs: EnderTrack.UI?.Tabs?.getDebugInfo()
    };
    
    return info;
  }

  // Cleanup and shutdown
  static shutdown() {

    
    // Stop all movements
    if (EnderTrack.Movement) {
      EnderTrack.Movement.emergencyStopMovement();
    }
    
    // Save state
    if (EnderTrack.State && EnderTrack.State.saveState) {
      EnderTrack.State.saveState();
    }
    
    this.isRunning = false;

  }
}

// Global instance and registration
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.App = EnderTrackApp;

// Expose emergency stop globally
window.emergencyStop = () => EnderTrackApp.emergencyStop();

// Auto-shutdown on page unload
window.addEventListener('beforeunload', () => {
  EnderTrackApp.shutdown();
});