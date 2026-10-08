// modules/canvas/mini-z-preview.js - Mini preview du zoom/pan Z
// Affiche une mini-carte de navigation Z à côté du preview XY

class MiniZPreview {
  constructor() {
    this.width = 20;
    this.height = 80;
    this.margin = 10;
    this.isVisible = true;
  }

  // Dessiner le mini-preview Z dans le header
  renderInHeader(containerId, state) {
    if (!this.isVisible) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    // Vérifier si le conteneur parent est visible
    const parentContainer = container.parentElement;
    if (!parentContainer || parentContainer.classList.contains('collapsed')) return;

    // Créer ou récupérer le canvas
    let canvas = container.querySelector('canvas');
    if (canvas) {
      canvas.remove();
    }
    
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
    
    const containerRect = container.getBoundingClientRect();
    
    // Ne pas créer de canvas si les dimensions sont nulles
    if (containerRect.width === 0 || containerRect.height === 0) return;
    
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'pointer';
    
    // Ajouter les event listeners pour les clics
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      this.handleHeaderClick(x, y, state, canvas.height);
    });

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;

    // Calculer la hauteur du plateau XY pour correspondance
    const xyContainer = document.getElementById('miniPreviewXY');
    let plateauHeight = height * 0.6; // Défaut
    
    if (xyContainer) {
      const xyCanvas = xyContainer.querySelector('canvas');
      if (xyCanvas) {
        const coordinateBounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 } };
        const plateauWidthMm = coordinateBounds.x.max - coordinateBounds.x.min;
        const plateauHeightMm = coordinateBounds.y.max - coordinateBounds.y.min;
        const maxDim = Math.max(plateauWidthMm, plateauHeightMm);
        const maxPlateauSize = Math.min(xyCanvas.width, xyCanvas.height) * 0.6;
        plateauHeight = (plateauHeightMm / maxDim) * maxPlateauSize;
      }
    }

    // Plage Z (gris) - même hauteur que le plateau XY, centré verticalement
    const zRangeHeight = plateauHeight;
    const zRangeX = 1;
    const zRangeY = (height - zRangeHeight) / 2;
    const zRangeWidth = width - 2;
    
    ctx.fillStyle = 'rgba(60, 60, 60, 0.5)';
    ctx.fillRect(zRangeX, zRangeY, zRangeWidth, zRangeHeight);
    
    // Bordure de la plage Z
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(zRangeX, zRangeY, zRangeWidth, zRangeHeight);

    // Zone visible Z actuelle (rectangle gris transparent)
    const viewRect = this.calculateZViewRectHeader(state, zRangeX, zRangeY, zRangeWidth, zRangeHeight);
    const viewportColor = window.customColors?.miniViewportColor || getComputedStyle(document.documentElement).getPropertyValue('--pos-viewport').trim() || '#aaaaaa';
    ctx.fillStyle = `${viewportColor}11`;
    ctx.fillRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);
    
    ctx.strokeStyle = viewportColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);

    // Origine Z (ligne rouge)
    const originPos = this.zToPreviewHeader(0, state, zRangeY, zRangeHeight);
    const posMinColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-min').trim() || '#f44336';
    ctx.strokeStyle = posMinColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(zRangeX, originPos);
    ctx.lineTo(zRangeX + zRangeWidth, originPos);
    ctx.stroke();

    // Position Z actuelle (ligne blanche)
    const currentPos = this.zToPreviewHeader(state.pos.z, state, zRangeY, zRangeHeight);
    const posCurrentColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-current').trim() || '#ffffff';
    ctx.strokeStyle = posCurrentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(zRangeX, currentPos);
    ctx.lineTo(zRangeX + zRangeWidth, currentPos);
    ctx.stroke();
  }

  // Version originale pour le canvas principal
  render(ctx, canvasWidth, canvasHeight, state) {
    if (!this.isVisible) return;

    const x = this.margin + 80 + 10; // À côté du preview XY
    const y = canvasHeight - this.height - this.margin;

    // Fond semi-transparent
    const bgColor = window.customColors?.miniBackgroundColor || '#000000';
    ctx.fillStyle = bgColor + 'B3'; // 70% opacity
    ctx.fillRect(x, y, this.width, this.height);

    // Bordure
    ctx.strokeStyle = window.customColors?.miniBorderColor || '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, this.width, this.height);

    // Plage Z complète (gris)
    const zRangeHeight = this.height - 10;
    const zRangeX = x + 2;
    const zRangeY = y + 5;
    const zRangeWidth = this.width - 4;
    
    ctx.fillStyle = '#333';
    ctx.fillRect(zRangeX, zRangeY, zRangeWidth, zRangeHeight);

    // Zone visible Z actuelle (rectangle jaune transparent)
    const viewRect = this.calculateZViewRect(state, zRangeX, zRangeY, zRangeWidth, zRangeHeight);
    const viewportColor = window.customColors?.miniViewportColor || 'rgba(255, 193, 7, 0.7)';
    ctx.fillStyle = viewportColor.includes('rgba') ? viewportColor.replace('0.7', '0.2') : viewportColor + '33';
    ctx.fillRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);
    
    ctx.strokeStyle = viewportColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);

    // Origine Z (ligne rouge)
    const originPos = this.zToPreview(0, state, zRangeY, zRangeHeight);
    ctx.strokeStyle = window.customColors?.miniOriginColor || '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(zRangeX, originPos);
    ctx.lineTo(zRangeX + zRangeWidth, originPos);
    ctx.stroke();

    // Position Z actuelle (ligne bleue)
    const currentPos = this.zToPreview(state.pos.z, state, zRangeY, zRangeHeight);
    ctx.strokeStyle = window.customColors?.miniPositionColor || '#4f9eff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(zRangeX, currentPos);
    ctx.lineTo(zRangeX + zRangeWidth, currentPos);
    ctx.stroke();
  }

  // Version pour header
  calculateZViewRectHeader(state, zRangeX, zRangeY, zRangeWidth, zRangeHeight) {
    const coordinateBounds = state.coordinateBounds || { z: { min: 0, max: 100 } };
    const zMin = coordinateBounds.z.min;
    const zMax = coordinateBounds.z.max;
    const zRange = zMax - zMin;
    
    // Récupérer le canvas Z pour obtenir la vue actuelle
    const zCanvas = document.querySelector('.z-visualization-panel canvas');
    if (!zCanvas) {
      // Fallback: afficher toute la plage
      return {
        x: zRangeX,
        y: zRangeY,
        width: zRangeWidth,
        height: zRangeHeight
      };
    }
    
    // Le système Z utilise zPan comme centre et zZoom comme facteur
    const zZoom = state.zZoom || 1;
    const zPan = state.zPan || 0;
    
    // Calculer la hauteur visible en mm dans le canvas Z
    const zCanvasHeight = zCanvas.height;
    const viewHeightMm = zCanvasHeight / zZoom;
    
    // Le centre de la vue est à zPan
    const viewCenterZ = zPan;
    const viewMinZ = viewCenterZ - viewHeightMm / 2;
    const viewMaxZ = viewCenterZ + viewHeightMm / 2;
    
    // Convertir en coordonnées preview (Y inversé : haut = zMax, bas = zMin)
    const scale = zRangeHeight / zRange;
    
    // Position Y du haut du rectangle (correspond à viewMaxZ)
    const rectTop = zRangeY + (zMax - viewMaxZ) * scale;
    const rectHeight = viewHeightMm * scale;
    
    // Ne PAS limiter le rectangle - laisser déborder si nécessaire
    return {
      x: zRangeX,
      y: rectTop,
      width: zRangeWidth,
      height: Math.max(rectHeight, 2)
    };
  }

  // Calculer le rectangle de la zone visible Z
  calculateZViewRect(state, zRangeX, zRangeY, zRangeWidth, zRangeHeight) {
    const zZoom = state.zZoom || 1;
    const zPan = state.zPan || 0;
    const plateauDimensions = state.plateauDimensions || { x: 200, y: 200, z: 100 };
    
    // Obtenir les dimensions réelles du canvas Z
    const zCanvas = document.querySelector('.z-visualization-panel canvas');
    if (!zCanvas) return { x: zRangeX, y: zRangeY, width: zRangeWidth, height: zRangeHeight };
    
    const zCanvasHeight = zCanvas.height;
    
    // Calculer la zone visible Z en coordonnées monde
    const viewHeightWorld = zCanvasHeight / zZoom;
    
    // Le centre de la vue Z est à zPan (pas -zPan/zZoom)
    const viewCenterZ = zPan;
    
    // Convertir en coordonnées preview (Y inversé)
    const scale = zRangeHeight / plateauDimensions.z;
    
    const rectHeight = viewHeightWorld * scale;
    const rectY = zRangeY + (zRangeHeight / 2) - (viewCenterZ * scale) - (rectHeight / 2);

    return {
      x: zRangeX,
      y: Math.max(zRangeY, Math.min(rectY, zRangeY + zRangeHeight - Math.max(rectHeight, 0))),
      width: zRangeWidth,
      height: Math.min(Math.max(rectHeight, 2), zRangeHeight)
    };
  }

  // Version pour header
  zToPreviewHeader(worldZ, state, zRangeY, zRangeHeight) {
    const coordinateBounds = state.coordinateBounds || { z: { min: 0, max: 100 } };
    const zRange = coordinateBounds.z.max - coordinateBounds.z.min;
    const scale = zRangeHeight / zRange;
    
    return zRangeY + zRangeHeight - ((worldZ - coordinateBounds.z.min) * scale);
  }

  // Convertir coordonnée Z monde vers preview (Y inversé pour correspondre au canvas Z)
  zToPreview(worldZ, state, zRangeY, zRangeHeight) {
    const coordinateBounds = state.coordinateBounds || { z: { min: 0, max: 100 } };
    const zRange = coordinateBounds.z.max - coordinateBounds.z.min;
    const scale = zRangeHeight / zRange;
    
    return zRangeY + zRangeHeight - ((worldZ - coordinateBounds.z.min) * scale);
  }

  // Convertir coordonnée preview vers Z monde
  previewToZ(previewY, state, zRangeY, zRangeHeight) {
    const plateauDimensions = state.plateauDimensions || { x: 200, y: 200, z: 100 };
    const scale = zRangeHeight / plateauDimensions.z;
    
    return (previewY - zRangeY - zRangeHeight / 2) / scale;
  }

  // Vérifier si un point est dans le preview Z
  isPointInPreview(x, y, canvasWidth, canvasHeight) {
    const previewX = this.margin + 80 + 10;
    const previewY = canvasHeight - this.height - this.margin;
    
    return x >= previewX && x <= previewX + this.width &&
           y >= previewY && y <= previewY + this.height;
  }

  // Gérer le clic sur le preview Z
  handleClick(x, y, canvasWidth, canvasHeight, state) {
    if (!this.isPointInPreview(x, y, canvasWidth, canvasHeight)) return false;

    const previewY = canvasHeight - this.height - this.margin;
    const zRangeY = previewY + 5;
    const zRangeHeight = this.height - 10;

    // Convertir le clic en coordonnée Z monde
    const worldZ = this.previewToZ(y, state, zRangeY, zRangeHeight);
    
    // Centrer la vue Z sur ce point
    if (window.EnderTrack?.ZVisualization?.centerView) {
      window.EnderTrack.ZVisualization.centerView(worldZ);
    }

    return true;
  }

  // Basculer la visibilité
  toggle() {
    this.isVisible = !this.isVisible;
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }

  // Gérer le clic sur le preview Z dans le header
  handleHeaderClick(x, y, state, canvasHeight) {
    // Recalculer la hauteur du plateau pour le clic
    const xyContainer = document.getElementById('miniPreviewXY');
    let plateauHeight = canvasHeight * 0.6;
    
    if (xyContainer) {
      const xyCanvas = xyContainer.querySelector('canvas');
      if (xyCanvas) {
        const coordinateBounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 } };
        const plateauWidthMm = coordinateBounds.x.max - coordinateBounds.x.min;
        const plateauHeightMm = coordinateBounds.y.max - coordinateBounds.y.min;
        const maxDim = Math.max(plateauWidthMm, plateauHeightMm);
        const maxPlateauSize = Math.min(xyCanvas.width, xyCanvas.height) * 0.6;
        plateauHeight = (plateauHeightMm / maxDim) * maxPlateauSize;
      }
    }

    const zRangeHeight = plateauHeight;
    const zRangeY = (canvasHeight - zRangeHeight) / 2;

    // Convertir le clic en coordonnée Z monde
    const worldZ = this.previewToZHeader(y, state, zRangeY, zRangeHeight);
    
    // Centrer la vue Z sur ce point
    if (window.EnderTrack?.ZVisualization?.centerView) {
      window.EnderTrack.ZVisualization.centerView(worldZ);
    }
  }

  // Convertir coordonnée preview vers Z monde (version header)
  previewToZHeader(previewY, state, zRangeY, zRangeHeight) {
    const plateauDimensions = state.plateauDimensions || { x: 200, y: 200, z: 100 };
    const scale = zRangeHeight / plateauDimensions.z;
    
    return -(previewY - zRangeY - zRangeHeight / 2) / scale;
  }

  // Définir la visibilité
  setVisible(visible) {
    this.isVisible = visible;
    if (window.EnderTrack?.Canvas?.requestRender) {
      window.EnderTrack.Canvas.requestRender();
    }
  }
}

// Instance globale
window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.MiniZPreview = new MiniZPreview();