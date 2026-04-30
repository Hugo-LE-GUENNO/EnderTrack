// main.js - Ultra-minimal bootstrap entry point
// EnderTrack 3D Position Simulator

// Force Z panel visibility - Execute immediately
(function() {
  'use strict';
  

  
  function forceZPanelVisible() {
    const zPanel = document.querySelector('.z-visualization-panel');
    if (zPanel) {
      zPanel.style.display = 'flex';
      zPanel.style.visibility = 'visible';
      zPanel.classList.remove('hidden');
      zPanel.removeAttribute('hidden');
      

      return true;
    }
    return false;
  }
  
  // Try immediately
  if (forceZPanelVisible()) {

  } else {

  }
  
  // Try every 100ms for 5 seconds
  let attempts = 0;
  const maxAttempts = 50;
  
  const interval = setInterval(() => {
    attempts++;
    
    if (forceZPanelVisible()) {

      clearInterval(interval);
    } else if (attempts >= maxAttempts) {

      clearInterval(interval);
    }
  }, 100);
  
  // Also try on DOM events
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceZPanelVisible);
  }
  
  window.addEventListener('load', forceZPanelVisible);
  
  // Export function globally for debugging
  window.forceZPanelVisible = forceZPanelVisible;
  
})();

class EnderTrackBootstrap {
  static async init() {
    const startTime = performance.now();
    
    try {
      // Start performance monitoring if available
      if (EnderTrack.Performance) {
        EnderTrack.Performance.startMonitoring();
      }
      
      // Initialize core systems in optimized order
      await EnderTrackBootstrap.initializeCore();
      await EnderTrackBootstrap.initializeUI();
      await EnderTrackBootstrap.initializeModules();
      
      // Start application
      EnderTrack.App.start();
      
      // Apply initial zoom after everything is ready
      setTimeout(() => {
        if (EnderTrack.State?.applyInitialZoom) {
          EnderTrack.State.applyInitialZoom();
        }
        
        // Wait longer to ensure all initialization is complete
        setTimeout(() => {
          const loadingScreen = document.getElementById('loadingScreen');
          const appContainer = document.getElementById('appContainer');
          
          if (loadingScreen) loadingScreen.style.display = 'none';
          if (appContainer) appContainer.style.visibility = 'visible';
        }, 800);
      }, 300);
      
      const endTime = performance.now();
      const initTime = Math.round(endTime - startTime);
      

      EnderTrack.UI.showNotification(`EnderTrack prêt ! (${initTime}ms)`, 'success');
      
    } catch (error) {

      EnderTrackBootstrap.handleInitError(error);
    }
  }
  
  static async initializeCore() {
    // Theme system first (critical for UI)
    if (EnderTrack.ThemeManager?.init) {
      await EnderTrack.ThemeManager.init();
    }
    
    // State management (critical)
    await EnderTrack.State.init();
    
    // Canvas system (critical for visualization)
    if (!EnderTrack.Canvas) {
      throw new Error('Canvas module not loaded');
    }
    await EnderTrack.Canvas.init('mapCanvas');
    
    // Initialize viewport manager (handles layout + source assignment)
    if (EnderTrack.ViewportManager) {
      EnderTrack.ViewportManager.init();
    } else {
      // Fallback: show stage widget directly
      const stageContainer = document.getElementById('widget-stage');
      if (stageContainer) stageContainer.style.display = '';
    }
    
    // Force canvas resize after display
    setTimeout(() => {
      if (EnderTrack.Canvas?.handleResize) EnderTrack.Canvas.handleResize();
    }, 100);
  }
  
  static async initializeUI() {
    // UI system
    await EnderTrack.UI.init();
    
    // Canvas interactions
    const canvas = document.getElementById('mapCanvas');
    if (canvas && EnderTrack.CanvasInteractions) {
      await EnderTrack.CanvasInteractions.init(canvas);
    }
    
    // Initialize Z visualization - CRITICAL for Z wheel events
    if (EnderTrack.ZVisualization) {
      // console.log('🎯 Initializing Z Visualization...');
      const zInitResult = await EnderTrack.ZVisualization.init();
      // console.log('🎯 Z Visualization init result:', zInitResult);
      
      // Force Z panel visible after init
      setTimeout(() => {
        const zPanel = document.querySelector('.z-visualization-panel');
        if (zPanel) {
          zPanel.style.display = 'flex';
          zPanel.style.visibility = 'visible';
          // console.log('🎯 Z panel forced visible');
        }
      }, 100);
    }
    
    // Initialize default UI state
    EnderTrackBootstrap.initializeDefaultState();
  }

  static initializeDefaultState() {
    // Ensure navigation tab and relative mode are active
    setTimeout(() => {
      // Ensure keyboard-mode is not applied by mistake
      const relativeControls = document.getElementById('relativeControls');
      if (relativeControls) {
        relativeControls.classList.remove('keyboard-mode');
      }
      
      // Ensure Lists is deactivated by default
      if (window.EnderTrack?.Lists?.isActive) {
        window.EnderTrack.Lists.deactivate();
      }
      
      // Activate navigation tab
      const navTab = document.getElementById('navigationTab');
      if (navTab && !navTab.classList.contains('active')) {
        if (typeof switchTab === 'function') {
          switchTab('navigation');
        }
      }
      
      // Activate relative mode
      const relativeTab = document.getElementById('relativeTab');
      if (relativeTab && !relativeTab.classList.contains('active')) {
        if (typeof setInputMode === 'function') {
          setInputMode('relative');
        }
      }
      
      // Ensure overlays are enabled by default
      const showFutureXY = document.getElementById('showFuturePositionsXY');
      if (showFutureXY) {
        showFutureXY.checked = true;
      }
      
      const showFutureZ = document.getElementById('showFuturePositionsZ');
      if (showFutureZ) {
        showFutureZ.checked = true;
      }
      
      // Force canvas render to show navigation overlays
      setTimeout(() => {
        if (window.EnderTrack?.Canvas?.requestRender) {
          window.EnderTrack.Canvas.requestRender();
        }
      }, 100);
    }, 200);
  }
  
  static syncUIWithState() {
    const state = EnderTrack.State.get();
    
    // Synchroniser les dimensions du plateau
    if (state.plateauDimensions) {
      const plateauX = document.getElementById('plateauX');
      const plateauY = document.getElementById('plateauY');
      const plateauZ = document.getElementById('plateauZ');
      
      if (plateauX) plateauX.value = state.plateauDimensions.x;
      if (plateauY) plateauY.value = state.plateauDimensions.y;
      if (plateauZ) plateauZ.value = state.plateauDimensions.z;
      
      // Mettre à jour l'affichage des dimensions
      const platformSize = document.getElementById('platformSize');
      if (platformSize) {
        platformSize.textContent = `${state.plateauDimensions.x}×${state.plateauDimensions.y}×${state.plateauDimensions.z}mm`;
      }
    }
    
    // Synchroniser les plages de coordonnées
    if (state.coordinateBounds) {
      const xMin = document.getElementById('xMin');
      const xMax = document.getElementById('xMax');
      const yMin = document.getElementById('yMin');
      const yMax = document.getElementById('yMax');
      const zMin = document.getElementById('zMin');
      const zMax = document.getElementById('zMax');
      
      if (xMin && state.coordinateBounds.x) xMin.value = state.coordinateBounds.x.min;
      if (xMax && state.coordinateBounds.x) xMax.value = state.coordinateBounds.x.max;
      if (yMin && state.coordinateBounds.y) yMin.value = state.coordinateBounds.y.min;
      if (yMax && state.coordinateBounds.y) yMax.value = state.coordinateBounds.y.max;
      if (zMin && state.coordinateBounds.z) zMin.value = state.coordinateBounds.z.min;
      if (zMax && state.coordinateBounds.z) zMax.value = state.coordinateBounds.z.max;
    }
    
    // Synchroniser les limites de sécurité avec priorités
    // Priorité 1: localStorage (state.safetyLimits)
    // Priorité 2: Fonction resetLimitsToPlateauSize (copie des coordinateBounds)
    // Priorité 3: Valeurs par défaut HTML
    
    if (state.safetyLimits) {
      // Priorité 1: Restaurer depuis localStorage
      const xLimitMin = document.getElementById('xLimitMin');
      const xLimitMax = document.getElementById('xLimitMax');
      const yLimitMin = document.getElementById('yLimitMin');
      const yLimitMax = document.getElementById('yLimitMax');
      const zLimitMin = document.getElementById('zLimitMin');
      const zLimitMax = document.getElementById('zLimitMax');
      
      if (xLimitMin && state.safetyLimits.x) xLimitMin.value = state.safetyLimits.x.min;
      if (xLimitMax && state.safetyLimits.x) xLimitMax.value = state.safetyLimits.x.max;
      if (yLimitMin && state.safetyLimits.y) yLimitMin.value = state.safetyLimits.y.min;
      if (yLimitMax && state.safetyLimits.y) yLimitMax.value = state.safetyLimits.y.max;
      if (zLimitMin && state.safetyLimits.z) zLimitMin.value = state.safetyLimits.z.min;
      if (zLimitMax && state.safetyLimits.z) zLimitMax.value = state.safetyLimits.z.max;
      
      // Mettre à jour les valeurs internes de StrategicPositions
      if (window.EnderTrack?.StrategicPositions) {
        const sp = window.EnderTrack.StrategicPositions;
        sp.limits.xMin = state.safetyLimits.x.min;
        sp.limits.xMax = state.safetyLimits.x.max;
        sp.limits.yMin = state.safetyLimits.y.min;
        sp.limits.yMax = state.safetyLimits.y.max;
        sp.limits.zMin = state.safetyLimits.z.min;
        sp.limits.zMax = state.safetyLimits.z.max;
      }
    } else if (state.coordinateBounds) {
      // Priorité 2: Initialiser avec les plages de coordonnées
      setTimeout(() => {
        if (window.resetLimitsToPlateauSize) {
          window.resetLimitsToPlateauSize();
        }
      }, 200);
    }
    // Sinon: Priorité 3 = valeurs par défaut HTML (0-150, 0-150, 0-200)
    
    // Synchroniser l'orientation des axes
    if (state.axisOrientation) {
      document.querySelectorAll('.axis-btn[data-x]').forEach(btn => {
        btn.classList.remove('active');
      });
      const targetBtn = document.querySelector(`[data-x="${state.axisOrientation.x}"][data-y="${state.axisOrientation.y}"]`);
      if (targetBtn) {
        targetBtn.classList.add('active');
      }
    }
    
  }
  
  static async initializeModules() {
    // Persistence system (load saved state)
    if (EnderTrack.Persistence?.init) {
      await EnderTrack.Persistence.init();
      const loaded = EnderTrack.Persistence.loadState();
      
      // Synchroniser l'interface avec l'état chargé
      if (loaded) {
        setTimeout(() => {
          EnderTrackBootstrap.syncUIWithState();
        }, 100);
      }
    }
    
    // Navigation system
    if (EnderTrack.Navigation?.init) {
      await EnderTrack.Navigation.init();
    }
    
    // Strategic Positions module
    if (EnderTrack.StrategicPositions?.init) {
      await EnderTrack.StrategicPositions.init();
    }
    
    // Acquisition module
    if (window.AcquisitionModule?.init) {
      await window.AcquisitionModule.init();
    }
    
    // Double-check Z visualization is working
    setTimeout(() => {
      if (EnderTrack.ZVisualization?.isInitialized) {
        // console.log('✅ Z Visualization confirmed initialized');
      } else {
        console.warn('⚠️ Z Visualization not initialized, attempting manual init...');
        if (EnderTrack.ZVisualization?.init) {
          EnderTrack.ZVisualization.init();
        }
      }
    }, 500);
  }
  
  static handleInitError(error) {
    const errorMsg = error.message || 'Erreur d\'initialisation inconnue';
    
    // Try to show error in UI if available
    if (EnderTrack.UI?.showError) {
      EnderTrack.UI.showError(`Échec du démarrage: ${errorMsg}`);
    } else {
      // Fallback to alert if UI not available
      alert(`EnderTrack n'a pas pu démarrer: ${errorMsg}`);
    }
    
    // Show recovery options
    EnderTrackBootstrap.showRecoveryOptions();
  }
  
  static showRecoveryOptions() {
    const recovery = document.createElement('div');
    recovery.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #1a1a1a; color: white; padding: 20px; border-radius: 8px;
      border: 2px solid #ef4444; z-index: 10000; text-align: center;
    `;
    recovery.innerHTML = `
      <h3>🚨 Erreur de Démarrage</h3>
      <p>EnderTrack n'a pas pu démarrer correctement.</p>
      <button onclick="location.reload()" style="margin: 5px; padding: 8px 16px;">🔄 Recharger</button>
      <button onclick="this.parentElement.remove()" style="margin: 5px; padding: 8px 16px;">❌ Fermer</button>
    `;
    document.body.appendChild(recovery);
  }
}

// Auto-start when DOM is ready with timeout protection
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.EnderTrack?.initialized) {
      window.EnderTrack = window.EnderTrack || {};
      window.EnderTrack.initialized = true;
      EnderTrackBootstrap.init();
    }
  });
} else {
  if (!window.EnderTrack?.initialized) {
    window.EnderTrack = window.EnderTrack || {};
    window.EnderTrack.initialized = true;
    EnderTrackBootstrap.init();
  }
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message || 'Unknown error');
  if (window.EnderTrack && window.EnderTrack.UI) {
    const errorMsg = event.error?.message || event.message || 'Erreur système inconnue';
    EnderTrack.UI.showNotification('Erreur système: ' + errorMsg, 'error');
  }
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  if (window.EnderTrack && window.EnderTrack.UI) {
    EnderTrack.UI.showNotification('Erreur asynchrone: ' + (event.reason?.message || 'Erreur inconnue'), 'error');
  }
  event.preventDefault();
});

// Global functions for HTML onclick handlers
window.switchTab = (tabId) => {
  // === STEP 1: RESET ALL (except locked overlays) ===
  
  // Deactivate all modules
  if (window.EnderTrack?.Overlays?.isActive) {
    window.EnderTrack.Overlays.deactivate();
  }
  if (window.EnderTrack?.Lists?.isActive) {
    window.EnderTrack.Lists.deactivate();
  }
  if (window.EnderTrack?.Scenario?.isActive && !window.EnderTrack.Scenario.isExecuting) {
    window.EnderTrack.Scenario.deactivate();
  }
  
  // Reset canvas
  const canvas = window.EnderTrack?.Canvas?.getCanvas();
  if (canvas) {
    canvas.style.cursor = '';
    canvas.classList.remove('scenario-mode');
  }
  
  // Reset click-and-go
  if (window.EnderTrack?.Canvas) {
    window.EnderTrack.Canvas.clickAndGoEnabled = false;
  }
  
  // Hide all overlays
  const compassOverlay = document.getElementById('compassOverlay');
  const compassZOverlay = document.getElementById('compassZOverlay');
  if (compassOverlay) compassOverlay.style.display = 'none';
  if (compassZOverlay) compassZOverlay.style.display = 'none';
  
  // === STEP 2: SWITCH TAB UI ===
  
  EnderTrack.State?.update?.({ activeTab: tabId });
  
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
  
  const tabBtn = document.getElementById(tabId + 'Tab');
  const tabPanel = document.getElementById(tabId + 'TabContent');
  
  if (tabBtn) tabBtn.classList.add('active');
  if (tabPanel) tabPanel.classList.add('active');
  
  // === STEP 3: INIT CURSOR ===
  
  if (tabId === 'navigation' && canvas) {
    canvas.style.cursor = 'crosshair';
  }
  
  // === STEP 4: INIT TAB-SPECIFIC FUNCTIONS ===
  
  if (tabId === 'navigation') {
    if (window.EnderTrack?.Canvas) {
      window.EnderTrack.Canvas.clickAndGoEnabled = true;
    }
  } else if (tabId === 'overlays' && window.EnderTrack?.Overlays) {
    window.EnderTrack.Overlays.activate();
  } else if (tabId === 'settings') {
    // Calques are now in Configs tab
    window.EnderTrack?.Overlays?.activate?.();
    // Sync navigation config
    if (typeof updateConfigLocks === 'function') updateConfigLocks();
    // Update storage size
    const sizeLabel = document.getElementById('storageSizeLabel');
    if (sizeLabel && window.EnderTrack?.StorageManager) sizeLabel.textContent = window.EnderTrack.StorageManager.getStorageSize() + ' KB';
  } else if (tabId === 'lists' && window.EnderTrack?.Lists) {
    window.EnderTrack.Lists.activate();
    // Scenario is embedded in Positions tab
    if (window.EnderTrack?.Scenario) {
      window.EnderTrack.Scenario.activate();
    }
  } else if (tabId === 'acquisition' && window.EnderTrack?.Scenario) {
    canvas.classList.add('scenario-mode');
    window.EnderTrack.Scenario.activate();
  }
  
  // === STEP 5: INIT OVERLAYS/TRACKS ===
  
  if (tabId === 'navigation') {
    if (compassOverlay) compassOverlay.style.display = '';
    if (compassZOverlay) compassZOverlay.style.display = '';
  }
  
  // === STEP 6: RENDER ===
  
  if (window.EnderTrack?.Canvas?.requestRender) {
    window.EnderTrack.Canvas.requestRender();
  }
};

window.setInputMode = (mode) => EnderTrack.Navigation.setInputMode(mode);
window.toggleLock = (axis) => { EnderTrack.Navigation.toggleLock(axis); updateConfigLocks(); };
window.moveDirection = (direction) => EnderTrack.Navigation.moveDirection(direction);

window.updateConfigLocks = function() {
  const state = EnderTrack.State.get();
  const coupled = state.lockXY !== false;
  // Lock buttons
  ['X', 'Y', 'Z'].forEach(a => {
    const btn = document.getElementById('configLock' + a);
    if (!btn) return;
    const locked = state['lock' + a];
    btn.style.background = locked ? 'var(--active-element)' : 'var(--app-bg)';
    btn.style.color = locked ? 'var(--text-selected)' : 'var(--text-general)';
    btn.textContent = (locked ? '\u{1F512} ' : '') + a;
  });
  // Coupling button
  const coupleBtn = document.getElementById('configCoupleXY');
  if (coupleBtn) {
    coupleBtn.style.background = coupled ? 'var(--active-element)' : 'var(--app-bg)';
    coupleBtn.style.color = coupled ? 'var(--text-selected)' : 'var(--text-general)';
    coupleBtn.textContent = coupled ? '\u{1F517} XY coupl\u00e9s' : '\u{1F517} Coupler XY';
  }
};

window.updateHomePosition = function(mode) {
  if (mode === 'xy') {
    const x = parseFloat(document.getElementById('homeXY_X')?.value) || 0;
    const y = parseFloat(document.getElementById('homeXY_Y')?.value) || 0;
    const hp = { ...EnderTrack.State.get().homePositions, xy: { x, y } };
    EnderTrack.State.update({ homePositions: hp });
  } else {
    const x = parseFloat(document.getElementById('homeXYZ_X')?.value) || 0;
    const y = parseFloat(document.getElementById('homeXYZ_Y')?.value) || 0;
    const z = parseFloat(document.getElementById('homeXYZ_Z')?.value) || 0;
    const hp = { ...EnderTrack.State.get().homePositions, xyz: { x, y, z } };
    EnderTrack.State.update({ homePositions: hp });
  }
};
window.goHome = (mode) => EnderTrack.Navigation.goHome(mode);

window.showHomeContextMenu = function(event) {
  const existing = document.querySelector('.home-context-menu');
  if (existing) existing.remove();
  
  const menu = document.createElement('div');
  menu.className = 'home-context-menu';
  menu.style.cssText = `position:fixed; left:${event.clientX}px; top:${event.clientY}px; z-index:10000; background:var(--container-bg); border:1px solid #666; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.4); overflow:hidden; min-width:140px;`;
  
  const items = [
    { label: '🏠 Home XY', action: () => goHome('xy') },
    { label: '🏠 Home XYZ', action: () => goHome('xyz') }
  ];
  
  items.forEach(item => {
    const el = document.createElement('div');
    el.textContent = item.label;
    el.style.cssText = 'padding:8px 14px; cursor:pointer; font-size:12px; color:var(--text-general); transition:background 0.15s;';
    el.onmouseenter = () => { el.style.background = 'var(--active-element)'; el.style.color = 'var(--text-selected)'; };
    el.onmouseleave = () => { el.style.background = ''; el.style.color = 'var(--text-general)'; };
    el.onclick = () => { item.action(); menu.remove(); };
    menu.appendChild(el);
  });
  
  document.body.appendChild(menu);
  
  const close = (e) => {
    if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
};
window.setPreset = (preset) => EnderTrack.Navigation.setPreset(preset);
window.goToAbsolute = () => EnderTrack.Navigation.goToAbsolute();
window.emergencyStop = () => EnderTrack.App.emergencyStop();

// Status updater with hierarchy
(function() {
  let previousStageConnected = false;
  let wasEverConnected = false;

  function updateStatus() {
    const enderscope = window.EnderTrack?.Enderscope;
    const serverUrl = enderscope?.serverUrl || window.ENDERTRACK_SERVER || 'http://localhost:5000';
    const urlShort = serverUrl.replace('http://', '').replace('https://', '');

    const light = document.getElementById('statusMainLight');
    const label = document.getElementById('statusMainLabel');
    const deviceRow = document.getElementById('statusDeviceRow');
    const deviceInfo = document.getElementById('statusDeviceInfo');
    const stageLight = document.getElementById('stageStatusLight');
    const coordColor = (c) => ['statusPosX', 'statusPosY', 'statusPosZ'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.color = c;
    });

    fetch(serverUrl + '/api/status', { method: 'GET', signal: AbortSignal.timeout(2000) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(status => {
        // Server is always OK here
        if (light) { light.style.background = 'var(--success)'; light.style.boxShadow = '0 0 6px var(--success)'; }
        if (label) label.textContent = 'Serveur ' + urlShort;

        if (status.connected) {
          // Stage connected
          if (light) { light.style.background = 'var(--success)'; light.style.boxShadow = '0 0 6px var(--success)'; }
          if (label) label.textContent = 'Serveur ' + urlShort;
          coordColor('var(--text-selected)');
          previousStageConnected = true;
          wasEverConnected = true;
          // Show device row only when M115 info is ready
          if (enderscope?.deviceInfoReady !== false) {
            if (stageLight) { stageLight.style.background = 'var(--success)'; stageLight.style.boxShadow = '0 0 4px var(--success)'; stageLight.style.animation = ''; }
            if (deviceRow) deviceRow.style.display = 'flex';
            if (deviceInfo) {
              const name = enderscope?.deviceName || status.printer_name || 'Support XYZ';
              deviceInfo.textContent = name + ' \u2014 ' + (status.port || 'USB');
            }
          }
        } else if (wasEverConnected) {
          // Was connected before, now lost → red blink stays
          if (stageLight) { stageLight.style.background = 'var(--danger)'; stageLight.style.boxShadow = '0 0 6px var(--danger)'; stageLight.style.animation = 'statusBlink 1s ease-in-out infinite'; }
          if (deviceRow) deviceRow.style.display = 'flex';
          if (deviceInfo) deviceInfo.textContent = 'Support XYZ d\u00e9connect\u00e9';
          coordColor('var(--coordinates-color)');
          previousStageConnected = false;
        } else {
          // Server up, never had stage → orange
          if (stageLight) { stageLight.style.background = 'var(--coordinates-color)'; stageLight.style.boxShadow = '0 0 4px var(--coordinates-color)'; stageLight.style.animation = ''; }
          if (deviceRow) deviceRow.style.display = 'flex';
          if (deviceInfo) deviceInfo.textContent = 'Support XYZ non connect\u00e9';
          coordColor('var(--coordinates-color)');
        }
      })
      .catch(() => {
        // No server = simulator
        if (light) { light.style.background = 'var(--coordinates-color)'; light.style.boxShadow = '0 0 6px var(--coordinates-color)'; }
        if (label) label.textContent = 'Simulateur';
        if (deviceRow) deviceRow.style.display = 'none';
        coordColor('var(--coordinates-color)');
        previousStageConnected = false;
      });

    // Show plugin zone if it has children
    const pluginZone = document.getElementById('statusPluginZone');
    if (pluginZone) pluginZone.style.display = pluginZone.children.length ? '' : 'none';
  }

  setTimeout(updateStatus, 1500);
  setInterval(updateStatus, 2000);

  // Expose for instant update on connection change
  window._updateStatusNow = updateStatus;
})();
window.clearHistory = () => EnderTrack.State?.clearHistory?.();

// Global keyboard navigation with diagonal detection
(function() {
  const pressed = new Set();
  let keyTimer = null;

  function processMovement() {
    const up = pressed.has('ArrowUp'), down = pressed.has('ArrowDown');
    const left = pressed.has('ArrowLeft'), right = pressed.has('ArrowRight');
    let dir = null;
    if (up && left) dir = 'upLeft';
    else if (up && right) dir = 'upRight';
    else if (down && left) dir = 'downLeft';
    else if (down && right) dir = 'downRight';
    else if (up) dir = 'up';
    else if (down) dir = 'down';
    else if (left) dir = 'left';
    else if (right) dir = 'right';
    if (dir) {
      EnderTrack.Navigation?.moveDirection?.(dir);
      // Animate arrow button
      const btnId = dir;
      const btn = document.getElementById(btnId);
      if (btn) { btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 150); }
    }
  }

  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (window.EnderTrack?.Scenario?.isExecuting) return;

    // Z movement (immediate, no combo needed)
    if (e.key === 'PageUp') { e.preventDefault(); EnderTrack.Navigation?.moveDirection?.('zUp'); return; }
    if (e.key === 'PageDown') { e.preventDefault(); EnderTrack.Navigation?.moveDirection?.('zDown'); return; }

    // XY arrows: buffer with 50ms tempo for diagonal detection
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      pressed.add(e.key);
      if (keyTimer) clearTimeout(keyTimer);
      keyTimer = setTimeout(processMovement, 50);
    }
  });

  document.addEventListener('keyup', (e) => {
    pressed.delete(e.key);
  });
})();
window.saveTrack = () => EnderTrack.State?.saveTrack?.();
window.loadTrack = () => EnderTrack.State?.loadTrack?.();
window.toggleKeyboardMode = () => EnderTrack.KeyboardMode?.toggle();

// Module functions
window.openLists = () => {
  if (window.EnderTrack?.Lists) {
    window.EnderTrack.Lists.activate();
    switchTab('lists');
  }
};


window.showAboutModal = function() {
  const existing = document.querySelector('.about-modal-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.className = 'about-modal-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:10001; display:flex; align-items:center; justify-content:center;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.innerHTML = `
    <div style="background:var(--container-bg); border:1px solid #555; border-radius:12px; padding:28px 32px; max-width:440px; width:90%; text-align:center; box-shadow:0 8px 32px rgba(0,0,0,0.5); max-height:85vh; overflow-y:auto;">
      <img src="assets/icons/endertrack-logo_header.svg" alt="EnderTrack" style="height:48px; margin-bottom:16px;">
      <div style="font-size:14px; font-weight:600; color:var(--text-selected); margin-bottom:2px;">EnderTrack Minimal v1</div>
      <div style="font-size:9px; color:var(--text-general); margin-bottom:10px; opacity:0.5;">2025</div>
      <a href="https://github.com/Hugo-LE-GUENNO/endertrack" target="_blank" rel="noopener noreferrer"
        style="display:inline-block; padding:5px 14px; background:var(--active-element); color:var(--text-selected); border-radius:4px; text-decoration:none; font-size:11px; font-weight:500; margin-bottom:14px; transition:all 0.15s;"
        onmouseenter="this.style.background='var(--coordinates-color)'; this.style.color='#000'"
        onmouseleave="this.style.background='var(--active-element)'; this.style.color='var(--text-selected)'"
      >GitHub</a>
      <div style="font-size:11px; color:var(--text-general); margin-bottom:14px; line-height:1.6; text-align:left;">
        Interface web + serveur Python Flask pour piloter ou simuler un plateau XYZ.
        Positions, listes, automatisations et extensions.
      </div>
      <div style="font-size:11px; color:var(--text-general); margin-bottom:14px; line-height:1.6; text-align:left;">
        Connexion USB (PC ou RPi) via <a href="https://github.com/mutterer/enderscopy" target="_blank" style="color:var(--coordinates-color);">enderscope.py</a> (<a href="https://dx.doi.org/10.1016/j.softx.2025.102210" target="_blank" style="color:var(--coordinates-color);">publi</a>)
        qui envoie du G-code \u00e0 toute imprimante 3D ou stage motoris\u00e9 compatible.
        Issu du projet <a href="https://github.com/Pickering-Lab/EnderScope" target="_blank" style="color:var(--coordinates-color);">EnderScope</a> (<a href="http://doi.org/10.1098/rsta.2023.0214" target="_blank" style="color:var(--coordinates-color);">publi</a>).
        D\u2019autres versions avec des modules sp\u00e9cialis\u00e9s sur <a href="https://diy.microscopie.org/explore.html" target="_blank" style="color:var(--coordinates-color);">diy.microscopie.org</a>.
      </div>
      <div style="font-size:10px; color:var(--text-general); margin-bottom:16px; line-height:1.5; text-align:left; font-style:italic; opacity:0.7;">
        L\u2019id\u00e9e d\u2019EnderTrack a \u00e9merg\u00e9 au CNRS suite \u00e0 l\u2019\u00e9cole th\u00e9matique de microscopie MIFOBIO 2025, port\u00e9e par l\u2019EnderTeam \u2014 merci \u00e0 eux !
      </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); } });
};
window.openSequences = () => {};
window.openDrivers = () => {};
window.openEnderman = () => {};

