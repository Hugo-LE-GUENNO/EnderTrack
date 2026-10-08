// modules/canvas/z-renderers/z-grid-renderer.js - Z-axis grid rendering
class ZGridRenderer {
  static render(ctx, canvas, state, zPan, zRange) {
    const bounds = state.coordinateBounds || { z: { min: -20, max: 80 } };
    const zMin = bounds.z.min;
    const zMax = bounds.z.max;
    const zZoom = state.zZoom || (canvas.height / (zMax - zMin));
    const zOrientation = state.axisOrientation?.z || 'up';
    const zInverted = zOrientation === 'down' ? -1 : 1;
    
    const gridColor = window.customColors?.gridColor || '#2a2a00';
    const scaleColor = window.customColors?.zScaleColor || '#ffffff';
    
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.2;
    ctx.font = '10px monospace';
    ctx.fillStyle = scaleColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Calculate grid spacing
    const pixelsPerMm = zZoom;
    let interval = this.calculateGridInterval(zZoom, pixelsPerMm);
    
    // Calculate visible range
    const halfRange = zRange / 2;
    const visibleMinZ = zPan - halfRange;
    const visibleMaxZ = zPan + halfRange;
    
    // Graduations uniquement entre zMin et zMax
    const gridMinZ = Math.max(zMin, Math.floor(visibleMinZ / interval) * interval);
    const gridMaxZ = Math.min(zMax, Math.ceil(visibleMaxZ / interval) * interval);
    
    // Draw grid lines
    this.drawGridLines(ctx, canvas, gridMinZ, gridMaxZ, interval, zMin, zMax, zPan, halfRange, pixelsPerMm, scaleColor, zInverted);
    
    // Draw major graduations for fine grids
    if (interval === 0.01) {
      this.drawMajorGraduations(ctx, canvas, zPan, halfRange, zMin, zMax, zInverted);
    }
    
    // Draw plateau bounds (white lines)
    this.drawPlateauBounds(ctx, canvas, zMin, zMax, zPan, halfRange, zInverted);
    
    // Draw Z=0 line (blue)
    this.drawZeroLine(ctx, canvas, zPan, halfRange, zInverted);
  }

  static calculateGridInterval(zZoom, pixelsPerMm) {
    if (zZoom >= 500) return 0.01;
    
    const targetSpacing = 55;
    const mmSpacing = targetSpacing / pixelsPerMm;
    
    if (mmSpacing <= 0.01) return 0.01;
    else if (mmSpacing <= 0.02) return 0.02;
    else if (mmSpacing <= 0.05) return 0.05;
    else if (mmSpacing <= 0.1) return 0.1;
    else if (mmSpacing <= 0.2) return 0.2;
    else if (mmSpacing <= 0.5) return 0.5;
    else if (mmSpacing <= 1) return 1;
    else if (mmSpacing <= 2) return 2;
    else if (mmSpacing <= 5) return 5;
    else if (mmSpacing <= 10) return 10;
    else if (mmSpacing <= 20) return 20;
    else if (mmSpacing <= 50) return 50;
    else return 100;
  }

  static drawGridLines(ctx, canvas, gridMinZ, gridMaxZ, interval, zMin, zMax, zPan, halfRange, pixelsPerMm, scaleColor, zInverted) {
    // Récupérer les limites de sécurité
    const limits = window.EnderTrack?.StrategicPositions?.getLimits();
    const hasLimits = limits && limits.zShow && limits.zMin !== null && limits.zMax !== null;
    
    // Graduations sur le bord gauche du canvas
    ctx.strokeStyle = 'rgba(136, 136, 136, 0.4)';
    ctx.font = '9px monospace';
    ctx.lineWidth = 1;
    
    for (let z = gridMinZ; z <= gridMaxZ; z += interval) {
      const y = canvas.height/2 - (zInverted * (z - zPan) / halfRange) * (canvas.height/2);
      
      if (y >= 0 && y <= canvas.height) {
        // Tick mark on left edge
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(5, y);
        ctx.stroke();
        
        // Show labels
        const actualSpacing = interval * pixelsPerMm;
        let showLabel = false;
        
        if (interval === 0.01) {
          showLabel = Math.abs(z % 0.1) < 0.005;
        } else {
          showLabel = actualSpacing >= 20;
        }
        
        if (showLabel) {
          const label = interval <= 0.01 ? z.toFixed(2) : interval < 1 ? z.toFixed(1) : z.toString();
          
          // Vérifier si cette graduation correspond à une limite de sécurité
          let isLimit = false;
          if (hasLimits) {
            const tolerance = interval / 2;
            isLimit = Math.abs(z - limits.zMin) < tolerance || Math.abs(z - limits.zMax) < tolerance;
          }
          
          // Color: red for limits, dark green/red for positive/negative
          if (isLimit) {
            ctx.fillStyle = 'rgba(255, 68, 68, 0.8)';
          } else {
            ctx.fillStyle = z >= 0 ? 'rgba(34, 139, 34, 0.8)' : 'rgba(178, 34, 34, 0.8)';
          }
          
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, 7, y);
        }
      }
    }
    
    // Add zMax label if not already included
    if (zMax % interval !== 0) {
      const y = canvas.height/2 - (zInverted * (zMax - zPan) / halfRange) * (canvas.height/2);
      if (y >= 0 && y <= canvas.height) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(5, y);
        ctx.stroke();
        ctx.fillStyle = zMax >= 0 ? 'rgba(34, 139, 34, 0.8)' : 'rgba(178, 34, 34, 0.8)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(zMax.toString(), 7, y);
      }
    }
  }

  static drawMajorGraduations(ctx, canvas, zPan, halfRange, zMin, zMax, zInverted) {
    const visibleMin01 = zPan - halfRange;
    const visibleMax01 = zPan + halfRange;
    // Limiter aux bornes du plateau
    const min01 = Math.max(zMin, Math.floor(visibleMin01 / 0.1) * 0.1);
    const max01 = Math.min(zMax, Math.ceil(visibleMax01 / 0.1) * 0.1);
    
    for (let z = min01; z <= max01; z += 0.1) {
      const y = canvas.height/2 - (zInverted * (z - zPan) / halfRange) * (canvas.height/2);
      
      if (y >= 0 && y <= canvas.height) {
        const majorGridColor = window.customColors?.gridColor || '#333300';
        ctx.strokeStyle = majorGridColor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(5, y);
        ctx.lineTo(canvas.width - 2, y);
        ctx.stroke();
      }
    }
  }
  
  static drawPlateauBounds(ctx, canvas, zMin, zMax, zPan, halfRange, zInverted) {
    const minColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-min').trim();
    const maxColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-max').trim();
    
    const cornerSize = 15;
    const lineWidth = 2;
    
    // Min corner (bottom) - Red L
    const yMin = canvas.height/2 - (zInverted * (zMin - zPan) / halfRange) * (canvas.height/2);
    if (yMin >= 0 && yMin <= canvas.height) {
      ctx.strokeStyle = minColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      // Horizontal line
      ctx.moveTo(0, yMin);
      ctx.lineTo(cornerSize, yMin);
      // Vertical line going up
      ctx.moveTo(0, yMin);
      ctx.lineTo(0, yMin - cornerSize);
      ctx.stroke();
    }
    
    // Max corner (top) - Green L
    const yMax = canvas.height/2 - (zInverted * (zMax - zPan) / halfRange) * (canvas.height/2);
    if (yMax >= 0 && yMax <= canvas.height) {
      ctx.strokeStyle = maxColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      // Horizontal line
      ctx.moveTo(0, yMax);
      ctx.lineTo(cornerSize, yMax);
      // Vertical line going down
      ctx.moveTo(0, yMax);
      ctx.lineTo(0, yMax + cornerSize);
      ctx.stroke();
    }
  }
  
  static drawZeroLine(ctx, canvas, zPan, halfRange, zInverted) {
    const yZero = canvas.height/2 - (zInverted * (0 - zPan) / halfRange) * (canvas.height/2);
    if (yZero >= 0 && yZero <= canvas.height) {
      // Discrete origin line only
      const originColor = getComputedStyle(document.documentElement).getPropertyValue('--pos-origin').trim();
      ctx.strokeStyle = originColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(0, yZero);
      ctx.lineTo(canvas.width, yZero);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

window.EnderTrack = window.EnderTrack || {};
window.EnderTrack.ZGridRenderer = ZGridRenderer;