// modules/canvas/renderers/grid-renderer.js - Grid and axes rendering
class GridRenderer {
  static render(ctx, canvas, state) {
    if (state.showGrid === false) return;
    
    const zoom = state.zoom || 1;
    const panX = state.panX || 0;
    const panY = state.panY || 0;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Use coordinate bounds if available, fallback to plateau dimensions
    const bounds = state.coordinateBounds || {
      x: { min: -100, max: 100 },
      y: { min: -100, max: 100 },
      z: { min: 0, max: 100 }
    };
    
    const axisOrientation = state.axisOrientation || {
      x: 'right',
      y: 'up',
      z: 'up'
    };
    
    this.renderGridLines(ctx, zoom, centerX, centerY, panX, panY, bounds, axisOrientation);
    this.renderOriginAxes(ctx, canvas, state, bounds, axisOrientation);
    this.renderGridLabels(ctx, state, zoom, panX, panY, bounds, axisOrientation);
    this.renderCoordinateBounds(ctx, canvas, state, bounds, axisOrientation);
  }

  static renderGridLines(ctx, zoom, centerX, centerY, panX, panY, bounds, axisOrientation) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    // Get plateau corners
    const topLeft = coords.mapToCanvas(bounds.x.min, bounds.y.max);
    const bottomRight = coords.mapToCanvas(bounds.x.max, bounds.y.min);
    
    const plateauLeft = Math.min(topLeft.cx, bottomRight.cx);
    const plateauRight = Math.max(topLeft.cx, bottomRight.cx);
    const plateauTop = Math.min(topLeft.cy, bottomRight.cy);
    const plateauBottom = Math.max(topLeft.cy, bottomRight.cy);
    
    // Determine grid spacing based on zoom level - extended for microscopic scales
    let gridSpacing = 10;
    if (zoom > 10000) gridSpacing = 0.001;      // 1 µm
    else if (zoom > 5000) gridSpacing = 0.002;  // 2 µm
    else if (zoom > 2000) gridSpacing = 0.005;  // 5 µm
    else if (zoom > 1000) gridSpacing = 0.01;   // 10 µm
    else if (zoom > 500) gridSpacing = 0.02;    // 20 µm
    else if (zoom > 200) gridSpacing = 0.05;    // 50 µm
    else if (zoom > 100) gridSpacing = 0.1;     // 100 µm
    else if (zoom > 50) gridSpacing = 0.5;      // 500 µm
    else if (zoom > 20) gridSpacing = 1;        // 1 mm
    else if (zoom > 10) gridSpacing = 2;
    else if (zoom > 5) gridSpacing = 5;
    else if (zoom > 2) gridSpacing = 10;
    else if (zoom > 1) gridSpacing = 20;
    else gridSpacing = 50;
    
    // Major grid spacing (every 5 lines)
    const majorSpacing = gridSpacing * 5;
    
    const gridColor = window.customColors?.gridColor || getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
    
    // Adaptive opacity based on zoom - more visible when zoomed in
    const baseOpacity = Math.min(0.6, 0.3 + (zoom / 100));
    
    // Clip to plateau area
    ctx.save();
    ctx.beginPath();
    ctx.rect(plateauLeft, plateauTop, plateauRight - plateauLeft, plateauBottom - plateauTop);
    ctx.clip();
    
    // Draw minor grid lines first (thinner)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = baseOpacity * 0.5;
    ctx.beginPath();
    
    const startX = Math.floor(bounds.x.min / gridSpacing) * gridSpacing;
    const endX = Math.ceil(bounds.x.max / gridSpacing) * gridSpacing;
    
    for (let x = startX; x <= endX; x += gridSpacing) {
      // Skip major lines
      if (Math.abs(x % majorSpacing) < gridSpacing * 0.01) continue;
      
      const canvasPos = coords.mapToCanvas(x, 0);
      ctx.moveTo(canvasPos.cx, plateauTop);
      ctx.lineTo(canvasPos.cx, plateauBottom);
    }
    
    const startY = Math.floor(bounds.y.min / gridSpacing) * gridSpacing;
    const endY = Math.ceil(bounds.y.max / gridSpacing) * gridSpacing;
    
    for (let y = startY; y <= endY; y += gridSpacing) {
      // Skip major lines
      if (Math.abs(y % majorSpacing) < gridSpacing * 0.01) continue;
      
      const canvasPos = coords.mapToCanvas(0, y);
      ctx.moveTo(plateauLeft, canvasPos.cy);
      ctx.lineTo(plateauRight, canvasPos.cy);
    }
    
    ctx.stroke();
    
    // Draw major grid lines (thicker, more visible)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = baseOpacity;
    ctx.beginPath();
    
    for (let x = startX; x <= endX; x += majorSpacing) {
      const canvasPos = coords.mapToCanvas(x, 0);
      ctx.moveTo(canvasPos.cx, plateauTop);
      ctx.lineTo(canvasPos.cx, plateauBottom);
    }
    
    for (let y = startY; y <= endY; y += majorSpacing) {
      const canvasPos = coords.mapToCanvas(0, y);
      ctx.moveTo(plateauLeft, canvasPos.cy);
      ctx.lineTo(plateauRight, canvasPos.cy);
    }
    
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  static renderOriginAxes(ctx, canvas, state, bounds, axisOrientation) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    const originPos = coords.mapToCanvas(0, 0);
    
    // Get plateau corners
    const topLeft = coords.mapToCanvas(bounds.x.min, bounds.y.max);
    const bottomRight = coords.mapToCanvas(bounds.x.max, bounds.y.min);
    
    const plateauLeft = Math.min(topLeft.cx, bottomRight.cx);
    const plateauRight = Math.max(topLeft.cx, bottomRight.cx);
    const plateauTop = Math.min(topLeft.cy, bottomRight.cy);
    const plateauBottom = Math.max(topLeft.cy, bottomRight.cy);
    
    // Only draw axes if origin is within plateau bounds
    if (originPos.cx >= plateauLeft && originPos.cx <= plateauRight && 
        originPos.cy >= plateauTop && originPos.cy <= plateauBottom) {
      
      // Clip to plateau area
      ctx.save();
      ctx.beginPath();
      ctx.rect(plateauLeft, plateauTop, plateauRight - plateauLeft, plateauBottom - plateauTop);
      ctx.clip();
      
      // Draw large discrete cross through entire plateau
      const originColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-origin').trim();
      ctx.strokeStyle = originColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      
      ctx.beginPath();
      // Horizontal line (X axis)
      ctx.moveTo(plateauLeft, originPos.cy);
      ctx.lineTo(plateauRight, originPos.cy);
      // Vertical line (Y axis)
      ctx.moveTo(originPos.cx, plateauTop);
      ctx.lineTo(originPos.cx, plateauBottom);
      ctx.stroke();
      
      ctx.restore();
      ctx.globalAlpha = 1;
      
      // Origin marker - small blue circle
      ctx.fillStyle = originColor;
      ctx.strokeStyle = originColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(originPos.cx, originPos.cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  static renderGridLabels(ctx, state, zoom, panX, panY, bounds, axisOrientation) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    const mmToPx = coords.pxPerMm() * coords.zoom;
    if (mmToPx < 2) return; // Don't show labels when too zoomed out
    
    // Determine label spacing based on zoom
    let labelSpacing = 50;
    if (mmToPx >= 100) labelSpacing = 1;
    else if (mmToPx >= 50) labelSpacing = 2;
    else if (mmToPx >= 20) labelSpacing = 5;
    else if (mmToPx >= 10) labelSpacing = 10;
    else if (mmToPx >= 5) labelSpacing = 20;
    else if (mmToPx >= 2) labelSpacing = 50;
    else labelSpacing = 100;
    
    // Style for ruler - discrete and always visible
    ctx.strokeStyle = 'rgba(136, 136, 136, 0.4)';
    ctx.font = '9px monospace';
    ctx.lineWidth = 1;
    
    // X axis ruler (bottom edge of canvas)
    const startX = Math.floor(bounds.x.min / labelSpacing) * labelSpacing;
    const endX = Math.floor(bounds.x.max / labelSpacing) * labelSpacing;
    
    for (let x = startX; x <= endX; x += labelSpacing) {
      const canvasPos = coords.mapToCanvas(x, 0);
      // Only draw if within canvas bounds
      if (canvasPos.cx >= 0 && canvasPos.cx <= ctx.canvas.width) {
        // Tick mark at bottom
        ctx.beginPath();
        ctx.moveTo(canvasPos.cx, ctx.canvas.height);
        ctx.lineTo(canvasPos.cx, ctx.canvas.height - 5);
        ctx.stroke();
        
        // Label at bottom with color based on sign
        ctx.fillStyle = x >= 0 ? 'rgba(34, 139, 34, 0.8)' : 'rgba(178, 34, 34, 0.8)'; // Dark green / Dark red
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(x.toString(), canvasPos.cx, ctx.canvas.height - 6);
      }
    }
    
    // Add max X value if not already included
    if (bounds.x.max % labelSpacing !== 0) {
      const canvasPos = coords.mapToCanvas(bounds.x.max, 0);
      if (canvasPos.cx >= 0 && canvasPos.cx <= ctx.canvas.width) {
        ctx.beginPath();
        ctx.moveTo(canvasPos.cx, ctx.canvas.height);
        ctx.lineTo(canvasPos.cx, ctx.canvas.height - 5);
        ctx.stroke();
        ctx.fillStyle = bounds.x.max >= 0 ? 'rgba(34, 139, 34, 0.8)' : 'rgba(178, 34, 34, 0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(bounds.x.max.toString(), canvasPos.cx, ctx.canvas.height - 6);
      }
    }
    
    // Y axis ruler (left edge of canvas)
    const startY = Math.floor(bounds.y.min / labelSpacing) * labelSpacing;
    const endY = Math.floor(bounds.y.max / labelSpacing) * labelSpacing;
    
    for (let y = startY; y <= endY; y += labelSpacing) {
      const canvasPos = coords.mapToCanvas(0, y);
      // Only draw if within canvas bounds
      if (canvasPos.cy >= 0 && canvasPos.cy <= ctx.canvas.height) {
        // Tick mark at left
        ctx.beginPath();
        ctx.moveTo(0, canvasPos.cy);
        ctx.lineTo(5, canvasPos.cy);
        ctx.stroke();
        
        // Label at left with color based on sign
        ctx.fillStyle = y >= 0 ? 'rgba(34, 139, 34, 0.8)' : 'rgba(178, 34, 34, 0.8)'; // Dark green / Dark red
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(y.toString(), 7, canvasPos.cy);
      }
    }
    
    // Add max Y value if not already included
    if (bounds.y.max % labelSpacing !== 0) {
      const canvasPos = coords.mapToCanvas(0, bounds.y.max);
      if (canvasPos.cy >= 0 && canvasPos.cy <= ctx.canvas.height) {
        ctx.beginPath();
        ctx.moveTo(0, canvasPos.cy);
        ctx.lineTo(5, canvasPos.cy);
        ctx.stroke();
        ctx.fillStyle = bounds.y.max >= 0 ? 'rgba(34, 139, 34, 0.8)' : 'rgba(178, 34, 34, 0.8)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(bounds.y.max.toString(), 7, canvasPos.cy);
      }
    }
  }
  
  static renderCoordinateBounds(ctx, canvas, state, bounds, axisOrientation) {
    const coords = window.EnderTrack?.Coordinates;
    if (!coords) return;
    
    // Get corner positions
    const minCorner = coords.mapToCanvas(bounds.x.min, bounds.y.min);
    const maxCorner = coords.mapToCanvas(bounds.x.max, bounds.y.max);
    
    const minColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-min').trim();
    const maxColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-max').trim();
    
    const cornerSize = 15;
    const lineWidth = 2;
    
    // Determine L direction: branches point INWARD (toward the other corner)
    const dx = maxCorner.cx > minCorner.cx ? 1 : -1;
    const dy = maxCorner.cy > minCorner.cy ? 1 : -1;
    
    // Min corner - Red L (branches point toward max)
    ctx.strokeStyle = minColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(minCorner.cx, minCorner.cy);
    ctx.lineTo(minCorner.cx + dx * cornerSize, minCorner.cy);
    ctx.moveTo(minCorner.cx, minCorner.cy);
    ctx.lineTo(minCorner.cx, minCorner.cy + dy * cornerSize);
    ctx.stroke();
    
    // Max corner - Green L (branches point toward min)
    ctx.strokeStyle = maxColor;
    ctx.beginPath();
    ctx.moveTo(maxCorner.cx, maxCorner.cy);
    ctx.lineTo(maxCorner.cx - dx * cornerSize, maxCorner.cy);
    ctx.moveTo(maxCorner.cx, maxCorner.cy);
    ctx.lineTo(maxCorner.cx, maxCorner.cy - dy * cornerSize);
    ctx.stroke();
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.GridRenderer = GridRenderer;