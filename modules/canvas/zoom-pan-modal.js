// modules/canvas/zoom-pan-modal.js - Modal for manual zoom/pan adjustment

function openZoomPanModal(event) {
  // Fermer toute modale existante
  const existing = document.querySelector('.zoom-pan-modal');
  if (existing) existing.remove();

  const state = window.EnderTrack.State.get();
  
  // Récupérer les valeurs actuelles avec fallbacks
  const safeZoomXY = (state.zoom != null && !isNaN(state.zoom)) ? state.zoom : 1;
  const safeZoomZ = (state.zZoom != null && !isNaN(state.zZoom)) ? state.zZoom : 1;
  const safePanX = (state.panX != null && !isNaN(state.panX)) ? state.panX : 0;
  const safePanY = (state.panY != null && !isNaN(state.panY)) ? state.panY : 0;
  const safePanZ = (state.zPan != null && !isNaN(state.zPan)) ? state.zPan : 0;
  
  // Créer la modale
  const modal = document.createElement('div');
  modal.className = 'zoom-pan-modal';
  
  modal.innerHTML = `
    <h3>Zoom & Pan</h3>
    
    <div class="modal-section">
      <div class="section-title">Zoom</div>
      <div class="input-row">
        <label>XY:</label>
        <input type="number" id="zoomXY" value="${safeZoomXY.toFixed(2)}" step="0.1" min="0.1">
      </div>
      <div class="input-row">
        <label>Z:</label>
        <input type="number" id="zoomZ" value="${safeZoomZ.toFixed(2)}" step="0.1" min="0.1">
      </div>
    </div>
    
    <div class="modal-section">
      <div class="section-title">Pan</div>
      <div class="input-row">
        <label>X:</label>
        <input type="number" id="panX" value="${safePanX.toFixed(2)}" step="1">
      </div>
      <div class="input-row">
        <label>Y:</label>
        <input type="number" id="panY" value="${safePanY.toFixed(2)}" step="1">
      </div>
      <div class="input-row">
        <label>Z:</label>
        <input type="number" id="panZ" value="${safePanZ.toFixed(2)}" step="1">
      </div>
    </div>
    
    <div class="modal-buttons">
      <button class="btn-cancel">Annuler</button>
      <button class="btn-validate">Valider</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Positionner la modale près du clic
  positionModal(modal, event);
  
  // Event listeners
  const btnValidate = modal.querySelector('.btn-validate');
  const btnCancel = modal.querySelector('.btn-cancel');
  
  btnValidate.addEventListener('click', () => {
    const success = applyZoomPan();
    if (success) {
      modal.remove();
    }
  });
  
  btnCancel.addEventListener('click', () => {
    modal.remove();
  });
  
  // Fermer avec Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // Fermer en cliquant à l'extérieur
  setTimeout(() => {
    const handleClickOutside = (e) => {
      if (!modal.contains(e.target)) {
        modal.remove();
        document.removeEventListener('click', handleClickOutside);
      }
    };
    document.addEventListener('click', handleClickOutside);
  }, 100);
  
  // Focus sur le premier input
  modal.querySelector('#zoomXY').focus();
}

function positionModal(modal, event) {
  const rect = modal.getBoundingClientRect();
  let x = event.clientX + 10;
  let y = event.clientY - rect.height / 2;
  
  // Ajuster si déborde à droite
  if (x + rect.width > window.innerWidth) {
    x = event.clientX - rect.width - 10;
  }
  
  // Ajuster si déborde en haut
  if (y < 10) {
    y = 10;
  }
  
  // Ajuster si déborde en bas
  if (y + rect.height > window.innerHeight - 10) {
    y = window.innerHeight - rect.height - 10;
  }
  
  modal.style.left = x + 'px';
  modal.style.top = y + 'px';
}

function applyZoomPan() {
  const zoomXYInput = document.getElementById('zoomXY');
  const zoomZInput = document.getElementById('zoomZ');
  const panXInput = document.getElementById('panX');
  const panYInput = document.getElementById('panY');
  const panZInput = document.getElementById('panZ');
  
  const zoomXY = parseFloat(zoomXYInput.value) || 1;
  const zoomZ = parseFloat(zoomZInput.value) || 1;
  const panX = parseFloat(panXInput.value) || 0;
  const panY = parseFloat(panYInput.value) || 0;
  const panZ = parseFloat(panZInput.value) || 0;
  
  
  let hasError = false;
  let errorMsg = '';
  
  if (zoomXY < 0.1) {
    zoomXYInput.classList.add('invalid');
    errorMsg = 'Zoom XY doit être ≥ 0.1';
    hasError = true;
  }
  
  if (zoomZ < 0.1) {
    zoomZInput.classList.add('invalid');
    errorMsg = errorMsg || 'Zoom Z doit être ≥ 0.1';
    hasError = true;
  }
  
  if (hasError) {
    console.error('Validation error:', errorMsg);
    let errorDiv = document.querySelector('.zoom-pan-modal .error-message');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      document.querySelector('.zoom-pan-modal .modal-buttons').before(errorDiv);
    }
    errorDiv.textContent = errorMsg;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
      document.querySelectorAll('.zoom-pan-modal input.invalid').forEach(input => {
        input.classList.remove('invalid');
      });
      if (errorDiv) errorDiv.style.display = 'none';
    }, 2000);
    
    return false;
  }
  
  window.EnderTrack.State.update({
    zoomLevel: zoomXY,
    zZoom: zoomZ,
    panX: panX,
    panY: panY,
    zPan: panZ
  });
  
  
  // Utiliser les fonctions de zoom/pan existantes pour XY
  if (window.EnderTrack.CanvasInteractions?.zoomPanHandler) {
    window.EnderTrack.CanvasInteractions.zoomPanHandler.handleZoom(zoomXY);
    window.EnderTrack.CanvasInteractions.zoomPanHandler.handlePan(panX, panY);
  }
  
  // Forcer le rendu du canvas XY
  if (window.EnderTrack.Canvas) {
    window.EnderTrack.Canvas.requestRender();
  }
  
  // Re-rendre le canvas Z
  if (window.EnderTrack.ZVisualization) {
    window.EnderTrack.ZVisualization.zRange = window.EnderTrack.ZVisualization.canvas.height / zoomZ;
    window.EnderTrack.ZVisualization.zPan = panZ;
    window.EnderTrack.ZVisualization.render();
  }
  
  // Mettre à jour l'affichage des valeurs dans l'overlay
  const zoomLevelEl = document.getElementById('zoomLevel');
  const zZoomLevelEl = document.getElementById('zZoomLevel');
  const panXEl = document.getElementById('panX');
  const panYEl = document.getElementById('panY');
  const zPanLevelEl = document.getElementById('zPanLevel');
  
  if (zoomLevelEl) zoomLevelEl.textContent = zoomXY.toFixed(1) + 'x';
  if (zZoomLevelEl) zZoomLevelEl.textContent = zoomZ.toFixed(1) + 'x';
  if (panXEl) panXEl.textContent = panX.toFixed(1);
  if (panYEl) panYEl.textContent = panY.toFixed(1);
  if (zPanLevelEl) zPanLevelEl.textContent = panZ.toFixed(1);
  
  // Mettre à jour les minimaps
  setTimeout(() => {
    const state = window.EnderTrack.State.get();
    if (window.EnderTrack.MiniPreview) {
      window.EnderTrack.MiniPreview.cachedWidth = null;
      window.EnderTrack.MiniPreview.renderInHeader('miniPreviewXY', state);
    }
    if (window.EnderTrack.MiniZPreview) {
      window.EnderTrack.MiniZPreview.renderInHeader('miniPreviewZ', state);
    }
  }, 50);
  
  return true;
}

// Attacher l'event listener au canvas info overlay
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.querySelector('.canvas-info-overlay');
  if (overlay) {
    overlay.addEventListener('click', openZoomPanModal);
  }
});
