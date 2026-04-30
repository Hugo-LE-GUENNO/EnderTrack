/**
 * UI Handlers - Externalized from index.html
 * All UI interaction functions centralized here
 */

// ============================================================================
// SCALE BAR & DISPLAY
// ============================================================================

window.updateScaleBarMultiplier = function() {
    const select = document.getElementById('scaleBarMultiplierSelect');
    if (select) {
        const multiplier = parseFloat(select.value);
        if (window.EnderTrack?.State) {
            window.EnderTrack.State.update({ scaleBarMultiplier: multiplier });
        }
        if (window.EnderTrack?.Canvas?.requestRender) {
            window.EnderTrack.Canvas.requestRender();
        }
    }
};

window.updateSnakePoints = function() {
    const slider = document.getElementById('snakePointsSlider');
    const value = document.getElementById('snakePointsValue');
    if (slider && value) {
        value.textContent = slider.value;
    }
};

// ============================================================================
// COORDINATE VALIDATION
// ============================================================================

window.validateLimitsAgainstPlateau = function() {
    // Placeholder for future validation logic
};

window.validateCoordinateRange = function(axis) {
    if (window.validatingCoordinates) return;
    window.validatingCoordinates = true;
    
    const minInput = document.getElementById(`${axis}Min`);
    const maxInput = document.getElementById(`${axis}Max`);
    const dimensionInput = document.getElementById(`plateau${axis.toUpperCase()}`);
    
    if (!minInput || !maxInput || !dimensionInput) {
        window.validatingCoordinates = false;
        return;
    }
    
    const min = parseFloat(minInput.value);
    const max = parseFloat(maxInput.value);
    const dimension = parseFloat(dimensionInput.value);
    
    if (event.target === dimensionInput) {
        validateLimitsAgainstPlateau();
        const currentMin = parseFloat(minInput.value);
        const currentMax = parseFloat(maxInput.value);
        const isZeroMode = currentMin === 0;
        const isCenteredMode = Math.abs(currentMin + currentMax) < 0.1;
        
        if (isZeroMode) {
            maxInput.value = dimension;
        } else if (isCenteredMode) {
            minInput.value = -dimension / 2;
            maxInput.value = dimension / 2;
        } else {
            minInput.value = 0;
            maxInput.value = dimension;
        }
        
        if (window.EnderTrack?.State) {
            const currentState = window.EnderTrack.State.get();
            const newPlateauDimensions = { ...currentState.plateauDimensions, [axis]: dimension };
            const newCoordinateBounds = {
                ...currentState.coordinateBounds,
                [axis]: { min: parseFloat(minInput.value), max: parseFloat(maxInput.value) }
            };
            
            window.EnderTrack.State.update({
                plateauDimensions: newPlateauDimensions,
                coordinateBounds: newCoordinateBounds
            });
            
            if (localStorage.getItem('endertrack_plateau_dimensions_enabled') === 'true') {
                localStorage.setItem('endertrack_plateau_dimensions', JSON.stringify(newPlateauDimensions));
            }
            if (localStorage.getItem('endertrack_coordinate_bounds_enabled') === 'true') {
                localStorage.setItem('endertrack_coordinate_bounds', JSON.stringify(newCoordinateBounds));
            }
            
            if (typeof resetLimitsToPlateauSize === 'function') {
                resetLimitsToPlateauSize();
            }
        }
        
        validateLimitsAgainstPlateau();
        window.validatingCoordinates = false;
        return;
    }
    
    if (!isNaN(min) && !isNaN(max) && min > max) {
        alert(`Erreur: ${axis.toUpperCase()}min (${min}) ne peut pas être supérieur à ${axis.toUpperCase()}max (${max})`);
        if (event.target === minInput) {
            minInput.value = max;
        } else {
            maxInput.value = min;
        }
        window.validatingCoordinates = false;
        return;
    }
    
    if (event.target === minInput) {
        if (min < -dimension) {
            alert(`Erreur: Min ne peut pas être inférieur à -${dimension}mm`);
            minInput.value = -dimension;
            window.validatingCoordinates = false;
            return;
        }
        if (min > 0 && axis !== 'z') {
            alert(`Erreur: Min ne peut pas être supérieur à 0 pour l'axe ${axis.toUpperCase()}`);
            minInput.value = 0;
            window.validatingCoordinates = false;
            return;
        }
        if (axis === 'z' && min > 0) {
            alert('Erreur: Zmin ne peut pas être supérieur à 0');
            minInput.value = 0;
            window.validatingCoordinates = false;
            return;
        }
        const newMax = dimension - Math.abs(parseFloat(minInput.value));
        maxInput.value = newMax;
    }
    
    if (event.target === maxInput) {
        if (max > dimension) {
            alert(`Erreur: Max ne peut pas être supérieur à ${dimension}mm`);
            maxInput.value = dimension;
            window.validatingCoordinates = false;
            return;
        }
        if (max < 0 && axis !== 'z') {
            alert(`Erreur: Max ne peut pas être inférieur à 0 pour l'axe ${axis.toUpperCase()}`);
            maxInput.value = 0;
            window.validatingCoordinates = false;
            return;
        }
        if (axis === 'z' && max < 0) {
            alert('Erreur: Zmax ne peut pas descendre en dessous de 0');
            maxInput.value = 0;
            window.validatingCoordinates = false;
            return;
        }
        const newMin = -(dimension - parseFloat(maxInput.value));
        minInput.value = newMin;
    }
    
    if (window.EnderTrack?.State) {
        const currentState = window.EnderTrack.State.get();
        const newPlateauDimensions = { ...currentState.plateauDimensions, [axis]: parseFloat(dimensionInput.value) };
        const newCoordinateBounds = {
            ...currentState.coordinateBounds,
            [axis]: { min: parseFloat(minInput.value), max: parseFloat(maxInput.value) }
        };
        
        window.EnderTrack.State.update({
            plateauDimensions: newPlateauDimensions,
            coordinateBounds: newCoordinateBounds
        });
        
        if (localStorage.getItem('endertrack_plateau_dimensions_enabled') === 'true') {
            localStorage.setItem('endertrack_plateau_dimensions', JSON.stringify(newPlateauDimensions));
        }
        if (localStorage.getItem('endertrack_coordinate_bounds_enabled') === 'true') {
            localStorage.setItem('endertrack_coordinate_bounds', JSON.stringify(newCoordinateBounds));
        }
        
        if (typeof resetLimitsToPlateauSize === 'function') {
            resetLimitsToPlateauSize();
        }
    }
    
    window.validatingCoordinates = false;
};

window.setRangePreset = function(axis, mode) {
    const dimensionInput = document.getElementById(`plateau${axis.toUpperCase()}`);
    const minInput = document.getElementById(`${axis}Min`);
    const maxInput = document.getElementById(`${axis}Max`);
    
    if (!dimensionInput || !minInput || !maxInput) return;
    
    const dimension = parseFloat(dimensionInput.value);
    
    if (mode === 'centered') {
        minInput.value = -dimension / 2;
        maxInput.value = dimension / 2;
    } else if (mode === 'positive') {
        minInput.value = 0;
        maxInput.value = dimension;
    }
    
    validateCoordinateRange(axis);
};

// ============================================================================
// AXIS ORIENTATION
// ============================================================================

window.setZOrientation = function(orientation) {
    if (window.EnderTrack?.State) {
        const currentOrientation = window.EnderTrack.State.get().axisOrientation || {};
        window.EnderTrack.State.update({ 
            axisOrientation: { ...currentOrientation, z: orientation }
        });
    }
    
    document.querySelectorAll('.axis-btn[data-z]').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.querySelector(`[data-z="${orientation}"]`);
    if (targetBtn) targetBtn.classList.add('active');
    
    if (window.EnderTrack?.Coordinates) {
        window.EnderTrack.Coordinates.updateParameters({
            axisOrientation: window.EnderTrack.State.get().axisOrientation
        });
    }
    
    if (window.EnderTrack?.ZVisualization?.render) {
        window.EnderTrack.ZVisualization.render();
    }
};

window.setAxisOrientation = function(xDir, yDir) {
    EnderTrack.State.update({
        axisOrientation: { ...EnderTrack.State.get().axisOrientation, x: xDir, y: yDir },
        panX: 0,
        panY: 0
    });
    
    if (localStorage.getItem('endertrack_axis_orientation_enabled') === 'true') {
        localStorage.setItem('endertrack_axis_orientation', JSON.stringify(EnderTrack.State.get().axisOrientation));
    }
    
    if (typeof resetLimitsToPlateauSize === 'function') {
        resetLimitsToPlateauSize();
    }
    
    document.querySelectorAll('.axis-btn[data-x]').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.querySelector(`[data-x="${xDir}"][data-y="${yDir}"]`);
    if (targetBtn) targetBtn.classList.add('active');
    
    if (window.EnderTrack?.Canvas?.updateCoordinateSystem) {
        window.EnderTrack.Canvas.updateCoordinateSystem();
    }
    
    if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
    }
};

// ============================================================================
// TAB SWITCHING
// ============================================================================

window.switchTab = function(tabId) {
    const currentActiveTab = document.querySelector('.tab-btn.active');
    const wasListsActive = currentActiveTab && currentActiveTab.id === 'listsTab';
    const wasAcquisitionActive = currentActiveTab && currentActiveTab.id === 'acquisitionTab';
    const willBeListsActive = tabId === 'lists';
    const willBeSettingsActive = tabId === 'settings';
    
    if (wasListsActive && !willBeListsActive) {
        if (window.EnderTrack?.Lists?.deactivate) {
            window.EnderTrack.Lists.deactivate();
        }
    }
    
    if (wasAcquisitionActive && tabId !== 'acquisition') {
        if (window.EnderTrack?.Scenario?.deactivate) {
            window.EnderTrack.Scenario.deactivate();
        }
    }
    
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    const targetPanel = document.getElementById(tabId + 'TabContent');
    if (targetPanel) targetPanel.classList.add('active');
    
    const targetBtn = document.getElementById(tabId + 'Tab');
    if (targetBtn) targetBtn.classList.add('active');
    
    // Gérer l'affichage du panneau droit
    const rightPanel = document.querySelector('.right-panel');
    if (rightPanel) {
        const graphsSection = rightPanel.querySelector('.graphs-section');
        const historySection = rightPanel.querySelector('.history-section');
        
        if (tabId === 'acquisition') {
            // Masquer historique et graphiques
            if (graphsSection) graphsSection.style.display = 'none';
            if (historySection) historySection.style.display = 'none';
            
            // Activer et afficher le module Scenario
            if (window.EnderTrack?.Scenario) {
                if (!window.EnderTrack.Scenario.isActive) {
                    window.EnderTrack.Scenario.activate();
                } else {
                    window.EnderTrack.Scenario.showUI();
                    window.EnderTrack.Scenario.showScenarioOutput();
                }
            }
        } else {
            // Afficher historique et graphiques
            if (graphsSection) graphsSection.style.display = 'block';
            if (historySection) historySection.style.display = 'block';
            
            // Masquer section scénario
            const scenarioOutput = document.getElementById('scenarioOutputSection');
            if (scenarioOutput) scenarioOutput.style.display = 'none';
        }
    }
    
    if (willBeListsActive) {
        if (window.EnderTrack?.Lists?.activate) {
            window.EnderTrack.Lists.activate();
        }
    }
    
    if (willBeSettingsActive) {
        const container = document.getElementById('viewportConfigContainer');
        if (container && window.ViewportConfig) {
            window.ViewportConfig.render(container);
        }
    }
    
    setTimeout(() => {
        if (window.EnderTrack?.Canvas?.requestRender) {
            window.EnderTrack.Canvas.requestRender();
        }
    }, 50);
};

window.switchDisplayTab = function(tabName) {
    document.querySelectorAll('.display-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.display-tab-content').forEach(content => content.classList.remove('active'));
    
    const tabIndex = tabName === 'interface' ? 1 : tabName === 'colors' ? 2 : 3;
    document.querySelector(`.display-tab:nth-child(${tabIndex})`).classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    document.getElementById('resetColorsBtn').style.display = tabName === 'colors' ? 'inline-block' : 'none';
    document.getElementById('randomColorsBtn').style.display = tabName === 'colors' ? 'inline-block' : 'none';
    document.getElementById('resetInterfaceBtn').style.display = tabName === 'interface' ? 'inline-block' : 'none';
};

// ============================================================================
// TEMPLATE MODAL
// ============================================================================

window.showGcodeHelp = function() {
    let modal = document.getElementById('gcodeHelpModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gcodeHelpModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
        const cmds = [
            ['G0 X Y Z', 'Déplacement rapide'],
            ['G1 X Y Z F', 'Déplacement linéaire (F=feedrate)'],
            ['G28', 'Homing — retour origine tous axes'],
            ['G28 X / Y / Z', 'Homing axe individuel'],
            ['G90', 'Mode positionnement absolu'],
            ['G91', 'Mode positionnement relatif'],
            ['G92 X0 Y0 Z0', 'Définir position actuelle comme origine'],
            ['M114', 'Position actuelle (X Y Z)'],
            ['M115', 'Info firmware (version, capabilities)'],
            ['M119', 'État des endstops'],
            ['M400', 'Attendre fin de tous les mouvements'],
            ['M300 S440 P200', 'Bip (fréquence S, durée P ms)'],
            ['M112', '⚠️ Arrêt d\'urgence immédiat'],
            ['M999', 'Reset après arrêt d\'urgence'],
            ['M17', 'Activer les moteurs'],
            ['M18 / M84', 'Désactiver les moteurs'],
            ['M201 X A Y A Z A', 'Accélération max par axe (mm/s²)'],
            ['M203 X V Y V Z V', 'Vitesse max par axe (mm/s)'],
            ['M204 P T', 'Accélération impression (P) / travel (T)'],
            ['M205 X J Y J Z J', 'Jerk / Junction Deviation par axe'],
            ['M211 S0 / S1', 'Désactiver / activer software endstops'],
            ['M500', 'Sauvegarder config en EEPROM'],
            ['M501', 'Charger config depuis EEPROM'],
            ['M502', 'Reset config usine (sans sauver)'],
            ['M503', 'Afficher config actuelle'],
            ['G21', 'Unités en millimètres'],
            ['G20', 'Unités en pouces'],
        ];
        modal.innerHTML = `<div style="background:var(--container-bg,#2c2c2c);border-radius:8px;padding:20px;max-width:520px;width:90%;max-height:80vh;overflow-y:auto;color:#ccc;font-size:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="margin:0;color:#fff;font-size:15px;">📖 Commandes G-code</h3>
                <button onclick="closeGcodeHelp()" style="background:none;border:none;color:#888;font-size:18px;cursor:pointer;">✕</button>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                ${cmds.map(([cmd, desc]) => `<tr style="border-bottom:1px solid #333;">
                    <td style="padding:5px 8px 5px 0;font-family:monospace;color:#ffc107;white-space:nowrap;font-size:11px;cursor:pointer;" onclick="document.getElementById('gcodeInput').value='${cmd.split(' ')[0]}';closeGcodeHelp();" title="Cliquer pour insérer">${cmd}</td>
                    <td style="padding:5px 0;color:#aaa;font-size:11px;">${desc}</td>
                </tr>`).join('')}
            </table>
        </div>`;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
};

window.closeGcodeHelp = function() {
    const modal = document.getElementById('gcodeHelpModal');
    if (modal) modal.style.display = 'none';
};

window.openTemplateModal = async function() {
    await window.ModalLoader.load('templateModal');
    if (window.PlateauTemplates) {
        window.PlateauTemplates.openModal();
    }
};

window.closeTemplateModal = function() {
    if (window.PlateauTemplates) {
        window.PlateauTemplates.closeModal();
    }
};

window.openStorageCustomization = async function() {
    await window.ModalLoader.show('storageCustomizationModal');
};

window.closeStorageCustomization = function() {
    const modal = document.getElementById('storageCustomizationModal');
    if (modal) modal.style.display = 'none';
};

window.applyStorageCustomization = function() {
    if (window.EnderTrack?.StorageManager?.applyCustomization) {
        window.EnderTrack.StorageManager.applyCustomization();
    }
    closeStorageCustomization();
};

// ============================================================================
// DISPLAY MODAL
// ============================================================================

window.openDisplayModal = async function() {
    await window.ModalLoader.load('displayModal');
    const modal = document.getElementById('displayModal');
    if (modal) {
        modal.style.display = 'block';
        window.savedColors = window.customColors ? {...window.customColors} : {};
        window.savedInputValues = {};
        
        const colorInputs = ['colorCurrentPosition', 'colorFuturePosition', 'colorTrackPath', 'colorGrid', 'colorOriginAxes', 'colorCrosshair', 'colorTrackFree', 'colorHistoryPositions', 'colorMiniOrigin', 'colorMiniPosition', 'colorMiniViewport', 'colorMiniTrack', 'colorMiniBackground', 'colorMiniBorder'];
        colorInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) window.savedInputValues[inputId] = input.value;
        });
        
        initializeColorInputs();
        switchDisplayTab('interface');
    }
};

window.closeDisplayModal = function() {
    if (window.savedColors) {
        window.customColors = {...window.savedColors};
    }
    
    if (window.savedInputValues) {
        Object.entries(window.savedInputValues).forEach(([inputId, value]) => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = value;
                const preview = input.parentElement.querySelector('.color-preview');
                if (preview) preview.style.background = value;
            }
        });
    }
    
    if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
    }
    
    const modal = document.getElementById('displayModal');
    if (modal) modal.style.display = 'none';
};

window.applyDisplaySettings = function() {
    window.savedColors = null;
    
    if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
    }
    
    if (window.EnderTrack?.ZVisualization?.render) {
        window.EnderTrack.ZVisualization.render();
    }
    
    const modal = document.getElementById('displayModal');
    if (modal) modal.style.display = 'none';
};

window.initializeColorInputs = function() {
    const colorMappings = {
        'colorCurrentPosition': 'positionColor',
        'colorFuturePosition': 'futurePosition',
        'colorTrackPath': 'trackColor',
        'colorGrid': 'gridColor',
        'colorOriginAxes': 'originAxes',
        'colorCrosshair': 'crosshair',
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
};

// ============================================================================
// COLOR MANAGEMENT
// ============================================================================

window.resetColors = function() {
    const defaultColors = {
        positionColor: '#4f9eff',
        futurePosition: '#ffc107',
        trackColor: '#10b981',
        gridColor: '#404040',
        originAxes: '#ef4444',
        crosshair: '#ffffff',
        trackFreeColor: '#ff8c00',
        historyPositionsColor: '#10b981',
        axisXColor: '#ff4444',
        axisYColor: '#44ff44',
        outsideColor: '#2c2c2c',
        zBackground: '#1a1a1a',
        zCurrentPosition: '#4f9eff',
        zOriginColor: '#ff4444',
        zScaleColor: '#ffffff',
        zHistoryPosition: '#10b981',
        miniOriginColor: '#ff4444',
        miniPositionColor: '#4f9eff',
        miniViewportColor: '#555555',
        miniTrackColor: '#10b981',
        miniBackgroundColor: '#000000',
        miniBorderColor: '#666666'
    };
    
    window.customColors = {...defaultColors};
    
    const colorMappings = {
        'colorCurrentPosition': 'positionColor',
        'colorFuturePosition': 'futurePosition',
        'colorTrackPath': 'trackColor',
        'colorGrid': 'gridColor',
        'colorOriginAxes': 'originAxes',
        'colorCrosshair': 'crosshair',
        'colorTrackFree': 'trackFreeColor',
        'colorHistoryPositions': 'historyPositionsColor',
        'colorAxisX': 'axisXColor',
        'colorAxisY': 'axisYColor',
        'colorOutside': 'outsideColor',
        'colorZBackground': 'zBackground',
        'colorZCurrentPosition': 'zCurrentPosition',
        'colorZOrigin': 'zOriginColor',
        'colorZScale': 'zScaleColor',
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
            input.value = defaultColors[colorType];
            preview.style.background = defaultColors[colorType];
        }
    });
    
    if (window.EnderTrack?.Canvas?.requestRender) {
        window.EnderTrack.Canvas.requestRender();
    }
    if (window.EnderTrack?.ZVisualization?.render) {
        window.EnderTrack.ZVisualization.render();
    }
};

window.randomizeColors = function() {
    const randomColor = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    
    const colorMappings = {
        'colorCurrentPosition': 'positionColor',
        'colorFuturePosition': 'futurePosition',
        'colorTrackPath': 'trackColor',
        'colorGrid': 'gridColor',
        'colorOriginAxes': 'originAxes',
        'colorCrosshair': 'crosshair',
        'colorTrackFree': 'trackFreeColor',
        'colorHistoryPositions': 'historyPositionsColor',
        'colorAxisX': 'axisXColor',
        'colorAxisY': 'axisYColor',
        'colorOutside': 'outsideColor',
        'colorZBackground': 'zBackground',
        'colorZCurrentPosition': 'zCurrentPosition',
        'colorZOrigin': 'zOriginColor',
        'colorZScale': 'zScaleColor',
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
            const color = randomColor();
            input.value = color;
            preview.style.background = color;
            updateDisplayColor(colorType, color);
        }
    });
};

window.resetInterface = function() {
    const interfaceCheckboxes = [
        'showNavigationTab', 'showZPanel', 'showStatusPanel', 'showOthersTab',
        'showRelativeMode', 'showAbsoluteMode', 'showControllerMode', 'showSensitivityControls',
        'showHistoryPanel', 'showGraphs', 'showTrackPositions', 'showTrackFree'
    ];
    
    interfaceCheckboxes.forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) checkbox.checked = true;
    });
};

window.resetAdvanced = function() {
    const advancedCheckboxes = ['showHistoryZ', 'showHistoryXY', 'enableSnakeMode'];
    
    advancedCheckboxes.forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) checkbox.checked = checkboxId !== 'showControllerLog';
    });
    
    const snakeSlider = document.getElementById('snakePointsSlider');
    const snakeValue = document.getElementById('snakePointsValue');
    if (snakeSlider && snakeValue) {
        snakeSlider.value = '2000';
        snakeValue.textContent = '2000';
    }
};

// ============================================================================
// CONFIG MANAGEMENT
// ============================================================================

window.saveConfig = function() {
};

window.loadConfig = function() {
    if (confirm('Charger une configuration remplacera les paramètres actuels. Continuer ?')) {
    }
};

window.resetToDefault = function() {
    if (confirm('Réinitialiser aux paramètres par défaut ? Cette action est irréversible.')) {
    }
};

window.validateAxisConfig = function() {
    if (window.EnderTrack?.CoordinateConfig) {
        const coordConfig = window.EnderTrack.CoordinateConfig;
        
        const plateauX = parseFloat(document.getElementById('plateauX')?.value) || 200;
        const plateauY = parseFloat(document.getElementById('plateauY')?.value) || 200;
        const plateauZ = parseFloat(document.getElementById('plateauZ')?.value) || 100;
        
        const xMin = parseFloat(document.getElementById('xMin')?.value) || -100;
        const xMax = parseFloat(document.getElementById('xMax')?.value) || 100;
        const yMin = parseFloat(document.getElementById('yMin')?.value) || -100;
        const yMax = parseFloat(document.getElementById('yMax')?.value) || 100;
        const zMin = parseFloat(document.getElementById('zMin')?.value) || 0;
        const zMax = parseFloat(document.getElementById('zMax')?.value) || 100;
        
        coordConfig.setPlateauDimensions(plateauX, plateauY, plateauZ);
        coordConfig.setCoordinateBounds({
            x: { min: xMin, max: xMax },
            y: { min: yMin, max: yMax },
            z: { min: zMin, max: zMax }
        });
        
        if (window.EnderTrack?.Notifications) {
            window.EnderTrack.Notifications.show('Configuration des coordonnées mise à jour', 'success');
        }
    }
};

window.validatePlateauSize = function() {
    validateAxisConfig();
};

window.resetLimitsToPlateauSize = function() {
    const state = window.EnderTrack?.State?.get();
    let xMin, xMax, yMin, yMax, zMin, zMax;
    
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
    
    // Update limit inputs if they exist
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('xLimitMin', xMin); setVal('xLimitMax', xMax);
    setVal('yLimitMin', yMin); setVal('yLimitMax', yMax);
    setVal('zLimitMin', zMin); setVal('zLimitMax', zMax);
    
    ['xLimitMin', 'xLimitMax', 'yLimitMin', 'yLimitMax', 'zLimitMin', 'zLimitMax'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    
    // Mettre à jour les valeurs internes de StrategicPositions
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
    }
    
    // Cocher les checkboxes
    const xCheckbox = document.getElementById('showXLimit');
    const yCheckbox = document.getElementById('showYLimit');
    const zCheckbox = document.getElementById('showZLimit');
    if (xCheckbox) xCheckbox.checked = true;
    if (yCheckbox) yCheckbox.checked = true;
    if (zCheckbox) zCheckbox.checked = true;
    
    // Actualiser les vues XY et Z
    setTimeout(() => {
        if (window.EnderTrack?.Canvas?.requestRender) {
            window.EnderTrack.Canvas.requestRender();
        }
        if (window.EnderTrack?.ZVisualization?.render) {
            window.EnderTrack.ZVisualization.render();
        }
    }, 100);
    
    if (window.EnderTrack?.UI?.showNotification) {
        window.EnderTrack.UI.showNotification('Limites de sécurité définies selon les plages de coordonnées', 'success');
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const state = window.EnderTrack?.State?.get();
        if (state && state.scaleBarRatio) {
            const slider = document.getElementById('scaleBarRatioSlider');
            const input = document.getElementById('scaleBarRatioInput');
            if (slider && input) {
                slider.value = state.scaleBarRatio;
                input.value = Math.round(state.scaleBarRatio * 100);
            }
        }
        
        if (window.EnderTrack?.StorageManager) {
            const stats = window.EnderTrack.StorageManager.getStats();
            const sizeEl = document.getElementById('storageSize');
            const keysEl = document.getElementById('storageKeys');
            if (sizeEl) sizeEl.textContent = stats.size;
            if (keysEl) keysEl.textContent = stats.totalKeys;
        }
    }, 1000);
});
