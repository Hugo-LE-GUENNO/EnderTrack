// modules/canvas/mini-preview.js - Mini preview du zoom/pan
// Affiche une mini-carte de navigation dans le coin du canvas

class MiniPreview {
  constructor() {
    this.size = 80;
    this.margin = 10;
    this.isVisible = true;
    this.isDragging = false;
    this.showTrack = true;
    this.followCursor = false; // Mode suivi du curseur
    this.cachedWidth = null; // Cache pour la largeur
  }

  // Dessiner le mini-preview dans le header
  renderInHeader(containerId, state) {
    if (!this.isVisible) return;

    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Vérifier si le conteneur parent est visible
    const parentContainer = container.parentElement;
    if (!parentContainer || parentContainer.classList.contains('collapsed')) {
      this.cachedWidth = null; // Réinitialiser le cache si collapsed
      return;
    }
    
    // Ajuster la largeur du conteneur selon le ratio du canvas principal (une seule fois)
    if (!this.cachedWidth) {
      const mainCanvas = document.getElementById('mapCanvas');
      if (mainCanvas) {
        const mainRect = mainCanvas.getBoundingClientRect();
        const mainRatio = mainRect.height / mainRect.width;
        
        // La hauteur est toujours 100%, calculer la largeur pour respecter le ratio
        const containerHeight = parentContainer.getBoundingClientRect().height;
        this.cachedWidth = containerHeight / mainRatio;
        container.style.width = `${this.cachedWidth}px`;
      }
    } else {
      container.style.width = `${this.cachedWidth}px`;
    }

    // Toujours recréer le canvas pour éviter les problèmes de cache
    let canvas = container.querySelector('canvas');
    if (canvas) {
      canvas.remove();
    }
    
    canvas = document.createElement('canvas');
    const containerRect = container.getBoundingClientRect();
    
    // Ne pas créer de canvas si les dimensions sont nulles
    if (containerRect.width === 0 || containerRect.height === 0) return;
    
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'crosshair';
    container.appendChild(canvas);
    
    // Ajouter les event listeners pour les clics
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      this.handleHeaderClick(x, y, state);
    });
    
    // Clic du milieu pour centrer sur le curseur actuel
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        const state = window.EnderTrack.State.get();
        const currentPos = state.pos;
        if (window.EnderTrack?.CanvasInteractions?.centerOnPosition) {
          window.EnderTrack.CanvasInteractions.centerOnPosition(currentPos.x, currentPos.y);
          window.EnderTrack.Canvas.updateCoordinateSystem();
          window.EnderTrack.Canvas.requestRender();
        }
      }
    });
    
    // Clic droit pour ouvrir le menu contextuel
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY);
    });
    
    // Suivre la souris pour afficher sa position
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      this.mouseX = x;
      this.mouseY = y;
      this.renderMouseOnly(canvas, state);
    });
    
    canvas.addEventListener('mouseleave', () => {
      this.mouseX = null;
      this.mouseY = null;
      this.renderMouseOnly(canvas, state);
    });

    const ctx = canvas.getContext('2d');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Clear avec transparence totale
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Calculer les dimensions réelles du plateau
    const coordinateBounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 } };
    const plateauWidthMm = coordinateBounds.x.max - coordinateBounds.x.min;
    const plateauHeightMm = coordinateBounds.y.max - coordinateBounds.y.min;
    const maxDim = Math.max(plateauWidthMm, plateauHeightMm);
    
    // Taille du plateau en pixels (60% de la minimap)
    const maxPlateauSize = Math.min(canvasWidth, canvasHeight) * 0.6;
    const plateauWidth = (plateauWidthMm / maxDim) * maxPlateauSize;
    const plateauHeight = (plateauHeightMm / maxDim) * maxPlateauSize;
    const plateauX = (canvasWidth - plateauWidth) / 2;
    const plateauY = (canvasHeight - plateauHeight) / 2;
    
    // Plateau (gris foncé semi-transparent)
    ctx.fillStyle = 'rgba(60, 60, 60, 0.5)';
    ctx.fillRect(plateauX, plateauY, plateauWidth, plateauHeight);
    
    // Bordure du plateau (gris clair)
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(plateauX, plateauY, plateauWidth, plateauHeight);

    // Zone visible actuelle (rectangle de la fenêtre)
    const viewRect = this.calculateViewRectHeader(state, plateauX, plateauY, plateauWidth, plateauHeight);
    const viewportColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-viewport').trim() || '#aaaaaa';
    ctx.strokeStyle = viewportColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);
    ctx.fillStyle = `${viewportColor}11`;
    ctx.fillRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);

    // Track (historique des positions)
    if (state.positionHistory && state.positionHistory.length > 1) {
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < state.positionHistory.length; i++) {
        const pos = state.positionHistory[i];
        const point = this.worldToPreviewHeader(pos.x, pos.y, state, plateauX, plateauY, plateauWidth, plateauHeight);
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
    }

    // Point min/min (rouge)
    const minMinPoint = this.worldToPreviewHeader(coordinateBounds.x.min, coordinateBounds.y.min, state, plateauX, plateauY, plateauWidth, plateauHeight);
    const posMinColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-min').trim() || '#f44336';
    ctx.fillStyle = posMinColor;
    ctx.beginPath();
    ctx.arc(minMinPoint.x, minMinPoint.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Point max/max (vert)
    const maxMaxPoint = this.worldToPreviewHeader(coordinateBounds.x.max, coordinateBounds.y.max, state, plateauX, plateauY, plateauWidth, plateauHeight);
    const posMaxColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-max').trim() || '#4caf50';
    ctx.fillStyle = posMaxColor;
    ctx.beginPath();
    ctx.arc(maxMaxPoint.x, maxMaxPoint.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Position actuelle (croix blanche)
    const posPoint = this.worldToPreviewHeader(state.pos.x, state.pos.y, state, plateauX, plateauY, plateauWidth, plateauHeight);
    const posCurrentColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-current').trim() || '#ffffff';
    ctx.strokeStyle = posCurrentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(posPoint.x - 4, posPoint.y);
    ctx.lineTo(posPoint.x + 4, posPoint.y);
    ctx.moveTo(posPoint.x, posPoint.y - 4);
    ctx.lineTo(posPoint.x, posPoint.y + 4);
    ctx.stroke();
    
    // Position souris sur le plateau principal (croix cyan)
    if (state.mouseWorldPos && state.mouseWorldPos.x !== null && state.mouseWorldPos.y !== null) {
      const mx = state.mouseWorldPos.x;
      const my = state.mouseWorldPos.y;
      const isOnPlateau = mx >= coordinateBounds.x.min && mx <= coordinateBounds.x.max &&
                         my >= coordinateBounds.y.min && my <= coordinateBounds.y.max;
      
      if (isOnPlateau) {
        const mousePoint = this.worldToPreviewHeader(mx, my, state, plateauX, plateauY, plateauWidth, plateauHeight);
        const posCursorColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-cursor').trim() || '#00bcd4';
        ctx.strokeStyle = posCursorColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mousePoint.x - 3, mousePoint.y);
        ctx.lineTo(mousePoint.x + 3, mousePoint.y);
        ctx.moveTo(mousePoint.x, mousePoint.y - 3);
        ctx.lineTo(mousePoint.x, mousePoint.y + 3);
        ctx.stroke();
      }
    }
    
    // Position souris en live sur la minimap (si présente)
    if (this.mouseX !== null && this.mouseY !== null) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(this.mouseX, 0);
      ctx.lineTo(this.mouseX, canvasHeight);
      ctx.moveTo(0, this.mouseY);
      ctx.lineTo(canvasWidth, this.mouseY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Point blanc à la position souris
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(this.mouseX, this.mouseY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Indicateur de verrouillage (si actif)
    if (this.followCursor) {
      ctx.fillStyle = 'rgba(255, 193, 7, 0.9)';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', canvasWidth / 2, canvasHeight / 2);
    }
  }

  // Render only mouse cursor (optimized for mousemove)
  renderMouseOnly(canvas, state) {
    if (!canvas || !canvas.getContext) return;
    
    const ctx = canvas.getContext('2d');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Redessiner tout le canvas (nécessaire pour effacer l'ancien curseur)
    // Mais sans recalculer les dimensions du conteneur
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Calculer les dimensions réelles du plateau
    const coordinateBounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 } };
    const plateauWidthMm = coordinateBounds.x.max - coordinateBounds.x.min;
    const plateauHeightMm = coordinateBounds.y.max - coordinateBounds.y.min;
    const maxDim = Math.max(plateauWidthMm, plateauHeightMm);
    
    const maxPlateauSize = Math.min(canvasWidth, canvasHeight) * 0.6;
    const plateauWidth = (plateauWidthMm / maxDim) * maxPlateauSize;
    const plateauHeight = (plateauHeightMm / maxDim) * maxPlateauSize;
    const plateauX = (canvasWidth - plateauWidth) / 2;
    const plateauY = (canvasHeight - plateauHeight) / 2;
    
    // Plateau
    ctx.fillStyle = 'rgba(60, 60, 60, 0.5)';
    ctx.fillRect(plateauX, plateauY, plateauWidth, plateauHeight);
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(plateauX, plateauY, plateauWidth, plateauHeight);

    // Zone visible
    const viewRect = this.calculateViewRectHeader(state, plateauX, plateauY, plateauWidth, plateauHeight);
    const viewportColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-viewport').trim() || '#aaaaaa';
    ctx.strokeStyle = viewportColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);
    ctx.fillStyle = `${viewportColor}11`;
    ctx.fillRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);

    // Track
    if (state.positionHistory && state.positionHistory.length > 1) {
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < state.positionHistory.length; i++) {
        const pos = state.positionHistory[i];
        const point = this.worldToPreviewHeader(pos.x, pos.y, state, plateauX, plateauY, plateauWidth, plateauHeight);
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
    }

    // Points min/max
    const minMinPoint = this.worldToPreviewHeader(coordinateBounds.x.min, coordinateBounds.y.min, state, plateauX, plateauY, plateauWidth, plateauHeight);
    const posMinColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-min').trim() || '#f44336';
    ctx.fillStyle = posMinColor;
    ctx.beginPath();
    ctx.arc(minMinPoint.x, minMinPoint.y, 3, 0, Math.PI * 2);
    ctx.fill();

    const maxMaxPoint = this.worldToPreviewHeader(coordinateBounds.x.max, coordinateBounds.y.max, state, plateauX, plateauY, plateauWidth, plateauHeight);
    const posMaxColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-max').trim() || '#4caf50';
    ctx.fillStyle = posMaxColor;
    ctx.beginPath();
    ctx.arc(maxMaxPoint.x, maxMaxPoint.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Position actuelle
    const posPoint = this.worldToPreviewHeader(state.pos.x, state.pos.y, state, plateauX, plateauY, plateauWidth, plateauHeight);
    const posCurrentColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-current').trim() || '#ffffff';
    ctx.strokeStyle = posCurrentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(posPoint.x - 4, posPoint.y);
    ctx.lineTo(posPoint.x + 4, posPoint.y);
    ctx.moveTo(posPoint.x, posPoint.y - 4);
    ctx.lineTo(posPoint.x, posPoint.y + 4);
    ctx.stroke();
    
    // Position souris sur plateau principal
    if (state.mouseWorldPos && state.mouseWorldPos.x !== null && state.mouseWorldPos.y !== null) {
      const mx = state.mouseWorldPos.x;
      const my = state.mouseWorldPos.y;
      const isOnPlateau = mx >= coordinateBounds.x.min && mx <= coordinateBounds.x.max &&
                         my >= coordinateBounds.y.min && my <= coordinateBounds.y.max;
      
      if (isOnPlateau) {
        const mousePoint = this.worldToPreviewHeader(mx, my, state, plateauX, plateauY, plateauWidth, plateauHeight);
        const posCursorColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-cursor').trim() || '#00bcd4';
        ctx.strokeStyle = posCursorColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mousePoint.x - 3, mousePoint.y);
        ctx.lineTo(mousePoint.x + 3, mousePoint.y);
        ctx.moveTo(mousePoint.x, mousePoint.y - 3);
        ctx.lineTo(mousePoint.x, mousePoint.y + 3);
        ctx.stroke();
      }
    }
    
    // Position souris sur minimap
    if (this.mouseX !== null && this.mouseY !== null) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(this.mouseX, 0);
      ctx.lineTo(this.mouseX, canvasHeight);
      ctx.moveTo(0, this.mouseY);
      ctx.lineTo(canvasWidth, this.mouseY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(this.mouseX, this.mouseY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Indicateur de verrouillage
    if (this.followCursor) {
      ctx.fillStyle = 'rgba(255, 193, 7, 0.9)';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', canvasWidth / 2, canvasHeight / 2);
    }
  }

  // Version originale pour le canvas principal
  render(ctx, canvasWidth, canvasHeight, state) {
    // Ne rien faire - le rendu est géré par le HTML
    return;
  }

  // Version pour header (plus petite)
  calculateViewRectHeader(state, plateauX, plateauY, plateauWidth, plateauHeight) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return { x: plateauX, y: plateauY, width: plateauWidth, height: plateauHeight };
    
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return { x: plateauX, y: plateauY, width: plateauWidth, height: plateauHeight };
    
    const canvasRect = canvas.getBoundingClientRect();
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;
    
    const topLeft = coords.canvasToMap(0, 0);
    const bottomRight = coords.canvasToMap(canvasWidth, canvasHeight);
    
    const viewWidthWorld = Math.abs(bottomRight.x - topLeft.x);
    const viewHeightWorld = Math.abs(bottomRight.y - topLeft.y);
    const viewCenterX = (topLeft.x + bottomRight.x) / 2;
    const viewCenterY = (topLeft.y + bottomRight.y) / 2;
    
    // Convertir le centre de la vue en coordonnées preview
    const centerPoint = this.worldToPreviewHeader(viewCenterX, viewCenterY, state, plateauX, plateauY, plateauWidth, plateauHeight);
    
    // Calculer les dimensions du rectangle en pixels
    const coordinateBounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 } };
    const xRange = coordinateBounds.x.max - coordinateBounds.x.min;
    const yRange = coordinateBounds.y.max - coordinateBounds.y.min;
    const scaleX = plateauWidth / xRange;
    const scaleY = plateauHeight / yRange;
    
    const rectWidth = viewWidthWorld * scaleX;
    const rectHeight = viewHeightWorld * scaleY;

    return {
      x: centerPoint.x - rectWidth / 2,
      y: centerPoint.y - rectHeight / 2,
      width: Math.max(rectWidth, 2),
      height: Math.max(rectHeight, 2)
    };
  }

  // Calculer le rectangle de la zone visible
  calculateViewRect(state, plateauX, plateauY, plateauSize) {
    const coordinateBounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 } };
    
    // Use coordinate system for proper calculation
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return { x: plateauX, y: plateauY, width: plateauSize, height: plateauSize };
    
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return { x: plateauX, y: plateauY, width: plateauSize, height: plateauSize };
    
    const canvasRect = canvas.getBoundingClientRect();
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;
    
    // Get world coordinates of canvas corners
    const topLeft = coords.canvasToMap(0, 0);
    const bottomRight = coords.canvasToMap(canvasWidth, canvasHeight);
    
    // Calculate view dimensions in world coordinates
    const viewWidthWorld = Math.abs(bottomRight.x - topLeft.x);
    const viewHeightWorld = Math.abs(bottomRight.y - topLeft.y);
    const viewCenterX = (topLeft.x + bottomRight.x) / 2;
    const viewCenterY = (topLeft.y + bottomRight.y) / 2;
    
    // Convert to preview coordinates
    const xRange = coordinateBounds.x.max - coordinateBounds.x.min;
    const yRange = coordinateBounds.y.max - coordinateBounds.y.min;
    const scaleX = plateauSize / xRange;
    const scaleY = plateauSize / yRange;
    
    const rectWidth = viewWidthWorld * scaleX;
    const rectHeight = viewHeightWorld * scaleY;
    
    const xCenter = (coordinateBounds.x.min + coordinateBounds.x.max) / 2;
    const yCenter = (coordinateBounds.y.min + coordinateBounds.y.max) / 2;
    
    const rectX = plateauX + (plateauSize / 2) + ((viewCenterX - xCenter) * scaleX) - (rectWidth / 2);
    const rectY = plateauY + (plateauSize / 2) - ((viewCenterY - yCenter) * scaleY) - (rectHeight / 2);

    return {
      x: Math.max(plateauX, Math.min(rectX, plateauX + plateauSize - Math.max(rectWidth, 0))),
      y: Math.max(plateauY, Math.min(rectY, plateauY + plateauSize - Math.max(rectHeight, 0))),
      width: Math.min(Math.max(rectWidth, 2), plateauSize),
      height: Math.min(Math.max(rectHeight, 2), plateauSize)
    };
  }

  // Version pour header
  worldToPreviewHeader(worldX, worldY, state, plateauX, plateauY, plateauWidth, plateauHeight) {
    const coordinateBounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 } };
    const axisOrientation = state.axisOrientation || { x: 'right', y: 'up' };
    
    const xRange = coordinateBounds.x.max - coordinateBounds.x.min;
    const yRange = coordinateBounds.y.max - coordinateBounds.y.min;
    const scaleX = plateauWidth / xRange;
    const scaleY = plateauHeight / yRange;
    
    // Position de l'origine selon l'orientation
    let originX, originY;
    
    if (axisOrientation.x === 'right') {
      originX = plateauX + ((0 - coordinateBounds.x.min) * scaleX);
    } else {
      originX = plateauX + plateauWidth - ((0 - coordinateBounds.x.min) * scaleX);
    }
    
    if (axisOrientation.y === 'up') {
      originY = plateauY + plateauHeight - ((0 - coordinateBounds.y.min) * scaleY);
    } else {
      originY = plateauY + ((0 - coordinateBounds.y.min) * scaleY);
    }
    
    // Calculer la position relative à l'origine
    const dx = axisOrientation.x === 'right' ? worldX * scaleX : -worldX * scaleX;
    const dy = axisOrientation.y === 'up' ? -worldY * scaleY : worldY * scaleY;
    
    return {
      x: originX + dx,
      y: originY + dy
    };
  }

  // Convertir coordonnées monde vers preview
  worldToPreview(worldX, worldY, state, plateauX, plateauY, plateauSize) {
    const mapSize = state.mapSizeMm || 200;
    const axisOrientation = state.axisOrientation || { x: 'right', y: 'up' };
    
    // Apply axis orientation
    const transformedX = axisOrientation.x === 'left' ? -worldX : worldX;
    const transformedY = axisOrientation.y === 'down' ? -worldY : worldY;
    
    const scale = plateauSize / mapSize;
    
    return {
      x: plateauX + (plateauSize / 2) + (transformedX * scale),
      y: plateauY + (plateauSize / 2) - (transformedY * scale)
    };
  }

  // Convertir coordonnées preview vers monde
  previewToWorld(previewX, previewY, state, plateauX, plateauY, plateauSize) {
    const coordinateBounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 } };
    const axisOrientation = state.axisOrientation || { x: 'right', y: 'up' };
    
    const xRange = coordinateBounds.x.max - coordinateBounds.x.min;
    const yRange = coordinateBounds.y.max - coordinateBounds.y.min;
    const scaleX = plateauSize / xRange;
    const scaleY = plateauSize / yRange;
    
    const transformedX = (previewX - plateauX - plateauSize / 2) / scaleX + (coordinateBounds.x.min + coordinateBounds.x.max) / 2;
    const transformedY = -((previewY - plateauY - plateauSize / 2) / scaleY) + (coordinateBounds.y.min + coordinateBounds.y.max) / 2;
    
    return {
      x: axisOrientation.x === 'left' ? -transformedX : transformedX,
      y: axisOrientation.y === 'down' ? -transformedY : transformedY
    };
  }

  // Vérifier si un point est dans le preview
  isPointInPreview(x, y, canvasWidth, canvasHeight) {
    const previewX = this.margin;
    const previewY = canvasHeight - this.size - this.margin;
    
    return x >= previewX && x <= previewX + this.size &&
           y >= previewY && y <= previewY + this.size;
  }

  // Gérer le clic sur le preview
  handleClick(x, y, canvasWidth, canvasHeight, state) {
    if (!this.isPointInPreview(x, y, canvasWidth, canvasHeight)) return false;

    const previewX = this.margin;
    const previewY = canvasHeight - this.size - this.margin;
    const plateauX = previewX + 5;
    const plateauY = previewY + 5;
    const plateauSize = this.size - 10;

    // Convertir le clic en coordonnées monde
    const worldPos = this.previewToWorld(x, y, state, plateauX, plateauY, plateauSize);
    
    // Centrer la vue sur ce point
    if (window.EnderTrack?.Canvas?.centerView) {
      window.EnderTrack.Canvas.centerView(worldPos.x, worldPos.y);
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

  // Afficher le menu contextuel
  showContextMenu(x, y) {
    const menu = document.createElement('div');
    menu.style.cssText = `
      position: fixed; left: ${x}px; top: ${y}px;
      background: var(--container-bg); border: 1px solid var(--border);
      border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000; min-width: 180px; padding: 4px;
    `;
    
    const items = [
      {
        label: this.followCursor ? '🔓 Déverrouiller suivi' : '🔒 Verrouiller sur curseur',
        action: () => this.toggleFollowCursor()
      },
      { separator: true },
      {
        label: '🎯 Centrer sur curseur',
        action: () => this.centerOnCursor()
      }
    ];
    
    items.forEach(item => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: var(--border); margin: 4px 0;';
        menu.appendChild(sep);
      } else {
        const menuItem = document.createElement('div');
        menuItem.textContent = item.label;
        menuItem.style.cssText = `
          padding: 8px 12px; cursor: pointer; font-size: 12px;
          color: var(--text-general); border-radius: 4px;
          transition: all 0.2s ease;
        `;
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.background = 'var(--active-element)';
          menuItem.style.color = 'var(--text-selected)';
        });
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.background = '';
          menuItem.style.color = 'var(--text-general)';
        });
        menuItem.addEventListener('click', () => {
          item.action();
          menu.remove();
        });
        menu.appendChild(menuItem);
      }
    });
    
    document.body.appendChild(menu);
    
    const removeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 0);
  }

  // Basculer le mode suivi du curseur
  toggleFollowCursor() {
    this.followCursor = !this.followCursor;
    if (this.followCursor) {
      this.startFollowing();
    } else {
      this.stopFollowing();
    }
  }

  // Démarrer le suivi
  startFollowing() {
    if (this.followAnimationFrame) return;
    
    const followLoop = () => {
      if (!this.followCursor) return;
      this.centerOnCursor();
      this.followAnimationFrame = requestAnimationFrame(followLoop);
    };
    
    this.followAnimationFrame = requestAnimationFrame(followLoop);
  }

  // Arrêter le suivi
  stopFollowing() {
    if (this.followAnimationFrame) {
      cancelAnimationFrame(this.followAnimationFrame);
      this.followAnimationFrame = null;
    }
  }

  // Centrer sur le curseur
  centerOnCursor() {
    const state = window.EnderTrack.State.get();
    const currentPos = state.pos;
    if (window.EnderTrack?.CanvasInteractions?.centerOnPosition) {
      window.EnderTrack.CanvasInteractions.centerOnPosition(currentPos.x, currentPos.y);
      window.EnderTrack.Canvas.updateCoordinateSystem();
      window.EnderTrack.Canvas.requestRender();
    }
  }

  // Gérer le clic sur le preview dans le header
  handleHeaderClick(x, y, state) {
    const container = document.getElementById('miniPreviewXY');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const canvasWidth = containerRect.width;
    const canvasHeight = containerRect.height;
    const coordinateBounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 } };
    const plateauWidthMm = coordinateBounds.x.max - coordinateBounds.x.min;
    const plateauHeightMm = coordinateBounds.y.max - coordinateBounds.y.min;
    const maxDim = Math.max(plateauWidthMm, plateauHeightMm);
    const maxPlateauSize = Math.min(canvasWidth, canvasHeight) * 0.6;
    const plateauWidth = (plateauWidthMm / maxDim) * maxPlateauSize;
    const plateauHeight = (plateauHeightMm / maxDim) * maxPlateauSize;
    const plateauX = (canvasWidth - plateauWidth) / 2;
    const plateauY = (canvasHeight - plateauHeight) / 2;

    const worldPos = this.previewToWorldHeader(x, y, state, plateauX, plateauY, plateauWidth, plateauHeight);
    
    if (window.EnderTrack?.CanvasInteractions?.centerOnPosition) {
      window.EnderTrack.CanvasInteractions.centerOnPosition(worldPos.x, worldPos.y);
      window.EnderTrack.Canvas.updateCoordinateSystem();
      window.EnderTrack.Canvas.requestRender();
    }
  }

  // Convertir coordonnées preview vers monde (version header)
  previewToWorldHeader(previewX, previewY, state, plateauX, plateauY, plateauWidth, plateauHeight) {
    const coordinateBounds = state.coordinateBounds || { x: { min: -100, max: 100 }, y: { min: -100, max: 100 } };
    const axisOrientation = state.axisOrientation || { x: 'right', y: 'up' };
    
    const xRange = coordinateBounds.x.max - coordinateBounds.x.min;
    const yRange = coordinateBounds.y.max - coordinateBounds.y.min;
    const scaleX = plateauWidth / xRange;
    const scaleY = plateauHeight / yRange;
    
    // Position de l'origine selon l'orientation
    let originX, originY;
    
    if (axisOrientation.x === 'right') {
      originX = plateauX + ((0 - coordinateBounds.x.min) * scaleX);
    } else {
      originX = plateauX + plateauWidth - ((0 - coordinateBounds.x.min) * scaleX);
    }
    
    if (axisOrientation.y === 'up') {
      originY = plateauY + plateauHeight - ((0 - coordinateBounds.y.min) * scaleY);
    } else {
      originY = plateauY + ((0 - coordinateBounds.y.min) * scaleY);
    }
    
    // Calculer les coordonnées monde depuis la position preview
    const dx = previewX - originX;
    const dy = previewY - originY;
    
    const worldX = axisOrientation.x === 'right' ? dx / scaleX : -dx / scaleX;
    const worldY = axisOrientation.y === 'up' ? -dy / scaleY : dy / scaleY;
    
    return { x: worldX, y: worldY };
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
window.EnderTrack.MiniPreview = new MiniPreview();