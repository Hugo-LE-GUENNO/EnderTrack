// modules/ui/safety-limits.js - Gestion des limites de sécurité

// Fonction pour reset les limites avec les dimensions du plateau
window.resetLimitsToPlateauSize = function() {
    
    // Lire les plages de coordonnées actuelles depuis l'état ET l'interface
    const state = window.EnderTrack?.State?.get();
    let xMin, xMax, yMin, yMax, zMin, zMax;
    
    // Priorité à l'état, puis à l'interface
    if (state?.coordinateBounds) {
        xMin = state.coordinateBounds.x.min;
        xMax = state.coordinateBounds.x.max;
        yMin = state.coordinateBounds.y.min;
        yMax = state.coordinateBounds.y.max;
        zMin = state.coordinateBounds.z.min;
        zMax = state.coordinateBounds.z.max;
    } else {
        // Fallback vers l'interface
        xMin = parseFloat(document.getElementById('xMin')?.value) || 0;
        xMax = parseFloat(document.getElementById('xMax')?.value) || 150;
        yMin = parseFloat(document.getElementById('yMin')?.value) || 0;
        yMax = parseFloat(document.getElementById('yMax')?.value) || 150;
        zMin = parseFloat(document.getElementById('zMin')?.value) || 0;
        zMax = parseFloat(document.getElementById('zMax')?.value) || 200;
    }
    
    
    // Appliquer les plages de coordonnées comme limites de sécurité
    document.getElementById('xLimitMin').value = xMin;
    document.getElementById('xLimitMax').value = xMax;
    document.getElementById('yLimitMin').value = yMin;
    document.getElementById('yLimitMax').value = yMax;
    document.getElementById('zLimitMin').value = zMin;
    document.getElementById('zLimitMax').value = zMax;
    
    // Déclencher les événements 'input' pour activer les event listeners
    ['xLimitMin', 'xLimitMax', 'yLimitMin', 'yLimitMax', 'zLimitMin', 'zLimitMax'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    
    // Mettre à jour les valeurs internes
    if (window.EnderTrack?.StrategicPositions) {
        const sp = window.EnderTrack.StrategicPositions;
        sp.limits.xMin = xMin;
        sp.limits.xMax = xMax;
        sp.limits.yMin = yMin;
        sp.limits.yMax = yMax;
        sp.limits.zMin = zMin;
        sp.limits.zMax = zMax;
        sp.limits.xShow = true;
        sp.limits.yShow = true;
        sp.limits.zShow = true;
        
        
        sp.saveSettings();
        sp.requestCanvasRender();
    }
    
    // Cocher les checkboxes
    const xCheckbox = document.getElementById('showXLimit');
    const yCheckbox = document.getElementById('showYLimit');
    const zCheckbox = document.getElementById('showZLimit');
    if (xCheckbox) xCheckbox.checked = true;
    if (yCheckbox) yCheckbox.checked = true;
    if (zCheckbox) zCheckbox.checked = true;
    
    // Actualiser les vues XY et Z
    
    // Forcer un rendu complet avec délai
    setTimeout(() => {
        if (window.EnderTrack?.Canvas?.requestRender) {
            window.EnderTrack.Canvas.requestRender();
        }
        if (window.EnderTrack?.ZVisualization?.render) {
            window.EnderTrack.ZVisualization.render();
        }
    }, 100);
    
    // Notification
    if (window.EnderTrack?.UI?.showNotification) {
        window.EnderTrack.UI.showNotification('Limites de sécurité définies selon les plages de coordonnées', 'success');
    }
    
};

// Validation des limites par rapport aux dimensions du plateau
window.validateLimitsAgainstPlateau = function() {
    const state = window.EnderTrack?.State?.get();
    let xMin, xMax, yMin, yMax, zMin, zMax;
    
    // Lire depuis l'état ou l'interface
    if (state?.coordinateBounds) {
        xMin = state.coordinateBounds.x.min;
        xMax = state.coordinateBounds.x.max;
        yMin = state.coordinateBounds.y.min;
        yMax = state.coordinateBounds.y.max;
        zMin = state.coordinateBounds.z.min;
        zMax = state.coordinateBounds.z.max;
    } else {
        xMin = parseFloat(document.getElementById('xMin')?.value) || 0;
        xMax = parseFloat(document.getElementById('xMax')?.value) || 150;
        yMin = parseFloat(document.getElementById('yMin')?.value) || 0;
        yMax = parseFloat(document.getElementById('yMax')?.value) || 150;
        zMin = parseFloat(document.getElementById('zMin')?.value) || 0;
        zMax = parseFloat(document.getElementById('zMax')?.value) || 200;
    }
    
    // Vérifier et corriger les limites X
    const xLimitMin = parseFloat(document.getElementById('xLimitMin')?.value);
    const xLimitMax = parseFloat(document.getElementById('xLimitMax')?.value);
    if (xLimitMin < xMin) document.getElementById('xLimitMin').value = xMin;
    if (xLimitMax > xMax) document.getElementById('xLimitMax').value = xMax;
    
    // Vérifier et corriger les limites Y
    const yLimitMin = parseFloat(document.getElementById('yLimitMin')?.value);
    const yLimitMax = parseFloat(document.getElementById('yLimitMax')?.value);
    if (yLimitMin < yMin) document.getElementById('yLimitMin').value = yMin;
    if (yLimitMax > yMax) document.getElementById('yLimitMax').value = yMax;
    
    // Vérifier et corriger les limites Z
    const zLimitMin = parseFloat(document.getElementById('zLimitMin')?.value);
    const zLimitMax = parseFloat(document.getElementById('zLimitMax')?.value);
    if (zLimitMin < zMin) document.getElementById('zLimitMin').value = zMin;
    if (zLimitMax > zMax) document.getElementById('zLimitMax').value = zMax;
};

// Vérifier si une position est dans les limites de sécurité
window.isPositionWithinSafetyLimits = function(x, y, z) {
    if (!window.EnderTrack?.StrategicPositions) return true;
    
    const limits = window.EnderTrack.StrategicPositions.getLimits();
    
    // Vérifier X
    if (limits.xEnabled && (x < limits.xMin || x > limits.xMax)) {
        return false;
    }
    
    // Vérifier Y
    if (limits.yEnabled && (y < limits.yMin || y > limits.yMax)) {
        return false;
    }
    
    // Vérifier Z
    if (limits.zEnabled && (z < limits.zMin || z > limits.zMax)) {
        return false;
    }
    
    return true;
};