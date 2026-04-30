// modules/ui/ui-settings.js - Interface unifiée pour tous les paramètres UI

// === PARAMÈTRES D'AFFICHAGE ===

// Onglets visibles
function toggleNavigationTab() {
  const show = document.getElementById('showNavigationTab').checked;
  const tab = document.getElementById('navigationTab');
  if (tab) tab.style.display = show ? 'block' : 'none';
}

function toggleOthersTab() {
  const show = document.getElementById('showOthersTab').checked;
  const tab = document.getElementById('othersTab');
  if (tab) tab.style.display = show ? 'block' : 'none';
}

// Navigation - Contrôle seulement la visibilité des boutons de mode
function toggleRelativeMode() {
  const show = document.getElementById('showRelativeMode').checked;
  const relativeTab = document.getElementById('relativeTab');
  
  if (relativeTab) {
    relativeTab.style.display = show ? 'block' : 'none';
    if (!show && relativeTab.classList.contains('active')) {
      const absoluteTab = document.getElementById('absoluteTab');
      if (absoluteTab && absoluteTab.style.display !== 'none') {
        absoluteTab.click();
      }
    }
  }
}

function toggleAbsoluteMode() {
  const show = document.getElementById('showAbsoluteMode').checked;
  const absoluteTab = document.getElementById('absoluteTab');
  
  if (absoluteTab) {
    absoluteTab.style.display = show ? 'block' : 'none';
    if (!show && absoluteTab.classList.contains('active')) {
      const relativeTab = document.getElementById('relativeTab');
      if (relativeTab && relativeTab.style.display !== 'none') {
        relativeTab.click();
      }
    }
  }
}

function toggleControllerMode() {
  const show = document.getElementById('showControllerMode').checked;
  const toggle = document.getElementById('keyboardMode');
  if (toggle) toggle.style.display = show ? 'block' : 'none';
}

// Panneaux
function toggleStatusPanel() {
  const show = document.getElementById('showStatusPanel').checked;
  const panel = document.querySelector('.status-section');
  if (panel) panel.style.display = show ? 'block' : 'none';
}

function toggleHistoryPanel() {
  const show = document.getElementById('showHistoryPanel').checked;
  const panel = document.querySelector('.history-section');
  if (panel) panel.style.display = show ? 'block' : 'none';
}

function toggleGraphs() {
  const show = document.getElementById('showGraphs').checked;
  const graphsSection = document.querySelector('.graphs-section');
  if (graphsSection) graphsSection.style.display = show ? 'block' : 'none';
  
  if (window.EnderTrack?.State) {
    EnderTrack.State.update({ showGraphs: show });
  }
}

function toggleZPanel() {
  const show = document.getElementById('showZPanel').checked;
  const panel = document.getElementById('zVisualizationPanel');
  if (panel) panel.style.display = show ? 'block' : 'none';
}

// Mini-previews
function toggleMiniPreviewXY() {
  const show = document.getElementById('showMiniPreviewXY').checked;
  if (window.EnderTrack?.MiniPreview) {
    EnderTrack.MiniPreview.setVisible(show);
  }
}

function toggleMiniPreviewZ() {
  const show = document.getElementById('showMiniPreviewZ').checked;
  if (window.EnderTrack?.MiniZPreview) {
    EnderTrack.MiniZPreview.setVisible(show);
  }
}

function toggleMiniPreviewTrack() {
  const show = document.getElementById('showMiniPreviewTrack').checked;
  if (window.EnderTrack?.MiniPreview) {
    EnderTrack.MiniPreview.showTrack = show;
    if (window.EnderTrack?.Canvas) {
      EnderTrack.Canvas.requestRender();
    }
  }
}

// Fonctions simples pour les checkboxes d'historique
function togglePositionXYHistory() {
  const modalCheckbox = document.getElementById('showPositionXYHistory');
  const mainCheckbox = document.getElementById('mainShowPositionXYHistory');
  const show = modalCheckbox?.checked || false;
  
  if (mainCheckbox && mainCheckbox.checked !== show) {
    mainCheckbox.checked = show;
  }
  
  if (localStorage.getItem('showPositionXYHistory_enabled') === 'true') {
    localStorage.setItem('showPositionXYHistory', show);
  }
  
  if (window.EnderTrack?.Canvas) {
    window.EnderTrack.Canvas.requestRender();
  }
}

function togglePositionZHistory() {
  const modalCheckbox = document.getElementById('showPositionZHistory');
  const mainCheckbox = document.getElementById('mainShowPositionZHistory');
  const show = modalCheckbox?.checked || false;
  
  if (mainCheckbox && mainCheckbox.checked !== show) {
    mainCheckbox.checked = show;
  }
  
  if (localStorage.getItem('showPositionZHistory_enabled') === 'true') {
    localStorage.setItem('showPositionZHistory', show);
  }
  
  if (window.EnderTrack?.ZVisualization) {
    window.EnderTrack.ZVisualization.render();
  }
}

function toggleTrackPositions() {
  const modalCheckbox = document.getElementById('showTrackPositions');
  const mainCheckbox = document.getElementById('mainShowTrackPositions');
  const show = modalCheckbox?.checked || false;
  
  if (mainCheckbox && mainCheckbox.checked !== show) {
    mainCheckbox.checked = show;
  }
  
  if (localStorage.getItem('showTrackPositions_enabled') === 'true') {
    localStorage.setItem('showTrackPositions', show);
  }
  
  if (window.EnderTrack?.Canvas) {
    window.EnderTrack.Canvas.requestRender();
  }
}

function toggleTrackFree() {
  const modalCheckbox = document.getElementById('showTrackFree');
  const mainCheckbox = document.getElementById('mainShowTrackFree');
  const show = modalCheckbox?.checked || false;
  
  if (mainCheckbox && mainCheckbox.checked !== show) {
    mainCheckbox.checked = show;
  }
  
  if (localStorage.getItem('showTrackFree_enabled') === 'true') {
    localStorage.setItem('showTrackFree', show);
  }
  
  if (window.EnderTrack?.Canvas) {
    window.EnderTrack.Canvas.requestRender();
  }
}

// Historique et tracking
function toggleHistoryXY() {
  const show = document.getElementById('showHistoryXY').checked;
  if (window.EnderTrack?.State) {
    EnderTrack.State.update({ showHistoryXY: show });
  }
  if (window.EnderTrack?.Canvas) {
    EnderTrack.Canvas.requestRender();
  }
}

function toggleHistoryZ() {
  const show = document.getElementById('showHistoryZ').checked;
  if (window.EnderTrack?.State) {
    EnderTrack.State.update({ showHistoryZ: show });
  }
  if (window.EnderTrack?.ZVisualization) {
    EnderTrack.ZVisualization.render();
  }
}

// SUPPRIMÉ - Fonctions dupliquées qui causaient des conflits
// function toggleTrackFree() { ... }
// function toggleTrackPositions() { ... }

function toggleSnakeMode() {
  const isEnabled = document.getElementById('enableSnakeMode').checked;
  const slider = document.getElementById('snakeSliderContainer');
  
  if (slider) {
    slider.style.display = isEnabled ? 'flex' : 'none';
  }
  
  if (window.EnderTrack?.State) {
    EnderTrack.State.update({ enableSnakeMode: isEnabled });
  }
}

function updateSnakePoints() {
  const slider = document.getElementById('snakePointsSlider');
  const valueSpan = document.getElementById('snakePointsValue');
  const points = parseInt(slider.value);
  
  if (valueSpan) {
    valueSpan.textContent = `${points} pts`;
  }
  
  if (window.EnderTrack?.State) {
    const state = EnderTrack.State.get();
    if (state.continuousTrack && state.continuousTrack.length > points) {
      const newTrack = state.continuousTrack.slice(-points);
      EnderTrack.State.update({ 
        maxContinuousTrackPoints: points,
        continuousTrack: newTrack
      });
    } else {
      EnderTrack.State.update({ maxContinuousTrackPoints: points });
    }
  }
}

function toggleSensitivityControls() {
  const show = document.getElementById('showSensitivityControls').checked;
  const stepControls = document.getElementById('stepControls');
  if (stepControls) stepControls.style.display = show ? 'block' : 'none';
}

function toggleControllerLog() {
  const show = document.getElementById('showControllerLog').checked;
  const log = document.getElementById('navigationLog');
  if (log) log.style.display = show ? 'block' : 'none';
}

// Gestion des modales
function openDisplayModal() {
  const modal = document.getElementById('displayModal');
  if (modal) {
    modal.style.display = 'block';
    setupModalDrag();
  }
  
  setTimeout(() => {
    const syncPairs = [
      ['mainShowPositionXYHistory', 'showPositionXYHistory'],
      ['mainShowPositionZHistory', 'showPositionZHistory'], 
      ['mainShowTrackPositions', 'showTrackPositions'],
      ['mainShowTrackFree', 'showTrackFree']
    ];
    
    syncPairs.forEach(([mainId, modalId]) => {
      const main = document.getElementById(mainId);
      const modal = document.getElementById(modalId);
      if (main && modal) {
        modal.checked = main.checked;
      }
    });
  }, 50);
}

function closeDisplayModal() {
  const modal = document.getElementById('displayModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function setupModalDrag() {
  const modal = document.querySelector('.draggable-modal');
  const header = document.querySelector('.draggable-header');
  
  if (!modal || !header) return;
  
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = modal.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
  
  function onMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    modal.style.left = (startLeft + deltaX) + 'px';
    modal.style.top = (startTop + deltaY) + 'px';
    modal.style.transform = 'none';
  }
  
  function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

function applyDisplaySettings() {
  // Appliquer tous les paramètres
  toggleNavigationTab();
  toggleOthersTab();
  toggleRelativeMode();
  toggleControllerMode();
  toggleAbsoluteMode();
  toggleSensitivityControls();
  toggleZPanel();
  toggleStatusPanel();
  toggleControllerLog();
  toggleHistoryXY();
  toggleHistoryPanel();
  toggleTrackFree();
  toggleSnakeMode();
  updateSnakePoints();
  toggleTrackPositions();
  toggleHistoryZ();
  toggleGraphs();
  toggleMiniPreviewXY();
  toggleMiniPreviewZ();
  toggleMiniPreviewTrack();
  
  // Sauvegarder dans l'état
  if (window.EnderTrack?.State) {
    EnderTrack.State.saveState();
  }
  
  // Fermer la modale
  closeDisplayModal();
}

// Initialisation unifiée
function initAllSettings() {
  initDisplaySettings();
}

function initDisplaySettings() {
  if (!window.EnderTrack?.State) {
    setTimeout(initDisplaySettings, 100);
    return;
  }
  
  const state = EnderTrack.State.get();
  
  // Charger les préférences d'historique depuis localStorage
  const historyPrefs = [
    ['showPositionXYHistory', 'mainShowPositionXYHistory'],
    ['showPositionZHistory', 'mainShowPositionZHistory'],
    ['showTrackPositions', 'mainShowTrackPositions'],
    ['showTrackFree', 'mainShowTrackFree']
  ];
  
  historyPrefs.forEach(([modalId, mainId]) => {
    const saved = localStorage.getItem(modalId);
    const checked = saved !== null ? saved === 'true' : true;
    
    const modalCheckbox = document.getElementById(modalId);
    const mainCheckbox = document.getElementById(mainId);
    
    if (modalCheckbox) modalCheckbox.checked = checked;
    if (mainCheckbox) mainCheckbox.checked = checked;
  });
  
  // Initialiser toutes les checkboxes
  const elements = [
    ['showGrid', state.showGrid !== false],
    ['showHistoryXY', state.showHistoryXY !== false],
    ['showTrackFree', state.showTrackFree !== false],
    ['enableSnakeMode', state.enableSnakeMode !== false],
    ['showZPanel', state.showZPanel !== false],
    ['showHistoryZ', state.showHistoryZ !== false],
    ['showStatusPanel', state.showStatusPanel !== false],
    ['showHistoryPanel', state.showHistoryPanel !== false],
    ['showGraphs', state.showGraphs !== false],
    ['showSensitivityControls', state.showSensitivityControls !== false],
    ['showMiniPreviewXY', state.showMiniPreviewXY !== false],
    ['showMiniPreviewZ', state.showMiniPreviewZ !== false],
    ['showMiniPreviewTrack', state.showMiniPreviewTrack !== false]
  ];
  
  elements.forEach(([id, checked]) => {
    const checkbox = document.getElementById(id);
    if (checkbox) checkbox.checked = checked;
  });
  
  // Snake slider
  const snakeSlider = document.getElementById('snakePointsSlider');
  const snakeValue = document.getElementById('snakePointsValue');
  if (snakeSlider && snakeValue) {
    const points = state.maxContinuousTrackPoints || 2000;
    snakeSlider.value = points;
    snakeValue.textContent = `${points} pts`;
  }
}

// Initialiser quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initAllSettings, 200);
});

// Fermer la modale en cliquant à l'extérieur
document.addEventListener('click', (event) => {
  const modal = document.getElementById('displayModal');
  if (event.target === modal) {
    closeDisplayModal();
  }
});

// === FONCTIONS GLOBALES POUR L'HTML ===
// Affichage
window.toggleNavigationTab = toggleNavigationTab;
window.toggleOthersTab = toggleOthersTab;
window.toggleRelativeMode = toggleRelativeMode;
window.toggleControllerMode = toggleControllerMode;
window.toggleAbsoluteMode = toggleAbsoluteMode;
window.toggleStatusPanel = toggleStatusPanel;
window.toggleControllerLog = toggleControllerLog;
window.toggleHistoryXY = toggleHistoryXY;
window.toggleHistoryPanel = toggleHistoryPanel;
window.toggleTrackFree = toggleTrackFree;
window.togglePositionXYHistory = togglePositionXYHistory;
window.togglePositionZHistory = togglePositionZHistory;
window.toggleTrackPositions = toggleTrackPositions;
window.toggleHistoryZ = toggleHistoryZ;
window.toggleGraphs = toggleGraphs;
window.toggleSnakeMode = toggleSnakeMode;
window.updateSnakePoints = updateSnakePoints;
window.toggleSensitivityControls = toggleSensitivityControls;
window.toggleZPanel = toggleZPanel;
window.toggleMiniPreviewXY = toggleMiniPreviewXY;
window.toggleMiniPreviewZ = toggleMiniPreviewZ;
window.toggleMiniPreviewTrack = toggleMiniPreviewTrack;
window.openDisplayModal = openDisplayModal;
window.closeDisplayModal = closeDisplayModal;
window.applyDisplaySettings = applyDisplaySettings;