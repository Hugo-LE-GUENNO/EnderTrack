// modules/ui/auto-save-config.js - Auto-sauvegarde des configurations

(function() {
  'use strict';
  
  // Attendre que le DOM soit prêt
  function initAutoSave() {
    // Liste des IDs des inputs de configuration à surveiller
    const configInputs = [
      // Dimensions plateau
      'plateauX', 'plateauY', 'plateauZ',
      // Plages coordonnées
      'xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax',
      // Limites sécurité
      'xLimitMin', 'xLimitMax', 'yLimitMin', 'yLimitMax', 'zLimitMin', 'zLimitMax',
      // Facteurs sensibilité
      'xFineFactor', 'xCoarseFactor', 'yFineFactor', 'yCoarseFactor', 'zFineFactor', 'zCoarseFactor',
      // Positions HOME
      'homeXY_X', 'homeXY_Y', 'homeXYZ_X', 'homeXYZ_Y', 'homeXYZ_Z',
      // Personnalisation
      'profileSelector', 'themeSelector', 'languageSelector', 'scaleBarMultiplierSelect',
      // Feedrate
      'feedrateSlider', 'feedrateInput'
    ];
    
    // Ajouter les listeners sur tous les inputs
    configInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        // Écouter les changements
        input.addEventListener('change', () => {
          // Mettre à jour l'état immédiatement pour les limites de sécurité
          if (id.includes('Limit')) {
            updateSafetyLimitsInState();
          }
          scheduleAutoSave();
        });
        
        // Pour les inputs numériques, aussi écouter input
        if (input.type === 'number') {
          input.addEventListener('input', () => {
            if (id.includes('Limit')) {
              updateSafetyLimitsInState();
            }
            scheduleAutoSave();
          });
        }
      }
    });
    
    // Écouter les checkboxes de limites
    ['showXLimit', 'showYLimit', 'showZLimit'].forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          scheduleAutoSave();
        });
      }
    });
    
  }
  
  function updateSafetyLimitsInState() {
    if (!window.EnderTrack?.State) return;
    
    const xMin = parseFloat(document.getElementById('xLimitMin')?.value);
    const xMax = parseFloat(document.getElementById('xLimitMax')?.value);
    const yMin = parseFloat(document.getElementById('yLimitMin')?.value);
    const yMax = parseFloat(document.getElementById('yLimitMax')?.value);
    const zMin = parseFloat(document.getElementById('zLimitMin')?.value);
    const zMax = parseFloat(document.getElementById('zLimitMax')?.value);
    
    if (!isNaN(xMin) && !isNaN(xMax) && !isNaN(yMin) && !isNaN(yMax) && !isNaN(zMin) && !isNaN(zMax)) {
      window.EnderTrack.State.update({
        safetyLimits: {
          x: { min: xMin, max: xMax },
          y: { min: yMin, max: yMax },
          z: { min: zMin, max: zMax }
        }
      });
      
      // Mettre à jour aussi StrategicPositions
      if (window.EnderTrack?.StrategicPositions) {
        const sp = window.EnderTrack.StrategicPositions;
        sp.limits.xMin = xMin;
        sp.limits.xMax = xMax;
        sp.limits.yMin = yMin;
        sp.limits.yMax = yMax;
        sp.limits.zMin = zMin;
        sp.limits.zMax = zMax;
        
        // Forcer le rendu pour afficher les limites
        sp.requestCanvasRender();
      }
      
      // Actualiser la vue Z
      if (window.EnderTrack?.ZVisualization?.render) {
        window.EnderTrack.ZVisualization.render();
      }
    }
  }
  
  let autoSaveTimeout = null;
  
  function scheduleAutoSave() {
    // Débounce: attendre 1 seconde après le dernier changement
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    
    autoSaveTimeout = setTimeout(() => {
      saveStageConfig();
      if (window.EnderTrack?.Persistence?.saveState) {
        window.EnderTrack.Persistence.saveState();
      }
    }, 1000);
  }
  
  function saveStageConfig() {
    const state = window.EnderTrack?.State?.get?.();
    if (!state) return;
    
    // Sauvegarder dimensions plateau
    if (state.plateauDimensions) {
      localStorage.setItem('endertrack_plateau_dimensions_enabled', 'true');
      localStorage.setItem('endertrack_plateau_dimensions', JSON.stringify(state.plateauDimensions));
    }
    
    // Sauvegarder coordonnées
    if (state.coordinateBounds) {
      localStorage.setItem('endertrack_coordinate_bounds_enabled', 'true');
      localStorage.setItem('endertrack_coordinate_bounds', JSON.stringify(state.coordinateBounds));
    }
    
    // Sauvegarder orientation axes
    if (state.axisOrientation) {
      localStorage.setItem('endertrack_axis_orientation_enabled', 'true');
      localStorage.setItem('endertrack_axis_orientation', JSON.stringify(state.axisOrientation));
    }
    
    // Sauvegarder limites sécurité
    if (state.safetyLimits) {
      localStorage.setItem('endertrack_safety_limits_enabled', 'true');
      localStorage.setItem('endertrack_safety_limits', JSON.stringify(state.safetyLimits));
    }
    
    // Sauvegarder feedrate
    if (state.feedrate) {
      localStorage.setItem('endertrack_feedrate', String(state.feedrate));
    }
  }
  
  // Initialiser quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initAutoSave, 500);
    });
  } else {
    setTimeout(initAutoSave, 500);
  }
  
})();
